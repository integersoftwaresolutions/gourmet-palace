const ApiResponse = require('../../utils/ApiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { getClientIp, getUserAgent } = require('../../utils/requestMeta');
const authService = require('./auth.service');

function reqMeta(req) {
  return {
    correlationId: req.correlationId,
    ip: getClientIp(req),
    userAgent: getUserAgent(req),
  };
}

function establishSession(req, user) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = user.id;
      req.session.organizationId = user.organizationId?.toString() || null;
      req.session.role = user.role;
      req.session.sessionVersion = Number(user.sessionVersion || 0);
      req.session.save((saveErr) => {
        if (saveErr) return reject(saveErr);
        resolve();
      });
    });
  });
}

function saveSession(req) {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(err) : resolve()));
  });
}

function destroySession(req) {
  return new Promise((resolve, reject) => {
    if (!req.session) return resolve();
    req.session.destroy((err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

const register = asyncHandler(async (req, res) => {
  const data = await authService.register(req.body, reqMeta(req));
  return ApiResponse.send(res, {
    statusCode: 201,
    message: 'Account created. Check your email to verify your address.',
    data,
  });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const data = await authService.verifyEmail(req.body, reqMeta(req));
  return ApiResponse.send(res, {
    message: 'Email verified successfully. You can now sign in.',
    data,
  });
});

const resendVerification = asyncHandler(async (req, res) => {
  const data = await authService.resendVerification(req.body, reqMeta(req));
  return ApiResponse.send(res, {
    message: authService.RESEND_VERIFICATION_SUCCESS,
    data,
  });
});

const signin = asyncHandler(async (req, res) => {
  const user = await authService.authenticateCredentials(req.body, reqMeta(req));
  await establishSession(req, user);
  const json = user.toJSON();
  return ApiResponse.send(res, {
    message: 'Signed in successfully',
    data: {
      user: json,
      next: json.onboardingComplete ? '/' : '/onboarding',
    },
  });
});

const signout = asyncHandler(async (req, res) => {
  const env = require('../../config/env');
  let user = null;
  if (req.session?.userId) {
    try {
      const User = require('../../models/User');
      user = await User.findById(req.session.userId);
    } catch {
      user = null;
    }
  }
  await authService.recordSignout(user, reqMeta(req));
  await destroySession(req);
  res.clearCookie(env.sessionName, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: env.sessionSecure || env.nodeEnv === 'production',
  });
  return ApiResponse.send(res, {
    message: 'Signed out successfully',
    data: { signedOut: true },
  });
});

const me = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user.id);
  const permissions = req.auth.onboardingComplete
    ? {
        role: req.auth.role,
        isAdmin: req.auth.isAdmin,
        canFinance: req.auth.canFinance,
        allLocations: req.auth.allLocations,
        locationIds: req.auth.locationIds,
      }
    : null;

  return ApiResponse.send(res, {
    message: 'Current user',
    data: { user, permissions },
  });
});

const completeOnboarding = asyncHandler(async (req, res) => {
  const data = await authService.completeOnboarding(req.user.id, req.body, reqMeta(req));
  req.session.organizationId = data.user.organizationId;
  req.session.role = data.user.role;
  await saveSession(req);
  return ApiResponse.send(res, {
    message: 'Organization and first location created successfully.',
    data,
  });
});

const changePassword = asyncHandler(async (req, res) => {
  const data = await authService.changePassword(req.user.id, req.body, reqMeta(req));
  req.session.sessionVersion = data.sessionVersion;
  await saveSession(req);
  return ApiResponse.send(res, {
    message: 'Password changed successfully. Other sessions have been signed out.',
    data: { changed: true },
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const data = await authService.forgotPassword(req.body, reqMeta(req));
  return ApiResponse.send(res, {
    message: authService.FORGOT_SUCCESS,
    data,
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const data = await authService.resetPassword(req.body, reqMeta(req));
  return ApiResponse.send(res, {
    message: 'Password reset successfully. You can sign in with your new password.',
    data,
  });
});

const updatePreferences = asyncHandler(async (req, res) => {
  const user = await authService.updatePreferences(req.user.id, req.body, reqMeta(req));
  return ApiResponse.send(res, {
    message: 'Notification preferences updated',
    data: { user },
  });
});

module.exports = {
  register,
  verifyEmail,
  resendVerification,
  signin,
  signout,
  me,
  completeOnboarding,
  changePassword,
  forgotPassword,
  resetPassword,
  updatePreferences,
};
