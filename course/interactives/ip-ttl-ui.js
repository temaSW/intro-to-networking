import {startLoop, nextLoop} from './ip-ttl-model.js';

const FLIGHT_MS = 900;
const DWELL_MS = 250;

export function mountTTL(root) {
  const get = key => root.querySelector(`[data-ttl-${key}]`);
  const limited=get('limited'), range=get('range'), number=get('number');
  const play=get('play'), step=get('step'), packet=get('packet');
  let state=startLoop(), running=false, flight=null, frame=0, previous=null, dwell=0;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const ttl = value => value === null ? 'Без ограничения' : `TTL = ${value}`;
  function draw() {
    for (const node of root.querySelectorAll('[data-ttl-router]')) node.classList.toggle('ip-current', node.dataset.ttlRouter===state.node && !flight);
    packet.classList.toggle('ip-ttl-dropped',state.expired);
    const shown=state;
    get('badge').textContent=state.expired ? 'TTL = 0 · сброс' : ttl(shown.ttl);
    if (flight && !reduced.matches) {
      const progress=Math.min(1,flight.elapsed/FLIGHT_MS);
      const eased=progress*progress*(3-2*progress);
      const point=flight.path.getPointAtLength(flight.path.getTotalLength()*eased);
      packet.setAttribute('transform',`translate(${point.x} ${point.y})`);
    } else packet.setAttribute('transform',`translate(${state.node==='R1' ? 150 : 570} 125)`);
    play.textContent=running ? 'Пауза' : 'Запуск';
    play.disabled=state.expired; step.disabled=state.expired;
  }
  function announce() {
    get('status').textContent=state.expired
      ? `${state.node}: TTL 1 → 0. Пакет отброшен. Выполнено пересылок: ${state.hops}.`
      : `Пакет на ${state.node}, готов к отправке. ${ttl(state.ttl)}. Выполнено пересылок: ${state.hops}.`;
  }
  function pause() { running=false; cancelAnimationFrame(frame); previous=null; draw(); }
  function begin() {
    const next=nextLoop(state);
    flight={next,elapsed:0,path:root.querySelector(`[data-ttl-path="${state.node}"]`)};
  }
  function tick(now) {
    if (!running) return;
    if (!root.isConnected) {pause();return;}
    const dt=previous===null ? 0 : Math.min(100,now-previous); previous=now;
    if (!flight) {dwell+=dt;if(dwell>=DWELL_MS){dwell=0;begin();}}
    else {
      flight.elapsed+=dt;
      if(flight.elapsed>=FLIGHT_MS){state=flight.next;flight=null;if(state.expired)pause();announce();}
    }
    draw();if(running) frame=requestAnimationFrame(tick);
  }
  function reset() {pause();flight=null;dwell=0;number.value=range.value;state=startLoop(limited.checked,Number(range.value));draw();announce();}
  play.addEventListener('click',()=>{if(running){pause();return;}running=true;previous=null;draw();frame=requestAnimationFrame(tick);});
  step.addEventListener('click',()=>{pause();state=flight ? flight.next : nextLoop(state);flight=null;dwell=0;draw();announce();});
  get('reset').addEventListener('click',reset);
  const expand=get('expand');
  if (root.requestFullscreen) {
    expand.hidden=false;
    expand.addEventListener('click',async()=>{
      try {if(document.fullscreenElement===root) await document.exitFullscreen();else await root.requestFullscreen();}
      catch {get('status').textContent='Полноэкранный режим недоступен. Управление доступно в обычном виде.';}
    });
    document.addEventListener('fullscreenchange',()=>{expand.textContent=document.fullscreenElement===root ? 'Обычный вид' : 'На весь экран';});
  }
  limited.addEventListener('change',()=>{range.disabled=number.disabled=!limited.checked;reset();});
  range.addEventListener('input',()=>{number.value=range.value;reset();});
  number.addEventListener('input',()=>{if(number.validity.valid && number.value!==''){range.value=number.value;reset();}});
  number.addEventListener('change',()=>{if(!number.validity.valid || number.value===''){number.value=range.value;}reset();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  get('controls').hidden=false;draw();announce();
}
document.querySelectorAll('[data-ttl-loop]').forEach(mountTTL);
