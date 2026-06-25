import { useState } from 'react';
import { format, addDays, startOfWeek } from 'date-fns';
import { useRescheduleItem } from '../hooks/useSchedule.js';
import type { ScheduleItem } from '../lib/api.js';

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

interface Props {
  item: ScheduleItem;
  weekStart: Date;
  onClose: () => void;
}

export function RescheduleModal({ item, weekStart, onClose }: Props) {
  const durationMin = toMinutes(item.endTime) - toMinutes(item.startTime);
  const { mutate: reschedule, isPending, error } = useRescheduleItem();

  const [date, setDate] = useState(item.date.slice(0, 10));
  const [startTime, setStartTime] = useState(item.startTime);
  const [startTouched, setStartTouched] = useState(false);

  const endMinutes = toMinutes(startTime) + durationMin;
  const endTime = minutesToTime(endMinutes);
  const pastMidnight = endMinutes > 1440;
  const startError = startTouched && !startTime ? 'Start time is required.' : undefined;
  const endError = startTouched && pastMidnight ? 'Task would end past midnight — choose an earlier start time.' : undefined;

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(startOfWeek(weekStart, { weekStartsOn: 1 }), i);
    return { value: format(d, 'yyyy-MM-dd'), label: format(d, 'EEE d') };
  });

  function handleSave() {
    setStartTouched(true);
    if (!startTime || pastMidnight) return;
    reschedule(
      { id: item.id, date, startTime, endTime },
      { onSuccess: onClose }
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-sm p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h3 className="font-semibold text-lg text-gray-900">Reschedule</h3>
          <p className="text-sm text-gray-500">{item.task.name} · {durationMin} min</p>
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Day</label>
          <select
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          >
            {weekDays.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-sm text-gray-600 mb-1">Start time</label>
              <input
                type="time"
                className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition ${
                  (startError || endError)
                    ? 'border-red-300 focus:ring-red-300'
                    : 'focus:ring-indigo-400'
                }`}
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                onBlur={() => setStartTouched(true)}
              />
            </div>
            <div className={`text-sm pb-2 ${pastMidnight && startTouched ? 'text-red-500' : 'text-gray-400'}`}>
              → {endTime}
            </div>
          </div>
          {(startError || endError) && (
            <p className="text-xs text-red-500 mt-1">{startError ?? endError}</p>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {(error as Error).message}
          </p>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={handleSave}
            disabled={isPending}
            className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="px-4 border rounded-lg py-2 text-sm hover:bg-gray-50 transition"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
