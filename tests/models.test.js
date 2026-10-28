import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createCharacter,createEnemy,createWeapon} from '../src/models.js';

const ids=['pan','tea','slipper','bubbles','bomb','camera','scarf','train'];
const meshes=root=>{const result=[];root.traverse(o=>{if(o.isMesh)result.push(o);});return result;};
const update=(model,t,speed=1,options={})=>{
  model.userData.animate(t,speed,0,1/60,options);
  model.updateMatrixWorld(true);
  model.userData.body?.skeleton.update();
};

// Weld duplicate UV/normal vertices before counting connected triangle islands.
// A body plus two detached feet would produce three components here.
function connectedIslands(geometry){
  const points=geometry.attributes.position,keys=new Map(),ids=[],parents=[];
  for(let i=0;i<points.count;i++){
    const key=[points.getX(i),points.getY(i),points.getZ(i)].map(v=>Math.round(v*1e5)).join(',');
    if(!keys.has(key)){keys.set(key,parents.length);parents.push(parents.length);}
    ids.push(keys.get(key));
  }
  const find=x=>{while(parents[x]!==x){parents[x]=parents[parents[x]];x=parents[x];}return x;};
  const union=(a,b)=>{parents[find(a)]=find(b);};
  const index=geometry.index;
  const count=index?index.count:points.count;
  for(let i=0;i<count;i+=3){const a=ids[index?index.getX(i):i],b=ids[index?index.getX(i+1):i+1],c=ids[index?index.getX(i+2):i+2];union(a,b);union(b,c);}
  return new Set(parents.map((_,i)=>find(i))).size;
}

for(const kind of ['yier','bubu'])test(`${kind}: 腿实际迈步，连体蒙皮保持单一连续表面与接地`,()=>{
  const character=createCharacter(kind),body=character.userData.body;
  assert.ok(body.isSkinnedMesh,'legs should deform the body rather than merely bobbing the root');
  assert.equal(meshes(character).filter(m=>m.isSkinnedMesh).length,1);
  assert.equal(body.skeleton.bones.length,3);
  assert.equal(connectedIslands(body.geometry),1,'feet and torso must be a connected surface');
  if(kind==='bubu')assert.ok(character.userData.legs.every(bone=>bone.children.length===0),'Bubu must not gain separate dark foot caps');
  const original=body.geometry.attributes.position.array.slice(),point=new THREE.Vector3(),samples=[];
  for(let i=0;i<body.geometry.attributes.position.count;i++)if(body.geometry.attributes.position.getY(i)<.16)samples.push(i);
  const toe=samples.find(i=>body.geometry.attributes.position.getX(i)>.2);
  let minToe=Infinity,maxToe=-Infinity;
  for(let frame=0;frame<100;frame++){
    update(character,frame/60);
    let floor=Infinity;
    for(const i of samples){body.getVertexPosition(i,point);point.applyMatrix4(body.matrixWorld);floor=Math.min(floor,point.y);}
    for(const cap of character.userData.footCaps){
      const positions=cap.geometry.attributes.position;
      for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(cap.matrixWorld);floor=Math.min(floor,point.y);}
    }
    assert.ok(Math.abs(floor)<1e-4,'a planted foot must remain on the floor');
    body.getVertexPosition(toe,point);minToe=Math.min(minToe,point.z);maxToe=Math.max(maxToe,point.z);
  }
  assert.ok(maxToe-minToe>.15,'toe must have a real forward/backward stride');
  assert.deepEqual(body.geometry.attributes.position.array,original,'animation must not mutate shared bind-pose geometry');
  character.userData.dispose();
});

test('短手臂与圆掌为单一连续表面，握持挂点处没有独立手掌或手指球',()=>{
  for(const kind of ['yier','bubu']){
    const character=createCharacter(kind);
    for(const [i,arm] of character.userData.arms.entries()){
      const armMeshes=meshes(arm);
      assert.equal(armMeshes.length,1,'bare arm and palm should share one continuous mesh');
      assert.equal(connectedIslands(armMeshes[0].geometry),1);
      const hand=i===0?character.userData.sockets.leftHand:character.userData.sockets.rightHand;
      assert.equal(hand.parent,arm);
      assert.equal(meshes(hand).length,0,'the equipment socket should not need a separate spherical hand');
    }
    character.userData.dispose();
  }
});

test('左右腿最大步幅时裆部连续皮肤不翻面或夹出中心膜',()=>{
  const character=createCharacter('bubu'),body=character.userData.body,positions=body.geometry.attributes.position;
  const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3(),normal=new THREE.Vector3(),posed=new THREE.Vector3();
  const baseNormals=[];
  for(let i=0;i<positions.count;i+=3){
    a.fromBufferAttribute(positions,i);b.fromBufferAttribute(positions,i+1);c.fromBufferAttribute(positions,i+2);
    normal.crossVectors(ab.subVectors(b,a),ac.subVectors(c,a));
    if(normal.lengthSq()>1e-12)baseNormals.push({index:i,normal:normal.clone().normalize()});
  }
  for(const angle of [-.62,-.4,0,.4,.62]){
    character.userData.legs[0].rotation.x=angle;character.userData.legs[1].rotation.x=-angle;
    character.updateMatrixWorld(true);body.skeleton.update();
    for(const triangle of baseNormals){
      body.getVertexPosition(triangle.index,a);body.getVertexPosition(triangle.index+1,b);body.getVertexPosition(triangle.index+2,c);
      posed.crossVectors(ab.subVectors(b,a),ac.subVectors(c,a)).normalize();
      assert.ok(posed.dot(triangle.normal)>0,'skin triangle should preserve its outward orientation during the stride');
    }
  }
  character.userData.dispose();
});

