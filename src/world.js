import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Cache the source image, then crop each atlas cell before giving it repeat UVs.
// Repeating an atlas itself would leak neighbouring materials into the floor.
const atlasImages = new Map();
function atlasImage(url, ready) {
  let entry = atlasImages.get(url);
  if (!entry) {
    entry = { image: null, waiting: [], failed: false };
    atlasImages.set(url, entry);
    new THREE.TextureLoader().load(url, (source) => {
      entry.image = source.image;
      source.dispose();
      for (const callback of entry.waiting) callback(entry.image);
      entry.waiting.length = 0;
    }, undefined, () => { entry.failed = true; entry.waiting.length = 0; });
  }
  if (entry.image) ready(entry.image);
  else if (!entry.failed) entry.waiting.push(ready);
}

// Everything in a room is built from real geometry. A bear is 1.4 units tall;
// the furniture makes the familiar domestic setting feel wonderfully enormous.
export function createWorld(scene, stage = 0) {
  const group = new THREE.Group();
  group.name = `room-${stage}`;
  scene.add(group);
  const obstacles = [];
  const interactables = [];
  const animated = [];
  const resources = new Set();
  let alive = true;
  const artBase = `${import.meta.env?.BASE_URL || './'}art/`;
  const bounds = { minX: -17, maxX: 17, minZ: -17, maxZ: 17 };
  const spawnPoints = [
    { x: -15, z: -12 }, { x: -7, z: -15 }, { x: 6, z: -15 },
    { x: 15, z: -10 }, { x: 15, z: 7 }, { x: 7, z: 15 },
    { x: -7, z: 15 }, { x: -15, z: 7 },
  ];
  const colors = {
    cream: 0xfff3d9, peach: 0xf2aa83, pink: 0xe9a5ab, teal: 0x73b6a4,
    sage: 0xa6ba8e, brown: 0x6d4639, yellow: 0xf5cb70, blue: 0x91b9d0,
    ink: 0x51463e, coral: 0xe98b72, white: 0xfffcf1,
  };
  const materials = new Map();
  const artMaterials = new Map();
  function atlasTexture(file, column, row, columns, rows, fallback, repeat = 1, compose = null) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    const c = canvas.getContext('2d');
    if (fallback?.image) c.drawImage(fallback.image, 0, 0, 1024, 1024);
    else { c.fillStyle = '#f3e4c7'; c.fillRect(0, 0, 1024, 1024); }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.anisotropy = 8;
    resources.add(texture);
    atlasImage(artBase + file, image => {
      if (!alive) return;
      const w = image.width / columns, h = image.height / rows;
      const inset = Math.max(2, Math.min(w, h) * 0.006);
      c.clearRect(0, 0, 1024, 1024);
      c.drawImage(image, column * w + inset, row * h + inset, w - inset * 2, h - inset * 2, 0, 0, 1024, 1024);
      compose?.(c, canvas);
      texture.needsUpdate = true;
    });
    return texture;
  }
  function artMaterial(index, roughness = 0.84) {
    if (!artMaterials.has(index)) {
      const texture = atlasTexture('decor-atlas.jpg', index % 3, Math.floor(index / 3), 3, 2);
      const m = new THREE.MeshStandardMaterial({ map: texture, roughness, polygonOffset: true, polygonOffsetFactor: -1 });
      resources.add(m); artMaterials.set(index, m);
    }
    return artMaterials.get(index);
  }
  function decal(index, w, h, x, y, z, parent = group, rotationX = 0, rotationY = 0) {
    const plane = mesh(new THREE.PlaneGeometry(w, h), artMaterial(index), parent);
    plane.position.set(x, y, z); plane.rotation.set(rotationX, rotationY, 0);
    plane.castShadow = false;
    return plane;
  }
  function mat(color, roughness = 0.8, metalness = 0) {
    const key = `${color}-${roughness}-${metalness}`;
    if (!materials.has(key)) {
      const m = new THREE.MeshStandardMaterial({ color, roughness, metalness });
      materials.set(key, m);
      resources.add(m);
    }
    return materials.get(key);
  }
  function mesh(geometry, material, parent = group) {
    resources.add(geometry);
    const m = new THREE.Mesh(geometry, material);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function box(w, h, d, color, x = 0, y = 0, z = 0, radius = 0.12, parent = group) {
    const m = mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 3, h / 3, d / 3)), mat(color), parent);
    m.position.set(x, y, z);
    return m;
  }
  function sphere(r, color, x, y, z, parent = group, sx = 1, sy = 1, sz = 1) {
    const m = mesh(new THREE.SphereGeometry(r, 16, 10), mat(color), parent);
    m.position.set(x, y, z);
    m.scale.set(sx, sy, sz);
    return m;
  }
  function cylinder(rt, rb, h, color, x, y, z, parent = group, sides = 24) {
    const m = mesh(new THREE.CylinderGeometry(rt, rb, h, sides), mat(color), parent);
    m.position.set(x, y, z);
    return m;
  }
  function torus(r, tube, color, x, y, z, parent = group) {
    const m = mesh(new THREE.TorusGeometry(r, tube, 8, 32), mat(color), parent);
    m.position.set(x, y, z);
    return m;
  }
  function local(x, z, parent = group) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    parent.add(g);
    return g;
  }
  function block(x, z, w, h, d, color, rotation = 0, collide = true) {
    const g = local(x, z);
    g.rotation.y = rotation;
    box(w, h, d, color, 0, h / 2, 0, 0.12, g);
    // A different colored inset makes the blocks feel painted, not placeholder cubes.
    box(w * 0.74, h * 0.71, 0.025, colors.cream, 0, h / 2, d / 2 + 0.015, 0.05, g);
    if (collide) obstacles.push({ x, z, r: Math.max(w, d) * 0.53 });
    return g;
  }
  function seedRandom(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function groundTexture(kind) {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    const c = canvas.getContext('2d');
    const rnd = seedRandom(86 + stage);
    if (kind === 'wood') {
      c.fillStyle = '#d9b68d'; c.fillRect(0, 0, 1024, 1024);
      for (let row = 0; row < 8; row++) {
        c.fillStyle = row % 2 ? '#dfbd97' : '#d5ad81';
        c.fillRect(0, row * 128, 1024, 126);
        c.strokeStyle = 'rgba(117,78,43,.14)'; c.lineWidth = 2;
        c.beginPath(); c.moveTo(0, row * 128); c.lineTo(1024, row * 128); c.stroke();
        for (let i = 0; i < 80; i++) {
          const y = row * 128 + rnd() * 124;
          c.strokeStyle = `rgba(127,83,49,${rnd() * 0.07})`;
          c.beginPath(); c.moveTo(rnd() * 1024, y); c.bezierCurveTo(300, y + 5, 700, y - 4, 1024, y + 2); c.stroke();
        }
        c.strokeStyle = 'rgba(117,78,43,.14)';
        const joint = (row % 3) * 300 + 120;
        c.beginPath(); c.moveTo(joint, row * 128); c.lineTo(joint, (row + 1) * 128); c.stroke();
      }
    } else if (kind === 'tile') {
      c.fillStyle = '#e8d9b9'; c.fillRect(0, 0, 1024, 1024);
      for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
        c.fillStyle = (x + y) % 2 ? '#f0e6cf' : '#d7e3d4';
        c.fillRect(x * 256 + 3, y * 256 + 3, 250, 250);
        c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 3;
        c.strokeRect(x * 256 + 6, y * 256 + 6, 244, 244);
      }
      for (let i = 0; i < 1600; i++) {
        c.fillStyle = 'rgba(110,106,80,.025)'; c.fillRect(rnd() * 1024, rnd() * 1024, 2, 2);
      }
    } else {
      c.fillStyle = '#9eb884'; c.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 10000; i++) {
        c.strokeStyle = rnd() > 0.5 ? 'rgba(65,100,51,.13)' : 'rgba(223,234,166,.20)';
        const x = rnd() * 1024, y = rnd() * 1024;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + rnd() * 6 - 3, y - rnd() * 8); c.stroke();
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(stage === 2 ? 3 : 2, stage === 2 ? 3 : 2);
    texture.anisotropy = 4;
    resources.add(texture);
    return texture;
  }
  function rugTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1024;
    const c = canvas.getContext('2d');
    const rnd = seedRandom(319);
    c.fillStyle = '#d8d2ad'; c.fillRect(0, 0, 1024, 1024);
    // Woven yarn, rather than individual geometry threads or border stitches.
    for (let y = 0; y < 1024; y += 4) {
      c.fillStyle = y % 8 ? 'rgba(247,240,203,.15)' : 'rgba(132,137,98,.10)';
      c.fillRect(0, y, 1024, 2);
    }
    for (let x = 0; x < 1024; x += 4) {
      c.fillStyle = x % 8 ? 'rgba(255,250,216,.08)' : 'rgba(117,125,89,.07)';
      c.fillRect(x, 0, 2, 1024);
    }
    for (let x = 64; x < 1024; x += 128) {
      c.fillStyle = 'rgba(169,161,117,.055)'; c.fillRect(x, 0, 54, 1024);
    }
    for (let i = 0; i < 5000; i++) {
      c.fillStyle = rnd() > 0.5 ? 'rgba(251,244,207,.13)' : 'rgba(116,125,91,.08)';
      c.fillRect(rnd() * 1024, rnd() * 1024, 1 + rnd() * 3, 1);
    }
    c.strokeStyle = '#b4b28d'; c.lineWidth = 8; c.strokeRect(21, 21, 982, 982);
    c.strokeStyle = '#eee6bd'; c.lineWidth = 3; c.setLineDash([9, 9]);
    c.strokeRect(37, 37, 950, 950); c.setLineDash([]);
    c.strokeStyle = 'rgba(172,166,118,.35)'; c.lineWidth = 3;
    for (const [x, y] of [[100, 100], [924, 100], [100, 924], [924, 924]]) {
      c.beginPath(); c.moveTo(x, y - 20); c.lineTo(x + 14, y); c.lineTo(x, y + 20); c.lineTo(x - 14, y); c.closePath(); c.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    resources.add(texture);
    return texture;
  }
  const groundFallback = groundTexture(stage === 0 ? 'wood' : stage === 1 ? 'tile' : 'grass');
  const floorCell = stage === 0 ? [0, 0] : stage === 1 ? [0, 1] : [1, 1];
  const floorTexture = atlasTexture('surface-atlas.jpg', ...floorCell, 2, 2, groundFallback, stage === 0 ? 8 : 10);
  const floorMaterial = new THREE.MeshStandardMaterial({ map: floorTexture, bumpMap: floorTexture, bumpScale: stage === 2 ? 0.035 : 0.012, roughness: stage === 1 ? 0.77 : 0.96 });
  resources.add(floorMaterial);
  const floor = mesh(new THREE.PlaneGeometry(80, 80), floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;
  floor.position.y = -0.025;

  // A softly lit visible boundary avoids invisible-wall surprises in combat.
  const boundaryMat = new THREE.MeshBasicMaterial({ color: stage === 2 ? 0xe3dbb8 : 0xf3dfb0, transparent: true, opacity: 0.42 });
  resources.add(boundaryMat);
  const boundary = mesh(new THREE.RingGeometry(23.9, 24, 96), boundaryMat);
  boundary.rotation.x = -Math.PI / 2;
  boundary.position.y = 0.01;
  boundary.castShadow = boundary.receiveShadow = false;

  function wall(x, z, w, h, d, color) {
    const m = box(w, h, d, color, x, h / 2 - 0.03, z, 0.12);
    m.userData.cameraObstacle = true;
    box(w + 0.1, 0.7, d + 0.1, colors.cream, x, 0.35, z, 0.06);
  }
  function picture(x, y, z, color, width = 3.2) {
    const frame = box(width, width * 0.78, 0.22, colors.cream, x, y, z, 0.12);
    box(width - 0.32, width * 0.78 - 0.32, 0.035, color, x, y, z + 0.13, 0.05);
    sphere(width * 0.17, colors.yellow, x - width * 0.15, y + 0.25, z + 0.16, group, 1, 1, 0.05);
    box(width * 0.75, 0.75, 0.02, colors.sage, x, y - width * 0.18, z + 0.18, 0.3);
    return frame;
  }
  let bookNumber = 0;
  function book(x, z, w, h, d, color, angle = 0, parent = group) {
    const g = local(x, z, parent); g.rotation.y = angle;
    box(w, h * 0.8, d, 0xf7edd6, 0, h / 2, 0, 0.07, g);
    box(w + 0.12, h * 0.1, d + 0.15, color, 0, h * 0.05, 0, 0.04, g);
    box(w + 0.12, h * 0.1, d + 0.15, color, 0, h * 0.95, 0, 0.04, g);
    box(0.13, h, d + 0.15, color, -w / 2, h / 2, 0, 0.04, g);
    for (let k = 1; k < 5; k++) box(w - 0.12, 0.015, 0.012, 0xe4d7bd, 0, h * (0.17 + k * 0.13), d / 2 + 0.014, 0, g);
    decal(bookNumber++ % 3, w - 0.3, d - 0.25, 0, h + 0.007, 0, g, -Math.PI / 2);
    // Gold headbands, rounded cover corners, and a cloth bookmark reward close views.
    for (const z of [-d * 0.36, d * 0.36]) box(0.14, h * 0.56, 0.08, colors.yellow, -w / 2 - 0.015, h / 2, z, 0.01, g);
    box(0.27, 0.025, d * 0.32, colors.coral, w * 0.22, h * 0.52, d * 0.49, 0.01, g);
    return g;
  }
  function mug(x, z, color, size = 1, parent = group) {
    const g = local(x, z, parent);
    const profile = [[0, 0.07], [1.02, 0.07], [1.15, 0.2], [1.25, 2.05], [1.17, 2.13], [1.09, 2.05], [1.02, 0.3], [0, 0.3]].map(([r, y]) => new THREE.Vector2(r * size, y * size));
    mesh(new THREE.LatheGeometry(profile, 32), mat(color, 0.28), g);
    const liquid = cylinder(1.085 * size, 1.085 * size, 0.025, 0x82543e, 0, 1.88 * size, 0, g);
    liquid.material = mat(0x82543e, 0.14);
    const rim = torus(1.17 * size, 0.075 * size, colors.cream, 0, 2.1 * size, 0, g); rim.rotation.x = Math.PI / 2;
    const innerRim = torus(1.09 * size, 0.03 * size, color, 0, 2.03 * size, 0, g); innerRim.rotation.x = Math.PI / 2;
    const footRing = torus(0.99 * size, 0.055 * size, color, 0, 0.1 * size, 0, g); footRing.rotation.x = Math.PI / 2;
    const handle = torus(0.72 * size, 0.19 * size, color, 1.3 * size, 1.1 * size, 0, g); handle.rotation.y = Math.PI / 2;
    const foam = torus(0.5 * size, 0.026 * size, 0xd0a276, 0.12 * size, 1.905 * size, 0.1 * size, g); foam.rotation.x = Math.PI / 2;
    foam.castShadow = false;
    return g;
  }
  function cerealBowl(x, z) {
    const g = local(x, z);
    const profile = [[0, 0.08], [0.85, 0.08], [1.4, 0.6], [1.6, 1.15], [1.47, 1.18], [1.3, 0.67], [0.72, 0.27], [0, 0.27]].map(([r, y]) => new THREE.Vector2(r, y));
    mesh(new THREE.LatheGeometry(profile, 28), mat(colors.peach), g);
    const lip = torus(1.54, 0.075, colors.cream, 0, 1.16, 0, g); lip.rotation.x = Math.PI / 2;
    for (let i = 0; i < 8; i++) {
      const a = i * 2.4, r = i === 0 ? 0 : 0.7;
      const cereal = torus(0.23, 0.11, i % 2 ? colors.yellow : 0xcb9b6d, Math.cos(a) * r, 0.53 + (i % 3) * 0.13, Math.sin(a) * r, g);
      cereal.rotation.x = Math.PI / 2 + (i % 2) * 0.5;
    }
    obstacles.push({ x, z, r: 1.6 });
    return g;
  }
  function piping(w, h, z, color, parent) {
    const points = [];
    const r = Math.min(w, h) * 0.18;
    for (const [cx, cy, start] of [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI], [w / 2 - r, -h / 2 + r, Math.PI * 1.5]]) {
      for (let i = 0; i < 5; i++) {
        const a = start + i * Math.PI / 8;
        points.push(new THREE.Vector3(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z));
      }
    }
    const curve = new THREE.CatmullRomCurve3(points, true);
    const seam = mesh(new THREE.TubeGeometry(curve, 60, 0.028, 4, true), mat(color), parent);
    seam.castShadow = false;
    return seam;
  }
  function plant(x, z, size = 1, color = colors.peach, parent = group) {
    const g = local(x, z, parent);
    cylinder(1.6 * size, 1.1 * size, 2.4 * size, color, 0, 1.2 * size, 0, g);
    cylinder(1.7 * size, 1.7 * size, 0.35 * size, color, 0, 2.3 * size, 0, g);
    cylinder(1.45 * size, 1.45 * size, 0.07, 0x655043, 0, 2.49 * size, 0, g);
    cylinder(0.13 * size, 0.18 * size, 4 * size, 0x64865b, 0, 4.2 * size, 0, g);
    for (let k = 0; k < 7; k++) {
      const a = k * 2.4;
      const leaf = sphere(size, k % 2 ? 0x86ac70 : 0x6f9662, Math.cos(a) * size * 0.8, (3.1 + k * 0.46) * size, Math.sin(a) * size * 0.8, g, 0.42, 1, 0.17);
      leaf.rotation.z = Math.cos(a) * 0.8;
      leaf.rotation.y = -a;
      leaf.castShadow = size > 1.3;
      if (size > 1.3 && k % 2 === 0) {
        const veins = [];
        const add = (x1, y1, x2, y2) => veins.push(x1, y1, size * 0.17 + 0.003, x2, y2, size * 0.17 + 0.003);
        add(0, -size * 0.7, 0, size * 0.8);
        for (let j = -1; j <= 1; j++) {
          add(0, j * size * 0.35, size * 0.23, (j * 0.35 + 0.2) * size);
          add(0, j * size * 0.35, -size * 0.23, (j * 0.35 + 0.2) * size);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(veins, 3));
        const material = new THREE.LineBasicMaterial({ color: 0xa3bd83, transparent: true, opacity: 0.6 });
        resources.add(geometry); resources.add(material);
        const line = new THREE.LineSegments(geometry, material);
        line.position.copy(leaf.position); line.rotation.copy(leaf.rotation); g.add(line);
      }
    }
    return g;
  }
  function marker(g, color) {
    const ring = torus(1.65, 0.035, color, 0, 0.06, 0, g); ring.rotation.x = Math.PI / 2;
    ring.material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 });
    resources.add(ring.material);
    ring.castShadow = ring.receiveShadow = false;
    const dot = sphere(0.12, color, 0, 2.9, 0, g);
    dot.material = new THREE.MeshBasicMaterial({ color }); resources.add(dot.material);
    animated.push((t) => { ring.scale.setScalar(1 + Math.sin(t * 2) * 0.025); dot.position.y = 2.9 + Math.sin(t * 2.1) * 0.12; });
    return ring;
  }
  function interaction(type, x, z, label, description, builder) {
    const g = local(x, z);
    g.name = `interactive-${type}`;
    const item = { id: `${stage}-${type}`, type, x, z, r: 3.2, mesh: g, active: false, cooldown: 0, label, description };
    builder(g, item);
    marker(g, type === 'snack' ? 0xf0b94f : 0x72d4bd);
    obstacles.push({ x, z, r: type === 'domino' ? 0.65 : 0.95 });
    interactables.push(item);
    return item;
  }
  function snack(x, z) {
    interaction('snack', x, z, '惊喜零食罐', '敲响罐子迎接额外敌群，完成后获得成长奖励', (g, item) => {
      cylinder(0.94, 0.94, 1.6, colors.cream, 0, 0.8, 0, g);
      cylinder(1.04, 1.04, 0.2, colors.coral, 0, 1.7, 0, g);
      cylinder(0.25, 0.25, 0.17, colors.coral, 0, 1.88, 0, g);
      box(1.05, 0.8, 0.04, colors.yellow, 0, 0.83, 0.95, 0.15, g);
      decal(3, 1.03, 0.78, 0, 0.83, 0.98, g);
      let pulse = 0;
      g.userData.trigger = () => { pulse = 1; };
      animated.push((t, dt) => { pulse = Math.max(0, pulse - dt); g.rotation.z = Math.sin(t * 35) * pulse * 0.12; });
      item.color = colors.yellow;
    });
  }
  function fan(x, z) {
    interaction('fan', x, z, '小风扇', '启动气流，吹开附近敌人并扰动轻型投射物', (g, item) => {
      box(1.9, 0.22, 1.4, colors.cream, 0, 0.12, 0, 0.12, g);
      cylinder(0.16, 0.2, 1.1, colors.teal, 0, 0.7, 0, g);
      const cage = torus(0.87, 0.075, colors.teal, 0, 1.8, 0, g);
      const blades = new THREE.Group(); blades.position.y = 1.8; g.add(blades);
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        const blade = sphere(0.5, colors.teal, Math.cos(a) * 0.36, Math.sin(a) * 0.36, 0.03, blades, 0.85, 0.38, 0.1);
        blade.rotation.z = a;
      }
      sphere(0.16, colors.yellow, 0, 1.8, 0.15, g);
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 6;
        const grille = box(1.67, 0.025, 0.025, colors.cream, 0, 1.8, 0.18, 0.005, g);
        grille.rotation.z = a;
      }
      let duration = 0;
      g.userData.trigger = () => { duration = 7; };
      animated.push((t, dt) => { duration = Math.max(0, duration - dt); blades.rotation.z += dt * (duration > 0 || item.active ? 30 : 2); cage.rotation.y = Math.sin(t * 0.7) * 0.08; });
    });
  }
  function domino(x, z) {
    interaction('domino', x, z, '多米诺机关', '推倒骨牌，引发一整列冲击，重创附近敌群', (g) => {
      const tiles = [];
      for (let i = 0; i < 5; i++) {
        const pivot = new THREE.Group(); pivot.position.set((i - 2) * 0.62, 0, 0); g.add(pivot);
        box(0.18, 1.5, 0.72, i % 2 ? colors.coral : colors.cream, 0, 0.75, 0, 0.06, pivot);
        for (let k = 0; k < 3; k++) sphere(0.055, i % 2 ? colors.cream : colors.ink, 0.105, 0.45 + k * 0.32, 0.12 * (k % 2 ? 1 : -1), pivot);
        tiles.push(pivot);
      }
      let elapsed = -1;
      g.userData.trigger = () => { elapsed = 0; };
      animated.push((t, dt) => {
        if (elapsed < 0) return;
        elapsed += dt;
        tiles.forEach((tile, i) => { tile.rotation.z = -Math.min(1, Math.max(0, elapsed * 2.5 - i * 0.2)) * 1.35; });
        if (elapsed > 10) { elapsed = -1; tiles.forEach(tile => { tile.rotation.z = 0; }); }
      });
    });
  }
  function honey(x, z) {
    interaction('honey', x, z, '蜂蜜罐', '打翻蜂蜜，在周围制造黏滞区域减缓追兵', (g) => {
      cylinder(0.8, 0.65, 1.3, 0xe9b454, 0, 0.65, 0, g);
      cylinder(0.86, 0.86, 0.22, colors.cream, 0, 1.4, 0, g);
      box(0.72, 0.55, 0.035, colors.cream, 0, 0.7, 0.8, 0.09, g);
      decal(4, 0.9, 0.78, 0, 0.73, 0.84, g);
      const puddle = cylinder(2.45, 2.45, 0.025, 0xd99a34, 0.9, 0.02, 0.9, g, 40);
      puddle.scale.set(0.01, 1, 0.01);
      let duration = 0;
      g.userData.trigger = () => { duration = 10; };
      animated.push((t, dt) => { duration = Math.max(0, duration - dt); const target = duration > 0 ? 1 : 0.01; puddle.scale.x = puddle.scale.z = THREE.MathUtils.lerp(puddle.scale.x, target, 0.06); });
    });
  }
  function kettle(x, z) {
    interaction('kettle', x, z, '咕噜水壶', '释放蒸汽冲击，击退包围你的敌人', (g) => {
      sphere(0.94, colors.teal, 0, 0.85, 0, g, 1, 0.95, 1);
      cylinder(0.55, 0.7, 0.2, colors.cream, 0, 1.65, 0, g);
      sphere(0.14, colors.yellow, 0, 1.86, 0, g);
      const spout = cylinder(0.18, 0.3, 1.1, colors.teal, 0.95, 1.1, 0, g); spout.rotation.z = -0.9;
      const handle = torus(0.72, 0.11, colors.cream, -0.35, 1.3, 0, g); handle.rotation.y = Math.PI / 2;
      const wisps = [];
      for (let i = 0; i < 4; i++) {
        const w = sphere(0.2, colors.white, 1.35, 1.6 + i * 0.4, 0, g); w.visible = false; wisps.push(w);
      }
      let duration = 0;
      g.userData.trigger = () => { duration = 4; };
      animated.push((t, dt) => { duration = Math.max(0, duration - dt); wisps.forEach((w, i) => { w.visible = duration > 0; w.position.y = 1.7 + ((t * 0.7 + i * 0.4) % 1.8); w.scale.setScalar(0.8 + i * 0.25); }); });
    });
  }
  function sprinkler(x, z) {
    interaction('sprinkler', x, z, '旋转喷水器', '启动水流，扫开周围敌人，创造脱身空隙', (g) => {
      cylinder(0.85, 1, 0.35, colors.yellow, 0, 0.18, 0, g);
      cylinder(0.2, 0.24, 0.8, colors.teal, 0, 0.7, 0, g);
      const head = new THREE.Group(); head.position.y = 1.15; g.add(head);
      box(1.7, 0.22, 0.25, colors.teal, 0, 0, 0, 0.08, head);
      const drops = [];
      for (let i = 0; i < 12; i++) {
        const a = i * Math.PI / 6;
        const d = sphere(0.08, 0xa8d6dd, Math.cos(a) * (1 + i * 0.1), 0.7, Math.sin(a) * (1 + i * 0.1), head);
        d.visible = false; drops.push(d);
      }
      let duration = 0;
      g.userData.trigger = () => { duration = 8; };
      animated.push((t, dt) => { duration = Math.max(0, duration - dt); head.rotation.y += dt * (duration > 0 ? 5 : 0.2); drops.forEach((d, i) => { d.visible = duration > 0; d.position.y = Math.sin(t * 4 + i) * 0.3; }); });
    });
  }
  function mushroom(x, z) {
    interaction('mushroom', x, z, '软软蘑菇', '触碰恢复生命，重新整装出发', (g) => {
      cylinder(0.35, 0.5, 0.9, colors.cream, 0, 0.45, 0, g);
      sphere(1.05, colors.coral, 0, 1, 0, g, 1, 0.48, 1);
      for (let i = 0; i < 6; i++) {
        const a = i * 2.4;
        sphere(0.13, colors.cream, Math.cos(a) * 0.62, 1.36 + Math.sin(i) * 0.05, Math.sin(a) * 0.62, g, 1, 0.25, 1);
      }
      let pulse = 0;
      g.userData.trigger = () => { pulse = 1; };
      animated.push((t, dt) => { pulse = Math.max(0, pulse - dt * 1.5); g.scale.y = 1 - Math.sin(pulse * Math.PI) * 0.25; });
    });
  }

  if (stage === 0) {
    wall(0, -25, 65, 19, 0.7, 0xe4d8bd);
    wall(-26, 0, 0.7, 19, 50, 0xe8ddc5);
    // Giant striped wallpaper and a sunny window.
    for (let i = -8; i <= 8; i++) box(0.09, 17, 0.02, 0xd4c7ac, i * 3, 9, -24.62, 0);
    box(11, 9, 0.3, colors.cream, 10, 10, -24.3, 0.1);
    box(10.3, 8.3, 0.08, 0xc4e4e5, 10, 10, -24.09, 0.02);
    box(0.3, 8.4, 0.15, colors.cream, 10, 10, -23.98, 0.02);
    box(10.3, 0.3, 0.15, colors.cream, 10, 10, -23.98, 0.02);
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < 5; i++) cylinder(0.42, 0.5, 10.6, colors.peach, 10 + side * (5.6 + i * 0.55), 10, -23.7);
    }
    picture(-12, 10, -24.05, colors.blue, 5);
    const sofa = local(-8, -22);
    const upholstery = atlasTexture('surface-atlas.jpg', 1, 0, 2, 2, rugTexture(), 3);
    const fabricMaterials = new Map();
    const fabric = color => {
      if (!fabricMaterials.has(color)) {
        const m = new THREE.MeshStandardMaterial({ color, map: upholstery, bumpMap: upholstery, bumpScale: 0.025, roughness: 0.97 });
        resources.add(m); fabricMaterials.set(color, m);
      }
      return fabricMaterials.get(color);
    };
    box(17, 2.7, 5.7, colors.teal, 0, 2.2, 0, 0.6, sofa).material = fabric(colors.teal);
    box(17, 5.2, 1.7, colors.teal, 0, 5.1, -2.2, 0.6, sofa).material = fabric(colors.teal);
    box(1.7, 4.3, 6, 0x6da794, -8, 3.8, 0, 0.6, sofa).material = fabric(0x6da794);
    box(1.7, 4.3, 6, 0x6da794, 8, 3.8, 0, 0.6, sofa).material = fabric(0x6da794);
    for (let i = -1; i <= 1; i++) {
      box(4.4, 0.9, 4.5, 0x8cc1ad, i * 4.7, 3.85, 0.2, 0.4, sofa).material = fabric(0x8cc1ad);
      const cushionSeam = piping(4.05, 0.55, 2.43, 0x649581, sofa);
      cushionSeam.position.set(i * 4.7, 3.85, 0);
    }
    const pillow = box(3.1, 3.1, 1, colors.yellow, -4, 5.7, -0.5, 0.6, sofa); pillow.rotation.z = 0.18;
    const pillow2 = box(3.5, 3, 1, colors.pink, 4, 5.7, -0.4, 0.6, sofa); pillow2.rotation.z = -0.18;
    pillow.material = fabric(colors.yellow); pillow2.material = fabric(colors.pink);
    const edge1 = piping(2.87, 2.87, 0.51, 0xe5b858, pillow);
    const edge2 = piping(3.27, 2.77, 0.51, 0xd58f98, pillow2);
    edge1.receiveShadow = edge2.receiveShadow = false;
    for (const x of [-6.5, 6.5]) for (const z of [-1.8, 1.8]) cylinder(0.35, 0.26, 1.1, colors.brown, x, 0.55, z, sofa);
    // One textured mesh replaces 144 separate stitch meshes.
    const rugFallback = rugTexture();
    const rugMap = atlasTexture('surface-atlas.jpg', 1, 0, 2, 2, rugFallback, 1, (c, canvas) => {
      const tile = document.createElement('canvas'); tile.width = tile.height = 1024;
      tile.getContext('2d').drawImage(canvas, 0, 0);
      for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) c.drawImage(tile, x * 1024 / 6, y * 1024 / 6, 1024 / 6 + 1, 1024 / 6 + 1);
      c.fillStyle = 'rgba(184,192,139,.18)'; c.fillRect(0, 0, 1024, 1024);
      c.strokeStyle = '#b4b28d'; c.lineWidth = 8; c.strokeRect(21, 21, 982, 982);
      c.strokeStyle = '#f2e8c3'; c.lineWidth = 3; c.setLineDash([9, 9]); c.strokeRect(37, 37, 950, 950); c.setLineDash([]);
    });
    const rugMat = new THREE.MeshStandardMaterial({ map: rugMap, bumpMap: rugMap, bumpScale: 0.016, roughness: 1 });
    resources.add(rugMat);
    const rug = box(27, 0.05, 27, 0xd8d8b7, 0, 0.005, 0, 1.3);
    rug.material = rugMat;
    // Furnishings beyond the arena sell the scale without blocking the camera.
    const table = local(21, 0);
    const tableMap = atlasTexture('surface-atlas.jpg', 0, 0, 2, 2, groundFallback, 2);
    const tableMaterial = new THREE.MeshStandardMaterial({ map: tableMap, bumpMap: tableMap, bumpScale: 0.012, color: 0xe6bc93, roughness: 0.67 });
    resources.add(tableMaterial);
    box(9, 0.7, 12, 0xc98b5f, 0, 8, 0, 0.22, table).material = tableMaterial;
    for (const x of [-3.7, 3.7]) for (const z of [-4.7, 4.7]) box(0.7, 8, 0.7, colors.brown, x, 4, z, 0.1, table);
    mug(0, 0, colors.cream, 1.2, table).position.y = 8.4;
    book(-21, 7, 6, 0.9, 7, colors.pink, 0.12);
    const b = book(-21, 7, 5.7, 0.8, 6.4, colors.blue, -0.1); b.position.y = 0.9;
    plant(19, -18, 1.1, colors.peach);
    block(-5.7, -6, 1.4, 1.3, 1.4, colors.blue, 0.3);
    block(5.7, 6.5, 1.2, 1.2, 1.2, colors.coral, -0.2);
    block(6.4, 7, 1.1, 1.1, 1.1, colors.yellow, 0.1).position.y = 1.2;
    // Mid-distance landmarks make the room legible from the shoulder camera.
    book(-11, -9, 4.3, 0.75, 3.5, colors.pink, -0.2);
    const atlas = book(-11, -9, 4, 0.6, 3.3, colors.blue, 0.12); atlas.position.y = 0.75;
    obstacles.push({ x: -11, z: -9, r: 2.2 });
    block(10.5, -8, 2.2, 2.4, 2.2, colors.yellow, 0.2);
    const upperBlock = block(10.6, -8, 1.8, 1.8, 1.8, colors.coral, -0.1, false); upperBlock.position.y = 2.4;
    mug(-10.5, 8, colors.cream, 1.15);
    obstacles.push({ x: -10.5, z: 8, r: 1.5 });
    cerealBowl(10.5, 9);
    const storyBook = book(-15, -12.5, 4.1, 0.75, 6.2, colors.blue, 0.18);
    storyBook.rotation.x = Math.PI / 2; storyBook.position.y = 3.1;
    obstacles.push({ x: -15, z: -12.5, r: 2.05 });
    const musicBox = local(13, -13);
    box(3.8, 2.6, 3.2, colors.peach, 0, 1.3, 0, 0.25, musicBox);
    box(4, 0.4, 3.4, colors.cream, 0, 2.8, 0, 0.15, musicBox);
    box(3.3, 0.16, 2.8, colors.yellow, 0, 0.2, 0, 0.05, musicBox);
    const key = torus(0.38, 0.09, colors.yellow, 2.1, 1.3, 0, musicBox); key.rotation.y = Math.PI / 2;
    sphere(0.72, colors.cream, 0, 3.6, 0, musicBox, 1, 0.85, 1);
    sphere(0.22, colors.cream, -0.48, 4.1, 0, musicBox);
    sphere(0.22, colors.cream, 0.48, 4.1, 0, musicBox);
    sphere(0.06, colors.brown, -0.22, 3.66, 0.68, musicBox, 1, 1, 0.4);
    sphere(0.06, colors.brown, 0.22, 3.66, 0.68, musicBox, 1, 1, 0.4);
    decal(2, 2.5, 1.45, 0, 1.45, 1.615, musicBox);
    obstacles.push({ x: 13, z: -13, r: 2.05 });
    const pencil = cylinder(0.13, 0.13, 3, colors.yellow, -10, 0.16, 7);
    pencil.rotation.z = Math.PI / 2; pencil.rotation.y = 0.3;
    fan(-8, -4);
    domino(8, 1);
    snack(-3, 9);
  } else if (stage === 1) {
    wall(0, -25, 65, 20, 0.7, 0xf1e6d1);
    wall(-26, 0, 0.7, 20, 50, 0xe7e4cf);
    for (let i = -3; i <= 3; i++) {
      box(7.3, 8, 4, i % 2 ? 0xb8c9b3 : 0xa8bea7, i * 7.5, 4.3, -22, 0.1);
      box(6.8, 7.4, 0.1, 0xc5d5bd, i * 7.5, 4.3, -19.93, 0.05);
      box(1.3, 0.15, 0.18, 0xab8d62, i * 7.5, 7, -19.8, 0.04);
    }
    box(55, 0.75, 6, colors.cream, 0, 8.7, -22, 0.12);
    const bottle = local(-12, -22);
    cylinder(1.9, 1.9, 5, colors.cream, 0, 11.5, 0, bottle);
    cylinder(0.8, 1.5, 1.4, colors.cream, 0, 14.7, 0, bottle);
    cylinder(0.9, 0.9, 0.5, colors.coral, 0, 15.7, 0, bottle);
    box(2.3, 2.4, 0.1, colors.blue, 0, 11.5, 1.9, 0.12, bottle);
    mug(0, -22, colors.peach, 2.3).position.y = 9.2;
    plant(20, -21, 0.9, colors.yellow).position.y = 9.2;
    // Fallen chopping board and oversized spoon on the perimeter.
    const board = box(10, 0.3, 15, 0xc59b6c, -22, 0.2, 1, 0.8); board.rotation.y = -0.14;
    const boardMap = atlasTexture('surface-atlas.jpg', 0, 0, 2, 2, groundTexture('wood'), 2);
    const boardMaterial = new THREE.MeshStandardMaterial({ map: boardMap, bumpMap: boardMap, bumpScale: 0.014, roughness: 0.87, color: 0xe7c798 });
    resources.add(boardMaterial); board.material = boardMaterial;
    cylinder(0.6, 0.6, 0.31, colors.ink, -22, 0.21, 8);
    const spoon = local(20, 5); spoon.rotation.y = 0.3;
    box(0.55, 0.25, 10, 0xc8d0cc, 0, 0.3, 0, 0.2, spoon);
    sphere(2, 0xc8d0cc, 0, 0.45, -5.5, spoon, 0.7, 0.13, 1);
    // A gingham napkin gives the combat space a warm visual anchor.
    const napkin = box(8, 0.045, 6, colors.peach, 10, 0.01, 10, 0.1); napkin.rotation.y = 0.2;
    for (let i = -3; i <= 3; i++) {
      const stripe = box(0.2, 0.015, 6, 0xf6cfac, i, 0.035, 0, 0.01, napkin);
      stripe.position.y = 0.035;
    }
    const cookie = cylinder(1, 1, 0.3, 0xd5a86b, -4, 0.18, -7, group, 18);
    for (let i = 0; i < 7; i++) { const a = i * 2.4; sphere(0.11, colors.brown, -4 + Math.cos(a) * 0.6, 0.35, -7 + Math.sin(a) * 0.6, group, 1, 0.35, 1); }
    obstacles.push({ x: -4, z: -7, r: 1 });
    const sugar = block(5, 7, 1.3, 1.2, 1.3, colors.white, 0.2); sugar.rotation.z = 0.1;
    cerealBowl(-11, -9);
    mug(10.8, 8, colors.blue, 1.3);
    obstacles.push({ x: 10.8, z: 8, r: 1.7 });
    const carton = local(-11, 8);
    box(2.2, 3.2, 2.2, colors.cream, 0, 1.6, 0, 0.12, carton);
    box(2.24, 1.55, 2.24, colors.blue, 0, 1.1, 0, 0.08, carton);
    const cartonTop = box(1.6, 1.6, 2.2, colors.cream, 0, 3.2, 0, 0.08, carton); cartonTop.rotation.z = Math.PI / 4;
    box(0.22, 0.6, 2.2, colors.blue, 0, 4.1, 0, 0.04, carton);
    obstacles.push({ x: -11, z: 8, r: 1.6 });
    const cerealBox = local(-14, -12);
    cerealBox.rotation.y = 0.18;
    box(3.5, 5.9, 1.6, colors.cream, 0, 2.95, 0, 0.13, cerealBox);
    box(3.54, 0.32, 1.64, colors.coral, 0, 5.7, 0, 0.06, cerealBox);
    decal(3, 3.23, 5.25, 0, 2.85, 0.815, cerealBox);
    const flap = box(3.4, 0.06, 0.95, colors.cream, 0, 6.12, -0.3, 0.025, cerealBox); flap.rotation.x = -0.35;
    obstacles.push({ x: -14, z: -12, r: 1.9 });
    const honeyTin = local(13.5, -12.5); honeyTin.rotation.y = -0.2;
    cylinder(1.7, 1.7, 4.1, colors.yellow, 0, 2.05, 0, honeyTin);
    cylinder(1.79, 1.79, 0.27, colors.cream, 0, 4.22, 0, honeyTin);
    cylinder(0.36, 0.36, 0.2, colors.yellow, 0, 4.45, 0, honeyTin);
    decal(4, 2.25, 2.9, 0, 2.1, 1.715, honeyTin);
    const tinBand = torus(1.71, 0.06, colors.cream, 0, 0.24, 0, honeyTin); tinBand.rotation.x = Math.PI / 2;
    obstacles.push({ x: 13.5, z: -12.5, r: 1.8 });
    honey(-8, -4);
    kettle(8, -3);
    snack(0, 10);
  } else {
    // Garden walls become a gigantic picket fence and oversized potted plants.
    for (let i = -9; i <= 9; i++) {
      box(2.1, 12.5, 0.4, 0xe6d0a5, i * 2.5, 6.2, -24, 0.2);
      const cap = box(1.52, 1.52, 0.4, 0xe6d0a5, i * 2.5, 12.3, -24, 0.06); cap.rotation.z = Math.PI / 4;
    }
    box(49, 0.9, 0.6, 0xc0a37a, 0, 3.5, -23.6, 0.1);
    box(49, 0.9, 0.6, 0xc0a37a, 0, 8.5, -23.6, 0.1);
    plant(-21, -15, 2.7, colors.peach);
    plant(21, -12, 2.2, colors.blue);
    plant(22, 15, 1.6, colors.coral);
    // Winding garden hose stays outside the traversable central space.
    const hoseCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-25, 0.25, 15), new THREE.Vector3(-20, 0.25, 10),
      new THREE.Vector3(-20, 0.25, 1), new THREE.Vector3(-17, 0.25, -3),
      new THREE.Vector3(-15, 0.25, -12), new THREE.Vector3(-20, 0.25, -21),
    ]);
    mesh(new THREE.TubeGeometry(hoseCurve, 48, 0.27, 8, false), mat(0x789a6e));
    // 42 flowers use three instanced draws instead of 294 separate shadow casters.
    const rnd = seedRandom(32);
    const stemGeometry = new THREE.CylinderGeometry(1, 1, 1, 7);
    const petalGeometry = new THREE.SphereGeometry(1, 10, 7);
    const centerGeometry = new THREE.SphereGeometry(1, 10, 7);
    for (const geometry of [stemGeometry, petalGeometry, centerGeometry]) resources.add(geometry);
    const stems = new THREE.InstancedMesh(stemGeometry, mat(0x6e8e59), 42);
    const petals = new THREE.InstancedMesh(petalGeometry, mat(colors.white), 210);
    const centers = new THREE.InstancedMesh(centerGeometry, mat(colors.yellow), 42);
    for (const item of [stems, petals, centers]) { item.castShadow = false; item.receiveShadow = true; resources.add(item); group.add(item); }
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 42; i++) {
      const a = i * 2.4, r = 19 + rnd() * 7;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = 1.6 + rnd();
      dummy.position.set(x, h / 2, z); dummy.scale.set(0.06, h, 0.06); dummy.updateMatrix(); stems.setMatrixAt(i, dummy.matrix);
      for (let j = 0; j < 5; j++) {
        const b = j * Math.PI * 2 / 5;
        dummy.position.set(x + Math.cos(b) * 0.33, h, z + Math.sin(b) * 0.33);
        dummy.scale.set(0.34, 0.095, 0.34); dummy.updateMatrix(); petals.setMatrixAt(i * 5 + j, dummy.matrix);
        petals.setColorAt(i * 5 + j, new THREE.Color(i % 3 === 0 ? colors.pink : colors.cream));
      }
      dummy.position.set(x, h + 0.07, z); dummy.scale.set(0.2, 0.08, 0.2); dummy.updateMatrix(); centers.setMatrixAt(i, dummy.matrix);
    }
    stems.instanceMatrix.needsUpdate = petals.instanceMatrix.needsUpdate = centers.instanceMatrix.needsUpdate = true;
    petals.instanceColor.needsUpdate = true;
    for (const [x, z, size] of [[-3, -7, 1.1], [4, 7, 0.9]]) {
      sphere(size, 0xb1afa0, x, size * 0.35, z, group, 1.2, 0.55, 0.9);
      obstacles.push({ x, z, r: size });
    }
    // A fallen leaf, enormous at bear scale, is a little landmark.
    const leaf = sphere(2.4, 0xc9bb6c, 11, 0.12, -9, group, 0.55, 0.06, 1.2); leaf.rotation.y = -0.6;
    box(0.045, 0.035, 4.5, 0xa49858, 11, 0.27, -9, 0.01).rotation.y = -0.6;
    const wateringCan = local(-11, -8);
    cylinder(1.4, 1.35, 2.1, colors.teal, 0, 1.05, 0, wateringCan);
    cylinder(0.85, 0.85, 0.05, 0x477c70, 0, 2.12, 0, wateringCan);
    const canRim = torus(1.36, 0.09, colors.cream, 0, 2.1, 0, wateringCan); canRim.rotation.x = Math.PI / 2;
    const canHandle = torus(1.05, 0.13, colors.teal, -0.6, 1.7, 0, wateringCan); canHandle.rotation.y = Math.PI / 2;
    const canSpout = cylinder(0.2, 0.45, 2.5, colors.teal, 1.75, 1.45, 0, wateringCan); canSpout.rotation.z = -0.95;
    const canHead = cylinder(0.6, 0.28, 0.3, colors.cream, 2.7, 2.18, 0, wateringCan); canHead.rotation.z = -0.95;
    obstacles.push({ x: -11, z: -8, r: 1.6 });
    const packet = local(11, 9);
    packet.rotation.y = -0.2; packet.rotation.z = 0.08;
    box(2.1, 3.1, 0.3, colors.cream, 0, 1.55, 0, 0.07, packet);
    box(1.9, 0.5, 0.035, colors.teal, 0, 2.65, 0.17, 0.03, packet);
    decal(5, 1.85, 2.35, 0, 1.5, 0.18, packet);
    obstacles.push({ x: 11, z: 9, r: 1.15 });
    plant(-13.5, -12, 1.15, colors.peach);
    obstacles.push({ x: -13.5, z: -12, r: 1.95 });
    const seedTin = local(13, -13);
    box(3.2, 4.9, 1.6, colors.cream, 0, 2.45, 0, 0.2, seedTin);
    box(3.35, 0.3, 1.75, colors.teal, 0, 4.85, 0, 0.1, seedTin);
    decal(5, 2.9, 4.2, 0, 2.4, 0.815, seedTin);
    obstacles.push({ x: 13, z: -13, r: 1.8 });
    sprinkler(-8, -5);
    mushroom(8, 2);
    snack(-3, 10);
  }

  return {
    group, obstacles, interactables, spawnPoints, bounds,
    update(t, dt = 0.016) {
      for (const fn of animated) fn(t, dt);
    },
    dispose() {
      alive = false;
      scene.remove(group);
      for (const resource of resources) resource.dispose?.();
      group.clear();
    },
  };
}
