import { Router } from 'express';
import { generateSchedule } from '../controllers/aiController.js';

const router = Router();

router.post('/generate-schedule', generateSchedule);

export default router;
