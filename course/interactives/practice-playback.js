/** Shared finite animation player. Model time and screen time stay separate. */
export function playback(root,{start=0,end=1000,wallMs=16000,draw}) {
  const play=root.querySelector('[data-play]'),seek=root.querySelector('[data-seek]'),speed=root.querySelector('[data-playback-speed]');
  let time=start,origin=start,running=false,last=null,raf=0;
  const render=()=>{seek.value=time;draw(time);};
  function stop(){running=false;last=null;cancelAnimationFrame(raf);play.textContent=time>=end?'Повторить':time<=origin?'Запустить':'Продолжить';}
  function set(value){stop();time=Math.max(0,Math.min(end,value));render();play.textContent=time>=end?'Повторить':time<=origin?'Запустить':'Продолжить';}
  function tick(now){if(!running)return;if(last!==null)time=Math.min(end,time+(now-last)/wallMs*end*(speed?Number(speed.value):1));last=now;render();if(time>=end){stop();return;}raf=requestAnimationFrame(tick);}
  play.addEventListener('click',()=>{if(running){stop();return;}if(time>=end)time=origin;running=true;last=null;play.textContent='Пауза';raf=requestAnimationFrame(tick);});
  root.querySelector('[data-reset]').addEventListener('click',()=>set(origin));
  seek.addEventListener('input',()=>set(Number(seek.value)));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  return {set,get time(){return time;},reset(value=origin){origin=value;set(value);}};
}
