// Pure forwarding model. All addresses belong to documentation prefixes.
export const SOURCE = '192.0.2.130';
export const DESTINATIONS = ['198.51.100.20', '203.0.113.20', '192.0.2.200'];

export function address(value) {
  if (typeof value !== 'string') throw new RangeError('Некорректный IP-адрес');
  if (value.includes(':')) {
    if (!/^[0-9a-f:]+$/i.test(value) || value.split('::').length > 2) throw new RangeError('Некорректный IPv6-адрес');
    const parts = value.split('::');
    const left = parts[0] ? parts[0].split(':') : [];
    const right = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
    const missing = 8 - left.length - right.length;
    if ((parts.length === 1 && missing !== 0) || (parts.length === 2 && missing < 1)) throw new RangeError('Некорректный IPv6-адрес');
    const words = [...left, ...Array(parts.length === 2 ? missing : 0).fill('0'), ...right];
    if (words.some(w => !/^[0-9a-f]{1,4}$/i.test(w))) throw new RangeError('Некорректный IPv6-адрес');
    return {bits:128, value:words.reduce((n,w) => (n << 16n) + BigInt(`0x${w}`), 0n)};
  }
  const octets = value.split('.');
  if (octets.length !== 4 || octets.some(w => !/^\d{1,3}$/.test(w) || Number(w) > 255)) throw new RangeError('Некорректный IPv4-адрес');
  return {bits:32, value:octets.reduce((n,w) => (n << 8n) + BigInt(w), 0n)};
}

export function matches(destination, prefix) {
  const [network, length, extra] = prefix.split('/');
  const a = address(destination), b = address(network), n = Number(length);
  if (extra !== undefined || !/^\d+$/.test(length ?? '') || n < 0 || n > b.bits) throw new RangeError('Некорректный префикс');
  return a.bits === b.bits && (a.value >> BigInt(a.bits-n)) === (b.value >> BigInt(b.bits-n));
}

export function lookup(destination, routes) {
  address(destination);
  const matching = routes.filter(r => matches(destination, r.prefix));
  const selected = matching.reduce((best, r) => !best || Number(r.prefix.split('/')[1]) > Number(best.prefix.split('/')[1]) ? r : best, null);
  return {matching, selected};
}

const route = (prefix, next, gateway, iface, link) => ({prefix, next, gateway, iface, link});
export function tables(scenario = 'normal') {
  if (!['normal','default','missing','loop'].includes(scenario)) throw new RangeError('Неизвестный набор таблиц');
  const r1 = [
    route('0.0.0.0/0','R3','192.0.2.6','if13','Ethernet по волокну'),
    route('198.51.0.0/16','R2','192.0.2.2','if12','Ethernet по меди'),
    route('198.51.100.0/24','R2','192.0.2.2','if12','Ethernet по меди'),
  ];
  if (scenario === 'default') r1.splice(0, r1.length, route('0.0.0.0/0','R3','192.0.2.6','if13','Ethernet по волокну'));
  if (scenario === 'missing') r1.splice(0, r1.length, route('198.51.100.0/24','R2','192.0.2.2','if12','Ethernet по меди'));
  return {
    R1:r1,
    R2:[scenario === 'loop'
      ? route('198.51.100.0/24','R1','192.0.2.1','if21','Ethernet по меди')
      : route('198.51.100.0/24','B',null,'ifB','Ethernet по волокну')],
    R3:[route('198.51.100.0/24','R2','192.0.2.9','if32','Ethernet по меди'),
      route('203.0.113.0/24','C',null,'ifC','Ethernet по меди')],
  };
}

export function start(destination = DESTINATIONS[0], limit = 64, scenario = 'normal') {
  if (!DESTINATIONS.includes(destination)) throw new RangeError('Назначение вне учебной сети');
  if (!Number.isInteger(limit) || limit < 1 || limit > 255) throw new RangeError('TTL: целое от 1 до 255');
  tables(scenario);
  return {destination, source:SOURCE, limit, scenario, node:'R1', sender:'A', link:'Wi-Fi', history:[], status:'active'};
}

export function inspect(state) {
  const routes = tables(state.scenario)[state.node] ?? [];
  return {routes, ...lookup(state.destination, routes)};
}

export function forward(state) {
  if (state.status !== 'active') return state;
  const decision = inspect(state);
  const selected = decision.selected;
  const expired = state.limit <= 1;
  const status = expired ? 'expired' : !selected ? 'unreachable' : ['B','C'].includes(selected.next) ? 'delivered' : 'active';
  const hop = {...decision, node:state.node, before:state.limit, after:expired ? 0 : selected ? state.limit-1 : state.limit,
    incoming:{sender:state.sender, receiver:state.node, link:state.link},
    outgoing:!expired && selected ? {sender:state.node, receiver:selected.next, link:selected.link} : null, status};
  return {...state, limit:hop.after, node:hop.outgoing?.receiver ?? state.node, sender:state.node,
    link:hop.outgoing?.link ?? state.link, history:[...state.history,hop], status};
}
