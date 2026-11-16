import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowRight, Bell, BookOpen, Building2, CalendarRange, ChevronDown, ChevronRight, CircleAlert, CircleHelp, ClipboardCheck, ClipboardList, LayoutDashboard, ListChecks, Menu, Package, Search, X } from 'lucide-react';
import '@fontsource-variable/inter';
import './styles.css';
import { CatalogForm } from './Catalog.jsx';
import Dashboard from './Dashboard.jsx';
import { OrderDetail, OrderForm, OrdersPage } from './Orders.jsx';
import { Directory, Dispatch, Materials, MovementForm, OperationForm, PlanForm, Planning, Quality } from './Production.jsx';
import { Button, date, Empty, IconButton, number, Overlay, SearchInput, Status, Toast } from './ui.jsx';

const navigation = [
  { title: 'Производство', items: [
    ['overview', 'Обзор', LayoutDashboard],
    ['orders', 'Заказы', ClipboardList],
    ['planning', 'Планирование', CalendarRange],
    ['dispatch', 'Диспетчерская', ListChecks],
    ['quality', 'Контроль качества', ClipboardCheck],
  ] },
  { title: 'Ресурсы', items: [
    ['materials', 'Материалы и склад', Package],
    ['directory', 'Справочники', BookOpen],
  ] },
];
const pages = Object.fromEntries(navigation.flatMap(group => group.items.map(([key, label]) => [key, label])));
const readRoute = () => {
  const [page, filter] = window.location.hash.slice(1).split('/');
  return { page: Object.hasOwn(pages, page) ? page : 'overview', filter };
};

async function request(path, method, body) {
  const response = await fetch(path, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!(response.headers.get('content-type') || '').includes('application/json')) throw new Error('Сервер вернул неожиданный ответ.');
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Не удалось сохранить изменения.');
  return result;
}

function Sidebar({ route, navigate, onHelp, mobile, close, inactive }) {
  return <>
    {mobile && <button className="mobile-backdrop" aria-label="Закрыть меню" onClick={close} />}
    <aside className={'sidebar ' + (mobile ? 'show' : '')} inert={inactive}>
      <a href="#overview" className="wordmark" onClick={event => { event.preventDefault(); navigate('overview'); }}>
        <span className="logo"><Activity size={24} strokeWidth={2.25} /></span>
        <span><strong>Ритм ОКП</strong><small>Управление производством</small></span>
      </a>
      <div className="workspace-marker"><span><Building2 size={18} strokeWidth={1.7} /></span><div><strong>МехПром</strong><small>Производственная площадка</small></div></div>
      <nav className="navigation" aria-label="Основная навигация">{navigation.map(group => <div className="nav-group" key={group.title}>
        <span className="nav-caption">{group.title}</span>
        {group.items.map(([key, label, Icon]) => <a className={'nav-item ' + (route.page === key ? 'current' : '')} key={key} href={'#' + key}
          aria-current={route.page === key ? 'page' : undefined} onClick={event => { event.preventDefault(); navigate(key); }}>
          <Icon size={18} strokeWidth={1.72} /><span>{label}</span>
        </a>)}
      </div>)}</nav>
      <div className="sidebar-footer">
        <button className="nav-item" onClick={onHelp}><CircleHelp size={18} strokeWidth={1.75} />Справка</button>
        <span className="system-state"><i />Локальное рабочее пространство</span>
      </div>
    </aside>
  </>;
}

function Header({ page, workspace, onSearch, onNotifications, onHelp, openMenu }) {
  const [profile, setProfile] = useState(false);
  const alerts = workspace?.orders.some(order => order.risk || order.overdue) || workspace?.materials.some(material => material.shortage);
  return <header className="topbar">
    <div className="breadcrumbs"><IconButton icon={Menu} label="Меню" className="mobile-menu" onClick={openMenu} />
      <span className="breadcrumb-root">Рабочее пространство</span><ChevronRight size={15} /><strong>{pages[page]}</strong>
    </div>
    <div className="header-actions">
      <button className="global-search" aria-label="Поиск по системе" onClick={onSearch}><Search size={17} /><span>Поиск по системе</span><kbd>Ctrl K</kbd></button>
      <div className="header-bell"><IconButton icon={Bell} label="Уведомления" onClick={onNotifications} />{alerts && <i />}</div>
      <div className="header-divider" />
      <div className="popover-anchor profile-anchor" onBlur={event => !event.currentTarget.contains(event.relatedTarget) && setProfile(false)}>
        <button className="profile" aria-expanded={profile} onClick={() => setProfile(value => !value)} aria-label="Рабочий профиль">
          <span className="avatar">АВ</span><span className="profile-text"><strong>Алексей Волков</strong><small>Планировщик</small></span><ChevronDown size={14} />
        </button>
        {profile && <div className="popover profile-menu"><div><strong>Алексей Волков</strong><small>Демонстрационный профиль</small></div><button onClick={() => { setProfile(false); onHelp(); }}><CircleHelp size={16} />О приложении</button></div>}
      </div>
    </div>
  </header>;
}

