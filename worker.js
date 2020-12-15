const logger = require('./logger')
const { db } = require('./connection')
const Storage = require('./storage')

const { move, copy, copyFileToBackend, deleteFileFromBackend } = require('./jobs')

const jobs = db.collection('jobs')

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

class JobRunner {
  constructor (job, storage) {
    this.job = job
    this.shouldStop = false
    this.isStopped = false
  }

  async _reloadJob () {
    this.job = await jobs.findOne({ _id: this.job._id })
  }

  async _updateJob (update) {
    await jobs.updateOne({ _id: this.job._id }, { $set: { updatedAt: new Date(), ...update } })
  }

  async _pause () {
    const changeStream = jobs.watch([{ $match: { 'documentKey._id': this.job._id } }], { fullDocument: 'updateLookup' })

    await new Promise((resolve) => {
      changeStream.on('change', (doc) => {
        if (doc.fullDocument.state === 'resuming') {
          resolve()
        }
      })
    })

    await changeStream.close()
  }

  onTick = async (file) => {
    logger.silly(`tick: ${file._id}`)
    await this._updateJob({ ticks: [{ at: Date.now(), file }] })

    await delay(5)
    this._reloadJob()

    if (this.job.state === 'pausing') {
      await this._updateJob({ state: 'paused' })
      await this._pause()
      await this._updateJob({ state: 'running' })
      await this._reloadJob()
      return true
    }

    if (this.job.state === 'stoping') {
      return false
    } else {
      return true
    }
  }

  async start () {
    logger.debug('starting job', this)
    await this._updateJob({ state: 'running' })
    await this._reloadJob()

    try {
      let backend, result
      switch (this.job.jobType) {
        case 'index':
          backend = Storage.getBackend(this.job.src)
          if (!backend) {
            logger.debug('could not find backend for job')
          }
          result = await backend.index({ tick: this.onTick })
          break
        case 'copy':
          result = await copy(this.job, { tick: this.onTick })
          break
        case 'move':
          result = await move(this.job, { tick: this.onTick })
          break
        case 'copyFileToBackend':
          result = await copyFileToBackend(this.job)
          break
        case 'deleteFileFromBackend':
          result = await deleteFileFromBackend(this.job)
          break
        default:
          throw new Error(`jobType ${this.job.jobType} unknown`)
      }
      await this._updateJob({ state: result ? 'completed' : 'stopped' })
      this.isStopped = true
    } catch (error) {
      logger.error(`job error in ${this.job.jobType}`, error)
      this.isStopped = true
      return await this._updateJob({ state: 'failed' })
    }
  }
}

class Worker {
  constructor () {
    this.runners = []
    this.maxRunners = 3
  }

  onJobsChanged = async () => {
    logger.debug('jobs changed')

    for (const runner of this.runners) {
      if (runner.isStopped) {
        logger.debug('removing stopped runner from runner pool', runner)
        this.runners.splice(this.runners.indexOf(runner), 1)
      }
    }

    if (this.runners.length < this.maxRunners) {
      logger.debug('looking for queued jobs')
      const job = await (await jobs.find({ state: 'queued' }).sort({ createdAt: 1 }).limit(1)).next()
      if (job) {
        logger.info('got job to run', job)
        const runner = new JobRunner(job, this.storage)
        runner.start()
        this.runners.push(runner)
      }
    }
  }

  run () {
    logger.info('starting worker')
    // watching for changes on state and inserts
    const changeStream = db.collection('jobs').watch([{
      $match: {
        $or: [
          { operationType: 'insert' },
          {
            $and: [
              { operationType: 'update' },
              { 'updateDescription.updatedFields.state': { $exists: true } }
            ]
          }
        ]
      }
    }])
    changeStream.on('change', this.onJobsChanged)

    this.onJobsChanged()
  }
}

const worker = new Worker()

module.exports = worker
