import { Router } from 'express';
import { generateSchedule, weeklyReview } from '../controllers/aiController.js';

const router = Router();

router.post('/generate-schedule', generateSchedule);
router.post('/weekly-review', weeklyReview);

export default router;
