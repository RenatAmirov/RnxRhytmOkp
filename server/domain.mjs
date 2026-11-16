import { randomUUID } from 'node:crypto';
import { addDays, buildOperations, dateInSamara, todayInSamara } from './seed.mjs';

const dayMinutes = 24 * 60;
const shiftStart = 8 * 60;
const epoch = day => Date.parse(day + 'T00:00:00Z');
const workingDay = day => ![0, 6].includes(new Date(day + 'T00:00:00Z').getUTCDay());
const round = quantity => Number(quantity.toFixed(3));
const priority = { high: 0, normal: 1, low: 2 };

export class WorkspaceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export function validDate(value) {
  return typeof value === 'string' && /^20\d{2}-\d{2}-\d{2}$/.test(value)
    && Number.isFinite(epoch(value)) && new Date(epoch(value)).toISOString().slice(0, 10) === value;
}

function fail(message, status) {
  throw new WorkspaceError(message, status);
}

export const orderStatus = order => order.operations.every(op => op.status === 'done') ? 'done' : order.issued ? 'active' : 'planned';
export const expectedQuantity = (order, index) => index === 0 ? order.qty : order.operations[index - 1].good;
const orderMaterial = (state, order) => order.material ?? state.products.find(product => product.id === order.productId);

function place(ready, duration, bookings, anchor, hours) {
  const segments = [];
  let remaining = duration;
  let day = Math.floor(ready / dayMinutes);
  while (remaining > 0) {
    const date = addDays(anchor, day);
    if (workingDay(date)) {
      const start = day * dayMinutes + shiftStart;
      const end = start + hours * 60;
      const busy = bookings.get(day) ?? [];
      let cursor = Math.max(start, ready);
      for (const allocation of [...busy, { start: end, end }]) {
        const unbooked = Math.min(remaining, Math.max(0, allocation.start - cursor));
        if (unbooked > 0) {
          segments.push({ date, start: cursor - day * dayMinutes, end: cursor + unbooked - day * dayMinutes });
          busy.push({ start: cursor, end: cursor + unbooked });
          remaining -= unbooked;
        }
        if (!remaining) {
          busy.sort((a, b) => a.start - b.start);
          bookings.set(day, busy);
          return { segments, finish: day * dayMinutes + segments.at(-1).end };
        }
        cursor = Math.max(cursor, allocation.end);
      }
      if (busy.length) bookings.set(day, busy.sort((a, b) => a.start - b.start));
    }
    day++;
  }
}

export function buildSchedule(state) {
  const anchor = state.planDate;
  const books = Object.fromEntries(state.centers.map(center => [center.id, new Map()]));
  const centerById = Object.fromEntries(state.centers.map(center => [center.id, center]));
  const operations = [];
  const finishDates = {};
  const readyTimes = {};
  const open = state.orders.filter(order => orderStatus(order) !== 'done').sort((a, b) =>
    priority[a.priority] - priority[b.priority] || a.due.localeCompare(b.due) || a.id.localeCompare(b.id, 'ru', { numeric: true }),
  );

  function allocate(order, operation, quantity) {
    const duration = Math.max(1, (quantity - operation.good - operation.scrap) * operation.minutes
      + (operation.status === 'active' ? 0 : operation.setup));
    const ready = readyTimes[order.id] ?? 0;
    const center = centerById[operation.centerId];
    const { segments, finish } = place(ready, duration, books[center.id], anchor, center.hours);
    readyTimes[order.id] = finish;
    finishDates[order.id] = segments.at(-1).date;
    operations.push({
      id: operation.id, orderId: order.id, centerId: center.id, name: operation.name,
      start: segments[0].date, end: segments.at(-1).date, minutes: duration, segments,
    });
  }

  for (const order of open) {
    const activeIndex = order.operations.findIndex(operation => operation.status === 'active');
    if (activeIndex >= 0) allocate(order, order.operations[activeIndex], expectedQuantity(order, activeIndex));
  }

  for (const order of open) {
    let quantity = order.qty;
    for (const operation of order.operations) {
      if (operation.status === 'done') quantity = operation.good;
      if (operation.status === 'active') quantity -= operation.scrap;
      if (operation.status === 'pending') allocate(order, operation, quantity);
    }
  }
  return { operations, finishDates };
}

