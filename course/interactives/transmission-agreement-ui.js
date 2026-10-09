import * as model from './transmission-agreement-model.js';
import {mountAgreementScene} from './transmission-agreement-scenes.js';
const fmt=(v,d=2)=>v.toLocaleString('ru-RU',{maximumFractionDigits:d});
const colors=['var(--ta-blue)','var(--ta-orange)','var(--ta-purple)','var(--ta-green)'];
const metric=(name,value)=>`<div class="ta-metric"><span>${name}</span><strong>${value}</strong></div>`;
function plot(title,series,{xmin=0,xmax=100,ymin=-1.5,ymax=1.5,xlabel='',ylabel='',marks=[],bands=[],square=false,width=760,height=280}={}) {
  const w=square?420:width,h=square?w:height,l=65,r=20,t=20,b=48;
  const x=v=>l+(v-xmin)/(xmax-xmin)*(w-l-r),y=v=>h-b-(v-ymin)/(ymax-ymin)*(h-t-b);
  const ticks=Array.from({length:5},(_,i)=>{
    const rawX=xmin+(xmax-xmin)*i/4,xx=!square&&Number.isInteger(xmin)&&Number.isInteger(xmax)?Math.round(rawX):rawX,yy=ymin+(ymax-ymin)*i/4;
    return `<path class="ta-grid" d="M${x(xx)} ${t}V${h-b}M${l} ${y(yy)}H${w-r}"/><text x="${x(xx)}" y="${h-b+20}" text-anchor="middle">${fmt(xx)}</text><text x="${l-8}" y="${y(yy)+4}" text-anchor="end">${fmt(yy)}</text>`;
  }).join('');
  const outside=series.reduce((sum,s)=>sum+s.points.filter(([a,c])=>a<xmin||a>xmax||c<ymin||c>ymax).length,0);
  const paths=series.map((s,i)=>{
    const color=s.color||colors[i%4];
    if(s.stems)return s.points.map(([a,c])=>`<path stroke="${color}" stroke-width="2" d="M${x(a)} ${y(0)}V${y(c)}"/><circle cx="${x(a)}" cy="${y(c)}" r="2.5" fill="${color}"/>`).join('');
    return s.dots?s.points.map(([a,c])=>`<circle ${s.id?`data-series="${s.id}"`:""} cx="${x(a)}" cy="${y(c)}" r="${s.radius||4}" fill="${color}"/>`).join(''):
      `<path ${s.id?`data-series="${s.id}"`:""} fill="none" stroke="${color}" stroke-width="2.5" ${s.dash?'stroke-dasharray="6 4"':''} d="${s.points.map(([a,c],j)=>`${j?'L':'M'}${x(a)},${y(c)}`).join(' ')}"/>`;
  }).join('');
  const shading=bands.map(({from,to})=>`<rect data-band x="${x(from)}" y="${t}" width="${x(to)-x(from)}" height="${h-t-b}" fill="var(--accent)" opacity=".12"/>`).join('');
  const markers=marks.map(({at,label})=>`<path class="ta-guide" d="M${x(at)} ${t}V${h-b}"/><text x="${x(at)+4}" y="${t+12}">${label||''}</text>`).join('');
  return `<figure class="ta-plot"><figcaption>${title}</figcaption><div class="ta-plot-scroll ${square?'ta-square':''}" tabindex="0" role="region" aria-label="${title} · график"><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}">${ticks}<svg x="${l}" y="${t}" width="${w-l-r}" height="${h-t-b}" viewBox="${l} ${t} ${w-l-r} ${h-t-b}">${shading}${paths}${markers}</svg><text x="${(l+w-r)/2}" y="${h-5}" text-anchor="middle">${xlabel}</text><text x="${l}" y="14">${ylabel}</text></svg></div><div class="ta-legend">${series.map((s,i)=>`<span><i class="${s.dash?'ta-dashed':s.dots?'ta-dot':''}" style="--series-color:${s.color||colors[i%4]}"></i>${s.name}</span>`).join('')}</div>${outside?`<p class="ta-note">За пределами шкалы: ${outside} точек.</p>`:''}</figure>`;
}
const points=values=>values.map((v,i)=>[i,v]);
let controlId=0;
const range=(key,label,min,max,step,value,unit='')=>{
  const id=`ta-control-${++controlId}`;
  return `<label for="${id}">${label} <output for="${id}" data-output="${key}">${value} ${unit}</output><input id="${id}" aria-label="${label}" type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}" data-unit="${unit}"></label>`;
};
const select=(key,label,options,value)=>{
  const id=`ta-control-${++controlId}`;
  return `<label for="${id}">${label}<select id="${id}" aria-label="${label}" data-key="${key}">${options.map(v=>`<option ${v===value?'selected':''}>${v}</option>`).join('')}</select></label>`;
};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const device=id=>String.fromCharCode(65+id);
function mount(root) {
  if(mountAgreementScene(root,{range,select,plot,metric,fmt,escape}))return;
  const kind=root.dataset.agreement;
  let seed=1,opened=[];
  const configurations={
    pilots:`${range('center','Положение провала',8,55,1,24,'поднесущая')}${range('depth','Глубина провала',0,.95,.05,.8)}${range('spacing','Шаг пилотов',2,16,1,16,'поднесущих')}${range('snr','ОСШ',0,40,1,40,'дБ')}`,
  };
  if(!configurations[kind])return;
  root.innerHTML=`<div class="ta-controls">${configurations[kind]}</div><div class="ta-result"></div>`;
  const target=root.querySelector('.ta-result');
  function draw() {
    const chartWidth=760,pairWidth=420;
    const chart=(title,series,options={})=>plot(title,series,{width:options.full?chartWidth:pairWidth,...options});
    const params={seed};
    root.querySelectorAll('[data-key]').forEach(el=>{
      params[el.dataset.key]=el.tagName==='SELECT'?el.value:Number(el.value);
      const output=root.querySelector(`[data-output="${el.dataset.key}"]`);
      if(output)output.textContent=el.dataset.key==='snr'&&el.value==='40'?'Без шума':`${fmt(Number(el.value))} ${el.dataset.unit||''}`;
    });
    if(params.snr===40)params.snr=Infinity;
    let content='',stats='';
    const constellationChart=(title,cloud,reference=model.constellation('QPSK').map(a=>a.point),selected=null)=>{
      const limit=1.8;
      const series=[{name:'Переданные точки · для сравнения',points:reference,dots:true,radius:7,color:colors[0]},
        {name:'Принятые символы',points:cloud,dots:true,radius:3,color:colors[1]}];
      if(selected!==null)series.push({name:'Наблюдаемый символ',points:[cloud[selected]],dots:true,radius:6,color:colors[2]});
      return chart(title,series,{xmin:-limit,xmax:limit,ymin:-limit,ymax:limit,xlabel:'I · синфазная компонента',ylabel:'Q · квадратурная компонента',square:true});
    };
    if(kind==='pilots') {
      const d=model.pilots(params),mag=values=>values.map(model.magnitude);
      stats=metric('Пилоты / места данных',`${d.positions.length} / ${d.data.length}`)+metric('Ресурс пилотов',`${fmt(d.overhead*100,1)} %`)+metric('Ошибки данных · до → после',`${d.rawErrors} → ${d.errors} из ${d.data.length}`);
      const spectrum=(title,values)=>chart(title,[
        {name:'Данные',points:d.data.map(k=>[k,model.magnitude(values[k])]),stems:true,color:colors[1]},
        {name:'Переданный модуль · для сравнения',points:[[0,1],[63,1]],dash:true,color:colors[0]}],
        {xmax:63,ymin:0,ymax:3,xlabel:'Номер поднесущей k',ylabel:'Модуль символа'});
      content=`<div class="ta-resource-scroll" tabindex="0" role="region" aria-label="Расположение пилотов"><div class="ta-subcarriers" role="group" aria-label="Пилоты и данные на 64 поднесущих">${Array.from({length:64},(_,k)=>`<span class="${d.positions.includes(k)?'ta-pilot':''}" title="Поднесущая ${k}: ${d.positions.includes(k)?'пилот':'данные'}">${d.positions.includes(k)?'П':'Д'}</span>`).join('')}</div></div>
        <p class="ta-note">П — известный пилот; Д — данные. Первая строка: поднесущие 0–31, вторая: 32–63.</p>
        ${chart('Какой канал видит приёмник?',[
          {name:'Истинный канал · для сравнения',points:points(mag(d.channel)),color:colors[0]},
          {name:'Оценка между пилотами',points:points(mag(d.estimates)),dash:true,color:colors[1]},
          {name:'Измерения на пилотах',points:d.positions.map((k,i)=>[k,model.magnitude(d.observations[i])]),dots:true,color:colors[2]}],
          {full:true,xmax:63,ymin:0,ymax:2.5,xlabel:'Номер поднесущей k',ylabel:'Модуль коэффициента канала',marks:[{at:params.center}]})}
        <div class="ta-pair"><div>${spectrum('Данные · до компенсации',d.received)}</div><div>${spectrum('Те же данные · после компенсации',d.recovered)}</div></div>
        <p class="ta-note">Вертикальный пунктир — центр провала. Шкалы постоянны.</p>
        <details><summary>Поворот фазы и численные ошибки</summary><div class="ta-pair"><div>${constellationChart('Данные до эквализации',d.data.map(k=>d.received[k]),d.reference)}</div><div>${constellationChart('Данные после эквализации',d.data.map(k=>d.recovered[k]),d.reference)}</div></div>
        <p>Среднеквадратическая ошибка оценки канала: ${fmt(d.rmse,3)}; расстояние до переданных символов: ${fmt(d.rawEvm,3)} → ${fmt(d.evm,3)}.</p></details>`;
    }
    opened=Array.from(target.querySelectorAll('details'),d=>d.open);
    target.innerHTML=`<div class="ta-metrics" aria-live="polite">${stats}</div>${content}`;
    target.querySelectorAll('details').forEach((d,i)=>{d.open=opened[i]||false;});
  }
  root.addEventListener('input',draw);
  draw();let lastWidth=root.clientWidth;
  new ResizeObserver(()=>{if(root.clientWidth!==lastWidth){lastWidth=root.clientWidth;draw();}}).observe(root);
}
document.querySelectorAll('[data-agreement]').forEach(mount);

