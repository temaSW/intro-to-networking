import {VARIANT_COUNT,variantSettings,checkSubnet,checkDelivery,checkPlan} from './ip-addressing-model.js';
let serial=0;
function element(tag,text,className){const e=document.createElement(tag);if(text)e.textContent=text;if(className)e.className=className;return e;}
function field(form,name,label,options=null){
  const wrap=element('label',null,'ipv4-answer'),id=`ipv4-answer-${++serial}`;
  wrap.append(element('span',label));
  const control=element(options?'select':'input');control.name=name;control.id=id;
  if(options)for(const[value,text]of [['','Выберите…'],...options]){const option=element('option',text);option.value=value;control.append(option);}
  else {control.type='text';control.inputMode=/^(prefix|hosts|block)\d*$/.test(name)?'numeric':'decimal';control.autocomplete='off';control.spellcheck=false;control.setAttribute('autocapitalize','none');}
  const feedback=element('small',null,'ipv4-answer-feedback');feedback.id=id+'-feedback';
  control.setAttribute('aria-describedby',feedback.id);wrap.append(control,feedback);form.fields.append(wrap);return control;
}
function makeForm(root,title,checker){
  const form=element('form',null,'ipv4-answer-form');form.noValidate=true;
  form.setAttribute('aria-label',title);form.append(element('h3',title));
  form.fields=element('div',null,'ipv4-answer-fields');form.append(form.fields);
  const actions=element('div',null,'ipv4-answer-actions'),check=element('button','Проверить'),reset=element('button','Очистить ответы');check.type='submit';reset.type='reset';reset.className='ipv4-answer-reset';actions.append(check,reset);form.append(actions);
  const status=element('p',null,'ipv4-answer-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.setAttribute('aria-atomic','true');form.append(status);
  function clear(){status.textContent='';for(const control of form.querySelectorAll('input,select')){control.removeAttribute('aria-invalid');control.closest('label').removeAttribute('data-result');document.getElementById(control.getAttribute('aria-describedby')).textContent='';}}
  form.addEventListener('input',clear);form.addEventListener('change',clear);form.addEventListener('reset',clear);
  form.addEventListener('submit',event=>{
    event.preventDefault();const answers=Object.fromEntries(new FormData(form)),results=checker(answers);
    for(const[name,r]of Object.entries(results)){
      const control=form.elements.namedItem(name);if(!control)continue;
      control.closest('label').dataset.result=r.ok===null?'pending':r.ok?'correct':'incorrect';
      control.setAttribute('aria-invalid',String(r.ok===false));
      document.getElementById(control.getAttribute('aria-describedby')).textContent=r.ok===null?r.message:(r.ok?'✓ ':'✕ ')+r.message;
    }
    const values=Object.values(results),correct=values.filter(r=>r.ok===true).length,wrong=values.filter(r=>r.ok===false).length;
    status.textContent=correct===values.length?'Все ответы верны.':`Верно: ${correct} из ${values.length}. ${wrong?'Проверьте отмеченные поля.':''}${values.some(r=>r.ok===null)?' Зависимые поля проверяются после исправления исходных данных.':''}`;
  });root.append(form);return form;
}
function table(headers,rows,label){
  const wrap=element('div',null,'ipv4-task-table');wrap.tabIndex=0;
  wrap.setAttribute('role','region');wrap.setAttribute('aria-label',label);
  const t=element('table'),head=element('thead'),hr=element('tr');
  headers.forEach(text=>{const th=element('th',text);th.scope='col';hr.append(th);});head.append(hr);t.append(head);
  const body=element('tbody');rows.forEach(row=>{const tr=element('tr');row.forEach(value=>tr.append(element('td',String(value))));body.append(tr);});
  t.append(body);wrap.append(t);return wrap;
}
export function renderConditions(scope,settings){
  const first=scope.querySelector('[data-ipv4-task="subnets"]');
  if(first){
    first.replaceChildren(element('p','Для каждого адреса найдите маску, размер блока, адрес сети, первый и последний адрес узла, широковещательный адрес и число адресов для узлов. Затем определите назначение самого заданного адреса: адрес сети, широковещательный адрес или адрес узла. Покажите расчёты в записях.'));
    first.append(table(['Набор','IPv4-адрес с префиксом'],settings.cases.map(c=>[c.label,`${c.address}/${c.prefix}`]),'Адреса первого задания'));
  }
  const delivery=scope.querySelector('[data-ipv4-task="delivery"]');
  if(delivery){
    delivery.replaceChildren(element('p','Все показанные компьютеры находятся на одном Ethernet-участке. У каждого отправителя есть только маршрут к своей подсети и маршрут по умолчанию через доступный в ней шлюз. Других маршрутов нет. Для каждой строки определите решение отправителя: отправлять непосредственно получателю или передать шлюзу. Учитывайте маску именно отправителя; успешность всего обмена здесь не проверяется.'));
    settings.delivery.states.forEach(state=>{
      delivery.append(element('h3',state.label),table(['Направление','Адрес отправителя','Адрес назначения'],state.rows.map(r=>[`${r.sender} → ${r.recipient}`,`${r.source}/${r.prefix}`,r.destination]),state.label));
    });
    delivery.append(element('p',settings.delivery.question));
  }
  const root=scope.querySelector('[data-ipv4-task="plan"]');
  if(root){
    const p=settings.plan;root.replaceChildren(element('p',`Выделен блок ${p.base}/${p.parentPrefix}. Сеть 1 должна вместить ${p.computers[0]} компьютеров, сеть 2 -- ${p.computers[1]}. Помимо компьютеров, в каждой сети нужен один интерфейс маршрутизатора R. Сети соединены через R; внутри каждой работает коммутатор. Компьютер A находится в сети 1, B -- в сети 2. Все подключения исправны.`),element('p',p.prompt));
    if(p.reserved?.length)root.append(table(['Уже занятый блок'],p.reserved.map(r=>[`${r.address}/${r.prefix}`]),'Занятые диапазоны'));
    if(p.fixedNetworks)root.append(table(['Что нужно сохранить','Адрес сети'],Object.entries(p.fixedNetworks).map(([i,address])=>[`Сеть ${i}`,address]),'Закреплённые адреса сетей'));
    if(p.fixedRouters)root.append(table(['Что нужно сохранить','IPv4-адрес'],Object.entries(p.fixedRouters).map(([i,address])=>[`Интерфейс ${i} маршрутизатора R`,address]),'Закреплённые адреса интерфейсов'));
    if(p.draft){root.append(element('h3','Предложенный план'),table(['Сеть','Сеть / префикс','Интерфейс R','Компьютер','Шлюз компьютера'],p.draft.map((r,i)=>[String(i+1),r.network,r.router,`${i===0?'A':'B'}: ${r.computer}`,r.gateway]),'План для проверки и исправления'),element('p','Заполните ниже исправленный план. В записях укажите, какие исходные значения вы изменили и почему.'));}
    const diagram=element('figure',null,'course-demo ipv4-plan');
    const net=i=>{const n=element('div',null,'ipv4-plan-network');n.append(element('strong',`Сеть ${i}`),element('span',`Компьютеров: ${p.computers[i-1]}`),element('span',`В том числе ${i===1?'A':'B'}`));return n;};
    const link=()=>{const l=element('span','↔','ipv4-plan-link');l.setAttribute('aria-hidden','true');return l;};
    const router=element('div',null,'ipv4-plan-router');router.append(element('strong','Маршрутизатор R'),element('span','Интерфейс 1 -- к сети 1'),element('span','Интерфейс 2 -- к сети 2'));
    diagram.append(net(1),link(),router,link(),net(2),element('figcaption','R подключён отдельным интерфейсом к каждой локальной сети.'));root.append(diagram);
    root.append(element('p','Для каждой сети введите префикс, число доступных адресов для узлов, адрес сети и диапазон узлов. Назначьте адреса компьютерам A и B, интерфейсам R и укажите шлюзы компьютеров. Подсети не должны пересекаться; компьютеру и интерфейсу R в одной сети нужны разные адреса. Проверка принимает любой план, удовлетворяющий всем условиям.'));
    root.append(element('p','Объясните, кому A передаст пакет для B. Нужен ли самому R маршрут по умолчанию для обмена между двумя непосредственно подключёнными сетями?'));
  }
}
export function mountAddressing(root,variant=1){
  if(root.dataset.mounted)return;root.dataset.mounted='true';
  const kind=root.dataset.ipv4Answers,settings=variantSettings(variant);
  if(kind==='subnets')settings.cases.forEach((item,index)=>{
    const form=makeForm(root,`${item.label} · ${item.address}/${item.prefix}`,a=>checkSubnet(index,a,variant));
    for(const[name,label]of [['mask','Маска'],['block','Размер блока, адресов'],['network','Адрес сети'],['first','Первый адрес узла'],['last','Последний адрес узла'],['broadcast','Широковещательный адрес'],['hosts','Число адресов для узлов']])field(form,name,label);
    field(form,'role','Назначение заданного адреса',[['network','Адрес сети'],['broadcast','Широковещательный адрес'],['host','Адрес узла']]);
  });
  if(kind==='delivery'){
    const form=makeForm(root,'Решения отправителей',a=>checkDelivery(a,variant));
    settings.delivery.states.forEach((state,si)=>{
      const group=element('fieldset');group.append(element('legend',state.label));const container=element('div',null,'ipv4-answer-fields');group.append(container);form.fields.append(group);
      state.rows.forEach((r,i)=>field({fields:container},`s${si}_${i}`,`${r.sender} (${r.source}/${r.prefix}) → ${r.recipient} (${r.destination})`,[['direct','Непосредственно получателю'],['gateway','Через шлюз']]));
    });
  }
  if(kind==='plan'){
    const form=makeForm(root,settings.plan.draft?'Исправленный план адресации':'Ваш план адресации',a=>checkPlan(a,variant));
    for(const i of [1,2]){
      const group=element('fieldset');group.append(element('legend',`Сеть ${i}`));const container=element('div',null,'ipv4-answer-fields');group.append(container);form.fields.append(group);const target={fields:container};
      for(const[name,label]of [[`prefix${i}`,'Префикс'],[`hosts${i}`,'Доступных адресов для узлов'],[`network${i}`,'Адрес сети'],[`first${i}`,'Первый адрес узла'],[`last${i}`,'Последний адрес узла'],[i===1?'a':'b',`Адрес компьютера ${i===1?'A':'B'}`],[`r${i}`,`Адрес интерфейса ${i} маршрутизатора R`],[`gateway${i}`,`Шлюз компьютера ${i===1?'A':'B'}`]])field(target,name,label);
    }
  }
}
export function mountPractice(scope=document){
  const picker=scope.querySelector('[data-ipv4-variant]');
  if(!picker){scope.querySelectorAll('[data-ipv4-answers]').forEach(root=>mountAddressing(root));return;}
  const parseVariant=value=>/^\d+$/.test(value??'')&&Number(value)>=1&&Number(value)<=VARIANT_COUNT?String(Number(value)):'1';
  picker.value=parseVariant(new URL(window.location.href).searchParams.get('variant'));
  function update(){
    const variant=Number(picker.value),s=variantSettings(variant);
    renderConditions(scope,s);
    scope.querySelectorAll('[data-ipv4-answers]').forEach(root=>{
      root.replaceChildren();delete root.dataset.mounted;mountAddressing(root,variant);
    });
    scope.querySelector('[data-ipv4-variant-status]').textContent=`Вариант ${variant} из ${VARIANT_COUNT}.`;
  }
  picker.addEventListener('change',()=>{
    const next=new URL(window.location.href);next.searchParams.set('variant',picker.value);
    window.history.replaceState(null,'',next);update();
  });
  window.addEventListener('popstate',()=>{
    picker.value=parseVariant(new URL(window.location.href).searchParams.get('variant'));update();
  });
  update();
}
mountPractice();
