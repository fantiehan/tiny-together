import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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
  const key=`toy:${color}`;
  if(!materials.has(key)) {
    if(!textures.has('toy-grain')) {
      const pixels=new Uint8Array(64*64*4);
      let seed=193;
      for(let i=0;i<64*64;i++) {
        seed=(seed*1664525+1013904223)>>>0;
        const shade=220+(seed>>>27);
        pixels.set([shade,shade,shade,255],i*4);
      }
      const map=new THREE.DataTexture(pixels,64,64,THREE.RGBAFormat);
      map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(4,4);
      map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;
      map.generateMipmaps=true;map.needsUpdate=true;textures.set('toy-grain',map);
    }
    materials.set(key,new THREE.MeshPhysicalMaterial({
      color,roughness:.74,metalness:0,roughnessMap:textures.get('toy-grain'),
      bumpMap:textures.get('toy-grain'),bumpScale:.0012,clearcoat:.16,
      clearcoatRoughness:.65,sheen:.2,sheenRoughness:.85,
      sheenColor:new THREE.Color(color).lerp(new THREE.Color('#fff6e8'),.28),
    }));
  }
  return materials.get(key);
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
  for (const side of [-1, 1]) {
    ball(parent, C.ink, [side * width / 2, y, z], [eye, eye * 1.08, eye * .43], {roughness:.24,metalness:0});
    ball(parent, C.white, [side*width/2-eye*.24,y+eye*.31,z+eye*.39], [eye*.16,eye*.19,eye*.08], {roughness:.35,metalness:0});
    if (angry) {
      const brow = box(parent, C.ink, [side * width / 2, y + eye * 1.9, z], [eye * 2, .018, .024], .008);
      brow.rotation.z = side * -.24;
    }
    if (cheeks) ball(parent, cheeks, [side * width * .84, y - .07, z - .003], [.085, .067, .014]);
  }
  if (mouth) tube(parent, C.ink, [[-.042,y-.035,z+.009],[-.034,y-.057,z+.015],[-.013,y-.06,z+.019],[0,y-.043,z+.02],[.013,y-.06,z+.019],[.034,y-.057,z+.015],[.042,y-.035,z+.009]], .011);
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

export function createCharacter(kind = 'yier') {
  const isYier = kind === 'yier';
  const root = new THREE.Group();
  root.name = isYier ? '一二' : '布布';
  const rig = new THREE.Group(); root.add(rig);
  const skin = isYier ? C.white : C.brown;
  const body = mesh(rig, bodyGeometry(), skin);
  body.material=softToyMaterial(skin);
  const head = new THREE.Group(); head.position.y = 1.005; rig.add(head);
  // A rounded cuboid gives the approved flatter crown/chin and broad cheeks.
  box(head, skin, [0,0,0], [.97,.79,.64], .25).material=softToyMaterial(skin);
  const ears = [];
  for (const side of [-1, 1]) {
    const ear = ball(head, isYier ? C.ink : skin, [side*.365,.34,-.015], [.135,.145,.108]);
    ear.material=softToyMaterial(isYier?C.ink:skin);
    if (!isYier) {
      ball(head, '#dfad88', [side*.365,.347,.077], [.092,.102,.024]).material=softToyMaterial('#dfad88');
      ball(head, C.inner, [side*.365,.347,.095], [.069,.079,.017], {roughness:.8});
    }
    ears.push(ear);
  }
  face(head, -.063, .324, { width: .315, eye: .039, cheeks: isYier ? C.pink : C.cheek });
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(side*.255,.53,0); rig.add(pivot);
    const arm = ball(pivot, skin, [side*.073,-.1,.015], [.105,.17,.12]);
    arm.material=softToyMaterial(skin);
    arm.rotation.z = side * -.38; arms.push(pivot);
  }
  if (isYier) {
    for (const side of [-1,1]) ball(rig, C.ink, [side*.205,.075,.085], [.112,.065,.139]);
    for (const side of [-1,1]) {
      const lobe = ball(rig, C.ink, [side*.047,.635,.235], [.062,.043,.025]);
      lobe.rotation.z = side * .35;
      tube(rig,'#6c4438',[[side*.021,.633,.259],[side*.044,.646,.262],[side*.064,.649,.256]],.0045);
      tube(rig,'#321f1c',[[side*.022,.627,.258],[side*.045,.615,.26],[side*.066,.615,.253]],.0035);
    }
    ball(rig,C.ink,[0,.632,.258],[.027,.03,.018]);
  }
  const tail = ball(rig, isYier ? C.ink : skin, [0,.22,-.22], [.095,.095,.092]);
  tail.material=softToyMaterial(isYier?C.ink:skin);
  mergeStatic(head,`character-head-${kind}`);
  mergeStatic(rig,`character-body-details-${kind}`,new Set([body,tail]));
  root.userData = {
    kind, head, body, rig, arms,
    animate(t, speed = 0, skill = 0) {
      const moving = Math.min(1, Math.abs(speed));
      const step = t * (isYier ? 11 : 9.5);
      rig.position.y = Math.abs(Math.sin(step)) * .035 * moving;
      rig.rotation.z = Math.sin(step) * .025 * moving;
      rig.rotation.x = moving * .025;
      head.rotation.z = -.025 * Math.sin(step) * moving;
      head.rotation.y = Math.sin(t*1.3)*.025*(1-moving);
      for (let i = 0; i < 2; i++) arms[i].rotation.x = Math.sin(step + i*Math.PI) * .45 * moving - skill*.65;
      const tailPulse = 1 + Math.sin(t*3)*.04;
      tail.scale.set(.095*tailPulse,.095*tailPulse,.092*tailPulse);
    },
  };
  return root;
}

