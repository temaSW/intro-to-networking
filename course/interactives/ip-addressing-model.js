// IPv4 exercises: arithmetic avoids signed 32-bit bitwise results.
export const CASES = Object.freeze([
  {label:'А', address:'192.168.8.130', prefix:24},
  {label:'Б', address:'192.168.10.70', prefix:26},
  {label:'В', address:'192.168.30.173', prefix:27}
]);
export const DESTINATIONS = Object.freeze(['192.168.10.80','192.168.10.120','192.168.10.130']);
export const VARIANT_COUNT = 8;
export function variantSettings(number=1) {
  if(!Number.isInteger(number)||number<1||number>VARIANT_COUNT)throw new RangeError('Unknown variant');
  if(number===1)return {number,cases:CASES,source:'192.168.10.70',gateway:'192.168.10.65',destinations:DESTINATIONS,base:'192.168.20.0',computers:50};
  const octet=40+number*3,block=(number%4)*64;
  const destinations=[`192.168.${octet}.${block+12}`,`192.168.${octet}.${block+45}`,`192.168.${octet}.${(block+64)%256+18}`];
  const shift=number%3;
  return {number,cases:[
    {label:'А',address:`192.168.${octet+1}.${100+number*7}`,prefix:24},
    {label:'Б',address:`192.168.${octet}.${block+6}`,prefix:26},
    {label:'В',address:`192.168.${octet+2}.${(number%8)*32+13}`,prefix:27}
  ],source:`192.168.${octet}.${block+6}`,gateway:`192.168.${octet}.${block+1}`,
  destinations:[...destinations.slice(shift),...destinations.slice(0,shift)],base:`192.168.${150+number}.0`,computers:40+((number-2)%5)*5};
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
    hosts:numberResult(answers.hosts,n.hosts,'Из общего числа адресов исключите адрес сети и широковещательный.')
  };
}
export function checkDelivery(answers,variant=1) {
  const {source,destinations}=variantSettings(variant),out={};
  for(const prefix of [26,24])for(let i=0;i<destinations.length;i++) {
    const key=`p${prefix}_${i}`,same=subnet(source,prefix).network===subnet(destinations[i],prefix).network;
    out[key]=result(answers[key]===(same?'direct':'gateway'),empty(answers[key])?'Выберите способ отправки.':'Сравните результаты применения маски A к его адресу и адресу назначения.');
  }
  return out;
}
export function checkPlan(a,variant=1) {
  const settings=variantSettings(variant);
  const prefix=String(a.prefix??'').trim().replace(/^\//,'');
  const out={prefix:result(prefix==='26',empty(prefix)?'Введите префикс.':`Учтите ${settings.computers} компьютеров и интерфейс R. Выберите наименьший достаточный блок.`),
    hosts:numberResult(a.hosts,62,'Учтите все адреса блока, адрес сети и широковещательный.')};
  const dependent=['network1','first1','last1','network2','first2','last2','a','r1','r2','b','gateway1','gateway2'];
  if(!out.prefix.ok){for(const key of dependent)out[key]={ok:null,message:'Сначала проверьте префикс.'};return out;}
  const base=parseIPv4(settings.base),networks={};
  for(const i of [1,2]) {
    const value=parseIPv4(a[`network${i}`]);
    const valid=value!==null&&value>=base&&value<base+256&&value%64===0;
    out[`network${i}`]=result(valid,empty(a[`network${i}`])?'Введите адрес сети.':`Нужен адрес начала блока выбранного размера внутри ${settings.base}/24.`);
    if(valid)networks[i]=value;
  }
  if(networks[1]!==undefined&&networks[1]===networks[2]) {
    out.network2=result(false,'Две подсети не должны пересекаться. Выберите другой блок.');
  }
  const pending=()=>({ok:null,message:'Сначала проверьте адрес этой сети.'});
  for(const i of [1,2]) {
    const keys=i===1?['a','r1']:['b','r2'],network=networks[i];
    if(!out[`network${i}`].ok){for(const key of [`first${i}`,`last${i}`,...keys,`gateway${i}`])out[key]=pending();continue;}
    out[`first${i}`]=ipResult(a[`first${i}`],network+1,'Первый адрес узла следует сразу за адресом выбранной сети.');
    out[`last${i}`]=ipResult(a[`last${i}`],network+62,'Последний адрес узла предшествует широковещательному.');
    for(const key of keys){const ip=parseIPv4(a[key]);out[key]=result(ip!==null&&ip>network&&ip<network+63,
      empty(a[key])?'Введите адрес интерфейса.':'Адрес должен находиться в диапазоне узлов выбранной подсети. Адрес сети и широковещательный использовать нельзя.');}
    if(out[keys[0]].ok&&out[keys[1]].ok&&parseIPv4(a[keys[0]])===parseIPv4(a[keys[1]]))out[keys[0]]=result(false,'Адрес компьютера совпадает с адресом интерфейса R. Назначьте разные адреса.');
    out[`gateway${i}`]=out[keys[1]].ok?ipResult(a[`gateway${i}`],parseIPv4(a[keys[1]]),'Шлюзом должен быть адрес интерфейса R в этой сети.'):{ok:null,message:'Сначала проверьте адрес интерфейса R в этой сети.'};
  }
  return out;
}
