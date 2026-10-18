import { accessStory, resourceStory } from './agreement-stories-model.js';

const accessLabels = ['До обращения', 'Первые обращения', 'Ожидание ответа завершено', 'Выбор ожидания', 'Повторные обращения', 'Ожидание ответа завершено'];
const resourceLabels = ['Исходное состояние', 'В очередь поступили данные', 'Запрос потребности', 'Решение узла', 'Доставка назначения', 'Назначенный кадр', 'Следующий кадр'];
const statusLabels = { ready: 'Готов к обращению', awaiting: 'Ожидает ответа', accepted: 'Обращение принято', timeout: 'Ответа нет; нужен повтор', backoff: 'Ждёт выбранного окна' };
const accessCaptions = [
  'Три терминала знают разрешённые окна обращения. Индивидуального ресурса для данных пока нет.',
  'A и B передали в одном окне, C -- в другом. Терминалы ждут ответ узла.',
  'Узел принял C. Для A и B время ожидания ответа истекло; причину отсутствия ответа терминалы не знают.',
  'C больше не участвует. A и B отсчитывают ожидание от общего конца окна ответа.',
  'A и B снова обращаются к узлу в выбранных окнах. Ответ ещё не получен.',
];
const packets = count => `<div class="ags-packets" aria-label="В очереди ${count} единиц данных">${Array.from({length:6}, (_, i) => `<span class="${i < count ? 'ags-filled' : ''}" aria-hidden="true">${i < count ? i + 1 : '·'}</span>`).join('')}</div>`;
const cell = (text = '·', type = '') => `<td><span class="ags-event ${type}">${text}</span></td>`;

function accessView(d, trial) {
  const {stage, devices} = d;
  const rows = devices.map((device, i) => {
    const first = [1, 2].map(window => cell(stage >= 1 && device.firstWindow === window ? 'Обращение →' : '·', stage >= 1 && device.firstWindow === window ? 'ags-request' : '')).join('');
    const answer = stage >= 2 ? cell(i === 2 ? '← Ответ C' : 'Нет ответа', i === 2 ? 'ags-ok' : 'ags-missing') : cell();
    const repeat = [1, 2, 3].map(window => {
      if (i === 2) return cell('·');
      if (stage >= 4 && d.waits[i] === window) return cell('Обращение →', 'ags-request');
      if (stage >= 3 && window < d.waits[i]) return cell('Ожидание', 'ags-wait');
      if (stage === 3 && window === d.waits[i]) return cell('Выбрано', 'ags-planned');
      return cell();
    }).join('');
    const last = stage === 5 && i < 2 ? cell(d.retryResult === 'collision' ? 'Нет ответа' : `← Ответ ${device.id}`, d.retryResult === 'collision' ? 'ags-missing' : 'ags-ok') : cell();
    return `<tr><th scope="row">${device.id}</th>${first}${answer}${repeat}${last}</tr>`;
  }).join('');
  const receiver = `<tr class="ags-receiver"><th scope="row">Узел</th>${cell(stage >= 1 ? 'A + B' : '·', stage >= 2 ? 'ags-missing' : '')}${cell(stage >= 1 ? 'C' : '·', stage >= 2 ? 'ags-ok' : '')}${cell(stage >= 2 ? 'Принят C' : '·')}${[1,2,3].map(window => {
    const ids = stage >= 4 ? devices.filter(dev => dev.retryWindow === window).map(dev => dev.id) : [];
    return cell(ids.join(' + ') || '·', stage === 5 && ids.length ? ids.length > 1 ? 'ags-missing' : 'ags-ok' : '');
  }).join('')}${cell(stage === 5 ? d.retryResult === 'collision' ? 'Не разделены' : 'Приняты A, B' : '·')}</tr>`;
  const caption = stage < 5 ? accessCaptions[stage] : d.retryResult === 'collision'
    ? 'Обращения A и B снова совпали. Оба ждут нового повтора; C уже завершил обращение.'
    : 'Обращения A и B разошлись по времени. Каждый получил ответ и завершил обращение.';
  return `<div class="ags-device-cards">${devices.map((dev, i) => `<div class="ags-card ${dev.status === 'accepted' ? 'ags-accepted' : ''}"><strong>Терминал ${dev.id}</strong><span>${statusLabels[dev.status]}</span><small>${stage >= 3 && i < 2 ? `Окно повтора: ${d.waits[i]}` : i === 2 && stage >= 2 ? 'В повторах не участвует' : 'Первое обращение'}</small></div>`).join('')}</div>
    <div class="ags-scroll" tabindex="0" role="region" aria-label="Обращения терминалов и ответы узла; время направлено вправо">
    <table class="ags-timeline"><caption>Время → · повтор № ${trial}</caption><thead><tr><th rowspan="2" scope="col">Участник</th><th colspan="2" scope="colgroup">Первое обращение</th><th scope="col">Ответ</th><th colspan="3" scope="colgroup">Окна повтора</th><th scope="col">Ответ</th></tr><tr>${[1,2,'',1,2,3,''].map(v => `<th scope="col">${v}</th>`).join('')}</tr></thead><tbody>${rows}${receiver}</tbody></table></div>
    <p class="ags-observation">${caption}</p><p class="ags-key">→ обращение к узлу · ← ответ терминалу. Совпавшие обращения узел в этом опыте не разделяет. Длительности условны.</p>`;
}

