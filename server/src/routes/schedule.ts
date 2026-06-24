import { Router } from 'express';
import { getSchedule, updateItemStatus } from '../controllers/scheduleController.js';

const router = Router();

router.get('/', getSchedule);
router.patch('/:id/status', updateItemStatus);

export default router;