function GlobalSearch({ workspace, onClose, openOrder }) {
  const [query, setQuery] = useState('');
  const text = query.toLocaleLowerCase('ru').trim();
  const matches = (workspace?.orders ?? []).filter(order => {
    const product = workspace.products.find(item => item.id === order.productId);
    return [order.number, order.customer, product.name, product.code].join(' ').toLocaleLowerCase('ru').includes(text);
  }).slice(0, 8);
  return <Overlay title="Поиск по системе" description="Введите номер заказа, изделие или заказчика" onClose={onClose}>
    <div className="global-search-body"><SearchInput value={query} onChange={setQuery} placeholder="Например, ЗП-0148" autoFocus />
      <div className="search-results">{matches.length ? matches.map(order => <button key={order.id} onClick={() => openOrder(order.id)}>
        <span className="table-icon"><Package size={17} /></span><span><strong>{order.number}</strong><small>{workspace.products.find(item => item.id === order.productId).name} · {order.customer}</small></span>
        <Status order={order} /><ArrowRight size={15} /></button>) : <Empty title="Подходящих заказов нет" />}</div>
    </div>
  </Overlay>;
}

function Notifications({ workspace, onClose, jump }) {
  const overdue = workspace?.orders.filter(order => order.overdue).length ?? 0;
  const risk = workspace?.orders.filter(order => order.risk && !order.overdue).length ?? 0;
  const shortage = workspace?.materials.filter(material => material.shortage).length ?? 0;
  return <Overlay drawer title="Уведомления" description="Отклонения, которые требуют внимания" onClose={onClose}>
    <div className="drawer-body notification-list">
      {overdue > 0 && <button onClick={() => jump('orders', 'risk')}><span className="kpi-icon orange"><CircleAlert size={19} /></span><span><strong>Просроченные заказы</strong><small>Заказы за пределами срока · {overdue}</small></span><ArrowRight size={16} /></button>}
      {risk > 0 && <button onClick={() => jump('planning')}><span className="kpi-icon violet"><CalendarRange size={19} /></span><span><strong>Риск срыва сроков</strong><small>Плановый выпуск позже срока · {risk}</small></span><ArrowRight size={16} /></button>}
      {shortage > 0 && <button onClick={() => jump('materials')}><span className="kpi-icon blue"><Package size={19} /></span><span><strong>Дефицит материалов</strong><small>Позиций с дефицитом · {shortage}</small></span><ArrowRight size={16} /></button>}
      {!overdue && !risk && !shortage && <Empty icon={Bell} title="Отклонений нет" />}
    </div>
  </Overlay>;
}

function Help({ onClose, demo }) {
  return <Overlay title="Ритм ОКП" description="Локальная система оперативно-календарного планирования" onClose={onClose}>
    <div className="help-body">
      <h3>Работа с заказом</h3>
      <ol><li>Создайте заказ на изделие из справочника. Маршрут и потребность в материале подставятся автоматически.</li><li>Откройте «Планирование», чтобы проверить график операций и сроки выпуска.</li><li>В «Диспетчерской» запустите операцию и внесите количество годных изделий и брака.</li></ol>
      <p>{demo && 'Площадка содержит демонстрационные заказы. '}Все изменения сохраняются в локальной базе SQLite.</p>
      <div className="modal-actions"><Button kind="primary" onClick={onClose}>Понятно</Button></div>
    </div>
  </Overlay>;
}

