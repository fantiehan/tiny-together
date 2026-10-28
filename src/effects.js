import * as THREE from 'three';

export class Effects {
 constructor(scene) {
  this.scene=scene;this.rings=[];this.particles=[];this.numbers=[];this.max=360;
  this.mesh=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.055,0),new THREE.MeshBasicMaterial({color:0xffffff}),this.max);
  this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.mesh.frustumCulled=false;scene.add(this.mesh);
  this.dummy=new THREE.Object3D();this.color=new THREE.Color();
  this.ringGeo=new THREE.RingGeometry(.9,1,48);this.arcGeo=new THREE.RingGeometry(.76,1,40,1,-Math.PI*.7,Math.PI*1.4);
  // One shared digit atlas avoids a new texture and canvas for every hit.
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=80;const ctx=canvas.getContext('2d');
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 56px system-ui';ctx.lineJoin='round';ctx.lineWidth=8;
  for(let i=0;i<10;i++){ctx.strokeStyle='#49352a';ctx.strokeText(String(i),i*64+32,40);ctx.fillStyle='white';ctx.fillText(String(i),i*64+32,40);}
  this.digitAtlas=new THREE.CanvasTexture(canvas);this.digitAtlas.colorSpace=THREE.SRGBColorSpace;
  this.digitMaterials=[];
  for(let i=0;i<10;i++){const map=this.digitAtlas.clone();map.repeat.set(.1,1);map.offset.x=i*.1;map.needsUpdate=true;this.digitMaterials.push(new THREE.SpriteMaterial({map,transparent:true,depthWrite:false,depthTest:false}));}
 }
 burst(x,y,z,color=0xffcc77,n=10,power=1){for(let i=0;i<n&&this.particles.length<this.max;i++)this.particles.push({x,y,z,vx:(Math.random()-.5)*5*power,vy:(1+Math.random()*4)*power,vz:(Math.random()-.5)*5*power,life:.25+Math.random()*.4,color,floor:Math.max(0,y-.6)});}
 ring(x,z,r,color=0xffc56b,duration=.4,y=0){return this.shape(this.ringGeo,x,y+.07,z,r,color,duration,0);}
 slash(x,y,z,angle,r,color=0xffefc1){return this.shape(this.arcGeo,x,y,z,r,color,.22,-angle+Math.PI/2);}
 shape(geometry,x,y,z,r,color,duration,angle){const mat=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.78,side:THREE.DoubleSide,depthWrite:false});const mesh=new THREE.Mesh(geometry,mat);mesh.rotation.set(-Math.PI/2,0,angle);mesh.position.set(x,y,z);this.scene.add(mesh);this.rings.push({mesh,r,life:duration,max:duration,arc:geometry===this.arcGeo});return mesh;}
 number(x,y,z,amount,critical=false){
  if(this.numbers.length>=22)return;
  const value=String(Math.round(amount)),group=new THREE.Group();group.position.set(x+(Math.random()-.5)*.2,y,z);const size=critical?.42:.31;
  for(let i=0;i<value.length;i++){const base=this.digitMaterials[Number(value[i])],mat=base.clone();mat.color.set(critical?0xffd060:0xfff5dd);const sprite=new THREE.Sprite(mat);sprite.position.x=(i-(value.length-1)/2)*size*.64;sprite.scale.set(size*.8,size,1);group.add(sprite);}
  this.scene.add(group);this.numbers.push({group,life:critical?.8:.6,max:critical?.8:.6});
 }
 update(dt,camera){
  for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;if(p.life<=0){this.particles.splice(i,1);continue;}p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vy-=12*dt;}
  this.particles.forEach((p,i)=>{this.dummy.position.set(p.x,Math.max(p.floor,p.y),p.z);this.dummy.scale.setScalar(Math.min(1.2,p.life*5));this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);this.mesh.setColorAt(i,this.color.set(p.color));});
  this.mesh.count=this.particles.length;this.mesh.instanceMatrix.needsUpdate=true;if(this.mesh.instanceColor)this.mesh.instanceColor.needsUpdate=true;
  for(let i=this.rings.length-1;i>=0;i--){const r=this.rings[i];r.life-=dt;if(r.life<=0){this.scene.remove(r.mesh);r.mesh.material.dispose();this.rings.splice(i,1);continue;}const k=1-r.life/r.max;r.mesh.scale.setScalar(r.r*(r.arc?.86+.14*k:.35+.65*k));r.mesh.material.opacity=.78*(1-k);if(r.arc)r.mesh.rotation.z+=dt*3;}
  for(let i=this.numbers.length-1;i>=0;i--){const n=this.numbers[i];if(camera)n.group.quaternion.copy(camera.quaternion);n.life-=dt;n.group.position.y+=dt*.85;for(const sprite of n.group.children)sprite.material.opacity=Math.min(1,n.life*4);if(n.life<=0){this.scene.remove(n.group);n.group.children.forEach(s=>s.material.dispose());this.numbers.splice(i,1);}}
 }
 clear(){this.particles.length=0;for(const r of this.rings){this.scene.remove(r.mesh);r.mesh.material.dispose();}for(const n of this.numbers){this.scene.remove(n.group);n.group.children.forEach(s=>s.material.dispose());}this.numbers=[];this.rings=[];this.mesh.count=0;}
}
