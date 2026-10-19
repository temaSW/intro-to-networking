import {clockDrift} from './transport-clock-model.js';
const number = value => value.toLocaleString('ru-RU',{maximumFractionDigits:3});
export function mountClockDrift(root) {
  const controls=[...root.querySelectorAll('[data-clock-parameter]')];
  const update=() => {
    const [ppm,time]=controls.map(control=>Number(control.value));
    const data=clockDrift(ppm,time);
    controls.forEach(control=> {root.querySelector(`[data-clock-number="${control.dataset.clockParameter}"]`).value=control.value;});
    root.querySelector('[data-clock-results]').innerHTML=`<dl class="clock-counts"><div><dt>Поток А</dt><dd>${number(data.countA)} бит</dd></div><div><dt>Поток Б</dt><dd>${number(data.countB)} бит</dd></div><div><dt>Дополнительные биты Б</dt><dd>${data.excess}</dd></div></dl><p>Фактические скорости: А -- ${number(data.rateA)} бит/с, Б -- ${number(data.rateB)} бит/с. Если оба входа получают одинаковое число позиций, дополнительные биты Б должны где-то оставаться.</p>`;
    const points=Array.from({length:101},(_,i)=>`${60+i*6},${180-clockDrift(ppm,i*10).excess*140/110}`).join(' ');
    root.querySelector('[data-clock-plot]').innerHTML=`<svg viewBox="0 0 720 230" role="img" aria-label="Разность числа битов Б и А; постоянная шкала от нуля до 110 бит"><path class="mux-axis" d="M60 40 V180 H660 M60 40 H660 M60 110 H660"/><g class="mux-label"><text x="60" y="25">Разность Б − А, бит</text><text x="22" y="184">0</text><text x="13" y="114">55</text><text x="5" y="44">110</text><text x="60" y="205">0</text><text x="343" y="205">500</text><text x="626" y="205">1000</text><text x="520" y="225">Время, мс</text></g><polyline points="${points}" class="mux-shared"/><path d="M${60+time*.6} 40 V180" class="mux-cursor"/><circle cx="${60+time*.6}" cy="${180-data.excess*140/110}" r="5" class="clock-point"/></svg>`;
  };
  controls.forEach(control=>control.addEventListener('input',update));
  root.querySelectorAll('[data-clock-number]').forEach(input=>input.addEventListener('input',()=>{
    if(input.value==='' || !input.checkValidity())return;
    controls.find(control=>control.dataset.clockParameter===input.dataset.clockNumber).value=input.value;update();
  }));
  update();
}
document.querySelectorAll('[data-clock-drift]').forEach(mountClockDrift);
