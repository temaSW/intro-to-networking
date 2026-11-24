import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const model=await import('data:text/javascript,'+encodeURIComponent(readFileSync(new URL('../course/interactives/ip-addressing-model.js',import.meta.url),'utf8')));
const {parseIPv4,formatIPv4,subnet,checkSubnet,checkDelivery,checkPlan}=model;
const allCorrect=results=>Object.values(results).every(r=>r.ok===true);
const plan=(n1=0,n2=64)=>({prefix:'26',hosts:'62',network1:`192.168.20.${n1}`,first1:`192.168.20.${n1+1}`,last1:`192.168.20.${n1+62}`,network2:`192.168.20.${n2}`,first2:`192.168.20.${n2+1}`,last2:`192.168.20.${n2+62}`,a:`192.168.20.${n1+10}`,r1:`192.168.20.${n1+1}`,r2:`192.168.20.${n2+1}`,b:`192.168.20.${n2+10}`,gateway1:`192.168.20.${n1+1}`,gateway2:`192.168.20.${n2+1}`});
test('IPv4 parsing rejects malformed, out-of-range and ambiguous values',()=>{
  for(const value of ['',null,'1.2.3','1.2.3.256','-1.2.3.4','1.2.3.4/24','1.2.3.4tail','1e2.2.3.4','01.2.3.4'])assert.equal(parseIPv4(value),null,value);
  for(const value of ['0.0.0.0','127.0.0.1','192.168.20.255','255.255.255.255'])assert.equal(formatIPv4(parseIPv4(value)),value);
  assert.equal(parseIPv4(' 192.168.20.1 '),parseIPv4('192.168.20.1'));
});
test('Subnet arithmetic works at high IPv4 addresses and block boundaries',()=>{
  const n=subnet('192.168.10.70',26);
  assert.equal(formatIPv4(n.network),'192.168.10.64');assert.equal(formatIPv4(n.broadcast),'192.168.10.127');assert.equal(formatIPv4(n.mask),'255.255.255.192');assert.equal(n.hosts,62);
  assert.equal(formatIPv4(subnet('255.255.255.255',27).network),'255.255.255.224');
  assert.equal(formatIPv4(subnet('192.168.10.128',26).network),'192.168.10.128');
});
test('All three exercise answers match independent explicit expected values',()=>{
  const cases=[['255.255.255.0','256','192.168.8.0','192.168.8.1','192.168.8.254','192.168.8.255','254'],['255.255.255.192','64','192.168.10.64','192.168.10.65','192.168.10.126','192.168.10.127','62'],['255.255.255.224','32','192.168.30.160','192.168.30.161','192.168.30.190','192.168.30.191','30']];
  cases.forEach((values,i)=>{const a=Object.fromEntries(['mask','block','network','first','last','broadcast','hosts'].map((key,j)=>[key,values[j]]));assert.ok(allCorrect(checkSubnet(i,a)));for(const key of Object.keys(a)){assert.equal(checkSubnet(i,{...a,[key]:''})[key].ok,false);}});
  assert.equal(checkSubnet(1,{hosts:'62people'}).hosts.ok,false);
});
test('Only D changes the delivery decision when A changes from /26 to /24',()=>{
  const answers={p26_0:'direct',p26_1:'direct',p26_2:'gateway',p24_0:'direct',p24_1:'direct',p24_2:'direct'};
  assert.ok(allCorrect(checkDelivery(answers)));
  for(const key of Object.keys(answers))assert.equal(checkDelivery({...answers,[key]:''})[key].ok,false);
  assert.equal(checkDelivery({...answers,p26_2:'direct'}).p26_2.ok,false);
});
test('Every ordered pair of distinct /26 blocks is accepted, with alternate host choices',()=>{
  for(const a of [0,64,128,192])for(const b of [0,64,128,192])if(a!==b){
    assert.ok(allCorrect(checkPlan(plan(a,b))),`${a},${b}`);
    const p=plan(a,b);p.r1=`192.168.20.${a+62}`;p.gateway1=p.r1;p.a=`192.168.20.${a+1}`;p.prefix=' /26 ';
    assert.ok(allCorrect(checkPlan(p)),`${a},${b},alternate`);
  }
});
test('Invalid plan prefixes and networks defer dependent checks without false success',()=>{
  for(const prefix of ['','25','27','26.0','26x']){const r=checkPlan({...plan(),prefix});assert.equal(r.prefix.ok,false);assert.equal(r.a.ok,null);assert.ok(!allCorrect(r));}
  for(const network1 of ['192.168.20.1','192.168.21.0','10.0.0.0','']){const r=checkPlan({...plan(),network1});assert.equal(r.network1.ok,false);assert.equal(r.a.ok,null);}
  assert.equal(checkPlan(plan(0,0)).network2.ok,false);
});
test('Plans reject reserved addresses, duplicates, wrong networks, gateways and ranges',()=>{
  for(const [key,value] of [['a','192.168.20.0'],['a','192.168.20.63'],['a','192.168.20.70'],['a','192.168.20.1'],['r1','192.168.20.63'],['r2','192.168.20.127'],['b','192.168.20.65'],['gateway1','192.168.20.65'],['gateway2','192.168.20.1'],['first2','192.168.20.64'],['last1','192.168.20.63'],['hosts','64']])assert.equal(checkPlan({...plan(),[key]:value})[key].ok,false,`${key}=${value}`);
  assert.equal(checkPlan({...plan(),r1:''}).gateway1.ok,null);
});

