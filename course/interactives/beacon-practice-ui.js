import {BEACON,beaconPlan,beaconState} from './pcm-beacon-model.js';
import {playback} from './practice-playback.js';
const fmt=v=>v.toLocaleString('ru-RU',{maximumFractionDigits:2});
export function mountBeacon(root){
 const mode=root.querySelector('[data-mode]'),listenInput=root.querySelector('[data-listen]'),custom=root.querySelector('[data-custom]');
 let listen=.5,plans=[],views=[],lastAnnouncement='';
 const laneContainer=root.querySelector('[data-beacon-lanes]');
 laneContainer.innerHTML=BEACON.periods.map(period=>`<section class="beacon-lane"><div class="sp-section-label"><strong>Период ${period} мс</strong><span data-stage></span></div><div class="beacon-scene"><div class="beacon-ap"><div class="beacon-antenna"></div><div class="beacon-router"><span></span><span></span><span></span></div><span>Точка доступа</span></div><div class="beacon-air" aria-hidden="true"><span></span><span></span><span></span><strong data-air-label></strong></div><div class="beacon-laptop"><div class="beacon-display"><span data-network>Поиск сети…</span><span class="beacon-network" data-network-found hidden>✓ Учебная сеть</span></div><div class="eth-foot"></div><span data-wait-clock></span></div></div><div class="beacon-track" role="img" aria-label="Маяки за одну секунду, период ${period} мс"><div class="beacon-wait-band"></div>${Array.from({length:1000/period},(_,i)=>`<span class="beacon-mark" style="left:${i*period/10}%;width:0.05%" title="Beacon ${i+1}: ${i*period}–${i*period+.5} мс"></span>`).join('')}<span class="beacon-listen-marker" title="Включение приёма"></span><span class="beacon-detect-marker" title="Полный приём следующего Beacon"></span><span class="beacon-time-cursor"></span></div><div class="eth-ticks"><span>0</span><span>500 мс</span><span>1000 мс</span></div><div class="beacon-closeup"><div class="beacon-zoom-label"><strong>До обнаружения</strong><span data-detail></span></div><div class="beacon-wait-progress"><span data-wait-progress></span></div><span class="beacon-then">→</span><div class="beacon-receive-progress"><span data-receive-progress></span><b>Приём · 0,5 мс</b></div></div><div class="sp-metrics"><div><span>До полного приёма</span><strong data-wait-total></strong></div><div><span>Маяки за секунду</span><strong>${1000/period}</strong></div><div><span>Эфир за секунду</span><strong>${1000/period*.5} мс</strong></div></div><div class="beacon-observed" data-observed></div></section>`).join('');
 views=[...laneContainer.children].map(section=>({section,stage:section.querySelector('[data-stage]'),network:section.querySelector('[data-network]'),found:section.querySelector('[data-network-found]'),air:section.querySelector('.beacon-air'),airLabel:section.querySelector('[data-air-label]'),clock:section.querySelector('[data-wait-clock]'),cursor:section.querySelector('.beacon-time-cursor'),wait:section.querySelector('[data-wait-progress]'),receive:section.querySelector('[data-receive-progress]'),detail:section.querySelector('[data-detail]'),observed:section.querySelector('[data-observed]')}));
 function configure(){plans=BEACON.periods.map(p=>beaconPlan(p,listen));views.forEach((v,i)=>{const p=plans[i];v.section.querySelector('.beacon-listen-marker').style.left=`${listen/10}%`;v.section.querySelector('.beacon-detect-marker').style.left=`${p.end/10}%`;const band=v.section.querySelector('.beacon-wait-band');band.style.left=`${listen/10}%`;band.style.width=`${p.wait/10}%`;v.section.querySelector('[data-wait-total]').textContent=`${fmt(p.wait)} мс`;});}
 function draw(time){
  root.querySelector('[data-clock]').textContent=`t = ${fmt(time)} мс`;
  const states=[];
  views.forEach((v,i)=>{
   const p=plans[i],s=beaconState(p,time);states.push(`${p.period} мс: ${s.stage}`);
   v.stage.textContent=s.stage;v.network.textContent=s.stage;v.network.hidden=s.discovered;v.found.hidden=!s.discovered;
   v.section.classList.toggle('beacon-discovered',s.discovered);v.section.classList.toggle('beacon-transmitting',s.sending);
   v.section.classList.toggle('beacon-listening',s.listening);
   // A brief afterglow shows each short transmission without changing its model duration.
   const since=time%p.period,glow=time<1000&&since<Math.min(12,p.period/4);
   v.air.classList.toggle('beacon-glow',glow);v.air.style.setProperty('--beacon-wave',String(Math.min(1,since/12)));
   v.airLabel.textContent=s.sending?'Beacon':glow?'Маяк отправлен':'';
   v.clock.textContent=!s.listening?'Приём выключен':s.discovered?`Обнаружена за ${fmt(p.wait)} мс`:`Ожидание: ${fmt(s.waited)} мс`;
   v.cursor.style.left=`${Math.min(100,time/10)}%`;
   const before=p.nextStart-p.listen;
   v.wait.style.width=`${before<=0?100:Math.max(0,Math.min(100,(time-p.listen)/before*100))}%`;
   v.receive.style.width=`${Math.max(0,Math.min(100,(time-p.nextStart)/.5*100))}%`;
   v.detail.textContent=!s.listening?'Приём ещё не включён':s.discovered?`Приём завершён в ${fmt(p.end)} мс`:s.receiving?'Принимается весь маяк':`До начала маяка: ${fmt(Math.max(0,p.nextStart-time))} мс`;
   v.observed.textContent=`С начала шкалы: маяков завершено — ${s.completed} · занято ${fmt(s.occupied)} мс эфира`;
   v.section.querySelector('.beacon-track').setAttribute('aria-label',`Период ${p.period} мс: приём включён в ${fmt(listen)} мс, сеть обнаружена в ${fmt(p.end)} мс; текущее время ${fmt(time)} мс`);
  });
  const message=states.join('. ');if(message!==lastAnnouncement){root.querySelector('[data-live]').textContent=message;lastAnnouncement=message;}
 }
 configure();
 const player=playback(root,{start:.5,wallMs:14000,draw});
 function changeListen(){listen=mode.value==='task'?.5:Number(listenInput.value);custom.hidden=mode.value!=='custom';root.querySelector('[data-listen-value]').textContent=`${fmt(listen)} мс`;configure();player.reset(listen);}
 mode.addEventListener('change',changeListen);listenInput.addEventListener('input',changeListen);
 root.querySelector('[data-event]').addEventListener('click',()=>{
  // Include start / midpoint / end of the first receivable Beacon to expose 0.5 ms.
  const events=[listen,...plans.flatMap(p=>[p.nextStart,p.nextStart+.25,p.end]),1000].sort((a,b)=>a-b);
  player.set(events.find(t=>t>player.time+1e-7)??1000);
 });
 draw(.5);
}
document.querySelectorAll('[data-beacon-practice]').forEach(mountBeacon);
