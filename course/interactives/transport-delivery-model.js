/** Deterministic endpoint model. Time is in teaching ticks, payload in bytes. */
export const BLOCKS = ['ABCD', 'EFGH', 'IJKL', 'MNOP', 'QRST'];
export const CAPACITY = 12;
export const BASE = 1001;
export function start(protocol = 'tcp', fault = 'none', reader = 'normal', application = 'web') {
  if (!['tcp','udp'].includes(protocol) || !['none','loss','reorder','delay','duplicate'].includes(fault) || !['normal','slow'].includes(reader) || !['web','chat'].includes(application)) throw new RangeError('Unknown experiment');
  return {protocol, fault, reader, application, time:0, sent:0, ack:0, edge:CAPACITY,
    next:0, read:0, buffer:[], pending:[], wire:[], output:[], events:[], history:[], done:false,
    source:'192.0.2.130', destination:'198.51.100.20', sourcePort:application==='web'?51000:52000,
    destinationPort:application==='web'?8080:9000};
}
export function step(previous) {
  if (previous.done) return previous;
  const s = structuredClone(previous);
  s.time++; s.events=[];
  const log = message => s.events.push(message);
  // Read at a fixed cadence; TCP exposes only the contiguous prefix.
  if (s.time % (s.reader==='slow'?4:1)===0 && s.buffer.length) {
    const index=s.protocol==='udp'?0:s.buffer.findIndex(b=>b.index*4===s.read);
    if(index>=0) {
      const b=s.buffer.splice(index,1)[0]; s.output.push(b.text); s.read+=4;
      log(`Приложение прочитало «${b.text}».`);
      if(s.protocol==='tcp') s.wire.push({kind:'ack',due:s.time+1,ack:s.next,edge:s.read+CAPACITY});
    }
  }
  const arriving=s.wire.filter(p=>p.due<=s.time);
  s.wire=s.wire.filter(p=>p.due>s.time);
  for(const p of arriving) {
    if(p.kind==='ack') {
      // A later cumulative ACK cannot be undone by an older one.
      s.ack=Math.max(s.ack,p.ack); s.edge=Math.max(s.edge,p.edge);
      s.pending=s.pending.filter(b=>(b.index+1)*4>s.ack);
      log(`← ACK ${BASE+p.ack}; окно ${p.edge-p.ack} байт.`);
      continue;
    }
    const b={index:p.index,text:BLOCKS[p.index]};
    log(`→ ${s.protocol==='tcp'?'SEQ '+(BASE+p.index*4):'Датаграмма '+(p.index+1)}: «${b.text}» принят транспортом.`);
    if(s.protocol==='udp') {
      if(s.buffer.length*4<CAPACITY) s.buffer.push(b);
      else log('Буфер UDP заполнен: датаграмма отброшена.');
    } else {
      if(p.index*4>=s.read && (p.index+1)*4<=s.read+CAPACITY && !s.buffer.some(x=>x.index===p.index)) s.buffer.push(b);
      else log('Повторные или не помещающиеся в окно байты не добавлены в буфер.');
      while(s.buffer.some(x=>x.index*4===s.next)) s.next+=4;
      s.wire.push({kind:'ack',due:s.time+1,ack:s.next,edge:s.read+CAPACITY});
      log(`Получатель отправил ACK ${BASE+s.next}: следующий ожидаемый байт; окно ${s.read+CAPACITY-s.next} байт.`);
    }
  }
  const transmit=(index,retry=false)=> {
    const pending=s.pending.find(b=>b.index===index);
    if(pending) pending.time=s.time;
    else if(s.protocol==='tcp') s.pending.push({index,time:s.time});
    log(`${retry?'Повтор':'Отправка'} «${BLOCKS[index]}»${s.protocol==='tcp'?' · SEQ '+(BASE+index*4):''} · порты ${s.sourcePort} → ${s.destinationPort}.`);
    if(!retry && index===1 && s.fault==='loss') { log('IP-сеть потеряла блок 2.'); return; }
    const extra=!retry && index===1 ? (s.fault==='reorder'?2:s.fault==='delay'?7:0) : 0;
    s.wire.push({kind:'data',index,due:s.time+1+extra,retry});
    if(!retry && index===2 && s.fault==='duplicate') s.wire.push({kind:'data',index,due:s.time+2,retry:false});
  };
  const expired=s.pending.find(b=>s.time-b.time>=6);
  if(s.protocol==='tcp' && expired) { log('Истёк таймер неподтверждённых данных.'); transmit(expired.index,true); }
  else if(s.sent<BLOCKS.length) {
    if(s.protocol==='udp' || (s.sent+1)*4<=s.edge) transmit(s.sent++);
    else log('Отправка новых байтов приостановлена: объявленное окно не позволяет продолжить.');
  }
  if(!s.events.length) log('Ожидание: данные в сети или приложение пока не читает буфер.');
  s.done=s.sent===BLOCKS.length && !s.wire.length && !s.pending.length && !s.buffer.length;
  if(s.done) log('Обмен завершён.');
  s.history.push(...s.events.map(message=>({time:s.time,message})));
  return s;
}
