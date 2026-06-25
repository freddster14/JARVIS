import { useState } from 'react';
import { useTasks, useUpdateTask, useDeleteTask } from '../hooks/useTasks.js';
import type { Task } from '../lib/api.js';
import { FieldError } from './FieldError.js';

const PRIORITY_COLORS: Record<number, string> = {
  1: 'bg-gray-100 text-gray-600',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-yellow-100 text-yellow-700',
  4: 'bg-orange-100 text-orange-700',
  5: 'bg-red-100 text-red-700',
};

type EditState = Omit<Task, 'id' | 'createdAt' | 'category'> & { category: string };

interface EditErrors {
  name?: string;
  durationMin?: string;
  weeklyGoal?: string;
  priority?: string;
  category?: string;
}

function validateEdit(form: EditState): EditErrors {
  const errors: EditErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required.';
  else if (form.name.trim().length > 100) errors.name = 'Name must be 100 characters or fewer.';
  if (!form.durationMin || form.durationMin < 5 || form.durationMin > 480)
    errors.durationMin = 'Duration must be between 5 and 480 minutes.';
  if (!form.weeklyGoal || form.weeklyGoal < 1 || form.weeklyGoal > 100)
    errors.weeklyGoal = 'Weekly goal must be between 1 and 100.';
  if (!form.priority || form.priority < 1 || form.priority > 5)
    errors.priority = 'Priority must be between 1 and 5.';
  if (form.category.trim().length > 50)
    errors.category = 'Category must be 50 characters or fewer.';
  return errors;
}

function TaskEditRow({ task, onDone }: { task: Task; onDone: () => void }) {
  const { mutate: updateTask, isPending, error } = useUpdateTask();
  const [form, setForm] = useState<EditState>({
    name: task.name,
    durationMin: task.durationMin,
    weeklyGoal: task.weeklyGoal,
    priority: task.priority,
    category: task.category ?? '',
  });
  const [touched, setTouched] = useState<Partial<Record<keyof EditState, boolean>>>({});
  const errors = validateEdit(form);
  const hasErrors = Object.keys(errors).length > 0;

  function touch(field: keyof EditState) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  function handleSave() {
    setTouched({ name: true, durationMin: true, weeklyGoal: true, priority: true, category: true });
    if (hasErrors) return;
    updateTask(
      { id: task.id, data: { ...form, category: form.category || null } },
      { onSuccess: onDone }
    );
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onDone();
  }

  const inputClass = (field: keyof EditState) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition bg-white ${
      touched[field] && errors[field]
        ? 'border-red-300 focus:ring-red-300'
        : 'focus:ring-indigo-400'
    }`;

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
      {error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {(error as Error).message}
        </p>
      )}
      <div>
        <input
          autoFocus
          className={inputClass('name')}
          value={form.name}
          maxLength={100}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onBlur={() => touch('name')}
          onKeyDown={handleKey}
          placeholder="Task name"
        />
        {touched.name && <FieldError message={errors.name} />}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Duration (min)</label>
          <input
            type="number"
            min={5}
            max={480}
            className={inputClass('durationMin')}
            value={form.durationMin}
            onChange={(e) => setForm({ ...form, durationMin: Number(e.target.value) })}
            onBlur={() => touch('durationMin')}
            onKeyDown={handleKey}
          />
          {touched.durationMin && <FieldError message={errors.durationMin} />}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Goal / week</label>
          <input
            type="number"
            min={1}
            max={100}
            className={inputClass('weeklyGoal')}
            value={form.weeklyGoal}
            onChange={(e) => setForm({ ...form, weeklyGoal: Number(e.target.value) })}
            onBlur={() => touch('weeklyGoal')}
            onKeyDown={handleKey}
          />
          {touched.weeklyGoal && <FieldError message={errors.weeklyGoal} />}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Priority (1–5)</label>
          <input
            type="number"
            min={1}
            max={5}
            className={inputClass('priority')}
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
            onBlur={() => touch('priority')}
            onKeyDown={handleKey}
          />
          {touched.priority && <FieldError message={errors.priority} />}
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Category</label>
          <input
            className={inputClass('category')}
            placeholder="e.g. Career"
            value={form.category}
            maxLength={50}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            onBlur={() => touch('category')}
            onKeyDown={handleKey}
          />
          {touched.category && <FieldError message={errors.category} />}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={isPending}
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
  const [deleteArmed, setDeleteArmed] = useState(false);
  const { mutate: deleteTask } = useDeleteTask();

  function handleDelete() {
    if (!deleteArmed) {
      setDeleteArmed(true);
      setTimeout(() => setDeleteArmed(false), 3000);
      return;
    }
    deleteTask(task.id);
  }

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
          onClick={handleDelete}
          className={`transition text-sm font-medium px-1 py-0.5 ${
            deleteArmed
              ? 'text-red-500 animate-pulse'
              : 'text-gray-300 hover:text-red-400 text-lg leading-none'
          }`}
          title={deleteArmed ? 'Click again to confirm deletion' : 'Delete task'}
        >
          {deleteArmed ? 'Sure?' : '×'}
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
