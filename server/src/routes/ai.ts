import { Router } from 'express';
import { body } from 'express-validator';
import { generateSchedule, weeklyReview } from '../controllers/aiController.js';
import { handleValidation } from '../middleware/validate.js';

const router = Router();

const optionalWeekStart = [
  body('weekStart')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('weekStart must be yyyy-MM-dd'),
  handleValidation,
];

const generateScheduleBody = [
  body('weekStart')
    .optional()
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('weekStart must be yyyy-MM-dd'),
  body('force').optional().isBoolean().withMessage('force must be a boolean'),
  handleValidation,
];

router.post('/generate-schedule', generateScheduleBody, generateSchedule);
router.post('/weekly-review', optionalWeekStart, weeklyReview);

export default router;
