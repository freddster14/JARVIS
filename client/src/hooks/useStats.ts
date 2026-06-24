import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import { format, startOfWeek } from 'date-fns';

export function useTodayStats() {
  return useQuery({
    queryKey: ['stats', 'today'],
    queryFn: api.stats.today,
    refetchInterval: 60_000,
  });
}

export function useWeekProgress(date: Date) {
  const weekStart = format(startOfWeek(date, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  return useQuery({
    queryKey: ['stats', 'week', weekStart],
    queryFn: () => api.stats.week(weekStart),
  });
}

export function useHistory(weeks = 8) {
  return useQuery({
    queryKey: ['stats', 'history', weeks],
    queryFn: () => api.stats.history(weeks),
  });
}

export function useWeeklyReview() {
  return useMutation({
    mutationFn: (weekStart: string) => api.ai.weeklyReview(weekStart),
  });
}
