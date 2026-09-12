const Joi = require('joi');

const passwordRule = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)
  .messages({
    'string.pattern.base': 'Password must contain at least one letter and one number',
  });

const registerSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(2).max(80).required(),
    email: Joi.string().trim().email().required(),
    password: passwordRule.required(),
  }),
};

const signinSchema = {
  body: Joi.object({
    email: Joi.string().trim().email().required(),
    password: Joi.string().required(),
  }),
};

const verifyEmailSchema = {
  body: Joi.object({
    token: Joi.string().trim().min(32).max(256).required(),
  }),
};

const resendVerificationSchema = {
  body: Joi.object({
    email: Joi.string().trim().email().required(),
  }),
};

const forgotPasswordSchema = {
  body: Joi.object({
    email: Joi.string().trim().email().required(),
  }),
};

const resetPasswordSchema = {
  body: Joi.object({
    token: Joi.string().trim().min(32).required(),
    newPassword: passwordRule.required(),
  }),
};

const changePasswordSchema = {
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: passwordRule.required().invalid(Joi.ref('currentPassword')).messages({
      'any.invalid': 'New password must be different from current password',
    }),
  }),
};

const onboardingSchema = {
  body: Joi.object({
    organizationName: Joi.string().trim().min(2).max(120).required(),
    locationName: Joi.string().trim().min(2).max(120).required(),
    locationAddress: Joi.string().trim().min(3).max(240).required(),
    timezone: Joi.string().trim().min(1).max(80).required(),
  }),
};

module.exports = {
  passwordRule,
  registerSchema,
  signinSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  onboardingSchema,
};
