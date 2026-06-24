import { format, startOfWeek } from 'date-fns';
import { useTodayStats } from '../hooks/useStats.js';
import { useWeekProgress } from '../hooks/useStats.js';

function Chip({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-800">{value}</span>
    </div>
  );
}

export function StatsBar() {
  const { data: today } = useTodayStats();
  const { data: week } = useWeekProgress(new Date());
  const weekLabel = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'MMM d');

  const weekRate = week?.overall
    ? Math.round(week.overall.completionRate * 100)
    : null;

  return (
    <div className="bg-white border rounded-xl px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 shadow-sm">
      {today && (
        <>
          <Chip label="Done today" value={today.done} color="bg-green-500" />
          <Chip label="Remaining" value={today.pending} color="bg-indigo-400" />
          {today.streak > 1 && (
            <Chip label="Day streak" value={`${today.streak} 🔥`} color="bg-orange-400" />
          )}
        </>
      )}

      {weekRate !== null && (
        <>
          <div className="w-px h-4 bg-gray-200 hidden sm:block" />
          <Chip
            label={`Week of ${weekLabel}`}
            value={`${weekRate}% completion`}
            color="bg-purple-400"
          />
          {week?.overall && (
            <Chip
              label="Goals met"
              value={`${week.overall.goalsMet}/${week.overall.totalGoals}`}
              color="bg-teal-400"
            />
          )}
        </>
      )}

      {!today && !week && (
        <span className="text-xs text-gray-400">No data yet — generate a schedule to get started.</span>
      )}
    </div>
  );
}
