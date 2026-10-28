/** Pure, renderer-independent walking, gravity and route navigation. */
export const GRAVITY = 22;
export const MAX_STEP = 0.28;
const EPS = 1e-5;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function surfaceHeight(surface, x, z) {
  if (x < surface.minX - EPS || x > surface.maxX + EPS || z < surface.minZ - EPS || z > surface.maxZ + EPS) return null;
  if (surface.kind !== 'ramp') return surface.height;
  const coordinate = surface.axis === 'x' ? x : z;
  const min = surface.axis === 'x' ? surface.minX : surface.minZ;
  const max = surface.axis === 'x' ? surface.maxX : surface.maxZ;
  const t = surface.direction === -1 ? (max - coordinate) / (max - min) : (coordinate - min) / (max - min);
  return surface.startHeight + clamp(t, 0, 1) * (surface.endHeight - surface.startHeight);
}

export function sampleGround(surfaces, x, z, previousY = 0, maxStep = MAX_STEP) {
  let best = { height: 0, surfaceId: 'floor', kind: 'floor', normal: { x: 0, y: 1, z: 0 } };
  for (const s of surfaces) {
    const height = surfaceHeight(s, x, z);
    if (height === null || height > previousY + maxStep + EPS || height < best.height - EPS) continue;
    let sx = 0, sz = 0;
    if (s.kind === 'ramp') {
      const length = s.axis === 'x' ? s.maxX - s.minX : s.maxZ - s.minZ;
      const slope = (s.endHeight - s.startHeight) / length * (s.direction === -1 ? -1 : 1);
      if (s.axis === 'x') sx = slope; else sz = slope;
    }
    const n = Math.hypot(sx, 1, sz);
    best = { height, surfaceId: s.id, kind: s.kind || 'platform', normal: { x: -sx / n, y: 1 / n, z: -sz / n } };
  }
  return best;
}

function pushOutRectangle(point, previous, rect, r, bounds) {
  const cx = clamp(point.x, rect.minX, rect.maxX), cz = clamp(point.z, rect.minZ, rect.maxZ);
  const vx = point.x - cx, vz = point.z - cz, distance = Math.hypot(vx, vz);
  if (distance >= r - EPS) return;
  if (distance > EPS) {
    const nx = cx + vx / distance * r, nz = cz + vz / distance * r;
    if (nx >= bounds.minX + r && nx <= bounds.maxX - r && nz >= bounds.minZ + r && nz <= bounds.maxZ - r) { point.x = nx; point.z = nz; return; }
  }
  const options = [
    { d: Math.abs(point.x - (rect.minX - r)), axis: 'x', value: rect.minX - r },
    { d: Math.abs(point.x - (rect.maxX + r)), axis: 'x', value: rect.maxX + r },
    { d: Math.abs(point.z - (rect.minZ - r)), axis: 'z', value: rect.minZ - r },
    { d: Math.abs(point.z - (rect.maxZ + r)), axis: 'z', value: rect.maxZ + r },
  ];
  // Prefer the face crossed this substep; this prevents corner snaps into solids.
  if (previous.x < rect.minX) options[0].d -= r * 2;
  if (previous.x > rect.maxX) options[1].d -= r * 2;
  if (previous.z < rect.minZ) options[2].d -= r * 2;
  if (previous.z > rect.maxZ) options[3].d -= r * 2;
  const feasible = options.filter(o => o.axis === 'x' ? o.value >= bounds.minX + r && o.value <= bounds.maxX - r : o.value >= bounds.minZ + r && o.value <= bounds.maxZ - r);
  feasible.sort((a, b) => a.d - b.d);
  if (feasible.length) point[feasible[0].axis] = feasible[0].value;
}

