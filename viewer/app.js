import * as THREE from 'three';
import {OrbitControls} from './vendor/OrbitControls.js';
import {createReferencePlane} from './reference-plane.js';
import {trajectoryPivot,framingRadius,createWellNavigation} from './navigation.js';
import {createProductionController} from './production.js';
import {pickScreenSegments} from './picking.js';
import {createGammaController} from './gamma.js';
import {createSurveyColors} from './survey-colors.js';
import {createDSUController} from './dsu.js';
const $=id=>document.getElementById(id),palette=['#65b9ff','#b79cff','#ffd84d','#ff665e','#a3ff12','#9fadb8'];
const scene=new THREE.Scene();scene.background=new THREE.Color('#071523');
const perspectiveCamera=new THREE.PerspectiveCamera(45,1,1,10000000);const planCamera=new THREE.OrthographicCamera(-1,1,1,-1,.1,10000000);let camera=perspectiveCamera,planActive=false,referenceReady=Promise.resolve();const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));$('canvasHost').appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.1;
const navigation=createWellNavigation(controls,()=>camera);
const root=new THREE.Group();scene.add(root);let grid,manifest,overview,source,epoch=0,selected=null,selectedData=null,highlight=null,overviewLines=[],detail=new Map(),visibleSections=new Set([0,1,2,3,4,5]),lastUpdate=0,busy=false;
const colorFloats=palette.map(c=>new THREE.Color(c));let overviewCounts=[];
let operatorFilter='all';
const reference=createReferencePlane(scene,$('mapLabels'));
const production=createProductionController();
const surveyColors=createSurveyColors({changed:()=>{production.setSurveyColoring(surveyColors.active());renderSelection();syncGammaContext()}});
const gamma=createGammaController(root,{changed:syncGammaContext,focus:bounds=>{if(planActive)setPlanMode(false,bounds);fit(bounds,'side');navigation.begin(150);say('Log radius and color on observed vertical survey branches. Drag to orbit; hover for measured value and depth.');},selectWell:permit=>{const w=manifest?.wells.find(w=>w.permit===permit&&w.branch==='VERT');if(w)select(w);}});
const dsu=createDSUController(root,{focus:bounds=>{if(planActive)setPlanMode(false,bounds);fit(bounds);navigation.begin(150);say('Centered on the selected DSU. Depth interval is approximate.');},say:s=>$('message').textContent=s});
let showcase=null;
if(new URLSearchParams(location.search).has('showcase'))import(new URLSearchParams(location.search).get('showcase')==='tour'?'./tour.js':'./showcase.js').then(({createShowcase})=>{showcase=createShowcase({state:()=>({renderer,scene,camera,controls,navigation,manifest,detail,busy,surveyColors,production,reference,root}),read,fit,clearSelection,referenceReady:()=>referenceReady,hideGrid(){if(grid)grid.visible=false;},hideReference(){reference.setVisible(false);dsu.setVisible(false);if(grid)grid.visible=false;}})});
function syncGammaContext(){const visible=gamma.contextVisible();for(const l of [...overviewLines,...[...detail.values()].flatMap(d=>d.lines)])l.visible=visible;if(highlight)highlight.visible=visible;}

