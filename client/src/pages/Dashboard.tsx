import { useState, useEffect } from 'react';
import { format, addWeeks, subWeeks, startOfWeek } from 'date-fns';
import { WeekCalendar } from '../components/WeekCalendar.js';
import { TodayPanel } from '../components/TodayPanel.js';
import { StatsBar } from '../components/StatsBar.js';
import { useGenerateSchedule, useClearWeek } from '../hooks/useSchedule.js';
import { useTasks } from '../hooks/useTasks.js';
import { useApplyTip, useAcknowledgeTip } from '../hooks/useTips.js';

function formatHours(minutes: number): string {
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
}

export function Dashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [clearArmed, setClearArmed] = useState(false);
  const {
    mutate: generateSchedule,
    isPending: isGenerating,
    error: generateError,
    data: generateResult,
    reset: resetGenerate,
  } = useGenerateSchedule();
  const { mutate: clearWeek, isPending: isClearing } = useClearWeek();
  const { data: tasks } = useTasks();
  const { mutate: applyTip, isPending: isApplyingTip } = useApplyTip();
  const { mutate: acknowledgeTip, isPending: isAcknowledgingTip } = useAcknowledgeTip();
  const [tipHandled, setTipHandled] = useState(false);
  const [tipResultMsg, setTipResultMsg] = useState<string | null>(null);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, 'yyyy-MM-dd');
  const weekLabel = `Week of ${format(weekStart, 'MMM d, yyyy')}`;
  const isCurrentWeek = weekStartStr === format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');

  // Disarm the clear button and drop any stale confirm/tip banner when navigating weeks
  useEffect(() => {
    setClearArmed(false);
    resetGenerate();
    setTipHandled(false);
    setTipResultMsg(null);
  }, [weekStartStr]);

  function handleAutomateTip(tipId: string) {
    applyTip(tipId, {
      onSuccess: (result) => {
        setTipHandled(true);
        setTipResultMsg(
          `Moved ${result.applied} session${result.applied === 1 ? '' : 's'}` +
            (result.skipped ? ` — skipped ${result.skipped} (conflict or already gone).` : '.')
        );
      },
    });
  }

  function handleAcknowledgeTip(tipId: string) {
    acknowledgeTip(tipId, { onSuccess: () => setTipHandled(true) });
  }

  function handleGenerate(force = false) {
    generateSchedule({ weekStart: weekStartStr, force });
  }

  function handleClear() {
    if (!clearArmed) {
      setClearArmed(true);
      // Auto-disarm after 4 s if user doesn't confirm
      setTimeout(() => setClearArmed(false), 4000);
      return;
    }
    clearWeek({ weekStart: weekStartStr }, { onSuccess: () => setClearArmed(false) });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm">{weekLabel}</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="grid grid-cols-3 sm:flex gap-2">
            <button
              onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
              className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 transition whitespace-nowrap"
            >
              ← Prev
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                isCurrentWeek
                  ? 'bg-indigo-600 text-white'
                  : 'border hover:bg-gray-50'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
              className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 transition whitespace-nowrap"
            >
              Next →
            </button>
          </div>

          <div className="grid grid-cols-2 sm:flex gap-2">
            <button
              onClick={handleClear}
              disabled={isClearing}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50 whitespace-nowrap ${
                clearArmed
                  ? 'bg-red-600 text-white hover:bg-red-700 animate-pulse'
                  : 'border text-gray-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
              }`}
              title="Remove pending schedule items for this week"
            >
              {isClearing ? 'Clearing…' : clearArmed ? 'Confirm clear?' : 'Clear week'}
            </button>

            <button
              onClick={() => handleGenerate()}
              disabled={isGenerating || !tasks?.length}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition whitespace-nowrap"
            >
              {isGenerating ? 'Generating…' : 'Generate Schedule'}
            </button>
          </div>
        </div>
      </div>

      {generateError && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
          {(generateError as Error).message}
        </div>
      )}

      {generateResult?.needsConfirmation && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-800 text-sm space-y-2">
          <p>
            This week needs about <strong>{formatHours(generateResult.capacity.requiredMinutes)}</strong> of task
            time, but only <strong>{formatHours(generateResult.capacity.freeMinutes)}</strong> is free — some tasks
            may not fit at their full weekly goal.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleGenerate(true)}
              disabled={isGenerating}
              className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 disabled:opacity-50 transition"
            >
              {isGenerating ? 'Generating…' : 'Generate anyway'}
            </button>
            <button
              onClick={() => resetGenerate()}
              className="px-3 py-1.5 text-amber-700 text-xs font-medium hover:underline"
            >
              Never mind
            </button>
          </div>
        </div>
      )}

      {generateResult?.tip && !tipHandled && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-3 text-indigo-800 text-sm space-y-2">
          <p>💡 {generateResult.tip}</p>
          <div className="flex gap-2">
            {generateResult.tipId && generateResult.tipActions && generateResult.tipActions.length > 0 && (
              <button
                onClick={() => handleAutomateTip(generateResult.tipId!)}
                disabled={isApplyingTip}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {isApplyingTip ? 'Applying…' : `Automate (${generateResult.tipActions.length})`}
              </button>
            )}
            {generateResult.tipId && (
              <button
                onClick={() => handleAcknowledgeTip(generateResult.tipId!)}
                disabled={isAcknowledgingTip}
                className="px-3 py-1.5 text-indigo-700 text-xs font-medium hover:underline disabled:opacity-50"
              >
                Got it
              </button>
            )}
          </div>
        </div>
      )}

      {tipResultMsg && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-700 text-sm">
          ✓ {tipResultMsg}
        </div>
      )}

      <StatsBar />

      {!tasks?.length && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-700 text-sm">
          Add tasks on the Tasks page before generating a schedule.
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6 min-w-0">
        <div className="lg:col-span-1 bg-white rounded-xl shadow p-5 min-w-0">
          <TodayPanel />
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl shadow p-5 min-w-0">
          <WeekCalendar currentDate={currentDate} />
        </div>
      </div>
    </div>
  );
}
