import assert from 'node:assert/strict';
import {buildSectionSegments,indexManifest} from '../viewer/segments.js';

// The previous app.js implementation, kept here as the reference behavior.
function reference(data,isOverview,wells,include){
  const pos=Array.from({length:6},()=>[]),ids=Array.from({length:6},()=>[]),rows=Array.from({length:6},()=>[]);
  const push=(a,b,sec,id,row)=>{if(!include(sec,id))return;pos[sec].push(...a,...b);ids[sec].push(id);rows[sec].push(row)};
  if(isOverview){for(let i=0;i<data.length;i+=8)push(data.subarray(i,i+3),data.subarray(i+3,i+6),data[i+6],data[i+7],i/8)}
  else for(const w of wells)for(let i=w.offset+1;i<w.offset+w.count;i++){const j=i*4;push(data.subarray(j-4,j-1),data.subarray(j,j+3),data[j+3],w.id,i)}
  return pos.map((p,s)=>p.length?{positions:Float32Array.from(p),ids:Uint32Array.from(ids[s]),rows:Uint32Array.from(rows[s])}:null);
}
let seed=7;const random=()=>(seed=(seed*16807)%2147483647)/2147483647;
function tile(wellCount,stations){
  const wells=[],data=new Float32Array(wellCount*stations*4);
  for(let w=0;w<wellCount;w++){wells.push({id:w*3+1,offset:w*stations,count:stations});for(let s=0;s<stations;s++){const j=(w*stations+s)*4;data[j]=random()*1e5;data[j+1]=-random()*1e4;data[j+2]=random()*1e5;data[j+3]=Math.min(5,Math.floor(s/(stations/6)))}}
  return {wells,data};
}
function overview(segments){
  const data=new Float32Array(segments*8);
  for(let i=0;i<segments;i++){for(let k=0;k<6;k++)data[i*8+k]=random()*1e5;data[i*8+6]=Math.floor(random()*6);data[i*8+7]=Math.floor(random()*500)}
  return data;
}
const includes=[()=>true,(sec,id)=>sec!==2&&id%2===1,()=>false];
for(const include of includes){
  const {wells,data}=tile(20,37);
  assert.deepEqual(buildSectionSegments(data,{wells,include}),reference(data,false,wells,include));
  const o=overview(400);
  assert.deepEqual(buildSectionSegments(o,{overview:true,include}),reference(o,true,[],include));
}
// Wells with fewer than two stations contribute nothing.
assert.deepEqual(buildSectionSegments(new Float32Array(4),{wells:[{id:0,offset:0,count:1}]}),[null,null,null,null,null,null]);

const index=indexManifest({tiles:[{id:'a'},{id:'b'}],wells:[{id:0,tile:'a'},{id:1,tile:'b'},{id:2,tile:'a'}]});
assert.deepEqual(index.wellsInTile('a').map(w=>w.id),[0,2]);assert.deepEqual(index.wellsInTile('missing'),[]);assert.equal(index.tile('b').id,'b');

// Timing on a tile near the viewer's 250,000-station budget.
const big=tile(1000,250);const time=f=>{const t=performance.now();f();return performance.now()-t};
const before=time(()=>reference(big.data,false,big.wells,()=>true)),after=time(()=>buildSectionSegments(big.data,{wells:big.wells}));
console.log(`segments ok · 250k stations: previous ${before.toFixed(0)} ms, typed arrays ${after.toFixed(0)} ms`);
