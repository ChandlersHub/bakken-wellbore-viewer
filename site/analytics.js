// Funnel events go to Plausible when configured and are always re-dispatched as DOM events
// so another analytics tool can subscribe without touching page code.
let ready=false;
export function initAnalytics(domain){
  if(ready||!domain)return;ready=true;
  window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)};
  const script=document.createElement('script');script.defer=true;script.dataset.domain=domain;script.src='https://plausible.io/js/script.js';
  document.head.append(script);
}
export function track(name,props={}){
  try{window.plausible?.(name,{props})}catch{}
  window.dispatchEvent(new CustomEvent('bakken:track',{detail:{name,props}}));
}
