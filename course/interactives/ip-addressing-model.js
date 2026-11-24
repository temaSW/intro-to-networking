// IPv4 exercises: arithmetic avoids signed 32-bit bitwise results.
// Each variant changes the reasoning as well as the input addresses.
const row=(sender,source,prefix,recipient,destination)=>({sender,source,prefix,recipient,destination});
const change=(source,prefixes,destinations,question)=>({
  states:prefixes.map((prefix,i)=>({label:i===0?'Исходная настройка A':'После изменения только маски A',
    rows:destinations.map((destination,j)=>row('A',source,prefix,['B','C','D'][j],destination))})),question
});
const exchange=(a,b,prefixes,question)=>({
  states:prefixes.map(([pa,pb],i)=>({label:i===0?'Исходные настройки':'После изменения маски',rows:[row('A',a,pa,'B',b),row('B',b,pb,'A',a)]})),question
});
const cases=(items)=>items.map(([address,prefix],i)=>({label:['А','Б','В'][i],address,prefix}));
const variants=[
  {
    cases:cases([['192.168.8.130',24],['192.168.10.70',26],['192.168.30.173',27]]),
    delivery:change('192.168.10.70',[26,24],['192.168.10.80','192.168.10.120','192.168.10.130'],
      'Для каких получателей решение изменилось? Объясните это границами подсетей до и после изменения.'),
    plan:{base:'192.168.20.0',parentPrefix:24,computers:[50,50],
      prompt:'Разделите выделенный блок между двумя локальными сетями. Для каждой выберите наименьший достаточный блок.'}
  },
  {
    cases:cases([['192.168.40.128',25],['192.168.41.95',28],['192.168.42.129',26]]),
    delivery:change('192.168.40.70',[24,26],['192.168.40.20','192.168.40.80','192.168.40.140'],
      'Какие назначения A перестал считать локальными? Почему исправные Ethernet-подключения сами по себе не сохраняют прежний способ отправки?'),
    plan:{base:'192.168.40.0',parentPrefix:24,computers:[20,20],reserved:[{address:'192.168.40.0',prefix:26}],
      prompt:'Часть блока уже используется другой сетью. Выделите две новые подсети наименьшего достаточного размера, не затрагивая занятую часть.'}
  },
  {
    cases:cases([['10.20.4.255',23],['10.20.5.0',23],['192.168.60.129',25]]),
    delivery:exchange('192.168.60.20','192.168.60.130',[[24,26],[24,24]],
      'Сопоставьте решения A → B и B → A в каждом состоянии. Достаточно ли решения одного отправителя, чтобы судить об обратном направлении?'),
    plan:{base:'192.168.60.0',parentPrefix:24,computers:[20,20],fixedRouters:{1:'192.168.60.94',2:'192.168.60.193'},
      prompt:'Адреса обоих интерфейсов R уже настроены и должны сохраниться. Найдите для каждой сети наименьший достаточный блок и назначьте адрес компьютеру.'}
  },
  {
    cases:cases([['192.168.80.126',25],['192.168.80.128',26],['192.168.81.15',28]]),
    delivery:change('192.168.80.140',[27,25],['192.168.80.150','192.168.80.200','192.168.80.20'],
      'Какие назначения изменили статус, а какие сохранили его? Покажите, почему уменьшение числа в префиксе не делает любой адрес локальным.'),
    plan:{base:'192.168.80.0',parentPrefix:24,computers:[90,20],
      prompt:'Сети имеют разную вместимость. Подберите для каждой свой наименьший достаточный блок; одинаковые префиксы не требуются.'}
  },
  {
    cases:cases([['192.168.100.62',26],['192.168.100.63',26],['192.168.101.64',27]]),
    delivery:exchange('192.168.100.70','192.168.100.130',[[25,26],[24,26]],
      'Маску изменили только на A. Сравните оба направления до и после изменения. Почему изменение настройки A не обязано менять решение B?'),
    plan:{base:'192.168.100.0',parentPrefix:25,computers:[50,50],
      prompt:'Для обеих сетей выделен только указанный /25. Самостоятельно составьте полный план: выберите два непересекающихся блока наименьшего достаточного размера и назначьте адреса устройствам.'}
  },
  {
    cases:cases([['192.168.120.31',27],['192.168.120.32',28],['192.168.121.6',30]]),
    delivery:change('192.168.120.70',[25,27],['192.168.120.80','192.168.120.110','192.168.120.200'],
      'Укажите назначения, для которых способ отправки изменился и не изменился. Для одного случая каждого вида покажите вычисление адреса сети.'),
    plan:{base:'192.168.120.0',parentPrefix:24,computers:[50,12],reserved:[{address:'192.168.120.128',prefix:25}],
      prompt:'Старшая половина выделенного блока занята. Разместите в оставшейся части две сети разной вместимости, для каждой выбрав наименьший достаточный блок.'}
  },
  {
    cases:cases([['192.168.140.16',28],['192.168.140.30',28],['192.168.141.127',25]]),
    delivery:exchange('192.168.140.34','192.168.140.50',[[28,27],[27,27]],
      'В каждом состоянии сравните два направления отправки. Какую роль играет маска именно отправляющего компьютера?'),
    plan:{base:'192.168.140.0',parentPrefix:24,computers:[12,25],fixedRouters:{1:'192.168.140.33',2:'192.168.140.97'},
      prompt:'Сети имеют разную вместимость, адреса интерфейсов R менять нельзя. Определите подходящие границы подсетей и назначьте адреса компьютерам.'}
  },
  {
    cases:cases([['192.168.160.95',27],['192.168.160.96',28],['192.168.161.129',25]]),
    delivery:change('192.168.160.70',[26,25],['192.168.160.20','192.168.160.100','192.168.161.20'],
      'Какие решения меняются при расширении подсети? Почему одинаковый последний октет адреса ещё не определяет принадлежность одной сети?'),
    plan:{base:'192.168.160.0',parentPrefix:24,computers:[25,12],fixedNetworks:{1:'192.168.160.64'},fixedRouters:{1:'192.168.160.65'},
      reserved:[{address:'192.168.160.0',prefix:26},{address:'192.168.160.128',prefix:25}],
      prompt:'Адрес сети 1 и адрес её интерфейса R закреплены. Два указанных диапазона зарезервированы для других сетей. Составьте полный план двух локальных сетей в оставшейся части блока; для каждой выберите наименьший достаточный размер.'}
  }
];
export const VARIANT_COUNT=variants.length;
export function variantSettings(number=1) {
  if(!Number.isInteger(number)||number<1||number>VARIANT_COUNT)throw new RangeError('Unknown variant');
  return {number,...structuredClone(variants[number-1])};
}
export function parseIPv4(value) {
  const parts=String(value??'').trim().split('.');
  if(parts.length!==4||parts.some(p=>! /^(0|[1-9]\d{0,2})$/.test(p)||Number(p)>255)) return null;
  return parts.reduce((n,p)=>n*256+Number(p),0);
}
export function formatIPv4(value) {
  return [24,16,8,0].map(bits=>Math.floor(value/2**bits)%256).join('.');
}
export function subnet(address,prefix) {
  const ip=parseIPv4(address);
  if(ip===null||!Number.isInteger(prefix)||prefix<0||prefix>30) throw new RangeError('Invalid subnet');
  const size=2**(32-prefix),network=Math.floor(ip/size)*size;
  return {network,first:network+1,last:network+size-2,broadcast:network+size-1,mask:2**32-size,block:size,hosts:size-2};
}
const result=(ok,message)=>({ok,message:ok?'Верно.':message});
const empty=value=>String(value??'').trim()==='';
const ipResult=(value,expected,message)=>result(parseIPv4(value)===expected,
  empty(value)?'Введите адрес.':parseIPv4(value)===null?'Нужен IPv4-адрес из четырёх чисел от 0 до 255.':message);
