import { Router } from 'express';
import { query } from 'express-validator';
import { getTips, acknowledgeTip, deleteTip, applyTip, recheckTip } from '../controllers/tipsController.js';
import { handleValidation } from '../middleware/validate.js';

const router = Router();

const statusQuery = [
  query('status').optional().isIn(['unread', 'acknowledged']).withMessage('status must be unread or acknowledged'),
  handleValidation,
];

router.get('/', statusQuery, getTips);
router.patch('/:id/acknowledge', acknowledgeTip);
router.post('/:id/apply', applyTip);
router.post('/:id/recheck', recheckTip);
router.delete('/:id', deleteTip);

export default router;
