/** Formats a 24h "HH:MM" string as 12h with AM/PM, e.g. "14:00" -> "2:00 PM". */
export function formatTime12h(time: string): string {
  const [hStr, mStr] = time.split(':');
  const h24 = Number(hStr);
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mStr} ${period}`;
}

export function formatTimeRange12h(start: string, end: string): string {
  return `${formatTime12h(start)}–${formatTime12h(end)}`;
}

/** Formats a minute count as "1h 15m", "45m", or "2h", e.g. for focus-time totals. */
export function formatDurationShort(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