function App() {
  const [route, setRoute] = useState(readRoute);
  const [workspace, setWorkspace] = useState(null);
  const [offline, setOffline] = useState('');
  const [modal, setModal] = useState(null);
  const [mobile, setMobile] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [toast, setToast] = useState('');
  const [planningRevision, setPlanningRevision] = useState(0);

  async function load() {
    setOffline('');
    try { setWorkspace(await request('/api/workspace')); }
    catch (error) { setOffline(error.message); }
  }

  useEffect(() => {
    load();
    const update = () => { setRoute(readRoute()); setModal(null); };
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);

  useEffect(() => {
    function shortcut(event) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !modal) {
        event.preventDefault();
        setModal({ type: 'search' });
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [modal]);

  function navigate(page, filter) {
    const hash = '#' + page + (filter ? '/' + filter : '');
    if (window.location.hash !== hash) history.pushState(null, '', hash);
    if (page !== route.page) window.scrollTo(0, 0);
    setRoute({ page, filter });
    setModal(null);
    setMobile(false);
  }

  function show(type, data = {}) {
    setFormError('');
    setModal({ type, ...data });
  }
  const openOrder = id => show('order', { id });
  const editOrder = id => show('edit', { id, back: modal?.type === 'order' });
  const newOrder = () => show('new');
  const orderMenu = id => show('delete', { id });
  const onOperation = (order, operation) => show('operation', { id: order.id, operationId: operation.id, back: modal?.type === 'order' });
  const onCatalog = (collection, id) => show('catalog', { collection, id });
  const close = () => {
    if (busy) return;
    if (modal?.back) openOrder(modal.id);
    else setModal(null);
  };

  async function mutate(path, method, body, message, onSuccess) {
    if (busy) return;
    setBusy(true);
    setFormError('');
    try {
      const version = await request(path, method, body);
      setWorkspace(version);
      setToast(message);
      if (onSuccess) onSuccess(version);
      else setModal(null);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  }

  const order = workspace?.orders.find(item => item.id === modal?.id);
  const operation = order?.operations.find(item => item.id === modal?.operationId);
  const pageProps = { workspace, navigate, openOrder, editOrder, newOrder, orderMenu, filter: route.filter, onOperation, onCatalog };
  const formProps = { workspace, onClose: close, busy, error: formError };
  return <div className="app">
    <Sidebar route={route} navigate={navigate} onHelp={() => { setMobile(false); show('help'); }} mobile={mobile} close={() => setMobile(false)} inactive={Boolean(modal)} />
    <div className="main-shell" inert={Boolean(modal)}>
      <Header page={route.page} workspace={workspace} onSearch={() => show('search')} onNotifications={() => show('notifications')} onHelp={() => show('help')} openMenu={() => setMobile(true)} />
      <main className="workspace" id="workspace">
        {!workspace ? <section className="card startup">{offline ? <><Empty icon={CircleAlert} title="Не удалось загрузить данные" detail={offline} /><Button onClick={load}>Повторить</Button></> : <span className="loading"><Activity size={24} />Загрузка производства…</span>}</section> : <>
          {route.page === 'overview' && <Dashboard {...pageProps} />}
          {route.page === 'orders' && <OrdersPage {...pageProps} />}
          {route.page === 'planning' && <Planning key={planningRevision} {...pageProps} openPlan={() => show('plan')} />}
          {route.page === 'dispatch' && <Dispatch {...pageProps} />}
          {route.page === 'materials' && <Materials {...pageProps} onMovement={id => show('movement', { materialId: id })} />}
          {route.page === 'quality' && <Quality {...pageProps} />}
          {route.page === 'directory' && <Directory {...pageProps} />}
        </>}
      </main>
    </div>

    {modal?.type === 'search' && <GlobalSearch workspace={workspace} onClose={close} openOrder={openOrder} />}
    {modal?.type === 'help' && <Help onClose={close} demo={workspace?.orders.some(item => item.demo)} />}
    {modal?.type === 'notifications' && <Notifications workspace={workspace} onClose={close} jump={navigate} />}
    {modal?.type === 'order' && order && <OrderDetail {...formProps} order={order} editOrder={editOrder} onOperation={onOperation} />}
    {workspace && (modal?.type === 'new' || (modal?.type === 'edit' && order)) && <OrderForm {...formProps} order={order} openDirectory={() => navigate('directory', 'products')} onSave={body => {
      const path = order ? '/api/orders/' + order.id : '/api/orders';
      mutate(path, order ? 'PATCH' : 'POST', body, order ? 'Заказ обновлён' : 'Заказ создан', result => openOrder(result.resultId));
    }} />}
    {modal?.type === 'delete' && order && <Overlay title={'Удалить ' + order.number + '?'} description="Заказ будет удалён из портфеля и календарного плана." onClose={close}>
      <div className="modal-form">{formError && <p className="form-error" role="alert">{formError}</p>}<div className="modal-actions"><Button onClick={close}>Отмена</Button><Button kind="danger" disabled={busy} onClick={() => mutate('/api/orders/' + order.id, 'DELETE', undefined, 'Заказ удалён')}>Удалить заказ</Button></div></div>
    </Overlay>}
    {modal?.type === 'operation' && order && operation && <OperationForm {...formProps} order={order} operation={operation} onSave={body => {
      const reporting = operation.status === 'active';
      mutate('/api/operations/' + operation.id + (reporting ? '/report' : '/start'), 'POST', body, reporting ? 'Факт сохранён' : 'Операция запущена', modal.back ? () => openOrder(order.id) : undefined);
    }} />}
    {modal?.type === 'movement' && <MovementForm {...formProps} selected={modal.materialId} onSave={(id, body) =>
      mutate('/api/materials/' + id + '/movements', 'POST', body, 'Движение проведено')} />}
    {modal?.type === 'catalog' && <CatalogForm {...formProps} collection={modal.collection} id={modal.id} navigate={navigate} onSave={body => {
      const suffix = modal.id ? '/' + modal.id : '';
      mutate('/api/catalog/' + modal.collection + suffix, modal.id ? 'PATCH' : 'POST', body, 'Справочник обновлён');
    }} />}
    {modal?.type === 'plan' && <PlanForm {...formProps} onSave={body => mutate('/api/plan', 'POST', body, 'Календарный план пересчитан', () => {
      setPlanningRevision(value => value + 1);
      setModal(null);
    })} />}
    <Toast text={toast} clear={() => setToast('')} />
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
