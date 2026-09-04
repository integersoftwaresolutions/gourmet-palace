const { Router } = require('express');
const validate = require('../../middlewares/validate.middleware');
const { authenticate, requireAdmin } = require('../../middlewares/auth.middleware');
const usersController = require('./users.controller');
const { inviteUserSchema, updateUserSchema } = require('./users.validation');

const router = Router();

router.use(authenticate, requireAdmin);

router.get('/', usersController.list);
router.post('/invite', validate(inviteUserSchema), usersController.invite);
router.patch('/:id', validate(updateUserSchema), usersController.update);

module.exports = router;
