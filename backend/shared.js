const { db } = require('../connection')
const logger = require('../logger')
const eos = require('end-of-stream')

const files = db.collection('files')

const indexFile = async (path, { size, mtime }, backend) => {
  const dbFile = await files.findOne({ _id: path })
  if (dbFile) {
    logger.debug('updating allready known index')

    const backends = dbFile.backends
    if (backends.indexOf(backend) === -1) {
      backends.push(backend)
    }

    const update = {
      updatedAt: new Date(),
      backends
    }

    await files.updateOne({ _id: path }, { $set: update })

    return { ...dbFile, ...update }
  } else {
    logger.debug('creating new entry')
    const folders = path.split('/')
    const insert = {
      _id: path,
      backends: [backend],
      directory: folders.length > 1 ? folders.slice(0, -1).join('/') : undefined,
      name: folders.pop(),
      size: size,
      mtime: new Date(mtime),
      createdAt: new Date(),
      updatedAt: new Date()
    }

    await files.insertOne(insert)
    return insert
  }
}

const streamEnd = (stream) => new Promise((resolve, reject) => {
  eos(stream, (err) => {
    if (err) {
      reject(err)
    } else {
      resolve()
    }
  })
})

module.exports = {
  indexFile,
  streamEnd
}
