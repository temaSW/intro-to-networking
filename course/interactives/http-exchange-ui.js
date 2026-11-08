(function () {
  'use strict';
  const api = window.CourseHttpExchange;
  if (!api) return;
  for (const root of document.querySelectorAll('[data-http-exchange]')) {
    const find = name => root.querySelector(`[data-http="${name}"]`);
    const send = find('send');
    const read = find('read');
    const render = find('render');
    let controller, result, generation = 0;
    function reset() {
      generation++;
      controller?.abort();
      controller = undefined;
      result = undefined;
      send.disabled = false;
      read.disabled = true;
      render.disabled = true;
      root.setAttribute('aria-busy', 'false');
      for (const name of ['request', 'response', 'preview']) find(name).hidden = true;
      find('source').textContent = '';
      find('page').replaceChildren();
      find('status').textContent = 'Запрос главной страницы курса ещё не отправлен.';
    }
    find('reset').addEventListener('click', reset);
    send.addEventListener('click', async () => {
      reset();
      const current = generation;
      const request = api.requestFor();
      controller = new AbortController();
      send.disabled = true;
      root.setAttribute('aria-busy', 'true');
      find('request').hidden = false;
      const url = new URL(request.url);
      const target = url.pathname + url.search;
      find('method').textContent = request.method;
      find('host').textContent = url.host;
      find('target').textContent = target;
      find('request-text').textContent = `${request.method} ${target} HTTP/1.1\nHost: ${url.host}\n\n`;
      find('open').href = request.url;
      find('status').textContent = 'Браузер отправляет запрос и ожидает ответ…';
      try {
        const received = await api.receive(request, controller.signal);
        if (generation !== current) return;
        result = received;
        read.disabled = false;
        find('status').textContent = 'Ответ получен. Следующий шаг -- прочитать его.';
      } catch (error) {
        if (generation !== current || error.name === 'AbortError') return;
        result = undefined;
        send.disabled = false;
        find('status').textContent = 'Не удалось получить ответ сайта курса. Проверьте подключение к Интернету и повторите запрос.';
      } finally {
        if (generation === current) root.setAttribute('aria-busy', 'false');
      }
    });
    read.addEventListener('click', () => {
      if (!result) return;
      find('response').hidden = false;
      find('code').textContent = String(result.status);
      find('code-meaning').textContent = result.status === 200
        ? 'Запрос выполнен успешно: сервер вернул содержимое страницы.'
        : result.status === 404 ? 'Запрошенный ресурс не найден либо сервер не раскрывает его существование.'
        : result.status >= 500 ? 'Сервер сообщил об ошибке при обработке запроса.'
        : result.status >= 400 ? 'Сервер не выполнил запрос; причина уточняется кодом ответа.'
        : 'Сервер сообщил результат обращения этим кодом.';
      find('type').textContent = result.type;
      find('bytes').textContent = result.byteLength.toLocaleString('ru-RU');
      find('source').textContent = result.textual ? result.text.slice(0, 3000) : 'Бинарное содержимое не отображается как текст.';
      find('source-note').textContent = result.text.length > 3000 ? 'Первые 3000 символов тела ответа.' : 'Тело ответа целиком.';
      render.disabled = !/\btext\/html\b/i.test(result.type);
      read.disabled = true;
      find('status').textContent = result.status === 404
        ? 'Сервер ответил: ресурс не найден. Содержимое такого ответа тоже можно прочитать.'
        : /\btext\/html\b/i.test(result.type) ? 'Видны результат обращения и полученное содержимое.' : 'Ответ прочитан. Шаг отображения страницы доступен для HTML; этот ресурс имеет другой тип.';
    });
    render.addEventListener('click', () => {
      if (!result) return;
      const template = document.createElement('template');
      template.innerHTML = result.text;
      const doc = template.content;
      const main = doc.querySelector('main') || doc;
      const fragment = document.createDocumentFragment();
      const heading = document.createElement('h4');
      heading.textContent = main.querySelector('h1')?.textContent.trim() || doc.querySelector('title')?.textContent.trim() || 'Полученный документ';
      fragment.append(heading);
      for (const item of [...main.querySelectorAll('p')].filter(p => p.textContent.trim()).slice(0, 3)) {
        const paragraph = document.createElement('p');
        paragraph.textContent = item.textContent.trim();
        fragment.append(paragraph);
      }
      find('page').replaceChildren(fragment);
      find('preview').hidden = false;
      render.disabled = true;
      find('status').textContent = 'Браузер разобрал тот же полученный HTML. Показаны заголовок и до трёх абзацев; нового запроса для этого шага нет.';
    });
    reset();
  }
})();
