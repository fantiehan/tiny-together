import * as THREE from 'three';
import {createCharacter,createEnemy,createWeapon} from './models.js';
import {createWorld} from './world.js';
import {UI} from './ui.js';
import {Input} from './input.js';
import {Audio} from './audio.js';
import {Effects} from './effects.js';
import {COMBO_WINDOW,combatBonus,verticalOverlap,segmentHitsBody,waveProfile,landingImpact,readyWeaponIndex} from './combat.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {STAGES,WEAPONS,ENEMIES,makeRun,rollChoices,applyChoice,awardXP,mitigateDamage} from './data.js';
import './style.css';

const canvas=document.getElementById('game-canvas');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});}catch(error){document.getElementById('loading').innerHTML='<b>这个浏览器暂时无法开启三维画面</b><p>请使用支持 WebGL 2 的新版 Safari、Chrome 或 Edge。</p>';throw error;}
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
const scene=new THREE.Scene();scene.background=new THREE.Color(0xf2e8d5);scene.fog=new THREE.Fog(0xf2e8d5,34,78);
const pmrem=new THREE.PMREMGenerator(renderer);const roomEnvironment=new RoomEnvironment();const environmentTarget=pmrem.fromScene(roomEnvironment,.025);scene.environment=environmentTarget.texture;scene.environmentIntensity=.4;roomEnvironment.dispose();pmrem.dispose();
const camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.12,110);
scene.add(new THREE.HemisphereLight(0xfff2db,0x9dbaa4,1.25));const sun=new THREE.DirectionalLight(0xffedcf,2.1);sun.position.set(-12,24,10);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-24;sun.shadow.camera.right=24;sun.shadow.camera.top=24;sun.shadow.camera.bottom=-24;sun.shadow.normalBias=.035;sun.shadow.bias=-.0003;scene.add(sun);scene.add(new THREE.AmbientLight(0xffffff,.22));
const audio=new Audio(),fx=new Effects(scene);const protection=new THREE.Mesh(new THREE.RingGeometry(.5,.55,48),new THREE.MeshBasicMaterial({color:0xa1d7d2,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));protection.rotation.x=-Math.PI/2;scene.add(protection);const dynamic=new THREE.Group();scene.add(dynamic);
const eliteHaloGeo=new THREE.TorusGeometry(.42,.035,5,20);
const sphereGeo=new THREE.SphereGeometry(.16,10,7),bubbleGeo=new THREE.SphereGeometry(.35,12,8),xpGeo=new THREE.OctahedronGeometry(.12,0);const mats=new Map();
function mat(color,transparent=false){const key=`${color}-${transparent}`;if(!mats.has(key))mats.set(key,new THREE.MeshStandardMaterial({color,roughness:.45,transparent,opacity:transparent?.65:1,metalness:.05}));return mats.get(key);}
// Shared soft contact shadows keep small creatures grounded without rendering
// every tiny face/foot detail again into the directional shadow map.
const contactCanvas=document.createElement('canvas');contactCanvas.width=contactCanvas.height=64;
const contactCtx=contactCanvas.getContext('2d'),contactGradient=contactCtx.createRadialGradient(32,32,2,32,32,31);
contactGradient.addColorStop(0,'rgba(57,36,22,.28)');contactGradient.addColorStop(.5,'rgba(57,36,22,.14)');contactGradient.addColorStop(1,'rgba(57,36,22,0)');contactCtx.fillStyle=contactGradient;contactCtx.fillRect(0,0,64,64);
const contactMaterial=new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(contactCanvas),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),contactGeo=new THREE.PlaneGeometry(1,1);
function contactShadow(actor,radius){const shadow=new THREE.Mesh(contactGeo,contactMaterial);shadow.rotation.x=-Math.PI/2;shadow.position.y=.025;shadow.scale.setScalar(radius*2.8);actor.add(shadow);actor.userData.contactShadow=shadow;return shadow;}
let world=createWorld(scene,0),player=createCharacter('yier');scene.add(player);contactShadow(player,.38);player.position.set(-3,0,-2);player.rotation.y=.5;
let mode='menu',run=makeRun(),enemies=[],shots=[],drops=[],hazards=[],weaponVisuals=[],pendingLevels=0,spawnTimer=1,bossSpawned=false,boss=null,invuln=0,skillActive=0,stageReward=false,closest=null,shake=0,lastHUD=0,elapsed=0,history=[],stageKills=0,challenge=0,combo=0,comboTimer=0,killSound=0,quality='high',stageEndCountdown=0;
let motion={vy:0,grounded:true,fallDistance:0},velocity={x:0,z:0},attackQueue=[],attackLock=0,weaponCursor=0,hitStop=0,eliteTimer=28,highGroundReward=false,bonusXPTime=0,aimYaw=0;
let orientationPaused=false;const rotateScreen=document.createElement('div');rotateScreen.id='rotate-screen';rotateScreen.innerHTML='<svg viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="3"><rect x="32" y="18" width="36" height="64" rx="7"/><path d="M43 24h14M46 75h8M14 45a37 37 0 0 1 63-24m0-10v10H67M86 55a37 37 0 0 1-63 24m0 10V79h10"/></svg><h2>把手机横过来，冒险更开阔</h2><p>横屏后自动继续，左手走位，右手转动视角。</p><small>一二布布 · 小小大冒险</small>';document.body.append(rotateScreen);
let best=0;try{best=Number(localStorage.getItem('tiny-best')||0);}catch{}
const ui=new UI({onStart:start,onChoose:choose,onNextStage:nextStage,onRestart:()=>start(run.kind),onResume:resume,onPause:()=>pause(),onMute:()=>audio.toggle(),onQuality:setQuality,onMenu:menu});
ui.muted=audio.muted;
const input=new Input(canvas,{skill:useSkill,interact:interact,pause});
function setQuality(v){quality=v;renderer.setPixelRatio(Math.min(devicePixelRatio,v==='low'?1:1.6));renderer.shadowMap.enabled=v!=='low';ui.toast(v==='low'?'轻盈画质已开启':'精致画质已开启');}
function clearDynamic(){attackQueue=[];attackLock=0;weaponCursor=0;for(const e of enemies)dynamic.remove(e.mesh);for(const p of shots)dynamic.remove(p.mesh);for(const d of drops)dynamic.remove(d.mesh);for(const h of hazards){dynamic.remove(h.mesh);h.mesh.geometry.dispose();h.mesh.material.dispose();}enemies=[];shots=[];drops=[];hazards=[];boss=null;fx.clear();}
function rebuildWeapons(){
 player.userData.clearEquipment?.();
 for(const v of weaponVisuals)v.removeFromParent();
 weaponVisuals=run.weapons.map((w,i)=>{const m=createWeapon(w.id);if(w.level===5)m.scale.multiplyScalar(1.15);player.userData.equipWeapon?.(w.id,m,{slot:i});return m;});
}

