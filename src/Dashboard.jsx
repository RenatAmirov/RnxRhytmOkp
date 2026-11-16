import React, { useEffect, useRef, useState } from 'react';
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, CircleAlert, ClipboardList, Factory, Plus } from 'lucide-react';
import { addDays, Button, date, Empty, number, PageHeading, Progress, rangeLabel, Segmented, Trend } from './ui.jsx';
import { OrdersTable } from './Orders.jsx';

const periods = [[7, '7 дней'], [14, '14 дней'], [30, '30 дней']];
const sampleHistory = (history, end, days) => Array.from({ length: days }, (_, i) => {
  const day = addDays(end, i - days + 1);
  return history.get(day) ?? { date: day, plan: 0, actual: 0 };
});
const sum = (data, key) => data.reduce((total, entry) => total + entry[key], 0);
const achievement = data => sum(data, 'plan') ? Math.round(100 * sum(data, 'actual') / sum(data, 'plan')) : null;

function Kpi({ icon: Icon, color, label, value, foot, note, onClick }) {
  return <button className={'kpi card kpi-' + color} onClick={onClick}>
    <span className="kpi-top"><span>{label}</span><span className={'kpi-icon ' + color}><Icon size={19} strokeWidth={1.8} /></span></span>
    <strong>{value}</strong>
    <span className="kpi-footer">{foot}<span>{note}</span></span>
  </button>;
}

function line(ctx, points) {
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    const point = points[i];
    const previous = points[i - 1];
    const middle = (previous.x + point.x) / 2;
    ctx.bezierCurveTo(middle, previous.y, middle, point.y, point.x, point.y);
  }
}

function ThroughputChart({ entries }) {
  const canvas = useRef(null);
  const parent = useRef(null);
  const chart = useRef(null);
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    const node = canvas.current;
    function paint() {
      if (!node) return;
      const width = parent.current.clientWidth;
      const height = parent.current.clientHeight;
      if (width === 0 || height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      node.width = Math.round(width * dpr);
      node.height = Math.round(height * dpr);
      const ctx = node.getContext('2d');
      ctx.scale(dpr, dpr);
      ctx.font = '11px "Inter Variable", sans-serif';
      const left = 38, right = width - 26, top = 14, bottom = height - 30;
      const peak = Math.max(100, ...entries.flatMap(entry => [entry.actual, entry.plan]));
      const unit = Math.pow(10, Math.floor(Math.log10(peak / 4)));
      const step = Math.ceil(peak / 4 / unit) * unit;
      const y = value => bottom - value * (bottom - top) / (step * 4);
      const x = i => left + i * (right - left) / (entries.length - 1);
      ctx.fillStyle = '#788198';
      ctx.strokeStyle = '#ebedf5';
      for (let row = 0; row <= 4; row++) {
        const py = y(row * step);
        ctx.beginPath();
        ctx.moveTo(left, py + 0.5);
        ctx.lineTo(right, py + 0.5);
        ctx.stroke();
        ctx.textAlign = 'right';
        ctx.fillText(String(row * step), left - 12, py + 4);
      }
      const stride = Math.ceil((entries.length - 1) / (width < 450 ? 4 : 6));
      ctx.textAlign = 'center';
      for (let i = 0; i < entries.length; i++) {
        if (i !== 0 && i !== entries.length - 1 && (i % stride !== 0 || entries.length - 1 - i < stride / 2)) continue;
        ctx.fillText(date(entries[i].date).replace('.', ''), x(i), height - 8);
      }
      const fact = entries.map((entry, i) => ({ x: x(i), y: y(entry.actual) }));
      const plan = entries.map((entry, i) => ({ x: x(i), y: y(entry.plan) }));
      const fill = ctx.createLinearGradient(0, top, 0, bottom);
      fill.addColorStop(0, 'rgba(111, 86, 232, 0.20)');
      fill.addColorStop(1, 'rgba(111, 86, 232, 0.015)');
      ctx.fillStyle = fill;
      ctx.beginPath();
      line(ctx, fact);
      ctx.lineTo(right, bottom);
      ctx.lineTo(left, bottom);
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#a6a8c8';
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      line(ctx, plan);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 2.6;
      ctx.strokeStyle = '#7157e8';
      ctx.beginPath();
      line(ctx, fact);
      ctx.stroke();
      const index = selected ?? entries.length - 1;
      if (selected !== null) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#b6a8f8';
        ctx.beginPath();
        ctx.moveTo(x(index), top);
        ctx.lineTo(x(index), bottom);
        ctx.stroke();
      }
      ctx.lineWidth = 2.5;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#7157e8';
      ctx.beginPath();
      ctx.arc(fact[index].x, fact[index].y, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      chart.current = { left, right, width };
    }
    paint();
    const observer = new ResizeObserver(paint);
    observer.observe(parent.current);
    document.fonts?.ready.then(paint);
    return () => observer.disconnect();
  }, [entries, selected]);
  const point = selected === null ? null : entries[selected];
  return <div className="chart-wrap" ref={parent}>
    <canvas
      ref={canvas} tabIndex={0} role="img"
      aria-label={'График выпуска. ' + entries.map(entry => date(entry.date) + ' — факт ' + entry.actual + ', план ' + entry.plan).join('; ')}
      onPointerMove={event => {
        if (!chart.current) return;
        const { left, right } = chart.current;
        const x = event.clientX - event.currentTarget.getBoundingClientRect().left;
        setSelected(Math.max(0, Math.min(entries.length - 1, Math.round((x - left) / (right - left) * (entries.length - 1)))));
      }}
      onPointerLeave={() => setSelected(null)}
      onBlur={() => setSelected(null)}
      onKeyDown={event => {
        if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        setSelected(value => Math.max(0, Math.min(entries.length - 1, (value ?? 0) + (event.key === 'ArrowLeft' ? -1 : 1))));
      }}
    />
    {point && <div className="chart-tooltip" style={{ left: Math.min(chart.current.width - 134, Math.max(4, chart.current.left + selected * (chart.current.right - chart.current.left) / (entries.length - 1) + 12)) }}>
      <strong>{date(point.date, { day: 'numeric', month: 'long' })}</strong>
      <span><i />Факт <b>{number(point.actual)} шт.</b></span>
      <span><i />План <b>{number(point.plan)} шт.</b></span>
    </div>}
  </div>;
}

