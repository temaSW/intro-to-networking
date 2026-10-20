"""Build editable SVG/HTML diagrams for topic 05; no third-party assets."""
from pathlib import Path
from html import escape
import math

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'course/_includes'


def text(x, y, value, cls='', anchor='start'):
    return f'<text x="{x}" y="{y}" class="{cls}" text-anchor="{anchor}">{escape(value)}</text>'


def path(d, cls='mf-wire', arrow=False):
    return f'<path d="{d}" class="{cls}"'+(' marker-end="url(#ARROW)"' if arrow else '')+'/>'


def rect(x, y, w, h, cls='mf-node', radius=3):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" class="{cls}"/>'


def packet(x, y, name, flow='a', w=48, h=28):
    return rect(x,y,w,h,f'mf-packet mf-{flow}')+text(x+w/2,y+h/2+5,name,'mf-packet-label','middle')


def switch(x,y,label='',r=23):
    return (f'<circle cx="{x}" cy="{y}" r="{r}" class="mf-node"/>'
            +path(f'M{x-12} {y-7} h24 m-5 -4 5 4 -5 4 M{x+12} {y+7} h-24 m5 -4 -5 4 5 4','mf-symbol')
            +(text(x,y+46,label,'mf-small','middle') if label else ''))


def terminal(x,y):
    return (rect(x-22,y-18,44,29,'mf-terminal',2)
            +path(f'M{x-26} {y+18} H{x+26} L{x+22} {y+11} H{x-22} Z','mf-symbol'))


def guide(x1,x2,y,label):
    return path(f'M{x1} {y} v6 H{x2} v-6','mf-guide')+text((x1+x2)/2,y+28,label,'mf-small','middle')


def figure(name,title,description,body,height,caption):
    prefix='topic05-'+name
    body=body.replace('#ARROW','#'+prefix+'-arrow')
    content=f'''```{{=html}}
<figure class="course-demo mux-figure" aria-labelledby="{prefix}-caption">
<div class="mux-figure-scroll" tabindex="0" role="region" aria-label="{escape(title)}. На узком экране схема прокручивается по горизонтали">
<svg viewBox="0 0 1040 {height}" role="img" aria-labelledby="{prefix}-title {prefix}-desc">
<title id="{prefix}-title">{escape(title)}</title>
<desc id="{prefix}-desc">{escape(description)}</desc>
<defs><marker id="{prefix}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill="context-stroke"/></marker></defs>
{body}
</svg>
</div>
<p class="mux-figure-hint" aria-hidden="true">Схема прокручивается по горизонтали →</p>
<figcaption id="{prefix}-caption">{escape(caption)}</figcaption>
</figure>
```
'''
    (OUT/(prefix+'.html')).write_text(content,encoding='utf-8')


def architecture():
    b=''
    # Actual branching, shared links and a transport ring, rather than a box chain.
    for x,label in [(58,'Абоненты'),(220,'Доступ'),(407,'Агрегация'),(660,'Транспорт'),(847,'Ядро'),(974,'Внешняя сеть')]:
        b+=text(x,30,label,'mf-heading','middle')
    for y,flow,label in [(90,'a','А'),(180,'b','Б'),(300,'c','В')]:
        b+=terminal(58,y)+text(23,y+5,label,f'mf-{flow} mf-bold','middle')
        endy=130 if y<250 else 300
        b+=path(f'M84 {y} H137 L196 {endy}',f'mf-route mf-{flow}',True)
    b+=switch(220,130,'Дом 1')+switch(220,300,'Дом 2')+switch(407,210)
    b+=text(407,300,'Районный узел','mf-small','middle')
    b+=path('M244 130 H294 L383 202','mf-link')+path('M244 300 H294 L383 218','mf-link')
    b+=path('M244 125 H298 L383 197','mf-route mf-a',True)+path('M244 135 H290 L383 207','mf-route mf-b',True)+path('M244 300 H294 L383 218','mf-route mf-c',True)
    b+=path('M431 210 H560 L660 100 760 210 660 320 560 210','mf-link')
    for x,y in [(560,210),(660,100),(760,210),(660,320)]: b+=switch(x,y)
    for offset,flow in [(-7,'a'),(0,'b'),(7,'c')]:
        b+=path(f'M432 {210+offset} H{550+offset} L{660+offset} {100+offset} {768+offset} {210+offset} H823',f'mf-route mf-{flow}',True)
    b+=switch(847,210)+path('M871 210 H932','mf-wire',True)
    b+=path('M948 186 C936 165 966 150 982 169 C1002 156 1025 180 1011 198 C1029 220 1005 242 983 230 H952 C928 230 924 198 948 186 Z','mf-cloud')
    b+=text(660,374,'Другой путь транспорта','mf-small','middle')
    b+=guide(245,382,350,'Общие линии')+text(980,269,'Другая сеть','mf-small','middle')
    b+=text(36,408,'А, Б, В — абонентские потоки. Цвет сохраняется на всём показанном пути.','mf-small')
    figure('architecture','От абонентских линий к общей инфраструктуре',
            'Потоки А и Б одного дома сходятся на первом узле доступа, поток В другого дома — на втором. Два узла доступа соединены с районным узлом агрегации. Три потока идут по общей линии и одному пути кольца транспорта к ядру и внешней сети. Нижняя ветвь кольца показывает альтернативный путь.',b,435,
            'Функциональная схема фиксированной сети. Линии сходятся, а потоки продолжают различаться. Доступ, агрегация, транспорт и ядро обозначают части архитектуры, а не уровни OSI.')


