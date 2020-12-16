const express = require('express')
const asyncHandler = require('express-async-handler')
const http = require('http')
const mime = require('mime-types')
const config = require('../config')
const logger = require('../logger')
const Storage = require('../storage')
const { MethodNotAllowedError } = require('../errors')
const { streamEnd } = require('../backend/shared')

/*
  Api is quite simple:
  GET, POST, DELETE /filepath
  POST is no Multipart / Formdata, just blob in body, just like GET
*/

const api = async (req, res, next) => {
  logger.silly(`request ${req.method} ${req.url}`)
  const file = decodeURIComponent(req.url.substr(1))

  if (!file) {
    return next()
  }

  let stream
  let fileInfo
  let streamError = false
  switch (req.method) {
    case 'GET':
      stream = await Storage.createReadStream(file)
      stream.on('error', (err) => {
        logger.error('readStream error', err)
        streamError = true
        res.status(404).end('Not found')
      })
      fileInfo = await Storage.getFileInfo(file)

      if (!streamError) {
        res.set({
          'Content-Type': mime.lookup(file),
          'Content-Length': fileInfo.size
        })
        stream.pipe(res)
      }

      break
    case 'POST': {
      try {
        await Storage.writeStream(file, req)
        res.status(200).end('ok')
      } catch (err) {
        logger.error('error writingStream', err)
        try {
          await Storage.unlink(file)
        } catch {
          logger.error('error unlinking', err)
        }

        res.status(400).end('aborted')
      }
      break
    }
    case 'DELETE':
      await Storage.unlink(file)
      res.status(200).end('ok')
      break
    default:
      throw new MethodNotAllowedError(req.method)
  }
}

class Server {
  constructor () {
    // express setup
    this.app = express()

    // http setup
    this.http = http.createServer(this.app)

    // long timeout for long uploads
    this.http.setTimeout(24 * 3600 * 1000)

    // health (public available without auth)
    this.app.get('/health', (req, res) => {
      res.end('good')
    })

    // check for auth
    this.app.use((req, res, next) => {
      if (config.authKeys.includes(req.header('x-api-key'))) {
        next()
      } else {
        res.status(401).end('Unauthorized')
      }
    })
    // serve admin frontend
    this.app.use('/admin', express.static('dist'))

    // serve api
    this.app.use(asyncHandler(api))

    // error reporting
    this.app.use(function (err, req, res, next) {
      console.error(err)
      logger.error(`${err.name} in route ${req.method} ${req.url}`)
      res.status(err.status || 500).end(err.message || 'error')
    })
  }

  run () {
    logger.info('starting http server')
    this.http.listen(config.port || 3000)
  }
}

const server = new Server()

module.exports = server
