(function(scope){
  'use strict';
  const protocol=scope.CourseConceptProtocols;
  const profiles={
    cloud:{ip:{0:'192.0.2.10',3:'198.51.100.20'},optical:[[1,2]],wifi:[[0,4]],lan:{1:0,2:3}},
    smb:{ip:{0:'192.0.2.10',2:'192.0.2.20'},optical:[],wifi:[],lan:{}},
    voip:{ip:{0:'192.0.2.10',2:'192.0.2.20'},optical:[],wifi:[],lan:{}},
    web:{ip:{0:'192.0.2.10',3:'198.51.100.20',4:'203.0.113.53'},optical:[[1,2]],wifi:[[0,5]],lan:{1:0,2:3}},
    tls:{ip:{0:'192.0.2.10',3:'198.51.100.20'},optical:[[1,2]],wifi:[[0,4]],lan:{1:0,2:3}},
    message:{ip:{0:'192.0.2.10',2:'203.0.113.20',4:'198.51.100.10'},optical:[[1,2],[2,3]],wifi:[[0,5],[4,6]],lan:{1:0,3:4}},
    call:{ip:{0:'192.0.2.10',2:'203.0.113.20',4:'198.51.100.10',5:'203.0.113.30'},optical:[[1,2],[2,3],[1,3],[1,5],[3,5]],wifi:[[0,6],[4,7]],lan:{1:0,3:4}}
  };
  const matches=(list,a,b)=>list.some(([x,y])=>(x===a&&y===b)||(x===b&&y===a));
  function link(id,a,b){
    const p=profiles[id];if(!p)throw new RangeError('Нет профиля сети');
    return matches(p.wifi,a,b)?{format:'Wi-Fi',medium:'radio',signal:'Радиосигнал'}:
      matches(p.optical,a,b)?{format:'Ethernet',medium:'optical',signal:'Оптический сигнал'}:
      {format:'Ethernet',medium:'copper',signal:'Электрический сигнал'};
  }
  function mac(id,state,node,peer){
    const port=state.nodes[node].kind==='router'?(profiles[id].lan[node]===peer?1:2):0;
    return [2,0,Object.keys(profiles).indexOf(id)+1,node,port,1].map(v=>v.toString(16).padStart(2,'0')).join(':');
  }
  function frame(id,state,edge){
    const route=state.path,bridge=n=>['access','switch'].includes(state.nodes[n].kind);
    let left=edge,right=edge+1;while(left>0&&bridge(route[left]))left--;while(right<route.length-1&&bridge(route[right]))right++;
    const source=route[left],destination=route[right],from=route[edge],to=route[edge+1],profile=link(id,from,to);
    const radioAddress=node=>state.nodes[node].kind==='access'?mac(id,state,node,node):node===source?mac(id,state,node,destination):mac(id,state,node,source);
    return {...profile,from,to,source,destination,sourceName:state.nodes[source].label,destinationName:state.nodes[destination].label,
      macSource:mac(id,state,source,destination),macDestination:mac(id,state,destination,source),
      radioTransmitter:profile.format==='Wi-Fi'?radioAddress(from):null,radioReceiver:profile.format==='Wi-Fi'?radioAddress(to):null};
  }
  function phases(state){
    const route=state.path,transportOnly=state.event.label.startsWith('TCP ');
    const sender=transportOnly?['transport','ip','frame']:['message','transport','ip','frame'];
    const receiver=transportOnly?['frame','ip','transport']:['frame','ip','transport','message'];
    const out=sender.map(unit=>({kind:'encapsulate',unit,node:route[0],edge:0}));
    for(let i=0;i<route.length-1;i++){
      out.push({kind:'transfer',unit:'signal',edge:i});
      if(i<route.length-2){const node=route[i+1];out.push({kind:state.nodes[node].kind==='router'?'route':'bridge',unit:state.nodes[node].kind==='router'?'ip':'frame',node,edge:i+1});}
    }
    return out.concat(receiver.map(unit=>({kind:'decapsulate',unit,node:route.at(-1),edge:route.length-2})));
  }
  function describe(id,index,progress,relay=false,tlsFault=false){
    const state=protocol.eventState(id,index,relay,tlsFault);if(!state.path)return null;
    if(!Number.isFinite(progress)||progress<0||progress>1)throw new RangeError('Неверный прогресс');
    const steps=phases(state),phaseIndex=Math.min(steps.length-1,Math.floor(progress*steps.length+1e-9)),phase=steps[phaseIndex];
    const unitProgress=progress===1?1:Math.max(0,Math.min(1,progress*steps.length-phaseIndex)),f=frame(id,state,phase.edge);
    const hopCount=state.path.length-1;
    let delivery,point,angle=0;
    if(phase.kind==='transfer'){
      const from=state.nodes[f.from],to=state.nodes[f.to],q=unitProgress*unitProgress*(3-2*unitProgress);
      point={x:from.x+(to.x-from.x)*q,y:from.y+(to.y-from.y)*q};angle=protocol.heading(from,to);delivery=(phase.edge+q)/hopCount;
    }else{
      point=state.nodes[phase.node];const position=state.path.indexOf(phase.node);delivery=position/hopCount;
      const before=state.nodes[state.path[Math.max(0,position-1)]],after=state.nodes[state.path[Math.min(hopCount,position+1)]];
      if(phase.kind==='encapsulate')angle=protocol.heading(point,after);
      else if(phase.kind==='decapsulate')angle=protocol.heading(before,point);
      else{const start=protocol.heading(before,point),end=protocol.heading(point,after),delta=((end-start+540)%360)-180,q=unitProgress*unitProgress*(3-2*unitProgress);angle=start+delta*q;}
    }
    const ttl=64-state.path.slice(1,phase.edge+1).filter(n=>state.nodes[n].kind==='router').length;
    const transportOnly=state.event.label.startsWith('TCP '),encrypted=state.event.protection&&state.event.protection!=='none'||['message','call'].includes(id)&&state.event.transport==='TCP'||id==='web'&&state.event.label.startsWith('HTTP')||state.media&&id==='call';
    const payload=transportOnly?'Служебные поля TCP':encrypted?'Защищённые данные':state.event.label;
    const titles={message:transportOnly?'Обработка TCP':id==='tls'?'Сообщение TLS':'Данные приложения',transport:state.event.transport==='UDP'?'Датаграмма UDP':'Сегмент TCP',ip:'IP-пакет',frame:`Кадр ${f.format}`,signal:f.signal};
    let title,explain;
    if(phase.kind==='encapsulate'){
      title=`Отправитель: ${titles[phase.unit]}`;
      explain=phase.unit==='message'?'Программа формирует сообщение. Дальше нужны средства доставки.':phase.unit==='transport'?transportOnly?'TCP формирует служебный сегмент без прикладных данных.':'Транспорт добавляет сведения для обмена между приложениями.':phase.unit==='ip'?'IP добавляет адреса конечных устройств. Выбирается следующий переход.':`Пакет включается в кадр первого участка ${f.format}.`;
    }else if(phase.kind==='transfer'){
      title=`${state.nodes[f.from].label} → ${state.nodes[f.to].label}`;
      explain=`${f.format}: биты кадра представлены сигналом на этом участке. На следующей линии передатчик создаст свой сигнал.`;
    }else if(phase.kind==='route'){
      title=`${state.nodes[phase.node].label}: обработка IP`;
      explain='Принятый кадр снимается. Маршрутизатор читает IP-заголовок, уменьшает TTL и выбирает следующий участок; для него будет новый кадр.';
    }else if(phase.kind==='bridge'){
      title=`${state.nodes[phase.node].label}: канальная передача`;
      explain=state.nodes[phase.node].kind==='access'?'Точка доступа связывает Wi-Fi и Ethernet. IP-пакет не маршрутизируется; TTL не уменьшается.':'Коммутатор передаёт кадр внутри локального сегмента. IP-адреса и TTL не меняются.';
    }else{
      title=`Получатель: ${titles[phase.unit]}`;
      explain=phase.unit==='frame'?'Приёмник восстанавливает биты из сигнала и проверяет кадр.':phase.unit==='ip'?'Из кадра выделяется IP-пакет, адресованный этому устройству.':phase.unit==='transport'?transportOnly?'TCP обрабатывает служебный сегмент. Это не сообщение прикладной программы.':'IP передаёт данные нужному транспортному протоколу, затем -- нужному обмену приложений.':id==='tls'?'После сборки нужных байтов TLS проверяет и обрабатывает сообщение; защищённые данные расшифровываются.':'Программа использует доставленные данные. Для полного сообщения может потребоваться несколько пакетов.';
    }
    const order=['message','transport','ip','frame'],depth=phase.unit==='signal'?3:order.indexOf(phase.unit),layers=order.slice(transportOnly?1:0,depth+1).reverse();
    return {packetId:`${id}:${index}:${Number(relay)}:${Number(tlsFault)}`,state,phaseIndex,phaseCount:steps.length,phase,progress,nextProgress:Math.min(1,(phaseIndex+1.5)/steps.length),
      duration:steps.length*650,delivery,point,angle,ttl,frame:f,ipSource:profiles[id].ip[state.fromNode],ipDestination:profiles[id].ip[state.toNode],payload,layers,title,explain,
      transmitter:state.nodes[f.from].label,receiver:state.nodes[f.to].label,transport:state.event.transport,activeNode:phase.node};
  }
  scope.CourseConceptPacket=Object.freeze({describe,link});
})(window);
