const ApiError = require('../utils/ApiError');

/**
 * Validate request parts with Joi schemas.
 * @param {{ body?: import('joi').Schema, query?: import('joi').Schema, params?: import('joi').Schema }} schemas
 */
function validate(schemas) {
  return (req, res, next) => {
    const collected = [];

    for (const key of ['body', 'query', 'params']) {
      const schema = schemas[key];
      if (!schema) continue;

      const { error, value } = schema.validate(req[key], {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        for (const detail of error.details) {
          collected.push({
            field: detail.path.join('.') || key,
            message: detail.message.replace(/"/g, ''),
          });
        }
      } else {
        req[key] = value;
      }
    }

    if (collected.length) {
      return next(new ApiError(422, 'Validation failed', collected));
    }

    return next();
  };
}

module.exports = validate;
