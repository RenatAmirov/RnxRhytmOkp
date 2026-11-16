import React, { useState } from 'react';
import { ArrowRight, Download, Ellipsis, ExternalLink, Package, Pencil, Plus, Trash2 } from 'lucide-react';
import { addDays, Button, date, Empty, IconButton, number, Overlay, PageHeading, priorityLabels, Progress, SearchInput, Status, statusLabels } from './ui.jsx';

const filters = [
  ['all', 'Все заказы'], ['open', 'Открытые'], ['active', 'В работе'], ['planned', 'Запланированы'], ['done', 'Завершены'], ['risk', 'Требуют внимания'],
];

export function OrdersTable({ orders, workspace, openOrder, editOrder, orderMenu }) {
  const [menu, setMenu] = useState(null);
  if (!orders.length) return <Empty icon={Package} title="Заказы не найдены" detail="Измените условия поиска или создайте новый заказ." />;
  return <div className="table-scroll"><table className="data-table orders-table">
    <thead><tr><th>Заказ / изделие</th><th>Заказчик</th><th>Срок</th><th>Прогресс</th><th>Статус</th><th aria-label="Действия" /></tr></thead>
    <tbody>{orders.map(order => {
      const product = workspace.products.find(item => item.id === order.productId);
      return <tr key={order.id}>
        <td><button className="table-order" onClick={() => openOrder(order.id)}>
          <span className="table-icon"><Package size={17} strokeWidth={1.7} /></span><span><strong>{order.number}</strong><small>{product.name}</small></span>
        </button></td>
        <td>{order.customer}</td>
        <td className={order.overdue ? 'danger-text' : ''}>{date(order.due)}</td>
        <td><div className="table-progress"><Progress value={order.progress} tone={order.status === 'done' ? 'teal' : 'violet'} /><span>{order.progress}%</span></div></td>
        <td><Status order={order} /></td>
        <td><div className="row-actions" onBlur={event => !event.currentTarget.contains(event.relatedTarget) && setMenu(null)}>
          <IconButton icon={Ellipsis} label={'Действия для ' + order.number} aria-expanded={menu?.id === order.id} onClick={event => {
            const rect = event.currentTarget.getBoundingClientRect();
            setMenu(current => current?.id === order.id ? null : {
              id: order.id, right: document.documentElement.clientWidth - rect.right,
              top: rect.bottom + 130 > window.innerHeight ? rect.top - (order.issued ? 82 : 117) : rect.bottom + 4,
            });
          }} />
          {menu?.id === order.id && <div className="popover row-menu" style={{ right: menu.right, top: menu.top }}>
            <button onClick={() => { setMenu(null); openOrder(order.id); }}><ExternalLink size={15} />Открыть заказ</button>
            <button onClick={() => { setMenu(null); editOrder(order.id); }}><Pencil size={15} />Редактировать</button>
            {!order.issued && <button className="danger-text" onClick={() => { setMenu(null); orderMenu(order.id); }}><Trash2 size={15} />Удалить</button>}
          </div>}
        </div></td>
      </tr>;
    })}</tbody>
  </table></div>;
}

