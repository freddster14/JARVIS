import { Router } from 'express';
import { body } from 'express-validator';
import { confirmWake, getWakeLog, getProfile, updateProfile } from '../controllers/wakeController.js';
import { handleValidation } from '../middleware/validate.js';

const router = Router();

const timeRegex = /^\d{2}:\d{2}$/;

router.post(
  '/confirm',
  body('time').optional().matches(timeRegex).withMessage('time must be HH:MM format'),
  handleValidation,
  confirmWake,
);

router.get('/log', getWakeLog);
router.get('/profile', getProfile);

router.patch(
  '/profile',
  body('wakeUpMode')
    .optional()
    .isIn(['fixed', 'dynamic']).withMessage('wakeUpMode must be fixed or dynamic'),
  body('fixedWakeTime')
    .optional({ nullable: true })
    .matches(timeRegex).withMessage('fixedWakeTime must be HH:MM format'),
  body('morningPingTime')
    .optional({ nullable: true })
    .matches(timeRegex).withMessage('morningPingTime must be HH:MM format'),
  body('fallbackWakeTime')
    .optional({ nullable: true })
    .matches(timeRegex).withMessage('fallbackWakeTime must be HH:MM format'),
  handleValidation,
  updateProfile,
);

export default router;
