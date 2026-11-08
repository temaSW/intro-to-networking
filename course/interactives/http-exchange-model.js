(function (scope) {
  'use strict';
  function requestFor(address) {
    let url;
    try { url = new URL(address.trim()); }
    catch { throw new Error('Введите полный адрес, начиная с http:// или https://.'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Нужен адрес http:// или https://.');
    if (url.username || url.password) throw new Error('Введите адрес без имени пользователя и пароля.');
    url.hash = '';
    return Object.freeze({ method: 'GET', url: url.href });
  }
  async function receive(request, signal) {
    if (scope.CourseHttpLocal) {
      const response = await fetch(scope.CourseHttpLocal, {
        method: 'POST', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({url: request.url}), signal
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось выполнить локальный запрос.');
      return data;
    }
    const response = await fetch(request.url, { method: request.method, cache: 'no-store', credentials: 'omit', signal });
    const bytes = new Uint8Array(await response.arrayBuffer());
    const type = response.headers.get('content-type') || 'Не указан';
    const textual = /^(text\/|application\/(?:[\w.+-]*\+)?(?:json|xml|javascript))/i.test(type);
    let decoder;
    try { decoder = new TextDecoder(type.match(/charset\s*=\s*["']?([^\s;"']+)/i)?.[1] || 'utf-8'); }
    catch { decoder = new TextDecoder('utf-8'); }
    return {
      status: response.status,
      type,
      byteLength: bytes.byteLength,
      text: textual ? decoder.decode(bytes) : '',
      textual
    };
  }
  function importCapture(data) {
    if (!data || data.schema !== 'opisis-http-probe-v1' || data.source !== 'github-actions' ||
        !Number.isInteger(data.status) || data.status < 100 || data.status > 599 ||
        typeof data.type !== 'string' || typeof data.text !== 'string' || data.text.length > 300000 ||
        !Number.isInteger(data.byteLength) || data.byteLength < 0 || data.byteLength > 256000 ||
        typeof data.textual !== 'boolean' || typeof data.truncated !== 'boolean' ||
        typeof data.requestedAt !== 'string' || !Number.isFinite(Date.parse(data.requestedAt)) ||
        typeof data.elapsedSeconds !== 'number' || !Number.isFinite(data.elapsedSeconds) || data.elapsedSeconds < 0) {
      throw new Error('Файл не соответствует формату эксперимента HTTP.');
    }
    const request = requestFor(data.request?.url || '');
    if (data.request?.method !== 'GET') throw new Error('Ожидался результат запроса GET.');
    return { request, result: data };
  }
  scope.CourseHttpExchange = Object.freeze({ requestFor, receive, importCapture });
})(window);
