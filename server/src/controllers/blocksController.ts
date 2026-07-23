import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export async function getBlocks(_req: Request, res: Response) {
  const blocks = await prisma.fixedBlock.findMany({
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    include: { exceptions: true },
  });
  res.json(
    blocks.map(({ exceptions, date, ...block }) => ({
      ...block,
      date: date ? date.toISOString().slice(0, 10) : null,
      exceptions: exceptions.map((e) => e.date.toISOString().slice(0, 10)),
    }))
  );
}

export async function createBlock(req: Request, res: Response) {
  const { name, dayOfWeek, startTime, endTime, recurring = true, date } = req.body as {
    name: string;
    dayOfWeek?: number;
    startTime: string;
    endTime: string;
    recurring?: boolean;
    date?: string;
  };

  // One-time blocks are keyed by date, not day-of-week — derive dayOfWeek from
  // the date so the block still slots into day-of-week-based UI consistently.
  const oneTimeDate = recurring === false && date ? new Date(date) : null;
  const resolvedDayOfWeek = oneTimeDate ? oneTimeDate.getDay() : (dayOfWeek as number);

  const block = await prisma.fixedBlock.create({
    data: {
      name: name.trim(),
      dayOfWeek: resolvedDayOfWeek,
      startTime,
      endTime,
      recurring,
      date: oneTimeDate,
    },
  });
  res.status(201).json({ ...block, date: oneTimeDate ? date : null });
}

export async function updateBlock(req: Request<{ id: string }>, res: Response) {
  const { name, dayOfWeek, startTime, endTime, recurring, date } = req.body as {
    name?: string;
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
    recurring?: boolean;
    date?: string;
  };

  const oneTimeDate = recurring === false && date ? new Date(date) : undefined;

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name.trim();
  if (startTime !== undefined) data.startTime = startTime;
  if (endTime !== undefined) data.endTime = endTime;
  if (recurring !== undefined) data.recurring = recurring;

  if (oneTimeDate) {
    // Switching to (or updating) a one-time block: dayOfWeek always follows the date.
    data.date = oneTimeDate;
    data.dayOfWeek = oneTimeDate.getDay();
  } else {
    if (dayOfWeek !== undefined) data.dayOfWeek = dayOfWeek;
    if (recurring === true) data.date = null;
  }

  try {
    const block = await prisma.fixedBlock.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ ...block, date: block.date ? block.date.toISOString().slice(0, 10) : null });
  } catch {
    res.status(404).json({ error: 'Block not found' });
  }
}

export async function deleteBlock(req: Request<{ id: string }>, res: Response) {
  try {
    await prisma.fixedBlock.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Block not found' });
  }
}

/** Marks a normally-recurring block as not applying on one specific date (e.g. a day off). */
export async function skipBlockDate(req: Request<{ id: string }>, res: Response) {
  const { date } = req.body as { date: string };
  try {
    await prisma.fixedBlockException.upsert({
      where: { fixedBlockId_date: { fixedBlockId: req.params.id, date: new Date(date) } },
      create: { fixedBlockId: req.params.id, date: new Date(date) },
      update: {},
    });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Block not found' });
  }
}

/** Reverses skipBlockDate — the block applies on that date again. */
export async function unskipBlockDate(req: Request<{ id: string }>, res: Response) {
  const { date } = req.body as { date: string };
  await prisma.fixedBlockException.deleteMany({
    where: { fixedBlockId: req.params.id, date: new Date(date) },
  });
  res.status(204).send();
}