test('装备挂接手掌/收纳/颈部，攻击时更换真实手持武器并保留武器升级缩放',()=>{
  const character=createCharacter('bubu'),tea=createWeapon('tea'),pan=createWeapon('pan'),scarf=createWeapon('scarf');
  pan.scale.setScalar(1.18);
  character.userData.equipWeapon('tea',tea,{slot:0});
  character.userData.equipWeapon('pan',pan,{slot:1});
  character.userData.equipWeapon('scarf',scarf,{slot:2});
  assert.equal(tea.parent.parent,character.userData.sockets.rightHand);
  assert.notEqual(pan.parent.parent,character,'secondary weapons must not float beside the root');
  assert.notEqual(pan.parent.parent,character.userData.sockets.rightHand);
  assert.equal(scarf.parent.parent,character.userData.sockets.neck);
  const release=character.userData.triggerAttack('pan');
  assert.ok(release>=.1&&release<.2,'pan contact should align with the forward swing');
  assert.equal(pan.parent.parent,character.userData.sockets.rightHand);
  assert.notEqual(tea.parent.parent,character.userData.sockets.rightHand);
  assert.deepEqual(pan.scale.toArray(),[1.18,1.18,1.18]);
  character.userData.triggerAttack('scarf');
  assert.equal(scarf.parent.parent,character.userData.sockets.neck);
  character.userData.clearEquipment();
  for(const weapon of [tea,pan,scarf])assert.equal(weapon.parent,null);
  assert.equal(character.userData.equipment.size,0);
  character.userData.dispose();
});

test('全部武器在行走、转向、受击、起跳和落地数百帧后保持有限变换与发射位置',()=>{
  for(const kind of ['yier','bubu']){
    const character=createCharacter(kind);
    let frame=0;
    for(const id of ids){
      character.userData.clearEquipment();character.userData.equipWeapon(id,createWeapon(id));
      character.userData.triggerAttack(id);character.userData.triggerHit(.8);
      for(let i=0;i<40;i++,frame++){
        const airborne=i>=12&&i<27;
        character.rotation.y=frame*.035;
        character.position.y=airborne?.5:0;
        update(character,frame/60,i<33?1:0,{airborne,verticalVelocity:i<20?3:-3,aimYaw:Math.sin(frame*.05)*.5});
        character.traverse(o=>{
          assert.ok(o.position.toArray().every(Number.isFinite),`${kind}/${id}: position`);
          assert.ok(o.quaternion.toArray().every(Number.isFinite),`${kind}/${id}: rotation`);
          assert.ok(o.scale.toArray().every(v=>Number.isFinite(v)&&v>0),`${kind}/${id}: scale`);
        });
        assert.ok(character.userData.body.skeleton.boneMatrices.every(Number.isFinite));
        const muzzle=character.userData.getMuzzlePosition(id);
        assert.ok(muzzle.toArray().every(Number.isFinite));
        assert.ok(muzzle.distanceTo(character.position)<3,'weapon emission point must stay attached to the character');
      }
    }
    character.userData.dispose();
  }
});

test('角色销毁释放独占骨骼纹理，不销毁仍被其他角色使用的几何、材质或贴图',()=>{
  const a=createCharacter('bubu'),b=createCharacter('bubu');
  const sharedGeometry=a.userData.body.geometry,sharedMaterial=a.userData.body.material,sharedTexture=sharedMaterial.roughnessMap;
  assert.equal(sharedGeometry,b.userData.body.geometry);
  assert.equal(sharedMaterial,b.userData.body.material);
  let boneDisposed=0,sharedDisposed=0;
  a.userData.body.skeleton.computeBoneTexture();
  a.userData.body.skeleton.boneTexture.addEventListener('dispose',()=>boneDisposed++);
  const onSharedDispose=()=>sharedDisposed++;
  for(const resource of [sharedGeometry,sharedMaterial,sharedTexture])resource.addEventListener('dispose',onSharedDispose);
  a.userData.dispose();
  assert.equal(boneDisposed,1);
  assert.equal(a.userData.body.skeleton.boneTexture,null);
  assert.equal(sharedDisposed,0);
  update(b,1);
  assert.ok(b.userData.body.skeleton.boneMatrices.every(Number.isFinite));
  for(const resource of [sharedGeometry,sharedMaterial,sharedTexture])resource.removeEventListener('dispose',onSharedDispose);
  b.userData.dispose();
});

test('同类型敌人受击闪白彼此独立，结束后精确恢复原材质',()=>{
  for(const type of ['crumb','runner','shooter','tank','splitter','boss']){
    const a=createEnemy(type),b=createEnemy(type),aMeshes=meshes(a),bMeshes=meshes(b);
    const aOriginal=aMeshes.map(m=>m.material),bOriginal=bMeshes.map(m=>m.material);
    const bColors=bOriginal.map(m=>m.color.getHex());
    a.userData.triggerHit(1);a.userData.triggerAttack(type);a.userData.animate(1/60,1,0,1/60);
    assert.ok(aMeshes.some((m,i)=>m.material!==aOriginal[i]),`${type}: hit should visibly flash`);
    assert.ok(bMeshes.every((m,i)=>m.material===bOriginal[i]),`${type}: sibling material assignment must stay unchanged`);
    assert.deepEqual(bOriginal.map(m=>m.color.getHex()),bColors);
    for(let frame=2;frame<45;frame++)a.userData.animate(frame/60,1,0,1/60);
    assert.ok(aMeshes.every((m,i)=>m.material===aOriginal[i]),`${type}: original materials should be restored`);
  }
});
