import React, { useState } from 'react';
import { ArrowDownLeft, CalendarDays, ChevronLeft, ChevronRight, ClipboardCheck, Factory, Package, Pencil, Play, Plus, RotateCw, SlidersHorizontal } from 'lucide-react';
import { addDays, Button, date, Empty, IconButton, localDate, number, Overlay, PageHeading, Progress, rangeLabel, SearchInput, Segmented } from './ui.jsx';

const minutes = value => String(Math.floor(value / 60)).padStart(2, '0') + ':' + String(value % 60).padStart(2, '0');
const weekend = value => [0, 6].includes(new Date(value + 'T12:00:00Z').getUTCDay());

function shiftTime(plan, selected) {
  const segments = selected ? plan?.segments.filter(segment => segment.date === selected) : plan?.segments.slice(0, 1);
  if (!segments?.length) return '—';
  const intervals = segments.map(segment => minutes(segment.start) + '–' + minutes(segment.end)).join(', ');
  return selected ? intervals : date(segments[0].date) + ' · ' + intervals;
}

export function Planning({ workspace, openOrder, openPlan }) {
  const [week, setWeek] = useState(0);
  const [centerId, setCenterId] = useState('all');
  const days = Array.from({ length: 7 }, (_, index) => addDays(workspace.planDate, index + week * 7));
  const centers = workspace.centers.filter(center => centerId === 'all' || center.id === centerId);
  const orders = new Map(workspace.orders.map(order => [order.id, order]));
  const planned = workspace.schedule.filter(operation => operation.start <= days.at(-1) && operation.end >= days[0]);
  const risk = workspace.orders.filter(order => order.risk).toSorted((a, b) => a.due.localeCompare(b.due));
  return <>
    <PageHeading title="Календарный план" subtitle="Расписание операций по рабочим центрам и сменам">
      <Button kind="primary" icon={RotateCw} onClick={openPlan}>Пересчитать план</Button>
    </PageHeading>
    <section className="card plan-card">
      <div className="section-heading"><div><h2>Диаграмма Ганта</h2><p>Смена с 08:00 по самарскому времени</p></div>
        <div className="page-actions">
          <label className="select-wrap"><SlidersHorizontal size={16} /><select aria-label="Рабочий центр" value={centerId} onChange={event => setCenterId(event.target.value)}>
            <option value="all">Все рабочие центры</option>{workspace.centers.map(center => <option value={center.id} key={center.id}>{center.name}</option>)}
          </select></label>
          <div className="calendar-navigation"><IconButton icon={ChevronLeft} label="Предыдущая неделя" onClick={() => setWeek(value => value - 1)} disabled={!week} />
            <button title="Вернуться к началу плана" onClick={() => setWeek(0)}>{rangeLabel(days[0], days.at(-1))}</button>
            <IconButton icon={ChevronRight} label="Следующая неделя" onClick={() => setWeek(value => value + 1)} />
          </div>
        </div>
      </div>
      <div className="gantt-scroll"><div className="gantt">
        <div className="gantt-line gantt-head"><div>Рабочий центр</div>{days.map(day => <div className={(weekend(day) ? 'weekend ' : '') + (day === workspace.today ? 'today' : '')} key={day}>
          <strong>{date(day)}</strong><span>{date(day, { weekday: 'short' })}</span>
        </div>)}</div>
        {centers.map(center => <div className="gantt-line" key={center.id}>
          <div className="gantt-resource"><span className={'resource-symbol ' + center.color}><Factory size={16} /></span><span><strong>{center.name}</strong><small>{center.code} · {center.hours} ч/смена</small></span></div>
          {days.map(day => <div className={'gantt-shift ' + (weekend(day) ? 'weekend ' : '') + (day === workspace.today ? 'today' : '')} key={day}>
            {planned.filter(operation => operation.centerId === center.id).flatMap(operation => operation.segments.filter(segment => segment.date === day).map(segment => {
              const order = orders.get(operation.orderId);
              const duration = segment.end - segment.start;
              return <button key={operation.id + '-' + segment.start} className={'gantt-block ' + (order.risk ? 'orange' : 'violet')}
                aria-label={order.number + ' ' + operation.name}
                title={order.number + ' · ' + operation.name + ' · ' + minutes(segment.start) + '–' + minutes(segment.end)}
                style={{ left: (segment.start - 480) / (center.hours * 60) * 100 + '%', width: duration / (center.hours * 60) * 100 + '%' }}
                onClick={() => openOrder(order.id)}>{duration >= 150 ? order.number : ''}</button>;
            }))}
          </div>)}
        </div>)}
      </div></div>
      <div className="gantt-footer"><span><i />В срок</span><span><i />Риск срыва срока</span><span><i />Выходной</span></div>
    </section>
    <section className="card list-card lower-card">
      <div className="section-heading"><div><h2>Отклонения по срокам</h2><p>Заказы, для которых плановый выпуск позже срока</p></div><span className="kpi-tag orange">{risk.length} заказов</span></div>
      {risk.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Заказ</th><th>Изделие</th><th>Срок заказа</th><th>Плановый выпуск</th></tr></thead>
        <tbody>{risk.map(order => <tr key={order.id}><td><button className="text-link" onClick={() => openOrder(order.id)}>{order.number}</button></td><td>{workspace.products.find(item => item.id === order.productId).name}</td><td>{date(order.due)}</td><td className="danger-text">{date(order.end)}</td></tr>)}</tbody>
      </table></div> : <Empty icon={CalendarDays} title="Все заказы укладываются в сроки" />}
    </section>
  </>;
}

