export class Input {
 constructor(canvas,callbacks={}){
  this.keys=new Set();this.joy={x:0,y:0};this.yaw=0;this.pitch=.46;this.lastLook=0;this.dragging=false;this.callbacks=callbacks;
  this.moveId=null;this.lookId=null;
  this.moveZone=document.getElementById('move-zone');
  this.joystick=document.getElementById('joystick');
  this.knob=document.getElementById('joystick-knob');
  addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();if(!e.repeat){if(e.code==='Space')callbacks.skill?.();if(e.code==='KeyF')callbacks.interact?.();if(e.code==='Escape')callbacks.pause?.();}this.keys.add(e.code);});
  addEventListener('keyup',e=>this.keys.delete(e.code));
  addEventListener('blur',()=>{this.clear();callbacks.pause?.(true);});
  addEventListener('resize',()=>this.clear());
  document.addEventListener('visibilitychange',()=>{if(document.hidden){this.clear();callbacks.pause?.(true);}});

  const lookDown=e=>{
   if(this.lookId!==null||e.button!==0||(e.pointerType==='touch'&&e.clientX<innerWidth*.45))return;
   this.dragging=true;this.lookId=e.pointerId;this.lookTarget=e.currentTarget;this.prev={x:e.clientX,y:e.clientY};
   try{this.lookTarget.setPointerCapture(e.pointerId);}catch{}
  };
  const lookMove=e=>{
   if(!this.dragging||e.pointerId!==this.lookId)return;
   this.yaw-=(e.clientX-this.prev.x)*.005;this.pitch=Math.max(.2,Math.min(.75,this.pitch+(e.clientY-this.prev.y)*.003));
   this.prev={x:e.clientX,y:e.clientY};this.lastLook=performance.now();
  };
  for(const el of [canvas,document.getElementById('look-zone')].filter(Boolean)){
   el.addEventListener('pointerdown',lookDown);el.addEventListener('pointermove',lookMove);
   for(const name of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(name,e=>{if(e.pointerId===this.lookId)this.endLook();});
   el.addEventListener('contextmenu',e=>e.preventDefault());
  }
  if(this.moveZone&&this.joystick){
   this.moveZone.addEventListener('pointerdown',e=>{
    if(this.moveId!==null||e.button!==0)return;
    e.preventDefault();this.moveId=e.pointerId;
    // Keep the origin at the actual touch, even when the ring overlaps a screen edge.
    this.origin={x:e.clientX,y:e.clientY};this.joy={x:0,y:0};
    this.joystick.style.left=`${e.clientX}px`;this.joystick.style.top=`${e.clientY}px`;this.joystick.hidden=false;
    this.moveZone.dataset.active='true';this.radius=this.joystick.getBoundingClientRect().width*.32;
    if(this.knob)this.knob.style.transform='translate(-50%, -50%)';
    try{this.moveZone.setPointerCapture(e.pointerId);}catch{}
   });
   this.moveZone.addEventListener('pointermove',e=>{
    if(e.pointerId!==this.moveId)return;
    e.preventDefault();const dx=e.clientX-this.origin.x,dy=e.clientY-this.origin.y,d=Math.max(this.radius,Math.hypot(dx,dy));
    this.joy={x:dx/d,y:dy/d};
    if(this.knob)this.knob.style.transform=`translate(-50%, -50%) translate(${this.joy.x*this.radius}px, ${this.joy.y*this.radius}px)`;
   });
   for(const name of ['pointerup','pointercancel','lostpointercapture'])this.moveZone.addEventListener(name,e=>{if(e.pointerId===this.moveId)this.endJoystick();});
   this.moveZone.addEventListener('contextmenu',e=>e.preventDefault());
  }
  document.getElementById('skill-btn')?.addEventListener('click',e=>{e.preventDefault();callbacks.skill?.();});
  document.getElementById('interact-btn')?.addEventListener('click',e=>{e.preventDefault();callbacks.interact?.();});
 }
 endJoystick(){
  const id=this.moveId;this.moveId=null;this.origin=null;this.joy={x:0,y:0};
  if(this.joystick)this.joystick.hidden=true;
  if(this.knob)this.knob.style.transform='translate(-50%, -50%)';
  if(this.moveZone){delete this.moveZone.dataset.active;try{if(id!==null)this.moveZone.releasePointerCapture(id);}catch{}}
 }
 endLook(){
  const id=this.lookId,target=this.lookTarget;this.lookId=null;this.lookTarget=null;this.dragging=false;
  try{if(id!==null)target?.releasePointerCapture(id);}catch{}
 }
 movement(dt){let x=(this.keys.has('KeyD')||this.keys.has('ArrowRight')?1:0)-(this.keys.has('KeyA')||this.keys.has('ArrowLeft')?1:0)+this.joy.x,z=(this.keys.has('KeyW')||this.keys.has('ArrowUp')?1:0)-(this.keys.has('KeyS')||this.keys.has('ArrowDown')?1:0)-this.joy.y;const len=Math.max(1,Math.hypot(x,z));x/=len;z/=len;if(this.keys.has('KeyQ'))this.yaw+=dt*1.8;if(this.keys.has('KeyE'))this.yaw-=dt*1.8;return {x:-x*Math.cos(this.yaw)+z*Math.sin(this.yaw),z:x*Math.sin(this.yaw)+z*Math.cos(this.yaw),moving:Math.hypot(x,z)>.05};}
 clear(){this.keys.clear();this.endJoystick();this.endLook();}
}
