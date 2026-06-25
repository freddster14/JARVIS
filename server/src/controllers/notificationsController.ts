import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getVapidPublicKey } from '../lib/vapid.js';

export async function getVapidKey(_req: Request, res: Response) {
  res.json({ publicKey: getVapidPublicKey() });
}

export async function subscribe(req: Request, res: Response) {
  const { endpoint, keys } = req.body as {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };

  const sub = await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { p256dh: keys.p256dh, auth: keys.auth },
  });
  res.status(201).json(sub);
}

export async function unsubscribe(req: Request, res: Response) {
  try {
    await prisma.pushSubscription.delete({ where: { endpoint: req.body.endpoint as string } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'Subscription not found' });
  }
}