test('Eight reproducible variants preserve the task constraints and validate their own answers',()=>{
  const signatures=new Set();
  for(let variant=1;variant<=8;variant++){
    const s=model.variantSettings(variant);assert.deepEqual(s,model.variantSettings(variant));
    signatures.add(JSON.stringify(s));
    s.cases.forEach((item,i)=>{
      const n=subnet(item.address,item.prefix),answers={};
      for(const key of ['mask','network','first','last','broadcast'])answers[key]=formatIPv4(n[key]);
      for(const key of ['block','hosts'])answers[key]=String(n[key]);
      assert.ok(allCorrect(checkSubnet(i,answers,variant)));
      if(variant>1)assert.equal(checkSubnet(i,answers,1).network.ok,false);
    });
    const small=subnet(s.source,26),large=subnet(s.source,24);
    assert.equal(subnet(s.gateway,26).network,small.network);
    const delivery={};let changes=0;
    for(let i=0;i<3;i++){
      const same=subnet(s.destinations[i],26).network===small.network;
      assert.equal(subnet(s.destinations[i],24).network,large.network);
      if(!same)changes++;
      delivery[`p26_${i}`]=same?'direct':'gateway';delivery[`p24_${i}`]='direct';
    }
    assert.equal(changes,1);assert.ok(allCorrect(checkDelivery(delivery,variant)));
    assert.ok(s.computers+1>30&&s.computers+1<=62);
    const base=parseIPv4(s.base),a={prefix:'26',hosts:'62'};
    for(const i of [1,2]){
      const net=base+(i-1)*64;
      for(const [key,offset]of [[`network${i}`,0],[`first${i}`,1],[`last${i}`,62],[`r${i}`,1],[`gateway${i}`,1],[i===1?'a':'b',10]])a[key]=formatIPv4(net+offset);
    }
    assert.ok(allCorrect(checkPlan(a,variant)));
    assert.equal(checkPlan({...a,network2:a.network1},variant).network2.ok,false);
    if(variant>1)assert.equal(checkPlan(plan(),variant).network1.ok,false);
  }
  assert.equal(signatures.size,8);
  for(const value of [0,9,1.5,'2',NaN])assert.throws(()=>model.variantSettings(value),RangeError);
});
