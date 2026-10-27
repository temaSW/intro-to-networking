export function startLoop(limited = false, initialTTL = 3) {
  if (typeof limited !== 'boolean' || !Number.isInteger(initialTTL) || initialTTL < 1 || initialTTL > 255) throw new RangeError('TTL: целое от 1 до 255');
  return {node:'R1', ttl:limited ? initialTTL : null, hops:0, expired:false};
}
export function nextLoop(state) {
  if (state.expired) return state;
  const ttl=state.ttl === null ? null : state.ttl-1;
  return {node:state.node === 'R1' ? 'R2' : 'R1', ttl, hops:state.hops+1, expired:ttl===0};
}
