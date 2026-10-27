import {buildShareURL} from './share-url.js';
const $=id=>document.getElementById(id);
const track=(name,props)=>{try{window.plausible?.(name,{props})}catch{}window.dispatchEvent(new CustomEvent('bakken:track',{detail:{name,props}}))};
function currentState(){
  const selection=$('dsuSelection');
  return {color:$('surveyColorMode').value,inventory:$('footageEnabled').checked?$('footageLayer').value:null,scenario:$('footageScenario').value,dsu:selection.childElementCount?selection.getAttribute('data-unit'):null};
}
async function copy(text){
  try{await navigator.clipboard.writeText(text);return true}catch{window.prompt('Copy this link to share the view',text);return false}
}
$('shareView').onclick=async()=>{
  const link=buildShareURL(location.href,currentState()),copied=await copy(link);
  $('message').textContent=copied?'View link copied. Anyone with the same dataset opens this color mode, inventory and DSU.':'';
  track('Share View',{copied});
};
const pilot=$('pilotLink'),target=document.querySelector('meta[name="bakken:pilot-url"]')?.content;
if(target)pilot.href=target;
pilot.onclick=()=>track('CTA Click',{cta:'viewer-pilot'});
