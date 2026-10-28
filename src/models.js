import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { creatureMaterial, flashWhite } from './model-materials.js';

// All characters face local +Z. Reused geometry/materials keep the toy-like
// models inexpensive even when a small crowd is on screen.
const geometries = new Map();
const materials = new Map();
const textures = new Map();
const C = {
  ink: '#482822', white: '#fffaf0', brown: '#cc916c', inner: '#704433',
  pink: '#ffb3ba', cheek: '#ffd182', gold: '#f8c35d', mint: '#82c7ae',
  cream: '#ffe8b0', red: '#ec6f62', blue: '#7ec3cf', purple: '#a990d3',
};

function material(color, extra = {}) {
  const key = color + JSON.stringify(extra);
  if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .67, metalness: .02, ...extra }));
  return materials.get(key);
}
function softToyMaterial(color) {
  return creatureMaterial('plush',color);
}
function printedMaterial(key,background,paint) {
  const cacheKey=`print:${key}`;
  if(!materials.has(cacheKey)) {
    let map=null;
    if(typeof document!=='undefined') {
      const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
      const ctx=canvas.getContext('2d');
      if(ctx) {
        ctx.fillStyle=background;ctx.fillRect(0,0,256,256);paint(ctx);
        map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
        map.anisotropy=2;textures.set(cacheKey,map);
      }
    }
    materials.set(cacheKey,new THREE.MeshStandardMaterial({color:map?'#ffffff':background,map,roughness:.82,metalness:0}));
  }
  return materials.get(cacheKey);
}
// Bake only the static direct children sharing one material. Animation pivots
// stay independent; baked geometry is reused by every subsequent enemy/weapon.
function mergeStatic(parent,key,exclude=new Set()) {
  const batches=new Map();
  for(const child of parent.children)if(child.isMesh&&!exclude.has(child)&&!Array.isArray(child.material)) {
    if(!batches.has(child.material))batches.set(child.material,[]);
    batches.get(child.material).push(child);
  }
  for(const [mat,parts] of batches) {
    if(parts.length<2)continue;
    const mergedKey=`merged:${key}:${mat.uuid}`;
    const geometry=geo(mergedKey,()=>{
      const copies=parts.map(part=>{
        part.updateMatrix();
        const copy=part.geometry.index?part.geometry.toNonIndexed():part.geometry.clone();
        copy.applyMatrix4(part.matrix);return copy;
      });
      const merged=mergeGeometries(copies,false);
      for(const copy of copies)copy.dispose();
      return merged;
    });
    if(!geometry)continue;
    for(const part of parts)parent.remove(part);
    const combined=new THREE.Mesh(geometry,mat);combined.castShadow=true;combined.receiveShadow=true;
    combined.name=`details-${key}`;parent.add(combined);
  }
}
function geo(key, create) {
  if (!geometries.has(key)) geometries.set(key, create());
  return geometries.get(key);
}
const sphereGeo = geo('sphere', () => new THREE.SphereGeometry(1, 16, 12));
const cylinderGeo = geo('cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 20));
const coneGeo = geo('cone', () => new THREE.ConeGeometry(1, 1, 16));
const plainBoxGeo = geo('plain-box', () => new THREE.BoxGeometry(1, 1, 1));
function mesh(parent, geometry, color, pos = [0, 0, 0], scale = [1, 1, 1], extra = {}) {
  const m = new THREE.Mesh(geometry, material(color, extra));
  m.position.set(...pos); m.scale.set(...scale);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m); return m;
}
function ball(p, color, pos, scale, extra = {}) { return mesh(p, sphereGeo, color, pos, scale, extra); }
function box(p, color, pos, size, radius = .08, extra = {}) {
  const key = `round:${size}:${radius}`;
  return mesh(p, geo(key, () => new RoundedBoxGeometry(...size, 3, radius)), color, pos, [1, 1, 1], extra);
}
function cylinder(p, color, pos, radius, height, extra = {}) { return mesh(p, cylinderGeo, color, pos, [radius, height, radius], extra); }
function tube(p, color, points, radius = .015, key = null) {
  const k = key || `tube:${JSON.stringify(points)}:${radius}`;
  const segments=points.length===2?1:Math.min(18,(points.length-1)*3);
  const g = geo(k, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(v => new THREE.Vector3(...v))), segments, radius, radius<.007?4:6, false));
  return mesh(p, g, color);
}
function torus(p, color, pos, radius, thickness, rotation = null, extra = {}) {
  const g = geo(`torus:${radius}:${thickness}`, () => new THREE.TorusGeometry(radius, thickness, 8, 24));
  const m = mesh(p, g, color, pos, [1, 1, 1], extra); if (rotation) m.rotation.set(...rotation); return m;
}

function face(parent, y, z, { width = .3, eye = .038, cheeks = null, angry = false, mouth = true } = {}) {
  const eyes=[];
  for (const side of [-1, 1]) {
    eyes.push(ball(parent, C.ink, [side * width / 2, y, z], [eye, eye * 1.08, eye * .43], {roughness:.24,metalness:0}));
    eyes.push(ball(parent, C.white, [side*width/2-eye*.24,y+eye*.31,z+eye*.39], [eye*.16,eye*.19,eye*.08], {roughness:.35,metalness:0}));
    if (angry) {
      const brow = box(parent, C.ink, [side * width / 2, y + eye * 1.9, z], [eye * 2, .018, .024], .008);
      brow.rotation.z = side * -.24;
    }
    if (cheeks) ball(parent, cheeks, [side * width * .84, y - .07, z - .003], [.085, .067, .014]);
  }
  if (mouth) tube(parent, C.ink, [[-.042,y-.035,z+.009],[-.034,y-.057,z+.015],[-.013,y-.06,z+.019],[0,y-.043,z+.02],[.013,y-.06,z+.019],[.034,y-.057,z+.015],[.042,y-.035,z+.009]], .011);
  return eyes;
}

