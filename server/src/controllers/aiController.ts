import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { generateWeeklySchedule, generateWeeklyReview } from '../services/claude.js';
import { getMondayOfWeek } from '../services/scheduler.js';
import { subWeeks, startOfWeek, format } from 'date-fns';

const GenerateSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function generateSchedule(req: Request, res: Response) {
  const parsed = GenerateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const weekStartDate = parsed.data.weekStart
    ? new Date(parsed.data.weekStart)
    : getMondayOfWeek(new Date());

  const weekEnd = new Date(weekStartDate);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [tasks, fixedBlocks, performanceHistory, wakeLogs] = await Promise.all([
    prisma.task.findMany(),
    prisma.fixedBlock.findMany(),
    prisma.completion.findMany({
      where: {
        weekStart: {
          gte: startOfWeek(subWeeks(new Date(), 4), { weekStartsOn: 1 }),
        },
      },
    }),
    prisma.dailyWakeLog.findMany({
      where: { date: { gte: weekStartDate, lt: weekEnd } },
    }),
  ]);

  if (tasks.length === 0) {
    res.status(400).json({ error: 'No tasks found. Add tasks before generating a schedule.' });
    return;
  }

  const profile = await prisma.userProfile.findFirst();
  const enrichedWakeLogs = wakeLogs.length > 0 ? wakeLogs : [];

  if (profile?.wakeUpMode === 'fixed' && profile.fixedWakeTime && enrichedWakeLogs.length === 0) {
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStartDate);
      d.setDate(d.getDate() + i);
      return d;
    });
    for (const day of days) {
      enrichedWakeLogs.push({
        id: `synthetic-${day.toISOString()}`,
        date: day,
        wakeTime: profile.fixedWakeTime,
        source: 'fixed',
      });
    }
  }

  const weekStartStr = weekStartDate.toISOString().split('T')[0];

  try {
    const scheduleItems = await generateWeeklySchedule({
      tasks,
      fixedBlocks,
      wakeLogs: enrichedWakeLogs,
      performanceHistory,
      weekStart: weekStartStr,
    });

    await prisma.scheduleItem.deleteMany({
      where: { date: { gte: weekStartDate, lt: weekEnd } },
    });

    const created = await prisma.scheduleItem.createMany({
      data: scheduleItems.map((item) => ({
        taskId: item.taskId,
        date: new Date(item.date),
        startTime: item.startTime,
        endTime: item.endTime,
        status: 'pending',
      })),
    });

    res.json({ created: created.count, weekStart: weekStartStr });
  } catch (err) {
    console.error('[AI] Schedule generation failed:', err);
    res.status(500).json({ error: 'Failed to generate schedule. Check server logs.' });
  }
}

const ReviewSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function weeklyReview(req: Request, res: Response) {
  const parsed = ReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const weekStartDate = parsed.data.weekStart
    ? getMondayOfWeek(new Date(parsed.data.weekStart))
    : getMondayOfWeek(new Date());
  const weekEnd = new Date(weekStartDate);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [tasks, items] = await Promise.all([
    prisma.task.findMany(),
    prisma.scheduleItem.findMany({ where: { date: { gte: weekStartDate, lt: weekEnd } } }),
  ]);

  const byTask = new Map<string, typeof items>();
  for (const item of items) {
    const list = byTask.get(item.taskId) ?? [];
    list.push(item);
    byTask.set(item.taskId, list);
  }

  const taskStats = tasks
    .map((task) => {
      const taskItems = byTask.get(task.id) ?? [];
      const completed = taskItems.filter((i) => i.status === 'done').length;
      const skipped = taskItems.filter((i) => i.status === 'skipped').length;
      return {
        name: task.name,
        category: task.category,
        weeklyGoal: task.weeklyGoal,
        scheduled: taskItems.length,
        completed,
        skipped,
        goalMet: completed >= task.weeklyGoal,
      };
    })
    .filter((t) => t.scheduled > 0);

  if (taskStats.length === 0) {
    res.status(400).json({ error: 'No scheduled tasks this week to review yet.' });
    return;
  }

  const totalCompleted = taskStats.reduce((s, t) => s + t.completed, 0);
  const totalSkipped = taskStats.reduce((s, t) => s + t.skipped, 0);
  const decided = totalCompleted + totalSkipped;

  try {
    const review = await generateWeeklyReview({
      weekStart: format(weekStartDate, 'yyyy-MM-dd'),
      tasks: taskStats,
      overallCompletionRate: decided > 0 ? totalCompleted / decided : 0,
    });
    res.json({ weekStart: format(weekStartDate, 'yyyy-MM-dd'), review });
  } catch (err) {
    console.error('[AI] Weekly review failed:', err);
    res.status(500).json({ error: 'Failed to generate weekly review. Check server logs.' });
  }
}
