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