def multiplexing():
    b=''
    for i,(flow,label) in enumerate(zip('abc','АБВ')):
        y=92+i*90
        b+=text(30,y+6,label,f'mf-{flow} mf-bold')+path(f'M75 {y} H245',f'mf-route mf-{flow}',True)
        b+=packet(112,y-14,label+'₁',flow)
        b+=path(f'M795 {y} H983',f'mf-route mf-{flow}',True)+text(1004,y+6,label,f'mf-{flow} mf-bold','middle')
    b+=path('M250 57 H293 L360 146 V218 L293 307 H250 Z','mf-device')
    b+=path('M790 57 H747 L680 146 V218 L747 307 H790 Z','mf-device')
    b+=text(290,187,'М','mf-bold','middle')+text(751,187,'Д','mf-bold','middle')
    b+=rect(363,142,314,80,'mf-medium',15)
    for dy,flow,label in [(-24,'a','А'),(0,'b','Б'),(24,'c','В')]:
        b+=path(f'M366 {182+dy} H674',f'mf-route mf-{flow}',True)+text(516,176+dy,label,f'mf-{flow} mf-small','middle')
    b+=text(515,117,'Одна общая линия','mf-heading','middle')
    b+=text(292,345,'Мультиплексор','mf-heading','middle')+text(750,345,'Демультиплексор','mf-heading','middle')
    b+=text(515,270,'Согласованное правило разделения','mf-small','middle')
    figure('multiplexing','Объединение и выделение трёх потоков',
            'Три отдельных входа А, Б, В приходят к мультиплексору М, проходят общую линию и разделяются демультиплексором Д обратно на А, Б, В. Цветные линии внутри общей среды обозначают различимые потоки, а не три физических провода.',b,375,
            'М и Д используют одно правило различения потоков. Три цветные трассы внутри общей линии — условное изображение потоков, а не отдельных проводов.')


