import test from 'node:test';
import assert from 'node:assert/strict';
import {Input} from '../src/input.js';

class Surface {
 constructor(){this.listeners=new Map();this.style={};this.dataset={};this.hidden=false;this.captured=new Set();}
 addEventListener(name,fn){if(!this.listeners.has(name))this.listeners.set(name,[]);this.listeners.get(name).push(fn);}
 emit(name,props={}){const e={pointerId:1,pointerType:'touch',button:0,clientX:200,clientY:170,currentTarget:this,target:this,preventDefault(){},...props};for(const fn of this.listeners.get(name)||[])fn(e);}
 getBoundingClientRect(){return {width:100};}
 setPointerCapture(id){this.captured.add(id);}
 releasePointerCapture(id){if(this.captured.delete(id))this.emit('lostpointercapture',{pointerId:id});}
}
function fixture(t){
 const names=['move-zone','joystick','joystick-knob','look-zone','skill-btn','interact-btn'];
 const elements=Object.fromEntries(names.map(n=>[n,new Surface()]));elements.joystick.hidden=true;
 const win=new Surface(),doc=new Surface(),canvas=new Surface();doc.getElementById=id=>elements[id];doc.hidden=false;
 const globals={document:doc,innerWidth:1000,addEventListener:win.addEventListener.bind(win)};
 for(const [key,value] of Object.entries(globals)){
  const old=Object.getOwnPropertyDescriptor(globalThis,key);Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
  t.after(()=>{if(old)Object.defineProperty(globalThis,key,old);else delete globalThis[key];});
 }
 const calls={skill:0,interact:0,pause:0};
 const input=new Input(canvas,Object.fromEntries(Object.keys(calls).map(key=>[key,()=>calls[key]++])));
 return {input,win,doc,canvas,calls,move:elements['move-zone'],look:elements['look-zone'],ring:elements.joystick,...elements};
}

test('浮动摇杆从每次手指落点起步，边缘按下不会让角色突然移动',t=>{
 const {input,move,ring}=fixture(t);
 for(const [x,y] of [[210,120],[8,385],[435,20]]){
  move.emit('pointerdown',{clientX:x,clientY:y});
  assert.equal(ring.hidden,false);assert.equal(ring.style.left,`${x}px`);assert.equal(ring.style.top,`${y}px`);
  assert.equal(input.movement(0).moving,false);
  move.emit('pointermove',{clientX:x+16,clientY:y-16});
  assert.deepEqual(input.joy,{x:.5,y:-.5});
  move.emit('pointerup');assert.equal(ring.hidden,true);assert.equal(input.movement(0).moving,false);
 }
});
test('拖出左侧区域仍由原手指控制，移动速度不会超出上限',t=>{
 const {input,move}=fixture(t);move.emit('pointerdown');
 move.emit('pointermove',{clientX:800,clientY:400});
 assert.ok(Math.abs(Math.hypot(input.joy.x,input.joy.y)-1)<1e-10);
 assert.equal(move.captured.has(1),true);assert.equal(input.yaw,0);
 move.emit('pointerup');assert.equal(move.captured.size,0);
});
test('第二根左侧手指不能抢走摇杆，松开它不会停止移动',t=>{
 const {input,move,ring}=fixture(t);move.emit('pointerdown');
 move.emit('pointermove',{clientX:232});
 move.emit('pointerdown',{pointerId:2,clientX:300});
 move.emit('pointermove',{pointerId:2,clientX:100});move.emit('pointerup',{pointerId:2});
 assert.equal(ring.style.left,'200px');assert.equal(input.joy.x,1);assert.equal(input.moveId,1);
 move.emit('pointerup');assert.equal(input.joy.x,0);
});
test('双指移动和转向相互独立，点技能与互动保留移动',t=>{
 const f=fixture(t),{input,move,look,calls}=f;
 move.emit('pointerdown');move.emit('pointermove',{clientX:232});
 look.emit('pointerdown',{pointerId:2,clientX:600});look.emit('pointermove',{pointerId:2,clientX:620});
 assert.equal(input.joy.x,1);assert.equal(input.yaw,-.1);
 look.emit('pointerdown',{pointerId:3,clientX:700});look.emit('pointerup',{pointerId:3});
 assert.equal(input.lookId,2);assert.equal(input.dragging,true);
 f['skill-btn'].emit('click');f['interact-btn'].emit('click');assert.equal(calls.skill,1);assert.equal(calls.interact,1);assert.equal(input.joy.x,1);
 move.emit('pointerup');assert.equal(input.dragging,true);
 look.emit('pointerup',{pointerId:2});assert.equal(input.dragging,false);
});
test('暂停清理输入后，仍未离屏的旧手指无法恢复移动或视角',t=>{
 const {input,move,look,ring,win}=fixture(t);move.emit('pointerdown');move.emit('pointermove',{clientX:232});
 look.emit('pointerdown',{pointerId:2,clientX:600});win.emit('keydown',{code:'KeyW'});
 input.clear();move.emit('pointermove',{clientX:300});look.emit('pointermove',{pointerId:2,clientX:650});
 assert.equal(input.movement(0).moving,false);assert.equal(input.yaw,0);assert.equal(ring.hidden,true);
 assert.equal(move.captured.size,0);assert.equal(look.captured.size,0);assert.equal(input.moveId,null);assert.equal(input.lookId,null);
 move.emit('pointerup');move.emit('pointerdown',{clientX:300});move.emit('pointermove',{clientX:332});assert.equal(input.joy.x,1);
});
test('系统取消或丢失捕获时归零；旋屏和切出页面同时清理两个手势',t=>{
 const {input,move,look,ring,win,doc,calls}=fixture(t);
 const reset=()=>{move.emit('pointerdown');move.emit('pointermove',{clientX:232});look.emit('pointerdown',{pointerId:2,clientX:600});};
 for(const reason of ['pointercancel','lostpointercapture']){
  reset();move.emit(reason);look.emit(reason,{pointerId:2});
  assert.equal(input.movement(0).moving,false);assert.equal(input.dragging,false);assert.equal(ring.hidden,true);
 }
 for(const reason of ['resize','blur']){reset();win.emit(reason);assert.equal(input.moveId,null);assert.equal(input.lookId,null);}
 reset();doc.hidden=true;doc.emit('visibilitychange');assert.equal(ring.hidden,true);assert.equal(input.dragging,false);assert.equal(calls.pause,2);
});
test('桌面 WASD 和鼠标视角仍正常，右键不启动手势',t=>{
 const {input,win,canvas,move}=fixture(t);
 win.emit('keydown',{code:'KeyW'});assert.equal(input.movement(0).z,1);win.emit('keyup',{code:'KeyW'});assert.equal(input.movement(0).moving,false);
 canvas.emit('pointerdown',{pointerType:'mouse',clientX:100});canvas.emit('pointermove',{pointerType:'mouse',clientX:120});assert.equal(input.yaw,-.1);
 canvas.emit('pointerup');canvas.emit('pointerdown',{pointerType:'mouse',button:2});move.emit('pointerdown',{pointerType:'mouse',button:2});
 assert.equal(input.dragging,false);assert.equal(input.moveId,null);
});
