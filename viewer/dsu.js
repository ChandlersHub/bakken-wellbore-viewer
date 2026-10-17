import * as THREE from 'three';
import {prepareDSUs,buildDSUPrisms,dsuScale,dsuColor,dsuValue,zoneInterval,DSU_PALETTES} from './dsu-model.js';

const $=id=>document.getElementById(id),fmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:0});
const MODE_LABELS={acres:'Published spacing acres',remaining:'Remaining wells · saved model',development:'Development · saved model',confidence:'Confidence · saved model',type:'Spacing-unit type'};
const METHODS={local_paired_tops:'Nearby paired Lodgepole and Birdbear tops',local_separate_tops:'Separate nearby Lodgepole and Birdbear controls',lodgepole_plus_800ft:'Nearby Lodgepole top + assumed 800 ft thickness',lateral_minus800_plus200:'Nearest lateral depths −800 / +200 ft',regional_9000_10000:'Regional 9,000–10,000 ft display fallback'};
const metricFmt=n=>Number(n).toLocaleString('en-US',{maximumFractionDigits:1});
export function createDSUController(root,{focus,say}){
  const group=new THREE.Group();group.name='Approximate DSU zones';group.visible=false;root.add(group);
  const raycaster=new THREE.Raycaster();let manifest=null,units=[],displayed=[],metadata=null,mesh=null,edges=null,batch=null,highlight=null,selected=null,generation=0,loading=null,loaded=false;
  let topOffset=0,bottomOffset=0,mode='acres',opacity=.09,filter='all';
  const dispose=o=>{o.geometry?.dispose();o.material?.dispose();o.removeFromParent()};
  function clear(){for(const o of [...group.children])dispose(o);mesh=edges=highlight=null;batch=null;selected=null;displayed=[];$('dsuSelection').replaceChildren();$('dsuOverlaps').replaceChildren()}
  function filtered(){return units.filter(u=>filter==='all'||filter===u.properties.spacingType||(filter==='modeled'&&dsuValue(u,'remaining')!==null)||(filter==='selected'&&u===selected))}
  function bounds(unit){const b=unit.bounds.slice(),[top,bottom]=zoneInterval(unit.properties.zone,topOffset,bottomOffset);b[1]=-bottom;b[4]=-top;return b}
  function legend(){
    const range=dsuScale(units,mode),bar=$('dsuColorbar');bar.style.background=mode==='type'?'linear-gradient(90deg,#70c5e8 50%,#cda3ff 50%)':`linear-gradient(90deg,${DSU_PALETTES[mode].join(',')})`;
    $('dsuLegend').textContent=mode==='type'?'Blue: spacing (SPC) · Purple: drilling (DRL)':`${fmt(range[0])} — ${fmt(range[1])}${mode==='acres'?' acres · upper colors capped at 98th percentile':mode==='remaining'?' modeled wells':mode==='confidence'?' score / 100':' %'}`;
    $('dsuModelNote').hidden=['acres','type'].includes(mode);
    if(metadata?.inventoryScenario){const inv=metadata.inventoryScenario;$('dsuModelNote').textContent=`Historical Bakken Forward scenario · ${inv.asOf||'2026-09-12'} · GIS ${inv.sourceGISDate||'2026-09-07'}. ${fmt(inv.counts?.available??0)} matched records have estimates. Gray = unmatched, under review, or unavailable. Estimates have not been recalculated for current DSUs.`}
    else $('dsuModelNote').textContent='No saved inventory model is included with this DSU file. Gray means unavailable.';
  }
  function status(){if(loaded)$('dsuStatus').textContent=`${fmt(displayed.length)} of ${fmt(units.length)} DSU records · DMR ${metadata?.retrievedAtUTC?.slice(0,10)||''}. Overlapping units remain separate.`}
  function render(){
    if(!loaded)return;
    const previous=selected,next=filtered();clear();displayed=next;
    batch=buildDSUPrisms(displayed,{topOffset,bottomOffset,mode,range:dsuScale(units,mode)});
    mesh=new THREE.Mesh(batch.geometry,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false}));mesh.renderOrder=-8;group.add(mesh);
    edges=new THREE.LineSegments(batch.edgeGeometry,new THREE.LineBasicMaterial({vertexColors:true,transparent:true,opacity:Math.min(.65,opacity*3),depthWrite:false}));edges.renderOrder=-7;group.add(edges);
    if(previous&&displayed.includes(previous))select(previous);legend();status();
  }
  function recolor(){
    if(!batch)return;
    const range=dsuScale(units,mode),colors=mesh.geometry.attributes.color,edgeColors=edges.geometry.attributes.color;
    displayed.forEach((unit,i)=>{const c=dsuColor(unit,mode,range),r=batch.ranges[i];for(let v=r.start;v<r.end;v++)colors.setXYZ(v,c.r,c.g,c.b);for(let v=r.edgeStart;v<r.edgeEnd;v++)edgeColors.setXYZ(v,c.r,c.g,c.b)});
    colors.needsUpdate=true;edgeColors.needsUpdate=true;legend();
  }
  function select(unit){
    selected=unit;if(highlight){dispose(highlight);highlight=null}
    const index=displayed.indexOf(unit);if(index<0)return;
    const r=batch.ranges[index],vertices=edges.geometry.attributes.position.array.slice(r.edgeStart*3,r.edgeEnd*3),g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(vertices,3));
    highlight=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:.95,depthTest:false}));highlight.renderOrder=4;group.add(highlight);
    const host=$('dsuSelection');host.replaceChildren();const tag=document.createElement('div');tag.className='eyebrow';tag.textContent='SELECTED DSU';const title=document.createElement('h3');title.textContent=unit.properties.label;
    const zoom=document.createElement('button');zoom.className='primary';zoom.textContent='Zoom to DSU';zoom.onclick=()=>focus(bounds(unit));
    const isolate=document.createElement('button');isolate.textContent=filter==='selected'?'Show all DSUs':'Show only this DSU';isolate.onclick=()=>{filter=filter==='selected'?'all':'selected';$('dsuFilter').value=filter;render();results()};
    const p=unit.properties,[top,bottom]=zoneInterval(p.zone,topOffset,bottomOffset),dl=document.createElement('dl');
    for(const [label,value] of [['Published acres',fmt(p.acres)],['Type',p.spacingType||'Unavailable'],['Case',p.caseNo??'Not supplied'],['Order',p.orderNo??'Not supplied'],['Display upper TVD',fmt(top)+' ft'],['Display lower TVD',fmt(bottom)+' ft']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd)}
    const zone=p.zone,note=document.createElement('p');note.className='caption';note.textContent=`Approximate zone. ${METHODS[zone?.method]||zone?.method||'Regional display fallback'}. Birdbear top is a proxy for the Three Forks base. ${zone?.sourceDate?'Controls: '+zone.sourceDate+'. ':''}${Number.isFinite(zone?.nearestKm)?`${zone.nSamples} control${zone.nSamples===1?'':'s'} · ${metricFmt(zone.nearestKm)}–${metricFmt(zone.furthestKm)} km away. `:''}Depths are provisional TVD below each well’s reference; elevations are not applied. Published orders control the legal interval.`;
    host.append(tag,title,zoom,isolate,dl,note);
    if(!['acres','type'].includes(mode)){const metric=document.createElement('p');metric.className='caption';const v=dsuValue(unit,mode);metric.textContent=`${MODE_LABELS[mode]}: ${v===null?'unavailable / review':metricFmt(v)+(mode==='remaining'?'':mode==='confidence'?' / 100':'%')}. Scenario: 2026-09-12.`;host.append(metric)}
    const id=document.createElement('small');id.className='caption';id.textContent='Record '+p.sourceRecord+' · '+unit.id;host.append(id);
  }
  function results(){
    const host=$('dsuResults');host.replaceChildren();const query=$('dsuSearch').value.trim().toLowerCase();if(!query||!loaded)return;
    const matches=displayed.filter(u=>{const p=u.properties;return `${p.caseNo??''} ${p.orderNo??''} ${p.referenceCode??''} ${p.label} ${p.id}`.toLowerCase().includes(query)});
    const count=document.createElement('p');count.className='caption';count.textContent=`${fmt(matches.length)} matches${matches.length>20?' · first 20 shown':''}`;host.append(count);
    for(const unit of matches.slice(0,20)){const b=document.createElement('button');b.textContent=`${unit.properties.label} · Case ${unit.properties.caseNo??'—'} · Order ${unit.properties.orderNo??'—'} · #${unit.properties.sourceRecord}`;b.onclick=()=>{select(unit);focus(bounds(unit))};host.append(b)}
  }
  async function ensureLoaded(){
    if(loaded||!manifest)return;
    if(loading)return loading;
    const version=generation,m=manifest;$('dsuStatus').textContent='Loading published DSU footprints and approximate depth intervals…';
    const pending=(async()=>{try{
      const r=await fetch(new URL('./data/dsu/drilling-spacing-units.geojson',import.meta.url));if(!r.ok)throw Error('DSU file not installed. Prepare the public DMR DSU ZIP with the included importer.');const data=await r.json();if(version!==generation)return;
      const prepared=prepareDSUs(data,m);if(version!==generation)return;units=prepared;metadata=data.metadata;loaded=true;render();
    }catch(e){if(version===generation){$('dsuStatus').textContent=e.message;$('dsuEnabled').checked=false;group.visible=false;$('dsuDetails').hidden=true}}
    finally{if(loading===pending)loading=null}})();loading=pending;return pending;
  }
  async function setVisible(value){$('dsuEnabled').checked=value;group.visible=value;$('dsuDetails').hidden=!value;if(!value){$('dsuInspect').checked=false;return}await ensureLoaded()}
  $('dsuEnabled').onchange=e=>setVisible(e.target.checked);
  $('dsuColor').onchange=e=>{mode=e.target.value;recolor();if(selected)select(selected)};
  $('dsuFilter').onchange=e=>{filter=e.target.value;render();results()};
  $('dsuOpacity').oninput=e=>{opacity=+e.target.value/100;$('dsuOpacityValue').textContent=e.target.value+'%';if(mesh)mesh.material.opacity=opacity;if(edges)edges.material.opacity=Math.min(.65,opacity*3)};
  $('dsuApplyDepth').onclick=()=>{
    const top=Number($('dsuTopOffset').value),bottom=Number($('dsuBottomOffset').value);try{if(!$('dsuTopOffset').value.trim()||!$('dsuBottomOffset').value.trim()||!Number.isFinite(top)||!Number.isFinite(bottom))throw Error('Enter both offsets in feet.');for(const unit of units)zoneInterval(unit.properties.zone,top,bottom);topOffset=top;bottomOffset=bottom;$('dsuDepthError').textContent='';render()}catch(e){$('dsuDepthError').textContent=e.message}
  };
  $('dsuResetDepth').onclick=()=>{$('dsuTopOffset').value=$('dsuBottomOffset').value='0';topOffset=bottomOffset=0;$('dsuDepthError').textContent='';render()};
  $('dsuSearch').oninput=results;
  return {
    setVisible,
    setDataset(m){generation++;manifest=m;loading=null;loaded=false;units=[];metadata=null;clear();if(filter==='selected'){filter='all';$('dsuFilter').value='all'}$('dsuResults').replaceChildren();$('dsuSearch').value='';$('dsuStatus').textContent='Published footprints with approximate formation-depth boxes.';if(group.visible)ensureLoaded()},
    inspecting(){return group.visible&&loaded&&$('dsuInspect').checked},
    pick(event,camera,rect){
      if(!this.inspecting()||!mesh)return false;
      group.updateWorldMatrix(true,true);camera.updateMatrixWorld();raycaster.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);
      const seen=new Set(),hits=[];for(const hit of raycaster.intersectObject(mesh,false)){const unit=displayed[batch.owners[hit.faceIndex]];if(unit&&!seen.has(unit.id)){seen.add(unit.id);hits.push(unit)}}
      $('dsuOverlaps').replaceChildren();if(!hits.length){say('No DSU box at this point. Turn off Inspect DSUs to select well paths.');return true}
      select(hits[0]);if(hits.length>1){const label=document.createElement('label');label.className='field';label.textContent=`${hits.length} overlapping DSUs · choose record`;const chooser=document.createElement('select');chooser.setAttribute('aria-label','Overlapping DSU records');hits.forEach((u,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`#${u.properties.sourceRecord} · ${u.properties.acres} ac · Case ${u.properties.caseNo??'—'} · Order ${u.properties.orderNo??'—'}`;chooser.append(o)});chooser.onchange=()=>select(hits[+chooser.value]);$('dsuOverlaps').append(label,chooser)}
      say('DSU selected. Zoom to DSU is in the spacing-unit panel; turn off Inspect DSUs to select wells.');return true;
    }
  };
}
