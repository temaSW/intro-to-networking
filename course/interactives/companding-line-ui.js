import {compand, lineCodes, SEGMENTS} from './companding-line-model.js';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function segmentChart(active, sample) {
  // Schematic horizontal spacing follows the textbook so the small segments remain visible.
  const boundaries = [0, 16, 32, 64, 128, 256, 512, 1024, 2048];
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
  return `<svg viewBox="0 0 960 530" role="img" aria-label="A-характеристика 87,6/13 с положительной и отрицательной ветвями; на каждой восемь сегментов по 16 выходных позиций"><line class="segment-axis" x1="16" y1="${centerY}" x2="944" y2="${centerY}"/><line class="segment-axis" x1="${centerX}" y1="22" x2="${centerX}" y2="502"/>${branches}${activeLine}<path class="sample-guide" d="M ${markerX} ${centerY} V ${markerY} H ${centerX}"/><circle class="sample-point" cx="${markerX}" cy="${markerY}" r="6"/><text x="${centerX + 12}" y="20">Sвых / Δ₀</text><text x="944" y="${centerY - 10}" text-anchor="end">Sвх / Δ₀</text><text x="${centerX}" y="${centerY + 24}" text-anchor="middle">0</text></svg>`;
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
  compRoot.innerHTML = `<div class="companding-controls"><label for="companding-sample">Отсчёт в единицах Δ₀</label><output for="companding-sample">+86 Δ₀</output><input id="companding-sample" type="range" min="-2047" max="2047" step="1" value="86"></div><div class="companding-result" aria-live="polite"></div>`;
  const input=compRoot.querySelector('input'), output=compRoot.querySelector('output'), result=compRoot.querySelector('.companding-result');
  const render=()=>{
    const c=compand(input.value);
    output.value=`${c.value >= 0 ? '+' : '−'}${Math.abs(c.value)} Δ₀`;
    const branchBase = c.value < 0 && c.base > 0 ? `−${c.base}` : c.base;
    result.innerHTML=`<div class="segment-chart">${segmentChart(c.segment, c.value)}</div><p><strong>${esc(c.word[0])} ${esc(c.word.slice(1,4))} ${esc(c.word.slice(4))}</strong> · сегмент ${c.segment}, U<sub>эт,${c.segment}</sub>=${branchBase}Δ₀, Δ<sub>${c.segment}</sub>=${c.step}Δ₀, позиция ${c.position}.</p>`;
  };
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
