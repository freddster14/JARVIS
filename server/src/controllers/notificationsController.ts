import type { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getVapidPublicKey } from '../lib/vapid.js';

const SubscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});

export async function getVapidKey(_req: Request, res: Response) {
  res.json({ publicKey: getVapidPublicKey() });
}

export async function subscribe(req: Request, res: Response) {
  const parsed = SubscribeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { endpoint, keys } = parsed.data;
  const sub = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { p256dh: keys.p256dh, auth: keys.auth },
  });
  res.status(201).json(sub);
}

export async function unsubscribe(req: Request, res: Response) {
  const { endpoint } = req.body as { endpoint?: string };
  if (!endpoint) {
    res.status(400).json({ error: 'endpoint required' });
    return;
  }
  try {
    await prisma.pushSubscription.delete({ where: { endpoint } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Subscription not found' });
  }
}
