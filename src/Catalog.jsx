import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { Button, ErrorMessage, IconButton, Overlay } from './ui.jsx';

const titles = {
  centers: ['Новый рабочий центр', 'Рабочий центр'],
  products: ['Новое изделие', 'Изделие'],
  materials: ['Новый материал', 'Материал'],
};
const emptyStep = () => ['', '', 0, 10];

export function CatalogForm({ workspace, collection, id, navigate, onClose, onSave, busy, error }) {
  const item = workspace[collection].find(entry => entry.id === id);
  const [values, setValues] = useState(() => item ?? {
    code: '', name: '', equipment: '', hours: 8, specification: '', unit: '', minimum: 0,
    materialId: '', consumption: 1, route: [emptyStep()],
  });
  const set = key => event => setValues(current => ({ ...current, [key]: event.target.value }));
  const setRoute = update => setValues(current => ({ ...current, route: update(current.route) }));
  const setStep = (index, field) => event => {
    const value = event.target.value;
    setRoute(route => route.map((step, i) => i === index ? step.with(field, value) : step));
  };
  const move = (index, direction) => setRoute(route => route.with(index, route[index + direction]).with(index + direction, route[index]));
  const material = workspace.materials.find(entry => entry.id === values.materialId);
  const canDefineProduct = workspace.materials.length > 0 && workspace.centers.length > 0;
  const title = item ? titles[collection][1] + ' · ' + item.code : titles[collection][0];

  return <Overlay title={title} onClose={onClose} className={collection === 'products' ? 'catalog-modal' : ''}>
    {collection === 'products' && !canDefineProduct ? <div className="modal-form">
      <p className="form-aside">Для маршрута нужны материал и хотя бы один рабочий центр.</p>
      <div className="modal-actions">
        {!workspace.materials.length && <Button kind="primary" onClick={() => navigate('materials')}>Материалы и склад</Button>}
        {!workspace.centers.length && <Button onClick={() => navigate('directory', 'centers')}>Рабочие центры</Button>}
      </div>
    </div> : <form className="modal-form" onSubmit={event => { event.preventDefault(); onSave(values); }}>
      <div className="form-grid catalog-name">
        <label>Код<input required maxLength={24} value={values.code} onChange={set('code')} /></label>
        <label>Наименование<input required maxLength={100} value={values.name} onChange={set('name')} /></label>
      </div>
      {collection === 'centers' && <>
        <label>Оборудование<input required maxLength={100} value={values.equipment} onChange={set('equipment')} /></label>
        <label>Часов в смену<input type="number" required min="1" max="16" value={values.hours} onChange={set('hours')} /></label>
      </>}
      {collection === 'materials' && <>
        <label>Спецификация<input maxLength={100} value={values.specification} onChange={set('specification')} /></label>
        <div className="form-grid">
          <label>Единица измерения<input required maxLength={12} value={values.unit} disabled={!!item} onChange={set('unit')} /></label>
          <label>Минимальный остаток<input type="number" required min="0" max="1000000" step="0.001" value={values.minimum} onChange={set('minimum')} /></label>
        </div>
      </>}
      {collection === 'products' && <>
        <div className="form-grid">
          <label>Материал<select required value={values.materialId} onChange={set('materialId')}><option value="">Выберите материал</option>
            {workspace.materials.map(entry => <option value={entry.id} key={entry.id}>{entry.name}</option>)}
          </select></label>
          <label>Расход на изделие{material ? ', ' + material.unit : ''}<input type="number" required min="0.001" max="10000" step="0.001" value={values.consumption} onChange={set('consumption')} /></label>
        </div>
        <div className="route-editor-heading"><h3>Технологический маршрут</h3><Button type="button" icon={Plus} disabled={values.route.length >= 24} onClick={() => setRoute(route => [...route, emptyStep()])}>Добавить операцию</Button></div>
        {values.route.map(([name, centerId, setup, minutes], index) => <fieldset className="step-editor" key={index}>
          <legend>Операция {(index + 1) * 10}</legend>
          <div className="form-grid">
            <label>Название операции<input required maxLength={100} value={name} onChange={setStep(index, 0)} /></label>
            <label>Рабочий центр<select required value={centerId} onChange={setStep(index, 1)}><option value="">Выберите центр</option>
              {workspace.centers.map(center => <option key={center.id} value={center.id}>{center.name}</option>)}
            </select></label>
          </div>
          <div className="form-grid step-parameters">
            <label>Подготовка, мин<input type="number" required min="0" max="1440" value={setup} onChange={setStep(index, 2)} /></label>
            <label>Норма, мин/шт.<input type="number" required min="1" max="1440" value={minutes} onChange={setStep(index, 3)} /></label>
            <div className="table-actions">
              <IconButton type="button" icon={ChevronUp} disabled={index === 0} label="Переместить операцию вверх" onClick={() => move(index, -1)} />
              <IconButton type="button" icon={ChevronDown} disabled={index === values.route.length - 1} label="Переместить операцию вниз" onClick={() => move(index, 1)} />
              <IconButton type="button" icon={Trash2} disabled={values.route.length === 1} label="Удалить операцию" onClick={() => setRoute(route => route.filter((_, i) => i !== index))} />
            </div>
          </div>
        </fieldset>)}
        {item && <p className="form-aside">Изменения маршрута и нормы расхода применяются к новым заказам.</p>}
      </>}
      <ErrorMessage>{error}</ErrorMessage>
      <div className="modal-actions"><Button type="button" onClick={onClose}>Отмена</Button><Button kind="primary" type="submit" disabled={busy}>Сохранить</Button></div>
    </form>}
  </Overlay>;
}
