import {destinations, scene} from './network-node-model.js';

const escape = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={D:'Д',E:'Е',U:'У',Z:'Ж'};
function packetView(p, annotated=false) {
  return `<div class="node-packet" role="group" aria-label="${annotated?'Данные вместе с назначением':'Сетевой пакет'}">
    <div class="node-network-header"><strong>${annotated?'Кому предназначены данные':'Сетевой заголовок'}</strong>${annotated?'':`<span>Источник: ${escape(p.source)}</span>`}<span>Назначение: ${names[p.destination]}</span></div>
    <div class="node-payload"><strong>${annotated?'Передаваемые данные':'Полезная нагрузка'}</strong><span>«${escape(p.payload)}»</span></div></div>`;
}
function frameView(f) {
  return `<div class="node-frame" role="group" aria-label="Кадр ${f.sender} → ${f.receiver}"><div class="node-link-header"><strong>Кадр: ${f.sender} → ${f.receiver}</strong><span>Получатель на участке: ${f.receiver}</span></div>${packetView(f.packet)}</div>`;
}
const buildSteps=[
 {title:'Только передаваемые данные',question:'Можно ли по этой строке определить, какому серверу она предназначена?',explanation:'Строка «Привет» одинакова для двух адресатов. Отправитель знает, кому пишет, но в самих данных это не указано. Если узлу передать только строку, ему не хватит сведений для дальнейшей доставки.'},
 {title:'Данные вместе с назначением',question:'Какая новая информация теперь доступна узлу? Нужно ли ему понимать смысл слова «Привет»?',explanation:'К данным добавлено указание адресата. Узел получает и содержимое, и сведения для его доставки. Правила формата определяют, где находятся эти сведения и к какому блоку они относятся; узел читает их по этим правилам.'},
 {title:'Заголовок и полезная нагрузка',question:'Какие части входят в целый пакет? Что изменится при выборе другого адресата?',explanation:'Служебная часть называется сетевым заголовком, переносимое содержимое — полезной нагрузкой. Вместе они образуют сетевой пакет. В нашем примере смена адресата меняет назначение в заголовке, а строка «Привет» остаётся прежней. Пакет подготовлен на отправителе до помещения в кадр.'},
];
function forwardStep(state) {
 const p=state.packet, d=state.decision, destination=names[p.destination];
 if(state.stage===0) return {title:'Узел У получил кадр',question:'Какая часть принятого кадра нужна для продолжения сетевого пути?',explanation:'Кадр успешно доставлен У по входному участку. Внутри находится пакет целиком: сетевой заголовок вместе с полезной нагрузкой. Для сетевой обработки нужно выделить этот пакет, сохранив его заголовок.'};
 if(state.stage===1) return {title:'Из кадра выделен пакет',question:'По какому полю узел узнаёт, для кого предназначены данные?',explanation:`Поле назначения указывает ${destination}. Канальное оформление входного участка больше не требуется для решения о сетевой доставке. Узел читает сетевой заголовок; открывать или понимать содержимое сообщения ему для этого не нужно.`};
 if(state.stage===2 && d.action==='local') return {title:'Пакет предназначен самому У',question:'Нужно ли готовить кадр для другого узла?',explanation:'Назначение совпадает с самим У. Пакет передаётся соответствующим вышележащим функциям этого узла. Пересылка через выходное соединение для этого назначения не нужна.'};
 if(state.stage===2 && d.action==='unreachable') return {title:'Продолжение пути неизвестно',question:'Поможет ли успешный приём входного кадра выбрать произвольный выход?',explanation:'Узел получил пакет, но не имеет направления к Ж. Поэтому в этом примере пакет не пересылается. Исправность входного участка и наличие выходных соединений сами по себе не дают сведений о пути к адресату.'};
 if(state.stage===2) return {title:'Выбрано направление',question:'Почему выбран этот выход? Что узел узнал из пакета, а что ему было известно заранее?',explanation:`Назначение ${destination} прочитано из заголовка. Отдельно узлу известно, что продолжить путь к этому серверу можно через ${d.next}. Эти два сведения позволяют выбрать выход ${d.output}. Полная карта всех линий до сервера для показанного решения не требуется.`};
 if(state.stage===3) return {title:'Подготовлен новый кадр',question:'Кто получает новый кадр? Изменилось ли назначение пакета?',explanation:`Новый кадр передаётся У → ${d.next}. Получатель на этом участке — ${d.next}, а назначение пакета внутри — по-прежнему ${destination}. Следующий узел и конечный адресат выполняют разные роли. Выходной канальный уровень оформляет пакет для своего соединения.`};
 return {title:`Кадр получен узлом ${d.next}`,question:`Получение кадра узлом ${d.next} уже означает, что сервер ${destination} получил сообщение?`,explanation:`Пока подтверждён только шаг У → ${d.next}. Узел ${d.next} получил пакет для ${destination} и должен продолжить его путь. Факт приёма промежуточным узлом не является фактом доставки конечному серверу.`};
}
function directions(state) {
 return `<div class="node-demo-directions" role="group" aria-label="Известные узлу направления">${['D','E'].map(k=>{
 const r=destinations[k],active=state.decision.action==='forward'&&state.packet.destination===k;
 return `<div class="node-demo-direction ${active?'is-chosen':''}"><strong>Выход ${r.output} → узел ${r.next}</strong><span>Далее — к серверу ${names[k]}</span>${active?'<span class="node-demo-choice">Выбрано для этого пакета</span>':''}</div>`;
 }).join('')}</div>`;
}
export function mountNetworkNode(root) {
 const kind=root.dataset.networkNode;
 if(!['build','forward'].includes(kind)) return false;
 let destination='D',stage=0;
 const allowed=kind==='build'?['D','E']:['D','E','U','Z'];
 root.innerHTML=`<div class="node-demo-controls"><label>Адресат ${kind==='build'?'на отправителе':'пакета'} <select aria-label="${kind==='build'?'Адресат на отправителе':'Адресат пакета'}">${allowed.map(k=>`<option value="${k}">${escape(destinations[k].name)}</option>`).join('')}</select></label></div>
 <div class="node-demo-navigation"><button type="button" data-back>← Предыдущий шаг</button><span class="node-demo-status" aria-live="polite" aria-atomic="true"></span><button type="button" data-next>Следующий шаг →</button></div><div class="node-demo-view"></div>`;
 const view=root.querySelector('.node-demo-view'),select=root.querySelector('select');
 const back=root.querySelector('[data-back]'),next=root.querySelector('[data-next]');
 function draw() {
  const state=scene(kind,destination,stage); stage=state.stage;
  const step=kind==='build'?buildSteps[stage]:forwardStep(state);
  root.querySelector('.node-demo-status').textContent=`Шаг ${stage+1} из ${state.count}`;
  back.disabled=stage===0; next.disabled=stage===state.count-1;
  let visual='';
  if(kind==='build') visual=stage===0?'<div class="node-demo-raw"><strong>Данные, доступные узлу</strong><span>«Привет»</span></div>':packetView(state.packet,stage===1);
  else if(state.form==='incoming') visual=frameView(state.incoming);
  else if(state.form==='packet') visual=packetView(state.packet);
  else if(state.form==='decision') visual=packetView(state.packet)+(state.decision.action==='forward'?directions(state):`<div class="node-demo-result">${state.decision.action==='local'?'Получение самим узлом У':'Пакет не переслан: нет известного направления к Ж'}</div>`);
  else if(state.form==='outgoing') visual=`<div class="node-demo-comparison"><div><strong>Было: входной кадр</strong>${frameView(state.incoming)}</div><div><strong>Стало: выходной кадр</strong>${frameView(state.outgoing)}</div></div>`;
  else visual=`<div class="node-demo-result">Следующий узел ${state.decision.next} получил кадр</div>${frameView(state.outgoing)}<p class="node-demo-onward">Оставшийся шаг: ${state.decision.next} → сервер ${names[state.packet.destination]}</p>`;
  view.innerHTML=`<p class="node-demo-step-title">${escape(step.title)}</p><p class="node-demo-question">${escape(step.question)}</p><div class="node-demo-block">${visual}</div><details><summary>Объяснение этого шага</summary><p>${escape(step.explanation)}</p></details>`;
 }
 select.addEventListener('change',()=>{destination=select.value;draw();});
 back.addEventListener('click',()=>{stage--;draw();}); next.addEventListener('click',()=>{stage++;draw();});
 draw(); return true;
}
document.querySelectorAll('[data-network-node]').forEach(mountNetworkNode);
