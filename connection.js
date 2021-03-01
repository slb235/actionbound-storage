const { MongoClient } = require('mongodb')
const config = require('./config')

class Connection {
  static async connectToMongo () {
    if (this.db) {
      return this.db
    }
    console.log(`connecting to ${this.url}`)
    this.db = await (await MongoClient.connect(this.url, this.options)).db()
    return this.db
  }
}

Connection.db = null
Connection.url = config.mongo
Connection.options = {
  bufferMaxEntries: 0,
  useNewUrlParser: true,
  useUnifiedTopology: true
}

module.exports = Connection