export default function Dashboard({ workspace, navigate, newOrder, openOrder, editOrder, orderMenu }) {
  const [period, setPeriod] = useState(7);
  const [periodMenu, setPeriodMenu] = useState(false);
  const history = new Map(workspace.history.map(entry => [entry.date, entry]));
  const entries = sampleHistory(history, workspace.today, period);
  const performance = achievement(entries);
  const previous = achievement(sampleHistory(history, addDays(workspace.today, -period), period));
  const activeOrders = workspace.orders.filter(order => order.status === 'active').length;
  const openOrders = workspace.orders.filter(order => order.status !== 'done').length;
  const overdue = workspace.orders.filter(order => order.overdue).length;
  const risk = workspace.orders.filter(order => order.risk && !order.overdue).length;
  const capacity = sum(workspace.centers, 'capacity');
  const load = capacity ? Math.round(100 * sum(workspace.centers, 'plannedHours') / capacity) + '%' : '—';
  const recent = workspace.orders.slice(0, 5);
  const topCenters = workspace.centers.toSorted((a, b) => b.load - a.load).slice(0, 4);

  return <>
    <PageHeading title="Обзор производства" subtitle="Оперативная сводка по заказам, выпуску и загрузке оборудования">
      <div className="popover-anchor" onBlur={event => !event.currentTarget.contains(event.relatedTarget) && setPeriodMenu(false)}>
        <Button icon={CalendarDays} aria-expanded={periodMenu} onClick={() => setPeriodMenu(value => !value)}>
          {rangeLabel(entries[0].date, workspace.today)}<ChevronDown className="muted" size={14} />
        </Button>
        {periodMenu && <div className="popover period-menu">{periods.map(([key, label]) => <button key={key} onClick={() => { setPeriod(key); setPeriodMenu(false); }}><CalendarDays size={15} />{label}</button>)}</div>}
      </div>
      <Button kind="primary" icon={Plus} onClick={newOrder}>Новый заказ</Button>
    </PageHeading>

    <div className="kpi-grid">
      <Kpi icon={ClipboardList} color="violet" label="Открытые заказы" value={number(openOrders)}
        foot={<span className="kpi-tag violet">{activeOrders} в работе</span>}
        note={openOrders - activeOrders + ' к запуску'} onClick={() => navigate('orders', 'open')} />
      <Kpi icon={Activity} color="teal" label="Выполнение плана" value={performance === null ? '—' : performance + '%'}
        foot={performance === null || previous === null ? null : <Trend value={performance - previous} />}
        note="к предыдущему периоду" onClick={() => navigate('planning')} />
      <Kpi icon={Factory} color="blue" label="Загрузка мощностей" value={load}
        foot={<span className="kpi-tag blue">{workspace.centers.length} центров</span>}
        note="на ближайшие 7 дней" onClick={() => navigate('directory', 'centers')} />
      <Kpi icon={CircleAlert} color="orange" label="Требуют внимания" value={number(risk + overdue)}
        foot={<span className="kpi-tag orange">{overdue} просрочено</span>}
        note={risk ? risk + ' с риском срыва' : 'сроки остальных в норме'} onClick={() => navigate('orders', 'risk')} />
    </div>

    <div className="dashboard-grid">
      <section className="card chart-card">
        <div className="section-heading"><div><h2>Динамика выпуска</h2><p>План и факт по готовым изделиям, шт.</p></div>
          <Segmented options={periods} value={period} onChange={setPeriod} label="Период графика" />
        </div>
        <div className="chart-legend"><span><i />Факт</span><span><i />План</span></div>
        <ThroughputChart key={period} entries={entries} />
      </section>
      <section className="card load-card">
        <div className="section-heading"><div><h2>Загрузка ресурсов</h2><p>Рабочие центры · ближайшие 7 дней</p></div>
          <button className="corner-link" aria-label="Открыть рабочие центры" onClick={() => navigate('directory', 'centers')}><ArrowUpRight size={18} /></button>
        </div>
        {topCenters.length > 0 ? <div className="load-list">{topCenters.map(center => <div className="load-entry" key={center.id}>
          <div><span>{center.name}</span><strong className={center.load >= 90 ? 'warning-text' : ''}>{center.load}%</strong></div>
          <Progress value={center.load} tone={center.load >= 90 ? 'orange' : center.color} />
        </div>)}</div> : <Empty icon={Factory} title="Добавьте рабочие центры" />}
        <button className="text-link load-more" onClick={() => navigate('directory', 'centers')}>Все рабочие центры <ArrowRight size={15} /></button>
      </section>
    </div>

    <section className="card order-card">
      <div className="section-heading"><div><h2>Последние заказы</h2><p>Текущий статус производственных заказов</p></div>
        <Button onClick={() => navigate('orders')}>Все заказы <ArrowRight size={15} /></Button>
      </div>
      <OrdersTable orders={recent} workspace={workspace} openOrder={openOrder} editOrder={editOrder} orderMenu={orderMenu} />
    </section>
  </>;
}