function resourceView(d) {
  const {stage, mode} = d;
  const request = stage < 2 ? 'Запрос ещё не отправлен' : mode === 'request-lost' ? 'Запрос T: 6 единиц → ✕ не дошёл' : 'Запрос T: 6 единиц → получен';
  const grant = stage < 4 ? 'Назначение ещё не доставлено' : mode === 'grant-lost' ? `✕ Не дошло ← T: кадр 11, ${d.planned} интервала` : `Получено ← T: кадр 11, интервалы 3–${2+d.planned}`;
  const permission = !d.received ? 'Назначение не получено' : stage < 5 ? `Ожидать кадр 11: интервалы 3–${2+d.received}` : stage === 5 ? `Разрешено: интервалы 3–${2+d.received}` : 'Назначение кадра 11 истекло';
  const captions = [
    'У терминала 2 единицы данных. Узел знает об этой очереди из предыдущего сообщения; назначения пока нет.',
    'Пришли ещё 4 единицы. Терминал видит очередь из 6, узлу всё ещё известно только о 2.',
    mode === 'request-lost' ? 'Запрос потерян. Узел продолжает опираться на прежние сведения: 2 единицы.' : 'Запрос доставлен. Теперь узел знает, что терминалу нужно передать 6 единиц.',
    `Узел выделил ${d.planned} интервала в кадре 11. Терминал пока не получил это решение.`,
    mode === 'grant-lost' ? 'Назначение потеряно. Узел выделил интервалы, но терминал не знает, какие ему разрешены.' : 'Терминал получил назначение. Оно относится только к кадру 11; передавать сейчас, в кадре 10, ещё нельзя.',
    mode === 'expired' ? 'Терминал пропустил назначенный кадр. Выделенные ему интервалы остались без данных.' : mode === 'grant-lost' ? 'Терминал молчит: назначения нет. Выделенные узлом интервалы остались без данных.' : `Передано ${d.transmitted} единицы; в очереди осталось ${d.queue}.`,
    `Наступил кадр 12. В очереди осталось ${d.queue}, но действующего назначения нет. Нужно согласовать новую передачу.`,
  ];
  const resourceNames = { other: 'Другие', reserved: 'T: план', sent: 'T: данные', unused: 'T: пусто', free: 'Свободно' };
  return `<div class="ags-knowledge"><div class="ags-card"><strong>Терминал T</strong><span>Очередь: <b>${d.queue}</b> ед.</span>${packets(d.queue)}<small class="ags-permission">${permission}</small></div>
    <div class="ags-messages"><div class="${stage >= 2 && mode === 'request-lost' ? 'ags-missing' : ''}">${request}</div><div class="${stage >= 4 && mode === 'grant-lost' ? 'ags-missing' : ''}">${grant}</div></div>
    <div class="ags-card"><strong>Узел</strong><span>Известный остаток: <b>${d.nodeQueue}</b> ед.</span>${packets(d.nodeQueue)}<small>${stage < 3 ? 'Решение ещё не принято' : `Назначено T: ${d.planned} интервала в кадре 11`}</small></div></div>
    <div class="ags-frame-head"><strong>Сейчас: кадр ${d.frame}</strong><span>${stage < 5 ? 'План кадра 11' : 'Кадр 11: использование ресурса'}</span></div>
    <div class="ags-resource" role="group" aria-label="Шесть интервалов кадра 11">${d.resource.map((value, i) => `<div class="ags-slot ags-${value}"><small>Интервал ${i+1}</small><strong>${resourceNames[value]}</strong></div>`).join('')}</div>
    <div class="ags-frame-strip" aria-label="Срок назначения">${[10,11,12].map(frame => `<span ${d.frame === frame ? 'aria-current="step" class="ags-current"' : ''}>Кадр ${frame}<small>${frame === 11 ? stage >= 3 ? 'Срок назначения T' : 'Ресурс для данных' : frame === 12 ? 'Следующий кадр' : 'Служебный обмен'}</small></span>`).join('')}</div>
    <p class="ags-observation">${captions[stage]}</p><p class="ags-key">Один интервал переносит одну условную единицу данных. Первые два заняты другими участниками; служебный обмен идёт до кадра 11.</p>`;
}

