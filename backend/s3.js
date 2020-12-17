const logger = require('../logger')
const AWS = require('aws-sdk')
const fs = require('fs-extra')
const { indexFile } = require('./shared')

class S3Backend {
  constructor (options) {
    logger.info('creating new S3Backend with options', options)
    this.id = options.id
    this.s3 = new AWS.S3({
      accessKeyId: options.key,
      secretAccessKey: options.secret,
      region: options.region
    })
    this.bucket = options.bucket
  }

  _params (file) {
    return {
      Bucket: this.bucket,
      Key: file
    }
  }

  async exists (file) {
    try {
      const status = await this.s3.headObject(this._params(file)).promise()
      logger.silly('head object response', status)
      return true
    } catch (error) {
      logger.silly('head object error (file not found)', error)
      return false
    }
  }

  async createReadStream (file, options) {
    const s3Params = this._params(file)
    if (Number.isFinite(options.start) && Number.isFinite(options.end)) {
      s3Params.Range = `bytes=${options.start}-${options.end}`
    }
    return this.s3.getObject(s3Params).createReadStream()
  }

  async writeStream (file, stream) {
    const params = { ...this._params(file), Body: stream }
    logger.silly('starting writeStream with params', params)
    const result = await this.s3.upload(params).promise()
    logger.silly('upload result', result)
    return result
  }

  async putFile (src, file) {
    const stream = fs.createReadStream(file)
    return await this.writeStream(file, stream)
  }

  async getFile (file, dest) {
    const writeStream = fs.createWriteStream(dest)
    const readStream = await this.createReadStream(file)

    return new Promise((resolve, reject) => {
      readStream.on('error', (error) => reject(error))
      readStream.on('end', resolve)

      readStream.pipe(writeStream)
    })
  }

  async unlink (file) {
    const result = await this.s3.deleteObject(this._params(file)).promise()
    logger.debug(`unlinking result for file ${file}`, result)
  }

  async indexFile (file) {
    const stat = await this.s3.headObject(this._params(file)).promise()
    logger.debug(`indexing file ${file}: `, stat)
    return await indexFile(file, { size: stat.ContentLength, mtime: stat.LastModified }, this.id)
  }

  async index (options) {
    logger.info(`indexing ${this.id}`)
    const params = { Bucket: this.bucket, MaxKeys: 1000 }

    while (true) {
      const result = await this.s3.listObjectsV2(params).promise()
      let last

      for (const file of result.Contents) {
        last = await indexFile(file.Key, { size: file.Size, mtime: file.LastModified }, this.id)
      }

      if (!await options.tick(last)) {
        return false
      }

      if (result.IsTruncated) {
        params.ContinuationToken = result.NextContinuationToken
      } else {
        break
      }
    }
    return true
  }
}

module.exports = S3Backend
