import { Router } from 'express';
import { body, param } from 'express-validator';
import {
  startFocusSession,
  getFocusSessionByItem,
  getSessionsNeedingResolution,
  advanceFocusSession,
  pauseFocusSession,
  resumeFocusSession,
  snoozeFocusSession,
  stopFocusSession,
  cancelFocusSession,
  resolveFocusSession,
} from '../controllers/focusController.js';
import { handleValidation } from '../middleware/validate.js';

const router = Router();

router.post(
  '/start',
  body('scheduleItemId').isString().notEmpty().withMessage('scheduleItemId is required'),
  handleValidation,
  startFocusSession,
);

router.get('/needs-resolution', getSessionsNeedingResolution);

router.get(
  '/by-item/:scheduleItemId',
  param('scheduleItemId').isString().notEmpty(),
  handleValidation,
  getFocusSessionByItem,
);

router.post('/:id/advance', advanceFocusSession);
router.post('/:id/pause', pauseFocusSession);
router.post('/:id/resume', resumeFocusSession);
router.post('/:id/snooze', snoozeFocusSession);

router.post(
  '/:id/stop',
  body('actualMinutes').optional().isInt({ min: 0 }).withMessage('actualMinutes must be a non-negative integer'),
  handleValidation,
  stopFocusSession,
);

router.delete('/:id', cancelFocusSession);

router.post(
  '/:id/resolve',
  body('actualMinutes').optional().isInt({ min: 0 }).withMessage('actualMinutes must be a non-negative integer'),
  body('confirmFullDuration').optional().isBoolean().withMessage('confirmFullDuration must be a boolean'),
  body().custom((value: { actualMinutes?: number; confirmFullDuration?: boolean }) => {
    const hasActual = typeof value.actualMinutes === 'number';
    const hasConfirm = value.confirmFullDuration === true;
    if (hasActual === hasConfirm) {
      throw new Error('Provide exactly one of actualMinutes or confirmFullDuration');
    }
    return true;
  }),
  handleValidation,
  resolveFocusSession,
);

export default router;