function bodyGeometry() {
  return geo('character-seamless-body', () => {
    const s = new THREE.Shape();
    // One closed body-and-leg outline. No ankle seams or dark foot caps on Bubu.
    s.moveTo(-.21,.55);
    s.bezierCurveTo(-.31,.53,-.34,.44,-.32,.34);
    s.lineTo(-.3,.11);
    s.bezierCurveTo(-.3,-.025,-.13,-.025,-.1,.055);
    s.lineTo(-.075,.105); s.lineTo(.075,.105); s.lineTo(.1,.055);
    s.bezierCurveTo(.13,-.025,.3,-.025,.3,.11);
    s.lineTo(.32,.34);
    s.bezierCurveTo(.34,.44,.31,.53,.21,.55);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: .26, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .06, bevelThickness: .06, curveSegments: 10 });
    g.translate(0, .06, -.13); return g;
  });
}

function skinnedBody(parent,color) {
  const geometry=geo('character-skinned-body',()=>{
    const g=bodyGeometry().clone(),positions=g.attributes.position,indices=[],weights=[];
    for(let i=0;i<positions.count;i++){
      const y=positions.getY(i),x=positions.getX(i),weight=THREE.MathUtils.smoothstep((.46-y)/.3,0,1);
      indices.push(0,x<0?1:2,0,0);weights.push(1-weight,weight,0,0);
    }
    g.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
    g.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));return g;
  });
  const body=new THREE.SkinnedMesh(geometry,softToyMaterial(color));body.castShadow=body.receiveShadow=true;
  const pelvis=new THREE.Bone(),left=new THREE.Bone(),right=new THREE.Bone();
  left.position.set(-.18,.26,0);right.position.set(.18,.26,0);pelvis.add(left,right);body.add(pelvis);parent.add(body);
  body.bind(new THREE.Skeleton([pelvis,left,right]));
  // The body can be deformed by skinning outside its bind-pose bounding sphere.
  body.frustumCulled=false;
  return {body,legs:[left,right]};
}

const wrapAngle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const damp=(a,b,rate,dt)=>THREE.MathUtils.lerp(a,b,1-Math.exp(-rate*dt));
const ATTACK_TIME={pan:.46,tea:.3,slipper:.42,bubbles:.34,bomb:.46,camera:.46,scarf:.4,train:.5};
const ATTACK_RELEASE={pan:.14,tea:.09,slipper:.14,bubbles:.09,bomb:.14,camera:.13,scarf:.12,train:.14};
const gripPose={
  pan:{p:[0,.25,.025],r:[.05,0,-.42]},tea:{p:[0,.035,.045],r:[.1,0,.08]},
  slipper:{p:[0,.035,.11],r:[-.35,0,0]},bubbles:{p:[0,.11,.055],r:[0,0,0]},
  bomb:{p:[0,.025,.045],r:[0,0,.1]},camera:{p:[-.015,.045,.065],r:[0,0,0]},
  train:{p:[0,.06,.13],r:[0,0,0]},
};