export function PlanForm({ workspace, onClose, onSave, busy, error }) {
  const [value, setValue] = useState(workspace.planDate);
  return <Overlay title="Пересчитать план" description="Выберите первый день производственного расписания" onClose={onClose}>
    <form className="modal-form" onSubmit={event => { event.preventDefault(); onSave({ date: value }); }}>
      <label>Дата начала<input type="date" required min={workspace.today} max={addDays(workspace.today, 365)} value={value} onChange={event => setValue(event.target.value)} /></label>
      <div className="form-aside"><CalendarDays size={18} /><div><strong>Параметры расчёта</strong><span>Приоритеты, сроки заказов, последовательность операций и доступные смены рабочих центров.</span></div></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><Button type="button" onClick={onClose}>Отмена</Button><Button type="submit" kind="primary" disabled={busy}>Пересчитать</Button></div>
    </form>
  </Overlay>;
}

export function Dispatch({ workspace, openOrder, onOperation }) {
  const [selected, setSelected] = useState(workspace.today);
  const [mode, setMode] = useState('shift');
  const [centerId, setCenterId] = useState('all');
  const plans = new Map(workspace.schedule.map(operation => [operation.id, operation]));
  const rows = workspace.orders.flatMap(order => order.operations.map(operation => ({ order, operation, plan: plans.get(operation.id) }))).filter(({ operation, plan }) => {
    const centerMatch = centerId === 'all' || operation.centerId === centerId;
    if (!centerMatch) return false;
    if (mode === 'done') return operation.status === 'done' && localDate(operation.finishedAt) === selected;
    if (mode === 'ready') return operation.ready;
    return (operation.status === 'active' && selected === workspace.today) || plan?.segments.some(segment => segment.date === selected);
  }).sort((a, b) => (a.operation.status === 'active' ? 0 : a.operation.ready ? 1 : 2) - (b.operation.status === 'active' ? 0 : b.operation.ready ? 1 : 2));
  return <>
    <PageHeading title="Диспетчерская" subtitle="Сменные задания и регистрация выполнения операций">
      <label className="select-wrap"><CalendarDays size={17} /><input type="date" aria-label="Дата смены" value={selected} onChange={event => event.target.value && setSelected(event.target.value)} /></label>
    </PageHeading>
    <section className="card list-card">
      <div className="list-toolbar">
        <Segmented options={[[ 'shift', 'Задания смены' ], ['ready', 'Готовы к запуску'], ['done', 'Выполнено']]} value={mode} onChange={setMode} label="Вид заданий" />
        <label className="select-wrap"><SlidersHorizontal size={16} /><select aria-label="Участок смены" value={centerId} onChange={event => setCenterId(event.target.value)}>
          <option value="all">Все рабочие центры</option>{workspace.centers.map(center => <option value={center.id} key={center.id}>{center.name}</option>)}
        </select></label>
      </div>
      {rows.length ? <div className="table-scroll"><table className="data-table wide-table">
        <thead><tr><th>Операция / заказ</th><th>Рабочий центр</th><th>Количество</th><th>План</th><th>Состояние</th><th>Действие</th></tr></thead>
        <tbody>{rows.map(({ order, operation, plan }) => <tr key={operation.id}>
          <td><div className="cell-stack"><strong>{operation.name}</strong><button className="text-link" onClick={() => openOrder(order.id)}>{order.number}</button></div></td>
          <td>{workspace.centers.find(center => center.id === operation.centerId).name}</td>
          <td>{operation.expected === null ? '—' : number(operation.expected) + ' шт.'}</td>
          <td>{shiftTime(plan, mode === 'shift' ? selected : null)}</td>
          <td><span className={'badge ' + (operation.status === 'pending' ? 'planned' : operation.status)}><i />
            {operation.status === 'active' ? 'В работе' : operation.status === 'done' ? 'Завершена' : operation.ready ? 'Готова' : 'Ожидает'}
          </span></td>
          <td>{operation.status === 'active' ? <Button onClick={() => onOperation(order, operation)}>Внести факт</Button>
            : operation.ready ? <Button icon={Play} onClick={() => onOperation(order, operation)}>Запустить</Button> : <span className="muted">—</span>}</td>
        </tr>)}</tbody>
      </table></div> : <Empty icon={ClipboardCheck} title="Нет операций по этим условиям" detail="Выберите другую дату, участок или вид заданий." />}
      <div className="table-footer">Операций · {rows.length}</div>
    </section>
  </>;
}

