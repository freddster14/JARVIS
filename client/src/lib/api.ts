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

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`);
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
    create: (data: Omit<FixedBlock, 'id'>) =>
      request<FixedBlock>('/api/blocks', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Omit<FixedBlock, 'id'>>) =>
      request<FixedBlock>(`/api/blocks/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id: string) =>
      request<void>(`/api/blocks/${id}`, { method: 'DELETE' }),
  },

  schedule: {
    get: (weekStart: string) => request<ScheduleItem[]>(`/api/schedule?weekStart=${weekStart}`),
    updateStatus: (id: string, status: ScheduleItem['status']) =>
      request<ScheduleItem>(`/api/schedule/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
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
      request('/api/wake/confirm', { method: 'POST', body: JSON.stringify({ time }) }),
    getProfile: () => request<UserProfile>('/api/wake/profile'),
    updateProfile: (data: Partial<Omit<UserProfile, 'id'>>) =>
      request<UserProfile>('/api/wake/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  },

  ai: {
    generateSchedule: (weekStart?: string) =>
      request<{ created: number; weekStart: string }>('/api/ai/generate-schedule', {
        method: 'POST',
        body: JSON.stringify({ weekStart }),
      }),
  },
};
