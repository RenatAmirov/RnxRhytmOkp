import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSchedule, saveCatalog, saveOrder, updateOperation, updateStock, workspaceView } from './domain.mjs';
import { seedWorkspace } from './seed.mjs';

const today = '2026-11-16';
const now = new Date(today + 'T07:00:00Z');
const orderFields = { productId: 'housing', customer: 'Тестовая площадка', qty: 3, due: today, priority: 'high' };

test('план учитывает вместимость смен, выходные и порядок операций', () => {
  const state = seedWorkspace(today);
  const id = saveOrder(state, { ...orderFields, qty: 420 }, undefined, now);
  const schedule = buildSchedule(state);
  const windows = new Map();
  for (const operation of schedule.operations) {
    for (const segment of operation.segments) {
      const key = operation.centerId + segment.date;
      if (!windows.has(key)) windows.set(key, []);
      windows.get(key).push(segment);
      assert.ok(segment.start >= 480 && segment.end <= 960);
      assert.ok(![0, 6].includes(new Date(segment.date).getUTCDay()));
    }
  }
  for (const segments of windows.values()) {
    segments.sort((a, b) => a.start - b.start);
    for (let i = 1; i < segments.length; i++) assert.ok(segments[i - 1].end <= segments[i].start);
  }
  const operations = schedule.operations.filter(operation => operation.orderId === id);
  assert.equal(operations.length, 3);
  assert.ok(operations[0].segments.length > 1);
  for (let i = 1; i < operations.length; i++) {
    const prev = operations[i - 1].segments.at(-1);
    const next = operations[i].segments[0];
    assert.ok(next.date > prev.date || (next.date === prev.date && next.start >= prev.end));
  }
});

test('выдача, частичный факт, брак и остаток партии связаны с заказом', () => {
  const state = seedWorkspace(today);
  const id = saveOrder(state, orderFields, undefined, now);
  const first = id + '-1', second = id + '-2', last = id + '-3';
  assert.throws(() => updateOperation(state, second, 'start', {}, now), /предыдущую/);
  updateOperation(state, first, 'start', {}, now);
  assert.equal(state.materials[0].stock, 302.5);
  assert.equal(state.movements.at(-1).quantity, -7.5);
  updateOperation(state, first, 'report', { good: 1, scrap: 0, reported: 0 }, now);
  assert.throws(() => updateOperation(state, first, 'report', { good: 1, scrap: 0, reported: 0 }, now), /изменилась/);
  updateOperation(state, first, 'report', { good: 1, scrap: 1, reason: 'Допуск', reported: 1 }, now);
  const view = workspaceView(state, today);
  assert.equal(view.quality[0].reason, 'Допуск');
  assert.equal(view.orders.find(order => order.id === id).operations[1].expected, 2);
  assert.throws(() => updateOperation(state, second, 'start', {}, now), /уже выполняется/);
  updateOperation(state, '148-2', 'report', { good: 17, scrap: 0, reported: 19 }, now);
  updateOperation(state, second, 'start', {}, now);
  updateOperation(state, second, 'report', { good: 2, scrap: 0, reported: 0 }, now);
  updateOperation(state, '147-3', 'report', { good: 11, scrap: 0, reported: 13 }, now);
  updateOperation(state, last, 'start', {}, now);
  const baseline = workspaceView(state, today).history.find(item => item.date === today).actual;
  updateOperation(state, last, 'report', { good: 1, scrap: 0, reported: 0 }, now);
  assert.equal(workspaceView(state, today).history.find(item => item.date === today).actual, baseline + 1);
  updateOperation(state, last, 'report', { good: 1, scrap: 0, reported: 1 }, now);
  assert.equal(workspaceView(state, today).orders.find(order => order.id === id).status, 'done');
  assert.equal(state.movements.length, 1);
});

test('недостача не запускает заказ и не изменяет складские остатки', () => {
  const state = seedWorkspace(today);
  const id = saveOrder(state, { ...orderFields, qty: 150 }, undefined, now);
  assert.throws(() => updateOperation(state, id + '-1', 'start', {}, now), /Недостаточно/);
  assert.throws(() => updateStock(state, 'steel45', { type: 'issue', quantity: '340' }, now), /Недостаточно/);
  assert.equal(state.materials[0].stock, 310);
  assert.equal(state.movements.length, 0);
  assert.equal(workspaceView(state, today).orders.find(order => order.id === id).status, 'planned');
});

test('изменения справочника сохраняют маршрут и норму действующего заказа', () => {
  const state = seedWorkspace(today);
  const before = saveOrder(state, orderFields, undefined, now);
  saveCatalog(state, 'products', {
    ...state.products[0], consumption: 4, route: [['Новый контроль', 'quality', 0, 5]],
  }, 'housing');
  const after = saveOrder(state, orderFields, undefined, now);
  const older = state.orders.find(order => order.id === before);
  const newer = state.orders.find(order => order.id === after);
  assert.equal(older.material.consumption, 2.5);
  assert.equal(older.operations.length, 3);
  assert.equal(newer.material.consumption, 4);
  assert.equal(newer.operations[0].name, 'Новый контроль');
});
