import test from 'node:test';
import assert from 'node:assert/strict';
import {combatBonus,verticalOverlap,segmentHitsBody,waveProfile,landingImpact,readyWeaponIndex} from '../src/combat.js';
test('高台优势只加成从高处发出的远程伤害，连击有上限',()=>{
 assert.equal(combatBonus(0,3,0,true),1.2);
 assert.equal(combatBonus(0,3,0,false),1);
 assert.equal(combatBonus(0,0,3,true),1);
 assert.equal(combatBonus(100,0,0,true),1.2);
 assert.equal(combatBonus(-3),1);
});
test('桥上桥下近战和身体碰撞不能穿层',()=>{
 assert.equal(verticalOverlap(0,1,2.6,1),false);
 assert.equal(verticalOverlap(2.6,1.4,2.7,.8),true);
});
test('高速投射物穿过目标仍命中，跨层弹丸不会命中',()=>{
 const a={x:-1,y:.5,z:0},b={x:1,y:.5,z:0},e={x:0,y:0,z:0};
 assert.equal(segmentHitsBody(a,b,e,.4,.8),true);
 assert.equal(segmentHitsBody({...a,y:3},{...b,y:3},e,.4,.8),false);
 assert.equal(segmentHitsBody(a,b,{...e,z:1},.4,.8),false);
 assert.equal(segmentHitsBody({x:0,y:3,z:0},{x:0,y:2,z:0},{x:0,y:2,z:0},.4,.8),true);
});
test('难度随关卡和时间提升，保持明确上限',()=>{
 const first=waveProfile(0,0,150),late=waveProfile(0,150,150),last=waveProfile(2,180,180);
 assert.ok(late.speed>first.speed && last.health>late.health);
 assert.ok(late.types.includes('shooter') && late.types.includes('splitter'));
 assert.ok(last.interval>=.72 && last.count<=7);
});
test('小台阶不会触发落地大招，高台坠落伤害封顶',()=>{
 assert.equal(landingImpact(.5),null);
 assert.ok(landingImpact(2.6).damage>50);
 assert.equal(landingImpact(100).damage,90);
});

test('高攻速时轮换武器优先级，第三槽不会饿死',()=>{
 const weapons=[{timer:0,cooldown:.32,count:0},{timer:0,cooldown:.3,count:0},{timer:0,cooldown:.48,count:0}];let cursor=0,lock=0;
 for(let t=0;t<1800;t++){lock-=1/60;weapons.forEach(w=>w.timer-=1/60);if(lock>0)continue;const i=readyWeaponIndex(weapons,cursor);if(i>=0){const w=weapons[i];w.count++;w.timer=w.cooldown;cursor=(i+1)%weapons.length;lock=.16;}}
 assert.ok(weapons.every(w=>w.count>40));
});
