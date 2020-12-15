const winston = require('winston')
const config = require('./config')

const logger = winston.createLogger({
  level: config.logLevel || 'silly',
  transports: [
    new winston.transports.Console({ format: winston.format.simple() })
  ]
})

module.exports = logger
