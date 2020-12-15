(async () => {
  const logger = require('./logger')
  logger.info('startup')
  const Connection = require('./connection')
  const db = await Connection.connectToMongo()

  const config = require('./config')

  const cleanupAndInitialize = async () => {
    // sync backend config with db, removing no loger preset backends and files
    logger.info('syncing database with config')
    const ids = config.backends.map((b) => b.id)
    const backends = db.collection('backends')
    for (const backendConfig of config.backends) {
      const backend = await backends.findOne({ _id: backendConfig.id })
      if (backend) {
        logger.info('backend allready known', backendConfig)
        await backends.updateOne({ _id: backendConfig.id }, { $set: { backendType: backendConfig.backend, url: backendConfig.path } })
      } else {
        logger.info('found new backend', backendConfig)
        await backends.insertOne({ _id: backendConfig.id, backendType: backendConfig.backend, url: backendConfig.path })
      }
    }
    await backends.deleteMany({ _id: { $nin: ids } })
    logger.info('deleted backends no longer present')

    // sync files with updated backends
    const files = db.collection('files')
    await files.updateMany({ }, { $pull: { backends: { $nin: ids } } })
    logger.info('upated files containing invalid backends')
    await files.deleteMany({ backends: { $size: 0 } })
    logger.info('removed files no loger present in any backends')

    // cancel non resumeable jobs
    const result = await db.collection('jobs').updateMany({ state: { $in: ['running', 'stoping', 'pausing', 'paused', 'resuming'] } }, { $set: { state: 'failedrestart' } })
    logger.info('set previouly running jobs to failedrestart', result)
  }

  await cleanupAndInitialize()

  const Server = require('./http/server')
  require('./http/socket')
  Server.run()

  const Worker = require('./worker')
  Worker.run()
})()
