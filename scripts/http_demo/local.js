window.CourseHttpLocal = new URL('request', location.href).href;
const post = action => fetch(new URL(action, location.href), {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'});
const heartbeat = setInterval(() => post('heartbeat').catch(() => {}), 10000);
document.querySelector('[data-stop]').addEventListener('click', async () => {
  try {
    await post('stop');
    clearInterval(heartbeat);
    document.body.replaceChildren(Object.assign(document.createElement('p'), {textContent:'Программа завершена. Эту вкладку можно закрыть.'}));
  } catch { document.querySelector('[data-local-status]').textContent = 'Программа уже остановлена или недоступна.'; }
});
