import { Router } from 'express';
import { getWeekProgress, getHistory, getToday } from '../controllers/statsController.js';

const router = Router();

router.get('/today', getToday);
router.get('/week', getWeekProgress);
router.get('/history', getHistory);

export default router;
