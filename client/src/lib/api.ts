export interface Task {
  id: string;
  name: string;
  durationMin: number;
  priority: number;
  category: string | null;
  weeklyGoal: number;
  createdAt: string;
}

export interface FixedBlock {
  id: string;
  name: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  recurring: boolean;
  /** Set only when recurring is false: the single date this one-off block applies to (YYYY-MM-DD). */
  date: string | null;
  /** Dates (YYYY-MM-DD) this normally-recurring block does NOT apply on. */
  exceptions: string[];
}

export interface ScheduleItem {
  id: string;
  taskId: string;
  task: Task;
  date: string;
  startTime: string;
  endTime: string;
  status: 'pending' | 'done' | 'skipped' | 'rescheduled';
  notifiedAt: string | null;
}

export interface UserProfile {
  id: string;
  wakeUpMode: 'fixed' | 'dynamic';
  fixedWakeTime: string | null;
  morningPingTime: string | null;
  fallbackWakeTime: string | null;
}

export interface TaskProgress {
  taskId: string;
  name: string;
  category: string | null;
  priority: number;
  weeklyGoal: number;
  scheduled: number;
  completed: number;
  skipped: number;
  pending: number;
  goalMet: boolean;
  completionRate: number;
}

export interface WeekProgress {
  weekStart: string;
  overall: {
    totalScheduled: number;
    totalCompleted: number;
    totalSkipped: number;
    totalPending: number;
    completionRate: number;
    goalsMet: number;
    totalGoals: number;
  };
  tasks: TaskProgress[];
}

export interface WakeLog {
  id: string;
  date: string;
  wakeTime: string;
  source: string;
}

export interface TodayStats {
  date: string;
  done: number;
  pending: number;
  skipped: number;
  streak: number;
}

export interface WeeklyReview {
  headline: string;
  summary: string;
  wins: string[];
  focus: string[];
}

export interface WeekCapacity {
  requiredMinutes: number;
  freeMinutes: number;
  overCommitted: boolean;
}

export interface TipAction {
  scheduleItemId: string;
  date: string;
  startTime: string;
  endTime: string;
}

export interface Tip {
  id: string;
  weekStart: string;
  text: string;
  actions: TipAction[] | null;
  status: 'unread' | 'acknowledged';
  createdAt: string;
}

export interface TipRecheckResult {
  stillApplicable: boolean;
  explanation: string;
  actions: TipAction[];
}

export interface HistoryWeek {
  weekStart: string;
  scheduled: number;
  completed: number;
  skipped: number;
  completionRate: number;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as {
      error?: string;
      errors?: Array<{ path: string; msg: string }>;
    };
    // express-validator returns { errors: [...] }; surface the first message
    const message =
      body.error ??
      (body.errors?.length ? body.errors[0].msg : undefined) ??
      `HTTP ${res.status}`;
    throw new Error(message);
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export const api = {
  tasks: {
    list: () => request<Task[]>('/api/tasks'),
    create: (data: Omit<Task, 'id' | 'createdAt'>) =>
      request<Task>('/api/tasks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Omit<Task, 'id' | 'createdAt'>>) =>
      request<Task>(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/api/tasks/${id}`, { method: 'DELETE' }),
  },

  blocks: {
    list: () => request<FixedBlock[]>('/api/blocks'),
    create: (data: Omit<FixedBlock, 'id' | 'exceptions'>) =>
      request<FixedBlock>('/api/blocks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Omit<FixedBlock, 'id' | 'exceptions'>>) =>
      request<FixedBlock>(`/api/blocks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/api/blocks/${id}`, { method: 'DELETE' }),
    skip: (id: string, date: string) =>
      request<void>(`/api/blocks/${id}/skip`, { method: 'POST', body: JSON.stringify({ date }) }),
    unskip: (id: string, date: string) =>
      request<void>(`/api/blocks/${id}/skip`, { method: 'DELETE', body: JSON.stringify({ date }) }),
  },

  schedule: {
    get: (weekStart: string) => request<ScheduleItem[]>(`/api/schedule?weekStart=${weekStart}`),
    updateStatus: (id: string, status: ScheduleItem['status']) =>
      request<ScheduleItem>(`/api/schedule/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      }),
    reschedule: (id: string, data: { date: string; startTime: string; endTime: string }) =>
      request<ScheduleItem>(`/api/schedule/${id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    clearWeek: (weekStart: string, force = false) =>
      request<{ deleted: number; weekStart: string; force: boolean }>('/api/schedule/week', {
        method: 'DELETE',
        body: JSON.stringify({ weekStart, force }),
      }),
  },

  push: {
    getVapidKey: () => request<{ publicKey: string }>('/api/push/vapid-key'),
    subscribe: (sub: PushSubscriptionJSON) =>
      request('/api/push/subscribe', { method: 'POST', body: JSON.stringify(sub) }),
    unsubscribe: (endpoint: string) =>
      request('/api/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
  },

  wake: {
    confirm: (time?: string) =>
      request<WakeLog>('/api/wake/confirm', { method: 'POST', body: JSON.stringify({ time }) }),
    getLog: () => request<WakeLog[]>('/api/wake/log'),
    getProfile: () => request<UserProfile>('/api/wake/profile'),
    updateProfile: (data: Partial<Omit<UserProfile, 'id'>>) =>
      request<UserProfile>('/api/wake/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  },

  ai: {
    generateSchedule: (weekStart?: string, force?: boolean) =>
      request<{
        created?: number;
        weekStart: string;
        capacity: WeekCapacity;
        needsConfirmation?: boolean;
        tip?: string;
        tipId?: string;
        tipActions?: TipAction[];
      }>('/api/ai/generate-schedule', {
        method: 'POST',
        body: JSON.stringify({ weekStart, force }),
      }),
    weeklyReview: (weekStart?: string) =>
      request<{ weekStart: string; review: WeeklyReview }>('/api/ai/weekly-review', {
        method: 'POST',
        body: JSON.stringify({ weekStart }),
      }),
  },

  stats: {
    today: () => request<TodayStats>('/api/stats/today'),
    week: (weekStart: string) => request<WeekProgress>(`/api/stats/week?weekStart=${weekStart}`),
    history: (weeks = 8) => request<{ weeks: number; history: HistoryWeek[] }>(`/api/stats/history?weeks=${weeks}`),
  },

  tips: {
    list: (status?: 'unread' | 'acknowledged') =>
      request<Tip[]>(`/api/tips${status ? `?status=${status}` : ''}`),
    acknowledge: (id: string) =>
      request<Tip>(`/api/tips/${id}/acknowledge`, { method: 'PATCH' }),
    apply: (id: string) =>
      request<{ applied: number; skipped: number; details: string[] }>(`/api/tips/${id}/apply`, { method: 'POST' }),
    recheck: (id: string) =>
      request<TipRecheckResult>(`/api/tips/${id}/recheck`, { method: 'POST' }),
    delete: (id: string) =>
      request<void>(`/api/tips/${id}`, { method: 'DELETE' }),
  },
};
