import {PCM,channelSlot,sampleCode,pcmState} from './pcm-beacon-model.js';
import {playback} from './practice-playback.js';
const fmt=v=>v.toLocaleString('ru-RU',{maximumFractionDigits:2});
const NS='http://www.w3.org/2000/svg';
function node(tag,attrs,parent){const n=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);parent.append(n);return n;}
export function mountPCM(root){
 const select=root.querySelector('[data-channel]'),slots=root.querySelector('[data-slots]'),bits=root.querySelector('[data-bits]'),history=root.querySelector('[data-history]');
 let channel=1,lastAnnouncement='';
 select.innerHTML=Array.from({length:30},(_,i)=>`<option value="${i+1}">Канал ${i+1} · КИ${channelSlot(i+1)}</option>`).join('');
 slots.innerHTML=Array.from({length:32},(_,i)=>[0,16].includes(i)?`<div class="pcm-slot pcm-service" aria-label="КИ${i}: служебный"><span>${i}</span></div>`:`<button type="button" class="pcm-slot" data-slot="${i}" aria-pressed="false" aria-label="КИ${i}, речевой канал ${i<16?i:i-1}"><span>${i}</span></button>`).join('');
 bits.innerHTML=Array.from({length:8},()=>'<span></span>').join('');
 history.innerHTML=Array.from({length:8},(_,i)=>`<div class="pcm-history-item"><span>Цикл ${i+1}</span><strong>—</strong><span>${i*125} мкс</span></div>`).join('');
 const slotNodes=[...slots.children],bitNodes=[...bits.children],historyNodes=[...history.children];
 function signal(svg,receiver){svg.setAttribute('viewBox','0 0 300 112');node('line',{x1:12,x2:288,y1:54,y2:54,class:'pcm-axis'},svg);const path=node('polyline',{class:receiver?'pcm-received-line':'pcm-source-line',fill:'none'},svg);const stems=[],dots=[];for(let i=0;i<8;i++){stems.push(node('line',{class:'pcm-stem'},svg));dots.push(node('circle',{r:4,class:'pcm-dot'},svg));}return{path,stems,dots};}
 const source=signal(root.querySelector('[data-source]'),false),destination=signal(root.querySelector('[data-destination]'),true);
 function draw(time){
  const s=pcmState(time,channel),slot=channelSlot(channel),codes=Array.from({length:8},(_,i)=>sampleCode(channel,i));
  root.querySelector('[data-clock]').textContent=`t = ${fmt(time)} мкс`;
  root.querySelector('[data-source-label]').textContent=`Канал ${channel} · отправитель`;
  root.querySelector('[data-destination-label]').textContent=`Канал ${channel} · получатель`;
  root.querySelector('[data-cycle]').textContent=time>=1000?'8 циклов завершены':`Цикл ${s.cycle+1} из 8 · передаётся КИ${s.activeSlot}`;
  root.querySelector('[data-code]').textContent=s.code.toString(2).padStart(8,'0');
  const points=codes.map((code,i)=>({x:15+i*38.5,y:96-code/255*82}));
  for(const[view,isReceiver]of [[source,false],[destination,true]]){
   view.path.setAttribute('points',points.filter((_,i)=>!isReceiver||s.received[i]).map(p=>`${p.x},${p.y}`).join(' '));
   points.forEach((p,i)=>{const visible=!isReceiver||s.received[i];view.dots[i].setAttribute('cx',p.x);view.dots[i].setAttribute('cy',p.y);view.dots[i].style.opacity=visible?'1':'0';view.dots[i].classList.toggle('pcm-current-sample',i===s.cycle);for(const[k,v]of Object.entries({x1:p.x,x2:p.x,y1:100,y2:p.y}))view.stems[i].setAttribute(k,v);view.stems[i].style.opacity=visible?'1':'0';});
  }
  slotNodes.forEach((n,i)=>{n.classList.toggle('pcm-selected',i===slot);n.classList.toggle('pcm-active',i===s.activeSlot);n.classList.toggle('pcm-passed',time>=1000||(s.activeSlot!==null&&i<s.activeSlot));if(n.tagName==='BUTTON')n.setAttribute('aria-pressed',String(i===slot));});
  const binary=s.code.toString(2).padStart(8,'0'),arrived=s.received[s.cycle];
  bitNodes.forEach((n,i)=>{n.textContent=binary[i];n.classList.toggle('pcm-bit-sent',arrived||(s.activeSlot===slot&&i<s.bitsInSlot));});
  root.querySelector('[data-byte-label]').textContent=`Канал ${channel} → КИ${slot} · отсчёт цикла ${s.cycle+1}`;
  root.querySelector('[data-slot-state]').textContent=arrived?'Отсчёт получен':s.activeSlot===slot?'Сейчас передаётся':'Ожидает своего КИ';
  root.querySelector('.pcm-gateway').classList.toggle('pcm-emitting',s.activeSlot===slot);
  historyNodes.forEach((n,i)=>{n.classList.toggle('pcm-history-received',s.received[i]);n.classList.toggle('pcm-history-current',i===s.cycle);n.querySelector('strong').textContent=s.received[i]?codes[i].toString(2).padStart(8,'0'):'········';});
  root.querySelector('[data-total-bits]').textContent=`${s.bits} бит`;
  root.querySelector('[data-voice-bits]').textContent=`${s.speechBits} бит`;
  root.querySelector('[data-service-bits]').textContent=`${s.serviceBits} бит`;
  const message=`Канал ${channel}: получено ${s.received.filter(Boolean).length} из 8 отсчётов. Завершено циклов: ${s.completedCycles}.`;
  if(message!==lastAnnouncement){root.querySelector('[data-live]').textContent=message;lastAnnouncement=message;}
 }
 const player=playback(root,{draw});
 select.addEventListener('change',()=>{channel=Number(select.value);player.set(player.time);});
 slots.addEventListener('click',e=>{const b=e.target.closest('[data-slot]');if(!b)return;const slot=Number(b.dataset.slot);channel=slot<16?slot:slot-1;select.value=channel;player.set(player.time);});
 root.querySelector('[data-next]').addEventListener('click',()=>player.set(Math.min(1000,(Math.floor(player.time/125+1e-9)+1)*125)));
 draw(0);
}
document.querySelectorAll('[data-pcm-practice]').forEach(mountPCM);
