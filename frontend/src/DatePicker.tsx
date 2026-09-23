import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (s: string, n: number) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
const monthTitle = (d: Date) => d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '');

interface Props { value: string; min: string; max: string; onChange: (value: string) => void; }

/** Календарь в фирменном стиле вместо системного <input type="date">. */
export function DatePicker({ value, min, max, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => parse(value));
  const [focused, setFocused] = useState(value);
  const root = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);

  useEffect(() => { if (open) { setView(parse(value)); setFocused(value); } }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => { if (open) grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focused}"]`)?.focus(); }, [open, focused, view]);

  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - ((first.getDay() + 6) % 7)); // понедельник первой недели
  const days = Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  const canPrev = iso(new Date(view.getFullYear(), view.getMonth(), 0)) >= min;
  const canNext = iso(new Date(view.getFullYear(), view.getMonth() + 1, 1)) <= max;

  const moveFocus = (next: string) => {
    if (next < min || next > max) return;
    setFocused(next);
    const d = parse(next);
    if (d.getMonth() !== view.getMonth()) setView(new Date(d.getFullYear(), d.getMonth(), 1));
  };

  const pick = (day: string) => { onChange(day); setOpen(false); };

  const onKey = (e: KeyboardEvent) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key in step) { e.preventDefault(); moveFocus(addDays(focused, step[e.key])); }
    else if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); }
  };

  const label = parse(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }).replace(' г.', '');

  return <div className="datepicker" ref={root}>
    <button type="button" className="datepicker-trigger" aria-haspopup="dialog" aria-expanded={open} aria-label={`Дата события: ${label}`} onClick={() => setOpen(o => !o)}>
      <CalendarDays size={15} /><span>{label}</span>
    </button>
    {open && <div className="datepicker-popover" role="dialog" aria-label="Выбор даты" onKeyDown={onKey}>
      <div className="datepicker-head">
        <button type="button" className="datepicker-nav" aria-label="Предыдущий месяц" disabled={!canPrev} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() - 1, 1))}><ChevronLeft size={16} /></button>
        <strong>{monthTitle(view)}</strong>
        <button type="button" className="datepicker-nav" aria-label="Следующий месяц" disabled={!canNext} onClick={() => setView(new Date(view.getFullYear(), view.getMonth() + 1, 1))}><ChevronRight size={16} /></button>
      </div>
      <div className="datepicker-grid" role="grid" ref={grid}>
        {WEEKDAYS.map((w, i) => <span key={w} className={i > 4 ? 'datepicker-weekday weekend' : 'datepicker-weekday'} role="columnheader">{w}</span>)}
        {days.map(d => {
          const day = iso(d);
          const outside = d.getMonth() !== view.getMonth();
          const disabled = day < min || day > max;
          const cls = ['datepicker-day', outside && 'outside', day === value && 'selected', d.getDay() % 6 === 0 && 'weekend'].filter(Boolean).join(' ');
          return <button key={day} type="button" data-day={day} className={cls} disabled={disabled} tabIndex={day === focused ? 0 : -1}
            aria-selected={day === value} aria-label={d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'long' })}
            onClick={() => pick(day)}>{d.getDate()}</button>;
        })}
      </div>
      <p className="datepicker-foot">Доступны даты с {parse(min).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} по {parse(max).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</p>
    </div>}
  </div>;
}
