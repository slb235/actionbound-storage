const logger = require('../logger')
const SMB2 = require('@marsaud/smb2')
const { indexFile, streamEnd } = require('./shared')

class SMBBackend {
  constructor (options) {
    logger.info('creating new SMBBackend with options', options)
    this.id = options.id
    this.client = new SMB2({
      share: options.share,
      domain: options.domain,
      username: options.username,
      password: options.password
    })
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
  _convertPath (file) {
    return file.replace('/', '\\')
  }

  async exists (file) {
    return await this.client.exists(this._convertPath(file))
  }

  async createReadStream (file) {
    return this.client.createReadStream(this._convertPath(file))
  }

  async writeStream (file, stream) {
    const ws = this.client.createWriteStream(this._convertPath(file))
    stream.pipe(ws)
    await streamEnd(stream)
  }

  async unlink (file) {
    return await this.client.unlink(this._convertPath(file))
  }

  async indexFile (file) {
    const stat = await this.client.stat(this._convertPath(file))
    return await indexFile(file, { size: stat.size, mtime: stat.mtime.getTime() }, this.id)
  }
}

module.exports = SMBBackend
