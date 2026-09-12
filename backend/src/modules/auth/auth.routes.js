const { Router } = require('express');
const validate = require('../../middlewares/validate.middleware');
const { authenticate, authenticateSession } = require('../../middlewares/auth.middleware');
const authRateLimit = require('../../middlewares/authRateLimit.middleware');
const authController = require('./auth.controller');
const {
  registerSchema,
  signinSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  onboardingSchema,
} = require('./auth.validation');

const router = Router();

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('Pragma', 'no-cache');
  next();
});

router.post('/register', authRateLimit, validate(registerSchema), authController.register);
router.post('/verify-email', authRateLimit, validate(verifyEmailSchema), authController.verifyEmail);
router.post(
  '/resend-verification',
  authRateLimit,
  validate(resendVerificationSchema),
  authController.resendVerification,
);
router.post('/signin', authRateLimit, validate(signinSchema), authController.signin);
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
router.get('/me', authenticateSession, authController.me);
router.post(
  '/onboarding',
  authenticateSession,
  validate(onboardingSchema),
  authController.completeOnboarding,
);
router.post(
  '/change-password',
  authenticateSession,
  validate(changePasswordSchema),
  authController.changePassword,
);
router.patch('/preferences', authenticate, authController.updatePreferences);

module.exports = router;
