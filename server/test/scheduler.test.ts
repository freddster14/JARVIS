import { describe, it, expect } from 'vitest';
import {
  timeToMinutes,
  minutesToTime,
  slotsOverlap,
  findClash,
  isValidSlot,
  getWeekDates,
  getMondayOfWeek,
  computeFreeMinutes,
  computeWeekCapacity,
} from '../src/services/scheduler.js';

describe('timeToMinutes / minutesToTime', () => {
  it('converts time strings to minutes', () => {
    expect(timeToMinutes('00:00')).toBe(0);
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('converts minutes back to zero-padded time', () => {
    expect(minutesToTime(0)).toBe('00:00');
    expect(minutesToTime(570)).toBe('09:30');
    expect(minutesToTime(1439)).toBe('23:59');
  });

  it('round-trips', () => {
    for (const t of ['07:15', '12:00', '18:45', '00:01']) {
      expect(minutesToTime(timeToMinutes(t))).toBe(t);
    }
  });
});

describe('slotsOverlap', () => {
  it('detects clear overlap', () => {
    expect(slotsOverlap({ startTime: '09:00', endTime: '10:00' }, { startTime: '09:30', endTime: '10:30' })).toBe(true);
  });

  it('detects full containment', () => {
    expect(slotsOverlap({ startTime: '09:00', endTime: '12:00' }, { startTime: '10:00', endTime: '11:00' })).toBe(true);
  });

  it('treats touching edges as non-overlapping', () => {
    expect(slotsOverlap({ startTime: '09:00', endTime: '10:00' }, { startTime: '10:00', endTime: '11:00' })).toBe(false);
  });

  it('returns false for disjoint slots', () => {
    expect(slotsOverlap({ startTime: '09:00', endTime: '10:00' }, { startTime: '14:00', endTime: '15:00' })).toBe(false);
  });

  it('is symmetric', () => {
    const a = { startTime: '09:00', endTime: '11:00' };
    const b = { startTime: '10:00', endTime: '12:00' };
    expect(slotsOverlap(a, b)).toBe(slotsOverlap(b, a));
  });
});

describe('findClash', () => {
  const others = [
    { id: '1', startTime: '08:00', endTime: '09:00' },
    { id: '2', startTime: '13:00', endTime: '14:00' },
  ];

  it('returns the overlapping slot', () => {
    const clash = findClash({ startTime: '13:30', endTime: '14:30' }, others);
    expect(clash?.id).toBe('2');
  });

  it('returns undefined when the slot fits a gap', () => {
    expect(findClash({ startTime: '10:00', endTime: '12:00' }, others)).toBeUndefined();
  });

  it('returns undefined against an empty list', () => {
    expect(findClash({ startTime: '10:00', endTime: '12:00' }, [])).toBeUndefined();
  });
});

describe('isValidSlot', () => {
  it('accepts end after start', () => {
    expect(isValidSlot({ startTime: '09:00', endTime: '09:30' })).toBe(true);
  });

  it('rejects equal times', () => {
    expect(isValidSlot({ startTime: '09:00', endTime: '09:00' })).toBe(false);
  });

  it('rejects inverted times', () => {
    expect(isValidSlot({ startTime: '10:00', endTime: '09:00' })).toBe(false);
  });
});

describe('computeFreeMinutes', () => {
  it('returns the full span when there are no blocks', () => {
    expect(computeFreeMinutes('07:00', [])).toBe(timeToMinutes('23:00') - timeToMinutes('07:00'));
  });

  it('subtracts a single block within range', () => {
    expect(computeFreeMinutes('07:00', [{ startTime: '09:00', endTime: '17:00' }])).toBe(
      (timeToMinutes('23:00') - timeToMinutes('07:00')) - (timeToMinutes('17:00') - timeToMinutes('09:00'))
    );
  });

  it('merges overlapping blocks instead of double-subtracting', () => {
    const withOverlap = computeFreeMinutes('07:00', [
      { startTime: '09:00', endTime: '13:00' },
      { startTime: '12:00', endTime: '17:00' },
    ]);
    const withoutOverlap = computeFreeMinutes('07:00', [{ startTime: '09:00', endTime: '17:00' }]);
    expect(withOverlap).toBe(withoutOverlap);
  });

  it('clamps blocks that start before wake time or end after day end', () => {
    expect(computeFreeMinutes('09:00', [{ startTime: '06:00', endTime: '10:00' }])).toBe(
      (timeToMinutes('23:00') - timeToMinutes('09:00')) - (timeToMinutes('10:00') - timeToMinutes('09:00'))
    );
  });

  it('returns 0 when wake time is at or after day end', () => {
    expect(computeFreeMinutes('23:00', [], '23:00')).toBe(0);
    expect(computeFreeMinutes('23:30', [], '23:00')).toBe(0);
  });
});

describe('computeWeekCapacity', () => {
  const weekDays = Array.from({ length: 7 }, (_, i) => ({
    dateStr: `2026-06-2${i}`,
    dayOfWeek: (i + 1) % 7, // Mon..Sun -> 1,2,3,4,5,6,0
    wakeTime: '07:00',
  }));

  it('flags overCommitted when required exceeds free time', () => {
    // 16h free/day * 7 days = 112h free; this task alone demands 160h.
    const result = computeWeekCapacity({
      weekDays,
      fixedBlocks: [],
      skippedDates: [],
      tasks: [{ durationMin: 480, weeklyGoal: 20 }],
    });
    expect(result.overCommitted).toBe(true);
    expect(result.requiredMinutes).toBe(480 * 20);
  });

  it('is not overCommitted for a light task load', () => {
    const result = computeWeekCapacity({
      weekDays,
      fixedBlocks: [],
      skippedDates: [],
      tasks: [{ durationMin: 30, weeklyGoal: 3 }],
    });
    expect(result.overCommitted).toBe(false);
  });

  it('excludes a fixed block on a date it has been skipped for', () => {
    const fixedBlocks = [{ id: 'b1', dayOfWeek: 1, startTime: '09:00', endTime: '17:00' }];
    const withoutSkip = computeWeekCapacity({ weekDays, fixedBlocks, skippedDates: [], tasks: [] });
    const withSkip = computeWeekCapacity({
      weekDays,
      fixedBlocks,
      skippedDates: [{ fixedBlockId: 'b1', dateStr: weekDays[0].dateStr }],
      tasks: [],
    });
    expect(withSkip.freeMinutes).toBeGreaterThan(withoutSkip.freeMinutes);
  });
});

describe('getMondayOfWeek / getWeekDates', () => {
  it('snaps any day to the Monday of its week', () => {
    // 2026-06-24 is a Wednesday
    const monday = getMondayOfWeek(new Date('2026-06-24T12:00:00'));
    expect(monday.getDay()).toBe(1);
  });

  it('produces 7 consecutive ISO dates starting at the given day', () => {
    const dates = getWeekDates(new Date('2026-06-22T00:00:00'));
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe('2026-06-22');
    expect(dates[6]).toBe('2026-06-28');
  });
});
