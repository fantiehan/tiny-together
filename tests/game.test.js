import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ABILITIES, WEAPONS, makeRun, rollChoices, applyChoice,
  awardXP, mitigateDamage, moveWithCollisions,
} from '../src/data.js';

const weapon = id => ({ type: 'weapon', id });
const ability = id => ({ type: 'ability', id });
const near = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-8, message || `${actual} should equal ${expected}`);
const bounds = { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };

test('一二和布布的生命、初始武器不同，独立开局不会共用成长状态', () => {
  const yier = makeRun('yier');
  const bubu = makeRun('bubu');
  assert.equal(yier.hp, 100);
  assert.equal(yier.maxHp, 100);
  assert.equal(yier.weapons[0].id, 'tea');
  assert.equal(bubu.hp, 120);
  assert.equal(bubu.maxHp, 120);
  assert.equal(bubu.weapons[0].id, 'pan');
  assert.equal(yier.level, 1);
  assert.equal(yier.shield, 0);
  applyChoice(yier, weapon('bubbles'));
  applyChoice(yier, ability('power'));
  assert.equal(bubu.weapons.length, 1);
  assert.deepEqual(bubu.abilities, {});
});

test('武器槽最多三格，满槽仍能升级已有武器', () => {
  const run = makeRun();
  applyChoice(run, weapon('pan'));
  applyChoice(run, weapon('bubbles'));
  applyChoice(run, weapon('bomb'));
  assert.deepEqual(run.weapons.map(w => w.id), ['tea', 'pan', 'bubbles']);
  applyChoice(run, weapon('pan'));
  assert.equal(run.weapons.find(w => w.id === 'pan').level, 2);
  const choices = rollChoices(run, () => .5);
  assert.ok(choices.filter(c => c.type === 'weapon').every(c => run.weapons.some(w => w.id === c.id)));
});

test('武器四级时显示进化选择，五级后不再升级或占用选项', () => {
  const run = makeRun();
  for (let i = 0; i < 3; i++) applyChoice(run, weapon('tea'));
  assert.equal(run.weapons[0].level, 4);
  const evolution = rollChoices(run, () => 0).find(c => c.id === 'tea');
  assert.ok(evolution);
  assert.match(evolution.tag, /进化/);
  assert.match(evolution.description, new RegExp(WEAPONS.tea.evolution));
  applyChoice(run, evolution);
  for (let i = 0; i < 8; i++) applyChoice(run, weapon('tea'));
  assert.equal(run.weapons[0].level, 5);
  assert.ok(rollChoices(run, () => 0).every(c => c.id !== 'tea'));
});

test('每种能力最多四层，额外选择不会继续改变属性', () => {
  for (const id of Object.keys(ABILITIES)) {
    const run = makeRun();
    for (let i = 0; i < 4; i++) applyChoice(run, ability(id));
    const snapshot = structuredClone(run);
    for (let i = 0; i < 3; i++) applyChoice(run, ability(id));
    assert.equal(run.abilities[id], 4, id);
    assert.deepEqual(run, snapshot, `${id}: capped choice must have no effect`);
    assert.ok(rollChoices(run, () => .4).every(c => !(c.type === 'ability' && c.id === id)));
  }
});

test('生命成长同时治疗但不超过新上限，护盾能力立即生效', () => {
  const run = makeRun();
  run.hp = 35;
  applyChoice(run, ability('health'));
  assert.equal(run.maxHp, 120);
  assert.equal(run.hp, 55);
  applyChoice(run, ability('shield'));
  assert.equal(run.shield, 25);
  assert.equal(run.shieldBonus, 25);
});

test('大量经验能连续升级，保留余量，拆分拾取与一次拾取结果相同', () => {
  const large = makeRun();
  assert.equal(awardXP(large, 100), 3);
  assert.equal(large.level, 4);
  assert.equal(large.xp, 28);
  assert.equal(large.xpNext, 42);
  const small = makeRun();
  let upgrades = 0;
  for (let i = 0; i < 100; i++) upgrades += awardXP(small, 1);
  assert.equal(upgrades, 3);
  assert.deepEqual([small.level, small.xp, small.xpNext], [large.level, large.xp, large.xpNext]);
  assert.equal(awardXP(large, 14), 1);
  assert.equal(large.xp, 0);
  assert.equal(large.level, 5);
});

test('经验增益只应用一次，未达到阈值时不触发升级', () => {
  const run = makeRun();
  applyChoice(run, ability('lucky'));
  assert.equal(awardXP(run, 5), 0);
  near(run.xp, 6);
  assert.equal(awardXP(run, 5), 1);
  near(run.xp, 0);
});

test('先计算护甲再消耗护盾，护盾足够时生命不变', () => {
  const run = makeRun();
  run.armor = .2;
  run.shield = 20;
  near(mitigateDamage(run, 10), 0);
  near(run.shield, 12);
  near(run.hp, 100);
  near(mitigateDamage(run, 20), 4);
  near(run.shield, 0);
  near(run.hp, 96);
});

