// Functional teaching scenario, not a protocol or a simulation of radio propagation.
// Event: [kind, direction, label]. Directions: down (AP → terminal), up,
// terminal/ap (local action). Previous events remain visible in the cumulative view.
export const stages = [
  {
    title: 'Обнаружение', anchor: 'discovery',
    problem: 'Терминал не знает, есть ли доступная точка доступа и где искать её передачу.',
    state: 'Найден кандидат на связь; данные ещё не прочитаны.',
    possible: 'Проверять известный признак и уточнять координаты приёма.',
    events: [['physical', 'terminal', 'Сканирование допустимых частотных каналов']],
  },
  {
    title: 'Физическая синхронизация', anchor: 'physical-synchronization',
    problem: 'Наличие сигнала не задаёт моменты отсчёта, частоту и границу физической передачи.',
    state: 'Восстановлены координаты приёма начального блока.',
    possible: 'При подходящей оценке канала читать блок известного формата.',
    events: [['physical', 'down', 'Известные опорные последовательности'], ['physical', 'terminal', 'Оценка такта, частоты и границы']],
  },
  {
    title: 'Получение правил', anchor: 'system-rules',
    problem: 'Терминал ещё не знает расписание приёма обращений точки доступа.',
    state: 'Из сообщения получены первый слот, период и частотный ресурс.',
    possible: 'Найти ближайший разрешённый слот после готовности к обращению.',
    events: [['control', 'ap', 'Задать расписание приёма обращений'], ['control', 'down', 'Служебное сообщение: O, P, R'], ['control', 'terminal', 'Прочитать поля; определить разрешённые слоты и ресурс']],
  },
  {
    title: 'Первое обращение', anchor: 'initial-access',
    problem: 'Индивидуальное назначение ещё не выдано; несколько терминалов могут выбрать одно место.',
    state: 'Попытка отправлена; её успех ещё не подтверждён.',
    possible: 'Точка доступа может обнаружить обращение и подготовить ответ.',
    events: [['control', 'terminal', 'Выбор разрешённого слота и ресурса'], ['physical', 'up', 'Первоначальное обращение']],
  },
  {
    title: 'Назначение ресурса', anchor: 'resource-allocation',
    problem: 'Нужно согласовать ресурс продолжения и момент действия назначения.',
    state: 'Получено назначение для продолжения; участник ещё может требовать подтверждения.',
    possible: 'Передать следующий блок в указанных координатах.',
    events: [['control', 'ap', 'Решение о ресурсе продолжения'], ['control', 'down', 'Ответ: где и когда продолжить'], ['physical', 'terminal', 'При необходимости — подстройка времени']],
  },
  {
    title: 'Разрешение конкуренции', anchor: 'contention-resolution',
    problem: 'Один ответ на общий признак могли принять сразу два терминала.',
    state: 'Подтверждён конкретный участник; остальные повторяют попытку.',
    possible: 'Продолжать индивидуальный обмен без неоднозначности адресата назначения.',
    events: [['control', 'up', 'Продолжение со сведениями об участнике'], ['control', 'down', 'Подтверждение конкретного участника'], ['control', 'terminal', 'Нет подтверждения → ожидание и повтор']],
  },
  {
    title: 'Поддержание обмена', anchor: 'channel-pilots',
    problem: 'Канал, генераторы и очереди меняются; прежние оценки и назначения устаревают.',
    state: 'Терминал участвует в обмене; согласованность поддерживается.',
    possible: 'Принимать текущие данные и готовить следующие передачи.',
    events: [['physical', 'up', 'Известные пилоты текущей передачи'], ['data', 'up', 'Пользовательские данные'], ['physical', 'ap', 'Оценка канала и эквализация'], ['control', 'down', 'Обновление назначения и служебный ответ'], ['physical', 'down', 'Опора для приёма / проба для будущего решения']],
  },
];

// One physical transmission in the bootstrap example; functions of reception
// are local actions, not additional messages sent by the access point.
export const bootstrapReception = {
  title: 'Приём кадра', hideTitle: true,
  events: [
    ['mixed', 'down', '', ['Синхронизация', 'Правила', 'Полезные данные']],
    ['physical', 'terminal', 'Оценка такта, частоты и границы'],
    ['control', 'terminal', 'Чтение правил'],
    ['control', 'terminal', 'Приём полезных данных по полученным правилам'],
  ],
};