export function createCharacter(kind = 'yier') {
  const isYier=kind==='yier',root=new THREE.Group();root.name=isYier?'一二':'布布';
  const rig=new THREE.Group();root.add(rig);
  const skin=isYier?C.white:C.brown,{body,legs}=skinnedBody(rig,skin);
  const head=new THREE.Group();head.position.y=1.005;rig.add(head);
  box(head,skin,[0,0,0],[.97,.79,.64],.25).material=softToyMaterial(skin);
  for(const side of [-1,1]){
    ball(head,isYier?C.ink:skin,[side*.365,.34,-.015],[.135,.145,.108]).material=softToyMaterial(isYier?C.ink:skin);
    if(!isYier){
      ball(head,'#dfad88',[side*.365,.347,.077],[.092,.102,.024]).material=softToyMaterial('#dfad88');
      ball(head,C.inner,[side*.365,.347,.095],[.069,.079,.017],{roughness:.8});
    }
  }
  const eyes=face(head,-.063,.324,{width:.315,eye:.039,cheeks:isYier?C.pink:C.cheek});
  const eyeScales=eyes.map(eye=>eye.scale.y),arms=[],hands=[];
  for(const side of [-1,1]){
    const pivot=new THREE.Group();pivot.position.set(side*.255,.53,0);rig.add(pivot);
    const arm=ball(pivot,skin,[side*.073,-.1,.015],[.105,.17,.12]);arm.material=softToyMaterial(skin);arm.rotation.z=side*-.38;
    const hand=new THREE.Group();hand.name=side===1?'right-hand':'left-hand';hand.position.set(side*.083,-.215,.07);pivot.add(hand);
    ball(hand,skin,[0,0,0],[.075,.077,.075]).material=softToyMaterial(skin);
    ball(hand,skin,[-side*.055,.025,.032],[.035,.044,.04]).material=softToyMaterial(skin);
    arms.push(pivot);hands.push(hand);mergeStatic(hand,`hand-${kind}-${side}`);
  }
  if(isYier){
    for(let i=0;i<2;i++)ball(legs[i],C.ink,[i===0?-.025:.025,-.185,.085],[.112,.065,.139]).material=softToyMaterial(C.ink);
    for(const side of [-1,1]){
      const lobe=ball(rig,C.ink,[side*.047,.635,.235],[.062,.043,.025]);lobe.rotation.z=side*.35;
      tube(rig,'#6c4438',[[side*.021,.633,.259],[side*.044,.646,.262],[side*.064,.649,.256]],.0045);
      tube(rig,'#321f1c',[[side*.022,.627,.258],[side*.045,.615,.26],[side*.066,.615,.253]],.0035);
    }
    ball(rig,C.ink,[0,.632,.258],[.027,.03,.018]);
  }
  const tail=ball(rig,isYier?C.ink:skin,[0,.22,-.22],[.095,.095,.092]);tail.material=softToyMaterial(isYier?C.ink:skin);
  const back=new THREE.Group(),hipLeft=new THREE.Group(),hipRight=new THREE.Group(),neck=new THREE.Group();
  back.position.set(0,.39,-.245);hipLeft.position.set(-.32,.29,-.04);hipRight.position.set(.32,.29,-.04);neck.position.set(0,.625,0);
  rig.add(back,hipLeft,hipRight,neck);
  const pack=new THREE.Group();back.add(pack);box(pack,'#ad8e6e',[0,0,-.025],[.3,.27,.12],.055).material=creatureMaterial('plush','#ad8e6e');
  box(pack,'#d8b77d',[0,.045,-.091],[.23,.09,.03],.018);ball(pack,C.gold,[0,.032,-.111],[.022,.024,.009]);
  for(const side of [-1,1])tube(rig,'#b59976',[[side*.16,.52,-.14],[side*.19,.46,-.23],[side*.145,.28,-.25]],.018);
  mergeStatic(pack,`pack-${kind}`);
  mergeStatic(head,`character-head-animated-${kind}`,new Set(eyes));
  mergeStatic(rig,`character-accessories-${kind}`,new Set([body,tail]));
  const sockets={rightHand:hands[1],leftHand:hands[0],back,hipLeft,hipRight,neck};
  const equipment=new Map();
  const footSamples=[],sampleKeys=new Set(),contactPoint=new THREE.Vector3();
  const bindPositions=body.geometry.attributes.position,bindWeights=body.geometry.attributes.skinWeight;
  for(let i=0;i<bindPositions.count;i++)if(bindPositions.getY(i)<.18){
    const point=new THREE.Vector3().fromBufferAttribute(bindPositions,i),key=point.toArray().map(v=>v.toFixed(3)).join(',');
    if(!sampleKeys.has(key)){sampleKeys.add(key);footSamples.push({point,side:point.x<0?0:1,weight:bindWeights.getY(i)});}
  }
  const state={lastT:null,phase:0,moving:0,turn:0,lastYaw:root.rotation.y,aim:0,hit:0,hitTime:0,attack:null,primary:null,wasAirborne:false,landing:0};
  function dock(entry,held=false){
    const scarf=entry.id==='scarf';
    const socket=scarf?neck:held?hands[1]:(entry.slot%2===0?back:hipLeft);
    socket.add(entry.mount);entry.mount.position.set(0,0,0);entry.mount.rotation.set(0,0,0);
    entry.mount.scale.setScalar(scarf?1.48:held?1.05:.66);
    if(scarf){entry.object.position.set(0,0,0);entry.object.rotation.set(0,0,0);}
    else if(held){const pose=gripPose[entry.id]||gripPose.tea;entry.object.position.set(...pose.p);entry.object.rotation.set(...pose.r);}
    else {
      entry.mount.position.set(entry.slot%2===0?(entry.slot===0?-.045:.055):-.025,0,entry.slot%2===0?-.13:-.035);
      entry.mount.rotation.set(.08,Math.PI,entry.slot%2===0?-.32:.25);
      entry.object.position.set(0,0,0);entry.object.rotation.set(0,0,0);
    }
    entry.held=held&&!scarf;
  }
  function selectHandheld(id){
    state.primary=id;
    for(const entry of equipment.values())dock(entry,entry.id===id);
  }
  root.userData={
    kind,head,body,rig,arms,legs,sockets,equipment,
    clearEquipment(){for(const entry of equipment.values()){entry.mount.removeFromParent();entry.object.removeFromParent();}equipment.clear();state.primary=null;state.attack=null;pack.visible=false;},
    dispose(){root.userData.clearEquipment();body.skeleton.dispose();},
    equipWeapon(id,object,options={}){
      if(equipment.has(id)){const old=equipment.get(id);old.mount.removeFromParent();old.object.removeFromParent();}
      const mount=new THREE.Group();mount.name=`equipped-${id}`;mount.add(object);
      const entry={id,object,mount,slot:options.slot??equipment.size,held:false};equipment.set(id,entry);
      if(!state.primary&&id!=='scarf')state.primary=id;
      dock(entry,id===state.primary);pack.visible=[...equipment.values()].some(e=>!e.held&&e.id!=='scarf');return object;
    },
    triggerAttack(id){
      if(equipment.has(id)&&id!=='scarf')selectHandheld(id);
      state.attack={id,age:0,duration:ATTACK_TIME[id]||.34};return ATTACK_RELEASE[id]||.1;
    },
    triggerHit(strength=1){state.hit=Math.max(state.hit,Math.min(1.4,strength));state.hitTime=.22;},
    getMuzzlePosition(id,target=new THREE.Vector3()){
      const entry=equipment.get(id);root.updateWorldMatrix(true,true);
      if(!entry)return target.set(0,.55,.3).applyMatrix4(root.matrixWorld);
      return target.copy(entry.object.userData.muzzle||new THREE.Vector3(0,.05,.2)).applyMatrix4(entry.object.matrixWorld);
    },
    animate(t,speed=0,skill=0,dt,options={}){
      const delta=Number.isFinite(dt)?Math.max(0,Math.min(.08,dt)):state.lastT===null?1/60:Math.max(0,Math.min(.05,t-state.lastT));state.lastT=t;
      const moving=Math.min(1,Math.abs(speed));state.moving=damp(state.moving,moving,9,delta);
      const airborne=!!options.airborne,verticalVelocity=Number.isFinite(options.verticalVelocity)?options.verticalVelocity:0;
      if(state.wasAirborne&&!airborne)state.landing=.22;
      state.wasAirborne=airborne;state.landing=Math.max(0,state.landing-delta);
      const landing=state.landing>0?Math.sin(state.landing/.22*Math.PI):0;
      state.phase+=delta*(isYier?10.4:9.2)*state.moving;
      const turnVelocity=delta>0?THREE.MathUtils.clamp(wrapAngle(root.rotation.y-state.lastYaw)/delta,-6,6):0;state.lastYaw=root.rotation.y;
      state.turn=damp(state.turn,turnVelocity,8,delta);
      state.aim=damp(state.aim,THREE.MathUtils.clamp(options.aimYaw||0,-.65,.65),10,delta);
      state.hitTime=Math.max(0,state.hitTime-delta);const hit=state.hitTime>0?Math.sin(state.hitTime/.22*Math.PI)*state.hit:0;
      if(state.hitTime===0)state.hit=0;
      let wind=0,strike=0,recovery=0,id=state.primary;
      if(state.attack){
        state.attack.age+=delta;id=state.attack.id;const a=state.attack.age;
        wind=a<.08?Math.sin(a/.08*Math.PI*.5):0;
        strike=a>=.08&&a<.22?Math.sin((a-.08)/.14*Math.PI):0;
        recovery=a>=.22?Math.max(0,1-(a-.22)/(state.attack.duration-.22)):0;
        if(a>=state.attack.duration)state.attack=null;
      }
      const step=state.phase,walk=state.moving,breath=Math.sin(t*2.3)*.006;
      const bodyTwist=id==='pan'?-.24*wind+.36*strike:-.07*strike;
      rig.position.y=airborne?0:(1-Math.cos(step*2))*.012*walk;
      rig.position.z=-hit*.055;
      rig.rotation.set(.055*walk+(isYier?-.16*skill:.08*skill)+hit*.09,state.aim*.35+bodyTwist,Math.sin(step)*.04*walk-state.turn*.024);
      rig.scale.set(1+breath+hit*.11+landing*.06,1-breath-hit*.1-landing*.11+(airborne?.035:0),1+breath*.4+hit*.07+landing*.05);
      if(airborne)rig.rotation.x+=THREE.MathUtils.clamp(-verticalVelocity*.018,-.13,.13);
      for(let i=0;i<2;i++){
        const cycle=step+i*Math.PI,swing=Math.sin(cycle);
        legs[i].rotation.x=-swing*.62*walk;
        legs[i].rotation.z=(i===0?1:-1)*Math.sin(cycle)*.055*walk;
        legs[i].position.y=.26+Math.max(0,Math.cos(cycle))*.035*walk;
        legs[i].position.z=Math.sin(cycle)*.018*walk;
        if(airborne){legs[i].rotation.x=.45+Math.sin(t*5+i)*.07;legs[i].rotation.z=i===0?.12:-.12;legs[i].position.y=.275;}
      }
      head.position.y=1.005+breath*.45;
      head.rotation.x=damp(head.rotation.x,-.045*walk+hit*.12-(id==='camera'?wind*.06:0),8,delta);
      head.rotation.y=damp(head.rotation.y,state.aim*.65-state.turn*.075-Math.sin(step)*.035*walk,7,delta);
      head.rotation.z=damp(head.rotation.z,-Math.sin(step)*.03*walk+state.turn*.025,8,delta);
      for(let i=0;i<2;i++){
        const held=i===1&&state.primary,arm=arms[i];
        let x=Math.sin(step+i*Math.PI)*.48*walk,z=(i===0?1:-1)*.08;
        if(held){x=-.74+Math.sin(step+i*Math.PI)*.1*walk;z=-.12;}
        if(i===1&&state.attack){
          if(id==='pan'){x+=wind*.55-strike*.7+recovery*.2;z+=wind*.3-strike*.75;arm.rotation.y=-wind*.7+strike*1.2;}
          else if(id==='bomb'||id==='train'||id==='slipper'){x+=wind*.75-strike*1.1+recovery*.13;arm.rotation.y=-wind*.15+strike*.1;}
          else{x+=wind*.12+strike*.22;arm.rotation.y=state.aim*.2;}
        }else arm.rotation.y=damp(arm.rotation.y,0,12,delta);
        if(!isYier&&skill>0){x=-1.05;z=i===0?-.25:.25;}
        if(airborne&&!state.attack){x=-.45;z=i===0?-.5:.5;}
        arm.rotation.x=damp(arm.rotation.x,x,22,delta);arm.rotation.z=damp(arm.rotation.z,z,22,delta);
      }
      for(const entry of equipment.values()){
        if(entry.id==='scarf'){entry.mount.rotation.z=Math.sin(t*3+step)*.045*walk;entry.mount.rotation.y=-state.turn*.045;}
        else if(!entry.held){entry.mount.rotation.x=.08+Math.sin(step+entry.slot)*.035*walk;}
      }
      const blinkPhase=t%4.7,blink=blinkPhase>4.48?Math.max(.08,1-Math.sin((blinkPhase-4.48)/.22*Math.PI)) : 1;
      for(let i=0;i<eyes.length;i++)eyes[i].scale.y=eyeScales[i]*blink;
      const tailPulse=1+Math.sin(t*3)*.035;tail.scale.set(.095*tailPulse,.095*tailPulse,.092*tailPulse);tail.rotation.y=-state.turn*.08;
      if(!airborne){
        // Roll the toes through the stance phase while keeping the planted foot
        // on the actual ground. This samples only the tiny lower silhouette;
        // no bind-pose geometry is modified and there are no separate leg seams.
        legs[0].updateMatrix();legs[1].updateMatrix();rig.updateMatrix();let lowest=Infinity;
        for(const sample of footSamples){
          contactPoint.copy(sample.point);contactPoint.x-=sample.side===0?-.18:.18;contactPoint.y-=.26;
          contactPoint.applyMatrix4(legs[sample.side].matrix).lerp(sample.point,1-sample.weight).applyMatrix4(rig.matrix);
          lowest=Math.min(lowest,contactPoint.y);
        }
        if(Number.isFinite(lowest))rig.position.y-=lowest;
      }
      flashWhite(rig,state.hitTime>.125?1:0);
      pack.visible=[...equipment.values()].some(e=>!e.held&&e.id!=='scarf');
    },
  };
  pack.visible=false;return root;
}

