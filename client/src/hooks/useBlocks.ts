import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export function useBlocks() {
  return useQuery({ queryKey: ['blocks'], queryFn: api.blocks.list });
}
