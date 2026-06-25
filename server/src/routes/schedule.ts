import { Router } from 'express';
import { body, query } from 'express-validator';
import {
  getSchedule,
  updateItemStatus,
  rescheduleItem,
  clearWeek,
} from '../controllers/scheduleController.js';
import { handleValidation } from '../middleware/validate.js';

const router = Router();

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^\d{2}:\d{2}$/;

router.get(
  '/',
  query('weekStart').matches(dateRegex).withMessage('weekStart must be yyyy-MM-dd'),
  handleValidation,
  getSchedule,
);

router.patch(
  '/:id/status',
  body('status')
    .isIn(['pending', 'done', 'skipped', 'rescheduled'])
    .withMessage('status must be one of: pending, done, skipped, rescheduled'),
  handleValidation,
  updateItemStatus,
);

router.patch(
  '/:id/reschedule',
  body('date').matches(dateRegex).withMessage('date must be yyyy-MM-dd'),
  body('startTime').matches(timeRegex).withMessage('startTime must be HH:MM'),
  body('endTime').matches(timeRegex).withMessage('endTime must be HH:MM'),
  body('endTime').custom((endTime, { req }) => {
    if (endTime <= (req.body.startTime as string)) throw new Error('endTime must be after startTime');
    return true;
  }),
  handleValidation,
  rescheduleItem,
);

router.delete(
  '/week',
  body('weekStart').matches(dateRegex).withMessage('weekStart must be yyyy-MM-dd'),
  body('force').optional().isBoolean().withMessage('force must be a boolean'),
  handleValidation,
  clearWeek,
);

export default router;
