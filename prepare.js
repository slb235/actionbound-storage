
(async () => {
  const Connection = require('./connection')
  const db = await Connection.connectToMongo()

  await db.dropCollection('backends')
  await db.dropCollection('files')
  await db.dropCollection('jobs')

  await db.createCollection('backends')
  await db.createCollection('files')
  await db.createCollection('jobs')

  console.log('created collections')

  const files = db.collection('files')

  await files.createIndex({ name: 1 })
  await files.createIndex({ directory: 1 })
  await files.createIndex({ size: 1 })
  await files.createIndex({ mtime: 1 })
  await files.createIndex({ backends: 1 })

  console.log('created indexes')
  process.exit(0)
})()
