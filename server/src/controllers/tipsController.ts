import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { recheckScheduleTip, type TipAction } from '../services/claude.js';
import { findClash, isValidSlot } from '../services/scheduler.js';

export async function getTips(req: Request, res: Response) {
  const status = req.query.status as string | undefined;
  const tips = await prisma.scheduleTip.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: 'desc' },
  });
  res.json(tips);
}

export async function acknowledgeTip(req: Request<{ id: string }>, res: Response) {
  try {
    const tip = await prisma.scheduleTip.update({
      where: { id: req.params.id },
      data: { status: 'acknowledged' },
    });
    res.json(tip);
  } catch {
    res.status(404).json({ error: 'Tip not found' });
  }
}

export async function deleteTip(req: Request<{ id: string }>, res: Response) {
  try {
    await prisma.scheduleTip.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Tip not found' });
  }
}

/** Applies a tip's stored reschedule actions, skipping any that no longer make sense. */
export async function applyTip(req: Request<{ id: string }>, res: Response) {
  const tip = await prisma.scheduleTip.findUnique({ where: { id: req.params.id } });
  if (!tip) {
    res.status(404).json({ error: 'Tip not found' });
    return;
  }

  const actions = (tip.actions as unknown as TipAction[] | null) ?? [];
  let applied = 0;
  const skipped: string[] = [];

  for (const action of actions) {
    if (!isValidSlot(action)) {
      skipped.push(`${action.scheduleItemId}: invalid time range`);
      continue;
    }

    const existing = await prisma.scheduleItem.findUnique({ where: { id: action.scheduleItemId } });
    if (!existing) {
      skipped.push(`${action.scheduleItemId}: no longer exists`);
      continue;
    }

    const targetDay = new Date(action.date);
    const dayEnd = new Date(targetDay);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const sameDay = await prisma.scheduleItem.findMany({
      where: {
        id: { not: action.scheduleItemId },
        date: { gte: targetDay, lt: dayEnd },
        status: { not: 'skipped' },
      },
    });

    const clash = findClash({ startTime: action.startTime, endTime: action.endTime }, sameDay);
    if (clash) {
      skipped.push(`${action.scheduleItemId}: would overlap another task`);
      continue;
    }

    await prisma.scheduleItem.update({
      where: { id: action.scheduleItemId },
      data: { date: targetDay, startTime: action.startTime, endTime: action.endTime, status: 'rescheduled' },
    });
    applied++;
  }

  await prisma.scheduleTip.update({ where: { id: tip.id }, data: { status: 'acknowledged' } });

  res.json({ applied, skipped: skipped.length, details: skipped });
}

/** Re-runs the tip against the CURRENT schedule to see if it's still relevant before acting on stale history. */
export async function recheckTip(req: Request<{ id: string }>, res: Response) {
  const tip = await prisma.scheduleTip.findUnique({ where: { id: req.params.id } });
  if (!tip) {
    res.status(404).json({ error: 'Tip not found' });
    return;
  }

  const weekEnd = new Date(tip.weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [scheduleItems, tasks, fixedBlocks] = await Promise.all([
    prisma.scheduleItem.findMany({ where: { date: { gte: tip.weekStart, lt: weekEnd } } }),
    prisma.task.findMany(),
    prisma.fixedBlock.findMany(),
  ]);

  try {
    const result = await recheckScheduleTip({ originalTip: tip.text, scheduleItems, tasks, fixedBlocks });

    if (result.stillApplicable && result.actions.length > 0) {
      await prisma.scheduleTip.update({
        where: { id: tip.id },
        data: { actions: result.actions as unknown as object, status: 'unread' },
      });
    }

    res.json(result);
  } catch (err) {
    console.error('[AI] Tip recheck failed:', err);
    res.status(500).json({ error: 'Failed to re-check tip. Check server logs.' });
  }
}