export function createEnemy(type = 'crumb') {
  const root = new THREE.Group(); root.name = `enemy-${type}`;
  const rig = new THREE.Group(); root.add(rig);
  const animated = [];
  const wrappers=[];
  let nozzle=null,shield=null,bossHead=null;
  if (type === 'crumb') {
    box(rig, '#d69751', [0,.38,0], [.61,.55,.44], .13);
    box(rig, C.cream, [0,.415,.11], [.51,.43,.34], .12);
    for(const x of [-.16,0,.16]) {
      const cut=box(rig,'#e4b579',[x,.58,.275],[.09,.035,.025],.012);cut.rotation.z=-.45;
    }
    for(const [x,y] of [[-.19,.35],[.18,.3],[-.11,.25],[.11,.58]])ball(rig,'#e4b579',[x,y,.283],[.015,.011,.005]);
    face(rig,.405,.29,{width:.24,eye:.03,angry:true});
    for(const x of [-.17,.17]) animated.push(ball(rig,'#97653d',[x,.09,.035],[.1,.085,.13]));
  } else if (type === 'runner') {
    const pepper = ball(rig,C.red,[0,.46,0],[.24,.42,.23]); pepper.rotation.z=-.2;
    ball(rig,'#f49d83',[-.08,.69,.17],[.035,.1,.013]);
    const tip = mesh(rig,coneGeo,C.red,[.07,.14,0],[.13,.24,.13]);tip.rotation.z=Math.PI+.3;
    tube(rig,'#67a879',[[0,.81,0],[.03,.93,0],[.15,.97,0]],.043);
    face(rig,.51,.21,{width:.22,eye:.031,angry:true});
    for(const x of [-.15,.15]) animated.push(ball(rig,'#84613a',[x,.075,0],[.09,.07,.13]));
  } else if (type === 'shooter') {
    ball(rig,C.purple,[0,.44,0],[.29,.29,.26]);
    tube(rig,'#c8b7e7',[[-.2,.6,.15],[-.12,.68,.17],[-.025,.7,.17]],.012);
    for(const side of [-1,1]) {
      const wrapper=new THREE.Group();wrapper.position.set(side*.3,.44,0);rig.add(wrapper);wrappers.push(wrapper);
      const wrap=mesh(wrapper,coneGeo,'#c8b7e7',[side*.07,0,0],[.19,.28,.19]);wrap.rotation.z=side*Math.PI/2;
      torus(wrapper,'#8c70b5',[-side*.04,0,0],.11,.025,[0,Math.PI/2,0]);
    }
    face(rig,.49,.252,{width:.24,eye:.035,angry:true});
    nozzle=new THREE.Group();nozzle.position.set(0,.31,.29);rig.add(nozzle);
    cylinder(nozzle,'#805b9e',[0,0,0],.09,.2).rotation.x=Math.PI/2;
    cylinder(rig,'#c7afe3',[0,.13,0],.14,.08);
  } else if (type === 'tank') {
    const biscuit=cylinder(rig,'#c89255',[0,.5,0],.47,.31);biscuit.rotation.x=Math.PI/2;
    const rim=torus(rig,'#e8ba78',[0,.5,.171],.365,.033);
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4;ball(rig,'#aa7943',[Math.sin(a)*.265,.5+Math.cos(a)*.265,.17],[.027,.027,.012]);
    }
    face(rig,.54,.19,{width:.26,eye:.035,angry:true});
    shield=new THREE.Group();shield.position.set(.32,.32,.3);rig.add(shield);
    box(shield,'#9ec5b6',[0,0,0],[.28,.47,.11],.06,{metalness:.25,roughness:.45});
    box(shield,'#d7ece0',[0,0,.065],[.035,.32,.012],.009);
    for(const x of [-.22,.22]) animated.push(ball(rig,'#896346',[x,.065,0],[.13,.065,.15]));
  } else if (type === 'splitter') {
    ball(rig,'#9bc9a5',[0,.33,0],[.37,.33,.34]);
    const top=cylinder(rig,'#afd8b5',[0,.49,0],.23,.17);top.scale.x*=.96;
    ball(rig,'#d5ebcd',[-.1,.48,.26],[.07,.09,.02]);
    ball(rig,'#d5ebcd',[.12,.5,.23],[.025,.037,.012]);
    face(rig,.34,.325,{width:.25,eye:.034});
    for (const x of [-.2,0,.2]) ball(rig,'#9bc9a5',[x,.085,.03],[.14,.085,.22]);
  } else if (type === 'boss') {
    // A wind-up biscuit king: broad toy silhouette and clear crown/gear language.
    box(rig,'#c78d51',[0,.79,0],[1.15,1.23,.74],.22);
    box(rig,C.cream,[0,.83,.2],[.98,1.04,.47],.19);
    box(rig,'#7d9e98',[0,.37,.02],[1.16,.13,.78],.04);
    for(const x of [-.4,.4])for(const y of [.58,1.07])ball(rig,C.gold,[x,y,.444],[.035,.035,.016]);
    torus(rig,C.gold,[0,.85,.455],.115,.023);
    ball(rig,C.red,[0,.85,.461],[.06,.06,.025]);
    bossHead=new THREE.Group();bossHead.position.y=1.77;rig.add(bossHead);
    box(bossHead,'#e2af6d',[0,0,0],[1.43,1.08,.86],.22);
    face(bossHead,.04,.441,{width:.53,eye:.068,angry:true,cheeks:'#e99f6e'});
    for(const x of [-.47,.47]) {
      const pivot=new THREE.Group();pivot.position.set(x,.98,0);rig.add(pivot);
      box(pivot,'#c78d51',[x<0?-.2:.2,-.16,0],[.36,.7,.42],.13);animated.push(pivot);
    }
    for(const x of [-.36,.36]) box(rig,'#7d9e98',[x,.15,.12],[.42,.25,.57],.09);
    box(bossHead,C.gold,[0,.62,0],[.96,.2,.65],.04,{metalness:.5,roughness:.3});
    for(const x of [-.39,0,.39]) {
      mesh(bossHead,coneGeo,C.gold,[x,.84,0],[.17,.35,.24],{metalness:.5,roughness:.3});
      ball(bossHead,C.red,[x,1,0],[.055,.055,.055]);
    }
    const key=new THREE.Group();key.position.set(0,1.1,-.59);rig.add(key);
    box(key,C.gold,[0,0,0],[.12,.12,.4],.03,{metalness:.5,roughness:.35});
    for(const side of [-1,1]) torus(key,C.gold,[side*.18,0,-.22],.17,.045,null,{metalness:.5,roughness:.35});
    mergeStatic(key,'boss-key');
    root.userData.key = key;
  } else {
    ball(rig,C.red,[0,.35,0],[.3,.35,.3]);face(rig,.39,.29);
  }
  const biscuitColors=new Set(['d69751','ffe8b0','e4b579','97653d','c89255','e8ba78','aa7943','896346','c78d51','e2af6d']);
  rig.traverse(part=>{
    if(!part.isMesh||!part.material.color)return;
    const color=`#${part.material.color.getHexString()}`,hex=color.slice(1);
    if(['crumb','tank','boss'].includes(type)&&biscuitColors.has(hex))part.material=creatureMaterial('biscuit',color);
    else if(type==='runner'&&['ec6f62','f49d83'].includes(hex))part.material=creatureMaterial('candy',color);
    else if(type==='shooter'&&['a990d3','c8b7e7'].includes(hex))part.material=creatureMaterial('candy',color);
    else if(type==='splitter'&&['9bc9a5','afd8b5'].includes(hex))part.material=creatureMaterial('jelly',color);
  });
  if(bossHead)mergeStatic(bossHead,'enemy-boss-head');
  mergeStatic(rig,`enemy-animated-${type}`,new Set(animated.filter(o=>o.isMesh)));
  const bases=animated.map(part=>({position:part.position.clone(),rotation:part.rotation.clone()}));
  const state={lastT:null,phase:Math.random()*Math.PI*2,walk:0,turn:0,lastYaw:root.rotation.y,hit:0,hitTime:0,charge:0,attackAge:1};
  root.userData.type=type;root.userData.rig=rig;
  root.userData.triggerHit=(strength=1)=>{state.hit=Math.max(state.hit,Math.min(1.5,strength));state.hitTime=.23;};
  root.userData.triggerAttack=()=>{state.attackAge=0;return type==='boss'?.18:.08;};
  root.userData.animate=(t,speed=1,attack=0,dt,options={})=>{
    const delta=Number.isFinite(dt)?Math.max(0,Math.min(.08,dt)):state.lastT===null?1/60:Math.max(0,Math.min(.05,t-state.lastT));state.lastT=t;
    state.walk=damp(state.walk,Math.min(1,Math.abs(speed)),8,delta);
    const pace=type==='runner'?15:type==='boss'?5.4:type==='tank'?6:9;
    state.phase+=delta*pace*state.walk;state.attackAge+=delta;
    state.charge=damp(state.charge,attack?1:0,11,delta);
    const turnSpeed=delta?THREE.MathUtils.clamp(wrapAngle(root.rotation.y-state.lastYaw)/delta,-5,5):0;state.lastYaw=root.rotation.y;
    state.turn=damp(state.turn,turnSpeed,7,delta);state.hitTime=Math.max(0,state.hitTime-delta);
    const hit=state.hitTime>0?Math.sin(state.hitTime/.23*Math.PI)*state.hit:0;
    if(!state.hitTime)state.hit=0;
    const strike=state.attackAge<.4?Math.sin(Math.min(1,state.attackAge/.4)*Math.PI):0;
    const step=state.phase,walk=state.walk,breath=Math.sin(t*2.7+step*.05)*.008;
    rig.position.set(Math.sin(t*57)*hit*.025,Math.abs(Math.sin(step))*(type==='boss'?.025:.035)*walk, -hit*.035);
    rig.rotation.set(.025*walk+hit*.15, -state.turn*.035,Math.sin(step)*.045*walk-state.turn*.018);
    rig.scale.set(1+breath+hit*.14,1-breath-hit*.13,1+hit*.09);
    for(let i=0;i<animated.length;i++){
      const part=animated[i],base=bases[i],cycle=step+i*Math.PI;
      part.position.copy(base.position);part.rotation.copy(base.rotation);
      if(part.isGroup){
        // Wind-up king: distinct telegraphed arm raise, heavy follow-through.
        part.rotation.x=-state.charge*1.65+strike*.85+Math.sin(cycle)*.15*walk;
        part.rotation.z=(i===0?1:-1)*state.charge*.18;
      }else{
        part.position.z+=Math.sin(cycle)*.09*walk;
        part.position.y+=Math.max(0,Math.cos(cycle))*.07*walk;
        part.rotation.x=Math.sin(cycle)*.28*walk;
      }
    }
    if(type==='crumb'){
      rig.rotation.x+=Math.sin(step*2)*.025*walk;
      rig.scale.y-=state.charge*.07;
    }
    if(type==='runner'){
      const charging=options.phase==='charge'||speed>5;
      rig.rotation.x+=charging?.34:state.charge*-.2+.09*walk;
      rig.scale.set(1-hit*.02-state.charge*.04,1+breath-state.charge*.12-hit*.16,1+state.charge*.08+(charging?.12:0));
      rig.position.y-=state.charge*.045;
    }
    if(type==='shooter'){
      rig.position.y=.07+Math.sin(t*4.3+step)*.055-hit*.025;
      rig.rotation.z=Math.sin(t*2+step)*.07-state.turn*.025;
      for(let i=0;i<wrappers.length;i++){
        wrappers[i].rotation.x=Math.sin(t*4.8+i*Math.PI)*.18;
        wrappers[i].rotation.y=(i===0?1:-1)*(Math.sin(t*3)*.09+strike*.2);
      }
      nozzle.position.z=.29-strike*.075;
      rig.scale.z=1-strike*.11+hit*.1;
    }
    if(type==='tank'){
      rig.rotation.z=Math.sin(step)*.065*walk;
      rig.position.y=Math.max(0,Math.sin(step*2))*.02*walk;
      shield.rotation.y=-state.turn*.08+hit*.35;
      shield.rotation.x=state.charge*-.2+Math.sin(t*2)*.025;
      shield.position.z=.3+state.charge*.035;
    }
    if(type==='splitter'){
      const spring=Math.sin(t*7+step);
      rig.scale.set(1-spring*.065+hit*.23,1+spring*.12-hit*.2,1-spring*.05+hit*.18);
      rig.position.y=Math.max(0,spring)*.105;
      rig.rotation.x=walk*.1;
    }
    if(type==='boss'){
      rig.rotation.x+=state.charge*-.11+strike*.16;
      rig.scale.y-=state.charge*.045;
      bossHead.rotation.y=damp(bossHead.rotation.y,-state.turn*.06,5,delta);
      bossHead.rotation.z=Math.sin(step)*-.025*walk+hit*.04;
      bossHead.rotation.x=-state.charge*.1+strike*.08;
      if(root.userData.key)root.userData.key.rotation.z+=delta*(state.charge?5:1.8);
    }
    flashWhite(rig,state.hitTime>.135?1:0);
  };
  return root;
}

