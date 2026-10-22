import {observeVariant, observationDefaults, AMPLIFIERS, CABLES} from './ofdm-observation-model.js';

function renderOFDM(root, controls, spectrumStage, variant) {
  const r=observeVariant(variant,controls), cable=r.cable;
  const stageLabel=spectrumStage==='output'?'Выход УМ':'После обработки';
  const sx=x=>55+(x+4)*76, sy=y=>265-(Math.max(-100,Math.min(20,y))+100)*230/120;
  const path=key=>r.spectrum.map(v=>`${sx(v.frequency).toFixed(2)},${sy(v[key]).toFixed(2)}`).join(' ');
  const spectrum=`<svg viewBox="0 0 690 325" role="img" aria-label="Спектр переданного OFDM и сигнала в точке: ${stageLabel}.">
    <rect x="${sx(-1.5)}" y="35" width="${sx(1.5)-sx(-1.5)}" height="230" class="ofdm-band"/>
    ${[-100,-80,-60,-40,-20,0,20].map(v=>`<path d="M55 ${sy(v)}H663" class="ofdm-grid"/><text x="8" y="${sy(v)+5}">${v}</text>`).join('')}
    ${[-4,-2,0,2,4].map(v=>`<text x="${sx(v)-8}" y="287">${v}</text>`).join('')}
    <text x="55" y="20">Мощность в частотном отсчёте, дБм</text>
    <text x="125" y="314">Частота относительно центра, МГц</text>
    <polyline points="${path('tx')}" class="ofdm-reference"/><polyline points="${path(spectrumStage)}" class="ofdm-received"/>
    <path d="M55 35V265H663" class="pc-axis"/>
</svg>`;
  const cx=x=>185+x*50, cy=y=>174-y*50;
  const constellation=`<svg viewBox="0 0 370 355" role="img" aria-label="Созвездие 4-QAM: четыре опорных положения и искажённые принятые точки всех активных поднесущих.">
    ${[-3,-2,-1,0,1,2,3].map(v=>`<path d="M35 ${cy(v)}H335 M${cx(v)} 24V324" class="ofdm-grid"/><text x="${cx(v)-5}" y="344">${v}</text><text x="9" y="${cy(v)+4}">${v}</text>`).join('')}
    <path d="M35 174H335 M185 24V324" class="pc-axis"/>
    ${r.points.map(v=>`<circle cx="${cx(v.i).toFixed(2)}" cy="${cy(v.q).toFixed(2)}" r="1.7" class="ofdm-point"/>`).join('')}
    ${[-1,1].flatMap(i=>[-1,1].map(q=>`<circle cx="${cx(i/Math.SQRT2)}" cy="${cy(q/Math.SQRT2)}" r="6" class="ofdm-ideal"/>`)).join('')}
    <text x="340" y="169">I</text><text x="192" y="17">Q</text></svg>`;
  const wx=t=>65+t/cable.duration*900, wy=v=>110-v*65;
  const waveform=`<svg viewBox="0 0 1000 245" role="img" aria-label="Одна последовательность NRZ после выходного кабеля">
    ${[1,0,-1].map(v=>`<path d="M65 ${wy(v)}H965" class="${v===0?'ofdm-threshold':'ofdm-grid'}"/><text x="26" y="${wy(v)+5}">${v}</text>`).join('')}
    <text x="9" y="20">U/Uном</text>
    ${cable.bits.map((bit,i)=>`<path d="M${wx(i/cable.rate)} 35V190" class="ofdm-bit-boundary"/><text x="${wx((i+.5)/cable.rate)-5}" y="25" class="ofdm-cable-bit">${bit}</text>`).join('')}
    <path d="M965 35V190" class="ofdm-bit-boundary"/>
    <polyline points="${cable.trace.map(v=>`${wx(v.time).toFixed(2)},${wy(v.value).toFixed(2)}`).join(' ')}" class="ofdm-cable-line"/>
    ${cable.decisions.map(v=>`<circle cx="${wx(v.time)}" cy="${wy(v.value)}" r="${v.bit===v.source?2.7:5}" class="${v.bit===v.source?'ofdm-cable-sample':'ofdm-cable-error'}"/>`).join('')}
    ${[0,1,2,3,4,5].map(t=>`<text x="${wx(t)-4}" y="213">${t}</text>`).join('')}
    <text x="830" y="237">Время, мкс</text></svg>`;
  const scheme=`<svg viewBox="0 0 1100 205" role="img" aria-label="Передатчик с антенной, беспроводной канал, приёмная антенна, приёмник с УМ и демодулятором, выходной кабель и получатель">
    <rect x="15" y="69" width="140" height="70" rx="5" class="ofdm-device"/>
    <text x="85" y="96" text-anchor="middle">Передатчик</text><text x="85" y="120" text-anchor="middle">OFDM / 4-QAM</text>
    <path d="M155 104H215V48 M215 48L191 25 M215 48L239 25" class="ofdm-wire"/>
    <text x="215" y="164" text-anchor="middle">Передающая антенна</text>
    <path d="M250 52Q285 75 250 98 M265 40Q320 75 265 110 M530 52Q495 75 530 98 M515 40Q460 75 515 110" class="ofdm-radio"/>
    <text x="390" y="50" text-anchor="middle">Беспроводной канал</text>
    <path d="M320 104H460" class="ofdm-air"/><path d="M460 99L470 104L460 109Z" class="ofdm-arrow"/>
    <path d="M550 48L526 25 M550 48L574 25 M550 48V104H600" class="ofdm-wire"/>
    <text x="550" y="184" text-anchor="middle">Приёмная антенна</text>
    <rect x="600" y="45" width="260" height="120" rx="5" class="ofdm-device"/>
    <text x="730" y="67" text-anchor="middle">Приёмник</text>
    <rect x="615" y="84" width="47" height="42" rx="3" class="ofdm-device-part"/>
    <text x="638" y="110" text-anchor="middle">УМ</text>
    <path d="M663 105H756" class="ofdm-wire"/>
    <rect x="756" y="84" width="89" height="42" rx="3" class="ofdm-device-part"/>
    <text x="800" y="109" text-anchor="middle" class="ofdm-small-label">Демодулятор</text>
    <text x="730" y="149" text-anchor="middle" class="ofdm-small-label">Частотная подстройка · эквалайзер</text>
    <path d="M860 104H879 C891 89 903 119 915 104 S939 89 951 104 H1005" class="ofdm-cable-wire"/>
    <text x="930" y="78" text-anchor="middle">Кабель</text><text x="930" y="145" text-anchor="middle" class="ofdm-small-label">Цифровой выход</text>
    <rect x="1005" y="69" width="85" height="70" rx="5" class="ofdm-device"/>
    <text x="1047" y="109" text-anchor="middle" class="ofdm-small-label">Получатель</text></svg>`;
  root.innerHTML=`<div class="pc-scroll ofdm-scheme" tabindex="0" aria-label="Схема системы связи">${scheme}</div>
    <div class="ofdm-plots"><figure><figcaption><strong>Спектр OFDM -- ${stageLabel.toLowerCase()}</strong></figcaption><div class="pc-scroll ofdm-spectrum" tabindex="0" aria-label="Спектр с локальной прокруткой">${spectrum}</div>
    <p class="ofdm-caption">Пунктир -- передано; сплошная линия -- ${stageLabel.toLowerCase()}. Полоса активных поднесущих выделена фоном.</p></figure>
    <figure><figcaption><strong>Созвездие 4-QAM</strong></figcaption><div class="pc-scroll ofdm-constellation" tabindex="0" aria-label="Созвездие с локальной прокруткой">${constellation}</div>
    <p class="ofdm-caption">Точки -- ${r.points.length} принятых символов со всех активных поднесущих; пустые окружности -- четыре опорных положения.</p></figure></div>
    <figure><figcaption><strong>Битовая последовательность во времени -- после выходного кабеля</strong></figcaption>
    <div class="pc-scroll ofdm-cable-plot" tabindex="0" aria-label="Временная форма сигнала на выходе кабеля">${waveform}</div>
    <p class="ofdm-caption">Одна последовательность: ${cable.count} бита цифрового выхода приёмника (позиции ${cable.offset+1}–${cable.offset+cable.count}). Цифры сверху -- уровни, выданные приёмником; линия -- напряжение после кабеля. Точки отмечают середины битовых интервалов; пустые кружки -- ${cable.errors} ошибочных решений после кабеля. Пунктирная горизонталь -- порог решения.</p>
    </figure>`;

}

