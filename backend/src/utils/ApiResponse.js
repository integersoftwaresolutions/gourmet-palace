/**
 * Consistent success envelope for every API response.
 */
class ApiResponse {
  /**
   * @param {import('express').Response} res
   * @param {object} options
   * @param {number} [options.statusCode]
   * @param {string} [options.message]
   * @param {*} [options.data]
   * @param {object|null} [options.meta]
   */
  static send(res, { statusCode = 200, message = 'Success', data = null, meta = null } = {}) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      meta,
      errors: null,
    });
  }
}

module.exports = ApiResponse;
