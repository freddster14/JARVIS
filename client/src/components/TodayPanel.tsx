import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { useSchedule, useUpdateItemStatus } from '../hooks/useSchedule.js';
import type { ScheduleItem } from '../lib/api.js';

function nowMinutes(): number {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function humanizeUntil(mins: number): string {
  if (mins <= 0) return 'now';
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `in ${h}h` : `in ${h}h ${m}m`;
}

export function TodayPanel() {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const { data: items, isLoading } = useSchedule(today);
  const { mutate: updateStatus } = useUpdateItemStatus();

  // Re-render every 30s so "time until" and current-task state stay fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (isLoading) {
    return <div className="text-gray-400 text-sm py-6 text-center">Loading today…</div>;
  }

  const todayItems = (items ?? [])
    .filter((i) => i.date.startsWith(todayStr))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (todayItems.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        Nothing scheduled for today. Generate a schedule below to get started.
      </div>
    );
  }

  const cur = nowMinutes();
  const currentTask = todayItems.find(
    (i) => timeToMinutes(i.startTime) <= cur && cur < timeToMinutes(i.endTime) && i.status === 'pending'
  );
  const nextTask = todayItems.find(
    (i) => timeToMinutes(i.startTime) > cur && i.status === 'pending'
  );

  const completed = todayItems.filter((i) => i.status === 'done').length;
  const remaining = todayItems.filter((i) => i.status === 'pending' || i.status === 'rescheduled').length;
  const focus = currentTask ?? nextTask;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg text-gray-800">Today</h2>
        <span className="text-sm text-gray-500">
          {completed} done · {remaining} left
        </span>
      </div>

      {focus ? (
        <FocusCard
          item={focus}
          isCurrent={focus === currentTask}
          minutesUntil={timeToMinutes(focus.startTime) - cur}
          onDone={() => updateStatus({ id: focus.id, status: 'done' })}
          onSkip={() => updateStatus({ id: focus.id, status: 'skipped' })}
        />
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-5 text-center">
          <p className="text-green-800 font-medium">All caught up for today 🎉</p>
          <p className="text-green-600 text-sm mt-0.5">No more pending tasks.</p>
        </div>
      )}

      <ol className="space-y-1.5">
        {todayItems.map((item) => {
          const isFocus = item === focus;
          const past = timeToMinutes(item.endTime) <= cur;
          return (
            <li
              key={item.id}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                isFocus ? 'bg-indigo-50 ring-1 ring-indigo-200' : past ? 'opacity-50' : ''
              }`}
            >
              <span className="text-xs font-mono text-gray-400 w-24 shrink-0">
                {item.startTime}–{item.endTime}
              </span>
              <span
                className={`flex-1 truncate ${
                  item.status === 'done'
                    ? 'text-green-700'
                    : item.status === 'skipped'
                    ? 'text-gray-400 line-through'
                    : 'text-gray-800'
                }`}
              >
                {item.task.name}
              </span>
              <StatusBadge status={item.status} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function FocusCard({
  item,
  isCurrent,
  minutesUntil,
  onDone,
  onSkip,
}: {
  item: ScheduleItem;
  isCurrent: boolean;
  minutesUntil: number;
  onDone: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-xl p-5 shadow">
      <p className="text-indigo-200 text-xs uppercase tracking-wide font-semibold">
        {isCurrent ? 'Happening now' : 'Up next'}
      </p>
      <div className="flex items-end justify-between gap-3 mt-1">
        <div className="min-w-0">
          <h3 className="text-xl font-bold truncate">{item.task.name}</h3>
          <p className="text-indigo-100 text-sm">
            {item.startTime}–{item.endTime}
            {!isCurrent && <span className="ml-2 text-indigo-200">· {humanizeUntil(minutesUntil)}</span>}
          </p>
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        <button
          onClick={onDone}
          className="flex-1 bg-white text-indigo-700 rounded-lg py-2 text-sm font-medium hover:bg-indigo-50 transition"
        >
          ✓ Mark done
        </button>
        <button
          onClick={onSkip}
          className="px-4 bg-indigo-500/50 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-500/70 transition"
        >
          Skip
        </button>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ScheduleItem['status'] }) {
  const map: Record<ScheduleItem['status'], string> = {
    pending: 'text-gray-400',
    done: 'text-green-600',
    skipped: 'text-gray-300',
    rescheduled: 'text-yellow-600',
  };
  const label: Record<ScheduleItem['status'], string> = {
    pending: '○',
    done: '✓',
    skipped: '–',
    rescheduled: '↻',
  };
  return <span className={`text-sm shrink-0 ${map[status]}`}>{label[status]}</span>;
}
