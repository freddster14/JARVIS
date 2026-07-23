import { useEffect, useState } from 'react';
import type { ScheduleItem, FocusPhase } from '../lib/api.js';
import { formatTimeRange12h } from '../lib/time.js';
import {
  useFocusSession,
  useStartFocus,
  useAdvanceFocus,
  usePauseFocus,
  useResumeFocus,
  useSnoozeFocus,
  useStopFocus,
} from '../hooks/useFocus.js';
import { useUpdateItemStatus } from '../hooks/useSchedule.js';
import { FocusResolutionForm } from './FocusResolutionForm.js';

const PHASE_LABEL: Record<FocusPhase, string> = {
  work: 'Work',
  break: 'Short break',
  long_break: 'Long break',
};

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

interface Props {
  item: ScheduleItem;
  onClose: () => void;
}

export function TaskTimerModal({ item, onClose }: Props) {
  const { data: session, isLoading } = useFocusSession(item.id);
  const { mutate: start, isPending: isStarting } = useStartFocus();
  const { mutate: advance, isPending: isAdvancing } = useAdvanceFocus();
  const { mutate: pause, isPending: isPausing } = usePauseFocus();
  const { mutate: resume, isPending: isResuming } = useResumeFocus();
  const { mutate: snooze, isPending: isSnoozing } = useSnoozeFocus();
  const { mutate: stop, isPending: isStopping } = useStopFocus();
  const { mutate: updateStatus } = useUpdateItemStatus();

  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  function stopActiveSessionIfAny() {
    if (session && ['running', 'paused', 'awaiting_ack'].includes(session.status)) {
      stop({ id: session.id });
    }
  }

  function handleMarkDone() {
    stopActiveSessionIfAny();
    updateStatus({ id: item.id, status: 'done' });
    onClose();
  }

  function handleSkip() {
    stopActiveSessionIfAny();
    updateStatus({ id: item.id, status: 'skipped' });
    onClose();
  }

  function handleStopAndLog() {
    if (!session) return;
    stop({ id: session.id });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div>
          <h3 className="font-semibold text-lg text-gray-900">{item.task.name}</h3>
          <p className="text-sm text-gray-500">{formatTimeRange12h(item.startTime, item.endTime)}</p>
        </div>

        {isLoading && <p className="text-sm text-gray-400">Loading…</p>}

        {!isLoading && (!session || session.status === 'completed' || session.status === 'cancelled') && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Start a Pomodoro timer for this task — 25 min work, 5 min break.</p>
            <button
              onClick={() => start(item.id)}
              disabled={isStarting}
              className="w-full bg-indigo-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {isStarting ? 'Starting…' : '▶ Start timer'}
            </button>
          </div>
        )}

        {session && session.status === 'running' && (
          <div className="space-y-3">
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-xl p-5 text-center">
              <p className="text-indigo-200 text-xs uppercase tracking-wide font-semibold">
                {PHASE_LABEL[session.phase]} · Cycle {session.phase === 'work' ? session.cycleCount + 1 : session.cycleCount}
              </p>
              <p className="text-4xl font-bold mt-1 tabular-nums">
                {formatCountdown((new Date(session.phaseEndsAt).getTime() - Date.now()) / 1000)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => pause(session.id)}
                disabled={isPausing}
                className="flex-1 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {isPausing ? 'Pausing…' : '⏸ Pause'}
              </button>
              <button
                onClick={handleStopAndLog}
                disabled={isStopping}
                className="flex-1 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {isStopping ? 'Stopping…' : 'Stop & log time'}
              </button>
            </div>
          </div>
        )}

        {session && session.status === 'paused' && (
          <div className="space-y-3">
            <div className="bg-gray-100 rounded-xl p-5 text-center">
              <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold">
                {PHASE_LABEL[session.phase]} · Paused
              </p>
              <p className="text-4xl font-bold mt-1 tabular-nums text-gray-700">
                {formatCountdown((session.remainingMsAtPause ?? 0) / 1000)}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => resume(session.id)}
                disabled={isResuming}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {isResuming ? 'Resuming…' : '▶ Resume'}
              </button>
              <button
                onClick={handleStopAndLog}
                disabled={isStopping}
                className="flex-1 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition"
              >
                {isStopping ? 'Stopping…' : 'Stop & log time'}
              </button>
            </div>
          </div>
        )}

        {session && session.status === 'awaiting_ack' && (
          <div className="space-y-3">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center space-y-1">
              <p className="text-amber-800 font-medium">{PHASE_LABEL[session.phase]} finished</p>
              <p className="text-amber-600 text-sm">
                {session.phase === 'work' ? 'Take a break, or keep going.' : 'Ready to get back to it?'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => advance(session.id)}
                disabled={isAdvancing}
                className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {session.phase === 'work' ? 'Take a break' : 'Back to work'}
              </button>
              <button
                onClick={() => snooze(session.id)}
                disabled={isSnoozing}
                className="flex-1 px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition"
              >
                Still working on it
              </button>
            </div>
          </div>
        )}

        {session && session.status === 'needs_resolution' && (
          <FocusResolutionForm session={session} />
        )}

        <div className="flex gap-2 pt-1 border-t border-gray-100">
          <button
            onClick={handleMarkDone}
            className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-green-700 transition mt-3"
          >
            ✓ Mark done
          </button>
          <button
            onClick={handleSkip}
            className="px-4 border rounded-lg py-2 text-sm hover:bg-gray-50 transition mt-3"
          >
            Skip
          </button>
        </div>

        <button onClick={onClose} className="w-full text-center text-sm text-gray-400 hover:text-gray-600 transition">
          Close
        </button>
      </div>
    </div>
  );
}
