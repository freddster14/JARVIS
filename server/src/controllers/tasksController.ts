import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export async function getTasks(_req: Request, res: Response) {
  const tasks = await prisma.task.findMany({ orderBy: { createdAt: 'asc' } });
  res.json(tasks);
}

export async function createTask(req: Request, res: Response) {
  const { name, durationMin, priority = 1, category, weeklyGoal = 1 } = req.body as {
    name: string;
    durationMin: number;
    priority?: number;
    category?: string;
    weeklyGoal?: number;
  };

  const task = await prisma.task.create({
    data: { name: name.trim(), durationMin, priority, category: category?.trim() || null, weeklyGoal },
  });
  res.status(201).json(task);
}

export async function updateTask(req: Request<{ id: string }>, res: Response) {
  const { name, durationMin, priority, category, weeklyGoal } = req.body as {
    name?: string;
    durationMin?: number;
    priority?: number;
    category?: string | null;
    weeklyGoal?: number;
  };

  try {
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(durationMin !== undefined && { durationMin }),
        ...(priority !== undefined && { priority }),
        ...(category !== undefined && { category: category?.trim() || null }),
        ...(weeklyGoal !== undefined && { weeklyGoal }),
      },
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
