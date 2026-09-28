import {compand, lineCodes, SEGMENTS, fourBThreeT} from './companding-line-model.js';

const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function segmentChart(active) {
  const width = 720, height = 260, left = 50, bottom = 210;
  const points = [0, 16, 32, 64, 128, 256, 512, 1024, 2048];
  const x = value => left + 640 * Math.log2(1 + value) / Math.log2(2049);
  const y = value => bottom - 180 * value / 128;
  const poly = points.map((p, i) => `${x(p)},${y(i * 16)}`).join(' ');
  const bands = SEGMENTS.map((s, i) => `<rect x="${x(s.base)}" y="${y((i+1)*16)}" width="${x(points[i+1])-x(s.base)}" height="${y(i*16)-y((i+1)*16)}" class="${i === active ? 'active' : ''}"/><text x="${(x(s.base)+x(points[i+1]))/2}" y="${y(i*16)-5}" text-anchor="middle">${i}</text>`).join('');
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Восемь сегментов A характеристики: равные 16 выходных позиций и растущие входные интервалы" preserveAspectRatio="xMidYMid meet"><line x1="${left}" y1="${bottom}" x2="700" y2="${bottom}"/><line x1="${left}" y1="${bottom}" x2="${left}" y2="20"/>${bands}<polyline points="${poly}" fill="none" stroke="currentColor" stroke-width="3"/>${points.map(p=>`<text x="${x(p)}" y="232" text-anchor="middle">${p}</text>`).join('')}<text x="360" y="254" text-anchor="middle">|Uвх| / Δ₀ (логарифмическая ось для читаемости)</text><text x="16" y="24">128</text><text x="18" y="211">0</text></svg>`;
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
  compRoot.innerHTML = `<label>Отсчёт в единицах Δ₀ <input type="number" min="-2047" max="2047" step="1" value="934"></label><div class="companding-result" aria-live="polite"></div>`;
  const input=compRoot.querySelector('input'), result=compRoot.querySelector('.companding-result');
  const render=()=>{
    const c=compand(input.value);
    result.innerHTML=`<div class="segment-chart">${segmentChart(c.segment)}</div><p><strong>${esc(c.word[0])} ${esc(c.word.slice(1,4))} ${esc(c.word.slice(4))}</strong> · сегмент ${c.segment}, U<sub>эт,${c.segment}</sub>=${c.base}Δ₀, Δ<sub>${c.segment}</sub>=${c.step}Δ₀, позиция ${c.position}.</p><p>Восстановление: ${c.value<0?'−':'+'}(${c.base}+(${c.position}+½)·${c.step})Δ₀ = <strong>${c.reconstructed}Δ₀</strong>. Ошибка Û−U = ${c.error}Δ₀.</p>`;
  };
  input.addEventListener('input',render);render();
}

const lineRoot=document.querySelector('[data-line-widget]');
if (lineRoot) {
  lineRoot.innerHTML=`<label>Биты <input type="text" inputmode="numeric" spellcheck="false" value="111000000001101000001000" aria-describedby="line-hint"></label><p id="line-hint">Измените биты и сравните переходы во всех строках.</p><div class="line-result" aria-live="polite"></div>`;
  const input=lineRoot.querySelector('input'), result=lineRoot.querySelector('.line-result');
  const render=()=>{
    const m=lineCodes(input.value);
    if(!m.bits){result.textContent='Введите хотя бы один бит 0 или 1.';return;}
    const rows=[['NRZ','nrz'],['RZ','rz'],['ЧПИ NRZ','amiNrz'],['ЧПИ RZ','amiRz'],['HDB-3','hdb'],['Manchester','manchester'],['Относит. биимп.','differential'],['CMI','cmi']];
    const blocks=fourBThreeT(m.bits);
    result.innerHTML=waveSvg(m,rows)+`<p class="line-legend">Уровни +1 / 0 / −1; границы клеток — границы битов; тонкая линия — нулевой уровень. B — балансирующий импульс, V — нарушение чередования. Manchester: 1 = +−, 0 = −+. Относительный: 1 меняет фазу пары. CMI: 0 = −+, единицы попеременно + + и − −.</p><p><strong>4B3T:</strong> ${blocks.blocks.map(b=>`${b.word} → ${b.first}`).join(' · ') || 'нет полной тетрады'}${blocks.remainder ? ` · последние ${blocks.remainder} бит остаются до следующего блока` : ''}. Показан первый вариант таблицы; полярность блоков выбирают с учётом баланса.</p>`;
  };
  input.addEventListener('input',render);render();
}
