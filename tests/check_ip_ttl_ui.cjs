const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const source = path.join(__dirname,'../course/interactives');
const dataURL = text => 'data:text/javascript,'+encodeURIComponent(text);
(async()=>{
 const modelURL=dataURL(fs.readFileSync(path.join(source,'ip-ttl-model.js'),'utf8'));
 const m=await import(modelURL);
 let s=m.startLoop(false);for(let i=0;i<1000;i++)s=m.nextLoop(s);
 assert.deepEqual(s,{node:'R1',ttl:null,hops:1000,expired:false});
 for(const n of [1,2,3,64,255]){
   let state=m.startLoop(true,n),original=structuredClone(state);
   let next=m.nextLoop(state);assert.deepEqual(state,original);
   for(let i=0;i<n;i++)state=m.nextLoop(state);
   assert.equal(state.expired,true);assert.equal(state.ttl,0);assert.equal(state.hops,n);
   assert.equal(state.node,n%2===1?'R2':'R1');assert.equal(m.nextLoop(state),state);
 }
 let circle=m.startLoop(true,2);circle=m.nextLoop(circle);assert.deepEqual(circle,{node:'R2',ttl:1,hops:1,expired:false});circle=m.nextLoop(circle);assert.deepEqual(circle,{node:'R1',ttl:0,hops:2,expired:true});
 for(const n of [0,256,1.2,NaN])assert.throws(()=>m.startLoop(true,n),RangeError);
 function element(){const listeners={};return {value:'3',checked:false,disabled:false,hidden:true,validity:{valid:true},textContent:'',attributes:{},classList:{toggle(){}},addEventListener(e,fn){listeners[e]=fn;},emit(e){return listeners[e]?.();},setAttribute(k,v){this.attributes[k]=v;}};}
 const parts=Object.fromEntries(['limited','range','number','play','step','packet','badge','status','reset','controls','expand'].map(k=>[k,element()]));
 const paths={R1:{getTotalLength:()=>100,getPointAtLength:t=>({x:150+4.2*t,y:125})},R2:{getTotalLength:()=>100,getPointAtLength:t=>({x:570-4.2*t,y:125})}};
 const root={isConnected:true,querySelector(q){const match=q.match(/^\[data-ttl-([a-z]+)\]$/);if(match)return parts[match[1]];return paths[q.includes('"R1"')?'R1':'R2'];},querySelectorAll:()=>[]};
 let id=0,time=0;const frames=new Map(),docEvents={};
 global.document={hidden:false,querySelectorAll:()=>[root],addEventListener:(e,f)=>docEvents[e]=f};
 global.matchMedia=()=>({matches:false});
 global.requestAnimationFrame=fn=>{frames.set(++id,fn);return id;};global.cancelAnimationFrame=i=>frames.delete(i);
 const ui=fs.readFileSync(path.join(source,'ip-ttl-ui.js'),'utf8').replace("'./ip-ttl-model.js'",JSON.stringify(modelURL));
 await import(dataURL(ui));
 assert.equal(frames.size,0);assert.equal(parts.controls.hidden,false);assert.match(parts.status.textContent,/Без ограничения/);
 parts.step.emit('click');assert.match(parts.status.textContent,/на R2/);assert.match(parts.status.textContent,/пересылок: 1/);
 parts.reset.emit('click');parts.limited.checked=true;parts.limited.emit('change');assert.equal(parts.number.disabled,false);assert.equal(frames.size,0);
 parts.step.emit('click');assert.match(parts.status.textContent,/TTL = 2/);
 parts.step.emit('click');assert.match(parts.status.textContent,/TTL = 1/);
 parts.step.emit('click');assert.match(parts.status.textContent,/отброшен/);assert.equal(parts.play.disabled,true);assert.equal(parts.step.disabled,true);assert.match(parts.status.textContent,/пересылок: 3/);
 parts.reset.emit('click');assert.equal(parts.play.disabled,false);
 parts.number.value='';parts.number.validity.valid=false;parts.number.emit('input');parts.reset.emit('click');assert.equal(parts.number.value,'3');parts.number.validity.valid=true;
 parts.limited.checked=false;parts.limited.emit('change');parts.play.emit('click');assert.equal(frames.size,1);
 function ticks(n){for(let i=0;i<n;i++){time+=100;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(time));}}
 ticks(14);const position=parts.packet.attributes.transform;parts.play.emit('click');assert.equal(frames.size,0);
 ticks(10);assert.equal(parts.packet.attributes.transform,position);
 parts.play.emit('click');ticks(25);assert.match(parts.status.textContent,/пересылок: [1-9]/);
 document.hidden=true;docEvents.visibilitychange();assert.equal(frames.size,0);
 parts.reset.emit('click');assert.match(parts.status.textContent,/пересылок: 0/);assert.equal(frames.size,0);
 // Sample a full round trip at 60 fps: starts, arrivals and reversals must not teleport.
 document.hidden=false;parts.play.emit('click');let lastX=150;let reachedOther=false;
 for(let i=0;i<150;i++){
   time+=16;const batch=[...frames.values()];frames.clear();batch.forEach(fn=>fn(time));
   const match=parts.packet.attributes.transform.match(/translate\(([-.\d]+) ([-.\d]+)\)/);
   assert(match);const x=Number(match[1]);assert(Math.abs(x-lastX)<13,`Position jump: ${lastX} -> ${x}`);
   if(x===570)reachedOther=true;lastX=x;
 }
 assert(reachedOther,'First arrival must take less than 2.4 seconds');
 assert.match(parts.status.textContent,/пересылок: 2/); // two transfers within 2.4 s
 parts.play.emit('click');assert.equal(frames.size,0);
 const svg=fs.readFileSync(path.join(source,'../_includes/ip-ttl-loop.html'),'utf8');
 for(const [node,x,end] of [['R1',150,570],['R2',570,150]]){
   const tag=svg.match(new RegExp(`<path data-ttl-path="${node}"[^>]+>`))[0];
   const coords=tag.match(/ d="([^"]+)"/)[1].match(/-?\d+(?:\.\d+)?/g).map(Number);
   assert.deepEqual(coords.slice(0,2),[x,125]);assert.deepEqual(coords.slice(-2),[end,125]);
 }
 // The last permitted flight must be animated before dropping at the receiver.
 parts.limited.checked=true;parts.range.value='1';parts.reset.emit('click');parts.play.emit('click');
 ticks(5);assert.equal(parts.play.disabled,false);assert.equal(parts.badge.textContent,'TTL = 1');
 ticks(10);assert.match(parts.status.textContent,/R2: TTL 1 → 0/);assert.match(parts.status.textContent,/пересылок: 1/);assert.equal(frames.size,0);
 console.log('TTL model and UI lifecycle checks passed');
})().catch(e=>{console.error(e);process.exitCode=1;});
