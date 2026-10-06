import * as model from './transmission-agreement-model.js';
const fmt=(v,d=2)=>v.toLocaleString('ru-RU',{maximumFractionDigits:d});
const colors=['#237bbb','#d45b28','#8751b5','#16816b'];
const metric=(name,value)=>`<div class="ta-metric"><span>${name}</span><strong>${value}</strong></div>`;
function plot(title,series,{xmin=0,xmax=100,ymin=-1.5,ymax=1.5,xlabel='',ylabel='',marks=[],bands=[],square=false,width=760,height=255}={}) {
  const w=square?Math.min(420,width):width,h=square?w:height,l=65,r=20,t=20,b=48;
  const x=v=>l+(v-xmin)/(xmax-xmin)*(w-l-r),y=v=>h-b-(v-ymin)/(ymax-ymin)*(h-t-b);
  const ticks=Array.from({length:5},(_,i)=>{
    const xx=xmin+(xmax-xmin)*i/4,yy=ymin+(ymax-ymin)*i/4;
    return `<path class="ta-grid" d="M${x(xx)} ${t}V${h-b}M${l} ${y(yy)}H${w-r}"/><text x="${x(xx)}" y="${h-b+20}" text-anchor="middle">${fmt(xx)}</text><text x="${l-8}" y="${y(yy)+4}" text-anchor="end">${fmt(yy)}</text>`;
  }).join('');
  const paths=series.map((s,i)=>{
    const color=s.color||colors[i%4];
    return s.dots?s.points.map(([a,c])=>`<circle ${s.id?`data-series="${s.id}"`:""} cx="${x(a)}" cy="${y(c)}" r="${s.radius||4}" fill="${color}"/>`).join(''):
      `<path ${s.id?`data-series="${s.id}"`:""} fill="none" stroke="${color}" stroke-width="2.5" ${s.dash?'stroke-dasharray="6 4"':''} d="${s.points.map(([a,c],j)=>`${j?'L':'M'}${x(a)},${y(c)}`).join(' ')}"/>`;
  }).join('');
  const shading=bands.map(({from,to})=>`<rect data-band x="${x(from)}" y="${t}" width="${x(to)-x(from)}" height="${h-t-b}" fill="var(--accent)" opacity=".12"/>`).join('');
  const markers=marks.map(({at,label})=>`<path class="ta-guide" d="M${x(at)} ${t}V${h-b}"/><text x="${x(at)+4}" y="${t+12}">${label||''}</text>`).join('');
  return `<figure class="ta-plot"><figcaption>${title}</figcaption><svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}">${ticks}<svg x="${l}" y="${t}" width="${w-l-r}" height="${h-t-b}" viewBox="${l} ${t} ${w-l-r} ${h-t-b}">${shading}${paths}${markers}</svg><text x="${(l+w-r)/2}" y="${h-5}" text-anchor="middle">${xlabel}</text><text x="${l}" y="14">${ylabel}</text></svg><div class="ta-legend">${series.map((s,i)=>`<span><i style="background:${s.color||colors[i%4]}"></i>${s.name}</span>`).join('')}</div></figure>`;
}
const points=values=>values.map((v,i)=>[i,v]);
let controlId=0;
const range=(key,label,min,max,step,value,unit='')=>{
  const id=`ta-control-${++controlId}`;
  return `<label for="${id}">${label} <output for="${id}" data-output="${key}">${value} ${unit}</output><input id="${id}" aria-label="${label}" type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}" data-unit="${unit}"></label>`;
};
const checkbox=(key,label)=>`<label class="ta-check"><input type="checkbox" data-key="${key}"> ${label}</label>`;
function mount(root) {
  const kind=root.dataset.agreement;
  let seed=1;
  const configurations={
    timing:`${range('ppm','Ошибка частоты приёмника',-500,500,10,100,'ppm')}${range('elapsed','Символов после начальной настройки',0,10000,100,2500)}${checkbox('tracking','Компенсация измеренной ошибки такта')}`,
    frequency:`${range('hz','Ошибка несущей',-50,50,1,10,'Гц')}${range('ms','Время после начальной настройки фазы',0,100,1,40,'мс')}${checkbox('compensate','Компенсация по оценке')}${range('estimateError','Ошибка оценки частоты',-5,5,.1,0,'Гц')}`,
    access:`${range('n','Число устройств N',1,160,1,24)}${range('m','Вариантов обращения M',2,32,1,16)}${range('windows','Окон случайной задержки при повторе',1,8,1,4)}<button type="button" data-attempt>Другая попытка</button>`,
    pilots:`${range('spacing','Расстояние между пилотами',2,24,1,8,'символов')}${range('period','Период изменения канала',8,80,1,40,'символов')}`,
  };
  if(!configurations[kind]) return;
  root.innerHTML=`<div class="ta-controls">${configurations[kind]}</div><div class="ta-result"></div>`;
  const target=root.querySelector('.ta-result');
  function draw() {
    const chartWidth=Math.max(320,Math.min(760,target.clientWidth||760));
    const pairWidth=window.matchMedia('(max-width:600px)').matches?chartWidth:Math.max(320,chartWidth/2);
    const chart=(title,series,options={})=>plot(title,series,{width:kind==='frequency'?pairWidth:chartWidth,...options});
    const params={seed};
    root.querySelectorAll('[data-key]').forEach(el=>{
      params[el.dataset.key]=el.type==='checkbox'?el.checked:el.tagName==='SELECT'?el.value:Number(el.value);
      const output=root.querySelector(`[data-output="${el.dataset.key}"]`);
      if(output) output.textContent=`${fmt(Number(el.value))} ${el.dataset.unit||''}`;
    });
    let content='',stats='';
    if(kind==='timing') {
      const d=model.timing(params),base=params.elapsed;
      const waveform=Array.from({length:1201},(_,i)=>{const t=base+i/100;return [t-base,Math.tanh(8*Math.sin(Math.PI*(t-base)))];});
      const samples=d.points.map(({t})=>[t-base,Math.tanh(8*Math.sin(Math.PI*(t-base)))]);
      stats=metric('Относительная ошибка',`${fmt(params.ppm/10000,3)} %`)+metric('Накопленная ошибка без коррекции',`${fmt(d.drift,3)} T`)+metric('После компенсации',params.tracking?'0 T (идеальная оценка)':'Компенсация выключена');
      content=chart('Импульсы передатчика и моменты отсчёта',[{name:'Чередующиеся символы',points:waveform},{name:'Отсчёты приёмника',points:samples,dots:true}],{xmax:12,xlabel:'Время от начала показанного участка, T'})+
        chart('Накопление ошибки момента отсчёта',[{name:'Без коррекции',points:d.curve},{name:'С компенсацией',points:d.curve.map(([x])=>[x,0]),dash:true}],{xmax:10000,ymin:-5.1,ymax:5.1,xlabel:'Символов после настройки',ylabel:'Ошибка / T',marks:[{at:base}]});
    }
    if(kind==='frequency') {
      const d=model.frequency(params);
      stats=metric('Оценённое смещение',`${fmt(d.estimate)} Гц`)+metric('Остаточное смещение',`${fmt(d.residual)} Гц`)+metric('Накопленная фаза',`${fmt(d.angle*180/Math.PI)}°`);
      content=`<div class="ta-pair">${chart('Созвездие в выбранный момент',[{name:'Переданные точки',points:d.reference,dots:true,radius:7},{name:'Принятые точки',points:d.received,dots:true}],{xmin:-1.5,xmax:1.5,ymin:-1.5,ymax:1.5,xlabel:'I',ylabel:'Q',square:true})}${chart('Изменение фазы во времени',[{name:'Фаза после выбранной коррекции',points:d.phaseCurve}],{xmax:100,ymin:-1800,ymax:1800,xlabel:'Время, мс',ylabel:'Фаза, °',marks:[{at:params.ms}]})}</div>`;
    }
    if(kind==='access') {
      const d=model.access(params);
      stats=metric('Успех в первом обращении',d.first.successes.length)+metric('Конфликтующих вариантов',d.first.conflicts)+metric('Устройств в конфликтах',d.first.collided.length)+metric('Вероятность успеха устройства',`${fmt(d.probability*100,1)} %`)+metric('Среднее число успехов',fmt(d.expected,1))+metric('После первого обращения и повтора',`${d.successes} из ${params.n}`);
      const bins=list=>`<div class="ta-bins">${list.map((ids,i)=>`<div class="ta-bin ${ids.length>1?'ta-conflict':ids.length===1?'ta-success':''}"><span>${i+1}</span><strong>${ids.length}</strong><small>${ids.length>1?'конфликт':ids.length?'успех':'свободно'}</small></div>`).join('')}</div>`;
      content=`<p><strong>Первое обращение:</strong> в каждом варианте показано число выбравших его устройств.</p>${bins(d.first.bins)}<p><strong>Повтор только неуспешных устройств:</strong> случайный выбор будущего окна и варианта внутри него.</p>${Array.from({length:params.windows},(_,i)=>`<details ${i===0?'open':''}><summary>Окно задержки ${i+1}</summary>${bins(d.retry.bins.slice(i*params.m,(i+1)*params.m))}</details>`).join('')}<p>После повтора в конфликтах осталось ${d.retry.collided.length} устройств. Им нужны следующие попытки; увеличение задержки уменьшает конкуренцию, но увеличивает ожидание.</p>`;
    }
    if(kind==='pilots') {
      const d=model.pilots(params);
      stats=metric('Доля пилотов',`${fmt(d.overhead*100,1)} %`)+metric('Среднеквадратичная ошибка оценки',fmt(d.rmse,3))+metric('Ошибки данных без коррекции',`${d.rawErrors} / ${d.data.length}`)+metric('Ошибки после коррекции',`${d.errors} / ${d.data.length}`);
      content=chart('Истинное воздействие канала и оценка по пилотам',[{name:'Истинное усиление h(t)',points:points(d.channel)},{name:'Оценка между пилотами',points:points(d.estimates)},{name:'Наблюдения пилотов',points:d.positions.map(t=>[t,d.received[t]]),dots:true,color:colors[2]}],{xmax:96,ymin:.3,ymax:1.7,xlabel:'Номер символа',ylabel:'Усиление'})+
        chart('Неизвестные данные: переданные и восстановленные уровни',[{name:'Переданные уровни (для проверки)',points:d.data.map(t=>[t,d.transmitted[t]]),dots:true,radius:5},{name:'После деления на оценку канала',points:d.data.map(t=>[t,d.recovered[t]]),dots:true,radius:3}],{xmax:96,ymin:-2.5,ymax:2.5,xlabel:'Номер символа',ylabel:'Амплитуда'});
    }
    target.innerHTML=`<div class="ta-metrics" aria-live="polite" aria-atomic="true">${stats}</div>${content}`;
  }
  root.addEventListener('input',draw);
  root.querySelector('[data-attempt]')?.addEventListener('click',()=>{seed++;draw();});
  draw();
  let lastWidth=root.clientWidth;
  const observer=new ResizeObserver(()=>{
    if(root.clientWidth!==lastWidth) { lastWidth=root.clientWidth; draw(); }
  });
  observer.observe(root);
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
    const width=Math.max(320,Math.min(900,target.clientWidth||900)),left=45,right=15;
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
    target.innerHTML=`<svg viewBox="0 0 ${width} 400" role="img" aria-label="${referenceName} пунктиром поверх принятого битового потока и корреляция"><text x="${left}" y="20">Сигналы · амплитуда</text>${ticks}${levels}<svg x="${left}" y="40" width="${width-left-right}" height="140" viewBox="${left} 40 ${width-left-right} 140"><path fill="none" stroke="${colors[0]}" stroke-width="2" d="${path(d.received,x,yr,snr.value==='40')}"/><g data-reference><path fill="none" stroke="${colors[1]}" stroke-width="2.5" stroke-dasharray="7 5" d="${path(d.sampledReference,x,yr,true)}"/></g></svg><text x="${left}" y="218">Корреляция</text>${corrTicks}<path class="ta-grid" d="M${left} ${yc(0)}H${width-right}"/><path fill="none" stroke="${colors[2]}" stroke-width="2.5" d="${path(d.scores,x,yc)}"/><path data-cursor class="ta-guide"/><circle data-dot fill="${colors[1]}" r="6"/><text x="${width/2}" y="395" text-anchor="middle">Положение в битовом потоке · общая шкала</text></svg><div class="ta-legend"><span><i style="background:${colors[0]}"></i>Принятый битовый поток</span><span><i style="background:${colors[1]}"></i>${referenceName} · пунктир</span></div>`;
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
