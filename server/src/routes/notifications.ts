import { Router } from 'express';
import { body } from 'express-validator';
import { getVapidKey, subscribe, unsubscribe } from '../controllers/notificationsController.js';
import { handleValidation } from '../middleware/validate.js';

const router = Router();

router.get('/vapid-key', getVapidKey);

router.post(
  '/subscribe',
  body('endpoint').isURL().withMessage('endpoint must be a valid URL'),
  body('keys.p256dh').notEmpty().withMessage('keys.p256dh is required'),
  body('keys.auth').notEmpty().withMessage('keys.auth is required'),
  handleValidation,
  subscribe,
);

router.delete(
  '/subscribe',
  body('endpoint').isURL().withMessage('endpoint must be a valid URL'),
  handleValidation,
  unsubscribe,
);

export default router;
