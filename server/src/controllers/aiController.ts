import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { generateWeeklySchedule, generateWeeklyReview, generateScheduleTip } from '../services/claude.js';
import { getMondayOfWeek, getWeekDates, computeWeekCapacity } from '../services/scheduler.js';
import { subWeeks, startOfWeek, format } from 'date-fns';

export async function generateSchedule(req: Request, res: Response) {
  const weekStartDate = req.body.weekStart
    ? new Date(req.body.weekStart as string)
    : getMondayOfWeek(new Date());

  const weekEnd = new Date(weekStartDate);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const [tasks, fixedBlocks, blockExceptions, performanceHistory, wakeLogs] = await Promise.all([
    prisma.task.findMany(),
    prisma.fixedBlock.findMany(),
    prisma.fixedBlockException.findMany({
      where: { date: { gte: weekStartDate, lt: weekEnd } },
    }),
    prisma.completion.findMany({
      where: { weekStart: { gte: startOfWeek(subWeeks(new Date(), 4), { weekStartsOn: 1 }) } },
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
  const enrichedWakeLogs = [...wakeLogs];

  if (profile?.wakeUpMode === 'fixed' && profile.fixedWakeTime && enrichedWakeLogs.length === 0) {
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStartDate);
      d.setDate(d.getDate() + i);
      enrichedWakeLogs.push({
        id: `synthetic-${d.toISOString()}`,
        date: d,
        wakeTime: profile.fixedWakeTime,
        source: 'fixed',
      });
    }
  }

  const weekStartStr = weekStartDate.toISOString().split('T')[0];
  const force = Boolean(req.body.force);

  const fallbackWakeTime = profile?.fallbackWakeTime ?? '09:00';
  const wakeTimeByDate = new Map(
    enrichedWakeLogs.map((w) => [w.date.toISOString().slice(0, 10), w.wakeTime])
  );
  const weekDays = getWeekDates(weekStartDate).map((dateStr) => ({
    dateStr,
    dayOfWeek: new Date(dateStr).getDay(),
    wakeTime: wakeTimeByDate.get(dateStr) ?? fallbackWakeTime,
  }));

  const capacity = computeWeekCapacity({
    weekDays,
    fixedBlocks: fixedBlocks.map((b) => ({ id: b.id, dayOfWeek: b.dayOfWeek, startTime: b.startTime, endTime: b.endTime })),
    skippedDates: blockExceptions.map((e) => ({ fixedBlockId: e.fixedBlockId, dateStr: e.date.toISOString().slice(0, 10) })),
    tasks: tasks.map((t) => ({ durationMin: t.durationMin, weeklyGoal: t.weeklyGoal })),
  });

  if (capacity.overCommitted && !force) {
    res.json({ weekStart: weekStartStr, capacity, needsConfirmation: true });
    return;
  }

  try {
    const scheduleItems = await generateWeeklySchedule({
      tasks,
      fixedBlocks,
      blockExceptions,
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

    let tip: string | undefined;
    if (created.count > 0) {
      try {
        tip = await generateScheduleTip({ scheduleItems, tasks, fixedBlocks });
      } catch (err) {
        console.error('[AI] Schedule tip generation failed (non-fatal):', err);
      }
    }

    res.json({ created: created.count, weekStart: weekStartStr, capacity, tip });
  } catch (err) {
    console.error('[AI] Schedule generation failed:', err);
    res.status(500).json({ error: 'Failed to generate schedule. Check server logs.' });
  }
}

export async function weeklyReview(req: Request, res: Response) {
  const weekStartDate = req.body.weekStart
    ? getMondayOfWeek(new Date(req.body.weekStart as string))
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
