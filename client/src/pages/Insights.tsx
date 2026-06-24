import { useState } from 'react';
import { format, addWeeks, subWeeks, startOfWeek } from 'date-fns';
import { useWeekProgress, useHistory, useWeeklyReview } from '../hooks/useStats.js';
import type { TaskProgress, HistoryWeek, WeeklyReview } from '../lib/api.js';

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl shadow p-4">
      <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function TaskRow({ task }: { task: TaskProgress }) {
  const goalProgress = task.weeklyGoal > 0 ? Math.min(task.completed / task.weeklyGoal, 1) : 0;
  return (
    <div className="py-3 border-b last:border-0">
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium text-gray-800 truncate">{task.name}</span>
          {task.category && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 shrink-0">
              {task.category}
            </span>
          )}
          {task.goalMet && <span className="text-xs text-green-600 shrink-0">✓ goal met</span>}
        </div>
        <span className="text-sm text-gray-500 shrink-0">
          {task.completed}/{task.weeklyGoal}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${task.goalMet ? 'bg-green-500' : 'bg-indigo-500'}`}
          style={{ width: `${goalProgress * 100}%` }}
        />
      </div>
      <div className="flex gap-3 mt-1.5 text-xs text-gray-400">
        <span>{task.completed} done</span>
        <span>{task.skipped} skipped</span>
        <span>{task.pending} pending</span>
        {task.scheduled > 0 && <span>{pct(task.completionRate)} completion</span>}
      </div>
    </div>
  );
}

function ReviewSection({ weekStart }: { weekStart: string }) {
  const { mutate, data, isPending, error } = useWeeklyReview();
  const review: WeeklyReview | undefined = data?.review;

  return (
    <section className="bg-white rounded-xl shadow p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold text-lg text-gray-800">AI Weekly Review</h2>
        <button
          onClick={() => mutate(weekStart)}
          disabled={isPending}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {isPending ? 'Thinking…' : review ? 'Regenerate' : 'Generate review'}
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-600">{(error as Error).message}</p>
      )}

      {!review && !isPending && !error && (
        <p className="text-sm text-gray-400">
          Let JARVIS analyze this week's performance and suggest where to focus next.
        </p>
      )}

      {review && (
        <div className="space-y-4">
          <div className="bg-indigo-50 rounded-lg p-4">
            <p className="font-semibold text-indigo-900">{review.headline}</p>
            <p className="text-sm text-indigo-800 mt-1">{review.summary}</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-green-600 font-semibold mb-1.5">Wins</p>
              <ul className="space-y-1">
                {review.wins.map((w, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-green-500 shrink-0">✓</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-indigo-600 font-semibold mb-1.5">Focus Next Week</p>
              <ul className="space-y-1">
                {review.focus.map((f, i) => (
                  <li key={i} className="text-sm text-gray-700 flex gap-2">
                    <span className="text-indigo-500 shrink-0">→</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function HistoryChart({ history }: { history: HistoryWeek[] }) {
  if (history.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        No completed weeks yet. Trends appear after your first weekly summary (Sundays).
      </p>
    );
  }

  const max = Math.max(...history.map((h) => h.scheduled), 1);

  return (
    <div className="flex items-end gap-2 h-40">
      {history.map((h) => {
        const completedH = (h.completed / max) * 100;
        const skippedH = (h.skipped / max) * 100;
        return (
          <div key={h.weekStart} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="w-full flex flex-col justify-end items-stretch flex-1" title={`${pct(h.completionRate)} completion`}>
              <div className="bg-gray-200 rounded-t" style={{ height: `${skippedH}%` }} />
              <div className="bg-green-500 rounded-b" style={{ height: `${completedH}%` }} />
            </div>
            <span className="text-[10px] text-gray-400 truncate w-full text-center">
              {format(new Date(h.weekStart), 'M/d')}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function Insights() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { data: progress, isLoading } = useWeekProgress(currentDate);
  const { data: historyData } = useHistory(8);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekLabel = `Week of ${format(weekStart, 'MMM d, yyyy')}`;
  const overall = progress?.overall;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insights</h1>
          <p className="text-gray-500 text-sm">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
            className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 transition"
          >
            ← Prev
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 transition"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
            className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 transition"
          >
            Next →
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-gray-400 text-sm py-8 text-center">Loading insights…</div>
      ) : (
        <>
          {overall && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Completion" value={pct(overall.completionRate)} sub={`${overall.totalCompleted} of ${overall.totalCompleted + overall.totalSkipped} decided`} />
              <StatCard label="Goals Met" value={`${overall.goalsMet}/${overall.totalGoals}`} sub="tasks hit weekly goal" />
              <StatCard label="Completed" value={String(overall.totalCompleted)} sub={`${overall.totalScheduled} scheduled`} />
              <StatCard label="Pending" value={String(overall.totalPending)} sub={`${overall.totalSkipped} skipped`} />
            </div>
          )}

          <section className="bg-white rounded-xl shadow p-5">
            <h2 className="font-semibold text-lg text-gray-800 mb-2">Weekly Goal Progress</h2>
            {progress?.tasks.length ? (
              <div>
                {progress.tasks.map((t) => (
                  <TaskRow key={t.taskId} task={t} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No tasks yet. Add tasks to track progress.</p>
            )}
          </section>

          <ReviewSection weekStart={format(weekStart, 'yyyy-MM-dd')} />

          <section className="bg-white rounded-xl shadow p-5">
            <h2 className="font-semibold text-lg text-gray-800 mb-1">Completion Trend</h2>
            <p className="text-xs text-gray-400 mb-4">Green = completed, gray = skipped, by week</p>
            <HistoryChart history={historyData?.history ?? []} />
          </section>
        </>
      )}
    </div>
  );
}
