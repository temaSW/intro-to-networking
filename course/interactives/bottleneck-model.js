// Aggregate shared-segment teaching model. Rates and capacities are in Mbit/s.
export const bottleneckDefaults = Object.freeze({users: 5, demand: 10, access: 100, aggregation: 300, transport: 1000});
export const bottleneckPresets = Object.freeze({
  small: {...bottleneckDefaults},
  crowd: {users: 40, demand: 10, access: 100, aggregation: 300, transport: 1000},
  transport: {users: 40, demand: 10, access: 800, aggregation: 600, transport: 250},
});

export function calculateBottleneck({users, demand, access, aggregation, transport}) {
  if (![users, demand, access, aggregation, transport].every(Number.isFinite) ||
      !Number.isInteger(users) || users < 1 || demand < 0 ||
      [access, aggregation, transport].some(capacity => capacity <= 0)) {
    throw new RangeError("Use a positive integer user count, nonnegative demand and positive capacities.");
  }
  const offered = users * demand;
  const segments = [
    {key: "access", label: "Доступ", capacity: access},
    {key: "aggregation", label: "Агрегация", capacity: aggregation},
    {key: "transport", label: "Транспорт", capacity: transport},
  ].map(segment => ({...segment, utilization: offered / segment.capacity}));
  const minimum = Math.min(...segments.map(segment => segment.capacity));
  const limiting = segments.filter(segment => segment.capacity === minimum).map(segment => segment.key);
  const delivered = Math.min(offered, minimum);
  return {offered, segments, limiting, capacityLimit: minimum, delivered, perUser: Math.min(demand, minimum / users)};
}
