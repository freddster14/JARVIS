import cron from 'node-cron';
import { format, addMinutes } from 'date-fns';
import { prisma } from '../lib/prisma.js';
import { sendPushToAll } from '../services/push.js';
import { generateEncouragement, generateWeeklyReview } from '../services/claude.js';
import { capReached, addMinutes as addTimerMinutes, NAG_INTERVAL_MIN, type Phase } from '../services/focusTimer.js';

// ─── per-minute handlers ──────────────────────────────────────────────────────

async function checkUpcomingTasks(): Promise<void> {
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

    const body = await generateEncouragement({
      taskName: item.task.name,
      minutesUntil: 30,
      recentCompletionRate: rate,
    }).catch(() => `${item.task.name} starts in 30 minutes.`);

    await sendPushToAll({
      title: 'JARVIS',
      body,
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
}

async function checkMorningPing(currentTime: string, today: Date): Promise<void> {
  const profile = await prisma.userProfile.findFirst();
  if (!profile || profile.wakeUpMode !== 'dynamic' || !profile.morningPingTime) return;
  if (currentTime !== profile.morningPingTime) return;

  const existing = await prisma.dailyWakeLog.findUnique({ where: { date: today } });
  if (existing) return;

  await sendPushToAll({
    title: 'JARVIS — Good morning!',
    body: "Are you awake? Tap to let me know so I can arrange your day.",
    tag: 'morning-ping',
    data: { action: 'morning_ping' },
    actions: [{ action: 'awake', title: "Yes, I'm up!" }],
  });
}

async function checkFallbackWake(currentTime: string, today: Date): Promise<void> {
  const profile = await prisma.userProfile.findFirst();
  if (!profile || profile.wakeUpMode !== 'dynamic' || !profile.fallbackWakeTime) return;
  if (currentTime !== profile.fallbackWakeTime) return;

  const existing = await prisma.dailyWakeLog.findUnique({ where: { date: today } });
  if (existing) return;

  await prisma.dailyWakeLog.create({
    data: {
      date: today,
      wakeTime: profile.fallbackWakeTime,
      source: 'fallback',
    },
  });
}

// ─── focus timer reminders ───────────────────────────────────────────────────

const PHASE_LABEL: Record<Phase, string> = { work: 'Work', break: 'Break', long_break: 'Long break' };

function focusPhaseEndPayload(session: {
  id: string;
  phase: string;
  scheduleItem: { task: { name: string } };
}) {
  const phase = session.phase as Phase;
  const taskName = session.scheduleItem.task.name;
  const body =
    phase === 'work'
      ? `Time's up on "${taskName}" — take a break, or tap "Still working on it".`
      : `Break's over — ready to get back to "${taskName}"?`;

  return {
    title: `JARVIS — ${PHASE_LABEL[phase]} finished`,
    body,
    tag: `focus-${session.id}`,
    data: { action: 'focus_phase_end', focusSessionId: session.id },
    actions: [
      { action: 'focus_advance', title: phase === 'work' ? 'Take a break' : 'Back to work' },
      { action: 'focus_snooze', title: 'Still working on it' },
    ],
  };
}

async function checkFocusSessionReminders(): Promise<void> {
  const now = new Date();
  const sessions = await prisma.focusSession.findMany({
    where: { status: { in: ['running', 'awaiting_ack'] } },
    include: { scheduleItem: { include: { task: true } } },
  });

  for (const session of sessions) {
    if (capReached(session.startedAt, session.plannedMinutes, now, session.pausedMinutesTotal)) {
      await prisma.focusSession.update({
        where: { id: session.id },
        data: { status: 'needs_resolution', nextNagAt: null },
      });
      await sendPushToAll({
        title: 'JARVIS — Timer left running',
        body: `Your Pomodoro for "${session.scheduleItem.task.name}" ran past its planned ${session.plannedMinutes} min. Open JARVIS to log your actual time.`,
        tag: `focus-cap-${session.id}`,
        data: { action: 'focus_needs_resolution', focusSessionId: session.id },
      });
      continue;
    }

    if (session.status === 'running') {
      if (now < session.phaseEndsAt) continue;
      await prisma.focusSession.update({
        where: { id: session.id },
        data: { status: 'awaiting_ack', nextNagAt: addTimerMinutes(now, NAG_INTERVAL_MIN), lastNotifiedAt: now },
      });
      await sendPushToAll(focusPhaseEndPayload(session));
      continue;
    }

    // awaiting_ack — resend every NAG_INTERVAL_MIN unless "still working on it" pushed nextNagAt further out
    if (session.nextNagAt && now >= session.nextNagAt) {
      await prisma.focusSession.update({
        where: { id: session.id },
        data: { nextNagAt: addTimerMinutes(now, NAG_INTERVAL_MIN), lastNotifiedAt: now },
      });
      await sendPushToAll(focusPhaseEndPayload(session));
    }
  }
}

// ─── weekly summary (Sunday 23:30) ───────────────────────────────────────────

async function runWeeklySummary(): Promise<void> {
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
      data: { taskId: task.id, weekStart, scheduled: items.length, completed, skipped },
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

  if (taskStats.length === 0) return;

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

// ─── entry point ─────────────────────────────────────────────────────────────

export function startNotifierJob(): void {
  // Single per-minute tick — handles all minute-level concerns together so
  // we only register one timer and share the Date/format calls.
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    const currentTime = format(now, 'HH:mm');
    const today = new Date(format(now, 'yyyy-MM-dd'));

    await Promise.allSettled([
      checkUpcomingTasks(),
      checkMorningPing(currentTime, today),
      checkFallbackWake(currentTime, today),
      checkFocusSessionReminders(),
    ]);
  });

  // Weekly completion summary + AI review — Sunday at 23:30
  cron.schedule('30 23 * * 0', runWeeklySummary);

  console.log('[JARVIS] Notifier cron jobs started');
}
