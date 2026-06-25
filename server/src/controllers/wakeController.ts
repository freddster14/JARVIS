import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { format } from 'date-fns';

export async function confirmWake(req: Request, res: Response) {
  const now = new Date();
  const wakeTime = (req.body.time as string | undefined) ?? format(now, 'HH:mm');
  const today = new Date(format(now, 'yyyy-MM-dd'));

  const log = await prisma.dailyWakeLog.upsert({
    where: { date: today },
    create: { date: today, wakeTime, source: 'ping_response' },
    update: { wakeTime, source: 'ping_response' },
  });

  res.json(log);
}

export async function getWakeLog(_req: Request, res: Response) {
  const logs = await prisma.dailyWakeLog.findMany({
    orderBy: { date: 'desc' },
    take: 14,
  });
  res.json(logs);
}

export async function getProfile(_req: Request, res: Response) {
  let profile = await prisma.userProfile.findFirst();
  if (!profile) {
    profile = await prisma.userProfile.create({ data: {} });
  }
  res.json(profile);
}

export async function updateProfile(req: Request, res: Response) {
  const { wakeUpMode, fixedWakeTime, morningPingTime, fallbackWakeTime } = req.body as {
    wakeUpMode?: 'fixed' | 'dynamic';
    fixedWakeTime?: string | null;
    morningPingTime?: string | null;
    fallbackWakeTime?: string | null;
  };

  let profile = await prisma.userProfile.findFirst();
  const data = {
    ...(wakeUpMode !== undefined && { wakeUpMode }),
    ...(fixedWakeTime !== undefined && { fixedWakeTime }),
    ...(morningPingTime !== undefined && { morningPingTime }),
    ...(fallbackWakeTime !== undefined && { fallbackWakeTime }),
  };

  if (!profile) {
    profile = await prisma.userProfile.create({ data });
  } else {
    profile = await prisma.userProfile.update({ where: { id: profile.id }, data });
  }
  res.json(profile);
}
