import {readFileSync} from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
const model=await import('data:text/javascript,'+encodeURIComponent(readFileSync(new URL('../course/interactives/ip-addressing-model.js',import.meta.url),'utf8')));
const fixtures=JSON.parse(readFileSync(new URL('./ip_addressing_fixtures.json',import.meta.url),'utf8'));
const {parseIPv4,formatIPv4,subnet,checkSubnet,checkDelivery,checkPlan,variantSettings,minimumPrefix}=model;
const allCorrect=results=>Object.values(results).every(r=>r.ok===true);

test('IPv4 parsing rejects malformed and ambiguous values and handles high addresses',()=>{
  for(const v of ['',null,'1.2.3','1.2.3.256','-1.2.3.4','1.2.3.4/24','1.2.3.4tail','1e2.2.3.4','01.2.3.4'])assert.equal(parseIPv4(v),null);
  for(const v of ['0.0.0.0','127.0.0.1','192.168.20.255','255.255.255.255'])assert.equal(formatIPv4(parseIPv4(v)),v);
  assert.equal(parseIPv4(' 192.168.20.1 '),parseIPv4('192.168.20.1'));
  assert.equal(formatIPv4(subnet('255.255.255.255',27).network),'255.255.255.224');
});

test('Eight variants are reproducible and vary masks, directions and planning constraints',()=>{
  assert.equal(model.VARIANT_COUNT,8);
  const signatures=fixtures.map(({variant})=>{const s=variantSettings(variant);assert.deepEqual(s,variantSettings(variant));return JSON.stringify([s.cases.map(c=>c.prefix),s.delivery.states.map(t=>t.rows.map(r=>[r.sender,r.recipient,r.prefix])),s.plan.parentPrefix,s.plan.computers,s.plan.reserved,s.plan.fixedNetworks,s.plan.fixedRouters]);});
  assert.equal(new Set(signatures).size,8);
  for(const v of [0,9,1.5,'2',NaN])assert.throws(()=>variantSettings(v),RangeError);
});

for(const f of fixtures){
  test(`Variant ${f.variant}: subnet boundaries and address roles match explicit fixtures`,()=>{
    f.subnets.forEach((a,i)=>{
      assert.ok(allCorrect(checkSubnet(i,a,f.variant)));
      for(const key of Object.keys(a))assert.equal(checkSubnet(i,{...a,[key]:''},f.variant)[key].ok,false,key);
      assert.equal(checkSubnet(i,{...a,hosts:a.hosts+'people'},f.variant).hosts.ok,false);
      const wrongRole=a.role==='host'?'network':'host';assert.equal(checkSubnet(i,{...a,role:wrongRole},f.variant).role.ok,false);
    });
  });
  test(`Variant ${f.variant}: forwarding decisions match explicit expectations in every state`,()=>{
    assert.ok(allCorrect(checkDelivery(f.delivery,f.variant)));
    for(const key of Object.keys(f.delivery)){
      assert.equal(checkDelivery({...f.delivery,[key]:''},f.variant)[key].ok,false);
      assert.equal(checkDelivery({...f.delivery,[key]:f.delivery[key]==='direct'?'gateway':'direct'},f.variant)[key].ok,false);
    }
  });
  test(`Variant ${f.variant}: valid plans, wrong boundaries, reserved addresses and gateways`,()=>{
    const a=f.plan;assert.ok(allCorrect(checkPlan(a,f.variant)));
    assert.ok(allCorrect(checkPlan({...a,prefix1:' /'+a.prefix1+' '},f.variant)));
    for(const i of [1,2]){
      const host=i===1?'a':'b';
      for(const value of ['',a[`network${i}`],formatIPv4(parseIPv4(a[`last${i}`])+1),a[`r${i}`]])assert.equal(checkPlan({...a,[host]:value},f.variant)[host].ok,false);
      assert.equal(checkPlan({...a,[`gateway${i}`]:a[host]},f.variant)[`gateway${i}`].ok,false);
      assert.equal(checkPlan({...a,[`network${i}`]:a[`first${i}`]},f.variant)[`network${i}`].ok,false);
      assert.equal(checkPlan({...a,[`prefix${i}`]:'24'},f.variant)[`network${i}`].ok,null);
      assert.equal(checkPlan({...a,[`prefix${i}`]:String(Number(a[`prefix${i}`])+1)},f.variant)[`prefix${i}`].ok,false);
    }
  });
}

test('Host roles depend on the full mask, including usable .0 and .255 addresses',()=>{
  assert.equal(model.addressRole('10.20.4.255',23),'host');
  assert.equal(model.addressRole('10.20.5.0',23),'host');
  assert.equal(model.addressRole('10.20.4.0',23),'network');
  assert.equal(model.addressRole('10.20.5.255',23),'broadcast');
});