function start(kind='yier'){audio.unlock();audio.play('click');run=makeRun(kind);pendingLevels=0;invuln=1;skillActive=0;stageReward=false;stageKills=0;challenge=0;combo=0;input.clear();input.yaw=Math.PI;input.pitch=.4;player.userData.dispose?.();scene.remove(player);player=createCharacter(kind);scene.add(player);contactShadow(player,.38);rebuildWeapons();loadStage(0);mode='playing';ui.startHUD(kind);ui.toast('走上书本坡道，试试高台射击！靠近发光物按 F 使用机关。');ensureLandscape();}
function loadStage(index){clearDynamic();world.dispose();world=createWorld(scene,index);run.stage=index;run.time=0;run.shield=Math.max(run.shield,run.shieldBonus);if(index>0)run.hp=Math.min(run.maxHp,run.hp+Math.round(run.maxHp*.3));player.position.set(0,0,4);motion={vy:0,grounded:true,fallDistance:0};velocity={x:0,z:0};hitStop=0;eliteTimer=28;highGroundReward=false;bonusXPTime=0;combo=0;comboTimer=0;input.yaw=Math.PI;player.rotation.y=Math.PI;stageEndCountdown=0;bossSpawned=false;spawnTimer=2;stageKills=0;history=[];challenge=0;closest=null;skillActive=0;scene.background.set(index===2?0xdce8cb:0xf2e8d5);scene.fog.color.copy(scene.background);sun.color.set(index===2?0xfff3d1:0xffedcf);const cd=innerWidth<700?7.2:6.7;camera.position.set(player.position.x-Math.sin(input.yaw)*cd,player.position.y+1.5+Math.sin(input.pitch)*cd,player.position.z-Math.cos(input.yaw)*cd);camera.lookAt(player.position.x,1,player.position.z-1.4);}
function menu(){orientationPaused=false;rotateScreen.classList.remove('visible');mode='menu';clearDynamic();input.clear();ui.showMenu();}
function pause(auto=false){if(mode==='paused'&&!auto){resume();return;}if(mode!=='playing')return;mode='paused';input.clear();ui.showPause();}
function resume(){if(mode!=='paused')return;if(innerHeight>innerWidth){orientationPaused=true;rotateScreen.classList.add('visible');return;}mode='playing';input.clear();ui.hideOverlay();audio.unlock();}
function choose(choice){if(mode!=='choice'&&mode!=='shop')return;if(mode==='shop'&&run.currency<30){ui.toast('零食币不足，可以直接前往下一关。');return;}applyChoice(run,choice);rebuildWeapons();audio.play('level');if(mode==='shop'){run.currency=Math.max(0,run.currency-30);ui.toast(`带上「${choice.name}」，继续冒险！`);nextStage();return;}pendingLevels=Math.max(0,pendingLevels-1);if(pendingLevels>0){ui.showChoices(rollChoices(run));}else{mode='playing';ui.hideOverlay();}}
function levelUp(){if(mode!=='playing'||pendingLevels<1)return;mode='choice';input.clear();audio.play('level');ui.showChoices(rollChoices(run),'小小身体，大大成长',`等级 ${run.level} · 选择一项，打造你的冒险套路`);}
function stageClear(){clearDynamic();if(run.stage===2){finish(true);return;}mode='shop';input.clear();stageReward=true;audio.play('win');const choices=rollChoices(run);hud();ui.showStageClear(run.stage,choices);}
function nextStage(){if(mode!=='shop')return;stageReward=false;loadStage(run.stage+1);mode='playing';ui.hideOverlay();ui.toast(STAGES[run.stage].story);}
function finish(win){mode='result';input.clear();best=Math.max(best,run.kills);try{localStorage.setItem('tiny-best',best);}catch{}audio.play(win?'win':'hurt');ui.showResult(win,{...run,best,time:run.totalTime,character:run.kind==='bubu'?'布布':'一二',weapons:run.weapons.map(w=>({...WEAPONS[w.id],name:w.level===5?WEAPONS[w.id].evolution:WEAPONS[w.id].name,level:w.level})),interactions:run.interactions});}
function nearest(max=20,front=false){
 let target=null,score=Infinity;const fx=Math.sin(input.yaw),fz=Math.cos(input.yaw);
 for(const e of enemies){if(e.dead)continue;const dx=e.x-player.position.x,dz=e.z-player.position.z,d=Math.hypot(dx,dz,e.y-player.position.y);if(d>max)continue;const dot=(dx*fx+dz*fz)/(d||1);if(front&&dot<-.15&&d>3)continue;if(world.segmentBlocked?.({x:player.position.x,y:player.position.y+.8,z:player.position.z},{x:e.x,y:e.y+e.height*.55,z:e.z},0))continue;const value=d*(1.3-dot*.4);if(value<score){score=value;target=e;}}
 return target;
}
function spawnEnemy(type='crumb',elite=false,pos=null){
 const mobile=matchMedia('(pointer:coarse)').matches||innerWidth<700;
 if(enemies.length>=(mobile?(quality==='low'?32:45):(quality==='low'?60:82))&&type!=='boss')return;
 let p=pos;
 if(!p){const a=Math.random()*Math.PI*2,dist=12+Math.random()*5;p={x:THREE.MathUtils.clamp(player.position.x+Math.sin(a)*dist,-16,16),z:THREE.MathUtils.clamp(player.position.z+Math.cos(a)*dist,-16,16)};if(Math.hypot(p.x-player.position.x,p.z-player.position.z)<7)p=world.spawnPoints[Math.floor(Math.random()*world.spawnPoints.length)];}
 const def=ENEMIES[type],wave=waveProfile(run.stage,run.time,STAGES[run.stage].duration),scale=wave.health*(elite?1.9:1);
 const mesh=createEnemy(type),ground=world.sampleGround?.(p.x,p.z,p.y||0)||{height:0};
 if(type!=='boss')mesh.traverse(m=>{if(m.isMesh)m.castShadow=false;});contactShadow(mesh,def.r);mesh.position.set(p.x,p.y??ground.height,p.z);if(elite)mesh.scale.multiplyScalar(1.3);dynamic.add(mesh);
 const e={type,mesh,x:p.x,y:p.y??ground.height,z:p.z,hp:def.hp*scale,maxHp:def.hp*scale,r:def.r*(elite?1.3:1),height:type==='boss'?2.8:type==='runner'?1.1:.85,baseScale:elite?1.3:1,damage:def.damage*(1.12+run.stage*.25)*(elite?1.25:1),speed:def.speed*wave.speed,xp:def.xp*(elite?3:1),timer:1+Math.random()*2,phase:'walk',slow:0,stun:0,dead:false,elite,motion:{vy:0,grounded:true,bodyHeight:type==='boss'?2.8:1},impulseX:0,impulseZ:0,seed:Math.random()*10,hitNumberCD:0};
 if(elite){const halo=new THREE.Mesh(eliteHaloGeo,mat(0xf8c25e));halo.position.y=1.3;halo.rotation.x=Math.PI/2;mesh.add(halo);e.halo=halo;}
 enemies.push(e);return e;
}
function damageEnemy(e,amount,kx=0,kz=0,knock=0,chain=true,sourceY=player.position.y,ranged=false){
 if(e.dead)return;
 const critical=Math.random()<run.crit;
 let value=amount*run.damage*combatBonus(combo,sourceY,e.y,ranged)*(critical?2:1);
 if(e.type==='tank'){
  const facing=Math.hypot(kx,kz)>.01?Math.atan2(-kx,-kz):Math.atan2(player.position.x-e.x,player.position.z-e.z);
  if(Math.abs(Math.atan2(Math.sin(facing-e.mesh.rotation.y),Math.cos(facing-e.mesh.rotation.y)))<.8){value*=.55;audio.play('block');}
 }
 e.hp-=value;e.mesh.userData.triggerHit?.(critical?1.3:.65);
 if(e.hitNumberCD<=0){fx.number(e.x,e.y+e.height+.25,e.z,value,critical);e.hitNumberCD=.13;}
 if(critical){audio.play('critical');hitStop=Math.max(hitStop,.036);}
 if(knock&&e.type!=='boss'){e.impulseX+=kx*knock*5;e.impulseZ+=kz*knock*5;e.stun=Math.max(e.stun,.14);}
 fx.burst(e.x,e.y+e.height*.55,e.z,critical?0xffcf59:0xffead0,critical?7:3);
 if(e.hp>0)return;
 e.dead=true;dynamic.remove(e.mesh);run.kills++;stageKills++;run.currency+=e.type==='boss'?30:e.elite?5:1;combo++;comboTimer=COMBO_WINDOW;
 if(combo%10===0){audio.play('combo',{count:combo});fx.ring(player.position.x,player.position.z,2.2,0xffd875,.4,player.position.y);}
 fx.burst(e.x,e.y+.5,e.z,e.type==='boss'?0xffd879:0xf3c993,e.type==='boss'?36:e.elite?18:8);
 dropXP(e.x,e.z,e.xp,e.y);
 if(run.leech&&run.kills%10===0)run.hp=Math.min(run.maxHp,run.hp+run.leech);
 if(run.kind==='bubu'&&run.kills%8===0)run.shield=Math.min(35+run.shieldBonus,run.shield+4);
 if(e.type==='splitter')for(let i=0;i<2;i++){const n=spawnEnemy('crumb',false,{x:e.x+(i-.5),y:e.y,z:e.z+.6});if(n){n.mesh.scale.multiplyScalar(.65);n.baseScale=.65;n.r=.25;n.hp*=.4;n.xp=1;}}
 if(chain&&run.chain&&Math.random()<Math.min(.8,run.chain))areaDamage(e.x,e.z,2*run.area,14,0xaed68e,false,e.y);
 if(e===boss){boss=null;stageEndCountdown=.7;hitStop=.07;}
}
function areaDamage(x,z,r,amount,color=0xffc66f,chain=true,y=player.position.y,verticalRange=1.25){
 fx.ring(x,z,r,color,.4,y);
 for(const e of enemies){const dx=e.x-x,dz=e.z-z,d=Math.hypot(dx,dz);if(!e.dead&&d<r+e.r&&verticalOverlap(y,verticalRange,e.y,e.height,.1))damageEnemy(e,amount,dx/(d||1),dz/(d||1),.7,chain,y);}
}
function dropXP(x,z,amount,y=0){
 if(drops.length>160){const old=drops.reduce((best,d)=>Math.hypot(d.x-x,d.z-z)<Math.hypot(best.x-x,best.z-z)?d:best,drops[0]);old.amount+=amount;return;}
 const mesh=new THREE.Mesh(xpGeo,mat(0xeec769));mesh.position.set(x,y+.25,z);dynamic.add(mesh);drops.push({x,y,z,amount,mesh,age:0});
}
function makeShot(opts){
 if(shots.length>180)return;
 const mesh=opts.mesh||new THREE.Mesh(sphereGeo,mat(opts.color||0x7c554b,opts.type==='bubble'));
 const y=opts.y??player.position.y+.72;mesh.position.set(opts.x,y,opts.z);dynamic.add(mesh);
 shots.push({age:0,life:3,r:.22,hit:new Set(),vy:0,sourceY:player.position.y,...opts,y,mesh});
}
function fireWeapon(w){
 const spec=WEAPONS[w.id],level=w.level,evolved=level===5,bonus=1+(level-1)*.34;
 const target=nearest(spec.range*run.area,true)||nearest(spec.range*run.area),p=player.position;
 const origin=new THREE.Vector3(p.x,p.y+.7,p.z);player.userData.getMuzzlePosition?.(w.id,origin);
 let dx=target?target.x-origin.x:Math.sin(input.yaw),dz=target?target.z-origin.z:Math.cos(input.yaw),d=Math.hypot(dx,dz)||1;
 dx/=d;dz/=d;
 const dy=target?THREE.MathUtils.clamp((target.y+target.height*.5-origin.y)/d,-.7,.7):0;
 const damage=spec.damage*bonus*(run.kind==='yier'&&input.movement(0).moving?1.12:1),range=spec.range*run.area;
 audio.play(w.id);
 if(w.id==='pan'){
  fx.slash(p.x,p.y+.55,p.z,Math.atan2(dx,dz),range*.8);let hits=0;
  for(const e of enemies){const x=e.x-p.x,z=e.z-p.z,l=Math.hypot(x,z);if(!e.dead&&l<range+e.r&&(x*dx+z*dz>-.5||evolved)&&verticalOverlap(p.y,1.25,e.y,e.height,.15)){damageEnemy(e,damage,x/(l||1),z/(l||1),evolved?1.8:1.05);hits++;}}
  if(hits){shake=Math.max(shake,.1);hitStop=Math.max(hitStop,.045);}
 }
 if(w.id==='tea'){
  const n=evolved?7:3+Math.floor(level/2);
  for(let i=0;i<n;i++){const a=(i-(n-1)/2)*.075;makeShot({type:'tea',x:origin.x,y:origin.y,z:origin.z,vx:(dx*Math.cos(a)-dz*Math.sin(a))*14,vz:(dz*Math.cos(a)+dx*Math.sin(a))*14,vy:dy*14,damage,life:1.3,pierce:Math.floor(level/2),color:0x725044});}
  fx.burst(origin.x,origin.y,origin.z,0xffe2a1,3,.3);
 }
 if(w.id==='slipper')for(let i=0;i<(evolved?3:1);i++){const a=(i-((evolved?3:1)-1)/2)*.4;makeShot({type:'slipper',x:origin.x,y:origin.y,z:origin.z,vx:(dx*Math.cos(a)-dz*Math.sin(a))*10,vz:(dz*Math.cos(a)+dx*Math.sin(a))*10,vy:dy*8,damage,life:2.3,mesh:createWeapon('slipper'),r:.5,returning:false});}
 if(w.id==='bubbles')for(let i=0;i<(evolved?6:1+Math.floor(level/2));i++){const a=(i-((evolved?6:1+Math.floor(level/2))-1)/2)*.24;makeShot({type:'bubble',x:origin.x,y:origin.y,z:origin.z,vx:(dx*Math.cos(a)-dz*Math.sin(a))*4,vz:(dz*Math.cos(a)+dx*Math.sin(a))*4,vy:dy*4,damage,life:3.3,r:.55,mesh:new THREE.Mesh(bubbleGeo,mat(0xa2dde5,true)),blast:1.2*run.area});}
 if(w.id==='bomb'){
  makeShot({type:'bomb',x:p.x-dx*.6,y:p.y+.5,z:p.z-dz*.6,vx:-dx*1.1,vz:-dz*1.1,vy:2,damage,life:evolved?1.1:1.7,r:0,blast:(evolved?5.2:3.2)*run.area,mesh:createWeapon('bomb')});
  fx.ring(p.x-dx*.6,p.z-dz*.6,3.2*run.area,0xf0ae6c,1.3,p.y);
 }
 if(w.id==='camera'){
  fx.slash(p.x,p.y+.7,p.z,Math.atan2(dx,dz),range,0xfff6d2);
  for(const e of enemies){const x=e.x-p.x,z=e.z-p.z,l=Math.hypot(x,z,e.y-p.y);if(!e.dead&&l<range&&((x*dx+z*dz)/(l||1)>(evolved?-.15:.4))){damageEnemy(e,damage,dx,dz,.25,true,p.y,true);e.stun=.5;}}
  shake=Math.max(shake,.08);
 }
 if(w.id==='scarf'){
  const angle=elapsed*2.5;fx.slash(p.x,p.y+.7,p.z,angle,range,0xf1a4c6);
  for(let i=0;i<(evolved?3:1);i++){const a=angle+i*2.1,x=p.x+Math.sin(a)*range,z=p.z+Math.cos(a)*range;for(const e of enemies){if(!e.dead&&Math.hypot(e.x-x,e.z-z)<1.3+e.r&&verticalOverlap(p.y,1.1,e.y,e.height))damageEnemy(e,damage);}}
 }
 if(w.id==='train'){
  const route=history.slice(-90).map(v=>({...v})),point=route[0]||p,mesh=createWeapon('train');mesh.scale.multiplyScalar(evolved?2:1.4);
  makeShot({type:'train',x:point.x,y:point.y+.15,z:point.z,vx:dx*9,vz:dz*9,damage,life:3.2,r:evolved?.9:.65,mesh,route,routeIndex:0});
 }
}
function useSkill(){if(mode!=='playing'||run.skillCD>0)return;run.skillCD=(run.kind==='yier'?7:11)/(1+run.skillHaste);skillActive=run.kind==='yier'?.38:2;invuln=Math.max(invuln,run.kind==='yier'?.5:1.8);audio.play('skill');fx.ring(player.position.x,player.position.z,run.kind==='yier'?2:4,run.kind==='yier'?0xf3a7a7:0xa4d5c2,.6,player.position.y);if(run.kind==='bubu'){run.shield=Math.min(80+run.shieldBonus,run.shield+18);ui.toast('抱枕守护 · 两秒后反击！');}else{const m=input.movement(0);player.userData.dash={x:m.moving?m.x:Math.sin(input.yaw),z:m.moving?m.z:Math.cos(input.yaw)};}}
function interact(){
 if(mode!=='playing'||!closest)return;const item=closest;if(item.cooldown>0)return;
 run.interactions++;item.active=true;item.cooldown=item.type==='snack'?999:item.type==='launch'?5:20;item.mesh.userData.trigger?.();audio.play('skill');
 const {x,z}=item,y=item.y??item.mesh.position.y??0;
 if(item.type==='launch'){
  motion.vy=12;motion.grounded=false;motion.fallDistance=0;invuln=Math.max(invuln,.3);player.userData.triggerAttack?.('jump');
  fx.ring(player.position.x,player.position.z,2,0xaee1ca,.5,player.position.y);ui.toast('弹起来！空中也能移动，落地震波会拍开敌群。');
 }else if(item.type==='fan'){
  for(const e of enemies){const d=Math.hypot(e.x-x,e.z-z);if(d<10&&Math.abs(e.y-y)<1.7){e.slow=4;damageEnemy(e,25,(e.x-x)/(d||1),(e.z-z)/(d||1),3,true,y);}}
  fx.ring(x,z,10,0xa7d9d8,.8,y);ui.toast('呼——风扇吹散了追兵！把敌群引来，效果更好。');
 }else if(item.type==='domino'){
  areaDamage(x,z,11,125,0xf4bd78,true,y);shake=.28;ui.toast('多米诺连锁！周围敌人受到重击。');
 }else if(item.type==='honey'){
  hazard(x,z,4,10,'honey',0xe4ad49,y);ui.toast('蜂蜜减速区！从高处射击，或把追兵引进来。');
 }else if(item.type==='kettle'||item.type==='sprinkler'){
  areaDamage(x,z,9,78,0xa7daed,true,y,3.5);for(const e of enemies)if(Math.hypot(e.x-x,e.z-z)<9)e.slow=5;ui.toast('水花四溅！高低处的敌人一起被冲散。');
 }else if(item.type==='mushroom'){
  run.hp=Math.min(run.maxHp,run.hp+25);motion.vy=12;motion.grounded=false;invuln=1;areaDamage(x,z,4,25,0xc6d894,true,y);ui.toast('蘑菇弹床 · 恢复生命，腾空后落地震击！');
 }else if(item.type==='snack'){
  challenge=18;for(let i=0;i<10;i++)spawnEnemy(i%3===0?'runner':'crumb',i===9);ui.toast('零食罐挑战！撑过 18 秒，获得额外成长与零食币。');
 }
 closest=null;
}
function hazard(x,z,r,life,type,color,y=0){
 const geometry=new THREE.CircleGeometry(r,40),material=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide}),mesh=new THREE.Mesh(geometry,material);
 mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y+.055,z);dynamic.add(mesh);hazards.push({x,y,z,r,life,type,mesh,timer:0});
}
function hurt(amount){
 if(invuln>0||mode!=='playing')return;const healthLost=mitigateDamage(run,amount);invuln=.65;shake=.2;player.userData.triggerHit?.(healthLost?1:.4);
 audio.play(healthLost?'hurt':'block');fx.burst(player.position.x,player.position.y+.8,player.position.z,healthLost?0xed9690:0xa8e4e2,10);
 hitStop=Math.max(hitStop,.045);
 document.body.classList.add('hurt');setTimeout(()=>document.body.classList.remove('hurt'),180);if(run.hp<=0)finish(false);
}
function updateEnemies(dt){
 const playerPos=player.position;
 for(const e of enemies){
  if(e.dead)continue;e.timer-=dt;e.slow=Math.max(0,e.slow-dt);e.stun=Math.max(0,e.stun-dt);e.hitNumberCD=Math.max(0,e.hitNumberCD-dt);
  const dx=playerPos.x-e.x,dz=playerPos.z-e.z,d=Math.hypot(dx,dz)||.001;
  const nav=world.getNavigationTarget?.({x:e.x,y:e.y,z:e.z,bodyHeight:e.height},playerPos)||playerPos;
  let nx=nav.x-e.x,nz=nav.z-e.z,nd=Math.hypot(nx,nz)||1,v=e.speed*(e.slow>0?.38:1);
  if(e.type==='runner'){
   if(e.phase==='walk'&&e.timer<0&&d<11&&Math.abs(e.y-playerPos.y)<.8){e.phase='wind';e.timer=.75;e.dx=dx/d;e.dz=dz/d;fx.slash(e.x,e.y+.08,e.z,Math.atan2(dx,dz),3.5,0xf19084);}
   else if(e.phase==='wind'){v=0;if(e.timer<0){e.phase='charge';e.timer=.65;e.mesh.userData.triggerAttack?.('charge');}}
   else if(e.phase==='charge'){nx=e.dx;nz=e.dz;nd=1;v=7.5;if(e.timer<0){e.phase='recover';e.timer=.5;}}
   else if(e.phase==='recover'){v=.3;if(e.timer<0){e.phase='walk';e.timer=2.5;}}
  }
  if(e.type==='shooter'){
   if(d<9&&d>4)v=0;if(d<=4&&Math.abs(e.y-playerPos.y)<.7){nx=-dx;nz=-dz;nd=d;v=.9;}
   if(e.phase==='walk'&&e.timer<0){
    const visible=(e.x-playerPos.x)*Math.sin(input.yaw)+(e.z-playerPos.z)*Math.cos(input.yaw)>-3;
    if(visible||e.elite){e.phase='wind';e.timer=.62;e.aim={x:playerPos.x+velocity.x*.15,y:playerPos.y+.55,z:playerPos.z+velocity.z*.15};fx.ring(e.aim.x,e.aim.z,.65,0xd98fbf,.62,playerPos.y);}else e.timer=.6;
   }else if(e.phase==='wind'){
    v=0;if(e.timer<0){const ax=e.aim.x-e.x,az=e.aim.z-e.z,ad=Math.hypot(ax,az)||1,shotY=e.y+.5,speed=e.elite?6.2:5.4;
     makeShot({type:'enemy',x:e.x,y:shotY,z:e.z,vx:ax/ad*speed,vz:az/ad*speed,vy:(e.aim.y-shotY)/ad*speed,sourceY:e.y,damage:e.damage,life:4,color:0xcc79b9,r:.24});
     e.mesh.userData.triggerAttack?.('shoot');e.phase='walk';e.timer=e.elite?1.8:2.5;
    }
   }
  }
  if(e.type==='boss'){
   if(e.timer<0){
    if(e.phase==='walk'){e.phase='wind';e.timer=1.15;fx.ring(e.x,e.z,5.5,0xf0907c,1.15,e.y);}
    else {e.phase='walk';e.timer=4.1;e.mesh.userData.triggerAttack?.('slam');hazard(e.x,e.z,5.5,.65,'boss',0xe78576,e.y);audio.play('land');
     for(let i=0;i<10;i++){const a=i*Math.PI/5;makeShot({type:'enemy',x:e.x,y:e.y+.5,z:e.z,vx:Math.sin(a)*4.6,vz:Math.cos(a)*4.6,sourceY:e.y,damage:e.damage*.7,life:3.5,color:0xc98e7d,r:.3});}
     if(playerPos.y>e.y+.9)makeShot({type:'enemy',x:e.x,y:e.y+1.8,z:e.z,vx:dx/d*6,vz:dz/d*6,vy:(playerPos.y+.6-e.y-1.8)/d*6,sourceY:e.y,damage:e.damage,life:4,color:0xe58f70,r:.35});
     for(let i=0;i<2;i++)spawnEnemy(run.stage===2?'shooter':'runner');
    }
   }
   if(e.phase==='wind')v=0;
  }
  if(e.stun>0)v=0;
  const move=world.moveActor({x:e.x,y:e.y,z:e.z},nx/nd*v*dt+e.impulseX*dt,nz/nd*v*dt+e.impulseZ*dt,e.r,dt,e.motion);
  e.x=move.x;e.y=move.y;e.z=move.z;e.motion={...move,bodyHeight:e.height};e.impulseX*=Math.exp(-dt*11);e.impulseZ*=Math.exp(-dt*11);
  e.mesh.position.set(e.x,e.y,e.z);e.mesh.userData.contactShadow.position.y=world.sampleGround(e.x,e.z,e.y,.05).height-e.y+.025;
  const face=e.phase==='charge'?Math.atan2(e.dx,e.dz):Math.atan2(dx,dz);
  e.mesh.rotation.y+=Math.atan2(Math.sin(face-e.mesh.rotation.y),Math.cos(face-e.mesh.rotation.y))*(1-Math.exp(-dt*9));
  e.mesh.userData.animate?.(elapsed+e.seed,Math.abs(v),e.phase==='wind'?1:0,dt,{phase:e.phase,airborne:!move.grounded});
  if(e.halo)e.halo.rotation.z+=dt;
  if(Math.hypot(e.x-playerPos.x,e.z-playerPos.z)<e.r+.38&&verticalOverlap(playerPos.y,1.15,e.y,e.height))hurt(e.damage);
 }
 // Separation is an impulse resolved through terrain next frame, never a wall-penetrating teleport.
 for(let i=0;i<enemies.length;i++){const a=enemies[i];if(a.dead)continue;for(let j=i+1;j<enemies.length;j++){const b=enemies[j];if(b.dead||Math.abs(a.y-b.y)>.8)continue;const dx=a.x-b.x,dz=a.z-b.z,d=Math.hypot(dx,dz),min=(a.r+b.r)*.82;if(d>.01&&d<min){const n=(min-d)*3;a.impulseX+=dx/d*n;a.impulseZ+=dz/d*n;b.impulseX-=dx/d*n;b.impulseZ-=dz/d*n;}}}
 enemies=enemies.filter(e=>!e.dead);
}
function updateShots(dt){
 for(let i=shots.length-1;i>=0;i--){
  const p=shots[i];p.age+=dt;p.life-=dt;let remove=false;const previous={x:p.x,y:p.y,z:p.z};
  if(p.type==='slipper'&&p.age>.7){const dx=player.position.x-p.x,dz=player.position.z-p.z,d=Math.hypot(dx,dz),targetY=player.position.y+.7;p.vx=dx/(d||1)*12;p.vz=dz/(d||1)*12;p.vy=(targetY-p.y)*7;if(!p.returning){p.hit.clear();p.returning=true;}if(d<.5&&Math.abs(targetY-p.y)<.6)remove=true;}
  if(p.type==='train'&&p.route?.length){const dest=p.route[Math.min(p.routeIndex,p.route.length-1)],dx=dest.x-p.x,dz=dest.z-p.z,d=Math.hypot(dx,dz);if(d<.5){p.routeIndex++;if(p.routeIndex>=p.route.length)p.route=[];}else{p.vx=dx/d*9;p.vz=dz/d*9;p.vy=(dest.y+.15-p.y)*10;}}
  p.x+=p.vx*dt;p.z+=p.vz*dt;p.y+=p.vy*dt;
  if(['tea','enemy','bubble'].includes(p.type)&&world.segmentBlocked(previous,p,.04)){dynamic.remove(p.mesh);shots.splice(i,1);fx.burst(p.x,p.y,p.z,0xf3d7aa,2,.3);continue;}
  if(p.type==='slipper'&&!p.returning&&world.segmentBlocked(previous,p,.04)){p.age=.71;p.x=previous.x;p.y=previous.y;p.z=previous.z;}
  if(p.type==='bomb'){
   p.vy-=22*dt;const floor=world.sampleGround(p.x,p.z,Math.max(previous.y,p.y),.1).height+.16;
   if(p.y<=floor){p.y=floor;p.vy=0;p.vx*=Math.exp(-dt*7);p.vz*=Math.exp(-dt*7);}
   p.mesh.scale.setScalar(1+Math.sin(p.age*22)*.08);
   if(p.life<=0){areaDamage(p.x,p.z,p.blast,p.damage,0xffc66f,true,p.y-.15,1.8);audio.play('blast');shake=Math.max(shake,.18);hitStop=Math.max(hitStop,.045);fx.burst(p.x,p.y,p.z,0xffb554,22,1.5);}
  }else{
   if(p.type==='enemy'){
    if(segmentHitsBody(previous,p,player.position,p.r+.35,1.25)){hurt(p.damage);remove=true;}
   }else for(const e of enemies){
    if(e.dead||p.hit.has(e)||!segmentHitsBody(previous,p,{x:e.x,y:e.y,z:e.z},e.r+p.r,e.height))continue;
    p.hit.add(e);damageEnemy(e,p.damage,p.vx/14,p.vz/14,p.type==='train'?.65:.08,true,p.sourceY,true);
    if(p.type==='bubble'){e.slow=2.5;areaDamage(p.x,p.z,p.blast,p.damage*.45,0xa5dce3,true,p.y-.4);audio.play('bubble');remove=true;break;}
    if(p.type==='tea'&&p.hit.size>(p.pierce||0)){remove=true;break;}
   }
   if(p.type==='tea'||p.type==='enemy'||p.type==='bubble'){
    const ground=world.sampleGround(p.x,p.z,Math.max(previous.y,p.y),.05).height;
    if(p.y<ground+.05||p.y<.02)remove=true;
   }
  }
  p.mesh.position.set(p.x,p.y+(p.type==='bubble'?Math.sin(p.age*4)*.08:0),p.z);
  if(p.type==='slipper')p.mesh.rotation.y+=dt*16;
  if(p.type==='train')p.mesh.rotation.y=Math.atan2(p.vx,p.vz);
  if(p.type==='bubble')p.mesh.scale.setScalar(1+p.age*.08);
  if(Math.abs(p.x)>20||Math.abs(p.z)>20||p.y>12)remove=true;
  if(p.life<=0||remove){dynamic.remove(p.mesh);shots.splice(i,1);}
 }
}
function updateDrops(dt){
 for(let i=drops.length-1;i>=0;i--){
  const d=drops[i];d.age+=dt;const dx=player.position.x-d.x,dz=player.position.z-d.z,dy=player.position.y-d.y,dist=Math.hypot(dx,dz,dy);
  if(dist<2.6*run.magnet){const v=Math.min(1,dt*(5+10/Math.max(.3,dist)));d.x+=dx*v;d.y+=dy*v;d.z+=dz*v;}
  d.mesh.position.set(d.x,d.y+.25+Math.sin(elapsed*3+i)*.07,d.z);d.mesh.rotation.y+=dt;
  if(dist<.6){pendingLevels+=awardXP(run,d.amount*(bonusXPTime>0?2:1));dynamic.remove(d.mesh);drops.splice(i,1);if(killSound<=0){audio.play('pickup');killSound=.1;}}
 }
}
function update(dt){
 run.time+=dt;run.totalTime+=dt;run.skillCD=Math.max(0,run.skillCD-dt);invuln=Math.max(0,invuln-dt);killSound-=dt;run.hp=Math.min(run.maxHp,run.hp+run.regen*dt);bonusXPTime=Math.max(0,bonusXPTime-dt);
 const movement=input.movement(dt);let speed=4.3*run.speed*(run.kind==='yier'?1.05:1),mx=movement.x,mz=movement.z;
 const oldSkill=skillActive;skillActive=Math.max(0,skillActive-dt);
 if(oldSkill>0&&skillActive===0&&run.kind==='bubu'){areaDamage(player.position.x,player.position.z,5.5*run.area,70,0xa6d8c5);shake=.2;audio.play('land');}
 if(skillActive>0&&run.kind==='yier'){
  speed=16;mx=player.userData.dash.x;mz=player.userData.dash.z;
  for(const e of enemies)if(!e.dead&&Math.hypot(e.x-player.position.x,e.z-player.position.z)<1.8&&verticalOverlap(player.position.y,1.2,e.y,e.height)){damageEnemy(e,25*dt*6);e.stun=.3;}
 }
 for(const h of hazards)if(h.type==='honey'&&Math.abs(player.position.y-h.y)<.5&&Math.hypot(player.position.x-h.x,player.position.z-h.z)<h.r)speed*=.55;
 if(skillActive>0&&run.kind==='bubu')speed*=.8;
 const accel=1-Math.exp(-dt*(skillActive>0?32:16));velocity.x+=(mx*speed-velocity.x)*accel;velocity.z+=(mz*speed-velocity.z)*accel;
 const p=world.moveActor(player.position,velocity.x*dt,velocity.z*dt,.38,dt,motion);motion={...p,bodyHeight:1.45};player.position.set(p.x,p.y,p.z);player.userData.contactShadow.position.y=world.sampleGround(p.x,p.z,p.y,.05).height-p.y+.025;
 if(p.landed){
  const impact=landingImpact(p.fallDistance);
  if(impact){areaDamage(p.x,p.z,impact.radius,impact.damage,0xffce80,true,p.y);audio.play('land',{intensity:p.fallDistance/3});shake=.2;hitStop=.045;fx.burst(p.x,p.y+.1,p.z,0xf7da9b,24,1.4);}
 }
 const route=world.elevatedRoutes[0],reward=route.reward;
 if(!highGroundReward&&Math.hypot(p.x-reward.x,p.z-reward.z)<reward.radius&&Math.abs(p.y-reward.y)<.4&&p.grounded){highGroundReward=true;world.collectRouteReward?.(route.id);bonusXPTime=20;run.currency+=15;pendingLevels+=awardXP(run,12);ui.toast('发现高台！获得 15 零食币，20 秒经验翻倍 · 高打低伤害 +20%');audio.play('level');}
 const target=nearest(12,true)||nearest(5),moving=Math.hypot(velocity.x,velocity.z)>.15;
 let faceTarget=moving?Math.atan2(velocity.x,velocity.z):player.rotation.y;
 if(target&&(!moving||Math.hypot(target.x-p.x,target.z-p.z)<6))faceTarget=Math.atan2(target.x-p.x,target.z-p.z);
 player.rotation.y+=Math.atan2(Math.sin(faceTarget-player.rotation.y),Math.cos(faceTarget-player.rotation.y))*(1-Math.exp(-dt*12));
 aimYaw=target?Math.atan2(Math.sin(Math.atan2(target.x-p.x,target.z-p.z)-player.rotation.y),Math.cos(Math.atan2(target.x-p.x,target.z-p.z)-player.rotation.y)):0;
 player.userData.animate?.(elapsed,Math.min(1.5,Math.hypot(velocity.x,velocity.z)/4.3),skillActive>0?1:0,dt,{aimYaw,airborne:!p.grounded,verticalVelocity:p.vy});player.visible=true;
 if(history.length===0||Math.hypot(history.at(-1).x-p.x,history.at(-1).z-p.z)>.16){history.push({x:p.x,y:p.y,z:p.z});if(history.length>110)history.shift();}
 attackLock=Math.max(0,attackLock-dt);
 for(const w of run.weapons)w.timer-=dt;
 if(attackLock<=0){const index=readyWeaponIndex(run.weapons,weaponCursor);if(index>=0){const w=run.weapons[index],delay=player.userData.triggerAttack?.(w.id)??.12;attackQueue.push({w,delay:Number.isFinite(delay)?delay:.12});w.timer=WEAPONS[w.id].cooldown/run.haste/(1+(w.level-1)*.09);attackLock=.16;weaponCursor=(index+1)%run.weapons.length;}}

 for(let i=attackQueue.length-1;i>=0;i--){attackQueue[i].delay-=dt;if(attackQueue[i].delay<=0){fireWeapon(attackQueue[i].w);attackQueue.splice(i,1);}}
 spawnTimer-=dt;
 if(spawnTimer<=0&&run.time<STAGES[run.stage].duration){const wave=waveProfile(run.stage,run.time,STAGES[run.stage].duration);for(let i=0;i<wave.count;i++)spawnEnemy(wave.types[Math.floor(Math.random()*wave.types.length)]);spawnTimer=wave.interval;}
 eliteTimer-=dt;
 if(eliteTimer<=0&&!bossSpawned){const type=run.time>70?'shooter':run.time>45?'tank':'runner';spawnEnemy(type,true);eliteTimer=30;ui.toast('精英来袭 · 留意金色光环，击败可获得更多经验！');}
 if(!bossSpawned&&run.time>=STAGES[run.stage].duration){bossSpawned=true;boss=spawnEnemy('boss',false,{x:THREE.MathUtils.clamp(p.x+Math.sin(input.yaw)*10,-15,15),z:THREE.MathUtils.clamp(p.z+Math.cos(input.yaw)*10,-15,15)});if(boss)boss.hp=boss.maxHp=[1100,1900,3000][run.stage];ui.toast(`${STAGES[run.stage].boss} 出现！利用高台与机关击败它。`);audio.play('blast');}
 if(challenge>0){challenge-=dt;if(challenge<=0){pendingLevels++;run.currency+=20;ui.toast('零食罐挑战完成 · 获得额外成长！');}}
 updateEnemies(dt);if(mode!=='playing')return;updateShots(dt);if(mode!=='playing')return;updateDrops(dt);
 closest=null;let closeDist=Infinity;
 for(const item of world.interactables){item.cooldown=Math.max(0,item.cooldown-dt);const y=item.y??item.mesh.position.y??0,d=Math.hypot(item.x-p.x,item.z-p.z);if(d<item.r&&Math.abs(p.y-y)<1.5&&item.cooldown<=0&&d<closeDist){closest=item;closeDist=d;}}
 for(let i=hazards.length-1;i>=0;i--){const h=hazards[i];h.life-=dt;h.timer-=dt;if(h.type==='honey'){for(const e of enemies)if(Math.abs(e.y-h.y)<.5&&Math.hypot(e.x-h.x,e.z-h.z)<h.r)e.slow=.3;}else if(h.type==='boss'&&h.timer<=0&&Math.hypot(p.x-h.x,p.z-h.z)<h.r&&Math.abs(p.y-h.y)<.8){hurt(22);h.timer=.7;}h.mesh.material.opacity=Math.min(.3,h.life*.3);if(h.life<=0){dynamic.remove(h.mesh);h.mesh.geometry.dispose();h.mesh.material.dispose();hazards.splice(i,1);}}
 if(mode!=='playing')return;comboTimer-=dt;if(comboTimer<=0)combo=0;
 if(stageEndCountdown>0){stageEndCountdown-=dt;if(stageEndCountdown<=0){stageClear();return;}}else if(pendingLevels>0)levelUp();
}
const camDesired=new THREE.Vector3(),camLook=new THREE.Vector3(),cameraRay=new THREE.Raycaster();
function updateCamera(dt){if(mode==='menu'){const a=.18+Math.sin(elapsed*.07)*.12;camera.position.lerp(new THREE.Vector3(8*Math.sin(a),4,-8*Math.cos(a)),.03);camera.lookAt(-2,.9,1);player.visible=true;player.userData.animate?.(elapsed,0,0);return;}
 const mobile=innerWidth<700,dist=mobile?7.2:6.7,focus=player.position.clone().add(new THREE.Vector3(Math.sin(input.yaw)*1.4,1.0,Math.cos(input.yaw)*1.4));camDesired.set(player.position.x-Math.sin(input.yaw)*dist,player.position.y+1.5+Math.sin(input.pitch)*dist,player.position.z-Math.cos(input.yaw)*dist);const direction=camDesired.clone().sub(focus),len=direction.length();cameraRay.set(focus,direction.normalize());cameraRay.far=len;const hits=cameraRay.intersectObjects(world.group.children,true).filter(h=>h.distance>1.5&&h.object.isMesh&&h.object.geometry.type!=='PlaneGeometry'&&h.point.y>.8);if(hits.length)camDesired.copy(focus).addScaledVector(direction,Math.max(.7,hits[0].distance-.35));camera.position.lerp(camDesired,1-Math.exp(-dt*8));camLook.copy(focus);camera.lookAt(camLook);if(shake>0){camera.position.x+=(Math.random()-.5)*shake;camera.position.y+=(Math.random()-.5)*shake;shake=Math.max(0,shake-dt);}}
