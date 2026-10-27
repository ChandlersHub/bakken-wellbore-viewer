// Pure lead-capture helpers shared by the page and the Node tests.
export const ROLES={mineral:'Mineral / royalty acquisition',landman:'Independent landman',engineer:'Consulting engineer',service:'Oilfield service prospecting',operator:'Operator',other:'Other'};
export const INTERESTS={demo:'15-minute demo',pilot:'Founder pilot',report:'Custom area report',waitlist:'Waitlist for a paid plan'};
const ATTRIBUTION=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','ref'];
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FIELDS={name:120,email:200,company:160,role:20,teamSize:20,area:300,currentTools:300,volume:40,interest:20,notes:2000};

// First-touch attribution: the earliest landing parameters win for the rest of the session.
export function readAttribution(search,stored){
  if(stored&&Object.keys(stored).length)return stored;
  const query=new URLSearchParams(search),found={};
  for(const key of ATTRIBUTION){const value=query.get(key);if(value)found[key]=value.slice(0,120)}
  return found;
}

export function buildLead(values,{attribution={},page='',now=new Date()}={}){
  const lead={};
  for(const [key,limit] of Object.entries(FIELDS))lead[key]=String(values[key]??'').trim().slice(0,limit);
  lead.email=lead.email.toLowerCase();
  return {...lead,attribution,page,submittedAt:now.toISOString()};
}

export function validateLead(lead){
  const errors={};
  if(!lead.name)errors.name='Enter your name.';
  if(!EMAIL.test(lead.email))errors.email='Enter a valid work email.';
  if(!lead.company)errors.company='Enter your company.';
  if(!(lead.role in ROLES))errors.role='Choose the role closest to yours.';
  if(!(lead.interest in INTERESTS))errors.interest='Choose what you would like.';
  if(['pilot','report'].includes(lead.interest)&&!lead.area)errors.area='Name the township, DSU or county you are evaluating.';
  return errors;
}

export function mailtoFor(lead,to){
  const lines=[`Name: ${lead.name}`,`Email: ${lead.email}`,`Company: ${lead.company}`,`Role: ${ROLES[lead.role]||lead.role}`,`Team size: ${lead.teamSize||'—'}`,`Area of interest: ${lead.area||'—'}`,`Current tools: ${lead.currentTools||'—'}`,`Areas evaluated per month: ${lead.volume||'—'}`,'',lead.notes];
  const source=Object.entries(lead.attribution||{}).map(([k,v])=>`${k}=${v}`).join(' ');
  if(source)lines.push('',`Source: ${source}`);
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(`${INTERESTS[lead.interest]||'Request'} · ${lead.company}`)}&body=${encodeURIComponent(lines.join('\n').trim())}`;
}
