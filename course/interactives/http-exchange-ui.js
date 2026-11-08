(function () {
  'use strict';
  const api = window.CourseHttpExchange;
  if (!api) return;
  for (const root of document.querySelectorAll('[data-http-exchange]')) {
    const find = name => root.querySelector(`[data-http="${name}"]`);
    const address = find('address');
    const send = find('send');
    const read = find('read');
    const render = find('render');
    let controller, result, generation = 0;
    function reset() {
      generation++;
      controller?.abort();
      controller = undefined;
      result = undefined;
      address.disabled = false;
      send.disabled = false;
      read.disabled = true;
      render.disabled = true;
      root.setAttribute('aria-busy', 'false');
      for (const name of ['request', 'response', 'preview']) find(name).hidden = true;
      find('source').textContent = '';
      find('page').replaceChildren();
      find('provenance').hidden = true;
      find('status').textContent = 'Укажите адрес. Запрос ещё не отправлен.';
    }
    address.addEventListener('input', reset);
    find('reset').addEventListener('click', reset);
    find('import').addEventListener('change', async event => {
      const file = event.target.files[0];
      reset();
      event.target.value = '';
      if (!file) return;
      const current = generation;
      try {
        if (file.size > 2000000) throw new Error('Файл слишком большой для результата этого эксперимента.');
        const data = api.importCapture(JSON.parse(await file.text()));
        if (generation !== current) return;
        result = data.result;
        address.value = data.request.url;
        address.disabled = true;
        send.disabled = true;
        read.disabled = false;
        find('request').hidden = false;
        find('request-text').textContent = `Действие: GET\nАдрес: ${data.request.url}\nИсполнитель запроса: машина GitHub Actions`;
        find('open').href = data.request.url;
        find('provenance').textContent = `Сохранённый ответ GitHub Actions. Время запроса: ${new Date(result.requestedAt).toLocaleString('ru-RU')}. Выполнение HTTP-запроса: ${result.elapsedSeconds} с; ожидание запуска задания сюда не входит.`;
        find('provenance').hidden = false;
        find('status').textContent = 'Сохранённый ответ загружен. Следующий шаг -- прочитать его.';
      } catch (error) {
        if (generation === current) find('status').textContent = `Не удалось открыть результат. ${error instanceof SyntaxError ? 'Некорректный JSON.' : error.message}`;
      }
    });
    send.addEventListener('click', async () => {
      reset();
      const current = generation;
      let request;
      try { request = api.requestFor(address.value); }
      catch (error) { find('status').textContent = error.message; return; }
      controller = new AbortController();
      address.disabled = true;
      send.disabled = true;
      root.setAttribute('aria-busy', 'true');
      find('request').hidden = false;
      find('request-text').textContent = `Действие: ${request.method}\nАдрес: ${request.url}`;
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
        address.disabled = false;
        find('status').textContent = 'Браузер не смог прочитать ответ. Возможны запрет чтения со стороны сайта (CORS), ограничения безопасности браузера или ошибка сети. Код HTTP неизвестен. Адрес можно открыть в отдельной вкладке по ссылке ниже.';
      } finally {
        if (generation === current) root.setAttribute('aria-busy', 'false');
      }
    });
    read.addEventListener('click', () => {
      if (!result) return;
      find('response').hidden = false;
      find('code').textContent = String(result.status);
      find('type').textContent = result.type;
      find('bytes').textContent = result.byteLength.toLocaleString('ru-RU');
      find('source').textContent = result.textual ? result.text.slice(0, 3000) : 'Бинарное содержимое не отображается как текст.';
      find('source-note').textContent = (!result.textual ? 'Содержимое получено, его тип указан выше.' : result.text.length > 3000 ? 'Первые 3000 символов тела ответа.' : 'Тело ответа целиком.') + (result.truncated ? ' Сохранение было ограничено первыми 256 000 байтами; размер выше относится к сохранённой части.' : '');
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