function mountIllustration(root) {
  const kind=root.dataset.correlationIllustration,referenceName=kind==='ones'?'Преамбула из единиц':'ПСП';
  let d=model.correlationIllustration(kind,{samplesPerBit:8}),position=18;
  root.innerHTML=`<div class="ta-controls">${range('shift','Сдвиг второго сигнала',0,d.maxTime,d.dt,position,'бит')}${range('snr','ОСШ',-10,40,1,40,'дБ')}</div><p data-value aria-live="polite"></p><div class="ta-illustration"></div>`;
  const target=root.querySelector('.ta-illustration'),value=root.querySelector('[data-value]');
  const shift=root.querySelector('[data-key="shift"]'),snr=root.querySelector('[data-key="snr"]');
  let nodes,geometry;
  function path(values,x,y,step=false) {
    return values.map((v,i)=>step?`${i?'L':'M'}${x(i*d.dt)},${y(v)}L${x((i+1)*d.dt)},${y(v)}`:`${i?'L':'M'}${x(i*d.dt)},${y(v)}`).join(' ');
  }
  function update() {
    const index=Math.max(0,Math.min(d.scores.length-1,Math.round(position/d.dt)));
    const t=index*d.dt,c=d.scores[index],px=geometry.x(t);
    nodes.reference.setAttribute('transform',`translate(${px-geometry.x(0)} 0)`);
    nodes.cursor.setAttribute('d',`M${px} 40V340`);
    nodes.dot.setAttribute('cx',px);nodes.dot.setAttribute('cy',geometry.yc(c));
    root.querySelector('[data-output="shift"]').textContent=`${fmt(t,3)} ${'бит'}`;
    root.querySelector('[data-output="snr"]').textContent=snr.value==='40'?'Без шума':`${snr.value} дБ`;
    const peakValue=d.scores[d.peak],multiple=d.scores.filter(v=>Math.abs(v-peakValue)<1e-10).length>1;
    value.textContent=`Корреляция при выбранном сдвиге: ${fmt(c,3)} · ${multiple?'первый из нескольких максимумов':'максимум'} при сдвиге ${fmt(d.peakTime,3)} бит`;
  }
  function render() {
    const width=Math.max(608,Math.min(900,target.clientWidth||900)),left=45,right=15;
    const x=t=>left+t/d.total*(width-left-right);
    const amplitude=Math.max(1.2,...d.received.map(Math.abs))*1.05;
    const yr=v=>110-v/amplitude*65;
    const cmin=Math.min(-.25,...d.scores),cmax=Math.max(1.1,...d.scores);
    const yc=v=>340-(v-cmin)/(cmax-cmin)*100;
    geometry={x,yc};
    const ticks=Array.from({length:5},(_,i)=>{
      const t=i*d.total/4;
      return `<path class="ta-grid" d="M${x(t)} 40V180M${x(t)} 240V340"/><text x="${x(t)}" y="365" text-anchor="middle">${fmt(t)}</text>`;
    }).join('');
    const levels=[-1,0,1].map(v=>`<path class="ta-grid" d="M${left} ${yr(v)}H${width-right}"/><text x="${left-8}" y="${yr(v)+4}" text-anchor="end">${v}</text>`).join('');
    const corrTicks=[cmin,0,cmax].filter((v,i,a)=>a.indexOf(v)===i).map(v=>`<text x="${left-8}" y="${yc(v)+4}" text-anchor="end">${fmt(v,1)}</text>`).join('');
    target.innerHTML=`<div class="ta-plot-scroll" tabindex="0" role="region" aria-label="${referenceName} и корреляция"><svg viewBox="0 0 ${width} 400" role="img" aria-label="${referenceName} пунктиром поверх принятого битового потока и корреляция"><text x="${left}" y="20">Сигналы · амплитуда</text>${ticks}${levels}<svg x="${left}" y="40" width="${width-left-right}" height="140" viewBox="${left} 40 ${width-left-right} 140"><path fill="none" stroke="${colors[0]}" stroke-width="2" d="${path(d.received,x,yr,snr.value==='40')}"/><g data-reference><path fill="none" stroke="${colors[1]}" stroke-width="2.5" stroke-dasharray="7 5" d="${path(d.sampledReference,x,yr,true)}"/></g></svg><text x="${left}" y="218">Корреляция</text>${corrTicks}<path class="ta-grid" d="M${left} ${yc(0)}H${width-right}"/><path fill="none" stroke="${colors[2]}" stroke-width="2.5" d="${path(d.scores,x,yc)}"/><path data-cursor class="ta-guide"/><circle data-dot fill="${colors[1]}" r="6"/><text x="${width/2}" y="395" text-anchor="middle">Положение в битовом потоке · общая шкала</text></svg></div><div class="ta-legend"><span><i style="background:${colors[0]}"></i>Принятый битовый поток</span><span><i style="background:${colors[1]}"></i>${referenceName} · пунктир</span></div>`;
    nodes={reference:target.querySelector('[data-reference]'),cursor:target.querySelector('[data-cursor]'),dot:target.querySelector('[data-dot]')};
    update();
  }
  shift.addEventListener('input',()=>{position=Number(shift.value);update();});
  snr.addEventListener('input',()=>{
    d=model.correlationIllustration(kind,{samplesPerBit:8,snr:snr.value==='40'?Infinity:Number(snr.value)});
    render();
  });
  render();let lastWidth=root.clientWidth;
  new ResizeObserver(()=>{if(root.clientWidth!==lastWidth){lastWidth=root.clientWidth;render();}}).observe(root);
}

document.querySelectorAll('[data-correlation-illustration]').forEach(mountIllustration);
