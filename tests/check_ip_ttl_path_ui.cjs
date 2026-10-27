const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = path.join(__dirname, '../course/interactives');
const dataURL = text => 'data:text/javascript,' + encodeURIComponent(text);
(async () => {
  const modelURL = dataURL(fs.readFileSync(path.join(source, 'ip-ttl-path-model.js'), 'utf8'));
  const {packetJourney, traceJourney} = await import(modelURL);
  for (const ttl of [1, 2, 3, 4, 8, 255]) {
    const events = packetJourney(ttl), last = events.at(-1);
    assert.equal(events.length, Math.min(ttl, 4));
    assert.equal(last.delivered, ttl >= 4);
    assert.equal(last.dropped, ttl < 4);
    assert.equal(last.ttl, Math.max(0, ttl - 3));
    for (const e of events) {
      assert.equal(e.sentTTL - e.ttl, e.delivered ? 0 : 1);
      assert(e.sentTTL > 0, 'Never send TTL zero');
    }
  }
  for (const ttl of [0, -1, 256, 1.5, NaN]) assert.throws(() => packetJourney(ttl), RangeError);
  const trace = traceJourney(), records = trace.filter(e => e.record);
  assert.equal(records.length, 12);
  for (let ttl = 1; ttl <= 4; ttl++) {
    const row = records.filter(e => e.initialTTL === ttl);
    assert.deepEqual(row.map(e => e.probe), [1, 2, 3]);
    assert(row.every(e => e.to === 0 && e.reply));
    assert(row.every(e => e.record.responder === (ttl === 4 ? 'B' : `R${ttl}`)));
    assert(row.every(e => e.record.response === (ttl === 4 ? 'Echo Reply' : 'Time Exceeded')));
  }
  // Every response is created at the endpoint of a finished request, not returned as that request.
  for (let i = 1; i < trace.length; i++) {
    if (trace[i].reply && !trace[i-1].reply) {
      assert.equal(trace[i].from, trace[i].to);
      assert.equal(trace[i].from, trace[i-1].to);
      assert(trace[i-1].dropped || trace[i-1].delivered);
    }
  }
  function element() {
    const listeners = {}, classes = new Set();
    return {value:'2', disabled:false, hidden:true, textContent:'', validity:{valid:true}, attributes:{},
      classList:{toggle(k,v){v ? classes.add(k) : classes.delete(k);}, contains:k=>classes.has(k)},
      addEventListener:(e,fn)=>listeners[e]=fn, emit:e=>listeners[e]?.(), setAttribute(k,v){this.attributes[k]=v;}};
  }
  function makeRoot(mode) {
    const parts = Object.fromEntries(['play','step','reset','expand','packet','label','badge','status','controls',...(mode==='delivery'?['range','number']:[])].map(k=>[k,element()]));
    const cells = {};
    for(let ttl=1;ttl<=4;ttl++) {
      cells[`[data-path-responder="${ttl}"]`]=element();
      for(let probe=1;probe<=3;probe++) cells[`[data-path-result="${ttl}-${probe}"]`]=element();
    }
    return {parts,cells,isConnected:true,dataset:{ipPathDemo:mode},
      querySelector(q){const m=q.match(/^\[data-path-([a-z]+)\]$/);return m ? parts[m[1]] : cells[q];},
      querySelectorAll:q=>q.includes('data-path-result') ? Object.values(cells) : []};
  }
  const delivery=makeRoot('delivery'), tracing=makeRoot('trace');
  let id=0,time=0;const frames=new Map(),docEvents={};
  global.document={hidden:false,querySelectorAll:q=>q==='[data-ip-path-demo]'?[delivery,tracing]:[],addEventListener(e,f){(docEvents[e]??=[]).push(f);}};
  global.matchMedia=()=>({matches:false});
  global.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};global.cancelAnimationFrame=i=>frames.delete(i);
  const ui=fs.readFileSync(path.join(source,'ip-ttl-path-ui.js'),'utf8').replace("'./ip-ttl-path-model.js'",JSON.stringify(modelURL));
  await import(dataURL(ui));
  const d=delivery.parts,t=tracing.parts;
  assert.equal(frames.size,0);assert.equal(d.controls.hidden,false);assert.equal(t.controls.hidden,false);
  d.step.emit('click');assert.equal(d.badge.textContent,'TTL = 1');
  d.step.emit('click');assert.match(d.status.textContent,/R2: TTL 1 → 0/);assert.equal(d.play.disabled,true);
  assert.equal(t.badge.textContent,'TTL = 1'); // independent instances
  d.range.value='4';d.range.emit('input');assert.equal(frames.size,0);
  for(let i=0;i<4;i++)d.step.emit('click');
  assert.match(d.status.textContent,/B получил пакет с TTL 1/);assert.equal(d.packet.classList.contains('ip-ttl-dropped'),false);
  d.number.value='';d.number.validity.valid=false;d.number.emit('change');assert.equal(d.number.value,'4');d.number.validity.valid=true;
  d.reset.emit('click');d.play.emit('click');
  function ticks(n,dt=100){for(let i=0;i<n;i++){time+=dt;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(time));}}
  ticks(8);assert.equal(d.badge.textContent,'TTL = 4');
  d.play.emit('click');const position=d.packet.attributes.transform;ticks(10);assert.equal(d.packet.attributes.transform,position);
  d.play.emit('click');ticks(50);assert.equal(d.play.disabled,true);assert.equal(frames.size,0);
  for(let i=0;i<3;i++)t.step.emit('click'); // start, expire, create separate answer
  const first=tracing.cells['[data-path-result="1-1"]'];assert.equal(first.textContent,'—');assert.equal(t.badge.textContent,'Time Exceeded');
  t.step.emit('click');assert.equal(first.textContent,'✓');
  for(let i=4;i<trace.length;i++)t.step.emit('click');
  assert.equal(t.play.disabled,true);assert.equal(tracing.cells['[data-path-result="4-3"]'].textContent,'✓');
  assert.match(tracing.cells['[data-path-responder="4"]'].textContent,/B · Echo Reply/);
  t.reset.emit('click');assert.equal(first.textContent,'—');t.play.emit('click');ticks(9);
  document.hidden=true;for(const fn of docEvents.visibilitychange)fn();assert.equal(frames.size,0);
  document.hidden=false;t.play.emit('click');ticks(1000);assert.equal(t.play.disabled,true);assert.equal(frames.size,0);
  // Smooth adjacent flights; only the intentional creation of a new probe may return to A instantly.
  d.reset.emit('click');d.play.emit('click');let x=80;
  for(let i=0;i<280;i++){
    ticks(1,16);const next=Number(d.packet.attributes.transform.match(/translate\(([-.\d]+)/)[1]);
    assert(Math.abs(next-x)<7, `Jump ${x} -> ${next}`);x=next;
  }
  assert.equal(d.play.disabled,true);
  console.log('TTL delivery and tracert model/UI checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
