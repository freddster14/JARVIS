import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const StatusSchema = z.object({
  status: z.enum(['pending', 'done', 'skipped', 'rescheduled']),
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