export function OperationForm({ workspace, order, operation, onClose, onSave, busy, error }) {
  const report = operation.status === 'active';
  const remaining = operation.expected - operation.good - operation.scrap;
  const [good, setGood] = useState(remaining);
  const [scrap, setScrap] = useState(0);
  const [reason, setReason] = useState('');
  const material = workspace.materials.find(item => item.id === order.material.materialId);
  return <Overlay title={report ? 'Внести факт' : 'Запустить операцию'} description={order.number + ' · ' + operation.name} onClose={onClose}>
    <form className="modal-form" onSubmit={event => { event.preventDefault(); onSave({ good, scrap, reason, reported: operation.good + operation.scrap }); }}>
      {report ? <>
        <div className="form-aside"><ClipboardCheck size={19} /><div><strong>Остаток партии · {remaining} шт.</strong><span>Можно внести факт по части партии. Операция завершится после учёта всех изделий.</span></div></div>
        <div className="form-grid"><label>Годных, шт.<input type="number" required min="0" max={remaining - scrap} value={good} onChange={event => setGood(event.target.value)} /></label>
          <label>Брак, шт.<input type="number" required min="0" max={remaining} value={scrap} onChange={event => {
            setScrap(event.target.value);
            if (Number(good) + Number(event.target.value) > remaining) setGood(remaining - Number(event.target.value));
          }} /></label></div>
        {Number(scrap) > 0 && <label>Причина брака<input required maxLength={250} value={reason} onChange={event => setReason(event.target.value)} placeholder="Например, отклонение от допуска" /></label>}
      </> : <div className="form-aside"><Play size={19} /><div><strong>{workspace.centers.find(center => center.id === operation.centerId).name}</strong>
        <span>{order.issued ? 'В работе будет учтена партия из ' + operation.expected + ' шт.' : 'Со склада будет выдан материал: ' + material.name + ', ' + number(order.qty * order.material.consumption) + ' ' + material.unit + '.'}</span>
      </div></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><Button type="button" onClick={onClose}>Отмена</Button><Button kind="primary" type="submit" disabled={busy}>{report ? 'Сохранить факт' : 'Запустить'}</Button></div>
    </form>
  </Overlay>;
}

export function Materials({ workspace, onMovement, onCatalog }) {
  const [query, setQuery] = useState('');
  const materials = workspace.materials.filter(item => [item.name, item.code, item.specification].join(' ').toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
  return <>
    <PageHeading title="Материалы и склад" subtitle="Остатки, потребность по заказам и движения материалов">
      <Button icon={Plus} kind={workspace.materials.length ? 'secondary' : 'primary'} onClick={() => onCatalog('materials')}>Новый материал</Button>
      {workspace.materials.length > 0 && <Button icon={ArrowDownLeft} kind="primary" onClick={() => onMovement()}>Новое движение</Button>}
    </PageHeading>
    <section className="card list-card">
      <div className="section-heading"><div><h2>Складские остатки</h2><p>Потребность по заказам, для которых материал ещё не выдан</p></div><SearchInput value={query} onChange={setQuery} placeholder="Поиск по материалам" /></div>
      {materials.length ? <div className="table-scroll"><table className="data-table wide-table">
        <thead><tr><th>Материал</th><th>Остаток</th><th>Минимум</th><th>Потребность</th><th>Дефицит</th><th>Действие</th></tr></thead>
        <tbody>{materials.map(material => <tr key={material.id}>
          <td><div className="cell-stack"><strong>{material.name}</strong><small>{material.code} · {material.specification}</small></div></td>
          <td className={material.stock < material.minimum ? 'warning-text' : ''}>{number(material.stock)} {material.unit}</td>
          <td>{number(material.minimum)} {material.unit}</td><td>{number(material.required)} {material.unit}</td>
          <td>{material.shortage ? <span className="badge overdue"><i />{number(material.shortage)} {material.unit}</span> : '—'}</td>
          <td><div className="table-actions"><Button onClick={() => onMovement(material.id)}>Движение</Button><IconButton icon={Pencil} label={'Изменить ' + material.name} onClick={() => onCatalog('materials', material.id)} /></div></td>
        </tr>)}</tbody>
      </table></div> : <Empty icon={Package} title="Материалы не найдены" />}
    </section>
    <section className="card list-card lower-card">
      <div className="section-heading"><div><h2>Журнал движений</h2><p>Приход, расход и выдача материалов в производство</p></div></div>
      {workspace.movements.length ? <div className="table-scroll"><table className="data-table">
        <thead><tr><th>Дата</th><th>Материал</th><th>Количество</th><th>Остаток после движения</th><th>Основание</th></tr></thead>
        <tbody>{workspace.movements.map(movement => {
          const material = workspace.materials.find(item => item.id === movement.materialId);
          return <tr key={movement.id}><td>{date(movement.date)}</td><td>{material.name}</td>
            <td className={movement.quantity > 0 ? 'success-text' : ''}>{movement.quantity > 0 ? '+' : ''}{number(movement.quantity)} {material.unit}</td>
            <td>{number(movement.balance)} {material.unit}</td><td>{movement.note || '—'}</td></tr>;
        })}</tbody>
      </table></div> : <Empty icon={Package} title="Движений пока нет" detail="Журнал пополняется при приходе, расходе и запуске заказа." />}
    </section>
  </>;
}

export function MovementForm({ workspace, selected, onClose, onSave, busy, error }) {
  const [materialId, setMaterial] = useState(selected ?? workspace.materials[0].id);
  const [type, setType] = useState('receipt');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const material = workspace.materials.find(item => item.id === materialId);
  return <Overlay title="Движение материала" description="Оформите приход или расход со склада" onClose={onClose}>
    <form className="modal-form" onSubmit={event => { event.preventDefault(); onSave(materialId, { type, quantity, note }); }}>
      <label>Материал<select value={materialId} onChange={event => setMaterial(event.target.value)}>{workspace.materials.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
      <div className="form-grid"><label>Операция<select value={type} onChange={event => setType(event.target.value)}><option value="receipt">Приход</option><option value="issue">Расход</option></select></label>
        <label>Количество, {material.unit}<input type="number" step="0.001" min="0.001" max="1000000" required value={quantity} onChange={event => setQuantity(event.target.value)} /></label></div>
      <label>Основание<input value={note} maxLength={250} onChange={event => setNote(event.target.value)} placeholder="Номер накладной или комментарий" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><Button type="button" onClick={onClose}>Отмена</Button><Button kind="primary" type="submit" disabled={busy}>Провести</Button></div>
    </form>
  </Overlay>;
}

export function Quality({ workspace, openOrder }) {
  return <>
    <PageHeading title="Контроль качества" subtitle="Журнал брака по производственным операциям" />
    <section className="card list-card">
      <div className="section-heading"><div><h2>Зарегистрированные отклонения</h2><p>Записи из отчётов о выполнении операций</p></div><span className="kpi-tag orange">{number(workspace.quality.reduce((sum, item) => sum + item.quantity, 0))} шт. брака</span></div>
      {workspace.quality.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Дата</th><th>Заказ</th><th>Операция</th><th>Количество</th><th>Причина</th></tr></thead>
        <tbody>{workspace.quality.map(record => <tr key={record.id}><td>{date(record.date)}</td><td><button className="text-link" onClick={() => openOrder(record.orderId)}>{workspace.orders.find(order => order.id === record.orderId).number}</button></td>
          <td>{record.operation}</td><td><span className="badge overdue"><i />{number(record.quantity)} шт.</span></td><td>{record.reason}</td></tr>)}</tbody>
      </table></div> : <Empty icon={ClipboardCheck} title="Записей о браке нет" detail="Отклонения появятся после регистрации брака в отчёте по операции." />}
    </section>
  </>;
}

export function Directory({ workspace, filter, navigate, onCatalog }) {
  const isCenter = filter !== 'products';
  return <>
    <PageHeading title="Справочники" subtitle="Рабочие центры, изделия и технологические маршруты">
      <Button icon={Plus} kind="primary" onClick={() => onCatalog(isCenter ? 'centers' : 'products')}>{isCenter ? 'Новый рабочий центр' : 'Новое изделие'}</Button>
    </PageHeading>
    <section className="card list-card">
      <div className="list-toolbar"><Segmented options={[[ 'centers', 'Рабочие центры' ], ['products', 'Изделия и маршруты']]} value={isCenter ? 'centers' : 'products'} onChange={value => navigate('directory', value)} label="Справочник" /></div>
      {isCenter && (workspace.centers.length ? <div className="table-scroll"><table className="data-table wide-table"><thead><tr><th>Рабочий центр</th><th>Оборудование</th><th>Часов в смену</th><th>План на 7 дней</th><th>Загрузка</th><th aria-label="Действия" /></tr></thead>
        <tbody>{workspace.centers.map(center => <tr key={center.id}><td><div className="cell-stack"><strong>{center.name}</strong><small>{center.code}</small></div></td><td>{center.equipment}</td><td>{center.hours} ч</td><td>{number(center.plannedHours)} / {center.capacity} ч</td>
          <td><div className="table-progress"><Progress value={center.load} tone={center.load >= 90 ? 'orange' : center.color} /><span>{center.load}%</span></div></td><td><IconButton icon={Pencil} label={'Изменить ' + center.name} onClick={() => onCatalog('centers', center.id)} /></td></tr>)}</tbody>
      </table></div> : <Empty icon={Factory} title="Рабочих центров пока нет" detail="Добавьте оборудование или участок, на котором можно выполнять операции." />)}
      {!isCenter && (workspace.products.length ? <div className="routes-list">{workspace.products.map(product => <details className="route-card" key={product.id}>
        <summary><span className="table-icon"><Package size={18} /></span><span><strong>{product.name}</strong><small>{product.code}</small></span><ChevronRight size={17} /></summary>
        <div className="route-steps">{product.route.map(([name, centerId, setup, perUnit], index) => <div key={index}><span>{(index + 1) * 10}</span><strong>{name}</strong><small>{workspace.centers.find(center => center.id === centerId).name}</small><small>{setup} мин подготовка · {perUnit} мин/шт.</small></div>)}</div>
        <Button className="edit-route" icon={Pencil} onClick={() => onCatalog('products', product.id)}>Редактировать</Button>
      </details>)}</div> : <Empty icon={Package} title="Изделий пока нет" detail="Добавьте изделие и задайте технологический маршрут." />)}
    </section>
  </>;
}
