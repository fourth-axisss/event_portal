// An expected, user-facing error: the error handler replies with this status and message
class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

module.exports = HttpError;