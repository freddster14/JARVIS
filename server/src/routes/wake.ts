import { Router } from 'express';
import { confirmWake, getWakeLog, getProfile, updateProfile } from '../controllers/wakeController.js';

const router = Router();

router.post('/confirm', confirmWake);
router.get('/log', getWakeLog);
router.get('/profile', getProfile);
router.patch('/profile', updateProfile);

export default router;
