// Closeread owns the sticky layout; this small adapter changes the diagram's focus.
document.addEventListener('DOMContentLoaded', () => {
  const section = document.querySelector('.course-closeread');
  const map = section?.querySelector('[data-route-map]');
  if (!map) return;

  const stages = [...map.querySelectorAll('[data-route-stage]')];
  const token = map.querySelector('.route-map-token');
  const triggers = [...section.querySelectorAll('.new-trigger[data-stage]')];

  function showStage(stage) {
    const overview = stage === 'all';
    map.dataset.stage = stage;
    for (const item of stages) {
      const current = item.dataset.routeStage === stage;
      item.classList.toggle('is-current', current);
      item.classList.toggle('is-muted', !overview && !current);
      if (current) item.append(token);
    }
    token.hidden = overview;
  }

  showStage('all');
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) showStage(entry.target.dataset.stage);
    }
  }, { rootMargin: '-49% 0px -49% 0px' });
  triggers.forEach((trigger) => observer.observe(trigger));
});