test('护甲减伤上限为50%，受到致命伤害后生命不会为负', () => {
  const run = makeRun();
  run.armor = 10;
  near(mitigateDamage(run, 20), 10);
  near(run.hp, 90);
  mitigateDamage(run, 1000);
  assert.equal(run.hp, 0);
  assert.equal(run.shield, 0);
});

test('移动边界考虑角色半径，斜向移动也不能超出场地', () => {
  assert.deepEqual(moveWithCollisions(0, 0, 100, -100, .5, [], bounds), { x: 9.5, z: -9.5 });
  assert.deepEqual(moveWithCollisions(-9.5, 9.5, -1, 1, .5, [], bounds), { x: -9.5, z: 9.5 });
  assert.deepEqual(moveWithCollisions(2, 3, .2, -.4, .5, [], bounds), { x: 2.2, z: 2.6 });
});

test('圆形障碍把角色推出重叠区，中心重叠也产生有限坐标', () => {
  const obstacles = [{ x: 0, z: 0, r: 1 }];
  const displaced = moveWithCollisions(1.6, 0, -.4, 0, .5, obstacles, bounds);
  near(displaced.x, 1.5);
  near(displaced.z, 0);
  const center = moveWithCollisions(0, 0, 0, 0, .5, obstacles, bounds);
  assert.ok(Number.isFinite(center.x) && Number.isFinite(center.z));
  near(Math.hypot(center.x, center.z), 1.5);
  const free = moveWithCollisions(1.6, 0, .3, .4, .5, obstacles, bounds);
  near(free.x, 1.9);
  near(free.z, .4);
});

test('成长选项唯一、有效，并保证可升级的已有武器出现', () => {
  const run = makeRun();
  applyChoice(run, weapon('slipper'));
  let seed = 147;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let i = 0; i < 100; i++) {
    const choices = rollChoices(run, random);
    assert.equal(choices.length, 3);
    assert.equal(new Set(choices.map(c => c.id)).size, 3);
    assert.ok(choices.every(c => c.type === 'weapon' ? WEAPONS[c.id] : ABILITIES[c.id]));
    assert.ok(choices.some(c => c.type === 'weapon' && run.weapons.some(w => w.id === c.id && w.level < 5)));
  }
});

test('全部成长选满时提供恢复兜底，治疗不会超出生命上限', () => {
  const run = makeRun();
  applyChoice(run, weapon('pan'));
  applyChoice(run, weapon('bubbles'));
  for (const w of run.weapons) w.level = 5;
  for (const id of Object.keys(ABILITIES)) run.abilities[id] = 4;
  const choices = rollChoices(run, () => 0);
  assert.equal(choices.length, 1);
  assert.equal(choices[0].type, 'heal');
  assert.equal(choices[0].id, 'snack-heal');
  run.hp = 35;
  applyChoice(run, choices[0]);
  assert.equal(run.hp, 65);
  run.hp = 90;
  applyChoice(run, choices[0]);
  assert.equal(run.hp, run.maxHp);
});

test('靠边圆形障碍不会在边界裁切后再次重叠', () => {
  const obstacles = [{ x: 9, z: 0, r: 1 }];
  const point = moveWithCollisions(9, 0, 0, 0, .5, obstacles, bounds);
  assert.ok(point.x >= -9.5 && point.x <= 9.5);
  assert.ok(point.z >= -9.5 && point.z <= 9.5);
  assert.ok(Math.hypot(point.x - 9, point.z) >= 1.5 - 1e-7);
});

test('多个相邻圆形障碍与场地边缘夹角仍能找到合法脱离点', () => {
  const obstacles = [{ x: 8.8, z: 0, r: 1 }, { x: 8.8, z: 1.5, r: 1 }];
  const point = moveWithCollisions(9.1, .7, 0, 0, .5, obstacles, bounds);
  assert.ok(Number.isFinite(point.x) && Number.isFinite(point.z));
  assert.ok(point.x >= -9.5 && point.x <= 9.5);
  assert.ok(point.z >= -9.5 && point.z <= 9.5);
  for (const obstacle of obstacles) assert.ok(Math.hypot(point.x-obstacle.x, point.z-obstacle.z) >= 1.5 - 1e-7);
});

test('多障碍求解最终位置不重新挤进先前障碍', () => {
  const obstacles = [{ x: -.8, z: 0, r: 1 }, { x: .8, z: 0, r: 1 }];
  const point = moveWithCollisions(0, 0, 0, 0, .5, obstacles, bounds);
  for (const obstacle of obstacles) assert.ok(Math.hypot(point.x-obstacle.x, point.z-obstacle.z) >= 1.5 - 1e-7);
});