const numberResult=(value,expected,message)=>result(/^\d+$/.test(String(value??'').trim())&&Number(value)===expected,
  empty(value)?'Введите число.':message);
export function checkSubnet(index,answers,variant=1) {
  const item=variantSettings(variant).cases[index];if(!item)throw new RangeError('Unknown exercise');
  const n=subnet(item.address,item.prefix);
  return {
    mask:ipResult(answers.mask,n.mask,'Проверьте число единиц в маске для заданного префикса.'),
    block:numberResult(answers.block,n.block,'Размер блока определяется числом битов после префикса.'),
    network:ipResult(answers.network,n.network,'Проверьте начало блока, в который входит заданный адрес.'),
    first:ipResult(answers.first,n.first,'Первый адрес узла следует сразу за адресом сети.'),
    last:ipResult(answers.last,n.last,'Последний адрес узла предшествует широковещательному.'),
    broadcast:ipResult(answers.broadcast,n.broadcast,'Широковещательный адрес завершает блок.'),
    hosts:numberResult(answers.hosts,n.hosts,'Из общего числа адресов исключите адрес сети и широковещательный.'),
    role:result(answers.role===addressRole(item.address,item.prefix),empty(answers.role)?'Выберите назначение адреса.':'Сопоставьте данный адрес с границами найденного блока.')
  };
}
export function addressRole(address,prefix) {
  const ip=parseIPv4(address),n=subnet(address,prefix);
  return ip===n.network?'network':ip===n.broadcast?'broadcast':'host';
}
export function checkDelivery(answers,variant=1) {
  const {delivery}=variantSettings(variant),out={};
  delivery.states.forEach((state,si)=>state.rows.forEach((r,i)=>{
    const key=`s${si}_${i}`,same=subnet(r.source,r.prefix).network===subnet(r.destination,r.prefix).network;
    out[key]=result(answers[key]===(same?'direct':'gateway'),empty(answers[key])?'Выберите способ отправки.':'Примените маску отправителя к его адресу и адресу назначения.');
  }));
  return out;
}
export function minimumPrefix(computers) {
  for(let prefix=30;prefix>=0;prefix--)if(2**(32-prefix)-2>=computers+1)return prefix;
  throw new RangeError('Too many computers');
}
export function overlaps(a,sizeA,b,sizeB) { return a<b+sizeB&&b<a+sizeA; }
export function checkPlan(a,variant=1) {
  const {plan}=variantSettings(variant),out={},networks={},sizes={};
  const parent=subnet(plan.base,plan.parentPrefix);
  const pending=message=>({ok:null,message});
  for(const i of [1,2]){
    const p=minimumPrefix(plan.computers[i-1]),size=2**(32-p);sizes[i]=size;
    const prefix=String(a[`prefix${i}`]??'').trim().replace(/^\//,'');
    out[`prefix${i}`]=result(prefix===String(p),empty(prefix)?'Введите префикс.':`Учтите компьютеры сети ${i} и её интерфейс R. Выберите наименьший достаточный блок.`);
    out[`hosts${i}`]=numberResult(a[`hosts${i}`],size-2,'Учтите адрес сети и широковещательный адрес.');
    if(!out[`prefix${i}`].ok){out[`network${i}`]=pending('Сначала проверьте префикс этой сети.');continue;}
    const value=parseIPv4(a[`network${i}`]);
    let valid=value!==null&&value>=parent.network&&value+size<=parent.network+parent.block&&value%size===0;
    let message=`Нужен адрес начала блока выбранного размера внутри ${plan.base}/${plan.parentPrefix}.`;
    if(valid&&(plan.reserved??[]).some(r=>{const n=subnet(r.address,r.prefix);return overlaps(value,size,n.network,n.block);})){valid=false;message='Выбранный блок пересекается с уже занятой частью.';}
    if(valid&&plan.fixedNetworks?.[i]&&value!==parseIPv4(plan.fixedNetworks[i])){valid=false;message='По условию адрес этой сети нужно сохранить.';}
    out[`network${i}`]=result(valid,empty(a[`network${i}`])?'Введите адрес сети.':message);
    if(valid)networks[i]=value;
  }
  if(networks[1]!==undefined&&networks[2]!==undefined&&overlaps(networks[1],sizes[1],networks[2],sizes[2])){
    out.network2=result(false,'Подсети пересекаются. Выберите для сети 2 другой блок.');
  }
  for(const i of [1,2]){
    const keys=i===1?['a','r1']:['b','r2'],network=networks[i],size=sizes[i];
    if(!out[`network${i}`].ok){for(const key of [`first${i}`,`last${i}`,...keys,`gateway${i}`])out[key]=pending('Сначала проверьте префикс и адрес этой сети.');continue;}
    out[`first${i}`]=ipResult(a[`first${i}`],network+1,'Первый адрес узла следует сразу за адресом выбранной сети.');
    out[`last${i}`]=ipResult(a[`last${i}`],network+size-2,'Последний адрес узла предшествует широковещательному.');
    for(const key of keys){const ip=parseIPv4(a[key]);out[key]=result(ip!==null&&ip>network&&ip<network+size-1,
      empty(a[key])?'Введите адрес интерфейса.':'Нужен адрес узла выбранной подсети. Адрес сети и широковещательный использовать нельзя.');}
    if(out[`r${i}`].ok&&plan.fixedRouters?.[i])out[`r${i}`]=ipResult(a[`r${i}`],parseIPv4(plan.fixedRouters[i]),'По условию адрес этого интерфейса R нужно сохранить.');
    if(out[keys[0]].ok&&out[keys[1]].ok&&parseIPv4(a[keys[0]])===parseIPv4(a[keys[1]]))out[keys[0]]=result(false,'Компьютеру и интерфейсу R нужны разные адреса.');
    out[`gateway${i}`]=out[keys[1]].ok?ipResult(a[`gateway${i}`],parseIPv4(a[keys[1]]),'Шлюзом должен быть адрес интерфейса R в этой сети.'):pending('Сначала проверьте адрес интерфейса R в этой сети.');
  }
  return out;
}
