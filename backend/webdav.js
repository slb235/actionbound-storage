const { createClient } = require('webdav')
const fs = require('fs-extra')
const { indexFile } = require('./shared')
const logger = require('../logger')

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class WebDavBackend {
  constructor (options) {
    this.url = options.url
    this.id = options.id
    this.client = createClient(options.url, { username: options.username, password: options.password })
  }

  /*
  backend must implement the following interface

  - async exists (file) -> bool
  - createReadStream (file) -> stream
  - async writeStream (file, stream)
  - async putFile (src, file)
  - async getFile (file, dest)
  - async unlink (file)
  - async indexFile (file)
  - async index (options)
*/

  async getInfo () {
    return {
      type: 'webdav',
      url: this.url,
      id: this.id
    }
  }

  async exists (file) {
    return await this.client.exists(`/${file}`)
  }

  async createReadStream (file) {
    return this.client.createReadStream(`/${file}`)
  }

  async writeStream (file, stream) {
    const direcotries = file.split('/').slice(0, -1)
    let currentDirectory = ''
    for (const directory of direcotries) {
      currentDirectory += `/${directory}`
      logger.silly(`looking if directory ${currentDirectory} exists`)
      if (!await this.client.exists(`${currentDirectory}/`)) {
        logger.silly('does not exists, creating it')
        await this.client.createDirectory(currentDirectory)
      }
    }

    return await new Promise((resolve, reject) => {
      const ws = this.client.createWriteStream(`/${file}`)
      logger.silly('starting streaming to webdav')

      stream.pipe(ws)
      stream.on('error', reject)
      stream.on('end', async () => {
        logger.silly('finished streaming to webdav')
        // delay a bit to allow following index operations to succeed
        await delay(2000)
        logger.silly('resolving')
        resolve()
      })
    })
  }

  async putFile (src, file) {
    return await new Promise((resolve, reject) => {
      const rs = fs.createReadStream(src)
      const ws = this.client.createWriteStream(`/${file}`)

      rs.pipe(ws)
      rs.on('error', reject)
      rs.on('end', resolve)
    })
  }

  async unlink (file) {
    await this.client.deleteFile(`/${file}`)
    const folders = file.split('/').slice(0, -1)
    for (let index = folders.length; index > 0; index--) {
      const folderPath = folders.slice(0, index).join('/')
      if ((await this.client.getDirectoryContents(`/${folderPath}`)).length === 0) {
        await this.client.deleteFile(`/${folderPath}/`)
      }
    }

    /*
        const fullPath = this._fullPath(file)
    await fs.unlink(fullPath)

    const folders =

    try {
      // delete containting folders if not empty
      for (let index = folders.length; index > 0; index--) {
        const folderPath = folders.slice(0, index).join(path.sep)
        await fs.rmdir(path.join(this.basePath, folderPath))
      }
    } catch (err) {
      // usualy ENOTEMPTY
    }
    */
  }

  async indexFile (file) {
    logger.silly(`requesting stat for /${file}`)
    const stat = await this.client.stat(`/${file}`)
    logger.debug(`indexing file ${file}: `, stat)
    return await indexFile(file, { size: stat.size, mtime: new Date(stat.lastmod).getTime() }, this.id)
  }

  async _indexDirectory (folder, options) {
    const content = await this.client.getDirectoryContents(folder)
    for (const entry of content) {
      if (this.indexShouldStop) {
        return
      }
      if (entry.type === 'directory') {
        await this._indexDirectory(entry.filename, options)
      }
      if (entry.type === 'file') {
        const file = entry.filename.substr(1)
        await indexFile(file, { size: entry.size, mtime: new Date(entry.lastmod).getTime() }, this.id)
        this.indexShouldStop = !await options.tick(file)
      }
    }
  }

  async index (options) {
    logger.info(`indexing ${this.id}`)
    this.indexShouldStop = false
    await this._indexDirectory('/', options)
    if (options.completed) {
      await options.completed(this.indexShouldStop)
    }
  }
}

module.exports = WebDavBackend
