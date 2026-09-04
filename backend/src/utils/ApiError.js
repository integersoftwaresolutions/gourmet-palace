class ApiError extends Error {
  /**
   * @param {number} statusCode
   * @param {string} message
   * @param {Array|{[key: string]: string}|null} [errors]
   * @param {boolean} [isOperational]
   */
  constructor(statusCode, message, errors = null, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;
    this.success = false;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
