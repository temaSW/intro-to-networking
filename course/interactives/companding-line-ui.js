import {compand, uniformPcm, lineCodes, SEGMENTS} from './companding-line-model.js';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function segmentChart(active, sample) {
  // Schematic horizontal spacing follows the textbook so the small segments remain visible.
  const boundaries = [0, 32, 64, 128, 256, 512, 1024, 2048, 4096];
  const offsets = [0, 44, 84, 129, 180, 238, 306, 383, 450];
  const centerX = 480, centerY = 260;
  const side = sample < 0 ? -1 : 1, magnitude = Math.abs(sample);
  const x = (sign, offset) => centerX + sign * offset;
  const y = (sign, level) => centerY - sign * 1.6 * level;
  const offsetAt = value => {
    const i = Math.max(0, Math.min(7, boundaries.findLastIndex(edge => value >= edge)));
    return offsets[i] + (value - boundaries[i]) / (boundaries[i + 1] - boundaries[i]) * (offsets[i + 1] - offsets[i]);
  };
  const level = active * 16 + (magnitude - SEGMENTS[active].base) / SEGMENTS[active].step;
  const markerX = x(side, offsetAt(magnitude)), markerY = y(side, level);
  const branches = [-1, 1].map(sign => {
    const guides = boundaries.slice(1).map((value, i) => {
      const xx = x(sign, offsets[i + 1]), yy = y(sign, (i + 1) * 16);
      return `<path class="segment-guide" d="M ${centerX} ${yy} H ${xx} V ${centerY}"/>`;
    }).join('');
    const ticks = [5, 6, 7].map(i => Array.from({length: 15}, (_, j) => {
      const xx = x(sign, offsets[i] + (j + 1) * (offsets[i + 1] - offsets[i]) / 16);
      return `<line class="segment-tick" x1="${xx}" y1="${centerY - 5}" x2="${xx}" y2="${centerY + 5}"/>`;
    }).join('')).join('');
    const curve = offsets.map((offset, i) => `${x(sign, offset)},${y(sign, i * 16)}`).join(' ');
    const labels = boundaries.slice(1).map((value, i) =>
      `<text x="${x(sign, offsets[i + 1])}" y="${centerY + 24}" text-anchor="middle">${sign < 0 ? '−' : ''}${value}</text>`).join('');
    const levels = boundaries.slice(1).map((_, i) =>
      `<text x="${centerX + (sign < 0 ? 12 : -12)}" y="${y(sign, (i + 1) * 16) + 4}" text-anchor="${sign < 0 ? 'start' : 'end'}">${sign < 0 ? '−' : ''}${(i + 1) * 16}</text>`).join('');
    const segments = SEGMENTS.map((_, i) =>
      `<text class="segment-number" x="${x(sign, (offsets[i] + offsets[i + 1]) / 2)}" y="${y(sign, (i + .5) * 16) + (sign < 0 ? 16 : -8)}" text-anchor="middle">${i}</text>`).join('');
    return `${guides}${ticks}<polyline class="segment-curve" points="${curve}"/>${labels}${levels}${segments}`;
  }).join('');
  const activeLine = `<line class="segment-active" x1="${x(side, offsets[active])}" y1="${y(side, active * 16)}" x2="${x(side, offsets[active + 1])}" y2="${y(side, (active + 1) * 16)}"/>`;
  return `<svg viewBox="0 0 960 530" role="img" aria-label="Сегментная A-характеристика G.711: ближе к нулю шаг квантования меньше"><line class="segment-axis" x1="16" y1="${centerY}" x2="944" y2="${centerY}"/><line class="segment-axis" x1="${centerX}" y1="22" x2="${centerX}" y2="502"/>${branches}${activeLine}<path class="sample-guide" d="M ${markerX} ${centerY} V ${markerY} H ${centerX}"/><circle class="sample-point" cx="${markerX}" cy="${markerY}" r="6"/><text x="${centerX + 12}" y="20">Кодовая позиция</text><text x="944" y="${centerY - 10}" text-anchor="end">Амплитуда, ед.</text><text x="${centerX}" y="${centerY + 24}" text-anchor="middle">0</text></svg>`;
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