const num=n=>n.toLocaleString('en-US');const say=s=>$('message').textContent=s;
function dispose(obj){obj.traverse(child=>{child.geometry?.dispose();if(Array.isArray(child.material))child.material.forEach(m=>m.dispose());else child.material?.dispose()});obj.removeFromParent()}
function clear(){overviewLines.forEach(dispose);overviewLines=[];for(const a of detail.values())a.lines.forEach(dispose);detail.clear();if(highlight){dispose(highlight);highlight=null}}
async function read(name,json=false){const r=await source(name);return json?JSON.parse(new TextDecoder().decode(r)):r}
function line(positions,colors,ids){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));if(colors)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.computeBoundingSphere();const l=new THREE.LineSegments(g,new THREE.LineBasicMaterial({vertexColors:!!colors,color:colors?0xffffff:0xffffff,transparent:true,opacity:1}));l.userData.ids=ids;root.add(l);return l}
function buildSegments(data,isOverview=false,wells=[]){
  const pos=Array.from({length:6},()=>[]),ids=Array.from({length:6},()=>[]),rows=Array.from({length:6},()=>[]);
  const push=(a,b,sec,id,row)=>{if(!visibleSections.has(sec)||!operatorVisible(id))return;pos[sec].push(...a,...b);ids[sec].push(id);rows[sec].push(row)};
  if(isOverview){for(let i=0;i<data.length;i+=8)push(data.subarray(i,i+3),data.subarray(i+3,i+6),data[i+6],data[i+7],i/8)}
  else for(const w of wells)for(let i=w.offset+1;i<w.offset+w.count;i++){const j=i*4;push(data.subarray(j-4,j-1),data.subarray(j,j+3),data[j+3],w.id,i)}
  return pos.map((p,section)=>{if(!p.length)return null;const l=line(p,null,ids[section]);l.userData.section=section;surveyColors.decorate(l,rows[section],isOverview?null:wells[0].tile);if(section===4)production.decorate(l);return l}).filter(Boolean);
}
function rebuild(){overviewLines.forEach(dispose);overviewLines=buildSegments(overview,true);for(const [key,d] of detail){d.lines.forEach(dispose);d.lines=buildSegments(d.data,false,manifest.wells.filter(w=>w.tile===key))}renderSelection();updateOverview();}
function updateOverview(){const loaded=new Set(detail.keys());for(const l of overviewLines){const id=l.userData.ids,p=l.geometry.attributes.position; // Collapse overview segments replaced by detailed tiles, retaining the originals for unload.
if(!l.userData.original)l.userData.original=p.array.slice();const orig=l.userData.original;for(let i=0;i<id.length;i++){const j=i*6;const hidden=loaded.has(manifest.wells[id[i]].tile);for(let k=0;k<6;k++)p.array[j+k]=hidden?orig[j+(k%3)]:orig[j+k]}p.needsUpdate=true;}emphasizeSelection();syncGammaContext();stats()}
function stats(){const count=overviewLines.reduce((n,l)=>n+l.userData.ids.length,0)+[...detail.values()].reduce((n,d)=>n+d.lines.reduce((v,l)=>v+l.userData.ids.length,0),0);$('renderInfo').textContent=`${num(count)} segments · ${detail.size} detail chunks`;}
function operatorVisible(id){return operatorFilter==='all'||!!surveyColors.operatorModel()?.matches(id,operatorFilter)}
function operatorBounds(){
  if(!manifest)return null;if(operatorFilter==='all')return manifest.bounds;
  const box=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];let count=0;
  for(const w of manifest.wells)if(operatorVisible(w.id)){count++;for(let i=0;i<3;i++){box[i]=Math.min(box[i],w.bounds[i]);box[i+3]=Math.max(box[i+3],w.bounds[i+3])}}
  return count?box:null;
}
function operatorSummary(){
  const model=surveyColors.operatorModel();if(!model||!manifest)return;
  const group=model.groups.find(g=>g.key===operatorFilter),wells=group?.wellCount??new Set(manifest.wells.map(w=>`${w.permit}|${w.api.slice(0,10)}`)).size,branches=group?.branchCount??manifest.wells.length;
  $('operatorFilterSummary').textContent=`${num(wells)} well${wells===1?'':'s'} · ${num(branches)} branch${branches===1?'':'es'}${group?' · '+group.label:' · all operators'}`;
  $('operatorFit').disabled=branches===0;
  document.querySelectorAll('#operatorLegend button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.operator===operatorFilter)));
}
function setOperatorFilter(key){
  const model=surveyColors.operatorModel();if(key!=='all'&&!model?.groups.some(g=>g.key===key))return;
  operatorFilter=key;$('operatorFilter').value=key;
  if(selected&&!operatorVisible(selected.id))clearSelection();
  if(overview)rebuild();const visible=operatorFilter==='all'?null:manifest.wells.filter(w=>operatorVisible(w.id));production.setBranchScope(visible?.map(w=>w.id)??null);gamma.setPermitFilter(visible?.map(w=>w.permit)??null);surveyColors.refresh();operatorSummary();$('results').replaceChildren();
}
function setupOperators(){
  const model=surveyColors.operatorModel(),all=document.createElement('option');all.value='all';all.textContent='All operators';$('operatorFilter').replaceChildren(all);$('operatorLegend').replaceChildren();
  if(!model)return;
  for(const g of model.groups){
    const option=document.createElement('option');option.value=g.key;option.textContent=`${g.label} (${num(g.wellCount)} well${g.wellCount===1?'':'s'})`;$('operatorFilter').append(option);
    if(!g.branchCount)continue;
    const button=document.createElement('button');button.type='button';button.dataset.operator=g.key;button.setAttribute('aria-label',`Show ${g.label}`);button.setAttribute('aria-pressed','false');
    const swatch=document.createElement('i');swatch.style.background=g.color;const name=document.createElement('span');name.textContent=g.label;const count=document.createElement('small');count.textContent=num(g.wellCount);button.append(swatch,name,count);button.onclick=()=>{setOperatorFilter(g.key);surveyColors.setMode('operator')};$('operatorLegend').append(button);
  }
  operatorSummary();
}
$('operatorFilter').onchange=e=>setOperatorFilter(e.target.value);$('operatorAll').onclick=()=>setOperatorFilter('all');$('operatorFit').onclick=()=>{const box=operatorBounds();if(box)fit(box)};
function fit(bounds=manifest.bounds,view='perspective',pivot=null){navigation.reset();if(planActive){fitPlan(bounds,pivot);return}const damping=controls.enableDamping;controls.enableDamping=false;controls.update();const b=bounds,s=root.scale.y,c=pivot?.clone()||new THREE.Vector3((b[0]+b[3])/2,(b[1]+b[4])/2*s,(b[2]+b[5])/2);const radius=framingRadius(b,c,s);const verticalFov=THREE.MathUtils.degToRad(camera.fov),horizontalFov=2*Math.atan(Math.tan(verticalFov/2)*camera.aspect);const d=radius/Math.sin(Math.min(verticalFov,horizontalFov)/2)*1.15;controls.target.copy(c);const direction=view==='top'?new THREE.Vector3(0,1,.00001):view==='side'?new THREE.Vector3(0,0,1):new THREE.Vector3(.65,.42,.75).normalize();camera.position.copy(c).addScaledVector(direction,d);camera.near=Math.max(.5,radius/100000);camera.far=Math.max(10000000,d*10);camera.updateProjectionMatrix();controls.update();controls.enableDamping=damping;lastUpdate=0;}
function canvasAspect(){const el=$('canvasHost');return Math.max(.1,el.clientWidth/Math.max(1,el.clientHeight))}
function fitPlan(b,pivot=null){
  const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
  const cx=pivot?.x??(b[0]+b[3])/2,cz=pivot?.z??(b[2]+b[5])/2,width=Math.max(200,2*Math.max(Math.abs(b[0]-cx),Math.abs(b[3]-cx))),height=Math.max(200,2*Math.max(Math.abs(b[2]-cz),Math.abs(b[5]-cz)));
  const half=Math.max(height/2,width/(2*canvasAspect()))*1.15;
  planCamera.left=-half*canvasAspect();planCamera.right=half*canvasAspect();planCamera.top=half;planCamera.bottom=-half;planCamera.zoom=1;
  const altitude=Math.max(width,height,10000)*2+100000;planCamera.far=Math.max(10000000,altitude+Math.abs(manifest.bounds[1])*8+100000);
  controls.target.set(cx,0,cz);planCamera.position.set(cx,altitude,cz+.001);planCamera.updateProjectionMatrix();controls.update();controls.enableDamping=damping;lastUpdate=0;
}
function planFootprint(){const c=controls.target,halfX=(planCamera.right-planCamera.left)/(2*planCamera.zoom),halfZ=(planCamera.top-planCamera.bottom)/(2*planCamera.zoom);return[c.x-halfX,manifest.bounds[1],c.z-halfZ,c.x+halfX,0,c.z+halfZ]}
function setPlanMode(enabled,bounds){
  if(!manifest)return;
  const nextBounds=bounds||(planActive?planFootprint():manifest.bounds);
  const damping=controls.enableDamping;controls.enableDamping=false;controls.update();
  planActive=enabled;camera=enabled?planCamera:perspectiveCamera;controls.object=camera;
  controls.enableRotate=!enabled;controls.screenSpacePanning=true;
  controls.mouseButtons.LEFT=enabled?THREE.MOUSE.PAN:THREE.MOUSE.ROTATE;
  controls.touches.ONE=enabled?THREE.TOUCH.PAN:THREE.TOUCH.ROTATE;
  controls.update();controls.enableDamping=damping;
  $('top').setAttribute('aria-pressed',String(enabled));$('perspective').setAttribute('aria-pressed',String(!enabled));
  $('mode').textContent=enabled?'PLAN VIEW · NORTH UP':'3D EXPLORER';
  $('navigationHelp').textContent=enabled?'Drag to pan · Scroll to zoom · North up':'Drag to orbit · Right-drag to pan · Scroll to move closer · Double-click to center';
  $('axisReadout').innerHTML=enabled?'N ↑<span>Orthographic plan view</span>':'Reference: TVD 0<span>Plan view: north up</span>';
  perspectiveCamera.aspect=canvasAspect();perspectiveCamera.updateProjectionMatrix();fit(nextBounds);
}
function visibleSpan(){return planActive?(planCamera.top-planCamera.bottom)/planCamera.zoom:camera.position.distanceTo(controls.target)}
function syncReference(){reference.setVisible($('showState').checked);if(grid)grid.visible=!(reference.visible&&reference.bounds)}
async function viewState(){await referenceReady;if(!manifest)return;if(reference.bounds){$('showState').checked=true;syncReference();setPlanMode(true,reference.bounds)}else setPlanMode(true,manifest.bounds)}
async function load(getter){const version=++epoch;operatorFilter='all';dsu.setDataset(null);surveyColors.reset();gamma.setPermitFilter(null);gamma.reset();production.reset();production.setSurveyColoring(false);source=getter;selected=null;clear();manifest=null;overview=null;say('Loading survey paths…');try{const m=await read('manifest.json',true);if(version!==epoch)return;if(m.version!==1||!m.wells?.length)throw Error('Choose a prepared dataset folder containing manifest.json and binary chunks.');manifest=m;dsu.setDataset(m);overview=new Float32Array(await read('overview.bin'));if(version!==epoch)return;if(overview.length%8)throw Error('Invalid overview data');await production.load(async(name,json=false)=>{const buffer=await getter(name);return json?JSON.parse(new TextDecoder().decode(buffer)):buffer},m);if(version!==epoch)return;await surveyColors.load(async(name,json=false)=>{const buffer=await getter(name);return json?JSON.parse(new TextDecoder().decode(buffer)):buffer},m);if(version!==epoch)return;setupOperators();$('source').textContent=m.source+(m.sourceSnapshot?.date?' · '+m.sourceSnapshot.date:'');$('wellCount').textContent=num(m.wells.length);$('stationCount').textContent=num(m.stations);$('quality').textContent=`${m.sourceCRS} · ${num(m.skipped)} skipped records · ${num(m.duplicateMD)} duplicate measured depths removed. Original TVD convention: ${m.tvdSign}.`;overviewCounts=new Array(6).fill(0);for(let i=6;i<overview.length;i+=8)overviewCounts[overview[i]]++;visibleSections=new Set([0,1,2,3,4,5]);$('legend').replaceChildren();m.labels.forEach((label,i)=>{const row=document.createElement('label');row.className='legend-row';row.innerHTML=`<input type="checkbox" checked><i class="swatch" style="background:${palette[i]}"></i><span>${label}</span>`;row.querySelector('input').onchange=e=>{e.target.checked?visibleSections.add(i):visibleSections.delete(i);rebuild()};$('legend').append(row)});$('search').value='';$('results').replaceChildren();clearSelection();showClassifier();$('fitState').disabled=true;$('referenceStatus').textContent='Loading state outline…';referenceReady=reference.setDataset(m).then(()=>{if(epoch!==version)return;$('fitState').disabled=false;$('referenceStatus').textContent='Census 2026 · Williston, Dickinson, Minot, Bismarck';syncReference()}).catch(e=>{if(epoch===version)$('referenceStatus').textContent=e.message});if(grid)dispose(grid);const extent=Math.max(m.bounds[3]-m.bounds[0],m.bounds[5]-m.bounds[2],10000)*1.4;grid=new THREE.GridHelper(extent,20,'#294759','#172d3d');grid.position.set((m.bounds[0]+m.bounds[3])/2,0,(m.bounds[2]+m.bounds[5])/2);scene.add(grid);syncReference();rebuild();fit();say('');lastUpdate=0;gamma.load(m);const requestedColor=new URLSearchParams(location.search).get('color');if(requestedColor)surveyColors.setMode(requestedColor);}catch(e){say('Could not open dataset: '+e.message)}}
async function updateDetail(){if(!manifest||busy)return;busy=true;const version=epoch;try{const center=controls.target,distance=visibleSpan();const candidates=manifest.tiles.map(t=>{const b=t.bounds;const cx=Math.max(b[0],Math.min(center.x,b[3])),cz=Math.max(b[2],Math.min(center.z,b[5]));return {t,d:Math.hypot(cx-center.x,cz-center.z)}}).filter(v=>v.d<distance*.65).sort((a,b)=>a.d-b.d);let total=0;const wanted=new Set();if(selected){wanted.add(selected.tile);total=manifest.tiles.find(t=>t.id===selected.tile).stations}for(const {t} of candidates){if(wanted.has(t.id))continue;if(total+t.stations<=250000 && wanted.size<8){wanted.add(t.id);total+=t.stations}}
for(const [k,d] of detail)if(!wanted.has(k)){d.lines.forEach(dispose);detail.delete(k)}
for(const k of wanted){if(detail.has(k))continue;const t=manifest.tiles.find(v=>v.id===k);const data=new Float32Array(await read(t.file));if(epoch!==version)return;if(data.length!==t.stations*4)throw Error('Incomplete chunk '+t.file);detail.set(k,{data,lines:buildSegments(data,false,manifest.wells.filter(w=>w.tile===k))});try{await surveyColors.tileReady(k)}catch(e){$('surveyColorStatus').textContent=e.message}if(epoch!==version)return;}surveyColors.releaseTiles(new Set([...detail.keys(),selected?.tile]));updateOverview();}catch(e){say('Detail loading failed: '+e.message)}finally{busy=false}}
function showClassifier(){const classifier=manifest?.classifier;const el=$('classifier');if(!classifier){el.textContent='';return}el.textContent=typeof classifier==='string'?classifier:[classifier.name,classifier.version?`v${classifier.version}`:''].filter(Boolean).join(' · ');if(classifier.drillbackMeaning)el.textContent+=`. ${classifier.drillbackMeaning}`;}
function emphasizeSelection(){for(const l of [...overviewLines,...[...detail.values()].flatMap(d=>d.lines)]){const opacity=selected&&selectedData?.length ? .28 : 1;l.material.opacity=opacity;production.syncLine(l,opacity)}}
function renderSelection(){
  if(highlight){dispose(highlight);highlight=null}
  if(!selected||!selectedData)return;
  const w=selected,d=selectedData,positions=[],colors=[],ends=[],endColors=[];
  for(let i=w.offset+1;i<w.offset+w.count;i++){
    const sec=d[i*4+3];if(!visibleSections.has(sec)||(sec===4&&production.ready()))continue;
    positions.push(...d.subarray((i-1)*4,(i-1)*4+3),...d.subarray(i*4,i*4+3));
    const c=surveyColors.stationRGB(sec,w.tile,i,d,w.id);colors.push(...c,...c);
  }
  highlight=new THREE.Group();root.add(highlight);
  if(positions.length){const path=line(positions,colors,[]);path.material.depthTest=false;path.renderOrder=2;highlight.add(path)}
  for(const i of new Set([w.offset,w.offset+w.count-1])){
    const sec=d[i*4+3];if(!visibleSections.has(sec))continue;const c=surveyColors.stationRGB(sec,w.tile,i,d,w.id);ends.push(...d.subarray(i*4,i*4+3));endColors.push(...c);
  }
  if(ends.length){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(ends,3));g.setAttribute('color',new THREE.Float32BufferAttribute(endColors,3));const dots=new THREE.Points(g,new THREE.PointsMaterial({vertexColors:true,size:7,sizeAttenuation:false,depthTest:false}));dots.renderOrder=3;highlight.add(dots)}
  emphasizeSelection();syncGammaContext();
}
function wellScope(w){const siblings=manifest.wells.filter(v=>v.permit===w.permit&&v.api===w.api);const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];for(const branch of siblings)for(let axis=0;axis<3;axis++){bounds[axis]=Math.min(bounds[axis],branch.bounds[axis]);bounds[axis+3]=Math.max(bounds[axis+3],branch.bounds[axis+3])}return{bounds,count:siblings.length}}
async function zoomToSelected(){
  if(!selected)return;
  const w=selected,version=epoch,bounds=wellScope(w).bounds;
  try{
    let data=selectedData||detail.get(w.tile)?.data;
    if(!data)data=new Float32Array(await read(manifest.tiles.find(t=>t.id===w.tile).file));
    if(version!==epoch||selected!==w)return;
    const pivot=trajectoryPivot(data,w,bounds,root.scale.y);
    fit(bounds,'perspective',pivot);navigation.begin(framingRadius(bounds,pivot,root.scale.y)*.015);
    say('Centered on wellbore. Double-click any path to center on that point.');
  }catch(e){say('Could not center on well: '+e.message)}
}
function clearSelection(){selected=null;selectedData=null;production.selection(null);surveyColors.selection(null,null);if(highlight){dispose(highlight);highlight=null}$('selection').innerHTML='<div class="eyebrow">INSPECT A WELL</div><p>Click a path or choose a search result to see its survey details and zoom to it.</p>';$('clearSelection').hidden=true;$('selectedToolbar').hidden=true;emphasizeSelection();}
async function select(w,focus=false){
  if(!w||!operatorVisible(w.id))return;
  selected=w;selectedData=null;gamma.selected(w);renderSelection();emphasizeSelection();const version=epoch;
  $('selection').replaceChildren();const tag=document.createElement('div');tag.className='eyebrow';tag.textContent='SELECTED WELL';const title=document.createElement('h3');title.textContent=`Permit ${w.permit}`;const info=document.createElement('p');info.textContent=`API ${w.api} · ${w.branch}`;
  const scope=wellScope(w),zoom=document.createElement('button');zoom.id='zoomWell';zoom.className='primary zoom-well';zoom.textContent='Zoom to well';zoom.onclick=zoomToSelected;zoom.title=`Center navigation on this wellbore and fit all ${scope.count} survey branch${scope.count===1?'':'es'}.`;$('viewZoomWell').title=zoom.title;
  const dl=document.createElement('dl');for(const [label,value] of [['Stations',num(w.count)],['Max TVD',num(w.maxTVD)+' ft'],['Max MD',num(w.maxMD)+' ft']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd)}
  $('selection').append(tag,title,info,zoom);if(scope.count>1){const scopeNote=document.createElement('p');scopeNote.className='caption';scopeNote.textContent=`Zoom includes all ${num(scope.count)} branches of this well.`;$('selection').append(scopeNote)}$('selection').append(dl);
  const operators=surveyColors.operatorModel();if(operators){const identity=document.createElement('div');identity.className='operator-identity';const raw=document.createElement('strong');raw.textContent=operators.nameForBranch(w.id)||'Operator unavailable';const group=document.createElement('span');group.textContent='Display group: '+(operators.forBranch(w.id)?.label||'Unknown');identity.append(raw,group);$('selection').append(identity)}
  if(Array.isArray(w.drillbackIntervals)){
    const note=document.createElement('p');note.className='classification-note';note.textContent=w.drillbackIntervals.length?`${num(w.drillbackIntervals.length)} drillback candidate interval${w.drillbackIntervals.length===1?'':'s'}.`:'No drillback candidate intervals detected.';$('selection').append(note);
    const reasons=[...new Set(w.drillbackIntervals.map(v=>v.reason).filter(Boolean))];if(reasons.length){const reason=document.createElement('p');reason.className='caption';reason.textContent=reasons.join(' · ');$('selection').append(reason)}
    if(w.drillbackIntervals.length){const caveat=document.createElement('p');caveat.className='caption';caveat.textContent='Geometry-based candidates; these do not confirm redrilling.';$('selection').append(caveat)}
  }
  $('clearSelection').hidden=false;$('selectedToolbar').hidden=false;$('selectedName').textContent=`${w.permit} · ${w.branch}`;
  const productionInfo=document.createElement('div');productionInfo.id='wellProduction';$('selection').append(productionInfo);production.selection(w);const metricInfo=document.createElement('div');metricInfo.id='wellSurveyMetric';$('selection').append(metricInfo);
  try{let d=detail.get(w.tile)?.data;if(!d)d=new Float32Array(await read(manifest.tiles.find(t=>t.id===w.tile).file));if(epoch!==version||selected!==w)return;selectedData=d;try{await surveyColors.ensureTile(w.tile)}catch(e){$('surveyColorStatus').textContent=e.message}if(epoch!==version||selected!==w)return;surveyColors.selection(w,d);renderSelection();if(focus)await zoomToSelected();lastUpdate=0;}catch(e){say('Could not inspect well: '+e.message)}
}
function pickWell(e){
  if(!manifest)return null;
  const rect=renderer.domElement.getBoundingClientRect();
  const gammaHit=gamma.intersection(e,camera,rect);if(gammaHit){const well=manifest.wells.find(w=>w.permit===gammaHit.entry.permit&&w.branch===gammaHit.branch);if(well&&operatorVisible(well.id))return{well,point:gammaHit.point};}
  if(!gamma.contextVisible())return null;
  const objects=[...overviewLines,...[...detail.values()].flatMap(d=>d.lines)];
  const hit=pickScreenSegments(objects,camera,[e.clientX-rect.left,e.clientY-rect.top],rect.width,rect.height,production.pickPixels(),(object,id)=>object.userData.section===4?production.pickPixels(manifest.wells[id]):5);
  return hit?{well:manifest.wells[hit.id],point:hit.point}:null;
}
renderer.domElement.addEventListener('pointermove',e=>gamma.hover(e,camera,renderer.domElement.getBoundingClientRect()));renderer.domElement.addEventListener('pointerleave',()=>{$('gammaHover').hidden=true});
let down;renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>4||e.button!==0)return;if(dsu.pick(e,camera,renderer.domElement.getBoundingClientRect()))return;const hit=pickWell(e);if(hit)select(hit.well)});
renderer.domElement.addEventListener('dblclick',e=>{
  if(e.button!==0||dsu.inspecting())return;const hit=pickWell(e);if(!hit)return;
  select(hit.well);const point=hit.point.clone();if(planActive)point.y=0;
  navigation.centerHere(point);lastUpdate=0;
  say('Navigation centered here. Drag to explore around this point.');
});
$('search').addEventListener('input',()=>{const q=$('search').value.trim().toLowerCase();$('results').replaceChildren();if(!q||!manifest)return;const found=manifest.wells.filter(w=>operatorVisible(w.id)&&`${w.permit} ${w.api} ${w.branch} ${surveyColors.operatorModel()?.nameForBranch(w.id)||''} ${surveyColors.operatorModel()?.forBranch(w.id)?.label||''}`.toLowerCase().includes(q));for(const w of found.slice(0,30)){const b=document.createElement('button');b.textContent=`${w.permit} · ${w.branch} · ${w.api}`;b.onclick=()=>select(w,true);$('results').append(b)}const p=document.createElement('p');p.textContent=found.length?`${num(found.length)} matches${found.length>30?' · showing first 30':''}`:'No matching wells';$('results').prepend(p)});
$('fit').onclick=()=>manifest&&fit(operatorBounds()||manifest.bounds);$('top').onclick=viewState;$('fitState').onclick=viewState;$('showState').onchange=syncReference;$('perspective').onclick=()=>setPlanMode(false,gamma.enabled()?gamma.limits():undefined);$('side').onclick=()=>{if(!manifest)return;if(gamma.enabled()){gamma.focus();return;}if(planActive)setPlanMode(false,selected?.bounds||manifest.bounds);fit(selected?.bounds||operatorBounds()||manifest.bounds,'side')};$('scale').oninput=()=>{const previous=root.scale.y;root.scale.y=+$('scale').value;navigation.rescaleDepth(previous,root.scale.y);$('scaleValue').textContent=$('scale').value+'×';};$('viewZoomWell').onclick=zoomToSelected;$('clearSelection').onclick=clearSelection;$('allSections').onclick=()=>{visibleSections=new Set([0,1,2,3,4,5]);document.querySelectorAll('#legend input').forEach(c=>c.checked=true);if(overview)rebuild()};
async function sample(){await load(async name=>{const r=await fetch('./data/sample/'+name);if(!r.ok)throw Error('Missing '+name);return r.arrayBuffer()})}$('sample').onclick=sample;
$('folder').onchange=e=>{const files=new Map([...e.target.files].map(f=>[f.name,f]));if(!files.has('manifest.json')){say('Choose the converted dataset folder containing manifest.json.');return}load(async name=>{const f=files.get(name);if(!f)throw Error('Missing '+name);return f.arrayBuffer()});e.target.value=''};
new ResizeObserver(()=>{const el=$('canvasHost');renderer.setSize(el.clientWidth,el.clientHeight);perspectiveCamera.aspect=canvasAspect();perspectiveCamera.updateProjectionMatrix();const half=planCamera.top;planCamera.left=-half*canvasAspect();planCamera.right=half*canvasAspect();planCamera.updateProjectionMatrix()}).observe($('canvasHost'));
function animate(t){requestAnimationFrame(animate);controls.update();navigation.update();reference.updateLabels(camera);production.update(t,camera,renderer.domElement.clientWidth,renderer.domElement.clientHeight);showcase?.beforeRender(t);renderer.render(scene,showcase?.camera?.()||camera);showcase?.afterRender(t);if(t-lastUpdate>700){lastUpdate=t;updateDetail()}}requestAnimationFrame(animate);if(new URLSearchParams(location.search).get('dataset')==='full'){load(async name=>{const r=await fetch('../full-dataset/'+name);if(!r.ok)throw Error('Missing '+name);return r.arrayBuffer()})}else if(['cluster','tour'].includes(new URLSearchParams(location.search).get('showcase'))){load(async name=>{const r=await fetch('./data/showcase/'+name);if(!r.ok)throw Error('Missing '+name);return r.arrayBuffer()})}else sample();
