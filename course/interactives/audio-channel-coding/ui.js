import {decodePack, envelope, loopPhase, nearestPoint} from './model.js';

const MODES = {analog: 'Analog · AM', digital: 'Digital · OOK', ldpc: 'Digital + LDPC · OOK'};
const percent = value => value === 0 ? '0 %' : `${(value * 100).toLocaleString('ru-RU', {maximumFractionDigits: 4})} %`;

export class AudioChannelDemo {
  constructor(root) {
    this.root = root;
    this.mode = 'analog';
    this.index = 6;
    this.playing = false;
    this.offset = 0;
    this.voices = new Set();
    this.root.innerHTML = `
      <div class="acd-head"><span class="acd-eyebrow">Лаборатория шума</span><span class="acd-duration">Один фрагмент · три способа передачи</span></div>
      <div class="acd-controls">
        <button type="button" class="acd-play" disabled aria-label="Начать циклическое воспроизведение">▶ Play</button>
        <fieldset class="acd-modes"><legend>Способ передачи</legend>
          ${Object.entries(MODES).map(([key, text]) => `<label><input type="radio" name="mode" value="${key}" ${key === 'analog' ? 'checked' : ''}><span>${text}</span></label>`).join('')}
        </fieldset>
      </div>
      <label class="acd-snr"><span>SNR <small>dB</small></span><output>0 dB</output><input type="range" min="-6" max="16" step="1" value="0" aria-label="SNR, dB"><span class="acd-range"><span>−6 · больше шума</span><span>+16 · меньше шума</span></span></label>
      <p class="acd-definition"></p>
      <div class="acd-waves">
        <figure><figcaption><strong>Исходный сигнал</strong><span>Набор синусов</span></figcaption><canvas class="acd-original" role="img" aria-label="Волновая форма исходного аудио"></canvas></figure>
        <figure><figcaption><strong>Принятый сигнал</strong><span class="acd-result-label"></span></figcaption><canvas class="acd-received" role="img" aria-label="Волновая форма принятого аудио"></canvas></figure>
      </div>
      <div class="acd-wave-foot"><span class="acd-scale"></span><span class="acd-time">0,00 s</span></div>
      <div class="acd-chain" aria-label="Структурная схема передачи"></div>
      <div class="acd-price"></div>
      <details class="acd-metrics" open><summary>Ошибки в битах и блоках</summary><dl></dl><p>BER — доля ошибочных битов. FER — доля блоков с хотя бы одной ошибкой. Метрики измерены на всём фрагменте; ноль означает отсутствие наблюдаемых ошибок в этой выборке.</p></details>
      <p class="acd-status" role="status">Загрузка аудио…</p>`;
    this.playButton = root.querySelector('.acd-play');
    this.slider = root.querySelector('input[type=range]');
    this.status = root.querySelector('.acd-status');
    // Separate groups when several copies of the component appear on a page.
    const group = `audio-mode-${crypto.randomUUID()}`;
    root.querySelectorAll('input[type=radio]').forEach(radio => { radio.name = group; });
    this.playButton.addEventListener('click', () => this.toggle().catch(error => this.fail(error)));
    root.querySelectorAll('input[type=radio]').forEach(radio => radio.addEventListener('change', () => {
      this.mode = radio.value;
      this.update();
      if (this.playing) this.switchVoice();
    }));
    this.slider.addEventListener('input', () => {
      if (!this.manifest) return;
      const index = nearestPoint(this.manifest.points, Number(this.slider.value));
      if (this.index === index) return;
      this.index = index;
      this.update();
      if (this.playing) this.switchVoice();
    });
    this.slider.disabled = true;
    root.querySelectorAll('input[type=radio]').forEach(radio => { radio.disabled = true; });
    this.resizeObserver = new ResizeObserver(() => this.draw());
    root.querySelectorAll('canvas').forEach(canvas => this.resizeObserver.observe(canvas));
    this.themeObserver = new MutationObserver(() => this.draw());
    this.themeObserver.observe(document.body, {attributes: true, attributeFilter: ['class']});
    this.ready = this.load().catch(error => this.fail(error));
  }

