const dayFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Samara' });

export const todayInSamara = () => dayFormat.format(new Date());
export const dateInSamara = value => dayFormat.format(value);

export function addDays(day, amount) {
  const date = new Date(day + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

export const centers = [
  { id: 'mill', code: 'РЦ-01', name: 'Фрезерный участок', equipment: 'Обрабатывающий центр VMC-850', hours: 8, color: 'violet' },
  { id: 'lathe', code: 'РЦ-02', name: 'Токарный участок', equipment: 'Токарный центр LT-300', hours: 8, color: 'teal' },
  { id: 'assembly', code: 'РЦ-03', name: 'Сборочный участок', equipment: 'Сборочный пост СП-04', hours: 8, color: 'blue' },
  { id: 'heat', code: 'РЦ-04', name: 'Термообработка', equipment: 'Печь камерная ПК-120', hours: 8, color: 'orange' },
  { id: 'quality', code: 'РЦ-05', name: 'Контроль качества', equipment: 'Измерительная станция КИМ-01', hours: 8, color: 'teal' },
];

export const products = [
  { id: 'housing', code: 'КР-400.01', name: 'Корпус редуктора', materialId: 'steel45', consumption: 2.5, route: [
    ['Фрезерование корпуса', 'mill', 35, 24], ['Сборка и подгонка', 'assembly', 20, 12], ['Контроль размеров', 'quality', 10, 4],
  ] },
  { id: 'shaft', code: 'ВП-210.02', name: 'Вал приводной', materialId: 'steel40', consumption: 1.8, route: [
    ['Токарная обработка', 'lathe', 30, 20], ['Закалка', 'heat', 50, 9], ['Контроль геометрии', 'quality', 10, 5],
  ] },
  { id: 'flange', code: 'ФМ-180.01', name: 'Фланец монтажный', materialId: 'steel45', consumption: 1.2, route: [
    ['Точение заготовки', 'lathe', 25, 10], ['Фрезерование отверстий', 'mill', 20, 10], ['Контроль размеров', 'quality', 10, 3],
  ] },
  { id: 'gear', code: 'ШЦ-152.03', name: 'Шестерня цилиндрическая', materialId: 'steel40', consumption: 1.4, route: [
    ['Нарезание зубьев', 'mill', 25, 14], ['Термообработка', 'heat', 45, 10], ['Контроль зубчатого венца', 'quality', 10, 4],
  ] },
  { id: 'lid', code: 'КП-085.04', name: 'Крышка подшипника', materialId: 'aluminium', consumption: 0.75, route: [
    ['Токарная обработка', 'lathe', 20, 10], ['Сверление и фрезерование', 'mill', 25, 12], ['Контроль размеров', 'quality', 10, 3],
  ] },
  { id: 'drive', code: 'УП-315.01', name: 'Узел привода', materialId: 'fasteners', consumption: 1, route: [
    ['Подготовка посадочных мест', 'mill', 30, 9], ['Сборка узла', 'assembly', 30, 26], ['Приёмочные испытания', 'quality', 15, 8],
  ] },
];

export function buildOperations(orderId, route) {
  return route.map(([name, centerId, setup, minutes], i) => ({
    id: orderId + '-' + (i + 1), name, centerId, setup, minutes,
    status: 'pending', good: 0, scrap: 0, startedAt: null, finishedAt: null,
  }));
}

export function seedWorkspace(today = todayInSamara()) {
  const customers = ['АО «ПромМеханика»', 'ООО «ТехноПривод»', 'АО «УралМашКомплект»', 'ООО «МеталлСервис»', 'НПО «Вектор»', 'АО «Гидропривод»'];
  const specifications = [
    [0, 0, 36, 4, 'high', 1, 2],
    [1, 1, 24, 6, 'normal', 2, 1],
    [2, 2, 40, 1, 'normal', 0],
    [3, 3, 52, -2, 'high', 1, 0],
    [4, 4, 30, 0, 'normal', 1],
    [5, 5, 12, -1, 'low', 3],
    [0, 1, 22, 10, 'normal', 0],
    [5, 2, 15, 10, 'high', 1],
    [1, 0, 16, 11, 'low', 0],
    [2, 3, 38, 12, 'normal', 2],
    [3, 4, 14, 12, 'normal', 1],
    [4, 5, 24, 13, 'low', 0],
    [5, 0, 18, 14, 'normal', 0],
    [3, 1, 31, 14, 'low', 3],
    [2, 2, 27, 15, 'low', 0],
    [1, 3, 25, 17, 'low', 0],
    [4, 0, 32, -1, 'normal', 3],
    [1, 1, 18, -2, 'normal', 3],
    [5, 2, 11, -3, 'normal', 3],
  ];
  const orders = specifications.map(([productIndex, customerIndex, qty, offset, priority, finished, partial], i) => {
    const number = 148 - i;
    const id = String(number);
    const product = products[productIndex];
    const createdDate = addDays(today, -Math.floor(i * 0.6));
    const timestamp = createdDate + 'T05:00:00Z';
    const operations = buildOperations(id, product.route);
    const scrap = finished === operations.length && i % 2 === 1 ? 1 : 0;
    operations.slice(0, finished).forEach((operation, index) => {
      const loss = index === operations.length - 1 ? scrap : 0;
      Object.assign(operation, { status: 'done', good: qty - loss, scrap: loss, startedAt: timestamp, finishedAt: timestamp });
    });
    if (partial !== undefined) {
      const operation = operations[finished];
      Object.assign(operation, { status: 'active', good: Math.floor(qty * [0.32, 0.55, 0.55][partial]), startedAt: timestamp });
    }
    return {
      id, number: 'ЗП-' + String(number).padStart(4, '0'), productId: product.id,
      customer: customers[customerIndex], qty, due: addDays(today, offset), priority,
      createdDate, createdAt: timestamp, notes: '', issued: finished > 0 || partial !== undefined, operations,
      material: { materialId: product.materialId, consumption: product.consumption },
      demo: true,
    };
  });

  const recentPlan = [66, 83, 75, 98, 92, 106, 114];
  const recentFact = [45, 64, 55, 78, 70, 91, 103];
  const history = Array.from({ length: 180 }, (_, i) => {
    const date = addDays(today, i - 179);
    const sample = i - 173;
    const plan = i < 173 ? 65 + (i * 29) % 56 : recentPlan[sample];
    const actual = i < 173 ? Math.floor(plan * (0.77 + (i % 8) * 0.025)) : recentFact[sample];
    return { date, plan, actual };
  });

  return {
    sequence: 148,
    planDate: today,
    orders,
    centers: structuredClone(centers),
    products: structuredClone(products),
    materials: [
      { id: 'steel45', code: 'МТ-001', name: 'Сталь 45', specification: 'Круглый прокат', unit: 'кг', stock: 310, minimum: 80 },
      { id: 'steel40', code: 'МТ-002', name: 'Сталь 40Х', specification: 'Легированный прокат', unit: 'кг', stock: 65, minimum: 100 },
      { id: 'aluminium', code: 'МТ-003', name: 'Алюминий Д16Т', specification: 'Пруток Ø100', unit: 'кг', stock: 66, minimum: 25 },
      { id: 'fasteners', code: 'МТ-004', name: 'Крепёж М8', specification: 'Комплект на изделие', unit: 'компл.', stock: 120, minimum: 40 },
    ],
    history,
    output: [],
    movements: [],
    quality: orders.flatMap(order => order.operations.filter(operation => operation.scrap).map(operation => ({
      id: operation.id, orderId: order.id, operation: operation.name, quantity: operation.scrap,
      reason: 'Отклонение от допуска', date: operation.finishedAt,
    }))),
  };
}
