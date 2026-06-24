import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type ScheduleItem } from '../lib/api.js';
import { format, startOfWeek } from 'date-fns';

export function useSchedule(date: Date) {
  const weekStart = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  return useQuery({
    queryKey: ['schedule', weekStart],
    queryFn: () => api.schedule.get(weekStart),
  });
}

export function useUpdateItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ScheduleItem['status'] }) =>
      api.schedule.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  });
}

export function useGenerateSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (weekStart?: string) => api.ai.generateSchedule(weekStart),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['schedule'] }),
  });
}