  async load() {
    const url = new URL(this.root.dataset.manifest, document.baseURI);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Не удалось загрузить описание модели');
    this.manifest = await response.json();
    const m = this.manifest;
    if (m.version !== 1 || !m.points.length || m.samples <= 0) throw new Error('Неподдерживаемая модель');
    this.packs = {};
    this.envelopes = {};
    await Promise.all(Object.entries(m.files).map(async ([mode, file]) => {
      const response = await fetch(new URL(file.file, url));
      if (!response.ok) throw new Error(`Не удалось загрузить звук: ${mode}`);
      this.packs[mode] = decodePack(await response.arrayBuffer(), m.samples, mode === 'source' ? 1 : m.points.length);
      this.envelopes[mode] = this.packs[mode].map(samples => envelope(samples));
    }));
    this.index = nearestPoint(m.points, 0);
    this.slider.min = m.points[0].snr_db;
    this.slider.max = m.points.at(-1).snr_db;
    this.slider.step = m.points.length > 1 ? m.points[1].snr_db - m.points[0].snr_db : 1;
    const range = this.root.querySelector('.acd-range');
    range.firstElementChild.textContent = `${m.points[0].snr_db} · больше шума`;
    range.lastElementChild.textContent = `${m.points.at(-1).snr_db > 0 ? '+' : ''}${m.points.at(-1).snr_db} · меньше шума`;
    this.playButton.disabled = false;
    this.slider.disabled = false;
    this.root.querySelectorAll('input[type=radio]').forEach(radio => { radio.disabled = false; });
    this.status.textContent = 'Готово. Нажмите Play и сравните режимы при 0 dB.';
    this.update();
  }

  fail(error) {
    this.status.textContent = `${error.message}. Обновите страницу, чтобы повторить загрузку.`;
    this.status.classList.add('acd-error');
  }

  phase(now = this.context?.currentTime) {
    return this.playing ? loopPhase(this.offset, this.startedAt, now, this.manifest.duration) : this.offset;
  }

  buffer() {
    const key = `${this.mode}:${this.index}`;
    if (!this.buffers.has(key)) {
      const buffer = this.context.createBuffer(1, this.manifest.samples, this.manifest.sample_rate);
      buffer.copyToChannel(this.packs[this.mode][this.index], 0);
      this.buffers.set(key, buffer);
    }
    return this.buffers.get(key);
  }

  fadeOut(voice, now, end) {
    if (voice.stopping) return;
    voice.stopping = true;
    if (voice.gain.gain.cancelAndHoldAtTime) voice.gain.gain.cancelAndHoldAtTime(now);
    else { voice.gain.gain.cancelScheduledValues(now); voice.gain.gain.setValueAtTime(voice.gain.gain.value, now); }
    voice.gain.gain.linearRampToValueAtTime(0, end);
    voice.source.stop(end);
  }

  switchVoice() {
    const now = this.context.currentTime;
    const end = now + .035;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = this.buffer();
    source.loop = true;
    source.connect(gain).connect(this.context.destination);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(1, end);
    for (const voice of this.voices) this.fadeOut(voice, now, end);
    const voice = {source, gain};
    this.voices.add(voice);
    source.onended = () => { source.disconnect(); gain.disconnect(); this.voices.delete(voice); };
    source.start(now, this.phase(now));
  }