def methods():
    b=text(28,44,'FDM / ЧРК','mf-heading')+text(28,72,'Разные подполосы','mf-small')
    b+=path('M245 150 H1000','mf-axis',True)+path('M245 150 V32','mf-axis',True)
    b+=text(995,179,'Частота f','mf-small','end')+text(254,25,'Спектр, условно','mf-small')
    for x,flow,label in [(290,'a','А'),(508,'b','Б'),(726,'c','В')]:
        b+=path(f'M{x} 149 C{x+30} 149 {x+30} 60 {x+65} 60 S{x+105} 149 {x+130} 149 Z',f'mf-spectrum mf-{flow}')
        b+=text(x+65,52,label,f'mf-{flow} mf-bold','middle')+text(x+65,174,'f'+{'a':'₁','b':'₂','c':'₃'}[flow],'mf-small','middle')
    b+=guide(425,501,146,'Зазор')
    b+=path('M25 200 H1015','mf-divider')
    b+=text(28,248,'TDM / ВРК','mf-heading')+text(28,276,'Разные позиции','mf-small')+text(28,300,'во времени','mf-small')
    for i in range(9):
        flow='abc'[i%3];label='АБВ'[i%3]
        b+=packet(248+i*77,246,label,flow,72,54)
    b+=path('M245 352 H1000','mf-axis',True)+text(995,378,'Время t','mf-small','end')
    b+=guide(248,474,306,'Цикл 1')+guide(479,705,306,'Цикл 2')
    b+=path('M25 387 H1015','mf-divider')
    b+=text(28,443,'WDM','mf-heading')+text(28,471,'Разные оптические','mf-small')+text(28,495,'длины волн','mf-small')
    for i,(flow,label) in enumerate(zip('abc','АБВ')):
        y=438+i*63
        b+=text(248,y+5,label+' · λ'+'₁₂₃'[i],f'mf-{flow} mf-bold')
        b+=path(f'M330 {y} H390 L450 501',f'mf-route mf-{flow}')
        b+=path(f'M820 501 L880 {y} H976',f'mf-route mf-{flow}',True)
    b+=rect(450,476,370,50,'mf-medium',20)
    for k,flow in enumerate('abc'):
        pts=' '.join(f'{x:.1f},{501+15*math.sin((x-460)*(0.04+0.025*k)):.1f}' for x in range(460,811,2))
        b+=f'<polyline points="{pts}" class="mf-wave mf-{flow}"/>'
    b+=text(635,455,'Одно оптическое волокно','mf-heading','middle')
    b+=text(635,571,'λ₁, λ₂, λ₃ передаются одновременно','mf-small','middle')
    figure('methods','Три способа разделить общий ресурс',
            'Сверху: спектры А, Б, В занимают разные подполосы частот с защитными интервалами. Посередине: на одной временной оси повторяются позиции А, Б, В. Снизу: три оптических канала на длинах волн лямбда один, два и три входят в одно волокно и выделяются на выходе.',b,610,
            'Цвет и буквы обозначают одни и те же потоки. Масштабы условные; оптические волны показаны схематично. WDM использует спектральное разделение в оптическом диапазоне.')


def statistical():
    # Same arrivals, same slot length. Fixed slots waste capacity; dynamic slots consume A backlog.
    b=text(30,30,'Одни и те же готовые блоки','mf-heading')
    for y,flow,names in [(75,'a',['А₁','А₂','А₃','А₄']),(124,'b',['Б₁','Б₂']),(173,'c',[])]:
        b+=text(30,y+19,{'a':'А','b':'Б','c':'В'}[flow],f'mf-{flow} mf-bold')
        for i,label in enumerate(names): b+=packet(78+i*62,y,label,flow,54)
        if not names:b+=text(78,y+19,'Нет данных','mf-small')
    b+=text(460,30,'Передача по общему выходу','mf-heading')
    b+=text(460,66,'Фиксированные позиции А / Б / В','mf-small')
    for i,(label,flow) in enumerate([('А₁','a'),('Б₁','b'),('—','empty'),('А₂','a'),('Б₂','b'),('—','empty')]):
        b+=packet(460+i*88,80,label,flow,80,38)
    b+=text(460,155,'Позиции получают готовые блоки','mf-small')
    for i,(label,flow) in enumerate([('А₁','a'),('Б₁','b'),('А₂','a'),('А₃','a'),('Б₂','b'),('А₄','a')]):
        b+=packet(460+i*88,169,label,flow,80,38)
    b+=path('M455 232 H1000','mf-axis',True)+text(995,258,'Время t','mf-small','end')
    b+=text(30,253,'Очередь готовых блоков →','mf-small')
    figure('statistical','Фиксированные позиции и передача по наличию данных',
            'В начале доступны четыре блока А, два блока Б, от В данных нет. За шесть одинаковых позиций фиксированная схема передаёт А1, Б1, пусто, А2, Б2, пусто. Динамическая схема за те же шесть позиций передаёт все шесть блоков; порядок А1, Б1, А2, А3, Б2, А4 является одним допустимым примером.',b,285,
            'Слева — одинаковый набор готовых блоков, справа — одинаковые шесть интервалов передачи. Прочерк означает пустую закреплённую позицию. Порядок динамического обслуживания приведён как пример.')


