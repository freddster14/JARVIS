import { useState } from 'react';
import type { FocusSession } from '../lib/api.js';
import { useResolveFocus } from '../hooks/useFocus.js';
import { formatDurationShort } from '../lib/time.js';

interface Props {
  session: FocusSession;
  onResolved?: () => void;
}

export function FocusResolutionForm({ session, onResolved }: Props) {
  const { mutate: resolve, isPending, error } = useResolveFocus();
  const [actualMinutes, setActualMinutes] = useState(String(session.plannedMinutes));

  function submitActual() {
    const minutes = Number(actualMinutes);
    if (!Number.isFinite(minutes) || minutes < 0) return;
    resolve({ id: session.id, data: { actualMinutes: minutes } }, { onSuccess: onResolved });
  }

  function confirmFull() {
    resolve({ id: session.id, data: { confirmFullDuration: true } }, { onSuccess: onResolved });
  }

  return (
    <div className="space-y-3">
      <p>
        Your timer for <strong>{session.scheduleItem.task.name}</strong> was left running past its planned{' '}
        <strong>{formatDurationShort(session.plannedMinutes)}</strong>. What actually happened?
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {(error as Error).message}
        </p>
      )}

      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          className="w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          value={actualMinutes}
          onChange={(e) => setActualMinutes(e.target.value)}
        />
        <span className="text-sm text-gray-500">minutes worked</span>
        <button
          onClick={submitActual}
          disabled={isPending}
          className="ml-auto px-3 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          Save
        </button>
      </div>

      <button
        onClick={confirmFull}
        disabled={isPending}
        className="w-full px-3 py-2 border rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition"
      >
        It ran the full planned time
      </button>
    </div>
  );
}
