import {VARIANT_COUNT,variantSettings,checkSubnet,checkDelivery,checkPlan} from './ip-addressing-model.js';
let serial=0;
function element(tag,text,className){const e=document.createElement(tag);if(text)e.textContent=text;if(className)e.className=className;return e;}
function field(form,name,label,options=null){
  const wrap=element('label',null,'ipv4-answer'),id=`ipv4-answer-${++serial}`;
  wrap.append(element('span',label));
  const control=element(options?'select':'input');control.name=name;control.id=id;
  if(options)for(const[value,text]of [['','Выберите…'],...options]){const option=element('option',text);option.value=value;control.append(option);}
  else {control.type='text';control.inputMode=['prefix','hosts','block'].includes(name)?'numeric':'decimal';control.autocomplete='off';control.spellcheck=false;control.setAttribute('autocapitalize','none');}
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
export function mountAddressing(root,variant=1){
  if(root.dataset.mounted)return;root.dataset.mounted='true';
  const kind=root.dataset.ipv4Answers,settings=variantSettings(variant);
  if(kind==='subnets')settings.cases.forEach((item,index)=>{
    const form=makeForm(root,`${item.label} · ${item.address}/${item.prefix}`,a=>checkSubnet(index,a,variant));
    for(const[name,label]of [['mask','Маска'],['block','Размер блока, адресов'],['network','Адрес сети'],['first','Первый адрес узла'],['last','Последний адрес узла'],['broadcast','Широковещательный адрес'],['hosts','Число адресов для узлов']])field(form,name,label);
  });
  if(kind==='delivery'){
    const form=makeForm(root,'Способ отправки при двух масках',a=>checkDelivery(a,variant));
    for(const prefix of [26,24]){
      const group=element('fieldset'),legend=element('legend',`Адрес A: ${settings.source}/${prefix}`);group.append(legend);const container=element('div',null,'ipv4-answer-fields');group.append(container);form.fields.append(group);
      const target={fields:container};settings.destinations.forEach((address,i)=>field(target,`p${prefix}_${i}`,`${['B','C','D'][i]} · ${address}`,[['direct','Непосредственно получателю'],['gateway','Через шлюз']]));
    }
  }
  if(kind==='plan'){
    const form=makeForm(root,'Ваш план адресации',a=>checkPlan(a,variant));
    field(form,'prefix','Общий префикс, например 24');field(form,'hosts','Доступных адресов для узлов в каждой подсети');
    for(const i of [1,2]){
      const group=element('fieldset'),legend=element('legend',`Сеть ${i}`);group.append(legend);const container=element('div',null,'ipv4-answer-fields');group.append(container);form.fields.append(group);const target={fields:container};
      for(const[name,label]of [[`network${i}`,'Адрес сети'],[`first${i}`,'Первый адрес узла'],[`last${i}`,'Последний адрес узла'],[i===1?'a':'b',`Адрес компьютера ${i===1?'A':'B'}`],[`r${i}`,`Адрес интерфейса ${i} маршрутизатора R`],[`gateway${i}`,`Шлюз компьютера ${i===1?'A':'B'}`]])field(target,name,label);
    }
  }
}
export function mountPractice(scope=document){
  const picker=scope.querySelector('[data-ipv4-variant]');
  if(!picker){scope.querySelectorAll('[data-ipv4-answers]').forEach(root=>mountAddressing(root));return;}
  const url=new URL(window.location.href),requested=url.searchParams.get('variant');
  picker.value=/^[1-8]$/.test(requested??'')?requested:'1';
  function update(){
    const variant=Number(picker.value),s=variantSettings(variant);
    const values={source:s.source+'/26',gateway:s.gateway,base:s.base+'/24',computers:s.computers};
    s.cases.forEach((item,i)=>values['case'+i]=item.address+'/'+item.prefix);
    s.destinations.forEach((address,i)=>values['destination'+i]=address);
    scope.querySelectorAll('[data-ipv4-value]').forEach(node=>node.textContent=values[node.dataset.ipv4Value]);
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
    const value=new URL(window.location.href).searchParams.get('variant');
    picker.value=/^[1-8]$/.test(value??'')?value:'1';update();
  });
  update();
}
mountPractice();