function hud(){ui.update({...run,weaponSlots:run.weapons.map(w=>({...WEAPONS[w.id],name:w.level===5?WEAPONS[w.id].evolution:WEAPONS[w.id].name,level:w.level})),skillReady:run.skillCD<=0,skillCD:run.skillCD,interactLabel:closest?closest.label:'',objective:challenge>0?`零食罐挑战 · ${Math.ceil(challenge)} 秒`:boss?`击败 ${STAGES[run.stage].boss}`:`生存并成长 · ${Math.max(0,Math.ceil(STAGES[run.stage].duration-run.time))} 秒后首领`,bossHp:boss?.hp,bossMaxHp:boss?.maxHp,bossName:STAGES[run.stage].boss,threats:enemies.filter(e=>!e.dead&&Math.hypot(e.x-player.position.x,e.z-player.position.z)<7).map(e=>({angle:Math.atan2(Math.sin(input.yaw-Math.atan2(e.x-player.position.x,e.z-player.position.z)),Math.cos(input.yaw-Math.atan2(e.x-player.position.x,e.z-player.position.z))),distance:Math.hypot(e.x-player.position.x,e.z-player.position.z)})).filter(e=>Math.abs(e.angle)>1.4).sort((a,b)=>a.distance-b.distance).slice(0,3),combo,comboCount:combo,comboTimer,bonusXPTime,comboMaxTimer:COMBO_WINDOW,elevation:player.position.y,airborne:!motion.grounded,highGround:player.position.y>1.4,best});}
let displayFPS=60,frameCount=0,frameTime=0;
let previous=performance.now();function frame(now){requestAnimationFrame(frame);const dt=Math.min(.035,(now-previous)/1000);frameCount++;frameTime+=(now-previous)/1000;if(frameTime>=1){displayFPS=Math.round(frameCount/frameTime);frameCount=0;frameTime=0;}previous=now;elapsed+=dt;if(mode==='playing'&&innerHeight>innerWidth)ensureLandscape();if(mode==='playing'){hitStop=Math.max(0,hitStop-dt);const gameDt=hitStop>0?dt*.28:dt;update(gameDt);audio.update(dt);}world.update(elapsed,mode==='playing'||mode==='menu'?dt:0);fx.update(mode==='playing'||mode==='menu'?dt:0,camera);updateCamera(dt);if(mode!=='menu'&&now-lastHUD>90){hud();lastHUD=now;}protection.visible=mode!=='menu'&&(run.shield>0||invuln>0);protection.position.set(player.position.x,player.position.y+.065,player.position.z);protection.scale.setScalar(1+Math.sin(elapsed*4)*.06);renderer.render(scene,camera);}requestAnimationFrame(frame);
function ensureLandscape(){const portrait=innerHeight>innerWidth;if(portrait&&mode==='playing'){mode='paused';input.clear();orientationPaused=true;rotateScreen.classList.add('visible');}else if(!portrait&&orientationPaused){orientationPaused=false;rotateScreen.classList.remove('visible');mode='playing';ui.hideOverlay();}}
addEventListener('resize',()=>{ensureLandscape();camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});document.addEventListener('visibilitychange',()=>{if(document.hidden)pause(true);});canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();pause();ui.toast('画面暂时中断，请刷新页面重新进入。');});
document.getElementById('loading')?.remove();ui.showMenu();
// Read-only diagnostics for QA; no simulation shortcuts are exposed in production.
window.__tinyDiagnostics=()=>({mode,kind:run.kind,stage:run.stage,hp:run.hp,level:run.level,kills:run.kills,enemies:enemies.length,shots:shots.length,drops:drops.length,position:{x:player.position.x,y:player.position.y,z:player.position.z},grounded:motion.grounded,surface:motion.surfaceId,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles});

