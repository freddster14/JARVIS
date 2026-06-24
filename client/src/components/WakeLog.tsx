import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../lib/api.js';

const SOURCE_LABELS: Record<string, string> = {
  ping_response: 'Confirmed',
  fallback: 'Fallback',
  fixed: 'Fixed',
  manual: 'Manual',
};

const SOURCE_STYLES: Record<string, string> = {
  ping_response: 'bg-green-100 text-green-700',
  fallback: 'bg-yellow-100 text-yellow-700',
  fixed: 'bg-gray-100 text-gray-600',
  manual: 'bg-indigo-100 text-indigo-700',
};

export function WakeLog() {
  const qc = useQueryClient();
  const { data: logs, isLoading } = useQuery({ queryKey: ['wakeLog'], queryFn: api.wake.getLog });
  const confirmWake = useMutation({
    mutationFn: () => api.wake.confirm(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wakeLog'] });
      qc.invalidateQueries({ queryKey: ['schedule'] });
    },
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const loggedToday = logs?.some((l) => l.date.startsWith(todayStr));

  return (
    <section className="bg-white rounded-xl shadow p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold text-lg text-gray-800">Wake History</h2>
          <p className="text-sm text-gray-500">
            When your day started recently. JARVIS uses this to plan your morning window.
          </p>
        </div>
        <button
          onClick={() => confirmWake.mutate()}
          disabled={confirmWake.isPending || loggedToday}
          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition shrink-0"
          title={loggedToday ? "Today's wake time is already logged" : 'Log that you are awake now'}
        >
          {confirmWake.isPending ? 'Logging…' : loggedToday ? '✓ Logged today' : "I'm up now"}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : logs && logs.length > 0 ? (
        <ul className="divide-y">
          {logs.map((log) => (
            <li key={log.id} className="flex items-center justify-between py-2 text-sm">
              <span className="text-gray-700">{format(new Date(log.date), 'EEE, MMM d')}</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-gray-800">{log.wakeTime}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    SOURCE_STYLES[log.source] ?? 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {SOURCE_LABELS[log.source] ?? log.source}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-400">No wake times logged yet.</p>
      )}
    </section>
  );
}
