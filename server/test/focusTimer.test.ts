import { describe, it, expect } from 'vitest';
import {
  phaseDurationMin,
  computeNextPhase,
  capReached,
  addMinutes,
  WORK_MIN,
  SHORT_BREAK_MIN,
  LONG_BREAK_MIN,
} from '../src/services/focusTimer.js';

describe('phaseDurationMin', () => {
  it('returns the classic Pomodoro lengths', () => {
    expect(phaseDurationMin('work')).toBe(WORK_MIN);
    expect(phaseDurationMin('break')).toBe(SHORT_BREAK_MIN);
    expect(phaseDurationMin('long_break')).toBe(LONG_BREAK_MIN);
  });
});

describe('addMinutes', () => {
  it('adds minutes to a date', () => {
    const start = new Date('2026-07-23T09:00:00.000Z');
    expect(addMinutes(start, 25).toISOString()).toBe('2026-07-23T09:25:00.000Z');
    expect(addMinutes(start, 0).toISOString()).toBe(start.toISOString());
  });
});

describe('computeNextPhase', () => {
  it('sends work into a short break for cycles 1-3', () => {
    expect(computeNextPhase('work', 0)).toEqual({ phase: 'break', cycleCount: 1 });
    expect(computeNextPhase('work', 1)).toEqual({ phase: 'break', cycleCount: 2 });
    expect(computeNextPhase('work', 2)).toEqual({ phase: 'break', cycleCount: 3 });
  });

  it('sends the 4th completed work cycle into a long break', () => {
    expect(computeNextPhase('work', 3)).toEqual({ phase: 'long_break', cycleCount: 4 });
  });

  it('resumes work after any break without changing cycleCount', () => {
    expect(computeNextPhase('break', 2)).toEqual({ phase: 'work', cycleCount: 2 });
    expect(computeNextPhase('long_break', 4)).toEqual({ phase: 'work', cycleCount: 4 });
  });

  it('repeats the 4-cycle pattern (8th cycle is also a long break)', () => {
    expect(computeNextPhase('work', 7)).toEqual({ phase: 'long_break', cycleCount: 8 });
  });
});

describe('capReached', () => {
  const startedAt = new Date('2026-07-23T09:00:00.000Z');
  const plannedMinutes = 120;

  it('is false before the planned duration elapses', () => {
    expect(capReached(startedAt, plannedMinutes, addMinutes(startedAt, 119))).toBe(false);
  });

  it('is true exactly at the planned duration', () => {
    expect(capReached(startedAt, plannedMinutes, addMinutes(startedAt, 120))).toBe(true);
  });

  it('is true past the planned duration', () => {
    expect(capReached(startedAt, plannedMinutes, addMinutes(startedAt, 200))).toBe(true);
  });
});
