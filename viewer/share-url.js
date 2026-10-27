// Builds a link that reopens the current view through the URL parameters app.js, footage.js and gamma.js already read.
const KEEP=['dataset','showcase','gamma','log'];
export function buildShareURL(href,{color,inventory,scenario,dsu}={}){
  const current=new URL(href),url=new URL(current.origin+current.pathname);
  for(const key of KEEP){const value=current.searchParams.get(key);if(value)url.searchParams.set(key,value)}
  if(color&&color!=='section')url.searchParams.set('color',color);
  if(['dsu','township'].includes(inventory)){url.searchParams.set('inventory',inventory);if(['low','base','high'].includes(scenario))url.searchParams.set('scenario',scenario)}
  if(dsu)url.searchParams.set('dsu',dsu);
  url.searchParams.set('ref','share');
  return url.href;
}
