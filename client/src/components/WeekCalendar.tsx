import { format, addDays, startOfWeek } from 'date-fns';
import { useSchedule, useUpdateItemStatus } from '../hooks/useSchedule.js';
import type { ScheduleItem } from '../lib/api.js';

const STATUS_STYLES: Record<ScheduleItem['status'], string> = {
  pending: 'bg-indigo-100 text-indigo-800 border-indigo-300',
  done: 'bg-green-100 text-green-800 border-green-300',
  skipped: 'bg-gray-100 text-gray-500 border-gray-300 line-through',
  rescheduled: 'bg-yellow-100 text-yellow-800 border-yellow-300',
};

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface Props {
  currentDate: Date;
}

export function WeekCalendar({ currentDate }: Props) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const { data: items, isLoading } = useSchedule(currentDate);
  const { mutate: updateStatus } = useUpdateItemStatus();

  if (isLoading) return <div className="text-gray-400 text-sm py-8 text-center">Loading schedule…</div>;

  const days = DAYS.map((label, i) => ({
    label,
    date: addDays(weekStart, i),
    dateStr: format(addDays(weekStart, i), 'yyyy-MM-dd'),
  }));

  function itemsForDay(dateStr: string) {
    return (items ?? [])
      .filter((item) => item.date.startsWith(dateStr))
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid grid-cols-7 gap-2 min-w-[700px]">
        {days.map(({ label, date, dateStr }) => (
          <div key={dateStr} className="flex flex-col gap-1">
            <div className="text-center py-1">
              <span className="text-xs font-semibold text-gray-500 uppercase">{label}</span>
              <p className="text-sm font-bold text-gray-800">{format(date, 'd')}</p>
            </div>
            <div className="flex flex-col gap-1 min-h-[120px]">
              {itemsForDay(dateStr).map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg border px-2 py-1.5 text-xs cursor-pointer select-none transition hover:shadow-sm ${STATUS_STYLES[item.status]}`}
                  onClick={() => {
                    const next = item.status === 'pending' ? 'done' : item.status === 'done' ? 'skipped' : 'pending';
                    updateStatus({ id: item.id, status: next });
                  }}
                  title={`${item.startTime}–${item.endTime}\nClick to cycle status`}
                >
                  <div className="font-medium truncate">{item.task.name}</div>
                  <div className="opacity-70">{item.startTime}–{item.endTime}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
