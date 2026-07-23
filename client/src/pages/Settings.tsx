import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { FixedBlockForm } from '../components/FixedBlockForm.js';
import { WakeLog } from '../components/WakeLog.js';
import { usePushSubscription } from '../hooks/usePushSubscription.js';
import { TimeInput12h } from '../components/TimeInput12h.js';

export function Settings() {
  const qc = useQueryClient();
  const { data: profile } = useQuery({ queryKey: ['profile'], queryFn: api.wake.getProfile });
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const updateProfile = useMutation({
    mutationFn: api.wake.updateProfile,
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      const label = 'wakeUpMode' in vars ? 'Mode' : 'fixedWakeTime' in vars ? 'Wake time' : 'morningPingTime' in vars ? 'Ping time' : 'Fallback time';
      setSavedLabel(label);
      setTimeout(() => setSavedLabel(null), 2000);
    },
  });
  const { subscribed, loading, enable, disable } = usePushSubscription();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Push Notifications */}
      <section className="bg-white rounded-xl shadow p-5 space-y-3">
        <h2 className="font-semibold text-lg text-gray-800">Push Notifications</h2>
        <p className="text-sm text-gray-500">
          Enable OS-level reminders even when the tab is closed. JARVIS will notify you 30 minutes before each scheduled task.
        </p>
        <button
          onClick={subscribed ? disable : enable}
          disabled={loading}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
            subscribed
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
        >
          {loading ? 'Working…' : subscribed ? 'Disable Notifications' : 'Enable Notifications'}
        </button>
      </section>

      {/* Wake-Up Settings */}
      {profile && (
        <section className="bg-white rounded-xl shadow p-5 space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-lg text-gray-800">Wake-Up Settings</h2>
            {savedLabel && (
              <span className="text-xs text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                {savedLabel} saved
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500">
            JARVIS needs to know when your day starts to schedule tasks in your available window before work.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => updateProfile.mutate({ wakeUpMode: 'fixed' })}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
                profile.wakeUpMode === 'fixed'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Fixed Wake Time
            </button>
            <button
              onClick={() => updateProfile.mutate({ wakeUpMode: 'dynamic' })}
              className={`flex-1 py-2 rounded-lg border text-sm font-medium transition ${
                profile.wakeUpMode === 'dynamic'
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Morning Ping
            </button>
          </div>

          {profile.wakeUpMode === 'fixed' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">I always wake up at</label>
              <TimeInput12h
                className="max-w-[220px]"
                value={profile.fixedWakeTime ?? '09:00'}
                onChange={(v) => updateProfile.mutate({ fixedWakeTime: v })}
              />
            </div>
          )}

          {profile.wakeUpMode === 'dynamic' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Send morning ping at</label>
                <TimeInput12h
                  className="max-w-[220px]"
                  value={profile.morningPingTime ?? '07:00'}
                  onChange={(v) => updateProfile.mutate({ morningPingTime: v })}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Fallback wake time (if I don't respond)</label>
                <TimeInput12h
                  className="max-w-[220px]"
                  value={profile.fallbackWakeTime ?? '10:00'}
                  onChange={(v) => updateProfile.mutate({ fallbackWakeTime: v })}
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* Wake History */}
      <WakeLog />

      {/* Fixed Blocks */}
      <section className="space-y-3">
        <h2 className="font-semibold text-lg text-gray-800">Fixed Blocks</h2>
        <p className="text-sm text-gray-500">
          Times that are always unavailable — work, gym, appointments. JARVIS will never schedule tasks here.
        </p>
        <FixedBlockForm />
      </section>
    </div>
  );
}
