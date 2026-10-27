import {SITE} from './config.js';
import {initAnalytics,track} from './analytics.js';
import {INTERESTS,buildLead,mailtoFor,readAttribution,validateLead} from './lead.js';

const $=id=>document.getElementById(id);
const el=(tag,{dataset={},...props}={},...children)=>{const node=Object.assign(document.createElement(tag),props);Object.assign(node.dataset,dataset);node.append(...children);return node};
initAnalytics(SITE.plausibleDomain);

let attribution={};
try{attribution=JSON.parse(sessionStorage.getItem('bakken-attribution')||'{}')}catch{}
attribution=readAttribution(location.search,attribution);
try{sessionStorage.setItem('bakken-attribution',JSON.stringify(attribution))}catch{}

for(const [key,value] of Object.entries(SITE.snapshot))document.querySelectorAll(`[data-snapshot=${key}]`).forEach(node=>node.textContent=value);
document.querySelectorAll('[data-explorer]').forEach(a=>a.href=SITE.explorerUrl);

// Pricing cards come from config so a price test is a one-line change.
$('plans').replaceChildren(...SITE.plans.map(plan=>el('article',{className:'plan'+(plan.featured?' featured':'')},
  el('h3',{textContent:plan.name}),
  el('p',{className:'price'},el('strong',{textContent:plan.price}),el('span',{textContent:plan.period})),
  el('ul',{},...plan.features.map(f=>el('li',{textContent:f}))),
  el('a',{className:'button'+(plan.featured?' primary':''),textContent:plan.cta,href:plan.href==='explorer'?SITE.explorerUrl:plan.href,dataset:{cta:'plan-'+plan.id,interest:plan.id==='report'?'report':plan.id==='pilot'?'pilot':''}}))));
$('plannedPlans').replaceChildren(...SITE.plannedPlans.map(p=>el('li',{},el('strong',{textContent:p.name}),el('span',{textContent:p.price}),el('small',{textContent:p.note}))));

document.addEventListener('click',event=>{
  const link=event.target.closest('[data-cta]');if(!link)return;
  track('CTA Click',{cta:link.dataset.cta});
  if(link.dataset.interest&&INTERESTS[link.dataset.interest]){$('interest').value=link.dataset.interest;syncArea()}
});

const form=$('requestForm'),status=$('formStatus');
function syncArea(){const needed=['pilot','report'].includes($('interest').value);$('area').required=needed;$('areaHint').textContent=needed?'Required for a pilot or report.':'Optional.'}
$('interest').addEventListener('change',syncArea);syncArea();

function showErrors(errors){
  form.querySelectorAll('.error').forEach(node=>node.textContent='');
  form.querySelectorAll('[aria-invalid]').forEach(node=>node.removeAttribute('aria-invalid'));
  for(const [key,message] of Object.entries(errors)){$(key)?.setAttribute('aria-invalid','true');const slot=$(key+'Error');if(slot)slot.textContent=message}
  const first=Object.keys(errors)[0];if(first)$(first)?.focus();
}

form.addEventListener('submit',async event=>{
  event.preventDefault();
  const values=Object.fromEntries(new FormData(form));
  if(values.website){status.textContent='Thanks — we will be in touch.';return}// honeypot
  const lead=buildLead(values,{attribution,page:location.pathname});
  const errors=validateLead(lead);showErrors(errors);
  if(Object.keys(errors).length){status.textContent='Check the highlighted fields.';return}
  const button=form.querySelector('button[type=submit]');button.disabled=true;status.textContent='Sending…';
  try{
    if(SITE.leadEndpoint){
      const response=await fetch(SITE.leadEndpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(lead)});
      if(!response.ok)throw Error('The request service returned '+response.status+'.');
      form.reset();syncArea();status.textContent='Thanks. We will reply within one business day to schedule a time.';
    }else if(SITE.contactEmail){
      location.href=mailtoFor(lead,SITE.contactEmail);
      status.textContent='Your email app should open with the request filled in. Send it and we will reply to schedule a time.';
    }else throw Error('Requests are not configured on this copy of the site yet.');
    track('Lead Submitted',{interest:lead.interest,role:lead.role,source:attribution.utm_source||attribution.ref||'direct'});
  }catch(error){
    status.textContent=error.message;track('Lead Failed',{interest:lead.interest});
  }finally{button.disabled=false}
});
