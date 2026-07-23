import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getMondayOfWeek } from '../services/scheduler.js';
import { subWeeks, format } from 'date-fns';

interface TaskProgress {
  taskId: string;
  name: string;
  category: string | null;
  priority: number;
  weeklyGoal: number;
  scheduled: number;
  completed: number;
  skipped: number;
  pending: number;
  goalMet: boolean;
  completionRate: number;
}

/**
 * GET /api/stats/week?weekStart=YYYY-MM-DD
 * Per-task progress for the given week plus overall totals.
 */
export async function getWeekProgress(req: Request, res: Response) {
  const { weekStart } = req.query;
  const weekStartDate =
    typeof weekStart === 'string' ? getMondayOfWeek(new Date(weekStart)) : getMondayOfWeek(new Date());

  const weekEnd = new Date(weekStartDate);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [tasks, items, focusSessions] = await Promise.all([
    prisma.task.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.scheduleItem.findMany({
      where: { date: { gte: weekStartDate, lt: weekEnd } },
    }),
    prisma.focusSession.findMany({
      where: { status: 'completed', startedAt: { gte: weekStartDate, lt: weekEnd } },
      select: { resolvedActualMinutes: true },
    }),
  ]);
  const totalFocusMinutes = focusSessions.reduce((s, f) => s + (f.resolvedActualMinutes ?? 0), 0);

  const byTask = new Map<string, typeof items>();
  for (const item of items) {
    const list = byTask.get(item.taskId) ?? [];
    list.push(item);
    byTask.set(item.taskId, list);
  }

  const tasksProgress: TaskProgress[] = tasks.map((task) => {
    const taskItems = byTask.get(task.id) ?? [];
    const completed = taskItems.filter((i) => i.status === 'done').length;
    const skipped = taskItems.filter((i) => i.status === 'skipped').length;
    const pending = taskItems.filter((i) => i.status === 'pending' || i.status === 'rescheduled').length;
    const decided = completed + skipped;

    return {
      taskId: task.id,
      name: task.name,
      category: task.category,
      priority: task.priority,
      weeklyGoal: task.weeklyGoal,
      scheduled: taskItems.length,
      completed,
      skipped,
      pending,
      goalMet: completed >= task.weeklyGoal,
      completionRate: decided > 0 ? completed / decided : 0,
    };
  });

  const totalScheduled = tasksProgress.reduce((s, t) => s + t.scheduled, 0);
  const totalCompleted = tasksProgress.reduce((s, t) => s + t.completed, 0);
  const totalSkipped = tasksProgress.reduce((s, t) => s + t.skipped, 0);
  const totalPending = tasksProgress.reduce((s, t) => s + t.pending, 0);
  const goalsMet = tasksProgress.filter((t) => t.goalMet).length;
  const decided = totalCompleted + totalSkipped;

  res.json({
    weekStart: format(weekStartDate, 'yyyy-MM-dd'),
    overall: {
      totalScheduled,
      totalCompleted,
      totalSkipped,
      totalPending,
      completionRate: decided > 0 ? totalCompleted / decided : 0,
      goalsMet,
      totalGoals: tasks.length,
      totalFocusMinutes,
    },
    tasks: tasksProgress,
  });
}

/**
 * GET /api/stats/history?weeks=8
 * Weekly completion totals across recent weeks for trend display.
 */
export async function getHistory(req: Request, res: Response) {
  const weeks = Math.min(Math.max(Number(req.query.weeks) || 8, 1), 52);
  const since = getMondayOfWeek(subWeeks(new Date(), weeks));

  const completions = await prisma.completion.findMany({
    where: { weekStart: { gte: since } },
    orderBy: { weekStart: 'asc' },
  });

  const byWeek = new Map<string, { scheduled: number; completed: number; skipped: number }>();
  for (const c of completions) {
    const key = format(c.weekStart, 'yyyy-MM-dd');
    const agg = byWeek.get(key) ?? { scheduled: 0, completed: 0, skipped: 0 };
    agg.scheduled += c.scheduled;
    agg.completed += c.completed;
    agg.skipped += c.skipped;
    byWeek.set(key, agg);
  }

  const history = Array.from(byWeek.entries()).map(([weekStart, agg]) => {
    const decided = agg.completed + agg.skipped;
    return {
      weekStart,
      ...agg,
      completionRate: decided > 0 ? agg.completed / decided : 0,
    };
  });

  res.json({ weeks, history });
}

/**
 * GET /api/stats/today
 * Today's session counts + current daily completion streak.
 */
export async function getToday(_req: Request, res: Response) {
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');
  const todayStart = new Date(todayStr);
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const [todayItems, todayFocusSessions] = await Promise.all([
    prisma.scheduleItem.findMany({ where: { date: { gte: todayStart, lt: todayEnd } } }),
    prisma.focusSession.findMany({
      where: { status: 'completed', startedAt: { gte: todayStart, lt: todayEnd } },
      select: { resolvedActualMinutes: true },
    }),
  ]);

  const done = todayItems.filter((i) => i.status === 'done').length;
  const pending = todayItems.filter((i) => i.status === 'pending' || i.status === 'rescheduled').length;
  const skipped = todayItems.filter((i) => i.status === 'skipped').length;
  const focusMinutes = todayFocusSessions.reduce((s, f) => s + (f.resolvedActualMinutes ?? 0), 0);

  // Streak: count consecutive past days (going backwards from yesterday)
  // that had at least one completed item.
  let streak = 0;
  const check = new Date(todayStart);
  check.setDate(check.getDate() - 1);

  for (let i = 0; i < 365; i++) {
    const dayStart = new Date(check);
    const dayEnd = new Date(check);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const count = await prisma.scheduleItem.count({
      where: { date: { gte: dayStart, lt: dayEnd }, status: 'done' },
    });

    if (count === 0) break;
    streak++;
    check.setDate(check.getDate() - 1);
  }

  // Include today in streak if already has a completion.
  if (done > 0) streak++;

  res.json({ date: todayStr, done, pending, skipped, streak, focusMinutes });
}
