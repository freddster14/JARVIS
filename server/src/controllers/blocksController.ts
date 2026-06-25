import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export async function getBlocks(_req: Request, res: Response) {
  const blocks = await prisma.fixedBlock.findMany({
    orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
  });
  res.json(blocks);
}

export async function createBlock(req: Request, res: Response) {
  const { name, dayOfWeek, startTime, endTime, recurring = true } = req.body as {
    name: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    recurring?: boolean;
  };

  const block = await prisma.fixedBlock.create({
    data: { name: name.trim(), dayOfWeek, startTime, endTime, recurring },
  });
  res.status(201).json(block);
}

export async function updateBlock(req: Request<{ id: string }>, res: Response) {
  const { name, dayOfWeek, startTime, endTime, recurring } = req.body as {
    name?: string;
    dayOfWeek?: number;
    startTime?: string;
    endTime?: string;
    recurring?: boolean;
  };

  try {
    const block = await prisma.fixedBlock.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(dayOfWeek !== undefined && { dayOfWeek }),
        ...(startTime !== undefined && { startTime }),
        ...(endTime !== undefined && { endTime }),
        ...(recurring !== undefined && { recurring }),
      },
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