  async toggle() {
    if (this.toggling) return;
    this.toggling = true;
    try {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) throw new Error('Браузер не поддерживает Web Audio');
        this.context = new AudioContext();
        this.buffers = new Map();
      }
      await this.context.resume();
      const now = this.context.currentTime;
      if (this.playing) {
        this.offset = this.phase(now);
        this.playing = false;
        for (const voice of this.voices) this.fadeOut(voice, now, now + .025);
        cancelAnimationFrame(this.animation);
      } else {
        this.startedAt = now;
        this.playing = true;
        this.switchVoice();
        const animate = () => { this.draw(); if (this.playing) this.animation = requestAnimationFrame(animate); };
        this.animation = requestAnimationFrame(animate);
      }
      this.playButton.textContent = this.playing ? 'Ⅱ Pause' : '▶ Play';
      this.playButton.setAttribute('aria-label', this.playing ? 'Приостановить воспроизведение' : 'Начать циклическое воспроизведение');
      this.status.textContent = this.playing ? 'Фрагмент повторяется. Режим и SNR можно менять на ходу.' : 'Пауза. Следующее Play продолжит с той же позиции.';
      this.draw();
    } finally { this.toggling = false; }
  }

  update() {
    if (!this.packs?.ldpc) return;
    const point = this.manifest.points[this.index];
    this.slider.value = point.snr_db;
    this.root.querySelector('output').textContent = `${point.snr_db} dB`;
    this.slider.setAttribute('aria-valuetext', `${point.snr_db} децибел`);
    this.root.querySelector('.acd-result-label').textContent = MODES[this.mode];
    this.root.querySelector('.acd-definition').textContent = 'Во всех режимах SNR — отношение средней мощности передаваемого сигнала к мощности шума. При 0 dB эти мощности равны.';
    const chain = this.root.querySelector('.acd-chain');
    if (this.mode === 'analog') {
      chain.innerHTML = '<span>Аудио</span><b>→</b><span>AM</span><b>→</b><span>+ AWGN</span><b>→</b><span>AM демодулятор</span><b>→</b><span>Аудио</span>';
    } else {
      chain.innerHTML = ['Аудио','PCM','FEC','OOK','AWGN','Коррелятор / биты','Декодер','PCM','Аудио'].map((block, index) => {
        const fec = index === 2 || index === 6;
        const label = index === 2 ? 'LDPC' : index === 5 && this.mode === 'ldpc' ? 'Коррелятор / LLR' : block;
        return `${index ? '<b aria-hidden="true">→</b>' : ''}<span class="${fec ? (this.mode === 'ldpc' ? 'acd-active' : 'acd-bypass') : ''}">${label}${fec && this.mode === 'digital' ? '<small>обход</small>' : ''}</span>`;
      }).join('');
    }
    const details = this.root.querySelector('.acd-metrics');
    details.hidden = this.mode === 'analog';
    const price = this.root.querySelector('.acd-price');
    if (this.mode === 'analog') {
      price.innerHTML = '<strong>Амплитудная модуляция с несущей</strong><span>Синхронная демодуляция и фильтр звуковой полосы. При уменьшении SNR качество ухудшается постепенно.</span>';
    } else {
      const m = point[this.mode];
      price.innerHTML = `<strong>${this.mode === 'ldpc' ? `R = ${this.manifest.code.k} / ${this.manifest.code.n} ≈ ${m.rate.toLocaleString('ru-RU', {maximumFractionDigits: 3})}` : 'R = 1'}</strong><span>Передаваемых / информационных битов: ${m.overhead.toLocaleString('ru-RU', {maximumFractionDigits: 3})} / 1${this.mode === 'ldpc' ? ' · цена восстановления' : ' · без избыточности'}</span>`;
      details.querySelector('dl').innerHTML = [
        ['Channel BER', percent(m.channel_ber)],
        [this.mode === 'ldpc' ? 'BER после LDPC' : 'BER после решения', percent(m.post_ber)],
        [this.mode === 'ldpc' ? 'FER после LDPC' : 'FER без FEC', percent(m.fer)],
        ['Ошибочные блоки', `${m.frame_errors} / ${m.frames}`],
        ['Повреждённые отсчёты PCM', `${m.damaged_samples.toLocaleString('ru-RU')} / ${m.samples.toLocaleString('ru-RU')}`],
        ['Передано / информация', `${m.channel_bits.toLocaleString('ru-RU')} / ${m.information_bits.toLocaleString('ru-RU')} бит`]
      ].map(([title, value]) => `<div><dt>${title}</dt><dd>${value}</dd></div>`).join('');
    }
    this.draw();
  }

  draw() {
    if (!this.envelopes?.ldpc) return;
    const original = this.envelopes.source[0];
    const received = this.envelopes[this.mode][this.index];
    const gain = this.manifest.playback_gain;
    const peak = Math.max(gain, ...received.flat().map(Math.abs));
    const phase = this.phase();
    const style = getComputedStyle(this.root);
    const drawCanvas = (canvas, data, color) => {
      const width = canvas.clientWidth, height = canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
        canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      ctx.strokeStyle = style.getPropertyValue('--acd-grid');
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 1; i < 8; i++) { ctx.moveTo(width * i / 8, 0); ctx.lineTo(width * i / 8, height); }
      ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke();
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, width / data.length);
      ctx.beginPath();
      data.forEach(([low, high], i) => {
        const x = i * width / data.length;
        ctx.moveTo(x, height / 2 - high / peak * height * .44);
        ctx.lineTo(x, height / 2 - low / peak * height * .44);
      });
      ctx.stroke();
      const cursor = phase / this.manifest.duration * width;
      ctx.strokeStyle = style.getPropertyValue('--acd-text');
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cursor, 0); ctx.lineTo(cursor, height); ctx.stroke();
    };
    drawCanvas(this.root.querySelector('.acd-original'), original, style.getPropertyValue('--acd-blue'));
    drawCanvas(this.root.querySelector('.acd-received'), received, style.getPropertyValue('--acd-orange'));
    this.root.querySelector('.acd-scale').textContent = `Общий масштаб: ±${(peak / gain).toFixed(2)} · ${this.manifest.duration.toFixed(3)} s`;
    this.root.querySelector('.acd-time').textContent = `${phase.toFixed(2)} s`;
  }

  destroy() {
    cancelAnimationFrame(this.animation);
    this.resizeObserver.disconnect(); this.themeObserver.disconnect();
    this.context?.close();
  }
}

document.querySelectorAll('[data-audio-channel-demo]').forEach(root => { root.audioChannelDemo = new AudioChannelDemo(root); });
