import { useState } from 'react';
import { format, addWeeks, subWeeks, startOfWeek } from 'date-fns';
import { WeekCalendar } from '../components/WeekCalendar.js';
import { TodayPanel } from '../components/TodayPanel.js';
import { StatsBar } from '../components/StatsBar.js';
import { useGenerateSchedule } from '../hooks/useSchedule.js';
import { useTasks } from '../hooks/useTasks.js';

export function Dashboard() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { mutate: generateSchedule, isPending, error } = useGenerateSchedule();
  const { data: tasks } = useTasks();

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekLabel = `Week of ${format(weekStart, 'MMM d, yyyy')}`;

  function handleGenerate() {
    const weekStartStr = format(weekStart, 'yyyy-MM-dd');
    generateSchedule(weekStartStr);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
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
          <button
            onClick={handleGenerate}
            disabled={isPending || !tasks?.length}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {isPending ? 'Generating…' : 'Generate Schedule'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-red-700 text-sm">
          {(error as Error).message}
        </div>
      )}

      <StatsBar />

      {!tasks?.length && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-amber-700 text-sm">
          Add tasks on the Tasks page before generating a schedule.
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-white rounded-xl shadow p-5">
          <TodayPanel />
        </div>
        <div className="lg:col-span-2 bg-white rounded-xl shadow p-5">
          <WeekCalendar currentDate={currentDate} />
        </div>
      </div>
    </div>
  );
}
