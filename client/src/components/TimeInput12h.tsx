import { useMemo } from 'react';

interface Props {
  /** 24h "HH:MM" string, same value contract as a native input[type=time]. */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  className?: string;
  invalid?: boolean;
}

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function parse(value: string): { hour12: number; minute: number; period: 'AM' | 'PM' } {
  const [hStr, mStr] = value.split(':');
  const h24 = Number(hStr) || 0;
  const minute = Number(mStr) || 0;
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  const hour12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return { hour12, minute, period };
}

function toValue(hour12: number, minute: number, period: 'AM' | 'PM'): string {
  const h24 = (hour12 % 12) + (period === 'PM' ? 12 : 0);
  return `${String(h24).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/** Three-dropdown 12h AM/PM time picker — avoids native input[type=time], whose
 *  displayed format follows OS locale (often 24h) regardless of page markup. */
export function TimeInput12h({ value, onChange, onBlur, onKeyDown, className = '', invalid }: Props) {
  const { hour12, minute, period } = useMemo(() => parse(value || '09:00'), [value]);

  const selectClass = `border rounded-lg px-1.5 py-2 text-sm focus:outline-none focus:ring-2 transition bg-white ${
    invalid ? 'border-red-300 focus:ring-red-300' : 'focus:ring-indigo-400'
  }`;

  return (
    <div className={`flex gap-1 ${className}`} onBlur={onBlur} onKeyDown={onKeyDown}>
      <select
        aria-label="Hour"
        className={`${selectClass} flex-1 min-w-0`}
        value={hour12}
        onChange={(e) => onChange(toValue(Number(e.target.value), minute, period))}
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>{h}</option>
        ))}
      </select>
      <select
        aria-label="Minute"
        className={`${selectClass} flex-1 min-w-0`}
        value={minute}
        onChange={(e) => onChange(toValue(hour12, Number(e.target.value), period))}
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
        ))}
      </select>
      <select
        aria-label="AM or PM"
        className={`${selectClass} flex-shrink-0`}
        value={period}
        onChange={(e) => onChange(toValue(hour12, minute, e.target.value as 'AM' | 'PM'))}
      >
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