export function createWeapon(id = 'pan') {
  const root = new THREE.Group();root.name=`weapon-${id}`;
  if (id === 'pan') {
    const pan=cylinder(root,'#637476',[0,0,0],.2,.055,{metalness:.6,roughness:.36});pan.rotation.x=Math.PI/2;
    torus(root,'#a2b0a8',[0,0,.034],.176,.017);
    box(root,'#bc926b',[0,-.27,0],[.075,.24,.055],.025);
    for(const y of [-.2,-.3])ball(root,'#a2b0a8',[0,y,.033],[.012,.012,.006]);
    ball(root,'#f9df81',[.015,.015,.035],[.09,.08,.012]);ball(root,C.gold,[.015,.015,.049],[.035,.035,.01]);
  } else if(id === 'tea') {
    const cup=mesh(root,geo('tea-cup',()=>new THREE.CylinderGeometry(.12,.092,.3,24)), '#fff5df',[0,0,0],[1,1,1],{transparent:true,opacity:.34,roughness:.22,depthWrite:false});
    cup.renderOrder=2;
    mesh(root,geo('tea-liquid',()=>new THREE.CylinderGeometry(.111,.084,.25,24)), '#cba77d',[0,-.014,0]);
    cylinder(root,'#fff4df',[0,.155,0],.128,.025);
    torus(root,'#e9d9bc',[0,.161,0],.117,.007,[Math.PI/2,0,0]);
    const straw=cylinder(root,C.red,[.035,.26,0],.016,.2);straw.rotation.z=-.16;
    for(const [x,y,z] of [[-.055,-.09,.073],[0,-.103,.088],[.055,-.09,.073],[-.03,-.06,.082],[.035,-.055,.084]])ball(root,C.ink,[x,y,z],[.022,.022,.02],{roughness:.3});
    const label=box(root,'#fff0d4',[0,.022,.112],[.1,.105,.008],.012);
    label.material=printedMaterial('boba-label','#fff0d4',c=>{
      c.strokeStyle='#d59883';c.lineWidth=5;c.strokeRect(12,12,232,232);
      c.fillStyle='#bd7b66';c.font='bold 45px sans-serif';c.textAlign='center';c.fillText('BOBA',128,77);
      c.font='16px sans-serif';c.fillText('LITTLE HAPPY CUP',128,105);
      c.fillStyle='#e2a9a0';for(let i=0;i<5;i++){const a=i*Math.PI*2/5;c.beginPath();c.ellipse(128+Math.sin(a)*22,163+Math.cos(a)*22,15,19,-a,0,Math.PI*2);c.fill();}
      c.fillStyle='#f5cf7a';c.beginPath();c.arc(128,163,12,0,Math.PI*2);c.fill();
      c.fillStyle='#bd7b66';c.font='13px sans-serif';c.fillText('SWEET LITTLE MOMENTS',128,224);
    });
  } else if(id === 'slipper') {
    box(root,'#efb6a8',[0,0,0],[.22,.09,.39],.075);
    const upper=ball(root,'#f8d3c0',[0,.07,-.045],[.11,.085,.12]);
    for(const x of [-.06,.06])ball(root,'#f8d3c0',[x,.13,-.07],[.026,.052,.026]);
    for(const x of [-.034,.034])ball(root,C.ink,[x,.093,.043],[.009,.009,.008]);
    ball(root,'#df9a95',[0,.083,.062],[.012,.009,.008]);
    for(const side of [-1,1]) {
      const inner=ball(root,'#e9aba3',[side*.06,.142,-.055],[.011,.026,.01]);
      inner.rotation.z=side*-.1;
    }
    for(let i=0;i<12;i++) {
      const angle=i*Math.PI*2/12;
      tube(root,'#ffe6cd',[[Math.sin(angle)*.092,.047,Math.cos(angle)*.17],[Math.sin(angle)*.079,.049,Math.cos(angle)*.156]],.0026);
    }
  } else if(id === 'bubbles') {
    box(root,C.mint,[0,0,0],[.28,.21,.2],.07);
    const nozzle=cylinder(root,C.cream,[0,.005,.145],.085,.15);nozzle.rotation.x=Math.PI/2;
    torus(root,C.gold,[0,.005,.23],.065,.014);
    box(root,C.mint,[0,-.14,-.01],[.1,.15,.12],.035);
    const orb=ball(root,'#b8e8e4',[0,.22,-.01],[.08,.095,.075]);
    ball(root,C.white,[-.025,.246,.052],[.019,.03,.008]);
  } else if(id === 'bomb') {
    cylinder(root,'#c98173',[0,0,0],.145,.065).rotation.x=Math.PI/2;
    const dial=cylinder(root,C.cream,[0,0,.044],.124,.021);dial.rotation.x=Math.PI/2;
    box(root,C.ink,[.025,.035,.063],[.012,.075,.01],.004).rotation.z=.6;
    box(root,C.ink,[-.025,-.01,.063],[.065,.011,.01],.004);
    for(const x of [-.1,.1])ball(root,C.gold,[x,.14,0],[.07,.05,.055]);
    for(const x of [-.09,.09])ball(root,C.ink,[x,-.14,0],[.024,.04,.025]);
    for(let i=0;i<12;i++) {
      const a=i*Math.PI/6;
      const tick=mesh(root,plainBoxGeo,'#b18a64',[Math.sin(a)*.102,Math.cos(a)*.102,.058],[.006,.012,.004]);
      tick.rotation.z=-a;
    }
  } else if(id === 'camera') {
    box(root,'#f4d1b8',[0,0,0],[.35,.25,.17],.04);
    const lens=cylinder(root,'#617d7e',[.03,0,.11],.085,.1);lens.rotation.x=Math.PI/2;
    const glass=cylinder(root,'#a8d7d5',[.03,0,.17],.061,.015,{metalness:.45,roughness:.2});glass.rotation.x=Math.PI/2;
    box(root,C.white,[-.1,.08,.092],[.07,.04,.015],.01);
    box(root,C.red,[-.1,.14,0],[.05,.025,.06],.01);
    box(root,C.cream,[0,-.15,.02],[.2,.08,.02],.005);
    torus(root,'#bcded3',[.03,0,.18],.066,.006);
    ball(root,C.white,[.011,.022,.182],[.014,.019,.003],{roughness:.25});
    box(root,'#b8907c',[-.108,-.045,.092],[.055,.007,.008],.002);
    box(root,'#b8907c',[-.108,-.064,.092],[.055,.007,.008],.002);
    for(const x of [-.143,.143])for(const y of [-.093,.093])ball(root,'#b8907c',[x,y,.087],[.006,.006,.003]);
    box(root,'#b8907c',[0,.012,-.09],[.24,.12,.012],.018);
    box(root,'#d7e9df',[0,.012,-.1],[.21,.09,.01],.012);
    const photo=box(root,C.white,[0,-.15,.034],[.172,.064,.005],.003);
    photo.material=printedMaterial('instant-photo','#fff7e8',c=>{
      c.fillStyle='#b5d5cc';c.fillRect(18,12,220,182);
      c.fillStyle='#f1d99e';c.beginPath();c.arc(184,56,24,0,Math.PI*2);c.fill();
      c.fillStyle='#86ae8f';c.beginPath();c.moveTo(18,194);c.lineTo(72,92);c.lineTo(143,165);c.lineTo(182,123);c.lineTo(238,194);c.fill();
      c.fillStyle='#b5947d';c.font='16px sans-serif';c.textAlign='center';c.fillText('a little adventure',128,231);
    });
  } else if(id === 'scarf') {
    torus(root,C.red,[0,0,0],.19,.045,[Math.PI/2,0,0]);
    tube(root,C.red,[[.15,0,0],[.25,-.05,0],[.29,-.2,0],[.38,-.27,0]],.055);
    for(let i=0;i<3;i++)tube(root,'#f2a096',[[.36+i*.019,-.25,.01],[.4+i*.019,-.31,.01]],.008);
  } else if(id === 'train') {
    box(root,'#7eb6a6',[0,-.025,0],[.25,.12,.4],.035);
    const boiler=cylinder(root,'#a4cec0',[0,.06,.05],.105,.23);boiler.rotation.x=Math.PI/2;
    box(root,C.red,[0,.12,-.12],[.22,.22,.16],.035);
    box(root,C.cream,[0,.14,-.03],[.11,.1,.015],.01);
    cylinder(root,C.gold,[0,.2,.1],.04,.12);
    for(const x of [-.13,.13])for(const z of [-.12,.12]) {
      const w=cylinder(root,C.ink,[x,-.1,z],.065,.035);w.rotation.z=Math.PI/2;
      const hub=cylinder(root,C.gold,[x<0?x-.02:x+.02,-.1,z],.025,.008);hub.rotation.z=Math.PI/2;
    }
    torus(root,C.gold,[0,.06,.174],.067,.011);
    ball(root,C.cream,[0,.06,.184],[.039,.039,.01]);
    for(const side of [-1,1])box(root,'#b4d9d0',[side*.113,.14,-.12],[.009,.09,.09],.015);
    const coupling=cylinder(root,C.gold,[0,-.045,-.268],.018,.1);coupling.rotation.x=Math.PI/2;
    box(root,'#e8ba7b',[0,-.005,-.425],[.24,.17,.23],.035);
    box(root,'#f5d89d',[0,.09,-.425],[.25,.035,.24],.015);
    box(root,C.red,[0,.145,-.425],[.13,.08,.13],.02);
    for(const side of [-1,1])for(const z of [-.36,-.49]) {
      const wheel=cylinder(root,C.ink,[side*.128,-.1,z],.054,.03);wheel.rotation.z=Math.PI/2;
      const hub=cylinder(root,C.gold,[side*.145,-.1,z],.02,.008);hub.rotation.z=Math.PI/2;
    }
  } else {
    ball(root,C.gold,[0,0,0],[.14,.14,.14]);
  }
  mergeStatic(root,`weapon-${id}`);
  root.userData.id=id;
  const muzzlePoints={tea:[0,.33,0],bubbles:[0,.005,.25],camera:[.03,0,.2],pan:[0,.05,.07],slipper:[0,.07,.19],bomb:[0,0,.08],scarf:[0,0,.2],train:[0,.06,.2]};
  root.userData.muzzle=new THREE.Vector3(...(muzzlePoints[id]||[0,0,.2]));
  return root;
}

export const MODEL_PALETTE = Object.freeze({ ...C });
