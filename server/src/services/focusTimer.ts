export type Phase = 'work' | 'break' | 'long_break';

export const WORK_MIN = 25;
export const SHORT_BREAK_MIN = 5;
export const LONG_BREAK_MIN = 15;
export const CYCLES_BEFORE_LONG_BREAK = 4;
export const NAG_INTERVAL_MIN = 5;

export function phaseDurationMin(phase: Phase): number {
  if (phase === 'work') return WORK_MIN;
  if (phase === 'long_break') return LONG_BREAK_MIN;
  return SHORT_BREAK_MIN;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export interface PhaseTransition {
  phase: Phase;
  cycleCount: number;
}

/** Given the phase that just elapsed and the cycles completed so far, compute the next phase. */
export function computeNextPhase(elapsedPhase: Phase, cycleCount: number): PhaseTransition {
  if (elapsedPhase === 'work') {
    const nextCycleCount = cycleCount + 1;
    return {
      phase: nextCycleCount % CYCLES_BEFORE_LONG_BREAK === 0 ? 'long_break' : 'break',
      cycleCount: nextCycleCount,
    };
  }
  return { phase: 'work', cycleCount };
}

/** True once total wall-clock time since session start reaches the task's planned cap. */
export function capReached(startedAt: Date, plannedMinutes: number, now: Date): boolean {
  return (now.getTime() - startedAt.getTime()) / 60_000 >= plannedMinutes;
}
