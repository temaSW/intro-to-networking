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
  scope.CourseHttpExchange = Object.freeze({ requestFor, receive });
})(window);
