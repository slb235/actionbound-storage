const logger = require('./logger')
const { db } = require('./connection')
const Storage = require('./storage')

const files = db.collection('files')

const copyFileToBackend = async ({ file, backend }) => {
  logger.info(`starting copyFileToBackend job for ${file} to ${backend}`)
  const stream = await Storage.createReadStream(file)
  await Storage.getBackend(backend).writeStream(file, stream)
  await Storage.getBackend(backend).indexFile(file)
  logger.info(`finished copyFileToBackend job for ${file} to ${backend}`)
  return true
}

const deleteFileFromBackend = async ({ file, backend }) => {
  logger.info(`starting copyFileToBackend job for ${file} to ${backend}`)
  await Storage.getBackend(backend).unlink(file)
  await files.updateOne({ _id: file }, { $pull: { backends: backend } })
  return true
}

const copy = async (job, { tick }) => {
  const { src, dst } = job
  const query = { $and: [{ backends: src }, { backends: { $ne: dst } }] }
  let progress = 0
  logger.info(`starting copy job from ${src} to ${dst}`)
  let stopped = false

  const copyNextFile = async () => {
    const total = await files.countDocuments(query)
    logger.silly(`copy job found ${total} files to copy`)
    if (total === 0) {
      return
    }
    const file = await files.findOne(query)
    logger.silly('copy nextfile', file)
    const stream = await Storage.getBackend(src).createReadStream(file._id)
    await Storage.getBackend(dst).writeStream(file._id, stream)
    await Storage.getBackend(dst).indexFile(file._id)
    progress++
    logger.silly(`copy progress: ${progress}/${total}`)
    stopped = !await tick(file)
    if (!stopped) {
      await copyNextFile()
    }
  }

  await copyNextFile()
  return !stopped
}

const move = async (job, { tick }) => {
  const { src, dst } = job
  const query = { $and: [{ backends: src }, { backends: { $ne: dst } }] }
  let progress = 0
  logger.info(`starting copy job from ${src} to ${dst}`)
  let stopped = false

  const moveNextFile = async () => {
    const todo = await files.countDocuments(query)
    logger.silly(`copy job found ${todo} files to copy`)
    if (todo === 0) {
      return
    }
    const file = await files.findOne(query)
    logger.silly('copy nextfile', file)
    const stream = await Storage.getBackend(src).createReadStream(file._id)
    await Storage.getBackend(dst).writeStream(file._id, stream)
    await Storage.getBackend(dst).indexFile(file._id)
    await Storage.getBackend(src).unlink(file._id)
    await files.updateOne({ _id: file._id }, { $pull: { backends: src } })
    progress++
    logger.silly(`copy progress: ${progress}/${todo + progress}`)
    stopped = !await tick(file)
    if (!stopped) {
      await moveNextFile()
    }
  }

  await moveNextFile()
  return !stopped
}

module.exports = {
  copyFileToBackend,
  deleteFileFromBackend,
  copy,
  move
}