function pushOutCircle(point, previous, obstacle, r, bounds) {
  const gap = obstacle.r + r, vx = point.x - obstacle.x, vz = point.z - obstacle.z, distance = Math.hypot(vx, vz);
  if (distance >= gap - EPS) return;
  const minX = bounds.minX + r, maxX = bounds.maxX - r, minZ = bounds.minZ + r, maxZ = bounds.maxZ - r;
  const candidates = [];
  const add = (x, z) => {
    if (x < minX - EPS || x > maxX + EPS || z < minZ - EPS || z > maxZ + EPS || Math.hypot(x - obstacle.x, z - obstacle.z) < gap - EPS) return;
    candidates.push({ x: clamp(x, minX, maxX), z: clamp(z, minZ, maxZ) });
  };
  add(obstacle.x + (distance > EPS ? vx / distance : 1) * gap, obstacle.z + (distance > EPS ? vz / distance : 0) * gap);
  if (!candidates.length) {
    for (const x of [minX, maxX]) {
      const q = gap * gap - (x - obstacle.x) ** 2;
      if (q >= 0) { add(x, obstacle.z + Math.sqrt(q)); add(x, obstacle.z - Math.sqrt(q)); }
    }
    for (const z of [minZ, maxZ]) {
      const q = gap * gap - (z - obstacle.z) ** 2;
      if (q >= 0) { add(obstacle.x + Math.sqrt(q), z); add(obstacle.x - Math.sqrt(q), z); }
    }
    add(previous.x, previous.z);
  }
  if (!candidates.length) return;
  candidates.sort((a, b) => Math.hypot(a.x - point.x, a.z - point.z) - Math.hypot(b.x - point.x, b.z - point.z));
  point.x = candidates[0].x; point.z = candidates[0].z;
}

function recoverFeasiblePoint(target, previous, obstacles, surfaces, r, bounds, clear) {
  const minX = bounds.minX + r, maxX = bounds.maxX - r, minZ = bounds.minZ + r, maxZ = bounds.maxZ - r;
  const candidates = [previous];
  const add = (x, z) => { if (Number.isFinite(x) && Number.isFinite(z)) candidates.push({ x, z }); };
  for (const x of [minX, maxX]) for (const z of [minZ, maxZ]) add(x, z);
  const circles = obstacles.map(o => ({ ...o, r: o.r + r }));
  for (let i = 0; i < circles.length; i++) {
    const a = circles[i];
    for (let n = 0; n < 16; n++) { const angle = n * Math.PI / 8; add(a.x + Math.cos(angle) * a.r, a.z + Math.sin(angle) * a.r); }
    for (const x of [minX, maxX]) { const q = a.r ** 2 - (x - a.x) ** 2; if (q >= 0) { add(x, a.z + Math.sqrt(q)); add(x, a.z - Math.sqrt(q)); } }
    for (const z of [minZ, maxZ]) { const q = a.r ** 2 - (z - a.z) ** 2; if (q >= 0) { add(a.x + Math.sqrt(q), z); add(a.x - Math.sqrt(q), z); } }
    for (let j = 0; j < i; j++) {
      const b = circles[j], dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < EPS || d > a.r + b.r + EPS || d < Math.abs(a.r - b.r) - EPS) continue;
      const along = (a.r ** 2 - b.r ** 2 + d ** 2) / (2 * d), h = Math.sqrt(Math.max(0, a.r ** 2 - along ** 2));
      const x = a.x + dx / d * along, z = a.z + dz / d * along;
      add(x - dz / d * h, z + dx / d * h); add(x + dz / d * h, z - dx / d * h);
    }
  }
  for (const s of surfaces) {
    for (const x of [s.minX - r, s.maxX + r]) { add(x, clamp(target.z, s.minZ - r, s.maxZ + r)); add(x, s.minZ - r); add(x, s.maxZ + r); }
    for (const z of [s.minZ - r, s.maxZ + r]) add(clamp(target.x, s.minX - r, s.maxX + r), z);
  }
  const legal = candidates.filter(p => p.x >= minX - EPS && p.x <= maxX + EPS && p.z >= minZ - EPS && p.z <= maxZ + EPS && clear(p));
  legal.sort((a, b) => Math.hypot(a.x - target.x, a.z - target.z) - Math.hypot(b.x - target.x, b.z - target.z));
  return legal[0] || { x: clamp(previous.x, minX, maxX), z: clamp(previous.z, minZ, maxZ) };
}

/**
 * dx/dz are frame displacement, not velocity. Pass the previous result as state.
 * Positive state.vy launches the actor. Feet y and full body height are respected.
 */
