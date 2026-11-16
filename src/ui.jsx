import React, { useEffect, useRef } from 'react';
import { ArrowDownRight, ArrowUpRight, Check, Search, X } from 'lucide-react';

export const number = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
export const date = (value, options = { day: 'numeric', month: 'short' }) =>
  value ? new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Samara', ...options }).format(new Date(value.length === 10 ? value + 'T12:00:00Z' : value)) : '—';
export const localDate = value => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Samara' }).format(new Date(value));
export function addDays(value, amount) {
  const day = new Date(value + 'T12:00:00Z');
  day.setUTCDate(day.getUTCDate() + amount);
  return day.toISOString().slice(0, 10);
}
export function rangeLabel(from, to) {
  if (from === to) return date(to, { day: 'numeric', month: 'long', year: 'numeric' }).replace(' г.', '');
  const start = from.slice(0, 7) === to.slice(0, 7) ? Number(from.slice(-2)) : date(from, { day: 'numeric', month: 'long' });
  return start + ' – ' + date(to, { day: 'numeric', month: 'long', year: 'numeric' }).replace(' г.', '');
}

export const priorityLabels = { high: 'Высокий', normal: 'Обычный', low: 'Низкий' };
export const statusLabels = { active: 'В работе', planned: 'Запланирован', done: 'Завершён', overdue: 'Просрочен' };
export function Status({ order }) {
  const state = order.overdue ? 'overdue' : order.status;
  return <span className={'badge ' + state}><i />{statusLabels[state]}</span>;
}

export function Button({ children, icon: Icon, kind = 'secondary', className = '', ...props }) {
  return <button className={'button ' + kind + ' ' + className} {...props}>{Icon && <Icon size={16} strokeWidth={1.9} />}{children}</button>;
}

export function IconButton({ icon: Icon, label, className = '', ...props }) {
  return <button className={'icon-button ' + className} aria-label={label} title={label} {...props}><Icon size={19} strokeWidth={1.75} /></button>;
}

export function PageHeading({ title, subtitle, children }) {
  return <div className="page-heading"><div><h1>{title}</h1><p>{subtitle}</p></div>{children && <div className="page-actions">{children}</div>}</div>;
}

export function SearchInput({ value, onChange, placeholder = 'Поиск', autoFocus = false }) {
  return <label className="search-input"><Search size={17} /><input aria-label={placeholder} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} autoFocus={autoFocus} />{value && <IconButton icon={X} label="Очистить поиск" onClick={() => onChange('')} />}</label>;
}

export function Segmented({ options, value, onChange, label }) {
  return <div className="segmented" role="group" aria-label={label}>{options.map(([key, text]) =>
    <button key={key} aria-pressed={value === key} className={value === key ? 'selected' : ''} onClick={() => onChange(key)}>{text}</button>
  )}</div>;
}

export function Progress({ value, tone = 'violet' }) {
  return <span className={'progress-track ' + tone} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}><span style={{ width: Math.min(100, value) + '%' }} /></span>;
}

export function Empty({ icon: Icon = Search, title = 'Ничего не найдено', detail }) {
  return <div className="empty"><span><Icon size={24} strokeWidth={1.6} /></span><strong>{title}</strong>{detail && <p>{detail}</p>}</div>;
}

export function ErrorMessage({ children }) {
  return children ? <p className="form-error" role="alert">{children}</p> : null;
}

export function Trend({ value, suffix = ' п. п.' }) {
  const Icon = value < 0 ? ArrowDownRight : ArrowUpRight;
  return <span className={'trend ' + (value < 0 ? 'down' : '')}><Icon size={13} />{value > 0 ? '+' : ''}{value}{suffix}</span>;
}

export function Overlay({ title, description, onClose, children, drawer = false, className = '' }) {
  const container = useRef(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const before = document.activeElement;
    const focusable = () => [...(container.current?.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? [])];
    const frame = requestAnimationFrame(() => {
      const first = container.current?.querySelector('[autofocus], input:not(:disabled), select:not(:disabled)') ?? focusable()[0];
      first?.focus();
    });
    function keys(event) {
      if (event.key === 'Escape') { event.preventDefault(); close.current(); }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items.at(-1).focus(); }
      if (!event.shiftKey && document.activeElement === items.at(-1)) { event.preventDefault(); items[0].focus(); }
    }
    document.addEventListener('keydown', keys);
    document.body.classList.add('overlay-open');
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', keys);
      document.body.classList.remove('overlay-open');
      if (before?.isConnected) before.focus();
    };
  }, []);
  return <div className={'overlay ' + (drawer ? 'drawer-overlay' : '')} onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section ref={container} className={(drawer ? 'drawer ' : 'modal ') + className} role="dialog" aria-modal="true" aria-label={title}>
      <div className="overlay-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div><IconButton icon={X} label="Закрыть" onClick={onClose} /></div>
      {children}
    </section>
  </div>;
}

export function Toast({ text, clear }) {
  useEffect(() => {
    if (!text) return;
    const timeout = setTimeout(clear, 3500);
    return () => clearTimeout(timeout);
  }, [text]);
  return text ? <div className="toast" role="status"><span><Check size={18} /></span>{text}<IconButton icon={X} label="Закрыть уведомление" onClick={clear} /></div> : null;
}
