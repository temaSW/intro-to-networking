// Functional frame maps. Standard structure is separate from illustrative allocations.
export const NR = Object.freeze({frameMs:10,subframeMs:1,slotMs:.5,slots:20,symbols:14,spacingKhz:30});
export const STAGES = [
  {id:'overview',label:'Карта ресурсов'},
  {id:'search',label:'1. Обнаружение'}, {id:'system',label:'2. Правила ячейки'},
  {id:'access',label:'3. Первое обращение'}, {id:'data',label:'4. Передача данных'}
];
export const CHANNELS = {
  ssb:{kind:'sync',label:'SSB',title:'Блок синхронизации и широковещательного канала',text:'Нисходящий блок: известные PSS и SSS помогают обнаружить ячейку и получить временную/частотную опору; PBCH несёт MIB. Показанный SSB занимает четыре символа и 240 поднесущих. Не каждый слот и не каждый кадр содержит SSB.'},
  sib:{kind:'control',label:'PDSCH · SIB1',title:'Общая системная информация на PDSCH',text:'Первый блок системной информации SIB1 передаётся по нисходящему общему каналу PDSCH. Он сообщает общие параметры ячейки, включая конфигурацию первоначального доступа. Его размещение узнают из управляющего назначения PDCCH, а не из фиксированного «КИ для SIB1».'},
  control:{kind:'control',label:'PDCCH',title:'Нисходящее назначение ресурса',text:'Физический нисходящий канал управления PDCCH сообщает, где и в каком режиме искать нисходящий блок или передавать восходящий. Выделенная область управления занимает часть символов и частотного ресурса; её конфигурация не одинакова для всех сетей.'},
  prach:{kind:'access',label:'PRACH',title:'Общее окно первоначального доступа',text:'Терминал передаёт известную преамбулу по PRACH, ещё не имея индивидуального ресурса для обычных данных. Время, частотная позиция и формат этой возможности задаются конфигурацией. Длительность преамбулы зависит от формата: она не является обычным 14-символьным блоком PUSCH.'},
  rar:{kind:'access',label:'PDSCH · ответ',title:'Ответ на попытку случайного доступа',text:'Ответ сети на PDSCH даёт временное упреждение, восходящее назначение для следующего сообщения и временный идентификатор. PDCCH указывает расположение ответа. Успешное обнаружение преамбулы ещё не означает, что участники различены.'},
  msg3:{kind:'access',label:'PUSCH · обращение',title:'Индивидуальное обращение после преамбулы',text:'Терминал использует назначенный PUSCH для следующего обращения. Если несколько терминалов выбрали одну преамбулу, их обращения могут столкнуться. Далее требуется разрешить конкуренцию.'},
  resolution:{kind:'access',label:'PDSCH · принятие',title:'Разрешение конкуренции',text:'Сеть сообщает результат, связывая успешный доступ с конкретным обращением. Это завершает выбранную процедуру случайного доступа, но не заменяет регистрацию, проверку абонента и подготовку сеанса данных.'},
  sr:{kind:'control',label:'PUCCH · запрос',title:'Запрос планирования',text:'Запрос планирования SR передаётся по настроенной возможности физического восходящего канала управления PUCCH. Он сообщает о потребности в восходящем ресурсе. Сам запрос не является назначением.'},
  ul:{kind:'payload',label:'PUSCH · данные',title:'Восходящий общий канал',text:'Телефон передаёт данные на назначенном временном и частотном ресурсе PUSCH. Здесь также может передаваться отчёт о буфере BSR. В другой ситуации этот же канал несёт служебное сообщение, как при первоначальном доступе.'},
  dl:{kind:'payload',label:'PDSCH · данные',title:'Нисходящий общий канал',text:'Сеть передаёт пользовательские данные на назначенном PDSCH. Здесь же в других сценариях идут SIB1, ответ на доступ и управляющие сообщения: назначение содержимого определяется контекстом.'},
  feedback:{kind:'control',label:'PUCCH · результат',title:'Обратная связь о приёме',text:'PUCCH может нести подтверждение или сообщение о неуспешном приёме, а также сведения о состоянии канала. Сеть использует обратную связь для повторов и адаптации.'},
  reference:{kind:'reference',label:'DM-RS',title:'Демодуляционные опорные сигналы',text:'DM-RS (Demodulation Reference Signals; также пишут DMRS) — известные опорные сигналы для оценки действия канала и демодуляции. Они размещаются внутри ресурсов соответствующего канала, а не занимают отдельный постоянный слот. PBCH имеет собственные DM-RS; PDSCH и PUSCH — свои.'}
};
export function slotDirection(slot,mode='fdd') {
  return mode==='fdd'?'both':['dl','dl','dl','mixed','ul'][slot%5];
}
export function nrEvents(stage='search',mode='fdd') {
  const ev=(id,direction,slot)=>({id,direction,slot,...CHANNELS[id]});
  const t=mode==='tdd';
  if(stage==='overview') return [ev('ssb','dl',0),ev('control','dl',2),ev('sib','dl',2),ev('prach','ul',4),ev('sr','ul',9),ev('control','dl',11),ev('ul','ul',14),ev('reference','ul',14),ev('dl','dl',16),ev('reference','dl',16),ev('feedback','ul',19)];
  if(stage==='search') return [ev('ssb','dl',0)];
  if(stage==='system') return [ev('ssb','dl',0),ev('control','dl',t?2:4),ev('sib','dl',t?2:4)];
  if(stage==='access') return [ev('prach','ul',t?4:2),ev('control','dl',6),ev('rar','dl',6),ev('msg3','ul',t?9:10),ev('control','dl',t?11:14),ev('resolution','dl',t?11:14)];
  if(stage==='data') return [ev('sr','ul',t?4:2),ev('control','dl',6),ev('ul','ul',t?9:10),ev('reference','ul',t?9:10),ev('control','dl',t?11:12),ev('dl','dl',t?11:12),ev('reference','dl',t?11:12),ev('feedback','ul',t?14:16)];
  throw new RangeError('Неизвестный этап');
}
// SS/PBCH block: frequency interval [start,end), four relative symbols.
export const SSB_REGIONS = [
  {id:'pss',symbol:0,start:56,end:183,label:'PSS'},
  {id:'pbch',symbol:1,start:0,end:240,label:'PBCH + DM-RS'},
  {id:'pbch',symbol:2,start:0,end:48,label:'PBCH'},
  {id:'sss',symbol:2,start:56,end:183,label:'SSS'},
  {id:'pbch',symbol:2,start:192,end:240,label:'PBCH'},
  {id:'pbch',symbol:3,start:0,end:240,label:'PBCH + DM-RS'}
];
