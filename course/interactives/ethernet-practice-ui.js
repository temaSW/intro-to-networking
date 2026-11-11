import {DEFAULTS,compare,snapshot} from './ethernet-practice-model.js';
const fmt=n=>n.toLocaleString('ru-RU',{maximumFractionDigits:4});
const NS='http://www.w3.org/2000/svg';
const names={tx:'Исходная передача',wait:'Ожидание',retry:'Повтор',prop:'Распространение'};
let serial=0;
function svgNode(tag,attrs,parent){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);parent.append(e);return e;}
function landscape(id){return `<svg viewBox="0 0 150 90" role="img" aria-label="Иллюстрация передаваемого блока"><defs><linearGradient id="${id}" x2="0" y2="1"><stop stop-color="#65c8db"/><stop offset="1" stop-color="#dbefc7"/></linearGradient></defs><rect width="150" height="90" fill="url(#${id})"/><circle cx="117" cy="23" r="11" fill="#ffe7a0"/><path d="M0 82 46 23 90 80 116 40 150 79V90H0Z" fill="#397f8b"/><path d="m28 46 18-23 20 25-19-8Z" fill="#e2f1ed"/><path d="M0 77Q45 58 81 78T150 68V90H0Z" fill="#1d6058"/></svg>`;}
export function mountEthernet(root){
 const uid='eth-'+(++serial),form=root.querySelector('form'),play=root.querySelector('[data-play]'),reset=root.querySelector('[data-reset]'),seek=root.querySelector('[data-seek]'),speed=root.querySelector('[data-speed]'),clock=root.querySelector('[data-clock]'),status=root.querySelector('[data-status]');
 let config={...DEFAULTS},lanes=[],views=[],horizon=0,time=0,running=false,last=null,raf=0,announced='';
 const stop=()=>{running=false;last=null;cancelAnimationFrame(raf);play.textContent=time>=horizon?'Повторить':'Продолжить';};
 function build(){
  lanes=compare(config);horizon=Math.max(...lanes.map(l=>l.end))*1.08;
  root.querySelector('[data-lanes]').innerHTML=lanes.map((l,i)=>`<section class="eth-lane" aria-label="Вариант ${i?'Б':'А'}"><div class="eth-lane-title"><strong>${i?'Б · 15 кадров по 100 байт':'А · 1 кадр с 1500 байтами'}</strong><span data-stage></span></div><div class="eth-scene"><div class="eth-device"><div class="eth-screen">${landscape(uid+'-source-'+i)}</div><div class="eth-foot"></div><span>Отправитель</span></div><div class="eth-wire"><svg data-stream role="img" aria-label="Кадры движутся слева направо; ответ протокола — справа налево"></svg><div class="eth-wire-caption" data-wire-caption></div></div><div class="eth-device"><div class="eth-screen eth-receiver">${landscape(uid+'-receiver-'+i)}<div class="eth-mask">${Array.from({length:15},()=>'<span></span>').join('')}</div></div><div class="eth-foot"></div><span data-received>0 / 1500 байт</span></div></div><div class="eth-timeline" data-timeline role="img"></div><div class="eth-ticks"><span>0</span><span>${fmt(horizon/2)} мс</span><span>${fmt(horizon)} мс</span></div><div class="eth-stats"><div><span>Доставка блока</span><strong>${fmt(l.end)} мс</strong></div><div><span>Всего MAC-байтов</span><strong>${l.wireBytes}</strong></div><div><span>Повторно</span><strong>${l.retryBytes} байт</strong></div></div><div class="eth-breakdown">${l.phases.filter(p=>p.end-p.start>1e-10).map(p=>`<span class="eth-phase-${p.kind}">${names[p.kind]}: ${fmt(p.end-p.start)} мс</span>`).join('')}</div></section>`).join('');
  views=lanes.map((lane,i)=>{
   const section=root.querySelectorAll('.eth-lane')[i],svg=section.querySelector('[data-stream]');
   const clipId=uid+'-clip-'+i,defs=svgNode('defs',{},svg),clip=svgNode('clipPath',{id:clipId},defs),clipRect=svgNode('rect',{x:0,y:10,height:58},clip);
   const rail=svgNode('line',{class:'eth-rail',x1:0,y1:40,y2:40},svg),group=svgNode('g',{'clip-path':`url(#${clipId})`},svg);
   const marks=lane.frames.map(f=>{
    const g=svgNode('g',{},group),parts=[];
    let offset=0;
    for(const[cls,bytes]of [['eth-packet-header',14],['eth-packet-data',lane.payload],['eth-packet-header',4]]){parts.push({node:svgNode('rect',{class:cls,y:27,height:26,rx:0},g),offset,duration:lane.tx*bytes/lane.bytes});offset+=lane.tx*bytes/lane.bytes;}
    const label=svgNode('text',{class:'eth-packet-label',y:45,'text-anchor':'middle'},g);
    label.textContent=f.retry?'↻':f.index+1;
    return{f,g,parts,label};
   });
   const feedback=svgNode('text',{class:'eth-feedback',y:19,'text-anchor':'middle'},svg);feedback.textContent='← ответ';
   const timeline=section.querySelector('[data-timeline]');timeline.setAttribute('aria-label',lane.phases.map(p=>`${names[p.kind]} ${fmt(p.end-p.start)} мс`).join('; '));
   timeline.innerHTML=lane.phases.filter(p=>p.end>p.start).map(p=>`<span class="eth-time-segment eth-phase-${p.kind}" style="left:${p.start/horizon*100}%;width:${(p.end-p.start)/horizon*100}%" title="${names[p.kind]}: ${fmt(p.end-p.start)} мс"></span>`).join('')+'<span class="eth-time-cursor"></span>';
   return{lane,section,svg,clipRect,rail,marks,feedback,timeline,cursor:timeline.querySelector('.eth-time-cursor'),stage:section.querySelector('[data-stage]'),received:section.querySelector('[data-received]'),mask:[...section.querySelectorAll('.eth-mask span')],caption:section.querySelector('[data-wire-caption]'),width:300};
  });resize();
 }
 function resize(){for(const v of views){v.width=Math.max(80,v.svg.getBoundingClientRect().width);v.svg.setAttribute('viewBox',`0 0 ${v.width} 78`);v.clipRect.setAttribute('width',v.width);v.rail.setAttribute('x2',v.width);}draw();}
 function draw(){
  clock.textContent=`t = ${fmt(time)} мс`;seek.value=Math.round(time/horizon*1000);seek.setAttribute('aria-valuetext',`${fmt(time)} мс`);
  const states=[];
  for(const v of views){
   const l=v.lane,s=snapshot(l,time);states.push(s.stage);v.stage.textContent=s.stage;v.received.textContent=`${s.received} / 1500 байт`;v.caption.textContent=s.done?'✓ Блок собран':`${fmt(s.sent)} MAC-байт отправлено`;
   v.mask.forEach((tile,i)=>{const index=l.count===1?0:i;tile.classList.toggle('eth-arrived',s.accepted.has(index));tile.classList.toggle('eth-missing',config.error&&index===l.bad&&time>=l.frames[l.bad].arrival&&!s.accepted.has(index));});
   // Exact bit positions for nonzero propagation. For zero delay, show emission at centre.
   const prop=config.propagation;
   for(const m of v.marks){
    const active=time>=m.f.start&&time<m.f.arrival;
    m.g.style.display=active?'':'none';if(!active)continue;
    const denom=prop||Math.max(l.tx,.01);
    for(const p of m.parts){const right=(time-m.f.start-p.offset)/denom*v.width;const width=p.duration/denom*v.width;p.node.setAttribute('x',right-width);p.node.setAttribute('width',width);}
    const damaged=m.f.damaged&&time>=m.f.start+prop/2;
    m.g.classList.toggle('eth-corrupted',damaged);m.g.classList.toggle('eth-retrying',m.f.retry);
    const head=Math.min(v.width,(time-m.f.start)/denom*v.width),tail=Math.max(0,(time-m.f.end)/denom*v.width),span=head-tail;
    m.label.setAttribute('x',(head+tail)/2);m.label.textContent=damaged?'×':m.f.retry?'↻':m.f.index+1;m.label.style.display=span>23?'':'none';
   }
   const show=config.error&&time>=l.feedbackStart&&time<l.feedbackEnd;
   v.feedback.style.display=show?'':'none';if(show)v.feedback.setAttribute('x',Math.max(28,Math.min(v.width-28,v.width*(1-(time-l.feedbackStart)/prop))));
   v.cursor.style.left=`${Math.min(time,l.end)/horizon*100}%`;
  }
  const key=states.join('|');if(key!==announced){status.textContent=`А: ${states[0]}. Б: ${states[1]}.`;announced=key;}
 }
 function tick(now){if(!running)return;if(last!==null)time=Math.min(horizon,time+(now-last)/12000*horizon*Number(speed.value));last=now;draw();if(time>=horizon){stop();return;}raf=requestAnimationFrame(tick);}
 play.addEventListener('click',()=>{if(running){stop();return;}if(time>=horizon)time=0;running=true;last=null;play.textContent='Пауза';raf=requestAnimationFrame(tick);});
 reset.addEventListener('click',()=>{stop();time=0;play.textContent='Запустить';draw();});
 seek.addEventListener('input',()=>{stop();time=Number(seek.value)/1000*horizon;draw();});
 form.addEventListener('submit',e=>e.preventDefault());
 form.addEventListener('change',()=>{stop();config={rate:Number(form.elements.rate.value),propagation:Number(form.elements.propagation.value),recovery:Number(form.elements.recovery.value),error:form.elements.error.checked};time=0;play.textContent='Запустить';build();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)stop();});
 new ResizeObserver(resize).observe(root);build();
}
document.querySelectorAll('[data-ethernet-practice]').forEach(mountEthernet);
