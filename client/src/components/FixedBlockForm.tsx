import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type FixedBlock } from '../lib/api.js';
import { FieldError } from './FieldError.js';
import { useBlocks } from '../hooks/useBlocks.js';
import { formatTimeRange12h } from '../lib/time.js';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type BlockFormState = Omit<FixedBlock, 'id'>;

interface BlockErrors {
  name?: string;
  startTime?: string;
  endTime?: string;
  days?: string;
}

function validateBlock(form: Omit<BlockFormState, 'dayOfWeek'>): BlockErrors {
  const errors: BlockErrors = {};
  if (!form.name.trim()) errors.name = 'Name is required.';
  else if (form.name.trim().length > 100) errors.name = 'Name must be 100 characters or fewer.';
  if (!form.startTime) errors.startTime = 'Start time is required.';
  if (!form.endTime) errors.endTime = 'End time is required.';
  else if (form.startTime && form.endTime <= form.startTime)
    errors.endTime = 'End time must be after start time.';
  return errors;
}

const EMPTY_BLOCK: Omit<BlockFormState, 'dayOfWeek'> = { name: '', startTime: '09:00', endTime: '17:00', recurring: true };
const DAY_ABBR = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function blockInputClass(field: keyof BlockErrors, touched: Partial<Record<keyof BlockErrors, boolean>>, errors: BlockErrors) {
  return `border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 transition ${
    touched[field] && errors[field]
      ? 'border-red-300 focus:ring-red-300'
      : 'focus:ring-indigo-400'
  }`;
}

function BlockEditRow({ block, onDone }: { block: FixedBlock; onDone: () => void }) {
  const qc = useQueryClient();
  const updateBlock = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<BlockFormState> }) =>
      api.blocks.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['blocks'] }); onDone(); },
  });

  const [form, setForm] = useState<BlockFormState>({
    name: block.name,
    dayOfWeek: block.dayOfWeek,
    startTime: block.startTime,
    endTime: block.endTime,
    recurring: block.recurring,
  });
  const [touched, setTouched] = useState<Partial<Record<keyof BlockErrors, boolean>>>({});
  const errors = validateBlock(form);
  const hasErrors = Object.keys(errors).length > 0;

  function touch(field: keyof BlockErrors) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  function handleSave() {
    setTouched({ name: true, startTime: true, endTime: true });
    if (hasErrors) return;
    updateBlock.mutate({ id: block.id, data: form });
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') onDone();
  }

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
      {updateBlock.error && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {(updateBlock.error as Error).message}
        </p>
      )}
      <div>
        <input
          autoFocus
          className={`w-full ${blockInputClass('name', touched, errors)}`}
          placeholder="Name (e.g. Work)"
          value={form.name}
          maxLength={100}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onBlur={() => touch('name')}
          onKeyDown={handleKey}
        />
        {touched.name && <FieldError message={errors.name} />}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <select
          className="w-full min-w-0 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white"
          value={form.dayOfWeek}
          onChange={(e) => setForm({ ...form, dayOfWeek: Number(e.target.value) })}
        >
          {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </select>
        <div>
          <input
            type="time"
            className={`w-full min-w-0 ${blockInputClass('startTime', touched, errors)}`}
            value={form.startTime}
            onChange={(e) => setForm({ ...form, startTime: e.target.value })}
            onBlur={() => touch('startTime')}
            onKeyDown={handleKey}
          />
          {touched.startTime && <FieldError message={errors.startTime} />}
        </div>
        <div>
          <input
            type="time"
            className={`w-full min-w-0 ${blockInputClass('endTime', touched, errors)}`}
            value={form.endTime}
            onChange={(e) => setForm({ ...form, endTime: e.target.value })}
            onBlur={() => touch('endTime')}
            onKeyDown={handleKey}
          />
          {touched.endTime && <FieldError message={errors.endTime} />}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={updateBlock.isPending}
          className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {updateBlock.isPending ? 'Saving…' : 'Save'}
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

function BlockRow({ block }: { block: FixedBlock }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const deleteBlock = useMutation({
    mutationFn: api.blocks.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocks'] }),
  });

  function handleDelete() {
    if (!deleteArmed) {
      setDeleteArmed(true);
      setTimeout(() => setDeleteArmed(false), 3000);
      return;
    }
    deleteBlock.mutate(block.id);
  }

  if (editing) {
    return <BlockEditRow block={block} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="bg-white rounded-xl shadow px-4 py-3 flex justify-between items-center">
      <div>
        <span className="font-medium text-gray-800">{block.name}</span>
        <span className="text-sm text-gray-500 ml-2">
          {DAY_NAMES[block.dayOfWeek]} {formatTimeRange12h(block.startTime, block.endTime)}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => setEditing(true)}
          className="text-gray-300 hover:text-indigo-500 transition text-sm px-1 py-0.5"
          title="Edit block"
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
          title={deleteArmed ? 'Click again to confirm deletion' : 'Delete block'}
        >
          {deleteArmed ? 'Sure?' : '×'}
        </button>
      </div>
    </div>
  );
}

