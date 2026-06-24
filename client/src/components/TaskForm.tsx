import { useState } from 'react';
import { useCreateTask } from '../hooks/useTasks.js';

export function TaskForm() {
  const { mutate: createTask, isPending } = useCreateTask();
  const [form, setForm] = useState({
    name: '',
    durationMin: 30,
    weeklyGoal: 1,
    priority: 1,
    category: '',
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return;
    createTask(
      { ...form, category: form.category || null },
      { onSuccess: () => setForm({ name: '', durationMin: 30, weeklyGoal: 1, priority: 1, category: '' }) }
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 space-y-4">
      <h2 className="font-semibold text-lg text-gray-800">Add Task</h2>

      <div>
        <label className="block text-sm text-gray-600 mb-1">Task name</label>
        <input
          className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
          placeholder="e.g. Job Applications"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Duration (min)</label>
          <input
            type="number"
            min={5}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={form.durationMin}
            onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Goal / week</label>
          <input
            type="number"
            min={1}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={form.weeklyGoal}
            onChange={(e) => setForm({ ...form, weeklyGoal: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Priority (1–5)</label>
          <input
            type="number"
            min={1}
            max={5}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Category (optional)</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="e.g. Career"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending || !form.name.trim()}
        className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
      >
        {isPending ? 'Adding…' : 'Add Task'}
      </button>
    </form>
  );
}
