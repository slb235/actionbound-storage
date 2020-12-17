const fs = require('fs-extra')
const path = require('path')
const logger = require('../logger')
const { indexFile, streamEnd } = require('./shared')

class FileBackend {
  constructor (options) {
    logger.info('creating new FileBackend with options', options)
    this.id = options.id
    this.basePath = path.resolve(options.path)
  }

  async getInfo () {
    return {
      type: 'file',
      url: this.basePath,
      id: this.id
    }
  }

  _fullPath (file) {
    return path.join(this.basePath, file)
  }

  async exists (file) {
    try {
      await fs.stat(this._fullPath(file))
      return true
    } catch (err) {
      return false
    }
  }

  async createReadStream (file, options) {
    return fs.createReadStream(this._fullPath(file), options)
  }

  async createWriteStream (file) {
    const fullPath = this._fullPath(file)
    await fs.ensureDir(path.dirname(fullPath))
    return fs.createWriteStream(fullPath)
  }

  async writeStream (file, stream) {
    const ws = await this.createWriteStream(file)
    stream.pipe(ws)
    await streamEnd(stream)
  }

  async putFile (src, file) {
    const fullPath = this._fullPath(file)
    await fs.ensureDir(fullPath)
    return await fs.copy(src, fullPath)
  }

  async getFile (file, dest) {
    await fs.copy(this._fullPath(file), dest)
  }

  async unlink (file) {
    const fullPath = this._fullPath(file)
    await fs.unlink(fullPath)

    const folders = file.split(path.sep).slice(0, -1)

    try {
      // delete containting folders if not empty
      for (let index = folders.length; index > 0; index--) {
        const folderPath = folders.slice(0, index).join(path.sep)
        await fs.rmdir(path.join(this.basePath, folderPath))
      }
    } catch (err) {
      // usualy ENOTEMPTY
    }
  }

  async indexFile (file) {
    const stat = await fs.stat(this._fullPath(file))
    logger.debug(`indexing file ${file}: `, stat)
    return await indexFile(file, { size: stat.size, mtime: stat.mtimeMs }, this.id)
  }

  async _indexDirectory (folder, options) {
    const directoryPath = folder ? this._fullPath(folder) : this.basePath
    let directory
    try {
      directory = await fs.opendir(directoryPath)
    } catch (err) {
      logger.info(`cant open directory ${directory}. skipping`)
      return
    }

    logger.info(`indexing directory ${directoryPath}`)
    while (true) {
      if (this.indexShouldStop) {
        break
      }
      const item = await directory.read()
      if (!item) {
        break
      }
      if (item.isDirectory()) {
        logger.debug(`found directory ${item.name}`)
        await this._indexDirectory(folder ? path.join(folder, item.name) : item.name, options)
      } else {
        const file = folder ? path.join(folder, item.name) : item.name
        logger.debug(`found file: ${file}`)
        const fileEntry = await this.indexFile(file)

        if (options.tick) {
          this.indexShouldStop = !await options.tick(fileEntry)
        }
      }
    }
    await directory.close()
    logger.info('done')
  }

  async index (options) {
    logger.info(`indexing ${this.id}`)
    this.indexShouldStop = false
    await this._indexDirectory(undefined, options)
    return !this.indexShouldStop
  }
}

module.exports = FileBackend