export function moveActor(terrain, position, dx, dz, radius, dt, state = {}) {
  const { surfaces = [], obstacles = [], bounds = { minX: -17, maxX: 17, minZ: -17, maxZ: 17 } } = terrain;
  const r = Math.max(0.04, radius || 0.35);
  const step = state.maxStep ?? MAX_STEP, bodyHeight = state.bodyHeight ?? 1.45;
  const gravity = state.gravity ?? GRAVITY;
  const duration = Math.max(0, Math.min(dt || 0, 0.5));
  const count = Math.min(160, Math.max(1, Math.ceil(Math.hypot(dx, dz) / Math.min(0.16, r * 0.5)), Math.ceil(duration / 0.025)));
  const subdt = duration / count;
  let x = position.x, z = position.z, y = Math.max(0, position.y || 0);
  let vy = Number.isFinite(state.vy) ? state.vy : 0;
  let grounded = state.grounded !== false && vy <= 0;
  let fallStartY = Math.max(state.fallStartY ?? y, y);
  let landed = false, fallDistance = 0, surfaceId = state.surfaceId || 'floor';
  for (let i = 0; i < count; i++) {
    const previous = { x, z };
    const next = { x: clamp(x + dx / count, bounds.minX + r, bounds.maxX - r), z: clamp(z + dz / count, bounds.minZ + r, bounds.maxZ - r) };
    // Resolve two passes so a wall cannot push the actor into a neighbouring prop.
    for (let pass = 0; pass < 4; pass++) {
      for (const obstacle of obstacles) {
        if (y >= (obstacle.maxY ?? 2) - 0.04 || y + bodyHeight <= (obstacle.minY ?? 0) + EPS) continue;
        pushOutCircle(next, previous, obstacle, r, bounds);
      }
      for (const s of surfaces) {
        if (s.collidable === false) continue;
        const qx = clamp(next.x, s.minX, s.maxX), qz = clamp(next.z, s.minZ, s.maxZ);
        const top = surfaceHeight(s, qx, qz);
        const bottom = s.bottom ?? 0;
        if (top <= y + (grounded ? step : 0.015) + EPS || y + bodyHeight <= bottom + EPS || y >= top - EPS) continue;
        pushOutRectangle(next, previous, s, r, bounds);
      }
    }
    x = clamp(next.x, bounds.minX + r, bounds.maxX - r);
    z = clamp(next.z, bounds.minZ + r, bounds.maxZ - r);
    // At a boundary, projection against one solid must not clamp back inside it.
    // If neighbouring constraints are impossible for this frame, keep the last
    // feasible position rather than allowing a collision or an edge teleport.
    const activeObstacles = obstacles.filter(o => y < (o.maxY ?? 2) - 0.04 && y + bodyHeight > (o.minY ?? 0) + EPS);
    const clear = point => !activeObstacles.some(o => Math.hypot(point.x - o.x, point.z - o.z) < r + o.r - EPS)
      && !surfaces.some(s => {
        if (s.collidable === false || y + bodyHeight <= (s.bottom ?? 0) + EPS) return false;
        const qx = clamp(point.x, s.minX, s.maxX), qz = clamp(point.z, s.minZ, s.maxZ);
        const top = surfaceHeight(s, qx, qz);
        return top > y + (grounded ? step : 0.015) + EPS && Math.hypot(point.x - qx, point.z - qz) < r - EPS;
      });
    if (!clear({ x, z })) {
      const recovered = clear(previous) ? previous : recoverFeasiblePoint({ x, z }, previous, activeObstacles, surfaces, r, bounds, clear);
      x = recovered.x; z = recovered.z;
    }
    let support = sampleGround(surfaces, x, z, y, grounded ? step : 0.001);
    if (grounded) {
      if (support.height >= y - (state.maxDownStep ?? 0.4) - EPS) {
        y = support.height; surfaceId = support.surfaceId; vy = 0; fallStartY = y;
      } else { grounded = false; fallStartY = Math.max(fallStartY, y); }
    }
    if (!grounded) {
      const oldY = y;
      vy -= gravity * subdt;
      let nextY = y + vy * subdt;
      if (vy > 0) {
        for (const s of surfaces) {
          if (surfaceHeight(s, x, z) === null || !Number.isFinite(s.bottom) || s.bottom <= oldY + bodyHeight + EPS) continue;
          if (nextY + bodyHeight >= s.bottom) { nextY = s.bottom - bodyHeight; vy = 0; }
        }
      }
      support = sampleGround(surfaces, x, z, Math.max(oldY, nextY), 0.001);
      if (vy <= 0 && nextY <= support.height + EPS && oldY >= support.height - 0.05) {
        y = support.height; surfaceId = support.surfaceId; grounded = true; landed = true;
        fallDistance = Math.max(fallDistance, fallStartY - y); vy = 0; fallStartY = y;
      } else { y = Math.max(0, nextY); fallStartY = Math.max(fallStartY, y); }
    }
  }
  return { x, y, z, vy, grounded, landed, fallDistance, fallStartY, surfaceId, bodyHeight, maxStep: step, gravity };
}

