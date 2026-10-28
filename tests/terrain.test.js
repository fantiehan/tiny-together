import test from 'node:test';
import assert from 'node:assert/strict';
import { createTerrain, createRoomRoute, sampleGround, GRAVITY } from '../src/terrain.js';

function room(stage = 0) {
  const route = createRoomRoute(stage);
  return { ...createTerrain({ ...route, bounds: { minX: -17, maxX: 17, minZ: -17, maxZ: 17 } }), route };
}
function approach(terrain, state, target, frames = 1000, speed = 3) {
  let p = state;
  for (let i = 0; i < frames; i++) {
    const dx = target.x - p.x, dz = target.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.12) break;
    const amount = Math.min(speed / 60, d);
    p = terrain.moveActor(p, dx / d * amount, dz / d * amount, 0.32, 1 / 60, p);
  }
  return p;
}

test('ground sampling never snaps a floor actor onto an overhead bridge', () => {
  const terrain = room(); const r = terrain.route.reward;
  assert.equal(terrain.sampleGround(r.x, r.z, 0).height, 0);
  assert.equal(terrain.sampleGround(r.x, r.z, 2.6).height, 2.6);
  assert.equal(sampleGround(terrain.surfaces, r.x, r.z, 0, Infinity).surfaceId, 'bridge');
});

test('ramp side walls block ground actors instead of teleporting them upward', () => {
  const terrain = room();
  const p = approach(terrain, { x: -3, y: 0, z: -8.5, vy: 0, grounded: true }, { x: -7.5, z: -8.5 });
  assert.equal(p.y, 0);
  assert.ok(p.x > -5.75, `actor unexpectedly entered ramp: ${JSON.stringify(p)}`);
});

for (const stage of [0, 1, 2]) test(`stage ${stage + 1} has a continuously walkable ramp-platform-bridge-exit route`, () => {
  const terrain = room(stage);
  let p = { ...terrain.route.nodes[0], vy: 0, grounded: true };
  let maxY = 0;
  for (const node of terrain.route.nodes.slice(1)) {
    p = approach(terrain, p, node);
    maxY = Math.max(maxY, p.y);
    assert.ok(Math.hypot(p.x - node.x, p.z - node.z) < 0.18, `could not reach ${node.id}: ${JSON.stringify(p)}`);
    assert.ok(Math.abs(p.y - node.y) < 0.15, `wrong height at ${node.id}: ${p.y}, expected ${node.y}`);
  }
  assert.ok(maxY >= terrain.route.height - 0.02);
  assert.ok(p.y < 0.05 && p.grounded);
});

test('thin bridge leaves real clearance to walk underneath', () => {
  const terrain = room(); const r = terrain.route.reward;
  const p = approach(terrain, { x: r.x, y: 0, z: -15, vy: 0, grounded: true }, { x: r.x, z: -9 });
  assert.ok(p.z > -9.2);
  assert.equal(p.y, 0);
});

test('walking off the bridge falls with gravity and reports impact height', () => {
  const terrain = room(); const r = terrain.route.reward;
  let p = { ...r, vy: 0, grounded: true }; let impact = 0;
  for (let i = 0; i < 180; i++) {
    p = terrain.moveActor(p, 0, 0.045, 0.32, 1 / 60, p);
    if (p.landed) impact = Math.max(impact, p.fallDistance);
  }
  assert.equal(p.y, 0); assert.ok(p.grounded);
  assert.ok(impact > 2.5 && impact < 2.7, `wrong fall impact: ${impact}`);
});

test('launch follows a ballistic arc and lands rather than retaining airborne height', () => {
  const terrain = room(); let p = { x: 0, y: 0, z: 0, vy: 12, grounded: false }; let peak = 0;
  for (let i = 0; i < 120; i++) { p = terrain.moveActor(p, 0, 0, 0.32, 1 / 60, p); peak = Math.max(peak, p.y); }
  assert.equal(GRAVITY, 22);
  assert.ok(peak > 3 && peak < 3.3); assert.equal(p.y, 0); assert.equal(p.vy, 0); assert.ok(p.grounded);
});

test('ground pursuer navigates to ramp entrances and reaches a player on the bridge', () => {
  const terrain = room(); const target = terrain.route.reward;
  let p = { x: 0, y: 0, z: 2, vy: 0, grounded: true };
  const first = terrain.getNavigationTarget(p, target);
  assert.equal(first.y, 0, 'must approach a ground entrance instead of the bridge overhead');
  for (let i = 0; i < 1800 && Math.hypot(p.x - target.x, p.z - target.z) > 0.35; i++) {
    const waypoint = terrain.getNavigationTarget(p, target);
    const dx = waypoint.x - p.x, dz = waypoint.z - p.z, d = Math.hypot(dx, dz);
    if (d < 0.001) continue;
    p = terrain.moveActor(p, dx / d * 2.5 / 60, dz / d * 2.5 / 60, 0.32, 1 / 60, p);
  }
  assert.ok(Math.hypot(p.x - target.x, p.z - target.z) < 0.5, JSON.stringify(p));
  assert.ok(p.y > 2.5, 'pursuer must actually climb the ramp');
});

