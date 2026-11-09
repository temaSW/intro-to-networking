export function udpReflection(step = 0, services = 8) {
  const index = Math.max(0, Math.min(3, Math.round(Number(step) || 0)));
  const count = Math.max(1, Math.min(20, Math.round(Number(services) || 1)));
  const requestBytes = 80, responseBytes = 800, requestsPerSecond = 10;
  const victimKbps = index === 2 ? responseBytes * requestsPerSecond * 8 / 1000
    : index === 3 ? count * responseBytes * requestsPerSecond * 8 / 1000 : 0;
  return { step: index, services: count, requestBytes, responseBytes, requestsPerSecond,
    amplification: responseBytes / requestBytes, victimKbps, capacityKbps: 400,
    request: index >= 1, response: index >= 2, multiple: index === 3,
    title: ['Участники обмена', 'Запрос создан A, источник указан V', 'Ответ службы направлен к V', 'Ответы нескольких служб сходятся к V'][index],
    explanation: [
      'A создаёт запросы. Службы отвечают по адресу источника. Узел V запросов не отправляет.',
      'Служба получила запрос 80 байт с адресом источника V. Подставной адрес в этом примере не был отфильтрован.',
      'Одна служба отвечает узлу V: 800 байт на запрос. До ответа она не выполняла проверку обратной достижимости отправителя.',
      `${count} служб отвечают V. При 10 запросах в секунду к каждой предложенная нагрузка составляет ${victimKbps} кбит/с при ёмкости канала 400 кбит/с.`,
    ][index] };
}
