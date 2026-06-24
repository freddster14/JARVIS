import { useState } from 'react';
import { useTasks, useUpdateTask, useDeleteTask } from '../hooks/useTasks.js';
import type { Task } from '../lib/api.js';

const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-gray-100 text-gray-600',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-yellow-100 text-yellow-700',
  4: 'bg-orange-100 text-orange-700',
  5: 'bg-red-100 text-red-700',
};

type EditState = Omit<Task, 'id' | 'createdAt' | 'category'> & { category: string };

function TaskEditRow({ task, onDone }: { task: Task; onDone: () => void }) {
  const { mutate: updateTask, isPending } = useUpdateTask();
  const [form, setForm] = useState<EditState>({
    name: task.name,
    durationMin: task.durationMin,
    weeklyGoal: task.weeklyGoal,
    priority: task.priority,
            category: task.category ?? '',
  });

  function handleSave() {
    updateTask(
      { id: task.id, data: { ...form, category: form.category || null } },
      { onSuccess: onDone }
    );
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onDone();
  }

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
      <input
        autoFocus
        className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
        value={form.name}
        onChange={(e) => setForm({ ...form, name: e.target.value })}
        onKeyDown={handleKey}
        placeholder="Task name"
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Duration (min)</label>
          <input
            type="number"
            min={5}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            value={form.durationMin}
            onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
            onKeyDown={handleKey}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Goal / week</label>
          <input
            type="number"
            min={1}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            value={form.weeklyGoal}
            onChange={(e) => setForm({ ...form, weeklyGoal: Number(e.target.value) })}
            onKeyDown={handleKey}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Priority (1–5)</label>
          <input
            type="number"
            min={1}
            max={5}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
            onKeyDown={handleKey}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Category</label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
            placeholder="e.g. Career"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            onKeyDown={handleKey}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={isPending || !form.name.trim()}
          className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onDone}
          className="px-4 border rounded-lg py-2 text-sm hover:bg-gray-50 transition"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function TaskRow({ task }: { task: Task }) {
  const [editing, setEditing] = useState(false);
  const { mutate: deleteTask } = useDeleteTask();

  if (editing) {
    return <TaskEditRow task={task} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="bg-white rounded-xl shadow p-4 flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-gray-800 truncate">{task.name}</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              PRIORITY_COLORS[task.priority] ?? PRIORITY_COLORS[1]
            }`}
          >
            P{task.priority}
          </span>
          {task.category && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
              {task.category}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-500 mt-0.5">
          {task.durationMin} min · {task.weeklyGoal}× per week
        </p>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => setEditing(true)}
          className="text-gray-300 hover:text-indigo-500 transition text-sm px-1 py-0.5"
          title="Edit task"
        >
          ✎
        </button>
        <button
          onClick={() => deleteTask(task.id)}
          className="text-gray-300 hover:text-red-400 transition text-lg leading-none"
          title="Delete task"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function TaskList() {
  const { data: tasks, isLoading } = useTasks();

  if (isLoading) return <div className="text-gray-400 text-sm">Loading tasks…</div>;
  if (!tasks?.length)
    return <div className="text-gray-400 text-sm">No tasks yet. Add one above.</div>;

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <TaskRow key={task.id} task={task} />
      ))}
    </div>
  );
}