const distance3 = (a, b) => Math.hypot(a.x - b.x, (a.y || 0) - (b.y || 0), a.z - b.z);

/** Clip a segment against solid platforms, wedge ramps, and circular floor props. */
export function segmentBlocked(terrain, from, to, padding = 0.02) {
  const hp = typeof padding === 'number' ? padding : padding.horizontal ?? 0.02;
  const vp = typeof padding === 'number' ? padding : padding.vertical ?? hp;
  const dx = to.x - from.x, dy = (to.y || 0) - (from.y || 0), dz = to.z - from.z;
  for (const s of terrain.surfaces || []) {
    if (s.collidable === false) continue;
    let lo = 0, hi = 1;
    const clip = (a, b) => {
      if (Math.abs(a) < EPS) return b >= 0;
      const t = -b / a;
      if (a > 0) lo = Math.max(lo, t); else hi = Math.min(hi, t);
      return lo <= hi + EPS;
    };
    if (!clip(dx, from.x - s.minX + hp) || !clip(-dx, s.maxX - from.x + hp) || !clip(dz, from.z - s.minZ + hp) || !clip(-dz, s.maxZ - from.z + hp)) continue;
    if (!clip(dy, (from.y || 0) - (s.bottom ?? 0) + vp)) continue;
    if (s.kind === 'ramp') {
      const min = s.axis === 'x' ? s.minX : s.minZ, max = s.axis === 'x' ? s.maxX : s.maxZ;
      const sign = s.direction === -1 ? -1 : 1;
      const slope = (s.endHeight - s.startHeight) / (max - min) * sign;
      const intercept = s.startHeight - slope * (sign === 1 ? min : max);
      const fc = s.axis === 'x' ? from.x : from.z, dc = s.axis === 'x' ? dx : dz;
      if (!clip(slope * dc - dy, slope * fc + intercept - (from.y || 0) + vp)) continue;
    } else if (!clip(-dy, s.height - (from.y || 0) + vp)) continue;
    if (lo <= hi && hi >= 0 && lo <= 1) return true;
  }
  for (const o of terrain.obstacles || []) {
    const length = dx * dx + dz * dz;
    const t = length > EPS ? clamp(((o.x - from.x) * dx + (o.z - from.z) * dz) / length, 0, 1) : 0;
    if (Math.hypot(from.x + dx * t - o.x, from.z + dz * t - o.z) > o.r + hp) continue;
    const y = (from.y || 0) + dy * t;
    if (y + vp >= (o.minY ?? 0) && y - vp <= (o.maxY ?? 2)) return true;
  }
  return false;
}

