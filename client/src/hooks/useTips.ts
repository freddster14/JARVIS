import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useTips(status?: 'unread' | 'acknowledged') {
  return useQuery({ queryKey: ['tips', status ?? 'all'], queryFn: () => api.tips.list(status) });
}

export function useAcknowledgeTip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tips.acknowledge(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tips'] }),
  });
}

export function useApplyTip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tips.apply(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tips'] });
      qc.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
}

export function useRecheckTip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tips.recheck(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tips'] }),
  });
}

export function useDeleteTip() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.tips.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tips'] }),
  });
}
