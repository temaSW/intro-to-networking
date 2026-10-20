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
    b = rect(163.5, 18, 216, 64, 'mf-enclosure')
    b += text(271.5, 43, 'Настройка MUX', 'mf-bold', 'middle')
    b += text(271.5, 67, 'Назначения ресурса', 'mf-small', 'middle')
    b += rect(660.5, 18, 216, 64, 'mf-enclosure')
    b += text(768.5, 43, 'Настройка DEMUX', 'mf-bold', 'middle')
    b += text(768.5, 67, 'Те же назначения', 'mf-small', 'middle')
    b += path('M271.5 82 V157', 'mf-control', True)
    b += path('M768.5 82 V157', 'mf-control', True)
    b += text(520, 104, 'Управляющие входы', 'mf-small', 'middle')
    b += '<g transform="translate(0 100)">'
    for i,(flow,label) in enumerate(zip('abc','АБВ')):
        y=92+i*90
        b+=text(30,y+6,label,f'mf-{flow} mf-bold')+path(f'M75 {y} H245',f'mf-route mf-{flow}',True)
        b+=packet(112,y-14,label+'₁',flow)
        b+=path(f'M795 {y} H983',f'mf-route mf-{flow}',True)+text(1004,y+6,label,f'mf-{flow} mf-bold','middle')
    b+=path('M250 57 H293 L360 146 V218 L293 307 H250 Z','mf-device')
    b+=path('M790 57 H747 L680 146 V218 L747 307 H790 Z','mf-device')
    b+=text(290,187,'MUX','mf-bold','middle')+text(751,187,'DEMUX','mf-bold','middle')
    b+=rect(363,142,314,80,'mf-medium',15)
    for dy,flow,label in [(-24,'a','А'),(0,'b','Б'),(24,'c','В')]:
        b+=path(f'M366 {182+dy} H674',f'mf-route mf-{flow}',True)+text(516,176+dy,label,f'mf-{flow} mf-small','middle')
    b+=text(515,117,'Одна общая линия','mf-heading','middle')
    b+=text(292,345,'Мультиплексор','mf-heading','middle')+text(750,345,'Демультиплексор','mf-heading','middle')
    b+=text(515,270,'Согласованное правило разделения','mf-small','middle')
    b += '</g>'
    figure('multiplexing','MUX и DEMUX с согласованными управляющими входами',
            'Три отдельных входа А, Б, В приходят к мультиплексору MUX, проходят общую линию и разделяются демультиплексором DEMUX обратно на А, Б, В. Сверху в оба устройства поступают согласованные настройки распределения ресурса; управляющие входы обозначены пунктиром. Цветные линии внутри общей среды обозначают различимые потоки, а не три физических провода.',b,475,
            'MUX -- мультиплексор, DEMUX -- демультиплексор. Сплошные стрелки показывают передачу данных, пунктирные -- управляющие входы: настройки полос, временных позиций или длин волн. Назначения на обоих концах согласованы. Цветные трассы внутри общей линии обозначают потоки.')


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
    b+=text(125,320,'Свободен','mf-small','middle')+text(521,281,'Ресурс закреплён за соединением','mf-small','middle')+text(521,312,'Непрерывная передача','mf-small','middle')+text(919,320,'Свободен','mf-small','middle')
    b+=text(215,385,'Установление','mf-small','middle')+text(828,385,'Освобождение','mf-small','middle')
    b+=path('M217 329 H826','mf-reservation-data')
    b+=text(997,413,'Время t','mf-small','end')
    figure('circuits','Выделенное соединение: путь и резервирование ресурса',
            'Сверху абоненты соединены через три узла; выделенный путь занимает ресурс на каждом участке. Снизу временная полоса: до установления ресурс свободен, после установления закреплён, после освобождения снова свободен. В пределах установленного соединения показана непрерывная передача данных по заранее выделенному ресурсу.',b,440,
            'Светлая полоса показывает резервирование ресурса от установления до освобождения соединения; сплошная линия внутри -- непрерывную передачу данных. Масштаб времени условный.')


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
    words = {('a', 0): '00110110', ('a', 1): '00111001', ('b', 0): '01010010',
             ('c', 0): '01100011', ('c', 1): '01100101',
             ('a', 2): '00111100', ('c', 2): '01101000'}

    def sample(x, y, flow, label, cycle):
        body = rect(x, y, 78, 58, f'mf-packet mf-{flow}' + (' mf-idle-channel' if flow == 'b' and cycle >= 1 else ''))
        if flow == 'b' and cycle >= 1:
            return body + text(x+39, y+22, 'пауза Б', 'mf-small', 'middle') + text(x+39, y+46, 'нет данных', 'mf-small', 'middle')
        return body + text(x+39, y+22, label + '₁₂₃'[cycle], 'mf-packet-label', 'middle') + text(x+39, y+46, words[(flow, cycle)], 'mf-bits', 'middle')

    def data_packet(x, y, w, label, flow, h=38):
        header = w * 24 / 92
        return (rect(x, y, w, h, f'mf-packet mf-{flow}') + rect(x, y, header, h, 'mf-packet-header', 0)
                + text(x+header/2, y+h/2+5, 'З', 'mf-packet-label', 'middle')
                + text(x+header+(w-header)/2, y+h/2+5, label, 'mf-packet-label', 'middle'))

    b = text(28, 32, 'Временная коммутация каналов: вход → выход', 'mf-heading')
    b += text(28, 61, 'Пример с памятью: входной цикл записывается, в следующем цикле данные передаются в тех же КИ.', 'mf-small')
    left, step = 260, 82
    for cycle in range(3):
        x = left + cycle*3*step
        b += text(x+122, 90, ['Цикл n', 'Цикл n + 1', 'Цикл n + 2'][cycle], 'mf-bold', 'middle')
        for slot in range(3):
            b += text(x+slot*step+39, 116, f'КИ{slot+1}', 'mf-small', 'middle')
        b += path(f'M{x} 122 V348', 'mf-time-guide')
    b += text(28, 161, 'Входной поток', 'mf-heading')
    b += text(28, 185, 'КИ1: А, КИ2: Б, КИ3: В', 'mf-small')
    b += path('M260 166 H998', 'mf-guide')
    b += text(28, 291, 'Выходной поток', 'mf-heading')
    b += text(28, 315, 'КИ1: А, КИ2: Б, КИ3: В', 'mf-small')
    b += path('M260 296 H998', 'mf-guide')
    for cycle in range(3):
        for slot, (flow, label) in enumerate([('a', 'А'), ('b', 'Б'), ('c', 'В')]):
            b += sample(left+(cycle*3+slot)*step, 137, flow, label, cycle)
    for cycle in range(2):
        for slot, (flow, label) in enumerate([('a', 'А'), ('b', 'Б'), ('c', 'В')]):
            b += sample(left+((cycle+1)*3+slot)*step, 267, flow, label, cycle)
    b += rect(260, 267, 242, 58, 'mf-enclosure')
    b += text(381, 302, 'Предыдущие данные', 'mf-small', 'middle')
    b += path('M299 195 V224 H545 V267', 'mf-route mf-a', True)
    b += text(422, 215, 'А₁: вход КИ1 → выход КИ1', 'mf-small', 'middle')
    b += path('M260 348 H1006', 'mf-axis', True)
    for t in range(10):
        b += text(260+t*82, 371, str(t), 'mf-small', 'middle')
    b += text(1000, 397, 'Время, усл. ед.', 'mf-small', 'end')
    b += text(28, 420, 'В интервале 7–8 -- пауза Б: его КИ2 нельзя отдать готовым данным В.', 'mf-small')
    b += path('M28 440 H1010', 'mf-divider')

    b += text(28, 475, 'Коммутация пакетов: три входа → общий выход', 'mf-heading')
    b += text(28, 504, 'Потоки приходят по отдельным линиям; моменты готовности пакетов сохранены.', 'mf-small')
    x = lambda t: 260 + 82*t
    for t in range(10):
        b += path(f'M{x(t)} 520 V818', 'mf-time-guide')
        b += text(x(t), 844, str(t), 'mf-small', 'middle')
    input_rows = {'a': 530, 'b': 588, 'c': 646}
    for flow, label in [('a', 'А'), ('b', 'Б'), ('c', 'В')]:
        y = input_rows[flow]
        b += text(28, y+25, 'Вход ' + label, 'mf-heading')
        b += path(f'M260 {y+20} H998', 'mf-guide')
    b += text(28, 787, 'Общий выход', 'mf-heading')
    b += path('M260 780 H998', 'mf-guide')
    arrivals = []
    for cycle in range(3):
        for slot, (flow, label) in enumerate([('a', 'А'), ('b', 'Б'), ('c', 'В')]):
            begin = cycle*3 + slot
            if flow == 'b' and cycle >= 1:
                continue
            name = label + '₁₂₃'[cycle]
            b += data_packet(x(begin), input_rows[flow], 78, name, flow)
            arrivals.append((begin+1, name, flow))
    b += rect(260, 760, 242, 38, 'mf-enclosure')
    b += text(381, 784, 'Предыдущие данные', 'mf-small', 'middle')
    # Both outputs are busy with preceding traffic until t=3.
    # FIFO consumes the backlog continuously; the final В₃ arrives at the right boundary.
    free_at = 3
    for ready, name, flow in sorted(arrivals):
        start = max(ready, free_at)
        free_at = start + 1
        if free_at > 9:
            continue
        b += data_packet(x(start), 760, 78, name, flow)
    b += path('M752 684 V710 H834 V760', 'mf-route mf-c', True)
    b += text(720, 701, 'В₂ уже готов и ждёт в буфере', 'mf-small', 'end')
    b += path('M260 818 H1006', 'mf-axis', True)
    b += text(1000, 870, 'Время, усл. ед.', 'mf-small', 'end')
    b += text(28, 897, 'В интервале 7–8 передаётся В₂: пустой позиции Б на выходе нет, поскольку в буфере есть пакет.', 'mf-small')
    b += path('M28 918 H1010', 'mf-divider')
    b += text(28, 950, 'Что находится внутри пакета А₁?', 'mf-heading')
    b += rect(28, 970, 250, 70, 'mf-packet-header', 3)
    b += text(153, 996, 'З -- заголовок', 'mf-bold', 'middle')
    b += text(153, 1022, 'Адрес и служебные сведения', 'mf-small', 'middle')
    b += rect(278, 970, 732, 70, 'mf-packet mf-a', 0)
    b += text(644, 994, 'Данные: последовательные блоки данных А', 'mf-small', 'middle')
    for i, word in enumerate(['00110110', '00111001', '00111100', '00111010']):
        b += text(368+i*180, 1025, word, 'mf-bits', 'middle')
    figure('tradeoffs', 'Одинаковое поступление данных: канальные позиции и готовые пакеты',
           'В обоих примерах данные становятся готовы в одном порядке: А1, Б1, В1, А2, В2, А3, В3. Пакеты поступают по отдельным входам А, Б, В. '
           'До момента 3 оба выхода заняты предыдущими данными. Канальный выход затем передаёт А1, Б1, В1, А2, паузу Б, В2. '
           'Пакетный выход передаёт А1, Б1, В1, А2, В2, А3 без паузы: пакет А3 уже поступил к моменту 7. '
           'Пакет В3 полностью поступает в момент 9 и остаётся для следующей передачи.', b, 1062,
           'КИ -- канальный интервал. Оба примера имеют одинаковый порядок и моменты готовности данных, а выход освобождается от предыдущего трафика в момент 3. '
           'Сверху узел записывает цикл целиком и передаёт его данные в тех же КИ следующего цикла. Снизу пакеты поступают по трём отдельным входам; общий выход передаёт их в порядке полного поступления. '
           'В интервале 7–8 канальный выход сохраняет пустую позицию Б, а пакетный передаёт готовый В₂. '
           'При пустом буфере пакетный выход тоже простаивал бы. Масштаб времени в каждом примере условный; размеры канального блока, пакета и заголовка не приравниваются.')


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