/** A small explicit waypoint graph connects the two ramps and elevated bridge. */
export function getNavigationTarget(terrain, from, target) {
  const nodes = terrain.nodes || [];
  if (!nodes.length) return { x: target.x, y: target.y || 0, z: target.z };
  const surfaceFor = point => sampleGround(terrain.surfaces, point.x, point.z, point.y || 0, 0.35);
  const fs = surfaceFor(from), ts = surfaceFor(target);
  const elevatedFrom = (from.y || 0) > 0.4, elevatedTarget = (target.y || 0) > 0.4;
  // Ground pursuers need no graph until one side is above the normal floor.
  if (!elevatedFrom && !elevatedTarget) {
    const height = from.bodyHeight ?? 1.45;
    // Tall enemies cannot fit underneath the bridge: go around the route's end.
    if (height > 2.2 && segmentBlocked({ surfaces: terrain.surfaces }, { ...from, y: height / 2 }, { ...target, y: height / 2 }, { horizontal: from.radius ?? 0.7, vertical: height / 2 })) {
      const ss = terrain.surfaces;
      const minX = Math.min(...ss.map(s => s.minX)), maxX = Math.max(...ss.map(s => s.maxX));
      const minZ = Math.min(...ss.map(s => s.minZ)), maxZ = Math.max(...ss.map(s => s.maxZ));
      const clearance = (from.radius ?? 1.25) + 0.55;
      const availableMin = (terrain.bounds?.minX ?? -17) + (from.radius ?? 1.25);
      const availableMax = (terrain.bounds?.maxX ?? 17) - (from.radius ?? 1.25);
      const candidates = [minX - clearance, maxX + clearance].filter(x => x >= availableMin && x <= availableMax);
      const sideX = candidates.sort((a, b) => Math.abs(from.x - a) - Math.abs(from.x - b))[0] ?? clamp(maxX + clearance, availableMin, availableMax);
      const targetBehind = target.z < (minZ + maxZ) / 2;
      const nearZ = targetBehind ? maxZ + clearance : minZ - clearance;
      const farZ = targetBehind ? minZ - clearance : maxZ + clearance;
      return { x: sideX, y: 0, z: Math.abs(from.x - sideX) > 0.7 ? nearZ : farZ, waypointId: 'ground-bypass' };
    }
    return { x: target.x, y: target.y || 0, z: target.z };
  }
  if (fs.surfaceId === ts.surfaceId && fs.surfaceId !== 'floor') return { x: target.x, y: target.y || 0, z: target.z };
  const nearest = point => {
    let best = null, score = Infinity;
    const ps = surfaceFor(point), py = point.y || 0;
    for (const node of nodes) {
      const ns = surfaceFor(node);
      const same = ps.surfaceId === ns.surfaceId;
      // Never select a nearby bridge overhead as an entry from the floor.
      const dy = Math.abs((node.y || 0) - py);
      if (dy > 0.6 && !same) continue;
      const value = distance3(point, node) + (!same ? 0.6 : 0);
      if (value < score) { score = value; best = node; }
    }
    return best || nodes.reduce((a, b) => distance3(point, a) < distance3(point, b) ? a : b);
  };
  const start = nearest(from), end = nearest(target);
  if (!start || !end) return { x: target.x, y: target.y || 0, z: target.z };
  const byId = new Map(nodes.map(n => [n.id, n]));
  const scores = new Map([[start.id, 0]]), previous = new Map(), open = new Set([start.id]);
  while (open.size) {
    let current = null;
    for (const id of open) if (current === null || scores.get(id) < scores.get(current)) current = id;
    open.delete(current);
    if (current === end.id) break;
    const node = byId.get(current);
    for (const id of node.links || []) {
      const neighbour = byId.get(id); if (!neighbour) continue;
      const value = scores.get(current) + distance3(node, neighbour);
      if (!scores.has(id) || value < scores.get(id)) { scores.set(id, value); previous.set(id, current); open.add(id); }
    }
  }
  if (!scores.has(end.id)) return { x: start.x, y: start.y, z: start.z };
  const path = [end.id];
  while (path[0] !== start.id && previous.has(path[0])) path.unshift(previous.get(path[0]));
  // Reach the first waypoint before advancing; leaving a ramp diagonally is unsafe.
  const next = byId.get(path[Math.min(1, path.length - 1)]);
  const ex = next.x - start.x, ez = next.z - start.z, length = Math.hypot(ex, ez);
  const along = length > EPS ? ((from.x - start.x) * ex + (from.z - start.z) * ez) / length : 0;
  const lateral = length > EPS ? Math.abs((from.x - start.x) * ez - (from.z - start.z) * ex) / length : Infinity;
  const expectedY = start.y + (next.y - start.y) * clamp(along / (length || 1), 0, 1);
  const followingEdge = along >= 0 && along <= length + 0.35 && lateral < 0.85 && Math.abs((from.y || 0) - expectedY) < 0.65;
  const current = distance3(from, start) <= 0.65 || followingEdge ? next : start;
  return { x: current.x, y: current.y || 0, z: current.z, waypointId: current.id };
}

