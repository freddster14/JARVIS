import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type FixedBlock } from '../lib/api.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function FixedBlockForm() {
  const qc = useQueryClient();
  const { data: blocks } = useQuery({ queryKey: ['blocks'], queryFn: api.blocks.list });
  const createBlock = useMutation({
    mutationFn: api.blocks.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocks'] }),
  });
  const deleteBlock = useMutation({
    mutationFn: api.blocks.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocks'] }),
  });

  const [form, setForm] = useState<Omit<FixedBlock, 'id'>>({
    name: '',
    dayOfWeek: 1,
    startTime: '09:00',
    endTime: '17:00',
    recurring: true,
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    createBlock.mutate(form, {
      onSuccess: () => setForm({ name: '', dayOfWeek: 1, startTime: '09:00', endTime: '17:00', recurring: true }),
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 space-y-3">
        <h2 className="font-semibold text-lg text-gray-800">Add Fixed Block</h2>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="Name (e.g. Work)"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <div className="grid grid-cols-3 gap-2">
          <select
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={form.dayOfWeek}
            onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
          >
            {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <input
            type="time"
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
          />
          <input
            type="time"
            className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
          />
        </div>
        <button
          type="submit"
          disabled={createBlock.isPending || !form.name.trim()}
          className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {createBlock.isPending ? 'Adding…' : 'Add Block'}
        </button>
      </form>

      {blocks && blocks.length > 0 && (
        <div className="space-y-2">
          {blocks.map((block) => (
            <div key={block.id} className="bg-white rounded-xl shadow px-4 py-3 flex justify-between items-center">
              <div>
                <span className="font-medium text-gray-800">{block.name}</span>
                <span className="text-sm text-gray-500 ml-2">
                  {DAY_NAMES[block.dayOfWeek]} {block.startTime}–{block.endTime}
                </span>
              </div>
              <button
                onClick={() => deleteBlock.mutate(block.id)}
                className="text-gray-300 hover:text-red-400 transition text-lg"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
