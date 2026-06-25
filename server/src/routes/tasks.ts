import { Router } from 'express';
import { body } from 'express-validator';
import { getTasks, createTask, updateTask, deleteTask } from '../controllers/tasksController.js';
import { handleValidation } from '../middleware/validate.js';

const router = Router();

const taskBody = [
  body('name')
    .trim().notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must be 100 characters or fewer'),
  body('durationMin')
    .isInt({ min: 5, max: 480 }).withMessage('Duration must be between 5 and 480 minutes'),
  body('priority')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Priority must be between 1 and 5'),
  body('weeklyGoal')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Weekly goal must be between 1 and 100'),
  body('category')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 50 }).withMessage('Category must be 50 characters or fewer'),
];

const taskBodyPartial = [
  body('name')
    .optional()
    .trim().notEmpty().withMessage('Name cannot be empty')
    .isLength({ max: 100 }).withMessage('Name must be 100 characters or fewer'),
  body('durationMin')
    .optional()
    .isInt({ min: 5, max: 480 }).withMessage('Duration must be between 5 and 480 minutes'),
  body('priority')
    .optional()
    .isInt({ min: 1, max: 5 }).withMessage('Priority must be between 1 and 5'),
  body('weeklyGoal')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Weekly goal must be between 1 and 100'),
  body('category')
    .optional({ nullable: true })
    .trim()
    .isLength({ max: 50 }).withMessage('Category must be 50 characters or fewer'),
];

router.get('/', getTasks);
router.post('/', taskBody, handleValidation, createTask);
router.patch('/:id', taskBodyPartial, handleValidation, updateTask);
router.delete('/:id', deleteTask);

export default router;
