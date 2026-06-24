import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const StatusSchema = z.object({
  status: z.enum(['pending', 'done', 'skipped', 'rescheduled']),
});

const RescheduleSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});

export async function getSchedule(req: Request, res: Response) {
  const { weekStart } = req.query;
  if (!weekStart || typeof weekStart !== 'string') {
    res.status(400).json({ error: 'weekStart query param required (yyyy-MM-dd)' });
    return;
  }

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
  const parsed = StatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const item = await prisma.scheduleItem.update({
      where: { id: req.params.id },
      data: { status: parsed.data.status },
    });
    res.json(item);
  } catch {
    res.status(404).json({ error: 'Schedule item not found' });
  }
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export async function rescheduleItem(req: Request<{ id: string }>, res: Response) {
  const parsed = RescheduleSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const { date, startTime, endTime } = parsed.data;
  if (toMinutes(endTime) <= toMinutes(startTime)) {
    res.status(400).json({ error: 'endTime must be after startTime' });
    return;
  }

  const existing = await prisma.scheduleItem.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: 'Schedule item not found' });
    return;
  }

  // Reject overlaps with other items on the target day.
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

  const newStart = toMinutes(startTime);
  const newEnd = toMinutes(endTime);
  const clash = sameDay.find((i) => newStart < toMinutes(i.endTime) && toMinutes(i.startTime) < newEnd);
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