def switching():
    b=rect(294,47,435,286,'mf-enclosure',8)
    b+=text(511,29,'Коммутационный узел','mf-heading','middle')
    for i,(flow,label,out) in enumerate([('a','А',2),('b','Б',3),('c','В',1)]):
        y=100+i*95;dy=100+(out-1)*95
        b+=text(30,y+5,'Вход '+label,'mf-bold')+path(f'M130 {y} H310',f'mf-route mf-{flow}',True)
        b+=packet(177,y-14,label+'₁',flow)
        b+=path(f'M317 {y} C430 {y} 580 {dy} 706 {dy}',f'mf-switch-route mf-{flow}',True)
        b+=path(f'M716 {dy} H923',f'mf-route mf-{flow}',True)+text(945,dy+5,'Выход '+str(out),'mf-bold')
        b+=f'<circle cx="310" cy="{y}" r="5" class="mf-port"/><circle cx="716" cy="{dy}" r="5" class="mf-port"/>'
    b+=text(510,375,'А → 2     Б → 3     В → 1','mf-small','middle')
    figure('switching','Разные входы направляются на разные выходы',
            'Трасса А из верхнего входа проходит к выходу 2, трасса Б из среднего — к выходу 3, трасса В из нижнего — к выходу 1. Буквы и цвета позволяют проследить каждую связь через узел. Пересечения трасс не являются соединениями.',b,400,
            'Для этого примера связи известны заранее: А → 2, Б → 3, В → 1. Пересечение трасс не означает смешивание потоков. Один выход также может обслуживать несколько входных потоков.')


def circuits():
    b=text(26,32,'Путь через несколько узлов','mf-heading')
    b+=path('M97 105 H948','mf-link')
    for x in [300,520,740]: b+=switch(x,105)
    for x,label in [(65,'Абонент А'),(978,'Абонент Б')]:
        b+=rect(x-25,78,50,54,'mf-terminal',6)+text(x,165,label,'mf-small','middle')
    b+=path('M94 105 H948','mf-reservation',True)
    b+=text(520,199,'Ресурс выделяется на каждом участке пути','mf-small','middle')
    b+=text(26,259,'Состояние одного выделяемого ресурса во времени','mf-heading')
    b+=path('M50 355 H1010','mf-axis',True)
    for x in [215,828]:b+=path(f'M{x} 280 V362','mf-guide')
    b+=rect(215,290,613,47,'mf-reserved-band',0)
    b+=text(125,320,'Свободен','mf-small','middle')+text(521,281,'Ресурс закреплён за соединением','mf-small','middle')+text(535,320,'Пауза','mf-small','middle')+text(919,320,'Свободен','mf-small','middle')
    b+=text(215,385,'Установление','mf-small','middle')+text(828,385,'Освобождение','mf-small','middle')
    b+=path('M295 292 v43 M455 292 v43 M615 292 v43 M775 292 v43','mf-reservation-data')
    b+=text(997,413,'Время t','mf-small','end')
    figure('circuits','Выделенное соединение: путь и удержание ресурса',
            'Сверху абоненты соединены через три узла; выделенный путь занимает ресурс на каждом участке. Снизу временная полоса: до установления ресурс свободен, после установления закреплён, после освобождения снова свободен. Отдельные штрихи данных не заполняют всю полосу, но ресурс удерживается и в паузах.',b,440,
            'Сплошная полоса внизу показывает удержание ресурса, короткие штрихи — передачу данных. Пауза в данных не освобождает соединение. Масштаб времени условный.')


