import { Router } from 'express';
import { getWeekProgress, getHistory } from '../controllers/statsController.js';

const router = Router();

router.get('/week', getWeekProgress);
router.get('/history', getHistory);

export default router;
