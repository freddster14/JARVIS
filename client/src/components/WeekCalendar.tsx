import { useState, useEffect } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { useSchedule, useUpdateItemStatus } from '../hooks/useSchedule.js';
import { RescheduleModal } from './RescheduleModal.js';
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

function todayIndexInWeek(weekStart: Date): number {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  for (let i = 0; i < 7; i++) {
    if (format(addDays(weekStart, i), 'yyyy-MM-dd') === todayStr) return i;
  }
  return 0;
}

export function WeekCalendar({ currentDate }: Props) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const { data: items, isLoading } = useSchedule(currentDate);
  const { mutate: updateStatus } = useUpdateItemStatus();
  const [rescheduling, setRescheduling] = useState<ScheduleItem | null>(null);
  const [mobileDayIdx, setMobileDayIdx] = useState(() => todayIndexInWeek(weekStart));

  // Reset to today (or Mon) when the viewed week changes
  useEffect(() => {
    setMobileDayIdx(todayIndexInWeek(weekStart));
  }, [weekStart.getTime()]);

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

  function cycleStatus(item: ScheduleItem) {
    const next = item.status === 'pending' ? 'done' : item.status === 'done' ? 'skipped' : 'pending';
    updateStatus({ id: item.id, status: next });
  }

  function ScheduleCard({ item }: { item: ScheduleItem }) {
    return (
      <div
        className={`group relative rounded-lg border px-2 py-1.5 text-xs select-none transition hover:shadow-sm ${STATUS_STYLES[item.status]}`}
      >
        {/* Reschedule button: always visible on mobile, hover-only on desktop */}
        <button
          onClick={(e) => { e.stopPropagation(); setRescheduling(item); }}
          className="absolute top-1 right-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition text-xs leading-none hover:scale-110"
          title="Reschedule"
        >
          ↻
        </button>
        <div
          className="cursor-pointer pr-4"
          onClick={() => cycleStatus(item)}
          title={`${item.startTime}–${item.endTime} · tap to cycle status`}
        >
          <div className="font-medium truncate">{item.task.name}</div>
          <div className="opacity-70">{item.startTime}–{item.endTime}</div>
        </div>
      </div>
    );
  }

  const activeDay = days[mobileDayIdx];

  return (
    <>
      {/* ── Mobile: single-day view with day chip picker ── */}
      <div className="md:hidden space-y-3">
        {/* Day chip row */}
        <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar">
          {days.map(({ label, dateStr, date }, i) => {
            const isToday = dateStr === format(new Date(), 'yyyy-MM-dd');
            const isActive = i === mobileDayIdx;
            return (
              <button
                key={dateStr}
                onClick={() => setMobileDayIdx(i)}
                className={`flex-shrink-0 flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : isToday
                    ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{label}</span>
                <span className="text-sm font-bold">{format(date, 'd')}</span>
              </button>
            );
          })}
        </div>

        {/* Items for selected day */}
        <div className="space-y-2 min-h-[80px]">
          {itemsForDay(activeDay.dateStr).length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">Nothing scheduled</p>
          ) : (
            itemsForDay(activeDay.dateStr).map((item) => (
              <ScheduleCard key={item.id} item={item} />
            ))
          )}
        </div>
      </div>

      {/* ── Desktop: 7-column grid ── */}
      <div className="hidden md:block overflow-x-auto">
        <div className="grid grid-cols-7 gap-2 min-w-[700px]">
          {days.map(({ label, date, dateStr }) => (
            <div key={dateStr} className="flex flex-col gap-1">
              <div className="text-center py-1">
                <span className="text-xs font-semibold text-gray-500 uppercase">{label}</span>
                <p className={`text-sm font-bold ${
                  dateStr === format(new Date(), 'yyyy-MM-dd') ? 'text-indigo-600' : 'text-gray-800'
                }`}>{format(date, 'd')}</p>
              </div>
              <div className="flex flex-col gap-1 min-h-[120px]">
                {itemsForDay(dateStr).map((item) => (
                  <ScheduleCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {rescheduling && (
        <RescheduleModal
          item={rescheduling}
          weekStart={weekStart}
          onClose={() => setRescheduling(null)}
        />
      )}
    </>
  );
}