def packets():
    # Arrival markers denote complete packets ready at the node, not input link durations.
    arrivals = [('А₁', 'a', 0), ('Б₁', 'b', .5), ('А₂', 'a', 1.5),
                ('В₁', 'c', 1.75), ('А₃', 'a', 5), ('Б₂', 'b', 5.5)]
    x = lambda t: 210 + 100 * t
    rows = {'a': 100, 'b': 175, 'c': 250}
    b = text(28, 32, 'Пакеты полностью поступили в узел', 'mf-heading')
    b += text(1010, 32, 'Одна шкала времени для всех строк', 'mf-small', 'end')
    for t in range(9):
        b += path(f'M{x(t)} 64 V475', 'mf-time-guide')
        b += text(x(t), 504, str(t), 'mf-small', 'middle')
    for flow, label in zip('abc', 'АБВ'):
        y = rows[flow]
        b += text(28, y + 6, 'Абонент ' + label, 'mf-heading')
        b += path(f'M210 {y} H1010', 'mf-guide')
    for label, flow, arrival in arrivals:
        y = rows[flow]
        b += text(x(arrival), y - 20, label, f'mf-{flow} mf-bold', 'middle')
        b += path(f'M{x(arrival)} {y-13} V{y+8}', f'mf-arrival mf-{flow}')
        b += path(f'M{x(arrival)-5} {y+1} L{x(arrival)} {y+8} L{x(arrival)+5} {y+1}', f'mf-arrival mf-{flow}')
    b += path('M28 287 H1010', 'mf-divider')
    b += text(28, 329, 'Общий выход', 'mf-heading')
    b += text(28, 353, '1 мс на пакет', 'mf-small')
    b += path('M210 335 H1010', 'mf-guide')
    # FIFO: one non-preemptive transmission at a time; enough buffer for this trace.
    free_at = 0
    for label, flow, arrival in arrivals:
        start = max(arrival, free_at)
        free_at = start + 1
        b += packet(x(start), 312, label, flow, 100, 46)
    b += text(x(4.5), 340, 'пауза', 'mf-small', 'middle')
    b += text(x(7.5), 340, 'пауза', 'mf-small', 'middle')
    b += text(28, 417, 'Пакет В₁', 'mf-heading')
    b += text(28, 441, 'ожидание → передача', 'mf-small')
    b += rect(x(1.75), 400, 125, 36, 'mf-wait mf-c', 0)
    b += text(x(2.375), 423, 'ожидает', 'mf-small', 'middle')
    b += packet(x(3), 400, 'В₁', 'c', 100, 36)
    b += text(x(1.75), 461, '1,75', 'mf-small', 'middle')
    b += text(x(3), 461, '3', 'mf-small', 'middle')
    b += path('M210 478 H1020', 'mf-axis', True)
    b += text(1010, 535, 'Время, мс', 'mf-small', 'end')
    figure('packets', 'Поступление и передача пакетов на общей шкале времени',
           'Стрелки показывают поступление готовых пакетов: А1 в 0 мс, Б1 в 0,5, А2 в 1,5, В1 в 1,75, А3 в 5, Б2 в 5,5 мс. '
           'Общий выход передаёт по одному пакету за 1 мс в порядке поступления: А1, Б1, А2, В1, затем пауза с 4 до 5 мс, А3 и Б2. '
           'Пакет В1 ожидает с 1,75 до 3 мс, затем передаётся с 3 до 4 мс.', b, 553,
           'Стрелка -- момент полного поступления пакета в узел; цветная полоса -- время его передачи через общий выход. '
           'Пакеты обслуживаются в порядке поступления. Пунктирная полоса показывает ожидание В₁: пока выход занят Б₁ и А₂, '
           'пакет остаётся в буфере. Паузы на выходе появляются, когда готовых пакетов нет.')


def tradeoffs():
    b=text(30,33,'Один выход, одинаковое поступление данных','mf-heading')
    b+=text(30,103,'Закреплённые','mf-heading')+text(30,129,'доли А / Б','mf-heading')
    b+=text(30,251,'Общий выход','mf-heading')
    fixed=[('А₁','a'),('—','empty'),('А₂','a'),('—','empty'),('А₃','a'),('Б₁','b'),('А₄','a'),('—','empty')]
    shared=[('А₁','a'),('А₂','a'),('А₃','a'),('А₄','a'),('—','empty'),('Б₁','b'),('—','empty'),('—','empty')]
    for row,y in [(fixed,85),(shared,226)]:
        for i,(label,flow) in enumerate(row): b+=packet(253+i*91,y,label,flow,84,47)
    for i in range(9):b+=path(f'M{250+i*91} 143 V212','mf-time-guide')
    b+=text(344,169,'Б молчит','mf-small','middle')+text(526,169,'Б молчит','mf-small','middle')
    b+=path('M250 305 H1000','mf-axis',True)+text(995,334,'Время t','mf-small','end')
    b+=text(253,375,'Данные А готовы заранее; Б₁ появляется только к шестому интервалу.','mf-small')
    figure('tradeoffs','Предсказуемая доля и динамическое использование выхода',
            'Вверху позиции выхода поочерёдно закреплены за А и Б. А передаёт четыре блока, а Б — один в шестой позиции; три позиции Б пустуют. Внизу общий выход передаёт готовые блоки А раньше. Б1 можно передать только после его поступления; ожидание и свободные интервалы определяются входными данными.',b,400,
            'Выделенные доли показаны регулярными позициями; пакетная передача — обслуживанием готовых блоков. Это сравнение распределения выхода, а не полный протокол соединения.')