export function FixedBlockForm() {
  const qc = useQueryClient();
  const { data: blocks } = useBlocks();
  const createBlock = useMutation({
    mutationFn: api.blocks.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocks'] }),
  });

  const [form, setForm] = useState(EMPTY_BLOCK);
  const [selectedDays, setSelectedDays] = useState<number[]>([1]);
  const [touched, setTouched] = useState<Partial<Record<keyof BlockErrors, boolean>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const errors: BlockErrors = {
    ...validateBlock(form),
    ...(selectedDays.length === 0 ? { days: 'Select at least one day.' } : {}),
  };
  const hasErrors = Object.keys(errors).length > 0;

  function touch(field: keyof BlockErrors) {
    setTouched((t) => ({ ...t, [field]: true }));
  }

  function toggleDay(day: number) {
    setSelectedDays((days) =>
      days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort()
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ name: true, startTime: true, endTime: true, days: true });
    if (hasErrors) return;
    setSubmitError(null);
    try {
      await Promise.all(
        selectedDays.map((dayOfWeek) => createBlock.mutateAsync({ ...form, dayOfWeek }))
      );
      setForm(EMPTY_BLOCK);
      setSelectedDays([1]);
      setTouched({});
    } catch (err) {
      setSubmitError((err as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-5 space-y-3">
        <h2 className="font-semibold text-lg text-gray-800">Add Fixed Block</h2>

        {submitError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {submitError}
          </p>
        )}

        <div>
          <input
            className={`w-full ${blockInputClass('name', touched, errors)}`}
            placeholder="Name (e.g. Work)"
            value={form.name}
            maxLength={100}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            onBlur={() => touch('name')}
          />
          {touched.name && <FieldError message={errors.name} />}
        </div>

        <div>
          <label className="block text-sm text-gray-600 mb-1">Day(s)</label>
          <div className="grid grid-cols-7 gap-1">
            {DAY_ABBR.map((abbr, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                className={`py-2 rounded-lg text-xs font-medium border transition ${
                  selectedDays.includes(i)
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {abbr}
              </button>
            ))}
          </div>
          {touched.days && <FieldError message={errors.days} />}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <input
              type="time"
              className={`w-full min-w-0 ${blockInputClass('startTime', touched, errors)}`}
              value={form.startTime}
              onChange={(e) => setForm({ ...form, startTime: e.target.value })}
              onBlur={() => touch('startTime')}
            />
            {touched.startTime && <FieldError message={errors.startTime} />}
          </div>
          <div>
            <input
              type="time"
              className={`w-full min-w-0 ${blockInputClass('endTime', touched, errors)}`}
              value={form.endTime}
              onChange={(e) => setForm({ ...form, endTime: e.target.value })}
              onBlur={() => touch('endTime')}
            />
            {touched.endTime && <FieldError message={errors.endTime} />}
          </div>
        </div>
        <button
          type="submit"
          disabled={createBlock.isPending}
          className="w-full bg-indigo-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
        >
          {createBlock.isPending
            ? 'Adding…'
            : selectedDays.length > 1
              ? `Add Block (${selectedDays.length} days)`
              : 'Add Block'}
        </button>
      </form>

      {blocks && blocks.length > 0 && (
        <div className="space-y-2">
          {blocks.map((block) => (
            <BlockRow key={block.id} block={block} />
          ))}
        </div>
      )}
    </div>
  );
}