export function workspaceView(state, today = todayInSamara()) {
  const planDate = state.planDate < today ? today : state.planDate;
  const schedule = buildSchedule({ ...state, planDate });
  const orders = state.orders.map(order => {
    const status = orderStatus(order);
    const work = order.operations.map((operation, index) => {
      const expected = expectedQuantity(order, index);
      const previousReady = index === 0 || order.operations[index - 1].status === 'done';
      return { ...operation, expected: previousReady ? expected : null, ready: operation.status === 'pending' && previousReady };
    });
    const progress = Math.round(100 * work.reduce((sum, operation) =>
      sum + (operation.status === 'done' ? 1 : operation.status === 'active' ? (operation.good + operation.scrap) / operation.expected : 0), 0) / work.length);
    const end = schedule.finishDates[order.id] ?? null;
    const { materialId, consumption } = orderMaterial(state, order);
    return { ...order, material: { materialId, consumption }, operations: work, status, progress, end, overdue: status !== 'done' && order.due < today, risk: !!end && end > order.due };
  });

  const materials = state.materials.map(material => {
    const required = round(orders.filter(order => !order.issued).reduce((sum, order) => {
      return sum + (order.material.materialId === material.id ? order.qty * order.material.consumption : 0);
    }, 0));
    return { ...material, required, shortage: round(Math.max(0, required - material.stock)) };
  });
  const ordersById = Object.fromEntries(orders.map(order => [order.id, order]));
  const lastDay = addDays(planDate, 6);
  const workdays = Array.from({ length: 7 }, (_, index) => addDays(planDate, index)).filter(workingDay).length;
  const centerLoad = state.centers.map(center => {
    const allocations = schedule.operations.filter(operation => operation.centerId === center.id);
    const minutes = allocations.flatMap(operation => operation.segments)
      .filter(segment => segment.date <= lastDay).reduce((sum, segment) => sum + segment.end - segment.start, 0);
    const capacity = center.hours * workdays;
    return { ...center, plannedHours: round(minutes / 60), capacity, load: Math.round(minutes / (capacity * 60) * 100) };
  });
  const history = Object.fromEntries(state.history.map(item => [item.date, { ...item }]));
  for (const order of state.orders) {
    if (order.demo) continue;
    const target = history[order.due] ??= { date: order.due, plan: 0, actual: 0 };
    target.plan += order.qty;
  }
  for (const output of state.output) {
    const delivery = history[output.date] ??= { date: output.date, plan: 0, actual: 0 };
    delivery.actual += output.good;
  }
  return {
    today, planDate, orders, products: state.products, materials, centers: centerLoad, schedule: schedule.operations,
    history: Object.values(history).sort((a, b) => a.date.localeCompare(b.date)),
    quality: state.quality.filter(record => ordersById[record.orderId]).toReversed(),
    movements: state.movements.toReversed(),
  };
}

function orderFields(state, input) {
  const product = state.products.find(item => item.id === input.productId);
  const customer = typeof input.customer === 'string' ? input.customer.trim() : '';
  const qty = Number(input.qty);
  if (!product) fail('Выберите изделие из справочника.');
  if (!customer || customer.length > 120) fail('Укажите заказчика (до 120 символов).');
  if (!Number.isInteger(qty) || qty < 1 || qty > 10000) fail('Количество должно быть целым числом от 1 до 10 000.');
  if (!validDate(input.due)) fail('Укажите корректный срок заказа.');
  if (!Object.hasOwn(priority, input.priority)) fail('Выберите приоритет заказа.');
  const notes = typeof input.notes === 'string' ? input.notes.trim() : '';
  if (notes.length > 1000) fail('Комментарий должен быть не длиннее 1 000 символов.');
  return { productId: product.id, customer, qty, due: input.due, priority: input.priority, notes };
}

