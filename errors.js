
class FileNotFoundError extends Error {
  constructor (file) {
    super(`${file} not found.`)
    this.name = 'FileNotFoundError'
    this.status = 404
  }
}

class MethodNotAllowedError extends Error {
  constructor (method) {
    super(`${method} not allowed.`)
    this.name = 'MethodNotAllowedError'
    this.status = 405
  }
}

class AbortedError extends Error {
  constructor (message) {
    super(message)
    this.name = 'AbortedError'
  }
}
module.exports = {
  AbortedError,
  FileNotFoundError,
  MethodNotAllowedError
}
