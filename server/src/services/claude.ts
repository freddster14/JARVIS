import Anthropic from '@anthropic-ai/sdk';
import type { Task, FixedBlock, FixedBlockException, Completion, DailyWakeLog } from '@prisma/client';

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
  blockExceptions: FixedBlockException[];
  wakeLogs: DailyWakeLog[];
  performanceHistory: Completion[];
  weekStart: string;
}): string {
  const { tasks, fixedBlocks, blockExceptions, wakeLogs, performanceHistory, weekStart } = params;

  const taskList = tasks
    .map(
      (t) =>
        `- ID: ${t.id} | Name: ${t.name} | Duration: ${t.durationMin}min | Weekly goal: ${t.weeklyGoal}x | Priority: ${t.priority}${t.category ? ` | Category: ${t.category}` : ''}`
    )
    .join('\n');

  const exceptionDatesByBlock = new Map<string, string[]>();
  for (const ex of blockExceptions) {
    const dateStr = ex.date.toISOString().slice(0, 10);
    const list = exceptionDatesByBlock.get(ex.fixedBlockId) ?? [];
    list.push(dateStr);
    exceptionDatesByBlock.set(ex.fixedBlockId, list);
  }

  const blockList = fixedBlocks
    .map((b) => {
      const skippedDates = exceptionDatesByBlock.get(b.id);
      const skipNote = skippedDates?.length
        ? ` — SKIPPED this week on ${skippedDates.join(', ')}; treat the user as fully free of this block on those dates`
        : '';
      return `- ${b.name}: Day ${b.dayOfWeek} (0=Sun) from ${b.startTime} to ${b.endTime}${skipNote}`;
    })
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
1. Find EVERY free window in each day, not just the first one: start at the user's wake time, then each fixed block carves out unavailable time. A day can have several free windows — before the first fixed block, between fixed blocks, and after the last one until end of day (treat 23:00 as end of day if no later fixed block exists). Tasks can go in any of these windows, including evenings after work or between commitments.
2. Reserve a morning routine of 25–30 minutes for showering/getting ready immediately after wake time, before any task or meal is scheduled.
3. Reserve realistic meal breaks based on actual time of day, not just window length — a ~20 min breakfast break if a free window covers 07:00–09:00, a ~30 min lunch break if a free window covers 12:00–13:30, and a ~30-45 min dinner break if a free window covers 18:00–20:00. A single day can and should have multiple meal breaks if its free windows span that many mealtimes — don't collapse them into one.
4. Leave at least 10 minutes breathing room between consecutive tasks and breaks.
5. If a task is behind its weekly goal based on history, give it higher priority this week.
6. Spread tasks across the week — don't front-load Monday with everything.
7. Respect task durations exactly (startTime + durationMin = endTime).
8. Never schedule overlapping time slots, and never schedule inside a fixed block.
9. Don't schedule anything after 23:00.

Call the output_schedule tool with your complete schedule.`;
}

export async function generateWeeklySchedule(params: {
  tasks: Task[];
  fixedBlocks: FixedBlock[];
  blockExceptions: FixedBlockException[];
  wakeLogs: DailyWakeLog[];
  performanceHistory: Completion[];
  weekStart: string;
}): Promise<ScheduleInput[]> {
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 8000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    tools: [scheduleOutputTool],
    messages: [{ role: 'user', content: buildSchedulingPrompt(params) }],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not call the schedule output tool');
  }

  const input = toolUse.input as { items: ScheduleInput[] };
  return input.items;
}

interface TaskWeekStat {
  name: string;
  category: string | null;
  weeklyGoal: number;
  scheduled: number;
  completed: number;
  skipped: number;
  goalMet: boolean;
}

export interface WeeklyReview {
  headline: string;
  summary: string;
  wins: string[];
  focus: string[];
}

const reviewOutputTool: Anthropic.Tool = {
  name: 'output_review',
  description: 'Emit the weekly performance review as structured JSON',
  input_schema: {
    type: 'object' as const,
    properties: {
      headline: { type: 'string', description: 'One punchy sentence summarizing the week (max 12 words)' },
      summary: { type: 'string', description: '2-3 sentences of honest, specific analysis of the week' },
      wins: {
        type: 'array',
        items: { type: 'string' },
        description: '1-3 short bullet points celebrating what went well',
      },
      focus: {
        type: 'array',
        items: { type: 'string' },
        description: '1-3 short, actionable suggestions for next week',
      },
    },
    required: ['headline', 'summary', 'wins', 'focus'],
  },
};

export async function generateWeeklyReview(params: {
  weekStart: string;
  tasks: TaskWeekStat[];
  overallCompletionRate: number;
}): Promise<WeeklyReview> {
  const { weekStart, tasks, overallCompletionRate } = params;
  const rate = Math.round(overallCompletionRate * 100);

  const taskLines = tasks
    .map(
      (t) =>
        `- ${t.name}${t.category ? ` (${t.category})` : ''}: completed ${t.completed}/${t.weeklyGoal} goal, ${t.scheduled} scheduled, ${t.skipped} skipped${t.goalMet ? ' ✓ goal met' : ''}`
    )
    .join('\n');

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 1500,
    tools: [reviewOutputTool],
    tool_choice: { type: 'tool', name: 'output_review' },
    messages: [
      {
        role: 'user',
        content: `You are JARVIS, a personal AI scheduling assistant reviewing the user's week of ${weekStart}.

OVERALL COMPLETION RATE: ${rate}% (of tasks they decided on, i.e. done vs skipped)

PER-TASK RESULTS:
${taskLines || 'No tasks were scheduled this week.'}

Write a brief, honest weekly review. Be warm but direct — celebrate genuine progress, and if they fell short on goals, name it kindly and suggest a concrete adjustment. Don't be saccharine or generic. Call the output_review tool.`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Claude did not call the review output tool');
  }
  return toolUse.input as WeeklyReview;
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
