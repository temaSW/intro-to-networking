import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
const context={window:{}};
vm.runInNewContext(readFileSync(new URL('../course/interactives/concept-path-model.js',import.meta.url),'utf8'),context);
const model=context.window.CourseConceptPath;
vm.runInNewContext(readFileSync(new URL('../course/interactives/concept-protocol-model.js',import.meta.url),'utf8'),context);
const protocols=context.window.CourseConceptProtocols;
vm.runInNewContext(readFileSync(new URL('../course/interactives/concept-packet-model.js',import.meta.url),'utf8'),context);
const packet=context.window.CourseConceptPacket;
const all=id=>Array.from({length:model.stateAt(id,0).count},(_,i)=>model.stateAt(id,i));
const path=s=>Array.from(s.path||[]);
test('SMB stays in the local segment and returns data from the file server',()=>{
  const states=all('smb');
  assert.ok(states.every(s=>!path(s).includes(3)));
  assert.deepEqual(path(states[1]),[0,1,2]);assert.deepEqual(path(states[2]),[2,1,0]);
  assert.equal(states.at(-1).at,0);
});
test('Name service is distinct from the web server',()=>{
  const states=all('web');
  assert.equal(states[1].path.at(-1),4);
  assert.equal(states[2].path[0],4);
  assert.equal(states[3].path.at(-1),3);
  assert.ok(!path(states[3]).includes(4));
});
test('Message delivery uses two exchanges with a server acceptance in between',()=>{
  const states=all('message');
  assert.deepEqual(path(states[1]),[0,5,1,2]);
  assert.equal(states[2].at,2);assert.ok(!states[2].done);
  assert.deepEqual(path(states[3]),[2,3,6,4]);
  assert.equal(states[4].at,4);assert.ok(states[4].done);
  assert.deepEqual(path(states[5]),[4,6,3,2,1,5,0]);
});
test('Call signalling is invariant; relay choice only changes the media path',()=>{
  for(const index of [0,1,2])assert.deepEqual(path(model.stateAt('call',index)),path(model.stateAt('call',index,true)));
  for(const index of [3,4,5]){
    const direct=path(model.stateAt('call',index));
    const relayed=path(model.stateAt('call',index,true));
    assert.ok(!direct.includes(2)&&!direct.includes(5));
    assert.ok(relayed.includes(5)&&!relayed.includes(2));
    assert.equal(direct[0],relayed[0]);assert.equal(direct.at(-1),relayed.at(-1));
  }
});
test('Direct VoIP uses the switch for both signalling and speech',()=>{
  const states=all('voip');assert.equal(states[0].nodes.length,3);
  assert.ok(states.filter(s=>s.path).every(s=>path(s).includes(1)));
  assert.ok(states[1].control);assert.ok(!states[3].control);
});
test('Every highlighted path follows real edges in its own diagram',()=>{
  for(const id of model.ids)for(const state of all(id)){
    for(const relay of [false,true]){
      const s=model.stateAt(id,state.index,relay),p=path(s);
      for(let i=1;i<p.length;i++)assert.ok(s.edges.some(([a,b])=>(a===p[i-1]&&b===p[i])||(b===p[i-1]&&a===p[i])),`${id}: ${p}`);
    }
  }
});
test('Late speech packet misses its playout slot, while the next packet remains usable',()=>{
  const normal=model.voicePackets(),late=model.voicePackets(true);
  assert.ok(normal.every(p=>p.arrival<p.play));
  assert.equal(late.filter(p=>p.arrival>p.play).length,1);
  assert.equal(late[2].id,3);assert.ok(late[2].arrival>late[2].play);
  assert.ok(late[3].arrival<late[3].play);
  assert.deepEqual(Array.from(late,p=>p.play),Array.from(normal,p=>p.play));
});
test('Unknown scenarios and out of range steps are rejected',()=>{
  assert.throws(()=>model.stateAt('unknown',0),{name:'RangeError'});
  for(const id of model.ids)for(const index of [-1,1.5,model.stateAt(id,0).count])assert.throws(()=>model.stateAt(id,index),{name:'RangeError'});
});
test('Protocol events reference valid participants and conceptual states',()=>{
  for(const id of model.ids)for(const relay of [false,true]){
    const d=protocols.forCase(id,relay);
    for(const r of d.rows){
      assert.ok(r.from>=0&&r.from<d.actors.length&&r.to>=0&&r.to<d.actors.length);
      assert.doesNotThrow(()=>model.stateAt(id,r.step,relay));
      if(r.from===r.to)assert.equal(r.kind,'local');
    }
  }
});
test('SMB opens before reading and closes after data arrives',()=>{
  const r=protocols.forCase('smb').rows;
  assert.match(r[0].label,/CREATE/);assert.match(r[1].label,/FileId/);
  assert.match(r[2].label,/READ/);assert.match(r[3].label,/READ Response/);
  assert.match(r[4].label,/CLOSE/);assert.equal(r[3].from,1);
});
test('HTTP follows DNS, TCP establishment and an explicitly collapsed TLS exchange',()=>{
  const r=protocols.forCase('web').rows;
  assert.match(r[0].label,/DNS Query/);assert.match(r[1].label,/DNS Response/);
  assert.match(r[2].label,/SYN$/);assert.match(r[3].label,/SYN \+ ACK/);assert.match(r[4].label,/ACK/);
  assert.equal(r[5].kind,'band');assert.match(r[6].label,/GET/);assert.match(r[7].label,/200 OK/);
});
test('XMPP receipt originates at the recipient, not at the forwarding server',()=>{
  const r=protocols.forCase('message').rows;
  const receipt=r.filter(r=>r.label.includes('received'));
  assert.deepEqual(Array.from(receipt,r=>[r.from,r.to]),[[2,1],[1,0]]);
  assert.equal(r[1].kind,'local');
});
test('Jingle IQ acknowledgement precedes session acceptance; media bypasses signalling server',()=>{
  for(const relay of [false,true]){
    const d=protocols.forCase('call',relay),r=d.rows;
    assert.match(r[0].label,/session-initiate/);assert.equal(r[2].label,'IQ result');
    assert.match(r[4].label,/session-accept/);
    const media=r.filter(r=>r.kind==='media');
    assert.ok(media.every(r=>r.from!==1&&r.to!==1));
    assert.equal(media.some(r=>r.from===2||r.to===2),relay);
  }
});
test('SIP final response is acknowledged; RTP is distinct from SIP teardown',()=>{
  const r=protocols.forCase('voip').rows;
  assert.match(r[0].label,/INVITE/);assert.match(r[1].label,/180 Ringing/);
  assert.match(r[2].label,/200 OK \(INVITE\)/);assert.equal(r[3].label,'SIP ACK');
  assert.equal(r[4].kind,'media');assert.equal(r[5].kind,'media');
  assert.equal(r[6].label,'SIP BYE');assert.equal(r[7].label,'SIP 200 OK (BYE)');
});
test('Every network exchange has an explicit transport; local work has none',()=>{
  for(const id of model.ids)for(const relay of [false,true]){
    const d=protocols.forCase(id,relay);assert.ok(d.stack.includes('IP'));
    for(const r of d.rows)if(r.kind==='local')assert.equal(r.transport,null);else assert.ok(['TCP','UDP'].includes(r.transport));
  }
  assert.ok(protocols.forCase('smb').rows.every(r=>r.transport==='TCP'));
  const web=protocols.forCase('web').rows;
  assert.ok(web.slice(0,2).every(r=>r.transport==='UDP'));
  assert.ok(web.slice(2,8).every(r=>r.transport==='TCP'));
});
test('Messenger signalling uses separate TCP connections; chosen media uses UDP',()=>{
  const message=protocols.forCase('message').rows;
  assert.equal(message[0].flow,'А ↔ сервер');assert.equal(message[2].flow,'Б ↔ сервер');
  assert.equal(message[4].flow,'Б ↔ сервер');assert.equal(message[5].flow,'А ↔ сервер');
  for(const relay of [false,true])for(const r of protocols.forCase('call',relay).rows)
    assert.equal(r.transport,r.kind==='media'?'UDP':'TCP');
  assert.ok(protocols.forCase('voip').rows.every(r=>r.transport==='UDP'));
});
test('Both views share every protocol event and route it between its actual participants',()=>{
  const mapping={cloud:[0,3],smb:[0,2],web:[0,4,3],tls:[0,3],message:[0,2,4],call:[0,2,5,4],voip:[0,2]};
  for(const id of model.ids)for(const relay of [false,true]){
    const rows=protocols.forCase(id,relay).rows;
    for(let i=0;i<rows.length;i++){
      const e=rows[i],state=protocols.eventState(id,i+1,relay);
      assert.equal(state.title,e.label);assert.equal(state.count,rows.length+1);assert.equal(state.eventIndex,i);
      assert.equal(state.fromNode,mapping[id][e.from]);assert.equal(state.toNode,mapping[id][e.to]);
      if(e.kind==='local'||e.kind==='band')assert.equal(state.path,null);
      else {
        assert.equal(state.path[0],state.fromNode);assert.equal(state.path.at(-1),state.toNode);
        for(let n=1;n<state.path.length;n++)assert.ok(state.edges.some(([a,b])=>(a===state.path[n-1]&&b===state.path[n])||(b===state.path[n-1]&&a===state.path[n])));
      }
      assert.equal(state.train,false);assert.equal(state.duplex,false);
    }
  }
});
test('Response messages reverse the actual route instead of repeating the request animation',()=>{
  const request=protocols.eventState('smb',1),reply=protocols.eventState('smb',2);
  assert.deepEqual(Array.from(reply.path),Array.from(request.path).reverse());
  const web=protocols.eventState('web',4);assert.equal(web.fromNode,3);assert.equal(web.toNode,0);
  const ring=protocols.eventState('voip',2);assert.deepEqual(Array.from(ring.path),[2,1,0]);
});
test('Packet arrow orientation follows right, left and vertical movement',()=>{
  assert.equal(protocols.heading({x:0,y:0},{x:1,y:0}),0);
  assert.equal(protocols.heading({x:1,y:0},{x:0,y:0}),180);
  assert.equal(protocols.heading({x:0,y:0},{x:0,y:1}),90);
  assert.equal(protocols.heading({x:0,y:1},{x:0,y:0}),-90);
});
test('Motion pauses without drift, resumes from the same position and never wraps',()=>{
  const motion=protocols.createMotion();motion.play(1000);
  assert.equal(motion.sample(1900).progress,.5);motion.pause(1900);
  assert.equal(motion.sample(20000).progress,.5);
  motion.play(21000);assert.equal(motion.sample(21450).progress,.75);
  assert.equal(motion.sample(21900).progress,1);assert.equal(motion.snapshot().running,false);
  assert.equal(motion.sample(30000).progress,1);
  motion.reset();motion.play(0,true);
  assert.equal(motion.sample(1800).progress,1);assert.equal(motion.snapshot().running,true);
  assert.equal(motion.sample(4500).done,true);assert.equal(motion.snapshot().running,false);
});
test('TLS 1.3 full handshake authenticates the server before application data',()=>{
  const rows=protocols.forCase('tls').rows;
  assert.deepEqual(Array.from(rows.slice(0,2),r=>r.label),['ClientHello + key_share','ServerHello + key_share']);
  const labels=Array.from(rows,r=>r.label);
  for(const[a,b]of [['EncryptedExtensions','Certificate'],['Certificate','CertificateVerify'],['CertificateVerify','Finished (сервер)'],['Finished (сервер)','Проверка сервера'],['Проверка сервера','Finished (клиент)'],['Finished (клиент)','Application Data: запрос HTTP']])assert.ok(labels.indexOf(a)<labels.indexOf(b));
  assert.equal(rows.find(r=>r.label==='Certificate').from,1);
  assert.equal(rows.find(r=>r.label==='Finished (клиент)').from,0);
});
test('TLS Hello is clear; following handshake and application data use distinct protection stages',()=>{
  const rows=protocols.forCase('tls').rows;
  assert.ok(rows.slice(0,2).every(r=>r.protection==='none'&&r.transport==='TCP'));
  for(const r of rows.filter(r=>['EncryptedExtensions','Certificate','CertificateVerify','Finished (сервер)','Finished (клиент)'].includes(r.label)))assert.equal(r.protection,'handshake');
  for(const r of rows.filter(r=>r.label.startsWith('Application Data')))assert.equal(r.protection,'application');
  for(let i=0;i<rows.length;i++)if(rows[i].kind==='local')assert.equal(protocols.eventState('tls',i+1).path,null);
});
test('Certificate name mismatch terminates the exchange without HTTP or client Finished',()=>{
  const rows=protocols.forCase('tls',false,true).rows;
  assert.ok(rows.some(r=>r.label==='Проверка: имя не совпало'));
  assert.ok(!rows.some(r=>r.label.startsWith('Application Data')||r.label==='Finished (клиент)'));
  assert.equal(rows.at(-1).label,'Alert: certificate_unknown');assert.equal(rows.at(-1).protection,'handshake');
  const state=protocols.eventState('tls',rows.length,false,true);
  assert.deepEqual(Array.from(state.path),[0,4,1,2,3]);assert.equal(state.count,rows.length+1);
});
const packetStages=(id,index,relay=false)=>{const n=packet.describe(id,index,0,relay)?.phaseCount||0;return Array.from({length:n},(_,i)=>packet.describe(id,index,(i+.5)/n,relay));};
test('Remote packet passes Wi-Fi, bridge, Ethernet fibre and a final Ethernet link',()=>{
  const steps=packetStages('web',7),links=steps.filter(s=>s.phase.kind==='transfer');
  assert.deepEqual(links.map(s=>s.frame.format),['Wi-Fi','Ethernet','Ethernet','Ethernet']);
  assert.deepEqual(links.map(s=>s.frame.medium),['radio','copper','optical','copper']);
  assert.deepEqual(links.map(s=>s.ttl),[64,64,63,62]);
  assert.ok(steps.every(s=>s.ipSource==='192.0.2.10'&&s.ipDestination==='198.51.100.20'));
  assert.equal(links[0].frame.macSource,links[1].frame.macSource);
  assert.equal(links[0].frame.macDestination,links[1].frame.macDestination);
  assert.notEqual(links[1].frame.macSource,links[2].frame.macSource);
  assert.notEqual(links[0].frame.macDestination,links[0].frame.radioReceiver);
});
test('Return packet has reversed IP endpoints and a distinct Wi-Fi transmitter',()=>{
  const links=packetStages('web',8).filter(s=>s.phase.kind==='transfer'),last=links.at(-1);
  assert.equal(last.frame.format,'Wi-Fi');assert.equal(last.ttl,62);
  assert.equal(last.ipSource,'198.51.100.20');assert.equal(last.ipDestination,'192.0.2.10');
  assert.notEqual(last.frame.macSource,last.frame.radioTransmitter);
  assert.equal(last.frame.macDestination,last.frame.radioReceiver);
});
test('A local SMB switch preserves IP, MAC data endpoints and TTL',()=>{
  const stages=packetStages('smb',1),links=stages.filter(s=>s.phase.kind==='transfer');
  assert.equal(links.length,2);assert.ok(links.every(s=>s.frame.format==='Ethernet'&&s.ttl===64));
  assert.equal(links[0].frame.macSource,links[1].frame.macSource);assert.equal(links[0].frame.macDestination,links[1].frame.macDestination);
  assert.equal(new Set(stages.map(s=>s.packetId)).size,1);
  assert.equal(stages[0].phase.unit,'message');assert.equal(stages.at(-1).phase.unit,'message');
});
test('TCP control segments do not acquire fictitious application data',()=>{
  const stages=packetStages('web',3);assert.ok(stages.length);
  assert.ok(stages.every(s=>!s.layers.includes('message')));
  assert.equal(stages[0].phase.unit,'transport');assert.equal(stages.at(-1).phase.unit,'transport');
});
test('A messenger server begins a new IP exchange when forwarding to the recipient',()=>{
  const a=packet.describe('message',1,0),b=packet.describe('message',3,0);
  assert.equal(a.ipSource,'192.0.2.10');assert.equal(a.ipDestination,'203.0.113.20');
  assert.equal(b.ipSource,'203.0.113.20');assert.equal(b.ipDestination,'198.51.100.10');
  assert.notEqual(a.packetId,b.packetId);
});
test('Packet motion is continuous across encapsulation, every hop and decapsulation',()=>{
  for(const id of model.ids)for(const relay of [false,true])for(let i=1;i<=protocols.forCase(id,relay).rows.length;i++){
    const plan=packet.describe(id,i,0,relay);if(!plan)continue;
    assert.equal(plan.delivery,0);assert.equal(packet.describe(id,i,1,relay).delivery,1);
    for(let stage=1;stage<plan.phaseCount;stage++){
      const a=packet.describe(id,i,stage/plan.phaseCount-1e-9,relay),b=packet.describe(id,i,stage/plan.phaseCount+1e-9,relay);
      assert.ok(Math.hypot(a.point.x-b.point.x,a.point.y-b.point.y)<.01,`${id}:${i}:${stage}`);
      assert.ok(b.delivery>=a.delivery-1e-8);assert.ok(Number.isFinite(b.angle));
    }
  }
});
test('Local actions and aggregate TLS bands do not produce lower-layer packets',()=>{
  for(const id of model.ids){const d=protocols.forCase(id);for(let i=0;i<d.rows.length;i++)if(['local','band'].includes(d.rows[i].kind))assert.equal(packet.describe(id,i+1,.5),null);}
});
test('Changing the animation duration preserves its paused normalized position',()=>{
  const motion=protocols.createMotion();motion.play(0);motion.pause(900);motion.setDuration(9750);
  assert.equal(motion.snapshot().progress,.5);assert.equal(motion.sample(20000).progress,.5);
  motion.play(21000);assert.equal(motion.sample(25875).progress,1);
});


test('Cloud file uses HTTPS across routers and returns bytes to the client',()=>{
  const d=protocols.forCase('cloud');
  assert.equal(d.rows.length,3);
  assert.ok(d.rows[0].label.startsWith('HTTP: GET'));
  assert.ok(d.rows[1].label.includes('200 OK'));
  assert.equal(d.rows[2].kind,'local');
  assert.ok(d.rows.slice(0,2).every(r=>r.transport==='TCP'&&r.protection==='application'));
  assert.deepEqual(path(protocols.eventState('cloud',1)),[0,4,1,2,3]);
  assert.deepEqual(path(protocols.eventState('cloud',2)),[3,2,1,4,0]);
  const start=packet.describe('cloud',1,0),end=packet.describe('cloud',1,1);
  assert.equal(start.ipDestination,'198.51.100.20');
  assert.equal(start.payload,'Защищённые данные');
  assert.equal(end.ttl,62);
  assert.equal(packet.describe('cloud',3,0),null);
});
