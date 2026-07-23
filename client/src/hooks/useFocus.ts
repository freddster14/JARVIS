import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

/**
 * Polls fairly often since phase transitions happen server-side (cron) even if this
 * client is idle. staleTime is overridden to 0 (below the app-wide 30s default) so
 * reopening the modal always shows the latest phase/status instead of a stale cache hit.
 */
export function useFocusSession(scheduleItemId: string | undefined) {
  return useQuery({
    queryKey: ['focus', 'by-item', scheduleItemId],
    queryFn: () => api.focus.getByItem(scheduleItemId as string),
    enabled: !!scheduleItemId,
    staleTime: 0,
    refetchInterval: 15_000,
  });
}

export function useFocusNeedsResolution() {
  return useQuery({
    queryKey: ['focus', 'needs-resolution'],
    queryFn: api.focus.needsResolution,
    staleTime: 0,
    refetchInterval: 60_000,
  });
}

function useFocusMutation<TVars>(mutationFn: (vars: TVars) => Promise<unknown>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['focus'] });
      qc.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
}

export function useStartFocus() {
  return useFocusMutation((scheduleItemId: string) => api.focus.start(scheduleItemId));
}

export function useAdvanceFocus() {
  return useFocusMutation((id: string) => api.focus.advance(id));
}

export function usePauseFocus() {
  return useFocusMutation((id: string) => api.focus.pause(id));
}

export function useResumeFocus() {
  return useFocusMutation((id: string) => api.focus.resume(id));
}

export function useSnoozeFocus() {
  return useFocusMutation((id: string) => api.focus.snooze(id));
}

export function useStopFocus() {
  return useFocusMutation(({ id, actualMinutes }: { id: string; actualMinutes?: number }) =>
    api.focus.stop(id, actualMinutes)
  );
}

export function useCancelFocus() {
  return useFocusMutation((id: string) => api.focus.cancel(id));
}

export function useResolveFocus() {
  return useFocusMutation(
    ({ id, data }: { id: string; data: { actualMinutes: number } | { confirmFullDuration: true } }) =>
      api.focus.resolve(id, data)
  );
}
