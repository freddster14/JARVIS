import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const BlockSchema = z.object({
  name: z.string().min(1),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  recurring: z.boolean().optional(),
});

export async function getBlocks(_req: Request, res: Response) {
  const blocks = await prisma.fixedBlock.findMany({ orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }] });
  res.json(blocks);
}

export async function createBlock(req: Request, res: Response) {
  const parsed = BlockSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const block = await prisma.fixedBlock.create({ data: parsed.data });
  res.status(201).json(block);
}

export async function updateBlock(req: Request<{ id: string }>, res: Response) {
  const parsed = BlockSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const block = await prisma.fixedBlock.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(block);
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
