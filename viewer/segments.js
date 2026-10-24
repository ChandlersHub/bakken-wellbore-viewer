// Group station pairs into one typed-array bucket per well section.
// Overview records are 8 floats (start xyz, end xyz, section, branch id); detail tiles are
// 4 floats per station (x, y, z, section) addressed through each well's offset/count.
// Two passes (count, then fill) avoid growing JS arrays with push(...spread).
export const SECTION_COUNT=6;

export function buildSectionSegments(data,{overview=false,wells=[],include=()=>true}={}){
  let total=0;
  if(overview)total=Math.floor(data.length/8);else for(const w of wells)total+=Math.max(0,w.count-1);
  const keep=new Uint8Array(total),counts=new Uint32Array(SECTION_COUNT);
  const accept=(sec,id,k)=>{if(sec>=0&&sec<SECTION_COUNT&&include(sec,id)){keep[k]=sec+1;counts[sec]++}};
  let k=0;
  if(overview)for(let i=0;i+8<=data.length;i+=8,k++)accept(data[i+6],data[i+7],k);
  else for(const w of wells)for(let i=w.offset+1;i<w.offset+w.count;i++,k++)accept(data[i*4+3],w.id,k);
  const out=Array.from(counts,n=>n?{positions:new Float32Array(n*6),ids:new Uint32Array(n),rows:new Uint32Array(n),n:0}:null);
  k=0;
  if(overview){
    for(let i=0;i+8<=data.length;i+=8,k++){
      if(!keep[k])continue;const b=out[keep[k]-1],p=b.n*6;
      for(let j=0;j<6;j++)b.positions[p+j]=data[i+j];
      b.ids[b.n]=data[i+7];b.rows[b.n]=i/8;b.n++;
    }
  }else for(const w of wells)for(let i=w.offset+1;i<w.offset+w.count;i++,k++){
    if(!keep[k])continue;const b=out[keep[k]-1],p=b.n*6,a=(i-1)*4,c=i*4;
    b.positions[p]=data[a];b.positions[p+1]=data[a+1];b.positions[p+2]=data[a+2];
    b.positions[p+3]=data[c];b.positions[p+4]=data[c+1];b.positions[p+5]=data[c+2];
    b.ids[b.n]=w.id;b.rows[b.n]=i;b.n++;
  }
  return out.map(b=>b&&{positions:b.positions,ids:b.ids,rows:b.rows});
}

// Index manifest wells and tiles once per dataset instead of scanning per tile load.
export function indexManifest(manifest){
  const tiles=new Map(manifest.tiles.map(t=>[t.id,t])),wellsByTile=new Map();
  for(const t of manifest.tiles)wellsByTile.set(t.id,[]);
  for(const w of manifest.wells){let list=wellsByTile.get(w.tile);if(!list)wellsByTile.set(w.tile,list=[]);list.push(w)}
  return {tile:id=>tiles.get(id),wellsInTile:id=>wellsByTile.get(id)||[]};
}
