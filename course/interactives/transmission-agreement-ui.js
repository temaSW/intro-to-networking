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
    if(s.stems)return s.points.map(([a,c])=>`<path stroke="${color}" stroke-width="2" d="M${x(a)} ${y(0)}V${y(c)}"/><circle cx="${x(a)}" cy="${y(c)}" r="2.5" fill="${color}"/>`).join('');
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
const select=(key,label,options,value)=>{
  const id=`ta-control-${++controlId}`;
  return `<label for="${id}">${label}<select id="${id}" data-key="${key}">${options.map(v=>`<option ${v===value?'selected':''}>${v}</option>`).join('')}</select></label>`;
};
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const device=id=>String.fromCharCode(65+id);
function mount(root) {
  const kind=root.dataset.agreement;
  let seed=1,attempted=false,headerRead=false;
  const configurations={
    frequency:`${range('hz','Реальное рассогласование Δf',-80,80,1,35,'Гц')}${range('snr','ОСШ',0,40,1,40,'дБ')}${range('length','Длина известного фрагмента',8,64,8,32,'символа')}`,
    bootstrap:`${select('mode','Модуляция продолжения',['BPSK','QPSK','16-QAM'],'QPSK')}${select('guess','Предположение приёмника без заголовка',['BPSK','QPSK','16-QAM'],'BPSK')}<button type="button" data-guess>Прочитать без начального описания</button><button type="button" data-bootstrap>Прочитать начальное описание</button>`,
    access:`${range('n','Число устройств N',1,16,1,8)}${range('m','Вариантов обращения M',2,12,1,6)}<button type="button" data-attempt>Новая попытка</button>`,
    allocation:`${range('users','Число пользователей',2,4,1,3)}${range('rows','Частотных частей ресурса',2,6,1,4)}${[4,8,12,6].map((v,i)=>range('demand'+i,'Запрос '+device(i),0,24,1,v,'элементов')).join('')}`,
    pilots:`${range('center','Положение провала',8,55,1,24,'поднесущая')}${range('depth','Глубина провала',0,.95,.05,.8)}${range('spacing','Шаг пилотов',2,16,1,8,'поднесущих')}${range('snr','ОСШ',0,40,1,40,'дБ')}`,
  };
  if(!configurations[kind])return;
  root.innerHTML=`<div class="ta-controls">${configurations[kind]}</div><div class="ta-result"></div>`;
  const target=root.querySelector('.ta-result');
  function draw() {
    const chartWidth=Math.max(320,Math.min(760,target.clientWidth||760));
    const pairWidth=window.matchMedia('(max-width:600px)').matches?chartWidth:Math.max(320,chartWidth/2);
    const chart=(title,series,options={})=>plot(title,series,{width:options.full?chartWidth:pairWidth,...options});
    const params={seed};
    root.querySelectorAll('[data-key]').forEach(el=>{
      params[el.dataset.key]=el.tagName==='SELECT'?el.value:Number(el.value);
      const output=root.querySelector(`[data-output="${el.dataset.key}"]`);
      if(output)output.textContent=el.dataset.key==='snr'&&el.value==='40'?'Без шума':`${fmt(Number(el.value))} ${el.dataset.unit||''}`;
    });
    if(params.snr===40)params.snr=Infinity;
    let content='',stats='';
    const constellationChart=(title,cloud,reference=model.constellation('QPSK').map(a=>a.point))=>{
      const limit=Math.max(1.5,...cloud.map(p=>Math.max(...p.map(Math.abs))))*1.05;
      return chart(title,[{name:'Исходное созвездие · для проверки',points:reference,dots:true,radius:7,color:colors[0]},{name:'Полученные символы',points:cloud,dots:true,radius:3,color:colors[1]}],{xmin:-limit,xmax:limit,ymin:-limit,ymax:limit,xlabel:'I',ylabel:'Q',square:true});
    };
    if(kind==='frequency') {
      const d=model.frequency(params);
      stats=metric('Оценка по опоре Δf̂',`${fmt(d.estimate,2)} Гц`)+metric('Остаточная ошибка · для проверки',`${fmt(d.residual,2)} Гц`)+metric('Ошибки до → после',`${d.rawErrors} → ${d.errors} из 48`);
      const phaseLimit=Math.max(30,...d.phase.map(p=>Math.abs(p[1])),...d.estimatedPhase.map(p=>Math.abs(p[1])))*1.1;
      content=`<div class="ta-pair">${chart('1. Известный опорный фрагмент',[{name:'Передали · I известной опоры',points:d.known.map((p,i)=>[i,p[0]]),stems:true},{name:'Приняли · I опоры',points:d.referenceReceived.map((p,i)=>[i,p[0]]),dots:true}],{xmax:params.length-1,ymin:-2,ymax:2,xlabel:'Символ опорного фрагмента',ylabel:'I'})}${chart('2. Убираем известные символы → измеряем поворот',[{name:'Измеренная фаза r·s*',points:d.phase,dots:true,radius:3},{name:'Поворот по оценке Δf̂',points:d.estimatedPhase,dash:true}],{xmax:(params.length-1),ymin:-phaseLimit,ymax:phaseLimit,xlabel:'Время опоры, мс',ylabel:'Фаза, °'})}</div><div class="ta-pair">${constellationChart('3. Данные до компенсации',d.received,d.reference)}${constellationChart('4. Те же данные после компенсации',d.corrected,d.reference)}</div><p>Расстояние до переданных точек, СКЗ: ${fmt(d.rawEvm,3)} → ${fmt(d.evm,3)}. Коррекция использует оценку по опоре, а не значение слайдера Δf.</p>`;
    }
    if(kind==='bootstrap') {
      const frame=model.bootstrapFrame(params.mode),info=headerRead?model.readBootstrap(frame.header):null;
      const guess=attempted?model.decodePayload(frame.payload,params.guess):null;
      const decoded=info?model.decodePayload(frame.payload.slice(0,info.symbols),info.mode):null;
      const errorCount=bits=>Array.from({length:Math.max(bits.length,frame.payloadBits.length)},(_,i)=>bits[i]!==frame.payloadBits[i]).filter(Boolean).length;
      const result=(title,result)=>`<div class="ta-decode"><strong>${title}</strong>${result?`<code>${escape(result.text)}</code><small>Получено ${result.bits.length} бит; несовпадений с переданным: ${errorCount(result.bits)}.</small>`:'<p>Продолжение ещё не прочитано.</p>'}</div>`;
      content=`<div class="ta-frame" role="group" aria-label="Структура учебного кадра"><div><strong>SYNC</strong><small>15 символов<br>Известный рисунок</small></div><div><strong>Начальное описание</strong><small>10 символов BPSK<br>Фиксированное место и формат</small></div><div><strong>Системная информация / данные</strong><small>${frame.payload.length} символов<br>Выбранная модуляция</small></div></div><p>Начальное описание всегда BPSK: <code>${frame.headerBits.slice(0,2)} | ${frame.headerBits.slice(2)}</code> — 2 бита модуляции и 8 бит числа символов продолжения.</p><div class="ta-pair">${result('Без начального описания · предположение '+params.guess,guess)}${result('После чтения начального описания',decoded)}</div><p>${info?`Из реально декодированных битов заголовка: <strong>${info.mode}, ${info.symbols} символов продолжения</strong>. По этим полям настроен второй декодер.`:'Приёмник пока не знает, какой вариант выбрал передатчик. Если предположение случайно верно, биты совпадут; гарантировать это без описания нельзя.'}</p><details><summary>Посмотреть символы и биты передачи</summary>${constellationChart('Символы продолжения',frame.payload,model.constellation(frame.mode).map(a=>a.point))}<p>Передали: <code>${frame.message}</code></p><p>Первые 32 бита: <code>${frame.payloadBits.slice(0,32)}</code></p>${guess?`<p>Без описания: <code>${guess.bits.slice(0,32)}</code></p>`:''}${decoded?`<p>С описанием: <code>${decoded.bits.slice(0,32)}</code></p>`:''}</details>`;
    }
    if(kind==='access') {
      const d=model.access(params);
      stats=metric('Успешные устройства',d.first.successes.length)+metric('Варианты с конфликтом',d.first.conflicts)+metric('Неиспользованные варианты',d.empty)+metric('Доля успешных устройств',`${fmt(d.share*100,1)} %`);
      content=`<p><strong>Каждое устройство выбирает один вариант:</strong></p><div class="ta-device-choices" role="group" aria-label="Устройства и выбранные варианты">${d.choices.map(([id,choice])=>`<span>${device(id)} → ${choice+1} · ${d.first.bins[choice].length===1?'успех':'конфликт'}</span>`).join('')}</div><p><strong>Результат общего обращения:</strong></p><div class="ta-bins">${d.first.bins.map((ids,i)=>`<div class="ta-bin ${ids.length>1?'ta-conflict':ids.length===1?'ta-success':''}"><span>Вариант ${i+1}</span><strong>${ids.map(device).join(', ')||'—'}</strong><small>${ids.length>1?'конфликт':ids.length?'успех':'пусто'}</small></div>`).join('')}</div><p>Устройства в конфликтах: ${d.first.collided.map(device).join(', ')||'нет'}. «Новая попытка» создаёт другой независимый выбор всех N устройств для сравнения; это не автоматический повтор только неуспешных.</p>`;
    }
    if(kind==='allocation') {
      for(let i=0;i<4;i++){const input=root.querySelector(`[data-key="demand${i}"]`);input.disabled=i>=params.users;input.closest('label').hidden=i>=params.users;}
      const demands=Array.from({length:params.users},(_,i)=>params['demand'+i]),d=model.allocation({demands,rows:params.rows});
      stats=metric('Всего элементов',d.total)+metric('Служебный обмен',d.reserved)+metric('Выделено данным',d.granted.reduce((a,v)=>a+v,0))+metric('Осталось в очередях',d.unmet.reduce((a,v)=>a+v,0));
      const cells=d.cells.map((v,i)=>`<span class="ta-resource-cell ${v>=0?'ta-user-'+v:v===-2?'ta-reserved':''}" aria-label="Время ${i%8+1}, частота ${Math.floor(i/8)+1}: ${v>=0?device(v):v===-2?'служебный обмен':'свободно'}">${v>=0?device(v):v===-2?'Сл':'·'}</span>`);
      const rows=Array.from({length:params.rows},(_,r)=>`<strong>f${r+1}</strong>${cells.slice(r*8,(r+1)*8).join('')}`).join('');
      content=`<div class="ta-allocation-view"><div><strong>Потребности → назначения</strong>${demands.map((v,i)=>`<p><strong>${device(i)}</strong>: запрос ${v} → выделено ${d.granted[i]}<br><small>В очереди: ${d.unmet[i]}</small></p>`).join('')}</div><div class="ta-resource-grid" role="group" aria-label="Распределение ресурса по времени и частоте"><strong>f / t</strong>${Array.from({length:8},(_,i)=>`<strong>${i+1}</strong>`).join('')}${rows}</div></div><ol class="ta-exchange"><li><strong>Запросы к системе:</strong> ${demands.map((v,i)=>`${device(i)}: ${v} элементов`).join('; ')}.</li><li><strong>Решение системы:</strong> распределить ${d.capacity} элементов данных по текущим запросам.</li><li><strong>Назначения пользователям:</strong> ${d.assignments.map((a,i)=>`${device(i)} → ${a.length?a.map(v=>`t${v.time}/f${v.frequency}`).join(', '):'нет ресурса'}`).join('; ')}.</li></ol><p>Сл — элементы для служебного обмена; · — свободные. Время идёт слева направо, частотные части — сверху вниз. Новое назначение действует в следующем кадре.</p>`;
    }
    if(kind==='pilots') {
      const d=model.pilots(params),mag=values=>values.map(model.magnitude);
      stats=metric('Пилоты / данные',`${d.positions.length} / ${d.data.length}`)+metric('Ресурс пилотов',`${fmt(d.overhead*100,1)} %`)+metric('СКЗ ошибки оценки H',fmt(d.rmse,3))+metric('СКЗ ошибки символов',`${fmt(d.rawEvm,3)} → ${fmt(d.evm,3)}`)+metric('Ошибки данных до → после',`${d.rawErrors} → ${d.errors} из ${d.data.length}`);
      const spectrum=(title,values,extra=[])=>chart(title,[{name:'Данные',points:d.data.map(k=>[k,model.magnitude(values[k])]),stems:true},{name:'Пилоты',points:d.positions.map(k=>[k,model.magnitude(values[k])]),stems:true,color:colors[2]},...extra],{xmax:63,ymin:0,ymax:Math.max(1.5,...mag(values))*1.05,xlabel:'Поднесущая k',ylabel:'Модуль'});
      content=`<div class="ta-subcarriers" role="group" aria-label="Пилоты и данные на 64 поднесущих">${Array.from({length:64},(_,k)=>`<span class="${d.positions.includes(k)?'ta-pilot':''}" title="Поднесущая ${k}: ${d.positions.includes(k)?'пилот':'данные'}">${d.positions.includes(k)?'П':'Д'}</span>`).join('')}</div><p>П — известный пилот +1; Д — неизвестный символ QPSK. На каждом k свой комплексный коэффициент H[k].</p><div class="ta-pair">${spectrum('1. Переданный спектр |X[k]|',d.transmitted)}${chart('2. Канал |H[k]|: измерения → интерполяция',[{name:'Истинный H · для проверки',points:points(mag(d.channel))},{name:'Интерполяция Ĥ',points:points(mag(d.estimates)),dash:true},{name:'Y / X на пилотах',points:d.positions.map((k,i)=>[k,model.magnitude(d.observations[i])]),dots:true,color:colors[2]}],{xmax:63,ymin:0,ymax:Math.max(1.2,...mag(d.estimates))*1.05,xlabel:'Поднесущая k',ylabel:'Модуль'})}${spectrum('3. Принятый спектр |Y[k]|',d.received)}${spectrum('4. После эквализации |Y[k] / Ĥ[k]|',d.recovered,[{name:'Переданный уровень |X| = 1',points:[[0,1],[63,1]],dash:true,color:colors[3]}])}</div><details><summary>Фаза: созвездия до и после эквализации</summary><div class="ta-pair">${constellationChart('Данные до эквализации',d.data.map(k=>d.received[k]),d.reference)}${constellationChart('Данные после эквализации',d.data.map(k=>d.recovered[k]),d.reference)}</div></details><p>Восстановление использует только оценки на пилотах и их интерполяцию. Истинный H и переданные данные нужны для проверки результата.</p>`;
    }
    target.innerHTML=`<div class="ta-metrics" aria-live="polite">${stats}</div>${content}`;
  }
  root.addEventListener('input',event=>{if(kind==='bootstrap'){headerRead=false;attempted=false;}draw();});
  root.querySelector('[data-attempt]')?.addEventListener('click',()=>{seed++;draw();});
  root.querySelector('[data-guess]')?.addEventListener('click',()=>{attempted=true;draw();});
  root.querySelector('[data-bootstrap]')?.addEventListener('click',()=>{headerRead=true;draw();});
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
