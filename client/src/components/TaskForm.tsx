import { useState } from 'react';
import { useCreateTask } from '../hooks/useTasks.js';
import { FieldError } from './FieldError.js';

interface FormState {
  name: string;
  durationMin: string;
  weeklyGoal: string;
  priority: string;
  category: string;
}

interface FormErrors {
  name?: string;
  durationMin?: string;
  weeklyGoal?: string;
  priority?: string;
  category?: string;
}

function validate(form: FormState): FormErrors {
  const errors: FormErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required.';
  else if (form.name.trim().length > 100) errors.name = 'Name must be 100 characters or fewer.';

  const dur = Number(form.durationMin);
  if (!form.durationMin || isNaN(dur) || dur < 5 || dur > 480)
    errors.durationMin = 'Duration must be between 5 and 480 minutes.';

  const goal = Number(form.weeklyGoal);
  if (!form.weeklyGoal || isNaN(goal) || goal < 1 || goal > 100)
    errors.weeklyGoal = 'Weekly goal must be between 1 and 100.';

  const pri = Number(form.priority);
  if (!form.priority || isNaN(pri) || pri < 1 || pri > 5)
    errors.priority = 'Priority must be between 1 and 5.';

  if (form.category.trim().length > 50)
    errors.category = 'Category must be 50 characters or fewer.';

  return errors;
}

const EMPTY: FormState = { name: '', durationMin: '30', weeklyGoal: '1', priority: '1', category: '' };

export function TaskForm() {
  const { mutate: createTask, isPending, error } = useCreateTask();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const errors = validate(form);
  const hasErrors = Object.keys(errors).length > 0;

  function touch(field: keyof FormState) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, durationMin: true, weeklyGoal: true, priority: true, category: true });
    if (hasErrors) return;
    createTask(
      {
        name: form.name.trim(),
        durationMin: Number(form.durationMin),
        weeklyGoal: Number(form.weeklyGoal),
        priority: Number(form.priority),
        category: form.category.trim() || null,
      },
      { onSuccess: () => { setForm(EMPTY); setTouched({}); } }
    );
  }

  const inputClass = (field: keyof FormState) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition ${
      touched[field] && errors[field]
        ? 'border-red-300 focus:ring-red-300'
        : 'focus:ring-indigo-400'
    }`;

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 space-y-4">
      <h2 className="font-semibold text-lg text-gray-800">Add Task</h2>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error.message}
        </p>
      )}

      <div>
        <label className="block text-sm text-gray-600 mb-1">Task name</label>
        <input
          className={inputClass('name')}
          placeholder="e.g. Job Applications"
          value={form.name}
          maxLength={100}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onBlur={() => touch('name')}
        />
        {touched.name && <FieldError message={errors.name} />}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Duration (min)</label>
          <input
            type="number"
            min={5}
            max={480}
            className={inputClass('durationMin')}
            value={form.durationMin}
            onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
            onBlur={() => touch('durationMin')}
          />
          {touched.durationMin && <FieldError message={errors.durationMin} />}
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Goal / week</label>
          <input
            type="number"
            min={1}
            max={100}
            className={inputClass('weeklyGoal')}
            value={form.weeklyGoal}
            onChange={(e) => setForm({ ...form, weeklyGoal: e.target.value })}
            onBlur={() => touch('weeklyGoal')}
          />
          {touched.weeklyGoal && <FieldError message={errors.weeklyGoal} />}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Priority (1–5)</label>
          <input
            type="number"
            min={1}
            max={5}
            className={inputClass('priority')}
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value })}
            onBlur={() => touch('priority')}
          />
          {touched.priority && <FieldError message={errors.priority} />}
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">Category (optional)</label>
          <input
            className={inputClass('category')}
            placeholder="e.g. Career"
            value={form.category}
            maxLength={50}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
            onBlur={() => touch('category')}
          />
          {touched.category && <FieldError message={errors.category} />}
        </div>
      </div>

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
      >
        {isPending ? 'Adding…' : 'Add Task'}
      </button>
    </form>
  );
}
