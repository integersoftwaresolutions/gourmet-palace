const { Router } = require('express');
const validate = require('../../middlewares/validate.middleware');
const { authenticate, requireAdmin } = require('../../middlewares/auth.middleware');
const locationsController = require('./locations.controller');
const {
  createLocationSchema,
  updateLocationSchema,
} = require('./locations.validation');

const router = Router();

router.use(authenticate);

// Authenticated users can list locations (scoped later for managers in UI).
router.get('/', locationsController.list);

router.post(
  '/',
  requireAdmin,
  validate(createLocationSchema),
  locationsController.create,
);

router.patch(
  '/:id',
  requireAdmin,
  validate(updateLocationSchema),
  locationsController.update,
);

module.exports = router;
