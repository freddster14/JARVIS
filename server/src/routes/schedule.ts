import { Router } from 'express';
import { getSchedule, updateItemStatus, rescheduleItem, clearWeek } from '../controllers/scheduleController.js';

const router = Router();

router.get('/', getSchedule);
router.delete('/week', clearWeek);
router.patch('/:id/status', updateItemStatus);
router.patch('/:id/reschedule', rescheduleItem);

export default router;
