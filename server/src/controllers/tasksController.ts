import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const CreateTaskSchema = z.object({
  name: z.string().min(1),
  durationMin: z.number().int().min(5),
  priority: z.number().int().min(1).max(5).optional(),
  category: z.string().optional(),
  weeklyGoal: z.number().int().min(1).optional(),
});

const UpdateTaskSchema = CreateTaskSchema.partial();

export async function getTasks(_req: Request, res: Response) {
  const tasks = await prisma.task.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(tasks);
}

export async function createTask(req: Request, res: Response) {
  const parsed = CreateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const task = await prisma.task.create({ data: parsed.data });
  res.status(201).json(task);
}

export async function updateTask(req: Request<{ id: string }>, res: Response) {
  const parsed = UpdateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: parsed.data,
    });
    res.json(task);
  } catch {
    res.status(404).json({ error: 'Task not found' });
  }
}

export async function deleteTask(req: Request<{ id: string }>, res: Response) {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Task not found' });
  }
}
