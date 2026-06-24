import { Router } from 'express';
import { getVapidKey, subscribe, unsubscribe } from '../controllers/notificationsController.js';

const router = Router();

router.get('/vapid-key', getVapidKey);
router.post('/subscribe', subscribe);
router.delete('/subscribe', unsubscribe);

export default router;