test('Minimal sizing counts the router interface and crosses capacity thresholds',()=>{
  for(const [computers,prefix]of [[12,28],[13,28],[14,27],[20,27],[25,27],[29,27],[30,26],[50,26],[90,25]])assert.equal(minimumPrefix(computers),prefix);
});

test('Reserved ranges, fixed network addresses and fixed routers are enforced',()=>{
  assert.equal(checkPlan({...fixtures[1].plan,network1:'192.168.40.0'},2).network1.ok,false);
  assert.equal(checkPlan({...fixtures[5].plan,network2:'192.168.120.128'},6).network2.ok,false);
  assert.equal(checkPlan({...fixtures[7].plan,network1:'192.168.160.96'},8).network1.ok,false);
  for(const variant of [3,7,8]){
    const a=fixtures[variant-1].plan,s=variantSettings(variant);
    for(const i of Object.keys(s.plan.fixedRouters)){
      const other=formatIPv4(parseIPv4(a[`r${i}`])+1);
      assert.equal(checkPlan({...a,[`r${i}`]:other,[`gateway${i}`]:other},variant)[`r${i}`].ok,false);
    }
  }
});

test('Unequal subnets may not overlap even if their network addresses differ',()=>{
  const a={...fixtures[7].plan,network2:'192.168.160.80'};
  assert.equal(checkPlan(a,8).network2.ok,false);
  assert.equal(checkPlan(a,8).b.ok,null);
  // Adjacent /27 and /28 blocks are valid.
  assert.ok(allCorrect(checkPlan(fixtures[7].plan,8)));
});

test('Every valid pair in the unconstrained equal-size task is accepted',()=>{
  for(const n1 of [0,64,128,192])for(const n2 of [0,64,128,192]){
    const a={...fixtures[0].plan};
    for(const [i,n]of [[1,n1],[2,n2]])for(const [key,offset]of [[`network${i}`,0],[`first${i}`,1],[`last${i}`,62],[`r${i}`,1],[`gateway${i}`,1],[i===1?'a':'b',10]])a[key]=`192.168.20.${n+offset}`;
    assert.equal(allCorrect(checkPlan(a,1)),n1!==n2);
  }
});

test('Plans reject broadcast host addresses, wrong gateways and unequal overlapping blocks',()=>{
  const a={...fixtures[4].plan,a:'192.168.100.63',gateway2:'192.168.100.1'};
  const r=checkPlan(a,5);assert.equal(r.a.ok,false);assert.equal(r.gateway2.ok,false);
  const b={...fixtures[7].plan,network2:'192.168.160.80',first2:'192.168.160.81',last2:'192.168.160.94',r2:'192.168.160.81',b:'192.168.160.82',gateway2:'192.168.160.81'};
  assert.equal(checkPlan(b,8).network2.ok,false);
});

test('Different valid placements and host choices are accepted in constrained tasks',()=>{
  for(const [variant,n1,n2]of [[2,128,224],[4,128,0],[6,64,0],[8,64,112]]){
    const a={...fixtures[variant-1].plan},s=variantSettings(variant);
    for(const [i,n]of [[1,n1],[2,n2]]){
      const base=parseIPv4(s.plan.base)+n,size=2**(32-Number(a[`prefix${i}`]));
      a[`network${i}`]=formatIPv4(base);a[`first${i}`]=formatIPv4(base+1);a[`last${i}`]=formatIPv4(base+size-2);
      a[`r${i}`]=s.plan.fixedRouters?.[i]??formatIPv4(base+size-2);a[`gateway${i}`]=a[`r${i}`];a[i===1?'a':'b']=formatIPv4(base+3);
    }
    assert.ok(allCorrect(checkPlan(a,variant)),`alternate placement ${variant}`);
  }
  for(const variant of [3,5,7]){
    const a={...fixtures[variant-1].plan};a.a=a.first1===a.r1?formatIPv4(parseIPv4(a.first1)+3):a.first1;
    a.b=a.last2===a.r2?formatIPv4(parseIPv4(a.last2)-3):a.last2;
    assert.ok(allCorrect(checkPlan(a,variant)),`alternate hosts ${variant}`);
  }
});

test('New planning tasks enforce the smaller parent and both reserved ranges',()=>{
  assert.equal(checkPlan({...fixtures[4].plan,network2:'192.168.100.128'},5).network2.ok,false);
  for(const network2 of ['192.168.160.0','192.168.160.128'])assert.equal(checkPlan({...fixtures[7].plan,network2},8).network2.ok,false);
});
