import { addDays, format, startOfWeek } from 'date-fns';

export function getWeekDates(weekStart: Date): string[] {
  return Array.from({ length: 7 }, (_, i) =>
    format(addDays(weekStart, i), 'yyyy-MM-dd')
  );
}

export function getMondayOfWeek(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
}

/** True when two same-day time slots overlap (touching edges do not count). */
export function slotsOverlap(a: TimeSlot, b: TimeSlot): boolean {
  return (
    timeToMinutes(a.startTime) < timeToMinutes(b.endTime) &&
    timeToMinutes(b.startTime) < timeToMinutes(a.endTime)
  );
}

/** Returns the first slot in `others` that overlaps `slot`, or undefined. */
export function findClash<T extends TimeSlot>(slot: TimeSlot, others: T[]): T | undefined {
  return others.find((o) => slotsOverlap(slot, o));
}

/** True when a slot is well-formed (end strictly after start). */
export function isValidSlot(slot: TimeSlot): boolean {
  return timeToMinutes(slot.endTime) > timeToMinutes(slot.startTime);
}

/** Free minutes between wakeTime and dayEnd, after subtracting (merged, clamped) blocks. */
export function computeFreeMinutes(wakeTime: string, blocks: TimeSlot[], dayEnd = '23:00'): number {
  const start = timeToMinutes(wakeTime);
  const end = timeToMinutes(dayEnd);
  if (end <= start) return 0;

  const clamped = blocks
    .map((b): [number, number] => [
      Math.max(timeToMinutes(b.startTime), start),
      Math.min(timeToMinutes(b.endTime), end),
    ])
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);

  let busy = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [s, e] of clamped) {
    if (curEnd === -1) {
      curStart = s;
      curEnd = e;
    } else if (s <= curEnd) {
      curEnd = Math.max(curEnd, e);
    } else {
      busy += curEnd - curStart;
      curStart = s;
      curEnd = e;
    }
  }
  if (curEnd !== -1) busy += curEnd - curStart;

  return end - start - busy;
}

export interface WeekCapacityInput {
  weekDays: { dateStr: string; dayOfWeek: number; wakeTime: string }[];
  fixedBlocks: { id: string; dayOfWeek: number; startTime: string; endTime: string }[];
  skippedDates: { fixedBlockId: string; dateStr: string }[];
  tasks: { durationMin: number; weeklyGoal: number }[];
  dayEnd?: string;
}

export interface WeekCapacity {
  requiredMinutes: number;
  freeMinutes: number;
  overCommitted: boolean;
}

/** Rough weekly feasibility check: total task time needed vs. total free time available. */
export function computeWeekCapacity(input: WeekCapacityInput): WeekCapacity {
  const { weekDays, fixedBlocks, skippedDates, tasks, dayEnd = '23:00' } = input;
  const skipSet = new Set(skippedDates.map((s) => `${s.fixedBlockId}|${s.dateStr}`));

  let freeMinutes = 0;
  for (const day of weekDays) {
    const blocksForDay = fixedBlocks
      .filter((b) => b.dayOfWeek === day.dayOfWeek)
      .filter((b) => !skipSet.has(`${b.id}|${day.dateStr}`));
    freeMinutes += computeFreeMinutes(day.wakeTime, blocksForDay, dayEnd);
  }

  const requiredMinutes = tasks.reduce((sum, t) => sum + t.durationMin * t.weeklyGoal, 0);
  return { requiredMinutes, freeMinutes, overCommitted: requiredMinutes > freeMinutes };
}
