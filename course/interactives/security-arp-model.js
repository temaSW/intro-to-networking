export const LAST_STEP = 4;

// The accepted false entry is an explicit condition of this teaching example.
export function arpState(step = 0, action = 'forward') {
  const index = Math.max(0, Math.min(LAST_STEP, Math.trunc(Number(step) || 0)));
  const accepted = index >= 2;
  const dropped = index === 4 && action === 'drop';
  const stages = [
    ['Обычная передача', 'В таблице S адрес шлюза G связан с MAC-адресом G. Кадр передаётся непосредственно G.'],
    ['Сообщение от X', 'X сообщает S: «IP-адрес G соответствует MAC-адресу X». Запись на S пока прежняя.'],
    ['Запись на S заменена', 'По условиям примера S принял сообщение. Теперь IP-адрес G связан с MAC-адресом X.'],
    ['Следующий кадр от S', 'S использует новую запись: кадр с IP-пакетом к серверу R приходит X.'],
    dropped
      ? ['X отбрасывает пакет', 'Пакет дошёл до X, но к G не передан. Локальный путь обрывается на X.']
      : ['X передаёт пакет дальше', 'X создаёт кадр к настоящему G. Локальный путь данных теперь S → X → G.'],
  ];
  return {
    step: index, title: stages[index][0], explanation: stages[index][1],
    mapping: accepted ? 'MAC X' : 'MAC G', accepted,
    destinationIP: 'R',
    message: index === 1,
    direct: index === 0,
    toX: index >= 3,
    toG: index === 4 && !dropped,
    dropped,
    frame: index === 0 ? 'S → G' : index === 3 ? 'S → X' : index === 4 && !dropped ? 'X → G' : null,
    path: index === 0 ? 'S → G' : index >= 3 ? (index === 4 && !dropped ? 'S → X → G' : 'S → X') : null,
  };
}
