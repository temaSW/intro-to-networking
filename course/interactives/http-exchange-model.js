(function (scope) {
  'use strict';
  function requestFor() {
    return Object.freeze({method: 'GET', url: 'https://temasw.github.io/intro-to-networking/'});
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
  scope.CourseHttpExchange = Object.freeze({requestFor, receive});
})(window);
