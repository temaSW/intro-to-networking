// Visual state is a pure function of one continuous Closeread position (0…6).
// No elements are replaced while scrolling; only attributes/styles are updated.
const root = document.querySelector('[data-scroll-demo]');

if (root) {
  const svg = root.querySelector('svg');
  const nodes = [...root.querySelectorAll('[data-node]')];
  const route = root.querySelector('[data-route]');
  const activeRoute = root.querySelector('[data-active-route]');
  const wave = root.querySelector('[data-wave]');
  const packet = root.querySelector('[data-packet]');
  const count = root.querySelector('[data-scroll-demo-count]');
  const triggers = [...document.querySelectorAll('.scroll-demo .new-trigger')];
  const section = root.closest('.scroll-demo');
  const narrative = section.querySelector('.narrative-col');
  const heading = root.querySelector('[data-demo-heading]');
  const question = root.querySelector('[data-demo-question]');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const narrow = matchMedia('(max-width: 700px)');
  const clamp = (value, low = 0, high = 1) => Math.max(low, Math.min(high, value));
  const lerp = (a, b, t) => a + (b - a) * clamp(t);
  const ramp = (value, start, end) => clamp((value - start) / (end - start));
  const pointsWide = [[110, 230], [300, 230], [500, 230], [690, 230], [890, 230], [1090, 230]];
  const pointsNarrow = [[70, 90], [70, 220], [70, 350], [70, 480], [70, 610], [70, 740]];
  let points = pointsWide;
  let position = Number.isFinite(window.scrollDemoPosition) ? window.scrollDemoPosition : 0;
  let pending = false;
  let lastStage = -1;

  function geometricPosition() {
    if (triggers.length < 2) return position;
    const anchor = innerHeight / 2;
    const centers = triggers.map(trigger => {
      const box = trigger.getBoundingClientRect();
      return box.top + box.height / 2;
    });
    if (anchor <= centers[0]) return 0;
    for (let i = 0; i < centers.length - 1; i++) {
      if (anchor <= centers[i + 1]) {
        return i + clamp((anchor - centers[i]) / (centers[i + 1] - centers[i]));
      }
    }
    return centers.length - 1;
  }

  function layout() {
    points = narrow.matches ? pointsNarrow : pointsWide;
    nodes.forEach((node, index) => {
      node.setAttribute('transform', `translate(${points[index].join(' ')})`);
      const [label, sublabel] = node.querySelectorAll('text');
      label.setAttribute('x', narrow.matches ? '64' : '0');
      label.setAttribute('y', narrow.matches ? '-3' : '-58');
      sublabel.setAttribute('x', narrow.matches ? '64' : '0');
      sublabel.setAttribute('y', narrow.matches ? '23' : '70');
    });
    const d = `M${points.map(point => point.join(' ')).join(' L')}`;
    route.setAttribute('d', d);
    activeRoute.setAttribute('d', d);
    render();
  }

  function render() {
    pending = false;
    // Scrollama's active index can differ by direction at a trigger boundary.
    // Trigger centers give one unambiguous continuous coordinate in both directions.
    const p = clamp(geometricPosition(), 0, 6);
    const mobile = narrow.matches;
    const stage = Math.min(6, Math.round(p));
    const focus = [0, 0, 1, 2, 2, 4, 5][stage];
    if (stage !== lastStage) {
      heading.textContent = triggers[stage].querySelector('h3')?.textContent || '';
      question.textContent = triggers[stage].querySelector('p')?.textContent || '';
      lastStage = stage;
    }
    count.textContent = `${String(stage + 1).padStart(2, '0')} / 07`;
    nodes.forEach((node, index) => {
      const emphasis = reduceMotion.matches
        ? (index === focus ? 1 : 0.5)
        : 0.35 + 0.65 * Math.max(0, 1 - Math.abs(index - (p < 1 ? 0 : lerp(0, 5, (p - 1) / 5))) / 1.4);
      node.style.opacity = p < 0.4 && !reduceMotion.matches ? 1 : emphasis;
      node.querySelector('circle').setAttribute('r', String(reduceMotion.matches ? 38 : 38 + 6 * (emphasis - 0.35)));
    });

    const travel = p <= 1 ? 0 : p <= 3 ? lerp(0, 2, (p - 1) / 2) : lerp(2, 5, (p - 3) / 3);
    const from = Math.min(4, Math.floor(travel));
    const t = travel - from;
    const x = lerp(points[from][0], points[from + 1][0], t);
    const y = lerp(points[from][1], points[from + 1][1], t);
    const markerOpacity = reduceMotion.matches ? (p >= 1 ? 1 : 0) : ramp(p, 0.65, 1.15);
    packet.setAttribute('transform', `translate(${x} ${y}) scale(${reduceMotion.matches ? 1 : lerp(0.76, 1.1, ramp(p, 3.2, 4.5))})`);
    packet.style.opacity = markerOpacity * (reduceMotion.matches ? 1 : 1 - ramp(p, 2.1, 2.5) + ramp(p, 3.55, 4.3));
    wave.setAttribute('transform', `translate(${x} ${y}) rotate(${mobile ? 90 : 0})`);
    wave.style.opacity = reduceMotion.matches ? 0 : markerOpacity * ramp(p, 1.75, 2.2) * (1 - ramp(p, 3.5, 4.45));
    activeRoute.style.strokeDasharray = `${route.getTotalLength()} ${route.getTotalLength()}`;
    activeRoute.style.strokeDashoffset = String(route.getTotalLength() * (1 - travel / 5));

    if (reduceMotion.matches) {
      svg.setAttribute('viewBox', mobile ? '0 0 360 830' : '0 0 1200 440');
    } else if (mobile) {
      const targetY = p < 0.55 ? 415 : lerp(415, y, ramp(p, 0.55, 1.2));
      const height = lerp(830, 465, ramp(p, 0.55, 1.3));
      svg.setAttribute('viewBox', `0 ${clamp(targetY - height / 2, 0, 830 - height)} 360 ${height}`);
    } else {
      const width = lerp(1200, 820, ramp(p, 0.45, 1.4));
      const centerX = lerp(600, x, ramp(p, 0.4, 1.5));
      svg.setAttribute('viewBox', `${clamp(centerX - width / 2, 0, 1200 - width)} 10 ${width} 420`);
    }
  }

  function schedule() {
    if (!pending) {
      pending = true;
      requestAnimationFrame(render);
    }
  }

  window.addEventListener('scroll-demo-progress', event => {
    position = Number(event.detail) || 0;
    schedule();
  });
  window.addEventListener('scroll', schedule, { passive: true });
  narrow.addEventListener('change', layout);
  reduceMotion.addEventListener('change', schedule);
  layout();
  narrative.setAttribute('aria-hidden', 'true');
  section.classList.add('is-enhanced');
  root.classList.add('is-enhanced');
}