let instance = 0;
export function mountAgreementStory(root) {
  const kind = root.dataset.agreementStory;
  if (!['access', 'resource'].includes(kind)) return;
  const access = kind === 'access', labels = access ? accessLabels : resourceLabels;
  const id = `ags-mode-${++instance}`;
  let stage = 0, seed = 1, trial = 1;
  root.classList.add('ags-story');
  root.innerHTML = `<div class="ags-controls"><label for="${id}">${access ? 'Ожидание перед повтором' : 'Условие опыта'}<select id="${id}" data-mode>${(access ? [['same','Одинаковое'],['independent','Случайное у каждого']] : [['normal','Обмен без потерь'],['request-lost','Запрос не дошёл'],['grant-lost','Назначение не дошло'],['expired','Кадр пропущен']]).map(([v, text]) => `<option value="${v}">${text}</option>`).join('')}</select></label>
    <div class="ags-buttons"><button type="button" data-reset>Сначала</button><button type="button" data-back>Назад</button><button type="button" data-next>Следующий шаг →</button></div>
    ${access ? '<div class="ags-buttons"><button type="button" data-retry>Ещё один повтор A и B</button><button type="button" data-new>Новый опыт</button></div>' : ''}</div>
    <div class="ags-progress" role="status" aria-live="polite" aria-atomic="true"></div><div data-scene></div>`;
  const select = root.querySelector('[data-mode]');
  function draw() {
    const d = access ? accessStory({stage, mode:select.value, seed}) : resourceStory({stage, mode:select.value});
    root.querySelector('[data-scene]').innerHTML = access ? accessView(d, trial) : resourceView(d);
    root.querySelector('.ags-progress').innerHTML = `${stage+1} / ${labels.length} · ${labels[stage]}<span class="visually-hidden">. ${root.querySelector('.ags-observation').textContent}</span>`;
    root.querySelector('[data-back]').disabled = stage === 0;
    root.querySelector('[data-next]').disabled = stage === labels.length-1;
    if (access) root.querySelector('[data-retry]').disabled = d.retryResult !== 'collision';
  }
  select.addEventListener('change', () => {stage=0; seed=1; trial=1; draw();});
  root.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.hasAttribute('data-reset')) {stage=0; seed=1; trial=1;}
    else if (button.hasAttribute('data-next')) stage=Math.min(stage+1,labels.length-1);
    else if (button.hasAttribute('data-back')) stage=Math.max(stage-1,0);
    else if (button.hasAttribute('data-retry')) {stage=3; seed++; trial++;}
    else if (button.hasAttribute('data-new')) {stage=0; seed++; trial=1;}
    else return;
    draw();
  });
  draw();
}
document.querySelectorAll('[data-agreement-story]').forEach(mountAgreementStory);
