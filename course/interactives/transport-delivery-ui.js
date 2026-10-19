import {start, step, BLOCKS, CAPACITY, BASE} from './transport-delivery-model.js';
export function mountTransport(root) {
  let state=start(), playing=null;
  root.innerHTML=`<form class="transport-controls">
    <label>Транспорт<select name="protocol"><option value="tcp">TCP</option><option value="udp">UDP</option></select></label>
    <label>IP-сеть<select name="fault"><option value="none">Без нарушений</option><option value="loss">Потеря блока 2</option><option value="reorder">Блок 3 раньше блока 2</option><option value="delay">Задержка блока 2</option><option value="duplicate">Дубликат блока 3</option></select></label>
    <label>Чтение приложением<select name="reader"><option value="normal">4 байта каждый такт</option><option value="slow">4 байта каждые 4 такта</option></select></label>
    <label>Приложение назначения<select name="application"><option value="web">Веб-служба · порт 8080</option><option value="chat">Мессенджер · порт 9000</option></select></label>
    <div class="transport-actions"><button type="button" data-play>Запустить</button><button type="button" data-step>Один такт</button><button type="button" data-reset>К началу</button></div>
    </form><p>Что получит приложение при выбранном условии? Когда оно сможет прочитать блок 3?</p>
    <div data-scene></div><div class="transport-event" role="status" aria-live="polite" data-event></div>
    <details><summary>Журнал обмена</summary><ol data-history></ol></details>`;
  const form=root.querySelector('form');
  const render=()=> {
    const tcp=state.protocol==='tcp';
    const block=(text,label)=>`<span class="transport-block"><strong>${text}</strong><small>${label}</small></span>`;
    root.querySelector('[data-scene]').innerHTML=`<p><strong>Такт ${state.time}</strong> · ${tcp?'TCP: номера байтов, ACK -- следующий ожидаемый байт':'UDP: номера блоков -- метки наблюдателя, их нет в заголовке'}</p>
    <div class="transport-path"><section><h3>Хост A</h3><p>${state.source}</p><p>Браузер · 51000<br>Мессенджер · 52000</p><strong>Источник: порт ${state.sourcePort}</strong></section>
    <section><h3>IP-сеть</h3><p>Данные → · ← подтверждения</p><p>Маршрутизаторы пересылают IP-пакеты</p><p>${state.wire.length} событий в пути</p><div class="transport-wire">${state.wire.map(p=>p.kind==='ack'?block('← ACK '+(BASE+p.ack),'окно '+(p.edge-p.ack)+' байт'):block('→ '+BLOCKS[p.index],tcp?'SEQ '+(BASE+p.index*4):'датаграмма '+(p.index+1))).join('')}</div></section>
    <section><h3>Хост B</h3><p>${state.destination}</p><p>Веб-служба · 8080<br>Мессенджер · 9000</p><strong>Назначение: порт ${state.destinationPort}</strong></section></div>
    <div class="transport-strip"><strong>Ещё у отправителя</strong><div>${BLOCKS.slice(state.sent).map(t=>block(t,'4 байта')).join('')||'Все блоки отправлены'}</div></div>
    <div class="transport-strip"><strong>${tcp?'Неподтверждённые данные':'Датаграммы в пути'}</strong><div>${tcp?state.pending.map(b=>block(BLOCKS[b.index],'SEQ '+(BASE+b.index*4))).join('')||'Нет':state.wire.filter(p=>p.kind==='data').map(p=>block(BLOCKS[p.index],'блок '+(p.index+1))).join('')||'Нет'}</div></div>
    <div class="transport-strip"><strong>Буфер приёмника · ${state.buffer.length*4} / ${CAPACITY} байт</strong><div>${state.buffer.map(b=>block(b.text,tcp?(b.index*4>=state.next?'ожидает пропуск':'доступен для чтения'):'датаграмма')).join('')||'Пусто'}</div></div>
    <div class="transport-strip"><strong>Приложение уже прочитало</strong><div>${tcp?`<code>${state.output.join('')||'∅'}</code>`:state.output.map(t=>block(t,'отдельная датаграмма')).join('')||'Пока ничего'}</div></div>
    ${tcp?`<p>У отправителя: ACK ${BASE+state.ack}, объявленное окно ${state.edge-state.ack} байт. У приёмника: следующий ожидаемый байт ${BASE+state.next}. Подтверждение приёма не означает чтения приложением.</p>`:'<p>UDP сам не отправляет ACK, не восстанавливает потери и не регулирует скорость по свободному буферу получателя.</p>'}`;
    root.querySelector('[data-event]').textContent=state.events.join(' ')||'До запуска: 20 байт данных; буфер приёмника пуст.';
    root.querySelector('[data-history]').innerHTML=state.history.map(e=>`<li>Такт ${e.time}: ${e.message}</li>`).join('');
    root.querySelector('[data-step]').disabled=state.done;
    root.querySelector('[data-play]').disabled=state.done;
  };
  const pause=()=>{clearInterval(playing);playing=null;root.querySelector('[data-play]').textContent='Запустить';};
  const advance=()=>{state=step(state);if(state.done)pause();render();};
  const reset=()=>{pause();state=start(form.elements.protocol.value,form.elements.fault.value,form.elements.reader.value,form.elements.application.value);render();};
  form.addEventListener('submit',e=>e.preventDefault());
  form.addEventListener('change',reset);
  root.querySelector('[data-step]').addEventListener('click',()=>{pause();advance();});
  root.querySelector('[data-reset]').addEventListener('click',reset);
  root.querySelector('[data-play]').addEventListener('click',()=>{
    if(playing)pause();else {playing=setInterval(advance,1000);root.querySelector('[data-play]').textContent='Пауза';}
  });
  render();
}
document.querySelectorAll('[data-transport-delivery]').forEach(mountTransport);
