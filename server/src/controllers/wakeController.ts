import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { format } from 'date-fns';

const ConfirmWakeSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
});

export async function confirmWake(req: Request, res: Response) {
  const parsed = ConfirmWakeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const now = new Date();
  const wakeTime = parsed.data.time ?? format(now, 'HH:mm');
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
  const ProfileSchema = z.object({
    wakeUpMode: z.enum(['fixed', 'dynamic']).optional(),
    fixedWakeTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    morningPingTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
    fallbackWakeTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  });

  const parsed = ProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  let profile = await prisma.userProfile.findFirst();
  if (!profile) {
    profile = await prisma.userProfile.create({ data: parsed.data });
  } else {
    profile = await prisma.userProfile.update({
      where: { id: profile.id },
      data: parsed.data,
    });
  }
  res.json(profile);
}
