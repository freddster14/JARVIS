self.addEventListener('push', (event) => {
  if (!event.data) return;
  const payload = event.data.json();

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'JARVIS', {
      body: payload.body,
      tag: payload.tag,
      data: payload.data,
      actions: payload.actions ?? [],
      icon: '/favicon.ico',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data ?? {};
  const action = event.action;

  if (data.action === 'weekly_review') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        if (clientList.length > 0) {
          clientList[0].focus();
        } else {
          clients.openWindow('/insights');
        }
      })
    );
    return;
  }

  if (data.action === 'morning_ping' && action === 'awake') {
    event.waitUntil(
      fetch('/api/wake/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    );
    return;
  }

  if (data.scheduleItemId && (action === 'done' || action === 'skip')) {
    const status = action === 'done' ? 'done' : 'skipped';
    event.waitUntil(
      fetch(`/api/schedule/${data.scheduleItemId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
    );
    return;
  }

  if (data.focusSessionId && action === 'focus_snooze') {
    event.waitUntil(fetch(`/api/focus/${data.focusSessionId}/snooze`, { method: 'POST' }));
    return;
  }

  if (data.focusSessionId && action === 'focus_advance') {
    event.waitUntil(fetch(`/api/focus/${data.focusSessionId}/advance`, { method: 'POST' }));
    return;
  }

  if (data.action === 'focus_needs_resolution' || data.action === 'focus_phase_end') {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        if (clientList.length > 0) {
          clientList[0].focus();
        } else {
          clients.openWindow('/');
        }
      })
    );
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        clientList[0].focus();
      } else {
        clients.openWindow('/');
      }
    })
  );
});
