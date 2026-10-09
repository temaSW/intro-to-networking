/** Pure teaching model: explicit stages, symbolic addresses and supplied reachability. */
export const destinations = Object.freeze({
  D: Object.freeze({name:'Сервер Д', next:'В', output:1}),
  E: Object.freeze({name:'Сервер Е', next:'Г', output:2}),
  U: Object.freeze({name:'Сам узел У', next:null, output:null}),
  Z: Object.freeze({name:'Сервер Ж — путь неизвестен', next:null, output:null}),
});
const clamp = (value, max) => Math.min(max, Math.max(0, Math.trunc(Number(value) || 0)));
export function packet(destination='D') {
  if (!Object.hasOwn(destinations,destination)) throw new RangeError('Unknown destination');
  return {source:'С', destination, payload:'Привет'};
}
export function decision(p) {
  if (p.destination==='U') return {action:'local', next:null, output:null};
  const route=destinations[p.destination];
  if (!route?.next) return {action:'unreachable', next:null, output:null};
  return {action:'forward', next:route.next, output:route.output};
}
export function scene(kind, destination='D', requestedStage=0) {
  if (!['build','forward'].includes(kind)) throw new RangeError('Unknown scene');
  if (kind==='build' && !['D','E'].includes(destination)) throw new RangeError('Build requires a remote addressee');
  const p=packet(destination), action=decision(p);
  const count=kind==='build'?3:action.action==='forward'?5:3;
  const stage=clamp(requestedStage,count-1);
  const incoming={sender:'С', receiver:'У', packet:{...p}};
  const outgoing=kind==='forward' && stage>=3 && action.action==='forward'
    ?{sender:'У', receiver:action.next, packet:{...p}}:null;
  return {kind,stage,count,packet:p,decision:action,
    form:kind==='build'?['data','annotated','packet'][stage]:['incoming','packet','decision','outgoing','received'][stage],
    incoming:kind==='forward'?incoming:null,outgoing,
    // At the first build stage the observer has no destination information.
    observable:kind==='build'&&stage===0?{payload:p.payload}:{...p},
  };
}