export function createTerrain(options = {}) {
  const terrain = { surfaces: options.surfaces || [], obstacles: options.obstacles || [], bounds: options.bounds, nodes: options.nodes || [] };
  return {
    ...terrain,
    sampleGround: (x, z, y = 0, step = MAX_STEP) => sampleGround(terrain.surfaces, x, z, y, step),
    moveActor: (position, dx, dz, radius, dt, state = {}) => moveActor(terrain, position, dx, dz, radius, dt, state),
    getNavigationTarget: (from, target) => getNavigationTarget(terrain, from, target),
    segmentBlocked: (from, to, padding) => segmentBlocked(terrain, from, to, padding),
  };
}

export function createRoomRoute(stage = 0) {
  const config = stage === 0
    ? { height: 2.6, leftX: -7.5, rightX: 5.5, footZ: -4, topZ: -11, backZ: -14, bridgeZ: -12.2, width: 3, label: '书页天桥' }
    : stage === 1
      ? { height: 3, leftX: -11.5, rightX: 8.5, footZ: -3, topZ: -11, backZ: -15, bridgeZ: -13, width: 3, label: '案板高架路' }
      : { height: 2.8, leftX: -10.5, rightX: 7.5, footZ: -2, topZ: -9, backZ: -13, bridgeZ: -11, width: 3, label: '花盆木栈道' };
  const { height: h, leftX: lx, rightX: rx, footZ, topZ, backZ, bridgeZ, width } = config;
  const surfaces = [
    { id: 'ramp-left', kind: 'ramp', axis: 'z', direction: -1, minX: lx - width / 2, maxX: lx + width / 2, minZ: topZ, maxZ: footZ, startHeight: 0, endHeight: h, bottom: 0 },
    { id: 'platform-left', kind: 'platform', minX: lx - 3, maxX: lx + 1.5, minZ: backZ, maxZ: topZ + 0.15, height: h, bottom: 0 },
    { id: 'bridge', kind: 'platform', minX: lx + 1.45, maxX: rx - 1.4, minZ: bridgeZ - 0.85, maxZ: bridgeZ + 0.85, height: h, bottom: h - 0.18 },
    { id: 'platform-right', kind: 'platform', minX: rx - 1.5, maxX: rx + 2, minZ: backZ, maxZ: topZ + 0.15, height: h, bottom: 0 },
    { id: 'ramp-right', kind: 'ramp', axis: 'z', direction: -1, minX: rx - width / 2, maxX: rx + width / 2, minZ: topZ, maxZ: footZ, startHeight: 0, endHeight: h, bottom: 0 },
  ];
  const midZ = (footZ + topZ) / 2;
  const nodes = [
    { id: 'left-foot', x: lx, y: 0, z: footZ + 0.5 },
    { id: 'left-low', x: lx, y: h * 0.08, z: footZ + (topZ - footZ) * 0.08 },
    { id: 'left-ramp', x: lx, y: h / 2, z: midZ },
    { id: 'left-top', x: lx, y: h, z: bridgeZ },
    { id: 'bridge-left', x: lx + 1.7, y: h, z: bridgeZ },
    { id: 'bridge-mid', x: (lx + rx) / 2, y: h, z: bridgeZ },
    { id: 'bridge-right', x: rx - 1.7, y: h, z: bridgeZ },
    { id: 'right-top', x: rx, y: h, z: bridgeZ },
    { id: 'right-ramp', x: rx, y: h / 2, z: midZ },
    { id: 'right-low', x: rx, y: h * 0.08, z: footZ + (topZ - footZ) * 0.08 },
    { id: 'right-foot', x: rx, y: 0, z: footZ + 0.5 },
  ];
  nodes.forEach((node, i) => { node.links = [nodes[i - 1]?.id, nodes[i + 1]?.id].filter(Boolean); });
  nodes[0].links.push(nodes.at(-1).id); nodes.at(-1).links.push(nodes[0].id);
  return { ...config, surfaces, nodes, reward: { x: (lx + rx) / 2, y: h, z: bridgeZ, radius: 1.4 }, entrances: [nodes[0], nodes.at(-1)] };
}
