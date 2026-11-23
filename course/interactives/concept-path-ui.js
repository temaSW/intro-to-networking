(function(){
  'use strict';
  const m=window.CourseConceptPath,p=window.CourseConceptProtocols,packet=window.CourseConceptPacket;if(!m||!p||!packet)return;
  const NS='http://www.w3.org/2000/svg';
  function s(tag,attrs={},text){const e=document.createElementNS(NS,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;return e;}
  function h(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;}
  function controls(root){
    const box=h('div','cp-controls');const buttons={};
    for(const[key,label]of [['play','▶ Показать'],['back','← Назад'],['next','Шаг →'],['reset','В начало'],['expand','Увеличить']]){const b=h('button','',label);b.type='button';b.dataset.cp=key;buttons[key]=b;box.append(b);}
    root.append(box);return buttons;
  }
  function enlarge(root,b,stop){
    let dialog=null;
    b.addEventListener('click',()=>{
      if(dialog){dialog.close();return;}stop();
      const anchor=document.createComment('concept-path');root.before(anchor);
      dialog=h('dialog','cp-dialog');dialog.setAttribute('aria-label',root.getAttribute('aria-label')||'Увеличенная схема');document.body.append(dialog);dialog.append(root);b.textContent='Свернуть';
      dialog.addEventListener('close',()=>{stop();anchor.replaceWith(root);dialog.remove();dialog=null;b.textContent='Увеличить';b.focus();},{once:true});
      dialog.showModal();b.focus();dialog.scrollTop=0;
    });
  }
  function icon(node,active){
    const g=s('g',{transform:`translate(${node.x} ${node.y})`});
    g.append(s('rect',{x:-44,y:-29,width:88,height:58,rx:7,class:`cp-node${active?' active':''}`}));
    const lines=s('g',{class:'cp-icon'});
    if(node.kind==='phone')lines.append(s('rect',{x:-12,y:-23,width:24,height:45,rx:4}),s('path',{d:'M-6 -16 H6 M-3 16 H3'}));
    else if(node.kind==='computer')lines.append(s('rect',{x:-22,y:-19,width:44,height:31,rx:2}),s('path',{d:'M-29 21 H29 L22 13 H-22 Z'}));
    else if(node.kind==='server') {lines.append(s('rect',{x:-17,y:-23,width:34,height:46,rx:2}));for(const y of [-12,0,12])lines.append(s('path',{d:`M-11 ${y} H6 M11 ${y} h1`}));}
    else if(node.kind==='access')lines.append(s('path',{d:'M-25 16 H25 V24 H-25 Z M-14 16 V-3 M14 16 V-3 M-26 -10 Q0 -35 26 -10 M-16 -3 Q0 -20 16 -3 M-5 4 Q0 -1 5 4'}));
    else if(node.kind==='router')lines.append(s('ellipse',{cx:0,cy:1,rx:27,ry:20}),s('path',{d:'M-18 1 H18 M-12 -5 L-18 1 L-12 7 M12 -5 L18 1 L12 7 M0 -13 V15 M-5 -8 L0 -13 L5 -8 M-5 10 L0 15 L5 10'}));
    else if(node.kind==='network')lines.append(s('path',{d:'M-28 15 C-43 8 -36 -13 -22 -13 C-22 -32 5 -32 12 -17 C35 -29 48 4 29 15 Z'}));
    else lines.append(s('path',{d:'M-28 -12 H28 V18 H-28 Z M-17 2 H17 M-10 -5 L-17 2 L-10 9 M10 -5 L17 2 L10 9'}));
    g.append(lines,s('text',{x:0,y:node.y<80?-40:48,'text-anchor':'middle',class:'cp-label'},node.label));return g;
  }
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  function flightToken(control=false){
    const g=s('g',{class:`cp-direction-token${control?' control':''}`});
    g.append(s('path',{d:'M-13 -7 H3 V-12 L18 0 L3 12 V7 H-13 Z'}));return g;
  }
  function roundedRoute(points){
    let d=`M${points[0].x} ${points[0].y}`;
    for(let i=1;i<points.length-1;i++){
      const a=points[i-1],v=points[i],b=points[i+1];
      const incoming=Math.hypot(v.x-a.x,v.y-a.y),outgoing=Math.hypot(b.x-v.x,b.y-v.y),r=Math.min(18,incoming/3,outgoing/3);
      const enter={x:v.x+(a.x-v.x)*r/incoming,y:v.y+(a.y-v.y)*r/incoming};
      const leave={x:v.x+(b.x-v.x)*r/outgoing,y:v.y+(b.y-v.y)*r/outgoing};
      d+=` L${enter.x} ${enter.y} Q${v.x} ${v.y} ${leave.x} ${leave.y}`;
    }
    const last=points[points.length-1];return d+` L${last.x} ${last.y}`;
  }
  for(const root of document.querySelectorAll('[data-concept-path]')){
    const id=root.dataset.conceptPath,b=controls(root),motion=p.createMotion();
    let index=0,view='route',relay=false,tlsFault=false,raf=0,routePath=null,routeToken=null,sequencePath=null,sequenceToken=null,displayState=null,routeBoxes=[],highlightTarget=null,layerKey='';
    b.next.textContent='Сообщение →';b.back.textContent='← Сообщение';
    const viewBar=h('div','cp-views'),messageView=h('button','','Сообщения во времени'),routeView=h('button','','Путь через сеть'),wholeView=h('button','','Вся диаграмма');
    messageView.type=routeView.type=wholeView.type='button';viewBar.setAttribute('role','group');viewBar.setAttribute('aria-label','Представление обмена');viewBar.append(messageView,routeView,wholeView);root.prepend(viewBar);
    const current=()=>p.eventState(id,index,relay,tlsFault);
    function setView(next){
      const resume=motion.snapshot();stop();view=next;draw();
      if(resume.running)run(resume.continuous);
    }
    messageView.addEventListener('click',()=>setView('messages'));routeView.addEventListener('click',()=>setView('route'));
    wholeView.addEventListener('click',()=>{stop();view='messages';index=p.forCase(id,relay,tlsFault).rows.length;motion.reset(1);draw();sequenceScroll.scrollTop=0;});
    if(id==='tls'){
      const label=h('label','cp-choice'),input=h('input');input.type='checkbox';input.dataset.cp='tls-fault';label.append(input,document.createTextNode(' Имя в сертификате не совпадает'));root.append(label);
      input.addEventListener('change',()=>{stop();tlsFault=input.checked;index=0;motion.reset();draw();});
    }
    if(id==='call'){
      const label=h('label','cp-choice'),input=h('input');input.type='checkbox';input.dataset.cp='relay';label.append(input,document.createTextNode(' Передавать речь через ретранслятор'));root.append(label);
      input.addEventListener('change',()=>{
        stop();const event=current().event;relay=input.checked;
        if(event?.kind==='media'){index=p.forCase(id,relay).rows.findIndex(r=>r.step===event.step)+1;motion.reset();}
        draw();
      });
    }
    const status=h('p','cp-status');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const title=h('p','cp-step-title'),scroll=h('div','cp-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Путь данных с локальной прокруткой');
    const plot=s('svg',{viewBox:'0 0 880 270',role:'img',class:'cp-plot'});scroll.append(plot);
    const sequenceNote=h('p','cp-sequence-note'),sequenceScroll=h('div','cp-scroll cp-sequence-scroll');sequenceScroll.tabIndex=0;sequenceScroll.setAttribute('role','region');sequenceScroll.setAttribute('aria-label','Временная диаграмма: время направлено вниз');
    const sequencePlot=s('svg',{viewBox:'0 0 880 400',role:'img',class:'cp-sequence','aria-label':'Последовательность сообщений протокола'});sequenceScroll.append(sequencePlot);
    const stack=h('p','cp-stack'),caption=h('p','cp-caption');
    const layerPanel=h('section','cp-layer-panel');layerPanel.setAttribute('aria-label','Текущий пакет по уровням');
    const layerControls=h('div','cp-layer-controls'),layerNext=h('button','','Преобразование →'),layerReset=h('button','','Сначала пакет');layerNext.type=layerReset.type='button';layerControls.append(layerNext,layerReset);
    const layerStatus=h('p','cp-layer-status'),layerTitle=h('h4'),layerExplain=h('p','cp-layer-explain'),columns=h('div','cp-layer-columns'),envelope=h('div','cp-layer-packet'),linkInfo=h('div','cp-layer-link');
    const linkTitle=h('strong'),linkPeer=h('p'),framePeer=h('p'),ipDestination=h('p');
    const macDetails=h('details'),macSummary=h('summary','','Адреса текущего кадра'),macText=h('p'),radioText=h('p');macDetails.append(macSummary,macText,radioText);
    linkInfo.append(linkTitle,linkPeer,framePeer,ipDestination,macDetails);columns.append(envelope,linkInfo);
    layerPanel.append(layerControls,layerStatus,layerTitle,layerExplain,columns);
    root.append(status,title,stack,scroll,sequenceNote,sequenceScroll,layerPanel,caption);
    layerNext.addEventListener('click',()=>{stop();const d=packet.describe(id,index,motion.snapshot().progress,relay,tlsFault);if(d){motion.reset(d.nextProgress);paint(motion.snapshot().progress);}});
    layerReset.addEventListener('click',()=>{stop();motion.reset();paint(0);});
    function syncButton(){const active=motion.snapshot().running;b.play.textContent=active?'Ⅱ Пауза':'▶ Показать';b.play.setAttribute('aria-pressed',active);}
    function stop(){const state=motion.pause(performance.now());cancelAnimationFrame(raf);paint(state.progress);syncButton();}
    function place(path,token,progress){
      if(!path||!token)return;const length=path.getTotalLength(),distance=length*progress;
      const point=path.getPointAtLength(distance),a=path.getPointAtLength(Math.max(0,distance-.5)),b=path.getPointAtLength(Math.min(length,distance+.5));
      token.setAttribute('transform',`translate(${point.x} ${point.y}) rotate(${p.heading(a,b)})`);
      token.dataset.progress=String(progress);
    }
    function paint(progress){
      const d=packet.describe(id,index,progress,relay,tlsFault),q=reduced.matches?(progress===1?1:0):(d?d.delivery:progress);
      if(d&&routeToken){const point=reduced.matches?(progress===1?displayState.nodes[displayState.toNode]:displayState.nodes[displayState.fromNode]):d.point;routeToken.setAttribute('transform',`translate(${point.x} ${point.y}) rotate(${d.angle})`);routeToken.dataset.progress=String(progress);}
      place(sequencePath,sequenceToken,q);
      if(routePath&&displayState){const active=d?(d.activeNode??d.frame.from):(progress===1?displayState.toNode:displayState.fromNode);if(active!==highlightTarget){routeBoxes.forEach((e,i)=>e.classList.toggle('active',i===active));highlightTarget=active;}}
      layerPanel.hidden=!d;
      if(d){const key=`${index}:${d.phaseIndex}:${relay}:${tlsFault}`;if(key!==layerKey){drawLayer(d);layerKey=key;}layerNext.disabled=progress>=1;layerNext.textContent=progress>=1?'Пакет доставлен':d.phaseIndex===d.phaseCount-1?'Завершить пакет':'Преобразование →';root.dataset.layerPhase=String(d.phaseIndex);root.dataset.delivery=String(d.delivery);}
      else {delete root.dataset.layerPhase;root.dataset.delivery=String(progress);}
      root.dataset.eventIndex=String(index);root.dataset.progress=String(progress);
    }
    function draw(){
      const state=current();displayState=state;layerKey='';const plan=packet.describe(id,index,0,relay,tlsFault);motion.setDuration(plan?plan.duration:1800);
      messageView.setAttribute('aria-pressed',view==='messages');routeView.setAttribute('aria-pressed',view==='route');
      scroll.hidden=view!=='route';sequenceScroll.hidden=view!=='messages';sequenceNote.hidden=view!=='messages';
      sequenceNote.textContent=state.sequence.note+' Вниз -- позже; вертикальные расстояния не задают длительность.';
      b.back.disabled=index===0;b.next.disabled=index===state.count-1;
      status.textContent=`${index+1} / ${state.count}`;title.textContent=state.title;caption.textContent=state.text;stack.textContent=state.sequence.stack;
      drawRoute(state);drawSequence(state);paint(motion.snapshot().progress);syncButton();
    }
    function drawRoute(state){
      plot.replaceChildren();routePath=null;routeToken=null;routeBoxes=[];highlightTarget=null;
      plot.setAttribute('viewBox',`0 -20 880 ${state.height+20}`);plot.setAttribute('aria-label',state.title);
      for(const[a,b]of state.edges){const from=state.nodes[a],to=state.nodes[b],profile=packet.link(id,a,b);plot.append(s('path',{d:`M${from.x} ${from.y} L${to.x} ${to.y}`,class:'cp-link'}));
        const x=(from.x+to.x)/2,y=(from.y+to.y)/2;
        if(Math.abs(from.y-to.y)<5){plot.append(s('text',{x,y:y-42,'text-anchor':'middle',class:'cp-link-label'},profile.format));if(profile.format==='Ethernet')plot.append(s('text',{x,y:y-28,'text-anchor':'middle',class:'cp-link-label'},profile.medium==='optical'?'волокно':'медь'));}
        else if(Math.abs(from.x-to.x)<5)plot.append(s('text',{x:x+85,y:y-20,'text-anchor':'middle',class:'cp-link-label'},profile.format));
        else {const offset=Math.max(from.y,to.y)>200?(x<440?-30:30):0;plot.append(s('text',{x:x+offset,y:y+(offset?20:-5),'text-anchor':'middle',class:'cp-link-label'},profile.format));}
      }
      if(state.path){routePath=s('path',{d:roundedRoute(state.path.map(i=>state.nodes[i])),class:`cp-route${state.control?' control':''}`});plot.append(routePath);}
      state.nodes.forEach((node,i)=>{const group=icon(node,state.focusNodes.includes(i));routeBoxes.push(group.querySelector('.cp-node'));plot.append(group);});
      if(routePath){routeToken=flightToken(state.control);plot.append(routeToken);}
      const badge=s('g',{transform:`translate(440 ${state.height-22})`});badge.append(s('rect',{x:-380,y:-16,width:760,height:30,rx:6,class:'cp-badge'}),s('text',{x:0,y:4,'text-anchor':'middle',class:'cp-label'},state.payload));plot.append(badge);
    }
    function drawLayer(d){
      layerStatus.textContent=`Внутри сообщения: этап ${d.phaseIndex+1} из ${d.phaseCount}`;layerTitle.textContent=d.title;layerExplain.textContent=d.explain;
      envelope.replaceChildren();let parent=envelope;
      for(const unit of d.layers){
        const box=h('div',`cp-unit${d.phase.unit===unit?' active':''}`),name=unit==='frame'?`Кадр ${d.frame.format}`:unit==='ip'?'IP-пакет':unit==='transport'?`${d.transport}: порты обмена`:'Данные сообщения';box.append(h('strong','',name));
        if(unit==='ip')box.append(h('p','',`${d.ipSource} → ${d.ipDestination}`),h('p','',`TTL: ${d.ttl}`));
        if(unit==='message')box.append(h('p','',d.payload));
        if(unit==='transport'&&d.state.event.label.startsWith('TCP '))box.append(h('p','',d.state.event.label));
        parent.append(box);parent=box;
      }
      linkTitle.textContent=`${d.frame.format} • ${d.frame.medium==='radio'?'радио':d.frame.medium==='optical'?'волокно':'медь'}`;
      linkPeer.textContent=`Физический участок: ${d.transmitter} → ${d.receiver}`;
      const framed=d.layers.includes('frame');framePeer.hidden=!framed;macDetails.hidden=!framed;
      framePeer.textContent=`Данные кадра: ${d.frame.sourceName} → ${d.frame.destinationName}`;
      ipDestination.textContent=`Конечное IP-назначение: ${d.ipDestination}`;
      macText.textContent=`MAC источника: ${d.frame.macSource}; MAC получателя данных: ${d.frame.macDestination}.`;
      radioText.hidden=!d.frame.radioReceiver;radioText.textContent=d.frame.radioReceiver?`Wi-Fi: адрес радиопередатчика ${d.frame.radioTransmitter}; радиоприёмника ${d.frame.radioReceiver}.`:'';
    }
    function drawSequence(state){
      const {actors,rows}=state.sequence;sequencePlot.replaceChildren();sequencePath=null;sequenceToken=null;
      const height=110+rows.length*52,x=i=>90+i*700/(actors.length-1);
      sequencePlot.setAttribute('viewBox',`0 0 880 ${height}`);sequencePlot.setAttribute('aria-label',`${id}: ${state.title}; время направлено вниз`);
      sequencePlot.append(s('path',{d:`M25 55 V${height-15} l-5 -10 m5 10 l5 -10`,class:'cp-axis'}),s('text',{x:10,y:35,class:'cp-tick'},'t'));
      actors.forEach((actor,i)=>sequencePlot.append(s('text',{x:x(i),y:25,'text-anchor':'middle',class:'cp-label'},actor),s('path',{d:`M${x(i)} 40 V${height-10}`,class:'cp-lifeline'})));
      rows.forEach((event,i)=>{
        if(i>state.eventIndex)return;const y=72+i*52,active=i===state.eventIndex;
        if(active)sequencePlot.append(s('rect',{x:38,y:y-23,width:825,height:49,rx:5,class:'cp-seq-active'}));
        if(event.kind==='local'){
          const xx=x(event.from);sequencePlot.append(s('rect',{x:xx-8,y:y-10,width:16,height:27,class:'cp-local'}),s('text',{x:xx+(xx>600?-18:18),y:y+6,'text-anchor':xx>600?'end':'start',class:'cp-seq-local'},event.label));return;
        }
        const a=x(event.from),b=x(event.to),middle=(a+b)/2;
        if(event.kind==='band'){
          sequencePlot.append(s('rect',{x:Math.min(a,b)+10,y:y-16,width:Math.abs(b-a)-20,height:35,rx:5,class:'cp-band'}),s('text',{x:middle,y:y+6,'text-anchor':'middle',class:'cp-seq-local'},event.label+' · '+event.transport));return;
        }
        const cls=event.kind==='media'?'cp-protocol-media':'cp-protocol-message',end=b+(a<b?-3:3),sign=a<b?-1:1;
        const protection=event.protection==='none'?' · открыто':event.protection==='handshake'?' · шифр (рукопожатие)':event.protection==='application'?' · шифр (приложение)':'';
        sequencePlot.append(s('text',{x:middle,y:y-6,'text-anchor':'middle',class:'cp-seq-label'},event.label),s('path',{d:`M${a} ${y+8} H${end} m${sign*10} -5 l${-sign*10} 5 l${sign*10} 5`,class:cls}),s('text',{x:middle,y:y+25,'text-anchor':'middle',class:'cp-seq-transport'},event.transport+(event.flow?' · '+event.flow:'')+protection));
        if(active){sequencePath=s('path',{d:`M${a} ${y+8} H${b}`,class:'cp-flight-guide'});sequenceToken=flightToken(event.kind!=='media');sequencePlot.append(sequencePath,sequenceToken);}
      });
      if(view==='messages')sequenceScroll.scrollTop=Math.max(0,72+state.eventIndex*52-sequenceScroll.clientHeight+85);
    }
    function tick(now){
      const state=motion.sample(now);paint(state.progress);
      if(state.done){
        if(state.continuous&&index<current().count-1){index++;motion.reset();draw();motion.play(now,true);syncButton();}
        else {syncButton();return;}
      }
      if(motion.snapshot().running)raf=requestAnimationFrame(tick);
    }
    function run(auto){cancelAnimationFrame(raf);motion.play(performance.now(),auto);syncButton();raf=requestAnimationFrame(tick);}
    b.play.addEventListener('click',()=>{
      if(motion.snapshot().running){stop();return;}
      if(index===current().count-1){index=1;motion.reset();draw();}
      else if(index===0||motion.snapshot().progress===1){index++;motion.reset();draw();}
      run(true);
    });
    b.next.addEventListener('click',()=>{stop();index=Math.min(current().count-1,index+1);motion.reset();draw();run(false);});
    b.back.addEventListener('click',()=>{stop();index=Math.max(0,index-1);motion.reset();draw();});
    b.reset.addEventListener('click',()=>{stop();index=0;motion.reset();draw();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});enlarge(root,b.expand,stop);draw();
  }
  for(const root of document.querySelectorAll('[data-concept-voice]')){
    const b=controls(root);let time=0,late=false,running=false,raf=0,start=0;
    const choice=h('label','cp-choice'),check=h('input');check.type='checkbox';check.dataset.cp='late';choice.append(check,document.createTextNode(' Один речевой фрагмент запаздывает'));root.append(choice);
    const status=h('p','cp-status');status.setAttribute('role','status');
    const scroll=h('div','cp-scroll');scroll.tabIndex=0;scroll.setAttribute('role','region');scroll.setAttribute('aria-label','Временная диаграмма речевых фрагментов');
    const plot=s('svg',{viewBox:'0 0 880 330',role:'img',class:'cp-voice-plot','aria-label':'Речь, прибытие порций данных и воспроизведение во времени'});scroll.append(plot);
    const caption=h('p','cp-caption');root.append(status,scroll,caption);
    const x=t=>155+t*3.7;
    function stop(){running=false;cancelAnimationFrame(raf);b.play.textContent='▶ Показать';b.play.setAttribute('aria-pressed','false');}
    function draw(){
      const packets=m.voicePackets(late);plot.replaceChildren();status.textContent=`Время: ${Math.round(time)} мс`;b.back.disabled=time<=0;b.next.disabled=time>=180;
      for(const[y,label]of [[60,'Речь на входе'],[145,'Приём пакетов'],[225,'Звук на выходе']]){
        plot.append(s('text',{x:8,y:y+5,class:'cp-label'},label),s('path',{d:`M155 ${y} H821`,class:'cp-axis'}));
      }
      for(let t=0;t<=180;t+=20)plot.append(s('path',{d:`M${x(t)} 35 V260`,class:'cp-grid'}),s('text',{x:x(t),y:282,'text-anchor':'middle',class:'cp-tick'},t));
      plot.append(s('text',{x:770,y:310,class:'cp-tick'},'Время, мс'));
      const wave=[];for(let t=0;t<=80;t+=.35)wave.push(`${t?'L':'M'}${x(t)} ${60-16*Math.sin(t*.8)*(0.4+0.6*Math.sin(t*.11)**2)}`);
      plot.append(s('path',{d:wave.join(' '),class:'cp-sound'}));
      for(const p of packets){
        const visible=p.arrival<=time;const missed=p.arrival>p.play;
        plot.append(s('text',{x:x(p.start+10),y:32,'text-anchor':'middle',class:'cp-tick'},p.id));
        if(visible){plot.append(s('rect',{x:x(p.arrival)-11,y:131,width:22,height:28,rx:4,class:missed?'cp-chunk late':'cp-chunk'}),s('text',{x:x(p.arrival),y:150,'text-anchor':'middle',class:'cp-packet-number'},p.id));}
        if(time>=p.play){
          plot.append(s('rect',{x:x(p.play),y:207,width:72,height:36,rx:3,class:missed?'cp-gap':'cp-chunk'}),s('text',{x:x(p.play+10),y:231,'text-anchor':'middle',class:missed?'cp-tick':'cp-packet-number'},missed?'?':p.id));
        }
      }
      plot.append(s('path',{d:`M${x(time)} 20 V265`,class:'cp-cursor'}));
      caption.textContent=time<20?'У отправителя формируется первый речевой фрагмент.':time<50?'Готовые фрагменты отправляются. На приёмной стороне данных пока нет.':time<80?'Первые фрагменты приняты; в этом примере воспроизведение начнётся с 80 мс.':late&&time>=120?'В этом примере фрагмент 3 не успел к своему воспроизведению. Ожидание до его прихода увеличило бы задержку разговора; проигрыватель продолжает работу без этого фрагмента.':'Полученные фрагменты воспроизводятся по порядку. Разговор продолжается одновременно с передачей следующих порций речи.';
    }
    function tick(now){if(!running)return;time=Math.min(180,(now-start)/50);draw();if(time===180){stop();return;}raf=requestAnimationFrame(tick);}
    check.addEventListener('change',()=>{stop();late=check.checked;time=0;draw();});
    b.play.addEventListener('click',()=>{if(running){stop();return;}if(time>=180)time=0;running=true;start=performance.now()-time*50;b.play.textContent='Ⅱ Пауза';b.play.setAttribute('aria-pressed','true');raf=requestAnimationFrame(tick);});
    b.next.addEventListener('click',()=>{stop();time=Math.min(180,Math.floor(time/20)*20+20);draw();});
    b.back.addEventListener('click',()=>{stop();time=Math.max(0,Math.ceil(time/20)*20-20);draw();});
    b.reset.addEventListener('click',()=>{stop();time=0;draw();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});enlarge(root,b.expand,stop);draw();
  }
})();
