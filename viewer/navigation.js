import * as THREE from 'three';

/** Find a point on the selected branch nearest the center of its whole well.
 * Geometry is stored in unscaled feet. The returned point is in displayed
 * world coordinates, with depth exaggeration applied exactly once.
 */
export function trajectoryPivot(data,well,bounds,depthScale){
  const center=new THREE.Vector3((bounds[0]+bounds[3])/2,(bounds[1]+bounds[4])/2*depthScale,(bounds[2]+bounds[5])/2);
  if(!data||well.count<1)return center;
  const at=i=>new THREE.Vector3(data[i*4],data[i*4+1]*depthScale,data[i*4+2]);
  let best=at(well.offset),bestDistance=Infinity;
  const point=new THREE.Vector3(),segment=new THREE.Line3();
  for(let i=well.offset+1;i<well.offset+well.count;i++){
    segment.set(at(i-1),at(i));segment.closestPointToPoint(center,true,point);
    const distance=point.distanceToSquared(center);
    if(distance<bestDistance){bestDistance=distance;best.copy(point)}
  }
  return best;
}

export function framingRadius(bounds,point,depthScale){
  let radius=100;
  for(const x of [bounds[0],bounds[3]])for(const y of [bounds[1]*depthScale,bounds[4]*depthScale])for(const z of [bounds[2],bounds[5]])radius=Math.max(radius,point.distanceTo(new THREE.Vector3(x,y,z)));
  return radius;
}

export function createWellNavigation(controls,getCamera){
  let active=false,minimumRadius=100;
  function flush(){const damping=controls.enableDamping;controls.enableDamping=false;controls.update();controls.enableDamping=damping;}
  return {
    get active(){return active},
    get minimumRadius(){return minimumRadius},
    begin(radius=100){active=true;minimumRadius=THREE.MathUtils.clamp(radius,50,250);controls.panSpeed=1.2;},
    reset(){active=false;controls.panSpeed=1;},
    centerHere(point){
      flush();const camera=getCamera(),offset=camera.position.clone().sub(controls.target);
      controls.target.copy(point);camera.position.copy(point).add(offset);controls.update();
      active=true;controls.panSpeed=1.2;
    },
    rescaleDepth(previous,next){
      if(!active||previous===next||getCamera().isOrthographicCamera)return;
      flush();const ratio=next/previous;controls.target.y*=ratio;getCamera().position.y*=ratio;controls.update();
    },
    update(){
      const camera=getCamera();
      if(!active||!camera.isPerspectiveCamera)return;
      // OrbitControls has already applied wheel/middle-drag/pinch movement.
      // Preserve that complete camera movement. Reposition its collinear target
      // when close, giving the next gesture a useful radius rather than an
      // asymptotically smaller step. Camera orientation does not change.
      const offset=camera.position.clone().sub(controls.target),distance=offset.length();
      if(distance<minimumRadius){
        const forward=distance>1e-8?offset.multiplyScalar(-1/distance):camera.getWorldDirection(new THREE.Vector3());
        controls.target.copy(camera.position).addScaledVector(forward,minimumRadius);
      }
      const near=Math.max(.1,Math.min(25,camera.position.distanceTo(controls.target)/10000));
      if(Math.abs(camera.near-near)>.001){camera.near=near;camera.updateProjectionMatrix()}
    }
  };
}