export function createEnemy(type = 'crumb') {
  const root = new THREE.Group(); root.name = `enemy-${type}`;
  const rig = new THREE.Group(); root.add(rig);
  const animated = [];
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
      const wrap=mesh(rig,coneGeo,'#c8b7e7',[side*.37,.44,0],[.19,.28,.19]);wrap.rotation.z=side*Math.PI/2;
      torus(rig,'#8c70b5',[side*.26,.44,0],.11,.025,[0,Math.PI/2,0]);
    }
    face(rig,.49,.252,{width:.24,eye:.035,angry:true});
    const nozzle=cylinder(rig,'#805b9e',[0,.31,.29],.09,.2);nozzle.rotation.x=Math.PI/2;
    cylinder(rig,'#c7afe3',[0,.13,0],.14,.08);
  } else if (type === 'tank') {
    const biscuit=cylinder(rig,'#c89255',[0,.5,0],.47,.31);biscuit.rotation.x=Math.PI/2;
    const rim=torus(rig,'#e8ba78',[0,.5,.171],.365,.033);
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4;ball(rig,'#aa7943',[Math.sin(a)*.265,.5+Math.cos(a)*.265,.17],[.027,.027,.012]);
    }
    face(rig,.54,.19,{width:.26,eye:.035,angry:true});
    box(rig,'#9ec5b6',[.32,.32,.3],[.28,.47,.11],.06,{metalness:.25,roughness:.45});
    box(rig,'#d7ece0',[.32,.32,.365],[.035,.32,.012],.009);
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
    const head = box(rig,'#e2af6d',[0,1.77,0],[1.43,1.08,.86],.22);
    face(rig,1.81,.441,{width:.53,eye:.068,angry:true,cheeks:'#e99f6e'});
    for(const x of [-.47,.47]) {
      const pivot=new THREE.Group();pivot.position.set(x,.98,0);rig.add(pivot);
      box(pivot,'#c78d51',[x<0?-.2:.2,-.16,0],[.36,.7,.42],.13);animated.push(pivot);
    }
    for(const x of [-.36,.36]) box(rig,'#7d9e98',[x,.15,.12],[.42,.25,.57],.09);
    box(rig,C.gold,[0,2.39,0],[.96,.2,.65],.04,{metalness:.5,roughness:.3});
    for(const x of [-.39,0,.39]) {
      mesh(rig,coneGeo,C.gold,[x,2.61,0],[.17,.35,.24],{metalness:.5,roughness:.3});
      ball(rig,C.red,[x,2.77,0],[.055,.055,.055]);
    }
    const key=new THREE.Group();key.position.set(0,1.1,-.59);rig.add(key);
    box(key,C.gold,[0,0,0],[.12,.12,.4],.03,{metalness:.5,roughness:.35});
    for(const side of [-1,1]) torus(key,C.gold,[side*.18,0,-.22],.17,.045,null,{metalness:.5,roughness:.35});
    mergeStatic(key,'boss-key');
    root.userData.key = key;
  } else {
    ball(rig,C.red,[0,.35,0],[.3,.35,.3]);face(rig,.39,.29);
  }
  mergeStatic(rig,`enemy-${type}`,new Set(animated.filter(o=>o.isMesh)));
  root.userData.type=type;
  root.userData.rig=rig;
  root.userData.animate=(t,speed=1,attack=0)=>{
    const pace=type==='runner'?14:type==='boss'?4:8;
    rig.position.y=Math.abs(Math.sin(t*pace))*(type==='boss'?.035:.045)*Math.min(1,speed);
    rig.rotation.z=Math.sin(t*pace)*.045*Math.min(1,speed);
    if(type==='splitter') { rig.scale.y=1+Math.sin(t*6)*.055;rig.scale.x=1-Math.sin(t*6)*.025; }
    for(let i=0;i<animated.length;i++) animated[i].rotation.x=Math.sin(t*pace+i*Math.PI)*.24*Math.min(1,speed)-attack*.7;
    if(root.userData.key) root.userData.key.rotation.z=t*1.8;
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
  return root;
}

export const MODEL_PALETTE = Object.freeze({ ...C });