def queue():
    b=text(30,32,'Один и тот же буфер во время всплеска','mf-heading')
    for row,(t,q,lost) in enumerate([(0,0,0),(10,40,0),(20,40,40)]):
        y=90+row*110
        b+=text(25,y+19,f'{t} мс','mf-bold')
        b+=path(f'M155 {y+4} H332','mf-wire',True)+text(244,y-16,'14 Мбит/с','mf-small','middle')
        b+=rect(346,y-22,360,50,'mf-buffer',0)
        for i in range(4):
            b+=rect(352+i*87,y-16,80,38,'mf-queue-fill' if q else 'mf-vacant',1)
        b+=text(526,y+60,f'{q} / 40 кбит','mf-small','middle')
        b+=path(f'M720 {y+4} H980','mf-wire',True)+text(848,y-16,'10 Мбит/с','mf-small','middle')
        if lost:
            b+=path(f'M315 {y+4} V{y+64} H271','mf-loss',True)+text(180,y+89,'Потеряно ≈ 40 кбит','mf-loss mf-small')
    b+=text(30,447,'Избыток поступления: 4 Мбит/с. Ёмкость буфера: 40 кбит.','mf-small')
    figure('queue','Накопление и переполнение конечного буфера',
            'Три состояния при поступлении 14 Мбит/с и выходе 10 Мбит/с. В начале буфер пуст. Через 10 мс он заполнен до 40 кбит. К 20 мс в нём всё ещё 40 кбит, а ещё примерно 40 кбит потеряны из-за переполнения.',b,475,
            'Здесь выбран буфер 40 кбит. Без ограничения памяти за 20 мс накопилось бы 80 кбит. Четыре секции показывают объём, а не четыре конкретных пакета; расчёт выполнен в приближении непрерывного потока.')


def transport():
    b=text(30,32,'Пакетные потоки внутри оптического транспорта','mf-heading')
    # Nested representation instead of two disconnected lists of roles.
    b+=rect(46,87,950,259,'mf-fiber',35)+text(520,67,'Одно волокно между площадками','mf-heading','middle')
    for i,(flow,label) in enumerate(zip('abc','АБВ')):
        y=128+i*82
        b+=text(78,y+17,'λ'+'₁₂₃'[i],'mf-bold')+path(f'M126 {y+11} H955','mf-wire',True)
        if i==0:
            for j,(pf,pl) in enumerate([('a','А₁'),('b','Б₁'),('a','А₂'),('c','В₁'),('b','Б₂')]):
                b+=packet(197+j*130,y-7,pl,pf,98,36)
        else:
            for j in range(5):b+=packet(197+j*130,y-7,str(j+1),'neutral',98,36)
    b+=guide(198,817,365,'Цифровой поток каждого оптического канала')
    b+=text(30,437,'Верхний канал переносит блоки нескольких абонентов; другие каналы — потоки других узлов.','mf-small')
    figure('transport','Несколько способов объединения на одном пути',
            'Наружная рамка обозначает одно волокно. Внутри три оптических канала λ1, λ2, λ3. В верхнем цифровом потоке чередуются пакеты абонентов А, Б и В. В остальных — условные цифровые позиции других клиентских потоков. Деление потока на блоки и деление оптического спектра применяются одновременно.',b,465,
            'Фрагмент транспорта из начальной схемы: λ₁ несёт агрегированный поток абонентов А, Б и В; другие каналы могут переносить цифровые потоки с временным объединением. Линии λ₁–λ₃ условно разнесены по высоте: все они идут по одному волокну.')


def next_question():
    b=packet(45,92,'?','a',94,52)+path('M150 118 H345','mf-wire',True)+switch(380,118,r=30)
    for y,n in [(48,1),(118,2),(188,3)]:
        b+=path(f'M410 118 H530 L660 {y} H920','mf-unresolved',True)+text(945,y+6,str(n),'mf-bold')
    b+=text(380,192,'Узел','mf-small','middle')+text(705,254,'Как определить нужный выход?','mf-heading','middle')
    figure('next','Блок принят, выход ещё нужно определить',
            'Один блок приходит в узел. Справа три возможных выхода, обозначенных пунктиром. Вопросительный знак внутри блока подчёркивает следующий вопрос: какие сведения позволят определить выход.',b,285,
            'Ресурс передачи уже организован. Следующий вопрос — какие сведения связывают принятый блок с нужным выходом.')


if __name__=='__main__':
    for build in [architecture,multiplexing,methods,statistical,switching,circuits,packets,tradeoffs,queue,transport,next_question]:
        build()
    print('Generated 11 SVG/HTML figures for topic 05.')
