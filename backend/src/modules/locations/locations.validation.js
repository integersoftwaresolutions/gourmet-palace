const Joi = require('joi');

const createLocationSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(120).required(),
    address: Joi.string().trim().allow('').max(240).default(''),
    timezone: Joi.string().trim().max(80).default('America/Los_Angeles'),
    status: Joi.string().valid('active', 'inactive').default('active'),
  }),
};

const updateLocationSchema = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }),
  body: Joi.object({
    name: Joi.string().trim().min(2).max(120),
    address: Joi.string().trim().allow('').max(240),
    timezone: Joi.string().trim().max(80),
    status: Joi.string().valid('active', 'inactive'),
  }).min(1),
};

const locationIdParams = {
  params: Joi.object({
    id: Joi.string().hex().length(24).required(),
  }),
};

module.exports = {
  createLocationSchema,
  updateLocationSchema,
  locationIdParams,
};
