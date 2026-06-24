import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import tasksRouter from './routes/tasks.js';
import blocksRouter from './routes/blocks.js';
import scheduleRouter from './routes/schedule.js';
import notificationsRouter from './routes/notifications.js';
import wakeRouter from './routes/wake.js';
import aiRouter from './routes/ai.js';
import { initVapid } from './lib/vapid.js';
import { startNotifierJob } from './jobs/notifier.js';

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: process.env.CLIENT_URL ?? 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/tasks', tasksRouter);
app.use('/api/blocks', blocksRouter);
app.use('/api/schedule', scheduleRouter);
app.use('/api/push', notificationsRouter);
app.use('/api/wake', wakeRouter);
app.use('/api/ai', aiRouter);

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

initVapid();
startNotifierJob();

app.listen(PORT, () => {
  console.log(`[JARVIS] Server running on http://localhost:${PORT}`);
});