export const nrEvents = [
  ['physical', 'down', 'SSB: сигналы синхронизации'],
  ['control', 'down', 'PBCH: начальная информация'],
  ['control', 'down', 'SIB1: системная конфигурация'],
  ['physical', 'up', 'Msg1: преамбула PRACH'],
  ['control', 'down', 'Msg2: RAR — подстройка и ресурс'],
  ['control', 'up', 'Msg3: продолжение на выделенном ресурсе'],
  ['control', 'down', 'Msg4: разрешение конкуренции'],
];

export function timelineView(index = 0, all = false) {
  if (!Number.isInteger(index) || index < 0 || index >= stages.length) throw new RangeError('Unknown agreement stage');
  return {selected: stages[index], visible: stages.slice(0, all ? stages.length : index + 1)};
}

// State changes in the lecture's neutral access scenario. A recognised first
// request does not itself reserve the resource for the user's data.
export const terminalStates = [
  {
    title: 'Включился', anchor: 'discovery',
    unknown: 'Неизвестно, где работает подходящая система.',
    mechanism: 'Поиск среди поддерживаемых частотных положений и проверка известного признака.',
    possible: 'Наблюдать сигнал; пользовательская передача пока не согласована.',
    events: [],
  },
  {
    title: 'Обнаружил систему', anchor: 'physical-synchronization',
    unknown: 'Не восстановлены граница передачи, моменты отсчёта и частотное рассогласование.',
    mechanism: 'Известная передача позволяет распознать систему; далее нужны временная и частотная синхронизация.',
    possible: 'Исследовать передачу найденной системы.',
    events: [['physical', 'down', 'Передача с распознаваемым признаком'], ['physical', 'terminal', 'Проверка признака']],
  },
  {
    title: 'Синхронизировался', anchor: 'system-rules',
    unknown: 'Неизвестны текущие параметры общего обмена.',
    mechanism: 'По известным опорам восстановлены временные и частотные координаты.',
    possible: 'При подходящем качестве и компенсации канала читать общие сообщения известного формата.',
    events: [['physical', 'down', 'Известные опоры передачи'], ['physical', 'terminal', 'Оценка границы, такта и частоты']],
  },
  {
    title: 'Узнал правила', anchor: 'initial-access',
    unknown: 'Первое обращение ещё не принято; индивидуальный ресурс не назначен.',
    mechanism: 'Из общего сообщения получены текущие параметры первоначального доступа.',
    possible: 'Обратиться через предусмотренный общий ресурс.',
    events: [['control', 'down', 'Общие сведения о первоначальном доступе'], ['control', 'terminal', 'Чтение текущих параметров по известному формату']],
  },
  {
    title: 'Получил доступ', anchor: 'resource-allocation',
    unknown: 'Не назначены время и частотный ресурс пользовательской передачи.',
    mechanism: 'Подтверждена попытка X и сообщён временный идентификатор T для дальнейшего обмена; постоянная идентичность устройства не устанавливается.',
    possible: 'Продолжить индивидуальный служебный обмен и сообщить потребность.',
    events: [['control', 'up', 'Обращение с идентификатором попытки X'], ['control', 'ap', 'Прочитано обращение X'], ['control', 'down', 'Принято обращение X; твой временный идентификатор T']],
  },
  {
    title: 'Получил ресурс', anchor: 'link-frame',
    unknown: 'Пользовательский блок ещё не передан и не принят соседним узлом.',
    mechanism: 'Система получила запрос и сообщила координаты и срок действия назначения.',
    possible: 'Передать оформленный блок в назначенном ресурсе.',
    events: [['control', 'up', 'Запрос потребности от участника T'], ['control', 'down', 'Назначение участнику T: где, когда и сколько передавать']],
  },
  {
    title: 'Передал данные', anchor: 'local-success',
    unknown: 'Получение данных конечным адресатом ещё не установлено.',
    mechanism: 'Терминал передал кадр, соседний узел обработал его по известным правилам.',
    possible: 'Продолжить обмен; соседний узел может передавать данные дальше.',
    events: [['data', 'up', 'Кадр с пользовательскими данными'], ['control', 'ap', 'Разбор блока и проверка целостности']],
  },
];

export function terminalStateView(index = 0) {
  if (!Number.isInteger(index) || index < 0 || index >= terminalStates.length) throw new RangeError('Unknown terminal state');
  return {index, current: terminalStates[index], previous: index ? terminalStates[index - 1] : null};
}
