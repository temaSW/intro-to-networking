import {compand, lineCodes, SEGMENTS} from './companding-line-model.js';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function segmentChart(active, magnitude) {
  // As in the textbook, the small segments are drawn wider than a linear axis would allow.
  const boundaries = [0, 16, 32, 64, 128, 256, 512, 1024, 2048];
  const xPoints = [90, 126, 165, 211, 270, 339, 421, 531, 704];
  const bottom = 330, y = level => bottom - 2.1 * level;
  const xAt = value => {
    const i = Math.max(0, Math.min(7, boundaries.findLastIndex(edge => value >= edge)));
    return xPoints[i] + (value - boundaries[i]) / (boundaries[i + 1] - boundaries[i]) * (xPoints[i + 1] - xPoints[i]);
  };
  const level = active * 16 + (magnitude - SEGMENTS[active].base) / SEGMENTS[active].step;
  const markerX = xAt(magnitude), markerY = y(level);
  const guides = boundaries.slice(1).map((value, i) => {
    const xx = xPoints[i + 1], yy = y((i + 1) * 16);
    return `<path class="segment-guide" d="M 90 ${yy} H ${xx} V ${bottom}"/>`;
  }).join('');
  const ticks = SEGMENTS.slice(5).map((_, index) => {
    const i = index + 5;
    return Array.from({length: 15}, (_, j) => {
      const xx = xPoints[i] + (j + 1) * (xPoints[i + 1] - xPoints[i]) / 16;
      return `<line class="segment-tick" x1="${xx}" y1="${bottom}" x2="${xx}" y2="${bottom - 6}"/>`;
    }).join('');
  }).join('');
  const curve = xPoints.map((xx, i) => `${xx},${y(i * 16)}`).join(' ');
  const activeLine = `<line class="segment-active" x1="${xPoints[active]}" y1="${y(active * 16)}" x2="${xPoints[active + 1]}" y2="${y((active + 1) * 16)}"/>`;
  const labels = boundaries.map((value, i) => `<text x="${xPoints[i]}" y="${bottom + 23}" text-anchor="middle">${value}</text>`).join('');
  const levels = boundaries.map((_, i) => `<text x="72" y="${y(i * 16) + 4}" text-anchor="end">${i * 16}</text>`).join('');
  const segments = SEGMENTS.map((_, i) => `<text x="25" y="${y((i + .5) * 16) + 4}" text-anchor="middle">${i}</text>`).join('');
  return `<svg viewBox="0 0 760 395" role="img" aria-label="A-характеристика 87,6/13: восемь сегментов положительной полярности, каждый на 16 выходных позиций; входной шаг увеличивается к большим амплитудам"><text x="25" y="43" text-anchor="middle">N</text><text x="53" y="37">Sвых / Δ₀</text>${guides}${ticks}<line class="segment-axis" x1="90" y1="${bottom}" x2="728" y2="${bottom}"/><line class="segment-axis" x1="90" y1="${bottom}" x2="90" y2="47"/><polyline class="segment-curve" points="${curve}"/>${activeLine}<path class="sample-guide" d="M ${markerX} ${bottom} V ${markerY} H 90"/><circle class="sample-point" cx="${markerX}" cy="${markerY}" r="6"/>${labels}${levels}${segments}<text x="704" y="381" text-anchor="end">Sвх / Δ₀</text></svg>`;
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
    result.innerHTML=`<div class="segment-chart">${segmentChart(c.segment, Math.abs(c.value))}</div><p><strong>${esc(c.word[0])} ${esc(c.word.slice(1,4))} ${esc(c.word.slice(4))}</strong> · сегмент ${c.segment}, U<sub>эт,${c.segment}</sub>=${c.base}Δ₀, Δ<sub>${c.segment}</sub>=${c.step}Δ₀, позиция ${c.position}.</p>`;
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
    const rows=[['NRZ','nrz'],['RZ','rz'],['ЧПИ NRZ','amiNrz'],['ЧПИ RZ','amiRz'],['HDB-3','hdb'],['Manchester','manchester'],['Относит. биимп.','differential'],['CMI','cmi']];
    result.innerHTML=waveSvg(m,rows)+`<p class="line-legend">Уровни +1 / 0 / −1; вертикальные линии — границы битов. B — балансирующий импульс, V — нарушение чередования. Manchester: 1 = +−, 0 = −+. Относительный: 1 меняет фазу пары. CMI: 0 = −+, единицы попеременно ++ и −−.</p>`;
  };
  input.addEventListener('input',render);render();
}