export function downloadOrders(orders, products) {
  const protect = input => {
    const value = String(input);
    return '"' + (/^[=+\-@\t\r]/.test(value) ? "'" : '') + value.replaceAll('"', '""') + '"';
  };
  const rows = [
    ['Заказ', 'Изделие', 'Заказчик', 'Количество', 'Срок', 'Прогресс, %', 'Статус'],
    ...orders.map(order => [order.number, products.find(item => item.id === order.productId).name, order.customer, order.qty, order.due, order.progress, statusLabels[order.overdue ? 'overdue' : order.status]]),
  ];
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(protect).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  link.download = 'ritm-okp-orders.csv';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

export function OrdersPage({ workspace, filter, navigate, newOrder, openOrder, editOrder, orderMenu }) {
  const [query, setQuery] = useState('');
  const safeFilter = filters.some(([key]) => key === filter) ? filter : 'all';
  const shown = workspace.orders.filter(order => {
    const product = workspace.products.find(item => item.id === order.productId);
    const search = [order.number, order.customer, product.name, product.code].join(' ').toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru'));
    const matches = safeFilter === 'all' || safeFilter === order.status || (safeFilter === 'open' && order.status !== 'done') || (safeFilter === 'risk' && (order.risk || order.overdue));
    return search && matches;
  });
  return <>
    <PageHeading title="Производственные заказы" subtitle="Портфель заказов, сроки и ход исполнения">
      <Button icon={Download} onClick={() => downloadOrders(shown, workspace.products)} disabled={!shown.length}>Экспорт CSV</Button>
      <Button icon={Plus} kind="primary" onClick={newOrder}>Новый заказ</Button>
    </PageHeading>
    <section className="card list-card">
      <div className="list-toolbar"><div className="line-tabs" role="group" aria-label="Статус заказа">
        {filters.map(([key, label]) => <button key={key} aria-pressed={key === safeFilter} onClick={() => navigate('orders', key)}>{label}</button>)}
      </div><SearchInput value={query} onChange={setQuery} placeholder="Поиск по заказам" /></div>
      <OrdersTable orders={shown} workspace={workspace} openOrder={openOrder} editOrder={editOrder} orderMenu={orderMenu} />
      <div className="table-footer">Показано {shown.length} из {workspace.orders.length} заказов</div>
    </section>
  </>;
}

export function OrderForm({ workspace, order, onClose, onSave, busy, error, openDirectory }) {
  const [values, setValues] = useState(() => ({
    productId: order?.productId ?? '', customer: order?.customer ?? '', qty: order?.qty ?? 10,
    due: order?.due ?? addDays(workspace.today, 7), priority: order?.priority ?? 'normal', notes: order?.notes ?? '',
  }));
  const set = key => event => setValues(current => ({ ...current, [key]: event.target.value }));
  const product = workspace.products.find(item => item.id === values.productId);
  return <Overlay title={order ? 'Редактировать ' + order.number : 'Новый заказ'} description="Параметры производственной партии" onClose={onClose}>
    {workspace.products.length === 0 ? <div className="modal-form">
      <div className="form-aside"><Package size={18} /><div><strong>Справочник изделий пуст</strong><span>Добавьте изделие с материалом и маршрутом, чтобы сформировать заказ.</span></div></div>
      <div className="modal-actions"><Button kind="primary" onClick={openDirectory}>Открыть справочники</Button></div>
    </div> : <form className="modal-form" onSubmit={event => { event.preventDefault(); onSave(values); }}>
      <label>Изделие<select required value={values.productId} onChange={set('productId')} disabled={order?.issued}>
        <option value="">Выберите изделие</option>{workspace.products.map(item => <option value={item.id} key={item.id}>{item.name} · {item.code}</option>)}
      </select></label>
      <label>Заказчик<input required maxLength={120} value={values.customer} onChange={set('customer')} placeholder="Название организации" /></label>
      <div className="form-grid three">
        <label>Количество, шт.<input type="number" min="1" max="10000" required value={values.qty} onChange={set('qty')} disabled={order?.issued} /></label>
        <label>Срок<input type="date" required value={values.due} onChange={set('due')} /></label>
        <label>Приоритет<select value={values.priority} onChange={set('priority')}>{Object.entries(priorityLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </div>
      <label>Комментарий<textarea rows={2} maxLength={1000} value={values.notes} onChange={set('notes')} placeholder="Требования к партии" /></label>
      {product && <div className="form-aside"><Package size={18} /><div><strong>Маршрут изделия</strong><span>{product.route.map(step => step[0]).join(' → ')}</span></div></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="modal-actions"><Button type="button" onClick={onClose}>Отмена</Button><Button kind="primary" type="submit" disabled={busy}>{busy ? 'Сохранение…' : order ? 'Сохранить' : 'Создать заказ'}</Button></div>
    </form>}
  </Overlay>;
}

export function OrderDetail({ order, workspace, onClose, editOrder, onOperation }) {
  const product = workspace.products.find(item => item.id === order.productId);
  const material = workspace.materials.find(item => item.id === order.material.materialId);
  const opNames = { pending: 'Ожидает', active: 'В работе', done: 'Завершена' };
  return <Overlay title={order.number} description={product.name + ' · ' + product.code} onClose={onClose} drawer>
    <div className="drawer-body">
      <div className="detail-status"><Status order={order} /><Button icon={Pencil} onClick={() => editOrder(order.id)}>Редактировать</Button></div>
      <dl className="detail-grid">
        <div><dt>Заказчик</dt><dd>{order.customer}</dd></div><div><dt>Партия</dt><dd>{number(order.qty)} шт.</dd></div>
        <div><dt>Срок заказа</dt><dd>{date(order.due, { day: 'numeric', month: 'long', year: 'numeric' })}</dd></div>
        <div><dt>Плановый выпуск</dt><dd className={order.risk ? 'danger-text' : ''}>{date(order.end)}</dd></div>
        <div><dt>Приоритет</dt><dd>{priorityLabels[order.priority]}</dd></div>
        <div><dt>Материал</dt><dd>{material.name} · {number(order.qty * order.material.consumption)} {material.unit}</dd></div>
      </dl>
      <div className="detail-progress"><span>Готовность маршрута <strong>{order.progress}%</strong></span><Progress value={order.progress} /></div>
      {order.notes && <p className="detail-notes">{order.notes}</p>}
      <h3 className="drawer-section-title">Маршрут производства</h3>
      <div className="operation-list">{order.operations.map((operation, index) => {
        const center = workspace.centers.find(item => item.id === operation.centerId);
        const plan = workspace.schedule.find(item => item.id === operation.id);
        return <div className="operation" key={operation.id}>
          <span className={'operation-index ' + operation.status}>{String((index + 1) * 10).padStart(2, '0')}</span>
          <div><strong>{operation.name}</strong><span>{center.name}{plan && ' · ' + date(plan.start)}</span>
            <span>{opNames[operation.status]}{operation.status !== 'pending' && ' · годных ' + operation.good + ' · брак ' + operation.scrap}</span></div>
          {(operation.ready || operation.status === 'active') && <button className="text-link" onClick={() => onOperation(order, operation)}>
            {operation.status === 'active' ? 'Внести факт' : 'Запустить'} <ArrowRight size={14} />
          </button>}
        </div>;
      })}</div>
    </div>
  </Overlay>;
}
