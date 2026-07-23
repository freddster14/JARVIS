import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useBlocks() {
  return useQuery({ queryKey: ['blocks'], queryFn: api.blocks.list });
}

export function useSkipBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) => api.blocks.skip(id, date),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocks'] }),
  });
}

export function useUnskipBlock() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) => api.blocks.unskip(id, date),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocks'] }),
  });
}