export function saveOrder(state, input, id, now = new Date()) {
  const fields = orderFields(state, input);
  const product = state.products.find(item => item.id === fields.productId);
  const material = { materialId: product.materialId, consumption: product.consumption };
  if (id !== undefined) {
    const order = state.orders.find(item => item.id === id);
    if (!order) fail('Заказ не найден.', 404);
    if (order.issued && (order.productId !== fields.productId || order.qty !== fields.qty)) fail('После запуска нельзя менять изделие и количество.', 409);
    if (order.productId !== fields.productId) {
      order.operations = buildOperations(id, product.route);
      order.material = material;
    }
    Object.assign(order, fields);
    return order.id;
  }
  const number = ++state.sequence;
  const orderId = String(number);
  state.orders.unshift({
    ...fields, id: orderId, number: 'ЗП-' + orderId.padStart(4, '0'), material,
    createdAt: now.toISOString(), createdDate: dateInSamara(now), issued: false,
    operations: buildOperations(orderId, product.route),
  });
  return orderId;
}

export function deleteOrder(state, id) {
  const order = state.orders.find(item => item.id === id);
  if (!order) fail('Заказ не найден.', 404);
  if (order.issued) fail('Удалить можно только заказ, который ещё не запущен.', 409);
  state.orders = state.orders.filter(item => item.id !== id);
}

function moveStock(state, material, amount, note, date) {
  const balance = round(material.stock + amount);
  if (balance < 0) fail('Недостаточно материала «' + material.name + '» на складе.', 409);
  material.stock = balance;
  state.movements.push({ id: randomUUID(), materialId: material.id, quantity: amount, balance, note, date });
}

export function updateStock(state, id, input, now = new Date()) {
  const material = state.materials.find(item => item.id === id);
  if (!material) fail('Материал не найден.', 404);
  const amount = round(Number(input.quantity));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) fail('Введите количество от 0,001 до 1 000 000.');
  if (!['receipt', 'issue'].includes(input.type)) fail('Укажите вид движения.');
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 250) : '';
  moveStock(state, material, input.type === 'receipt' ? amount : -amount, note, now.toISOString());
}

export function updateOperation(state, id, action, input, now = new Date()) {
  const order = state.orders.find(item => item.operations.some(operation => operation.id === id));
  if (!order) fail('Операция не найдена.', 404);
  const index = order.operations.findIndex(operation => operation.id === id);
  const operation = order.operations[index];
  const timestamp = now.toISOString();
  if (action === 'start') {
    if (operation.status !== 'pending') fail('Операция уже запущена или завершена.', 409);
    if (index > 0 && order.operations[index - 1].status !== 'done') fail('Сначала завершите предыдущую операцию.', 409);
    const busy = state.orders.some(item => item.operations.some(other => other.centerId === operation.centerId && other.status === 'active'));
    if (busy) fail('На рабочем центре уже выполняется операция.', 409);
    if (!order.issued) {
      const specification = orderMaterial(state, order);
      const material = state.materials.find(item => item.id === specification.materialId);
      moveStock(state, material, -round(order.qty * specification.consumption), 'Выдача в производство · ' + order.number, timestamp);
      order.issued = true;
    }
    Object.assign(operation, { status: 'active', startedAt: timestamp });
    return;
  }
  if (operation.status !== 'active') fail('Сначала запустите операцию.', 409);
  const good = Number(input.good);
  const scrap = Number(input.scrap);
  const expected = expectedQuantity(order, index);
  if (input.reported !== operation.good + operation.scrap) fail('Операция изменилась. Обновите страницу перед внесением факта.', 409);
  if (![good, scrap].every(value => Number.isInteger(value) && value >= 0) || good + scrap <= 0) {
    fail('Введите положительное количество годных изделий или брака.');
  }
  if (operation.good + operation.scrap + good + scrap > expected) fail('Количество превышает остаток партии.', 409);
  const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
  if (scrap && (!reason || reason.length > 250)) fail('Укажите причину брака (до 250 символов).');
  operation.good += good;
  operation.scrap += scrap;
  if (good && index === order.operations.length - 1) state.output.push({ date: dateInSamara(now), good });
  if (scrap) state.quality.push({ id: randomUUID(), orderId: order.id, operation: operation.name, quantity: scrap, reason, date: timestamp });
  if (operation.good + operation.scrap === expected) {
    Object.assign(operation, { status: 'done', finishedAt: timestamp });
    if (!operation.good) {
      for (const remaining of order.operations.slice(index + 1)) Object.assign(remaining, { status: 'done', finishedAt: timestamp });
    }
  }
}

