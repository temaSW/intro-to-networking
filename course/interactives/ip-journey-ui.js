import {DESTINATIONS, start, inspect, forward} from './ip-journey-model.js';

export function mountJourney(root) {
  // Static fallback is replaced only after a successful model initialization.
  let state = start(), revealed = false;
  root.innerHTML = `<form class="ip-controls">
    <label>Конечный адрес<select name="destination">${DESTINATIONS.map(d=>`<option>${d}</option>`).join('')}</select></label>
    <label>Таблицы<select name="scenario"><option value="normal">Обычная сеть</option><option value="default">Только маршрут по умолчанию на R1</option><option value="missing">На R1 известна только сеть B</option><option value="loop">Цикл R1 ↔ R2 для сети B</option></select></label>
    <label>Начальный TTL<input name="limit" type="number" min="1" max="255" value="64" required></label>
    <button type="submit">Начать заново</button></form>
    <div data-scene></div><div data-question></div><div data-feedback role="status" aria-live="polite"></div>
    <button type="button" data-next hidden>Следующий переход</button>
    <details><summary>Журнал переходов</summary><ol data-history></ol></details>`;
  const form = root.querySelector('form');
  const packet = limit => `<div class="ip-packet"><strong>IP-датаграмма · IPv4</strong><span>Источник: ${state.source}</span><span>Назначение: ${state.destination}</span><span>TTL = ${limit} · данные: «Сообщение»</span></div>`;
  const frame = (f, limit) => `<div class="ip-frame"><strong>Канальный кадр: ${f.link}</strong><span>Локальный переход ${f.sender} → ${f.receiver}</span>${packet(limit)}</div>`;
  const network = () => `<div class="ip-scroll" tabindex="0" role="region" aria-label="Схема сети; текущий узел ${state.node}"><svg class="ip-network" viewBox="0 0 680 200" role="img" aria-label="A связан с R1, R1 с R2 и R3, R2 с B и R3, R3 с C">
    <path d="M65 100 H190 L365 50 H570 M190 100 L365 150 H570 M365 50 V150"/>
    ${[['A',65,100],['R1',190,100],['R2',365,50],['R3',365,150],['B',570,50],['C',570,150]].map(([name,x,y])=>`<g class="${name===state.node?'ip-current':''}"><rect x="${x-30}" y="${y-19}" width="60" height="38" rx="4"/><text x="${x}" y="${y+5}" text-anchor="middle">${name}</text></g>`).join('')}
    <text x="90" y="84">Wi-Fi</text><text x="450" y="30">сеть B</text><text x="450" y="186">сеть C</text></svg></div>`;
  const render = () => {
    revealed = false;
    root.querySelector('[data-next]').hidden = true;
    root.querySelector('[data-feedback]').textContent = '';
    const active = state.status === 'active';
    root.querySelector('[data-scene]').innerHTML = `${network()}<p><strong>${active ? `Пакет принят на ${state.node}` : state.status === 'delivered' ? `Пакет доставлен узлу ${state.node}` : 'Пересылка остановлена'}</strong></p>${active || state.status === 'delivered' ? frame({sender:state.sender,receiver:state.node,link:state.link},state.limit) : packet(state.limit)}`;
    const question = root.querySelector('[data-question]');
    if (active) {
      const {routes} = inspect(state);
      question.innerHTML = `<p>Куда ${state.node} отправит эту датаграмму? Какая запись определяет выбор?</p>
        <div class="ip-scroll" tabindex="0" role="region" aria-label="Таблица пересылки текущего маршрутизатора"><table><thead><tr><th>Префикс</th><th>Следующий узел / IP next hop</th><th>Выход</th><th>Предположение</th></tr></thead><tbody>${routes.map((r,i)=>`<tr data-route="${i}"><td><code>${r.prefix}</code></td><td>${r.next} · ${r.gateway ?? 'сам адрес назначения'}</td><td>${r.iface}</td><td><button type="button" data-choice="${i}">Выбрать строку ${i+1}</button></td></tr>`).join('')}</tbody></table></div>
        <div class="ip-choices"><button type="button" data-choice="none">Нет маршрута</button><button type="button" data-choice="ttl">Лимит не позволяет переслать</button></div>`;
    } else question.textContent = state.status === 'delivered' ? 'Адрес назначения и данные сохранились. Последний кадр адресован конечному узлу.' : state.status === 'expired' ? 'TTL исчерпан: нового кадра с этой датаграммой нет.' : 'Совпадающего префикса нет: новый кадр не создан.';
    root.querySelector('[data-history]').innerHTML = state.history.map(h=>`<li>${h.node}: ${h.selected?.prefix ?? 'нет маршрута'}; next hop ${h.outgoing?.receiver ?? 'нет'}; выход ${h.outgoing ? h.selected.iface : 'нет'}; TTL ${h.before} → ${h.after}; ${h.incoming.link} → ${h.outgoing?.link ?? 'сброс'}.</li>`).join('');
  };
  root.addEventListener('click', event => {
    const button = event.target.closest('[data-choice]');
    if (!button || revealed || state.status !== 'active') return;
    revealed = true;
    const {routes,matching,selected} = inspect(state);
    const correct = state.limit <= 1 ? 'ttl' : selected ? String(routes.indexOf(selected)) : 'none';
    root.querySelectorAll('[data-route]').forEach(row => {
      const r = routes[Number(row.dataset.route)];
      if (matching.includes(r)) row.classList.add('ip-match');
      if (r === selected) { row.classList.add('ip-selected'); row.cells[0].append(' ← самый длинный'); }
      else if (matching.includes(r)) row.cells[0].append(' ← совпадает');
    });
    root.querySelectorAll('[data-choice]').forEach(b=>b.disabled=true);
    const next = forward(state), hop = next.history.at(-1);
    root.querySelector('[data-feedback]').innerHTML = `<p><strong>${button.dataset.choice === correct ? 'Верно.' : 'Предположение не подтвердилось.'}</strong> ${state.limit<=1 ? 'TTL 1 → 0: пакет отброшен, даже при наличии маршрута.' : selected ? `Из ${matching.length} совпадающих записей выбрана ${selected.prefix}: longest prefix match. ${selected.prefix==='0.0.0.0/0' ? 'Маршрут по умолчанию совпадает с любым IPv4-адресом.' : ''} Выход ${selected.iface}; next hop ${selected.gateway ?? state.destination}. TTL ${hop.before} → ${hop.after}.` : 'Ни один префикс не совпал. Без маршрута по умолчанию пересылка невозможна.'}</p>${hop.outgoing ? `<p>Входной кадр завершился на ${state.node}. Создан новый кадр:</p>${frame(hop.outgoing,hop.after)}` : '<p>Новый канальный кадр не создан.</p>'}`;
    state = next;
    const nextButton = root.querySelector('[data-next]');
    nextButton.hidden = false;
    nextButton.textContent = state.status === 'active' ? 'Следующий переход' : 'Показать итог';
  });
  root.querySelector('[data-next]').addEventListener('click',render);
  form.addEventListener('submit',event=> {
    event.preventDefault();
    if (!form.reportValidity()) return;
    state = start(form.elements.destination.value,Number(form.elements.limit.value),form.elements.scenario.value);
    render();
  });
  render();
}
document.querySelectorAll('[data-ip-journey]').forEach(mountJourney);
