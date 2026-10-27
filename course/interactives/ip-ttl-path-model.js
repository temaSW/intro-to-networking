export const NODES = ['A', 'R1', 'R3', 'R2', 'B'];

export function packetJourney(initialTTL) {
  if (!Number.isInteger(initialTTL) || initialTTL < 1 || initialTTL > 255) throw new RangeError('TTL: целое от 1 до 255');
  let ttl = initialTTL;
  const events = [];
  for (let to = 1; to < NODES.length; to++) {
    const sentTTL = ttl;
    const delivered = to === NODES.length - 1;
    if (!delivered) ttl--;
    const dropped = ttl === 0;
    events.push({from: to - 1, to, sentTTL, ttl, dropped, delivered, reply: false,
      label: 'Пакет к B', badge: `TTL = ${ttl}`,
      status: delivered ? `B получил пакет с TTL ${ttl}. Получатель не уменьшает TTL для локальной доставки.`
        : `${NODES[to]}: TTL ${sentTTL} → ${ttl}. ${dropped ? 'Пакет отброшен; до B он не дошёл.' : 'Пакет готов к следующей отправке.'}`});
    if (delivered || dropped) break;
  }
  return events;
}

export function traceJourney() {
  const events = [];
  for (let initialTTL = 1; initialTTL <= 4; initialTTL++) {
    for (let probe = 1; probe <= 3; probe++) {
      const path = packetJourney(initialTTL);
      events.push({from: 0, to: 0, ttl: initialTTL, sentTTL: initialTTL, reply: false,
        label: 'Echo Request', badge: `TTL = ${initialTTL}`, initialTTL, probe,
        status: `A: новый Echo Request к B, начальный TTL ${initialTTL}, проба ${probe} из 3.`});
      events.push(...path.map(event => ({...event, label: 'Echo Request', initialTTL, probe})));
      const last = path.at(-1);
      const response = last.delivered ? 'Echo Reply' : 'Time Exceeded';
      const responder = NODES[last.to];
      events.push({from: last.to, to: last.to, reply: true, label: 'Ответ ICMP', badge: response,
        initialTTL, probe, status: `${responder} создаёт отдельный пакет ICMP ${response} к A. ${last.dropped ? 'Исходный запрос отброшен.' : 'Запрос достиг B.'}`});
      for (let from = last.to; from > 0; from--) {
        events.push({from, to: from - 1, reply: true, label: 'Ответ ICMP', badge: response,
          initialTTL, probe, record: from === 1 ? {ttl: initialTTL, probe, responder, response} : null,
          status: from === 1 ? `A получил ${response} от ${responder}: TTL запроса ${initialTTL}, проба ${probe} из 3.`
            : `Отдельный ответ ICMP ${response} от ${responder} возвращается к A через ${NODES[from - 1]}.`});
      }
    }
  }
  return events;
}
