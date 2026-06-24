import Anthropic from '@anthropic-ai/sdk';
import type { Task, FixedBlock, Completion, DailyWakeLog } from '@prisma/client';

const client = new Anthropic();

const scheduleOutputTool: Anthropic.Tool = {
  name: 'output_schedule',
  description: 'Emit the generated schedule as structured JSON',
  input_schema: {
    type: 'object' as const,
    properties: {
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            taskId: { type: 'string' },
            date: { type: 'string', description: 'ISO date e.g. 2026-06-23' },
            startTime: { type: 'string', description: '24h time e.g. 14:00' },
            endTime: { type: 'string', description: '24h time e.g. 14:30' },
          },
          required: ['taskId', 'date', 'startTime', 'endTime'],
        },
      },
    },
    required: ['items'],
  },
};

interface ScheduleInput {
  taskId: string;
  date: string;
  startTime: string;
  endTime: string;
}

function buildSchedulingPrompt(params: {
  tasks: Task[];
  fixedBlocks: FixedBlock[];
  wakeLogs: DailyWakeLog[];
  performanceHistory: Completion[];
  weekStart: string;
}): string {
  const { tasks, fixedBlocks, wakeLogs, performanceHistory, weekStart } = params;

  const taskList = tasks
    .map(
      (t) =>
        `- ID: ${t.id} | Name: ${t.name} | Duration: ${t.durationMin}min | Weekly goal: ${t.weeklyGoal}x | Priority: ${t.priority}${t.category ? ` | Category: ${t.category}` : ''}`
    )
    .join('\n');

  const blockList = fixedBlocks
    .map(
      (b) =>
        `- ${b.name}: Day ${b.dayOfWeek} (0=Sun) from ${b.startTime} to ${b.endTime}`
    )
    .join('\n');

  const wakeInfo = wakeLogs
    .map((w) => `- ${w.date}: wake at ${w.wakeTime} (${w.source})`)
    .join('\n') || 'No wake logs yet — assume user is available from 09:00 if no fixed blocks exist.';

  const history =
    performanceHistory.length === 0
      ? 'No history yet.'
      : performanceHistory
          .map(
            (c) =>
              `- Task ${c.taskId}: week of ${c.weekStart} — scheduled ${c.scheduled}, completed ${c.completed}, skipped ${c.skipped}`
          )
          .join('\n');

  return `You are JARVIS, a personal AI scheduling assistant. Generate a weekly schedule for the week starting ${weekStart}.

TASKS TO SCHEDULE:
${taskList}

FIXED BLOCKS (unavailable time — do NOT schedule anything here):
${blockList || 'None'}

WAKE TIMES THIS WEEK:
${wakeInfo}

PERFORMANCE HISTORY (last 4 weeks):
${history}

SCHEDULING RULES:
1. Each day's available window starts at the user's wake time and ends at their first fixed block (or end of day if none).
2. Within each available window, fit task sessions AND decide where a meal break belongs:
   - Window < 3 hours: skip meal break
   - Window 3–5 hours: one 20-min break somewhere in the middle
   - Window > 5 hours: one 30-min meal break placed ~2 hours before the first fixed block (or midpoint if no fixed block)
3. Leave at least 10 minutes breathing room between consecutive tasks.
4. If a task is behind its weekly goal based on history, give it higher priority this week.
5. Spread tasks across the week — don't front-load Monday with everything.
6. Respect task durations exactly (startTime + durationMin = endTime).
7. Never schedule overlapping time slots.

Call the output_schedule tool with your complete schedule.`;
}

export async function generateWeeklySchedule(params: {
  tasks: Task[];
  fixedBlocks: FixedBlock[];
  wakeLogs: DailyWakeLog[];
  performanceHistory: Completion[];
  weekStart: string;
}): Promise<ScheduleInput[]> {
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 8000,
    thinking: { type: 'enabled', budget_tokens: 5000 },
    tools: [scheduleOutputTool],
    tool_choice: { type: 'any' },
    messages: [{ role: 'user', content: buildSchedulingPrompt(params) }],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not call the schedule output tool');
  }

  const input = toolUse.input as { items: ScheduleInput[] };
  return input.items;
}

export async function generateEncouragement(params: {
  taskName: string;
  minutesUntil: number;
  recentCompletionRate: number;
}): Promise<string> {
  const { taskName, minutesUntil, recentCompletionRate } = params;
  const rate = Math.round(recentCompletionRate * 100);

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 150,
    messages: [
      {
        role: 'user',
        content: `You are JARVIS. Write a single short motivational sentence (max 20 words) reminding the user that "${taskName}" starts in ${minutesUntil} minutes. Their recent completion rate for this task is ${rate}%. Be direct and encouraging. No fluff.`,
      },
    ],
  });

  const text = response.content.find((b) => b.type === 'text');
  return text?.type === 'text' ? text.text.trim() : `${taskName} is coming up in ${minutesUntil} minutes. You've got this.`;
}