test('projectile segments hit solid book walls and bridge slabs but clear the open underside', () => {
  const terrain = room(); const r = terrain.route.reward;
  assert.ok(terrain.segmentBlocked({ x: -13, y: 1, z: -12 }, { x: -8, y: 1, z: -12 }));
  assert.ok(terrain.segmentBlocked({ x: r.x, y: 2.5, z: -14 }, { x: r.x, y: 2.5, z: -10 }));
  assert.equal(terrain.segmentBlocked({ x: r.x, y: 1, z: -14 }, { x: r.x, y: 1, z: -10 }), false);
  assert.equal(terrain.segmentBlocked({ x: r.x, y: 3.3, z: -14 }, { x: r.x, y: 3.3, z: -10 }), false);
});

test('tall floor enemies receive a ground detour around insufficient bridge clearance', () => {
  const terrain = room();
  const next = terrain.getNavigationTarget({ x: 0, y: 0, z: 0, bodyHeight: 2.8 }, { x: 0, y: 0, z: -16 });
  assert.equal(next.waypointId, 'ground-bypass');
  assert.ok(next.x > 7.5 || next.x < -10.5);
});

test('edge-circle pressure never clamps actors back inside obstacles', () => {
  const bounds = { minX: -17, maxX: 17, minZ: -17, maxZ: 17 };
  let seed = 12345;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let side = 0; side < 4; side++) {
    const center = side === 0 ? { x: 16.8, z: 0 } : side === 1 ? { x: -16.8, z: 0 } : side === 2 ? { x: 0, z: 16.8 } : { x: 0, z: -16.8 };
    const obstacle = { ...center, r: 2.2 };
    const terrain = createTerrain({ bounds, obstacles: [obstacle] });
    let p = { x: 0, y: 0, z: 0, vy: 0, grounded: true };
    for (let i = 0; i < 2400; i++) {
      const dx = center.x - p.x + (random() - 0.5) * 7, dz = center.z - p.z + (random() - 0.5) * 7, d = Math.hypot(dx, dz) || 1;
      p = terrain.moveActor(p, dx / d * 0.11, dz / d * 0.11, 0.4, 1 / 60, p);
      assert.ok(p.x >= -16.6 - 1e-5 && p.x <= 16.6 + 1e-5 && p.z >= -16.6 - 1e-5 && p.z <= 16.6 + 1e-5);
      assert.ok(Math.hypot(p.x - center.x, p.z - center.z) >= 2.6 - 1e-5, `side ${side} collision at ${JSON.stringify(p)}`);
    }
  }
});

test('a solid platform intersecting the arena edge blocks its reachable sides', () => {
  const terrain = createTerrain({ bounds: { minX: -17, maxX: 17, minZ: -17, maxZ: 17 }, surfaces: [{ id: 'edge-crate', kind: 'platform', minX: 14, maxX: 18, minZ: -2, maxZ: 2, height: 3, bottom: 0 }] });
  let p = { x: 0, y: 0, z: 0, vy: 0, grounded: true };
  for (let i = 0; i < 600; i++) p = terrain.moveActor(p, 0.12, Math.sin(i * 0.2) * 0.03, 0.4, 1 / 60, p);
  assert.ok(p.x <= 13.6 + 1e-5); assert.equal(p.y, 0);
});

test('spawn recovery escapes touching circles at the arena boundary', () => {
  const obstacles = [{ x: 8.8, z: 0, r: 1 }, { x: 8.8, z: 1.5, r: 1 }];
  const terrain = createTerrain({ obstacles, bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 } });
  const p = terrain.moveActor({ x: 9.1, y: 0, z: 0.7 }, 0, 0, 0.5, 0, {});
  for (const o of obstacles) assert.ok(Math.hypot(p.x - o.x, p.z - o.z) >= 1.5 - 1e-5);
  assert.ok(p.x <= 9.5 && p.x >= -9.5 && p.z <= 9.5 && p.z >= -9.5);
});

test('spawn recovery at two overlapping circle centres finds a joint feasible point', () => {
  const obstacles = [{ x: -0.8, z: 0, r: 1 }, { x: 0.8, z: 0, r: 1 }];
  const terrain = createTerrain({ obstacles, bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 } });
  const p = terrain.moveActor({ x: 0, y: 0, z: 0 }, 0, 0, 0.5, 0, {});
  for (const o of obstacles) assert.ok(Math.hypot(p.x - o.x, p.z - o.z) >= 1.5 - 1e-5);
});
