export const APP_INPUT = 3;
export const APP_SERVICE = 2;
export const APP_QUEUE_LIMIT = 2;
export const APP_DURATION = 20;

export function createApplication() {
  return { time: 0, waiting: [], arrived: 0, completed: 0, rejected: 0,
    arrivals: [], served: [], refused: [] };
}

export function advanceApplication(state, protection = false) {
  if (state.time >= APP_DURATION) return state;
  const arrivals = Array.from({ length: APP_INPUT }, (_, i) => state.arrived + i + 1);
  const projected = state.waiting.length + APP_INPUT - APP_SERVICE;
  const remaining = protection ? Math.max(Math.min(projected, APP_QUEUE_LIMIT), state.waiting.length - APP_SERVICE) : projected;
  const admitted = remaining - state.waiting.length + APP_SERVICE;
  const work = [...state.waiting, ...arrivals.slice(0, admitted)];
  const served = work.splice(0, APP_SERVICE);
  const refused = arrivals.slice(admitted);
  return { time: state.time + 1, waiting: work, arrived: state.arrived + APP_INPUT,
    completed: state.completed + served.length, rejected: state.rejected + refused.length,
    arrivals, served, refused };
}
