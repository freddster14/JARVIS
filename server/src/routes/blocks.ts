import { Router } from 'express';
import { body } from 'express-validator';
import {
  getBlocks,
  createBlock,
  updateBlock,
  deleteBlock,
  skipBlockDate,
  unskipBlockDate,
} from '../controllers/blocksController.js';
import { handleValidation } from '../middleware/validate.js';

const router = Router();

const timeField = (field: string) =>
  body(field)
    .matches(/^\d{2}:\d{2}$/).withMessage(`${field} must be HH:MM format`);

const blockBody = [
  body('name')
    .trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must be 100 characters or fewer'),
  body('dayOfWeek')
    .isInt({ min: 0, max: 6 }).withMessage('dayOfWeek must be 0 (Sun) – 6 (Sat)'),
  timeField('startTime'),
  timeField('endTime'),
  body('endTime').custom((endTime, { req }) => {
    const start = req.body.startTime as string | undefined;
    if (start && endTime <= start) throw new Error('endTime must be after startTime');
    return true;
  }),
  body('recurring').optional().isBoolean().withMessage('recurring must be a boolean'),
];

const blockBodyPartial = [
  body('name')
    .optional()
    .trim().notEmpty().withMessage('Name cannot be empty')
    .isLength({ max: 100 }).withMessage('Name must be 100 characters or fewer'),
  body('dayOfWeek')
    .optional()
    .isInt({ min: 0, max: 6 }).withMessage('dayOfWeek must be 0 (Sun) – 6 (Sat)'),
  body('startTime').optional().matches(/^\d{2}:\d{2}$/).withMessage('startTime must be HH:MM format'),
  body('endTime').optional().matches(/^\d{2}:\d{2}$/).withMessage('endTime must be HH:MM format'),
  body('endTime').optional().custom((endTime, { req }) => {
    const start = req.body.startTime as string | undefined;
    if (start && endTime && endTime <= start) throw new Error('endTime must be after startTime');
    return true;
  }),
  body('recurring').optional().isBoolean().withMessage('recurring must be a boolean'),
];

const dateField = body('date')
  .matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('date must be YYYY-MM-DD');

router.get('/', getBlocks);
router.post('/', blockBody, handleValidation, createBlock);
router.patch('/:id', blockBodyPartial, handleValidation, updateBlock);
router.delete('/:id', deleteBlock);
router.post('/:id/skip', dateField, handleValidation, skipBlockDate);
router.delete('/:id/skip', dateField, handleValidation, unskipBlockDate);

export default router;
