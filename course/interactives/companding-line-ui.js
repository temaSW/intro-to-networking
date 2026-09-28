import {compand, uniformPcm, lineCodes, SEGMENTS} from './companding-line-model.js';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function segmentChart(active, sample) {
  // The model uses G.711 input units; the textbook plots input / Δ₀ with Δ₀ = 2 units.
  const boundaries = [0, 32, 64, 128, 256, 512, 1024, 2048, 4096];
  const offsets = [0, 59, 116, 191, 279, 379, 486, 604, 732];
  const left = 92, bottom = 349;
  const x = offset => left + offset;
  const y = level => bottom - level / 16 * 35;
  const magnitude = Math.abs(sample);
  const segment = Math.max(0, Math.min(7, boundaries.findLastIndex(edge => magnitude >= edge)));
  const offsetAt = offsets[segment] + (magnitude - boundaries[segment]) /
    (boundaries[segment + 1] - boundaries[segment]) * (offsets[segment + 1] - offsets[segment]);
  const level = active * 16 + (magnitude - SEGMENTS[active].base) / SEGMENTS[active].step;
  const markerX = x(offsetAt), markerY = y(level);
  const guides = boundaries.slice(1).map((_, i) => {
    const xx = x(offsets[i + 1]), yy = y((i + 1) * 16);
    return `<path class="segment-guide" d="M ${left} ${yy} H ${xx} V ${bottom}"/>`;
  }).join('');
  const ticks = [5, 6, 7].map(i => Array.from({length: 15}, (_, j) => {
    const xx = x(offsets[i] + (j + 1) * (offsets[i + 1] - offsets[i]) / 16);
    return `<line class="segment-tick" x1="${xx}" y1="${bottom - 5}" x2="${xx}" y2="${bottom + 5}"/>`;
  }).join('')).join('');
  const curve = offsets.map((offset, i) => `${x(offset)},${y(i * 16)}`).join(' ');
  const labels = boundaries.slice(1).map((value, i) =>
    `<text x="${x(offsets[i + 1])}" y="${bottom + 24}" text-anchor="middle">${value / 2}</text>`).join('');
  const levels = boundaries.slice(1).map((_, i) =>
    `<text x="${left - 12}" y="${y((i + 1) * 16) + 4}" text-anchor="end">${(i + 1) * 16}</text>`).join('');
  const segments = SEGMENTS.map((_, i) =>
    `<text class="segment-number" x="${x((offsets[i] + offsets[i + 1]) / 2)}" y="${y((i + .5) * 16) - 9}" text-anchor="middle">${i}</text>`).join('');
  const activeLine = `<line class="segment-active" x1="${x(offsets[active])}" y1="${y(active * 16)}" x2="${x(offsets[active + 1])}" y2="${y((active + 1) * 16)}"/>`;
  return `<svg viewBox="0 0 900 420" role="img" aria-label="Положительная ветвь A-характеристики G.711, как в пособии: вход от 0 до 2048 в единицах Δ₀, выход от 0 до 128 кодовых позиций"><line class="segment-axis" x1="${left}" y1="${bottom}" x2="850" y2="${bottom}"/><line class="segment-axis" x1="${left}" y1="${bottom}" x2="${left}" y2="43"/>${guides}${ticks}<polyline class="segment-curve" points="${curve}"/>${activeLine}<path class="sample-guide" d="M ${markerX} ${bottom} V ${markerY} H ${left}"/><circle class="sample-point" cx="${markerX}" cy="${markerY}" r="6"/>${labels}${levels}${segments}<text x="${left}" y="28">Выход / Δ₀ · кодовая позиция</text><text x="850" y="402" text-anchor="end">Вход / Δ₀ (Δ₀ = 2 ед. отсчёта)</text><text x="${left - 12}" y="${bottom + 5}" text-anchor="end">0</text></svg>`;
}

const chainRoot = document.querySelector('[data-pcm-chain]');
if (chainRoot) {
  const steps = [
    ['Отсчёт', 'После дискретизации мы получили амплитуду в выбранный момент времени. Её ещё нельзя передать конечным числом бит без квантования.'],
    ['Компрессор', 'Преобразование растягивает область малых амплитуд в кодовой шкале. Один шаг следующего квантователя будет соответствовать разным шагам исходного сигнала.'],
    ['Квантователь', 'Равномерный квантователь выбирает одну из 256 позиций в преобразованной шкале; на исходной шкале интервалы получаются неравномерными.'],
    ['Кодовое слово', 'Выбранная позиция становится 8-битным словом: знак, сегмент и позиция внутри сегмента. После передачи приёмник находит соответствующий уровень.'],
    ['Экспандер', 'Обратное нелинейное преобразование переводит выбранный уровень в исходную шкалу амплитуд. Потерянную при квантовании точность оно не восстанавливает.'],
  ];
  chainRoot.innerHTML = `<div class="pcm-chain-steps" role="group" aria-label="Этапы компандирования">${steps.map(([name], i) => `<button type="button" data-step="${i}" aria-pressed="${i === 0}">${name}</button>`).join('<span aria-hidden="true">→</span>')}</div><p class="pcm-chain-detail" aria-live="polite"></p>`;
  const detail = chainRoot.querySelector('.pcm-chain-detail');
  const select = index => {
    chainRoot.querySelectorAll('button').forEach((button, i) => { button.setAttribute('aria-pressed', String(i === index)); });
    detail.textContent = steps[index][1];
  };
  chainRoot.addEventListener('click', event => {
    const button = event.target.closest('button[data-step]');
    if (button) select(Number(button.dataset.step));
  });
  select(0);
}

