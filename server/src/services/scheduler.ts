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
