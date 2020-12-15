
const { http } = require('./server')
const io = require('socket.io')(http)
const { ObjectId } = require('mongodb')
const logger = require('../logger')
const { db } = require('../connection')
const Storage = require('../storage')
const _ = require('lodash')

const jobs = db.collection('jobs')
const backends = db.collection('backends')
const files = db.collection('files')

const loadJobs = async () => await (await jobs.find().sort({ createdAt: -1 }).toArray())
const loadBackends = async () => await (await backends.find().sort({ _id: -1 }).toArray())
const loadFiles = async (params) => {
  logger.silly('websock file request', params)
  const docs = await (
    await files
      .find(params.filter || {})
      .sort(params.sort || { _id: -1 })
      .limit(params.pageSize || 10)
      .skip(((params.current > 0 ? params.current : 1) - 1) * (params.pageSize || 10))
  ).toArray()

  const total = await files.countDocuments(params.filter || {})
  return {
    total,
    docs
  }
}

class Socket {
  constructor () {
    io.on('connection', (socket) => {
      logger.debug('incomming  socket connection')
      let fileParams = {}
      let fileChangeStream = null
      let fileChangesWatched = false

      const updateFiles = _.throttle(async () => {
        socket.emit('result', 'files', await loadFiles(fileParams))
      }, 500)

      const startFileWatching = () => {
        fileChangeStream = files.watch([{ $match: fileParams.filter || { } }])
        fileChangeStream.on('change', async () => {
          updateFiles()
        })
      }

      const stopFileWatching = async () => {
        if (fileChangeStream) {
          await fileChangeStream.close()
          fileChangeStream = null
        }
      }

      socket.on('get', async (topic, params = {}) => {
        switch (topic) {
          case 'jobs':
            logger.silly('sending jobs as requested')
            socket.emit('result', topic, await loadJobs())
            break
          case 'backends':
            socket.emit('result', topic, await loadBackends())
            break
          case 'files':
            fileParams = params
            if (fileChangesWatched) {
              await stopFileWatching()
              startFileWatching()
            }
            await updateFiles()
            break
        }
      })

      socket.on('create', async (topic, job) => {
        switch (topic) {
          case 'jobs':
            await jobs.insertOne({
              state: 'queued',
              createdAt: new Date(),
              updatedAt: new Date(),
              ...job
            })
            break
        }
      })

      socket.on('remove', async (topic, subject) => {
        switch (topic) {
          case 'jobs':
            await jobs.deleteOne({ _id: ObjectId(subject) })
            break
          case 'files':
            await Storage.unlink(subject)
            break
        }
      })

      socket.on('update', async (topic, job, data) => {
        switch (topic) {
          case 'jobs':
            await jobs.updateOne({ _id: ObjectId(job) }, { $set: { updatedAt: new Date(), ...data } })
            break
        }
      })

      socket.on('sub', (topic) => {
        if (topic === 'files') {
          fileChangesWatched = true
          startFileWatching()
        } else {
          socket.join(topic)
        }
      })

      socket.on('unsub', (topic) => {
        if (topic === 'files') {
          fileChangesWatched = false
          stopFileWatching()
        } else {
          socket.leave(topic)
        }
      })

      socket.on('disconnect', () => {
        stopFileWatching()
      })
    })

    const changeStream = jobs.watch()

    const updateJobs = async () => {
      logger.silly('sending jobs as changed')
      io.to('jobs').emit('result', 'jobs', await loadJobs())
    }

    changeStream.on('change', _.throttle(updateJobs, 150))
  }
}

const socket = new Socket()

module.exports = socket
