import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { phaseDurationMin, computeNextPhase, capReached, addMinutes, type Phase } from '../services/focusTimer.js';

const sessionInclude = { scheduleItem: { include: { task: true } } } as const;

export async function startFocusSession(req: Request, res: Response) {
  const { scheduleItemId } = req.body as { scheduleItemId: string };

  const scheduleItem = await prisma.scheduleItem.findUnique({
    where: { id: scheduleItemId },
    include: { task: true },
  });
  if (!scheduleItem) {
    res.status(404).json({ error: 'Schedule item not found' });
    return;
  }

  const existing = await prisma.focusSession.findFirst({
    where: { scheduleItemId, status: { in: ['running', 'awaiting_ack', 'needs_resolution'] } },
    include: sessionInclude,
    orderBy: { createdAt: 'desc' },
  });
  if (existing) {
    res.status(existing.status === 'needs_resolution' ? 409 : 200).json(existing);
    return;
  }

  const now = new Date();
  const session = await prisma.focusSession.create({
    data: {
      scheduleItemId,
      plannedMinutes: scheduleItem.task.durationMin,
      phase: 'work',
      phaseStartedAt: now,
      phaseEndsAt: addMinutes(now, phaseDurationMin('work')),
    },
    include: sessionInclude,
  });
  res.status(201).json(session);
}

export async function getFocusSessionByItem(req: Request<{ scheduleItemId: string }>, res: Response) {
  const session = await prisma.focusSession.findFirst({
    where: { scheduleItemId: req.params.scheduleItemId },
    include: sessionInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json(session);
}

export async function getSessionsNeedingResolution(_req: Request, res: Response) {
  const sessions = await prisma.focusSession.findMany({
    where: { status: 'needs_resolution' },
    include: sessionInclude,
    orderBy: { createdAt: 'desc' },
  });
  res.json(sessions);
}

export async function advanceFocusSession(req: Request<{ id: string }>, res: Response) {
  const session = await prisma.focusSession.findUnique({ where: { id: req.params.id } });
  if (!session) {
    res.status(404).json({ error: 'Focus session not found' });
    return;
  }
  if (session.status !== 'awaiting_ack') {
    res.status(409).json({ error: `Cannot advance a session in status "${session.status}"` });
    return;
  }

  const now = new Date();
  if (capReached(session.startedAt, session.plannedMinutes, now)) {
    const updated = await prisma.focusSession.update({
      where: { id: session.id },
      data: { status: 'needs_resolution', nextNagAt: null },
      include: sessionInclude,
    });
    res.json(updated);
    return;
  }

  const { phase, cycleCount } = computeNextPhase(session.phase as Phase, session.cycleCount);
  const updated = await prisma.focusSession.update({
    where: { id: session.id },
    data: {
      phase,
      cycleCount,
      phaseStartedAt: now,
      phaseEndsAt: addMinutes(now, phaseDurationMin(phase)),
      status: 'running',
      nextNagAt: null,
    },
    include: sessionInclude,
  });
  res.json(updated);
}

export async function snoozeFocusSession(req: Request<{ id: string }>, res: Response) {
  const session = await prisma.focusSession.findUnique({ where: { id: req.params.id } });
  if (!session) {
    res.status(404).json({ error: 'Focus session not found' });
    return;
  }
  if (session.status !== 'awaiting_ack') {
    res.status(409).json({ error: `Cannot snooze a session in status "${session.status}"` });
    return;
  }

  const updated = await prisma.focusSession.update({
    where: { id: session.id },
    data: { nextNagAt: addMinutes(new Date(), phaseDurationMin(session.phase as Phase)) },
    include: sessionInclude,
  });
  res.json(updated);
}

export async function stopFocusSession(req: Request<{ id: string }>, res: Response) {
  const session = await prisma.focusSession.findUnique({ where: { id: req.params.id } });
  if (!session) {
    res.status(404).json({ error: 'Focus session not found' });
    return;
  }

  const { actualMinutes } = req.body as { actualMinutes?: number };
  const now = new Date();
  const minutes = actualMinutes ?? Math.round((now.getTime() - session.startedAt.getTime()) / 60_000);

  const updated = await prisma.focusSession.update({
    where: { id: session.id },
    data: { status: 'completed', resolvedActualMinutes: minutes, resolvedAt: now, nextNagAt: null },
    include: sessionInclude,
  });
  res.json(updated);
}

export async function cancelFocusSession(req: Request<{ id: string }>, res: Response) {
  try {
    await prisma.focusSession.update({
      where: { id: req.params.id },
      data: { status: 'cancelled', nextNagAt: null },
    });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Focus session not found' });
  }
}

export async function resolveFocusSession(req: Request<{ id: string }>, res: Response) {
  const session = await prisma.focusSession.findUnique({ where: { id: req.params.id } });
  if (!session) {
    res.status(404).json({ error: 'Focus session not found' });
    return;
  }
  if (session.status !== 'needs_resolution') {
    res.status(409).json({ error: `Session is not awaiting resolution (status "${session.status}")` });
    return;
  }

  const { actualMinutes, confirmFullDuration } = req.body as {
    actualMinutes?: number;
    confirmFullDuration?: boolean;
  };
  const minutes = confirmFullDuration ? session.plannedMinutes : (actualMinutes as number);

  const updated = await prisma.focusSession.update({
    where: { id: session.id },
    data: { status: 'completed', resolvedActualMinutes: minutes, resolvedAt: new Date() },
    include: sessionInclude,
  });
  res.json(updated);
}