if(import.meta.env.DEV && new URLSearchParams(location.search).has('qa')) {
 const panel=document.createElement('div');panel.id='qa-panel';panel.style.cssText='position:fixed;bottom:100px;left:8px;z-index:99;display:flex;gap:4px;flex-wrap:wrap;max-width:260px;background:#fff9;padding:8px;border-radius:8px;font-size:11px';
 const actions={ '满血':()=>{run.hp=run.maxHp;run.shield=500;},'升级':()=>{pendingLevels++;levelUp();},'装备A':()=>{run.weapons=[{id:'slipper',level:5,timer:0},{id:'bubbles',level:5,timer:0},{id:'bomb',level:5,timer:0}];rebuildWeapons();},'装备B':()=>{run.weapons=[{id:'camera',level:5,timer:0},{id:'scarf',level:5,timer:0},{id:'train',level:5,timer:0}];rebuildWeapons();},'首领':()=>{run.time=STAGES[run.stage].duration;run.shield=500;},'击败首领':()=>{if(boss)damageEnemy(boss,100000);},'机关':()=>{closest=world.interactables[0];interact();},'庭院':()=>{pendingLevels=0;loadStage(2);run.shield=500;mode='playing';ui.hideOverlay();},'坡口':()=>{const point=world.elevatedRoutes?.[0]?.entrances?.[0];if(point){player.position.set(point.x,point.y,point.z);motion={vy:0,grounded:true};velocity={x:0,z:0};run.shield=500;ui.toast('测试：沿坡道向前走');}},'桥上':()=>{const point=world.elevatedRoutes?.[0]?.reward;if(point){player.position.set(point.x,point.y,point.z);motion={vy:0,grounded:true};velocity={x:0,z:0};run.shield=500;}},'弹跳':()=>{motion.vy=12;motion.grounded=false;},'怪物':()=>{for(const [i,type] of ['crumb','runner','shooter','tank','splitter'].entries())spawnEnemy(type,i===3,{x:player.position.x+(i-2)*1.4,y:player.position.y,z:player.position.z-5});},'失败':()=>{run.hp=0;finish(false);} };
 for(const [label,action] of Object.entries(actions)){const b=document.createElement('button');b.textContent=label;b.style.cssText='padding:6px;background:#fff;border:1px solid #aaa;border-radius:4px';b.onclick=action;panel.append(b);}const output=document.createElement('output');output.style.cssText='display:block;width:100%;font:10px monospace';panel.append(output);setInterval(()=>{output.textContent=`x ${player.position.x.toFixed(1)} y ${player.position.y.toFixed(2)} z ${player.position.z.toFixed(1)} · ${motion.surfaceId||'floor'} · ${motion.grounded?'ground':'air'} · ${renderer.info.render.calls} draws · ${displayFPS}fps`;},300);document.body.append(panel);
}