export function setPlanDate(state, date, today = todayInSamara()) {
  if (!validDate(date) || date < today || date > addDays(today, 365)) fail('Дата начала плана должна быть в пределах ближайших 365 дней.');
  state.planDate = date;
}

function boundedText(value, label, max) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > max) fail(label + ' — обязательное поле (до ' + max + ' символов).');
  return result;
}

function boundedNumber(value, label, min, max, integer = false) {
  const quantity = Number(value);
  if (value === '' || value === null || !Number.isFinite(quantity) || quantity < min || quantity > max || (integer && !Number.isInteger(quantity))) {
    fail(label + ' — ' + (integer ? 'целое число' : 'число') + ' от ' + min + ' до ' + max + '.');
  }
  return round(quantity);
}

export function saveCatalog(state, collection, input, id) {
  const entries = state[collection];
  const current = id ? entries.find(entry => entry.id === id) : null;
  if (id && !current) fail('Запись справочника не найдена.', 404);
  const code = boundedText(input.code, 'Код', 24);
  const name = boundedText(input.name, 'Наименование', 100);
  if (entries.some(entry => entry.id !== id && entry.code.toUpperCase() === code.toUpperCase())) fail('Этот код уже используется.', 409);

  const fields = { code, name };
  if (collection === 'centers') {
    fields.equipment = boundedText(input.equipment, 'Оборудование', 100);
    fields.hours = boundedNumber(input.hours, 'Часов в смену', 1, 16, true);
    fields.color = current?.color ?? 'violet';
  }
  if (collection === 'materials') {
    fields.specification = typeof input.specification === 'string' ? input.specification.trim().slice(0, 100) : '';
    fields.unit = boundedText(input.unit, 'Единица измерения', 12);
    if (current?.unit && current.unit !== fields.unit) fail('Единица измерения задаётся при создании материала.', 409);
    fields.minimum = boundedNumber(input.minimum, 'Минимальный остаток', 0, 1000000);
    fields.stock = current?.stock ?? 0;
  }
  if (collection === 'products') {
    if (!state.materials.some(item => item.id === input.materialId)) fail('Выберите материал из справочника.');
    if (!Array.isArray(input.route) || !input.route.length || input.route.length > 24) fail('Добавьте от 1 до 24 операций.');
    fields.materialId = input.materialId;
    fields.consumption = boundedNumber(input.consumption, 'Расход материала', 0.001, 10000);
    fields.route = input.route.map((step, index) => {
      if (!Array.isArray(step) || !state.centers.some(item => item.id === step[1])) fail('Выберите рабочий центр для операции ' + (index + 1) + '.');
      return [
        boundedText(step[0], 'Наименование операции', 100), step[1],
        boundedNumber(step[2], 'Подготовка', 0, 1440, true),
        boundedNumber(step[3], 'Минут на изделие', 1, 1440, true),
      ];
    });
    for (const order of state.orders.filter(order => order.productId === id)) {
      order.material ??= { materialId: current.materialId, consumption: current.consumption };
    }
  }
  if (current) {
    Object.assign(current, fields);
    return id;
  }
  const newId = randomUUID().replaceAll('-', '');
  entries.push({ id: newId, ...fields });
  return newId;
}
