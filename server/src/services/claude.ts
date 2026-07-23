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
      if (!b.recurring && b.date) {
        const dateStr = b.date.toISOString().slice(0, 10);
        return `- ${b.name}: ONE-TIME on ${dateStr} only from ${b.startTime} to ${b.endTime} (does not recur on other weeks)${skipNote}`;
      }
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

export interface TipAction {
  scheduleItemId: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface ScheduleTipResult {
  tip: string;
  actions: TipAction[];
}

interface SavedScheduleItem {
  id: string;
  taskId: string;
  date: Date;
  startTime: string;
  endTime: string;
}

function buildDayByDayScheduleText(
  scheduleItems: SavedScheduleItem[],
  tasks: Task[],
  fixedBlocks: FixedBlock[]
): string {
  const taskNameById = new Map(tasks.map((t) => [t.id, t.name]));
  const byDate = new Map<string, string[]>();
  for (const item of [...scheduleItems].sort((a, b) => a.startTime.localeCompare(b.startTime))) {
    const dateStr = item.date.toISOString().slice(0, 10);
    const lines = byDate.get(dateStr) ?? [];
    lines.push(`[id: ${item.id}] ${item.startTime}-${item.endTime} ${taskNameById.get(item.taskId) ?? 'Task'}`);
    byDate.set(dateStr, lines);
  }
  for (const b of fixedBlocks) {
    for (const [date, lines] of byDate) {
      const dow = new Date(date).getDay();
      const applies = b.recurring ? b.dayOfWeek === dow : b.date?.toISOString().slice(0, 10) === date;
      if (applies) lines.push(`${b.startTime}-${b.endTime} ${b.name} [fixed, not movable]`);
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, lines]) => `${date}:\n${lines.sort().join('\n')}`)
    .join('\n\n');
}

const tipOutputTool: Anthropic.Tool = {
  name: 'output_tip',
  description: 'Emit a schedule tip with optional concrete reschedule actions that would address it',
  input_schema: {
    type: 'object' as const,
    properties: {
      tip: {
        type: 'string',
        description: 'One short, specific, actionable tip (max 25 words), or a brief note that the week looks balanced',
      },
      actions: {
        type: 'array',
        description:
          'Concrete reschedule moves using REAL [id: ...] values from the provided schedule that would mechanically address the tip. Empty array if the tip is general advice that is not a schedule edit (e.g. "get more sleep").',
        items: {
          type: 'object',
          properties: {
            scheduleItemId: { type: 'string', description: 'The id from [id: ...] of the item to move' },
            date: { type: 'string', description: 'New ISO date e.g. 2026-07-26' },
            startTime: { type: 'string', description: 'New 24h start time e.g. 10:00' },
            endTime: { type: 'string', description: 'New 24h end time e.g. 10:30' },
          },
          required: ['scheduleItemId', 'date', 'startTime', 'endTime'],
        },
      },
    },
    required: ['tip', 'actions'],
  },
};

export async function generateScheduleTip(params: {
  scheduleItems: SavedScheduleItem[];
  tasks: Task[];
  fixedBlocks: FixedBlock[];
}): Promise<ScheduleTipResult> {
  const { scheduleItems, tasks, fixedBlocks } = params;
  const dayText = buildDayByDayScheduleText(scheduleItems, tasks, fixedBlocks);

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 500,
    tools: [tipOutputTool],
    tool_choice: { type: 'tool', name: 'output_tip' },
    messages: [
      {
        role: 'user',
        content: `You are JARVIS. Here is a week's generated schedule. Each schedulable item shows its [id: ...]; fixed blocks have no id and cannot be moved.

${dayText || 'No items were scheduled this week.'}

Give ONE short, specific, actionable tip (max 25 words) to make this schedule more realistic or sustainable — e.g. an overloaded day, missing buffer time after a long fixed block, or over-reliance on evenings. Be concrete, not generic. If the week genuinely looks well-balanced, say so briefly instead of inventing a problem.

If — and only if — the tip describes a concrete, mechanical fix (like moving one or two specific sessions to a different day/time), also propose it as 1-3 actions using the real [id: ...] values and a date/time that doesn't conflict with anything else already on the schedule. If the tip is general advice that isn't a schedule edit, leave actions empty.

Call the output_tip tool.`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') return { tip: '', actions: [] };
  const result = toolUse.input as ScheduleTipResult;
  return { tip: result.tip ?? '', actions: result.actions ?? [] };
}

export interface TipRecheckResult {
  stillApplicable: boolean;
  explanation: string;
  actions: TipAction[];
}

const recheckOutputTool: Anthropic.Tool = {
  name: 'output_recheck',
  description: 'Emit whether a past tip is still applicable to the current schedule',
  input_schema: {
    type: 'object' as const,
    properties: {
      stillApplicable: {
        type: 'boolean',
        description: 'True only if the situation the tip described still exists in the CURRENT schedule',
      },
      explanation: { type: 'string', description: 'One short sentence explaining the verdict' },
      actions: {
        type: 'array',
        description: 'If still applicable and mechanically fixable, 1-3 actions using real [id: ...] values from the CURRENT schedule. Otherwise empty.',
        items: {
          type: 'object',
          properties: {
            scheduleItemId: { type: 'string' },
            date: { type: 'string' },
            startTime: { type: 'string' },
            endTime: { type: 'string' },
          },
          required: ['scheduleItemId', 'date', 'startTime', 'endTime'],
        },
      },
    },
    required: ['stillApplicable', 'explanation', 'actions'],
  },
};

export async function recheckScheduleTip(params: {
  originalTip: string;
  scheduleItems: SavedScheduleItem[];
  tasks: Task[];
  fixedBlocks: FixedBlock[];
}): Promise<TipRecheckResult> {
  const { originalTip, scheduleItems, tasks, fixedBlocks } = params;
  const dayText = buildDayByDayScheduleText(scheduleItems, tasks, fixedBlocks);

  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 500,
    tools: [recheckOutputTool],
    tool_choice: { type: 'tool', name: 'output_recheck' },
    messages: [
      {
        role: 'user',
        content: `You are JARVIS. Here is a tip that was previously given about a schedule: "${originalTip}"

Here is the CURRENT schedule for that same week (it may have changed since the tip was written — items may have moved, been completed, or been removed):

${dayText || 'Nothing is currently scheduled this week.'}

Decide: is this tip still applicable to the CURRENT schedule? If the situation it described no longer exists, it is NOT still applicable. If it is still applicable and mechanically fixable, propose 1-3 actions using real [id: ...] values from the CURRENT schedule. Call the output_recheck tool.`,
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    return { stillApplicable: false, explanation: 'Could not re-evaluate this tip.', actions: [] };
  }
  const result = toolUse.input as TipRecheckResult;
  return {
    stillApplicable: Boolean(result.stillApplicable),
    explanation: result.explanation ?? '',
    actions: result.actions ?? [],
  };
}
