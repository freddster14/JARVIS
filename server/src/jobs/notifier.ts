import cron from 'node-cron';
import { format, addMinutes } from 'date-fns';
import { prisma } from '../lib/prisma.js';
import { sendPushToAll } from '../services/push.js';
import { generateEncouragement, generateWeeklyReview } from '../services/claude.js';

export function startNotifierJob() {
  // Every minute: check for tasks starting in 30 min
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const targetTime = format(addMinutes(now, 30), 'HH:mm');
    const today = new Date(format(now, 'yyyy-MM-dd'));
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const upcoming = await prisma.scheduleItem.findMany({
      where: {
        date: { gte: today, lt: tomorrow },
        startTime: targetTime,
        status: 'pending',
        notifiedAt: null,
      },
      include: { task: true },
    });

    for (const item of upcoming) {
      const recentCompletions = await prisma.completion.findMany({
        where: { taskId: item.taskId },
        orderBy: { weekStart: 'desc' },
        take: 4,
      });

      const totalScheduled = recentCompletions.reduce((s, c) => s + c.scheduled, 0);
      const totalCompleted = recentCompletions.reduce((s, c) => s + c.completed, 0);
      const rate = totalScheduled > 0 ? totalCompleted / totalScheduled : 0.5;

      const encouragement = await generateEncouragement({
        taskName: item.task.name,
        minutesUntil: 30,
        recentCompletionRate: rate,
      }).catch(() => `${item.task.name} starts in 30 minutes.`);

      await sendPushToAll({
        title: 'JARVIS',
        body: encouragement,
        tag: `task-${item.id}`,
        data: { scheduleItemId: item.id, action: 'upcoming' },
        actions: [
          { action: 'done', title: 'Mark done' },
          { action: 'skip', title: 'Skip' },
        ],
      });

      await prisma.scheduleItem.update({
        where: { id: item.id },
        data: { notifiedAt: now },
      });
    }
  });

  // Morning ping in dynamic mode — runs every minute, fires at configured time
  cron.schedule('* * * * *', async () => {
    const profile = await prisma.userProfile.findFirst();
    if (!profile || profile.wakeUpMode !== 'dynamic' || !profile.morningPingTime) return;

    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    if (currentTime !== profile.morningPingTime) return;

    const today = new Date(format(now, 'yyyy-MM-dd'));
    const existing = await prisma.dailyWakeLog.findUnique({ where: { date: today } });
    if (existing) return;

    await sendPushToAll({
      title: 'JARVIS — Good morning!',
      body: "Are you awake? Tap to let me know so I can arrange your day.",
      tag: 'morning-ping',
      data: { action: 'morning_ping' },
      actions: [{ action: 'awake', title: "Yes, I'm up!" }],
    });
  });

  // Fallback wake time — if no wake log by fallback time, use the stored default
  cron.schedule('* * * * *', async () => {
    const profile = await prisma.userProfile.findFirst();
    if (!profile || profile.wakeUpMode !== 'dynamic' || !profile.fallbackWakeTime) return;

    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    if (currentTime !== profile.fallbackWakeTime) return;

    const today = new Date(format(now, 'yyyy-MM-dd'));
    const existing = await prisma.dailyWakeLog.findUnique({ where: { date: today } });
    if (existing) return;

    await prisma.dailyWakeLog.create({
      data: {
        date: today,
        wakeTime: profile.fallbackWakeTime,
        source: 'fallback',
      },
    });
  });

  // Weekly completion summary — runs Sunday at 23:30
  cron.schedule('30 23 * * 0', async () => {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const tasks = await prisma.task.findMany();
    const allItems = await prisma.scheduleItem.findMany({
      where: { date: { gte: weekStart, lt: weekEnd } },
    });

    const taskStats: Array<{
      name: string;
      category: string | null;
      weeklyGoal: number;
      scheduled: number;
      completed: number;
      skipped: number;
      goalMet: boolean;
    }> = [];

    for (const task of tasks) {
      const items = allItems.filter((i) => i.taskId === task.id);
      if (items.length === 0) continue;

      const completed = items.filter((i) => i.status === 'done').length;
      const skipped = items.filter((i) => i.status === 'skipped').length;

      await prisma.completion.create({
        data: {
          taskId: task.id,
          weekStart,
          scheduled: items.length,
          completed,
          skipped,
        },
      });

      taskStats.push({
        name: task.name,
        category: task.category,
        weeklyGoal: task.weeklyGoal,
        scheduled: items.length,
        completed,
        skipped,
        goalMet: completed >= task.weeklyGoal,
      });
    }

    if (taskStats.length > 0) {
      const totalCompleted = taskStats.reduce((s, t) => s + t.completed, 0);
      const totalSkipped = taskStats.reduce((s, t) => s + t.skipped, 0);
      const decided = totalCompleted + totalSkipped;

      try {
        const review = await generateWeeklyReview({
          weekStart: format(weekStart, 'yyyy-MM-dd'),
          tasks: taskStats,
          overallCompletionRate: decided > 0 ? totalCompleted / decided : 0,
        });

        await sendPushToAll({
          title: `JARVIS — ${review.headline}`,
          body: review.summary,
          tag: `weekly-review-${format(weekStart, 'yyyy-MM-dd')}`,
          data: { action: 'weekly_review', weekStart: format(weekStart, 'yyyy-MM-dd') },
        });
      } catch (err) {
        console.error('[JARVIS] Auto weekly review failed:', err);
      }
    }
  });

  console.log('[JARVIS] Notifier cron jobs started');
}
