import {stages, nrEvents, timelineView, bootstrapReception} from './agreement-timeline-model.js';

const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const kinds = {physical: 'Физическая опора / измерение', control: 'Служебная информация / управление', data: 'Пользовательские данные', mixed: 'Опора и служебные сведения в одной передаче'};

// CSS lifelines keep text at its natural size on small screens; arrows carry
// Direction sets colour; event labels retain the physical/control/data category.
function diagram(groups, selected = -1, nr = false) {
  return `<div class="at-diagram" role="group" aria-label="Временная диаграмма; время направлено вниз">
    <div class="at-actors"><strong>Терминал</strong><span>Время ↓</span><strong>${nr ? 'Базовая станция' : 'Точка доступа'}</strong></div>
    ${groups.map(group => `<section class="at-group ${group.index === selected ? 'at-current' : ''}" aria-label="${escape(group.title)}">
      ${group.hideTitle ? '' : `<p class="at-group-label">${escape(group.title)}</p>`}
      ${group.events.map(([kind, direction, label, fields]) => `<div class="at-event at-${kind} at-${direction}">
        <span class="at-event-label">${fields ? `<span class="at-message-fields">${fields.map(field=>`<span>${escape(field)}</span>`).join('')}</span>` : `<small>${['up','down'].includes(direction) ? escape(kinds[kind]) : direction === 'terminal' ? 'Обработка в терминале' : nr ? 'Обработка на базовой станции' : 'Обработка в точке доступа'}</small>${escape(label)}${['up','down'].includes(direction) ? `<span class="at-direction">${direction === 'up' ? 'UL · Терминал → ' + (nr ? 'станция' : 'точка доступа') : 'DL · ' + (nr ? 'Станция' : 'Точка доступа') + ' → терминал'}</span>` : ''}`}</span>
        ${['up','down'].includes(direction) ? '<span class="at-arrow" aria-hidden="true"></span>' : ''}
      </div>`).join('')}
    </section>`).join('')}
    <div class="at-legend"><span class="at-legend-dl">От ${nr ? 'станции' : 'точки доступа'} к терминалу — DL (downlink)</span><span class="at-legend-ul">От терминала к ${nr ? 'станции' : 'точке доступа'} — UL (uplink)</span><span class="at-legend-local">Обработка внутри узла</span></div>
  </div>`;
}

export function mountTimeline(root) {
  if (root.dataset.agreementTimeline === 'nr') {
    root.innerHTML = diagram([{title: 'Четырёхшаговый доступ с конкуренцией; успешная ветвь', events: nrEvents}], -1, true);
    return;
  }
  const snapshot = root.hasAttribute('data-timeline-stage');
  const overview = document.getElementById('agreement-timeline');
  let stage = snapshot ? Number(root.dataset.timelineStage) : 0, all = false;
  root.innerHTML = `${snapshot ? '' : `<nav class="ta-stage-nav" aria-label="Этапы согласования передачи">${stages.map((s,i) => `<button type="button" data-step="${i}" aria-pressed="false">${i+1}. ${escape(s.title)}</button>`).join('')}</nav><div class="at-controls"><button type="button" data-back>← Назад</button><button type="button" data-next>Далее →</button><button type="button" data-all aria-pressed="false">Весь процесс</button></div>`}
    <div class="at-status" aria-live="polite"></div><div class="at-scene"></div>
    ${snapshot ? (overview ? `<a href="#agreement-timeline" data-timeline-jump="${stage}">Этот этап на общей временной диаграмме ↑</a>` : '') : '<p class="ta-note">Учебный сценарий: этапы могут совмещаться, отсутствовать или повторяться. События добавляются сверху вниз; интервалы условные. Выделен выбранный этап. Служебная работа может идти параллельно данным.</p>'}`;
  function draw() {
    const view = timelineView(stage, all), current = view.selected;
    root.querySelectorAll('[data-step]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.step) === stage)));
    if (!snapshot) {
      root.querySelector('[data-back]').disabled = stage === 0;
      root.querySelector('[data-next]').disabled = stage === stages.length-1;
      root.querySelector('[data-all]').setAttribute('aria-pressed', String(all));
    }
    root.querySelector('.at-status').innerHTML = `<strong>Этап ${stage+1}. ${escape(current.title)}</strong><p><b>Проблема:</b> ${escape(current.problem)}</p><p><b>Терминал:</b> ${escape(current.state)}</p>`;
    const first = root.hasAttribute('data-timeline-previous') ? Math.max(0,stage-1) : stage;
    const visible = root.dataset.timelineFrame==='bootstrap' ? [{...bootstrapReception,index:stage}] : snapshot ? stages.slice(first,stage+1).map((s,index) => ({...s,index:first+index})) : view.visible.map((s,index) => ({...s,index}));
    root.querySelector('.at-scene').innerHTML = diagram(visible, stage);
  }
  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-step')) {stage = Number(button.dataset.step); all = false;}
    if (button.hasAttribute('data-back')) {stage = Math.max(0,stage-1); all = false;}
    if (button.hasAttribute('data-next')) {stage = Math.min(stages.length-1,stage+1); all = false;}
    if (button.hasAttribute('data-all')) all = !all;
    draw();
  });
  root.addEventListener('agreement:select', event => {stage = event.detail; all = false; draw();});
  draw();
}

document.querySelectorAll('[data-agreement-timeline]').forEach(mountTimeline);
document.addEventListener('click', event => {
  const link = event.target.closest('[data-timeline-jump]');
  if (!link) return;
  const root = document.getElementById('agreement-timeline');
  root?.dispatchEvent(new CustomEvent('agreement:select', {detail: Number(link.dataset.timelineJump)}));
  root?.focus({preventScroll: true});
});
