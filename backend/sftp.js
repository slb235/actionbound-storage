const logger = require('../logger')
const SFTP = require('ssh2-sftp-client')
const { indexFile, streamEnd } = require('./shared')
const fs = require('fs-extra')
const crypto = require('crypto')
const path = require('path')

class SFTPBackend {
  constructor (options) {
    logger.info('creating new SFTPBackend with options', options)
    this.id = options.id
    this.client = new SFTP()
    this.clientOptions = {
      host: options.host,
      port: options.port || 22,
      username: options.username,
      password: options.password
    }
    this.client.connect(this.clientOptions)
  }

  /*
  backend must implement the following interface

  - async exists (file) -> bool
  - createReadStream (file) -> stream
  - async writeStream (file, stream)
  - async unlink (file)
  - async indexFile (file)
  - async index (options)
  // - async putFile (src, file)
  // - async getFile (file, dest)
  */

  async exists (file) {
    return (await this.client.exists(`/${file}`)) === '-'
  }

  async createReadStream (file, options) {
    const tmpFileName = `./tmp/tmp-${crypto.randomBytes(4).readUInt32LE(0)}`
    await this.client.fastGet(`/${file}`, tmpFileName)
    const rs = fs.createReadStream(tmpFileName, options)
    rs.on('end', () => fs.unlink(tmpFileName))
    return rs
  }

  async writeStream (file, stream) {
    const tmpFileName = `./tmp/tmp-${crypto.randomBytes(4).readUInt32LE(0)}`
    logger.silly(`writeStream streaming input to ${tmpFileName}`)
    const ws = fs.createWriteStream(tmpFileName)
    stream.pipe(ws)
    await streamEnd(stream)
    logger.silly(`writeStream streaming ${tmpFileName} to scp ${file}`)
    const dirname = path.dirname(file)
    if (dirname) {
      await this.client.mkdir(`/${dirname}`, true)
    }
    await this.client.fastPut(tmpFileName, `/${file}`)
    logger.silly('writeStream unlinking tempfile', tmpFileName)
    await fs.unlink(tmpFileName)
  }

  async unlink (file) {
    await this.client.delete(`${file}`)
    const folders = file.split(path.sep).slice(0, -1)
    try {
      // delete folders if they are emtyp. on sftp lib page there is a note that we should check if direcotry is empty even if we dont delete recursive
      for (let index = folders.length; index > 0; index--) {
        const folderPath = folders.slice(0, index).join(path.sep)
        const content = await this.client.list(`/${folderPath}`)
        if (content.length === 0) {
          logger.silly(`removing emtyp folder ${folderPath}`)
          await this.client.rmdir(`/${folderPath}`)
        }
      }
    } catch (err) {
      // usualy ENOTEMPTY
    }
  }

  async indexFile (file) {
    const stat = await this.client.stat(`/${file}`)
    return await indexFile(file, { size: stat.size, mtime: stat.modifyTime }, this.id)
  }

  async _indexDirectory (directory, options) {
    const content = await this.client.list(`/${directory}`)
    for (const entry of content) {
      const file = directory ? `${directory}/${entry.name}` : entry.name
      if (this.indexShouldStop) {
        return
      }
      if (entry.type === 'd') {
        await this._indexDirectory(file, options)
      }
      if (entry.type === '-') {
        const fileEntry = await indexFile(file, { size: entry.size, mtime: entry.modifyTime }, this.id)
        this.indexShouldStop = !await options.tick(fileEntry)
      }
    }
  }

  async index (options) {
    logger.info(`indexing ${this.id}`)
    this.indexShouldStop = false
    await this._indexDirectory('', options)
    return !this.indexShouldStop
  }
}

module.exports = SFTPBackend
