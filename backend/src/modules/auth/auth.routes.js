const { Router } = require('express');
const validate = require('../../middlewares/validate.middleware');
const { authenticate } = require('../../middlewares/auth.middleware');
const authRateLimit = require('../../middlewares/authRateLimit.middleware');
const authController = require('./auth.controller');
const {
  signinSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} = require('./auth.validation');

const router = Router();

router.post(
  '/signin',
  authRateLimit,
  validate(signinSchema),
  authController.signin,
);

router.post(
  '/forgot-password',
  authRateLimit,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);

router.post(
  '/reset-password',
  authRateLimit,
  validate(resetPasswordSchema),
  authController.resetPassword,
);

router.post('/signout', authController.signout);
router.get('/me', authenticate, authController.me);
router.patch('/preferences', authenticate, authController.updatePreferences);
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  authController.changePassword,
);

module.exports = router;
