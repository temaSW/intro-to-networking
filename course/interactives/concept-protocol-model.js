(function(scope){
  'use strict';
  const row=(step,from,to,label,explain,kind='message')=>({step,from,to,label,explain,kind});
  const tcpOpen=(step,client,server)=>[
    row(step,client,server,'TCP SYN','Клиент начинает установление TCP-соединения с сервером.'),
    row(step,server,client,'TCP SYN + ACK','Сервер подтверждает SYN клиента и передаёт свой SYN.'),
    row(step,client,server,'TCP ACK','Клиент подтверждает SYN сервера. После приёма ACK сервером TCP-соединение установлено.')
  ];
  const tcpSegment=(step,from,to,label,explain,seq,ack,bytes)=>({
    ...row(step,from,to,label,explain),tcp:{seq,ack,bytes,flags:'ACK'},
    brief:bytes?'Сообщение SMB передаётся внутри TCP. В том же сегменте подтверждаются байты, принятые от другой стороны.':'TCP подтверждает приём байтов. Данных SMB в этом сегменте нет.'
  });
  const diagrams={
    cloud:{actors:['Клиент WebDAV','Облачное хранилище'],note:'Яндекс Диск: WebDAV/HTTPS с HTTP/1.1. Адрес известен; сначала устанавливается TCP, затем свёрнуто показана подготовка TLS и доступа. Внутренние серверы облака объединены в одну службу.',rows:[
      ...tcpOpen(0,0,1),
      row(1,0,1,'TLS и доступ к облаку подготовлены','После установления TCP стороны подготавливают защиту TLS и авторизованный доступ. Эти обмены свёрнуты; далее HTTP передаётся внутри TLS.','band'),
      {...row(1,0,1,'HTTP: GET /отчёт.pdf','Клиент WebDAV запрашивает содержимое выбранного файла. GET -- метод HTTP; запрос зашифрован внутри записи TLS. Это HTTPS.'),protection:'application',displayLabel:'TLS: зашифрованный HTTP-запрос'},
      {...row(2,1,0,'HTTP/1.1 200 OK + байты файла','Внутри зашифрованного ответа TLS находятся HTTP 200 OK и байты файла. Наблюдателю по пути они не видны. Большой файл передаётся множеством пакетов; здесь это одна стрелка.'),protection:'application',displayLabel:'TLS: зашифрованный HTTP-ответ с файлом'},
      row(3,0,0,'Файл передан программе','Клиент собирает полученные данные и передаёт их программе. Это локальная обработка.','local')
    ]},
    smb:{actors:['Клиент SMB','Файловый сервер'],note:'Сплошные стрелки -- TCP с сообщением SMB; пунктир -- отдельный TCP ACK без данных.',rows:[
      ...tcpOpen(0,0,1),
      row(1,0,1,'Подготовка SMB: сеанс и доступ к папке','Это отдельный служебный обмен SMB после установления TCP: согласование протокола, подготовка сеанса и подключения общей папки. Сообщения этого обмена свёрнуты в одну полосу; далее открывается файл.','band'),
      tcpSegment(1,0,1,'SMB2 CREATE: отчёт.pdf','Запрос открытия файла находится в полезной нагрузке TCP: 160 байт с SEQ 1001. Следующий ожидаемый от сервера байт -- 5001.',1001,5001,160),
      tcpSegment(1,1,0,'TCP ACK: байты запроса приняты','ACK 1161 подтверждает приём байтов 1001–1160. Прикладных данных в сегменте нет. Это ещё не ответ SMB об открытии файла.',5001,1161,0),
      tcpSegment(1,1,0,'CREATE Response: SUCCESS, FileId','Теперь сервер SMB сообщает об успешном открытии файла и возвращает FileId. Эти 160 байт идут в TCP; ACK 1161 также подтверждает запрос клиента.',5001,1161,160),
      tcpSegment(1,0,1,'SMB2 READ: FileId, Offset, Length','Клиент запрашивает данные файла. Сегмент TCP несёт 116 байт запроса и одновременно подтверждает приём ответа CREATE: ACK 5161. Отдельный ACK для него здесь не нужен.',1161,5161,116),
      tcpSegment(2,1,0,'READ Response: данные','Сервер возвращает ответ SMB с данными файла внутри 596 байт полезной нагрузки TCP. ACK 1277 одновременно подтверждает запрос READ. Длина включает оформление SMB, а не только байты файла.',5161,1277,596),
      tcpSegment(2,0,1,'TCP ACK: байты ответа приняты','ACK 5757 подтверждает приём байтов сервера до 5756 включительно. Сегмент не содержит запроса SMB и не доказывает, что программа уже использовала данные файла.',1277,5757,0),
      tcpSegment(2,0,1,'SMB2 CLOSE: FileId','Клиент отправляет закрытие файла внутри 92 байт полезной нагрузки TCP. Отдельный ACK перед этим не израсходовал номер SEQ: данные продолжаются с 1277.',1277,5757,92),
      tcpSegment(3,1,0,'CLOSE Response: SUCCESS','Ответ SMB подтверждает закрытие файла, а ACK 1369 в том же сегменте TCP подтверждает байты запроса CLOSE. TCP-соединение остаётся открытым.',5757,1369,128),
      tcpSegment(3,0,1,'TCP ACK: ответ CLOSE принят','Клиент подтверждает байты ответа: ACK 5885. Это подтверждение TCP, а не ещё одна операция SMB. Файл закрыт; TCP-соединение сохраняется для следующих операций.',1369,5885,0)
    ]},
    web:{actors:['Компьютер','DNS-резолвер','Веб-сервер'],note:'Пример HTTPS с HTTP/1.1 поверх TCP. Имя и адрес условные; DNS-кэша и готового соединения с сайтом нет.',rows:[
      row(1,0,1,'DNS Query: A course.example','Компьютер запрашивает адрес IPv4 для имени сайта.'),
      row(2,1,0,'DNS Response: A 198.51.100.20','Успешный ответ содержит адрес для следующего обмена. Это ещё не содержимое сайта.'),
      row(3,0,2,'TCP-соединение установлено','После получения адреса устанавливается TCP-соединение с веб-сервером. Три сообщения рукопожатия уже разобраны в первых двух примерах и здесь свёрнуты.','band'),
      row(3,0,2,'TLS: подготовка защиты','Полоса объединяет несколько служебных сообщений TLS. Обмен ключами, сертификат и проверка сервера уже рассмотрены в предшествующем разборе TLS.','band'),
      {...row(3,0,2,'HTTP: GET / HTTP/1.1','Браузер запрашивает ресурс по HTTPS. HTTP GET зашифрован внутри TLS; промежуточным узлам его содержимое недоступно.'),protection:'application',displayLabel:'TLS: зашифрованный HTTP-запрос'},
      {...row(4,2,0,'HTTP/1.1 200 OK + HTML','Сервер возвращает HTTP 200 OK и HTML внутри зашифрованных записей TLS. Заголовки и тело здесь объединены в одну стрелку.'),protection:'application',displayLabel:'TLS: зашифрованный HTTP-ответ с HTML'},
      row(5,0,0,'Разбор HTML','Это локальная обработка, а не новое сетевое сообщение. Дополнительные ресурсы могут потребовать новых запросов.','local')
    ]},
    message:{actors:['Приложение А','XMPP-сервер','Приложение Б'],note:'TCP-соединения А ↔ сервер и Б ↔ сервер уже установлены, TLS и вход в службу подготовлены. В примере используется расширение подтверждений XEP-0184.',rows:[
      row(1,0,1,'message type="chat", id="m1"','А отправляет XMPP-сообщение с текстом и запросом подтверждения получения.'),
      row(2,1,1,'Приём и обработка сервером','Это действие сервера. Базовое сообщение XMPP само по себе не требует отдельного ответа «сервер принял».','local'),
      row(3,1,2,'message type="chat", id="m1"','Сервер передаёт сообщение клиенту Б. Между клиентами нет непосредственного сетевого соединения для этой передачи.'),
      row(4,2,2,'Б получил сообщение m1','Получение приложением ещё не означает прочтения человеком.','local'),
      row(5,2,1,'message: received id="m1"','Б отправляет подтверждение XEP-0184 в ответ на запрошенную квитанцию. Оно подтверждает получение клиентом, а не прочтение.'),
      row(5,1,0,'message: received id="m1"','Сервер доставляет подтверждение А. Теперь А получил сведения о приёме сообщения клиентом Б.')
    ]},
    voip:{actors:['Телефон А','Телефон Б'],note:'Прямой вызов: SIP организует сеанс, RTP переносит речь. Адреса известны. Показан успешный пример без повторов и ранней передачи речи.',rows:[
      row(1,0,1,'SIP INVITE + SDP','А предлагает начать сеанс; описание SDP сообщает параметры предлагаемого медиапотока.'),
      row(1,1,0,'SIP 180 Ringing','Телефон Б сообщает, что вызов поступил и участник оповещается. Разговор ещё не принят.'),
      row(2,1,0,'SIP 200 OK (INVITE) + SDP','Б принял вызов и вернул согласованные параметры сеанса.'),
      row(2,0,1,'SIP ACK','А подтверждает получение окончательного ответа на INVITE.'),
      row(3,0,1,'RTP: речь А, seq=1000','Речевые данные идут отдельным потоком RTP, а не в сообщениях SIP. Начальный номер выбран для примера.','media'),
      row(4,1,0,'RTP: речь Б, seq=6200','Обратный речевой поток имеет собственную нумерацию пакетов.','media'),
      row(6,0,1,'SIP BYE','А завершает разговор. В реальном сеансе завершить его может и другая сторона.'),
      row(6,1,0,'SIP 200 OK (BYE)','Б подтверждает запрос завершения. Этот 200 OK относится к BYE, а не к первоначальному INVITE.')
    ]}
  };
  function call(relay){
    const rows=[
      row(1,0,1,'IQ set: session-initiate','А предлагает голосовой сеанс с помощью Jingle -- расширения XMPP.'),
      row(1,1,3,'IQ set: session-initiate','XMPP-сервер пересылает предложение клиенту Б.'),
      row(1,3,1,'IQ result','Б подтвердил получение запроса IQ. Это ещё не согласие пользователя на разговор.'),
      row(1,1,0,'IQ result','Сервер пересылает ответ на исходный запрос IQ клиенту А.'),
      row(2,3,1,'IQ set: session-accept','После согласия пользователя Б принимает предложение сеанса.'),
      row(2,1,0,'IQ set: session-accept','XMPP-сервер доставляет принятие сеанса клиенту А.'),
      row(2,0,1,'IQ result','А подтверждает получение session-accept.'),
      row(2,1,3,'IQ result','Ответ доставляется Б. Подготовка медиатранспорта и защиты перед передачей речи здесь свёрнута.')
    ];
    const forward=relay?[0,2,3]:[0,3],backward=forward.slice().reverse();
    for(const [step,path,name]of [[3,forward,'А'],[4,backward,'Б']])for(let i=1;i<path.length;i++)rows.push(row(step,path[i-1],path[i],`SRTP: речь ${name}`,relay?'Защищённые речевые данные проходят ретранслятор. XMPP-сервер организации вызова в этом медиапути не участвует.':'Защищённый речевой поток идёт между участниками через сетевую инфраструктуру, минуя XMPP-сервер.','media'));
    return {actors:['Приложение А','XMPP-сервер','Ретранслятор','Приложение Б'],note:'Пример XMPP/Jingle и SRTP. IQ -- запрос/ответ XMPP. XMPP-соединения готовы; согласование медиатранспорта и защиты свёрнуто.',rows};
  }
  function tls(fault){
    const r=(from,to,label,explain,protection=null,kind='message')=>({...row(0,from,to,label,explain,kind),protection});
    const rows=[
      r(0,1,'ClientHello + key_share','Клиент предлагает TLS 1.3, алгоритмы и открытые временные параметры обмена ключами. Закрытый параметр остаётся у клиента.','none'),
      r(1,0,'ServerHello + key_share','Сервер выбирает параметры и возвращает свою открытую временную долю. Общий секрет готовым значением по сети не передаётся.','none'),
      r(0,0,'Ключи рукопожатия готовы','Каждая сторона использует собственный закрытый параметр и открытую долю другой стороны. Из общего секрета выводятся разные ключи рукопожатия для двух направлений.',null,'local'),
      r(1,0,'EncryptedExtensions','Сервер сообщает остальные согласованные параметры, включая выбранный прикладной протокол. Содержимое этого сообщения уже защищено.','handshake'),
      r(1,0,'Certificate','Сервер передаёт цепочку сертификатов. Сертификат связывает имя сервера с открытым ключом подписи; готового секретного ключа сеанса в нём нет.','handshake'),
      r(1,0,'CertificateVerify','Сервер подписывает данные текущего рукопожатия. Подпись позволяет проверить владение закрытым ключом, соответствующим сертификату.','handshake'),
      r(1,0,'Finished (сервер)','Проверочный код подтверждает ключи и целостность состоявшегося обмена. Это сообщение TLS, а не подтверждение байтов TCP.','handshake')
    ];
    if(fault){
      rows.push(r(0,0,'Проверка: имя не совпало','Клиент ожидал course.example, а сертификат выдан другому имени. Даже корректная цепочка и подпись не устраняют это несовпадение; обмен прекращается.',null,'local'),
        r(0,1,'Alert: certificate_unknown','Клиент сообщает об отказе и закрывает TLS-обмен. В этой ветви нет Finished клиента и нет HTTP-запроса. Тип alert выбран для примера.','handshake'));
    }else{
      rows.push(r(0,0,'Проверка сервера','Клиент проверяет ожидаемое имя, цепочку доверия, срок действия сертификатов, подпись CertificateVerify и код Finished. В этом примере проверки успешны.',null,'local'),
        r(0,1,'Finished (клиент)','Клиент подтверждает рукопожатие своим проверочным кодом. В выбранном варианте сертификат клиента не запрашивался.','handshake'),
        r(1,1,'Сервер проверяет Finished','Сервер проверяет подтверждение клиента. Для дальнейшего обмена приложений стороны используют отдельные ключи защиты данных.',null,'local'),
        r(0,1,'Application Data: запрос HTTP','Браузер передаёт GET внутри защищённых записей TLS. Назначение данных подписано для обучения; наблюдателю по пути открытый HTTP-текст не виден.','application'),
        r(1,0,'Application Data: ответ HTTP','Сервер возвращает защищённый ответ. Клиент проверяет целостность, расшифровывает данные и передаёт их браузеру.','application'));
    }
    return {actors:['Клиент TLS','Сервер TLS'],note:'Полное рукопожатие TLS 1.3 с сертификатом сервера. TCP готов; нет возобновления, ранних данных и сертификата клиента. Метка «шифр» относится к содержимому сообщения.',rows:rows.map(r=>r.protection==='application'?{...r,displayLabel:r.from===0?'TLS Application Data: HTTP-запрос':'TLS Application Data: HTTP-ответ'}:r)};
  }
  const stacks={cloud:'WebDAV по HTTPS: HTTP → TLS → TCP → IP',smb:'SMB2/3 → TCP → IP',web:'DNS → UDP → IP; HTTPS: HTTP → TLS → TCP → IP',tls:'HTTPS: HTTP → TLS 1.3 → TCP → IP',message:'XMPP → TLS → TCP → IP',call:'Jingle/XMPP → TLS → TCP → IP; SRTP → UDP → IP',voip:'SIP → UDP → IP; RTP → UDP → IP'};
  function forCase(id,relay=false,tlsFault=false){
    const data=id==='tls'?tls(tlsFault):id==='call'?call(relay):diagrams[id];if(!data)throw new RangeError('Нет диаграммы');
    const rows=data.rows.map(r=>{
      if(r.kind==='local')return {...r,transport:null,flow:null};
      let transport='TCP',flow='';
      if(id==='web'&&r.label.startsWith('DNS'))transport='UDP';
      if(id==='voip'||(id==='call'&&r.kind==='media'))transport='UDP';
      if((id==='message'||id==='call')&&transport==='TCP')flow=r.from===0||r.to===0?'А ↔ сервер':'Б ↔ сервер';
      return {...r,transport,flow};
    });
    const transportNote=id==='voip'?' В этом примере SIP использует UDP; SIP также поддерживает TCP.':id==='call'&&relay?' Медиатранспорт выбран UDP; упаковка ретранслятора свёрнута.':'';
    return {...data,rows,stack:stacks[id],note:data.note+transportNote};
  }
  const actorNodes={cloud:[0,3],smb:[0,2],web:[0,4,3],tls:[0,3],message:[0,2,4],call:[0,2,5,4],voip:[0,2]};
  function transportStatus(id,index,event){
    if(id==='smb'||id==='cloud')return index===0?'TCP-соединение ещё не установлено.':index<3?'TCP: установление соединения.':index===3?'TCP: ACK завершает установление соединения.':'TCP-соединение установлено.';
    if(id==='web')return index<3?'DNS: UDP готов к обмену; рукопожатия нет. TCP будет установлен после получения адреса.':'TCP-соединение с веб-сервером установлено.';
    if(id==='tls')return 'TCP-соединение уже установлено.';
    if(id==='message')return 'Два TCP-соединения уже установлены: А ↔ сервер и Б ↔ сервер.';
    if(id==='call')return 'TCP-соединения с XMPP-сервером уже установлены. '+(event?.kind==='media'?'UDP готов к передаче речи; рукопожатия UDP нет.':'UDP для речи будет готов после согласования медиасеанса; рукопожатия UDP нет.');
    return 'UDP готов к обмену SIP и RTP; установления соединения и рукопожатия UDP нет.';
  }
  function routeBetween(edges,from,to){
    const queue=[[from]],seen=new Set([from]);
    while(queue.length){
      const route=queue.shift(),last=route[route.length-1];if(last===to)return route;
      for(const[a,b]of edges){const next=a===last?b:b===last?a:null;if(next!==null&&!seen.has(next)){seen.add(next);queue.push([...route,next]);}}
    }
    throw new Error('Участники не соединены на карте');
  }
  function eventState(id,index,relay=false,tlsFault=false){
    const sequence=forCase(id,relay,tlsFault),base=scope.CourseConceptPath.stateAt(id,0,relay);
    if(!Number.isInteger(index)||index<0||index>sequence.rows.length)throw new RangeError('Нет события');
    const event=index?sequence.rows[index-1]:null;
    const from=event?actorNodes[id][event.from]:base.at,to=event?actorNodes[id][event.to]:base.at;
    const moving=event&&event.kind!=='local'&&event.kind!=='band';
    return {...base,index,count:sequence.rows.length+1,event,eventIndex:index-1,sequence,transportStatus:transportStatus(id,index,event),
      title:event?(event.displayLabel||event.label):base.title,text:event?event.explain:base.text,payload:event?(event.displayLabel||event.label):base.payload,
      path:moving?routeBetween(base.edges,from,to):null,at:from===to?from:undefined,
      focusNodes:event?.kind==='band'?[from,to]:[from],fromNode:from,toNode:to,
      train:false,duplex:false,media:event?.kind==='media',control:!!moving&&event.kind!=='media'};
  }
  function heading(a,b){return Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;}
  function createMotion(travel=1800,hold=2700){
    let elapsed=0,last=null,running=false,continuous=false;
    const snapshot=()=>({progress:Math.min(1,elapsed/travel),elapsed,running,
      done:elapsed>=(continuous?travel+hold:travel),continuous});
    function sample(now){if(running){elapsed+=Math.max(0,now-last);last=now;if(elapsed>=(continuous?travel+hold:travel))running=false;}return snapshot();}
    return {snapshot,sample,
      setDuration(value){if(!Number.isFinite(value)||value<=0)throw new RangeError('Неверная длительность');if(value===travel)return snapshot();const progress=Math.min(1,elapsed/travel),extra=Math.max(0,elapsed-travel);travel=value;elapsed=progress*travel+extra;return snapshot();},
      play(now,auto=false){continuous=auto;last=now;running=true;return snapshot();},
      pause(now){sample(now);running=false;last=null;return snapshot();},
      reset(progress=0){elapsed=Math.max(0,Math.min(1,progress))*travel;running=false;last=null;continuous=false;return snapshot();}};
  }
  scope.CourseConceptProtocols=Object.freeze({forCase,eventState,heading,createMotion});
})(window);
