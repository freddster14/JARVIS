import { Router } from 'express';
import { query } from 'express-validator';
import { getWeekProgress, getHistory, getToday } from '../controllers/statsController.js';
import { handleValidation } from '../middleware/validate.js';

const router = Router();

router.get('/today', getToday);

router.get(
  '/week',
  query('weekStart')
    .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('weekStart must be yyyy-MM-dd'),
  handleValidation,
  getWeekProgress,
);

router.get(
  '/history',
  query('weeks')
    .optional()
    .isInt({ min: 1, max: 52 }).withMessage('weeks must be between 1 and 52'),
  handleValidation,
  getHistory,
);

export default router;
