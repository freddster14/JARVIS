import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type Task } from '../lib/api.js';

export function useTasks() {
  return useQuery({ queryKey: ['tasks'], queryFn: api.tasks.list });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.tasks.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Task, 'id' | 'createdAt'>> }) =>
      api.tasks.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.tasks.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}
