import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { findClash, isValidSlot } from '../services/scheduler.js';

export async function getSchedule(req: Request, res: Response) {
  const weekStart = req.query.weekStart as string;

  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const items = await prisma.scheduleItem.findMany({
    where: { date: { gte: start, lt: end } },
    include: { task: true },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
  });

  res.json(items);
}

export async function updateItemStatus(req: Request<{ id: string }>, res: Response) {
  try {
    const item = await prisma.scheduleItem.update({
      where: { id: req.params.id },
      data: { status: req.body.status as string },
    });
    res.json(item);
  } catch {
    res.status(404).json({ error: 'Schedule item not found' });
  }
}

export async function rescheduleItem(req: Request<{ id: string }>, res: Response) {
  const { date, startTime, endTime } = req.body as {
    date: string;
    startTime: string;
    endTime: string;
  };

  // isValidSlot is a pure helper — belt-and-suspenders check after field validation
  if (!isValidSlot({ startTime, endTime })) {
    res.status(400).json({ error: 'endTime must be after startTime' });
    return;
  }

  const existing = await prisma.scheduleItem.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Schedule item not found' });
    return;
  }

  const targetDay = new Date(date);
  const dayEnd = new Date(targetDay);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const sameDay = await prisma.scheduleItem.findMany({
    where: {
      id: { not: req.params.id },
      date: { gte: targetDay, lt: dayEnd },
      status: { not: 'skipped' },
    },
  });

  const clash = findClash({ startTime, endTime }, sameDay);
  if (clash) {
    res.status(409).json({ error: `Overlaps with another task (${clash.startTime}–${clash.endTime})` });
    return;
  }

  const item = await prisma.scheduleItem.update({
    where: { id: req.params.id },
    data: { date: targetDay, startTime, endTime, status: 'rescheduled' },
    include: { task: true },
  });
  res.json(item);
}

export async function clearWeek(req: Request, res: Response) {
  const { weekStart, force = false } = req.body as { weekStart: string; force?: boolean };

  const start = new Date(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const where = {
    date: { gte: start, lt: end },
    ...(force ? {} : { status: { in: ['pending', 'rescheduled'] } }),
  };

  const { count } = await prisma.scheduleItem.deleteMany({ where });
  res.json({ deleted: count, weekStart, force });
}
