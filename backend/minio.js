const logger = require('../logger')
const Minio = require('minio')
const { streamEnd, indexFile } = require('./shared')

class MinioBackend {
  constructor (options) {
    logger.info('creating new MinioBackend with options', options)
    this.id = options.id
    this.minio = new Minio.Client({
      endPoint: options.host,
      port: options.port || 9000,
      useSSL: options.ssl || false,
      accessKey: options.key,
      secretKey: options.secret
    })
    this.bucket = options.bucket
  }

  async exists (file) {
    try {
      const status = await this.minio.statObject(this.bucket, file)
      logger.silly('head object response', status)
      return true
    } catch (error) {
      logger.silly('head object error (file not found)', error)
      return false
    }
  }

  async createReadStream (file) {
    return await this.minio.getObject(this.bucket, file)
    /*
    return this.minio.getObject(this._params(file)).createReadStream()
    */
  }

  async writeStream (file, stream) {
    logger.silly('starting writeStream with params')
    const result = await this.minio.putObject(this.bucket, file, stream)
    logger.silly('upload result', result)
    return result
  }

  async unlink (file) {
    const result = await this.minio.removeObject(this.bucket, file)
    logger.debug(`unlinking result for file ${file}`, result)
  }

  async indexFile (file) {
    const stat = await this.minio.statObject(this.bucket, file)
    logger.debug(`indexing file ${file}: `, stat)
    return await indexFile(file, { size: stat.size, mtime: stat.lastModified }, this.id)
  }

  async index (options) {
    logger.info(`indexing ${this.id}`)

    const stream = this.minio.listObjects(this.bucket, '', true)

    let tickInProgress = false
    stream.on('data', async (file) => {
      const fileEntry = await indexFile(file.name, { size: file.size, mtime: file.lastModified }, this.id)
      logger.silly('index', fileEntry)
      if (!tickInProgress) {
        tickInProgress = true
        if (!await options.tick(fileEntry)) {
          stream.close()
        }
      } else {
        logger.silly('tick is indeed in progress')
      }
    })

    await streamEnd(stream)
    return true
    /*
    logger.info(`indexing ${this.id}`)
    const params = { Bucket: this.bucket, MaxKeys: 1000 }
    let last

    while (true) {
      const result = await this.minio.listObjectsV2(params).promise()

      for (const file of result.Contents) {
        last = await indexFile(file.Key, { size: file.Size, mtime: file.LastModified }, this.id)
      }

      if (!await options.tick(last)) {
        return await options.completed(true)
      }

      if (result.IsTruncated) {
        params.ContinuationToken = result.NextContinuationToken
      } else {
        break
      }
    }

    if (options.completed) {
      await options.completed(false)
    }
    */
  }
}

module.exports = MinioBackend
