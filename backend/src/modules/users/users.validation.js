const Joi = require('joi');

const objectId = Joi.string().hex().length(24);

const inviteUserSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    email: Joi.string().trim().email().required(),
    role: Joi.string().valid('admin', 'manager').required(),
    locationIds: Joi.array().items(objectId).default([]),
  }).custom((value, helpers) => {
    if (value.role === 'manager' && (!value.locationIds || value.locationIds.length === 0)) {
      return helpers.message('Managers must be assigned at least one location');
    }
    if (value.role === 'admin') {
      return { ...value, locationIds: [] };
    }
    return value;
  }),
};

const updateUserSchema = {
  params: Joi.object({
    id: objectId.required(),
  }),
  body: Joi.object({
    name: Joi.string().trim().min(2).max(80),
    role: Joi.string().valid('admin', 'manager'),
    locationIds: Joi.array().items(objectId),
    isActive: Joi.boolean(),
    notificationPreferences: Joi.object({
      email: Joi.boolean(),
      inApp: Joi.boolean(),
      alerts: Joi.boolean(),
      brief: Joi.boolean(),
    }).min(1),
  }).min(1),
};

module.exports = {
  inviteUserSchema,
  updateUserSchema,
};
