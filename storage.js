
const FileBackend = require('./backend/file')
const WebdavBackend = require('./backend/webdav')
const S3Backend = require('./backend/s3')
const SMBBackend = require('./backend/smb')
const SFTPBackend = require('./backend/sftp')
const MinioBackend = require('./backend/minio')
const config = require('./config')
const logger = require('./logger')
const _ = require('lodash')
const { db } = require('./connection')
const { FileNotFoundError } = require('./errors')

const files = db.collection('files')

/*
  backend must implement the following interface

  - async exists (file) -> bool
  - async createReadStream (file) -> stream
  - async writeStream (file, stream)
  - async unlink (file)
  - async indexFile (file)
  - async index (options)
  // - async putFile (src, file)
  // - async getFile (file, dest)
*/

class Storage {
  constructor () {
    this.backends = []
    for (const backend of config.backends) {
      switch (backend.backend) {
        case 'file':
          this.backends.push(new FileBackend(backend))
          break
        case 'webdav':
          this.backends.push(new WebdavBackend(backend))
          break
        case 's3':
          this.backends.push(new S3Backend(backend))
          break
        case 'smb':
          this.backends.push(new SMBBackend(backend))
          break
        case 'sftp':
          this.backends.push(new SFTPBackend(backend))
          break
        case 'minio':
          this.backends.push(new MinioBackend(backend))
          break
        default:
          throw new Error('Backend unkonw')
      }
    }
  }

  getBackend (id) {
    return this.backends.find((backend) => backend.id === id)
  }

  getPreferedBackend (backends) {
    for (const backend of this.backends) {
      if (_.includes(backends, backend.id)) {
        return backend
      }
    }
  }

  async findBackendForFile (file) {
    logger.silly(`looking for file ${file}`)
    const dbFile = await files.findOne({ _id: file })
    if (dbFile) {
      logger.silly('found file in database')
      return this.getPreferedBackend(dbFile.backends)
    } else {
      if (config.indexOnRequest) {
        logger.silly('did not find in database, try finding it on backends')
        for (const backend of this.backends) {
          if (await backend.exists(file)) {
            await backend.indexFile(file)
            return backend
          }
        }
      }
      return null
    }
  }

  async findBackendsForFile (file) {
    logger.silly(`looking for file ${file}`)
    const dbFile = await files.findOne({ _id: file })
    if (dbFile) {
      logger.silly('found file in database')
      return this.backends.filter((backend) => _.includes(dbFile.backends, backend.id))
    } else {
      if (config.indexOnRequest) {
        logger.silly('did not find in database, try finding it on backends')
        const backends = []
        for (const backend of this.backends) {
          if (await backend.exists(file)) {
            backends.push(backend)
          }
        }
        return backends
      }
      return []
    }
  }

  async findBestWriteBackend () {
    return this.backends[0]
  }

  async exists (file) {
    const backend = await this.findBackendForFile(file)
    if (backend) {
      return true
    } else {
      return false
    }
  }

  async createReadStream (file, options = {}) {
    const backend = await this.findBackendForFile(file)
    if (!backend) {
      throw new FileNotFoundError(file)
    }
    return await backend.createReadStream(file)
  }

  async getFileInfo (file) {
    return await files.findOne({ _id: file })
  }

  async createWriteStream (file) {
    const backend = await this.findBestWriteBackend()
    return backend.createWriteStream(file)
  }

  async writeStream (file, stream) {
    const backend = await this.findBestWriteBackend()
    logger.silly('bestWriteBackend seems to be', backend._id)
    await backend.writeStream(file, stream)
    await backend.indexFile(file)
  }

  async indexFile (file) {
    for (const backend of this.backends) {
      if (await backend.exists(file)) {
        backend.indexFile(file)
      }
    }
  }

  async unlink (file) {
    const backends = await this.findBackendsForFile(file)
    if (backends.length < 1) {
      throw new FileNotFoundError(file)
    }
    await Promise.all(backends.map((backend) => backend.unlink(file)))
    return await files.deleteOne({ _id: file })
  }
}

// Export as signleton
const storage = new Storage()
module.exports = storage