export function mountOFDM(root, initialVariant=1) {
  let variant=initialVariant;
  let {amplifier,cableId,gainDb,frequencyAdjustmentKhz,equalizer}=observationDefaults(variant);
  let spectrumStage='processed';
  const f=x=>Number(x.toFixed(2)).toLocaleString('ru-RU');
  const options=items=>Object.entries(items).map(([id,item])=>`<option value="${id}">${item.name}</option>`).join('');
  root.innerHTML=`<div data-ofdm-scheme></div>
    <div class="ofdm-controls">
    <fieldset><legend>Усилитель мощности (УМ)</legend>
      <label>Модель<select name="ofdm-amplifier">${options(AMPLIFIERS)}</select></label>
      <label><span>Усиление, дБ <output data-gain-output>36</output></span><input name="ofdm-gain" type="range" min="12" max="42" step="6" value="36"></label>
      <p>NF: <output data-nf-output>10</output> дБ<br>Предельный выходной уровень (пик): <output data-limit-output></output> дБм</p>
    </fieldset>
    <fieldset><legend>Обработка в приёмнике</legend>
      <label>Подстройка частоты, кГц<input name="ofdm-frequency" type="number" min="-25" max="25" step="0.5" value="0"></label>
      <label class="ofdm-check"><input name="ofdm-equalizer" type="checkbox">Эквалайзер</label>
    </fieldset>
    <fieldset><legend>Выходной кабель</legend>
      <label>Кабель<select name="ofdm-cable">${options(CABLES)}</select></label>
      <p>Полоса: <output data-cable-output></output> МГц<br>Потери: <output data-cable-loss></output> дБ<br>Цена: <output data-cable-price></output> ₽</p>
    </fieldset></div>
    <details><summary>Характеристики оборудования</summary>
      <div class="pc-scroll" tabindex="0" aria-label="Характеристики УМ"><table><caption>Учебные модели усилителя мощности</caption><thead><tr><th>Модель</th><th>Диапазон усиления, дБ</th><th>NF, дБ</th><th>Предельный выходной уровень (пик), дБм</th></tr></thead><tbody>${Object.values(AMPLIFIERS).map(a=>`<tr><td>${a.name}</td><td>${a.minGain}…${a.maxGain}</td><td>${a.noiseFigureDb}</td><td>${f(20*Math.log10(a.clip))}</td></tr>`).join('')}</tbody></table></div>
      <div class="pc-scroll" tabindex="0" aria-label="Характеристики кабелей"><table><caption>Учебные модели кабелей; цены условные</caption><thead><tr><th>Модель</th><th>Полоса, МГц</th><th>Потери, дБ</th><th>Цена, ₽</th></tr></thead><tbody>${Object.values(CABLES).map(c=>`<tr><td>${c.name}</td><td>${f(c.bandwidth)}</td><td>${f(c.lossDb)}</td><td>${f(c.priceRub)}</td></tr>`).join('')}</tbody></table></div>
    </details>
    <label>Точка наблюдения спектра<select name="ofdm-spectrum-stage"><option value="output">Выход УМ</option><option value="processed" selected>После обработки</option></select></label>
    <div data-ofdm-view></div>
    <div class="ofdm-reset-row"><button type="button" data-ofdm-reset>Сбросить все настройки</button></div>`;
  const view=root.querySelector('[data-ofdm-view]');
  function update() {
    const a=AMPLIFIERS[amplifier], c=CABLES[cableId];
    const controls={amplifier,gainDb,cableId,frequencyAdjustmentKhz,equalizer};
    renderOFDM(view,controls,spectrumStage,variant);
    root.querySelector('[data-ofdm-scheme]').replaceChildren(view.querySelector('.ofdm-scheme'));
    root.querySelector('[data-gain-output]').textContent=gainDb;
    root.querySelector('[data-nf-output]').textContent=a.noiseFigureDb;
    root.querySelector('[data-limit-output]').textContent=f(20*Math.log10(a.clip));
    root.querySelector('[data-cable-output]').textContent=f(c.bandwidth);
    root.querySelector('[data-cable-loss]').textContent=f(c.lossDb);
    root.querySelector('[data-cable-price]').textContent=f(c.priceRub);
  }
  function read() {
    const frequency=root.querySelector('[name="ofdm-frequency"]');
    if(!frequency.validity.valid || !Number.isFinite(frequency.valueAsNumber)) return;
    amplifier=root.querySelector('[name="ofdm-amplifier"]').value;
    const a=AMPLIFIERS[amplifier], gain=root.querySelector('[name="ofdm-gain"]');
    gainDb=Math.min(a.maxGain,Math.max(a.minGain,+gain.value));
    gain.min=a.minGain; gain.max=a.maxGain; gain.value=gainDb;
    frequencyAdjustmentKhz=frequency.valueAsNumber;
    equalizer=root.querySelector('[name="ofdm-equalizer"]').checked;
    cableId=root.querySelector('[name="ofdm-cable"]').value;
    spectrumStage=root.querySelector('[name="ofdm-spectrum-stage"]').value;
    update();
  }
  root.addEventListener('input',event=>{if(event.target.matches('input[type="range"],input[type="number"]')) read();});
  root.addEventListener('change',event=>{if(event.target.matches('select,input[type="checkbox"]')) read();});
  function reset() {
    const defaults=observationDefaults(variant), a=AMPLIFIERS[defaults.amplifier];
    root.querySelector('[name="ofdm-amplifier"]').value=defaults.amplifier;
    const gain=root.querySelector('[name="ofdm-gain"]');
    gain.min=a.minGain; gain.max=a.maxGain; gain.value=defaults.gainDb;
    root.querySelector('[name="ofdm-equalizer"]').checked=false;
    root.querySelector('[name="ofdm-frequency"]').value=0;
    root.querySelector('[name="ofdm-cable"]').value=defaults.cableId;
    root.querySelector('[name="ofdm-spectrum-stage"]').value='processed'; read();
  }
  root.querySelector('[data-ofdm-reset]').addEventListener('click',reset);
  reset();
  return {setVariant(id) {
    observationDefaults(id); // Validate before changing the selected record.
    if(variant===id)return;
    variant=id; reset();
  }};
}