function waveSvg(model, rows) {
  const n = model.bits.length, cell = 31, left = 158, rowH = 69;
  const width = left + n * cell + 16, height = 43 + rows.length * rowH;
  const grid = Array.from({length:n+1},(_,i)=>`<line class="grid" x1="${left+i*cell}" x2="${left+i*cell}" y1="18" y2="${height-14}"/>`).join('');
  const header = [...model.bits].map((b,i)=>`<text x="${left+(i+.5)*cell}" y="16" text-anchor="middle">${b}</text>`).join('');
  const body = rows.map(([label,key],r)=>{
    const values = model[key];
    const center = 50+r*rowH, scale=18;
    const cells = values.map(v => Array.isArray(v)?v:[v.level,v.level]);
    let path = `M ${left} ${center-cells[0][0]*scale}`;
    cells.forEach(([a,b],i)=>{
      const x=left+i*cell, mid=x+cell/2, end=x+cell;
      path += ` L ${mid} ${center-a*scale} L ${mid} ${center-b*scale} L ${end} ${center-b*scale}`;
      if (i+1<cells.length) path += ` L ${end} ${center-cells[i+1][0]*scale}`;
    });
    const markers= key==='hdb' ? values.map((v,i)=>v.marker?`<text class="marker" x="${left+(i+.5)*cell}" y="${center-24}" text-anchor="middle">${v.marker}</text>`:'').join('') : '';
    return `<text x="4" y="${center+4}">${esc(label)}</text><line class="zero" x1="${left}" x2="${width-16}" y1="${center}" y2="${center}"/><path d="${path}" fill="none" stroke="currentColor" stroke-width="2.5"/>${markers}`;
  }).join('');
  return `<div class="line-wave-scroll"><svg viewBox="0 0 ${width} ${height}" style="min-width:${Math.max(760,width)}px" role="img" aria-label="Временные диаграммы для последовательности ${model.bits}. B и V отмечают замены HDB-3">${grid}${header}${body}</svg></div>`;
}

const compRoot = document.querySelector('[data-companding-widget]');
if (compRoot) {
  compRoot.innerHTML = `<div class="companding-controls"><label for="companding-sample">Отсчёт, условные единицы G.711</label><output for="companding-sample">+20</output><input id="companding-sample" type="range" min="-4095" max="4095" step="1" value="20"></div><div class="companding-presets"><button type="button" data-sample="20">Слабый: +20</button><button type="button" data-sample="3060">Сильный: +3060</button></div><div class="companding-result" aria-live="polite"></div>`;
  const input=compRoot.querySelector('input'), output=compRoot.querySelector('output'), result=compRoot.querySelector('.companding-result');
  const render=()=>{
    const c=compand(input.value);
    const u=uniformPcm(input.value);
    const relative = error => c.value === 0 ? '—' : `${(100 * Math.abs(error) / Math.abs(c.value)).toFixed(2).replace('.', ',')}%`;
    output.value=`${c.value >= 0 ? '+' : '−'}${Math.abs(c.value)}`;
    const branchBase = c.value < 0 && c.base > 0 ? `−${c.base}` : c.base;
    result.innerHTML=`<div class="segment-chart">${segmentChart(c.segment, c.value)}</div><p>Сегмент ${c.segment}: начало ${branchBase}, шаг ${c.step}, позиция ${c.position}. Слово до инверсии чётных бит: <strong>${esc(c.word[0])} ${esc(c.word.slice(1,4))} ${esc(c.word.slice(4))}</strong>; на выходе кодека G.711: <strong>${esc(c.wireWord)}</strong>.</p><div class="lecture-table"><table><thead><tr><th>8-битная шкала</th><th>Шаг</th><th>Восстановлено</th><th>Абсолютная ошибка</th><th>Относительная ошибка</th></tr></thead><tbody><tr><td>Равномерная</td><td>${u.step}</td><td>${u.reconstructed}</td><td>${Math.abs(u.error)}</td><td>${relative(u.error)}</td></tr><tr><td>A-law G.711</td><td>${c.step}</td><td>${c.reconstructed}</td><td>${Math.abs(c.error)}</td><td>${relative(c.error)}</td></tr></tbody></table></div>`;
  };
  compRoot.querySelector('.companding-presets').addEventListener('click', event => {
    const button=event.target.closest('button[data-sample]');
    if (button) { input.value=button.dataset.sample; render(); }
  });
  input.addEventListener('input',render);render();
}

const lineRoot=document.querySelector('[data-line-widget]');
if (lineRoot) {
  lineRoot.innerHTML=`<label>Биты <input type="text" inputmode="numeric" spellcheck="false" value="111000000000" aria-describedby="line-hint"></label><p id="line-hint">Измените биты и сравните переходы во всех строках.</p><div class="line-result" aria-live="polite"></div>`;
  const input=lineRoot.querySelector('input'), result=lineRoot.querySelector('.line-result');
  const render=()=>{
    const m=lineCodes(input.value);
    if(!m.bits){result.textContent='Введите хотя бы один бит 0 или 1.';return;}
    const rows=[['NRZ','nrz'],['RZ','rz'],['ЧПИ NRZ','amiNrz'],['ЧПИ RZ','amiRz'],['Manchester','manchester'],['HDB-3','hdb']];
    result.innerHTML=waveSvg(m,rows)+`<p class="line-legend">Уровни +1 / 0 / −1; вертикальные линии — границы битов. B — балансирующий импульс, V — нарушение чередования. Manchester: 1 = +−, 0 = −+.</p>`;
  };
  input.addEventListener('input',render);render();
}
