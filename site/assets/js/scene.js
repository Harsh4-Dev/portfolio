/*
 * scene.js — the 3D "history of learning machines" background.
 *
 * One pool of doodle-style nodes (cream disc + ink ring sprites) and wobbly ink edges.
 * setShape(id) morphs the pool into a real architecture from ML history:
 *   neuron        1943  McCulloch–Pitts threshold unit
 *   perceptron    1958  Rosenblatt's Mark I (retina grid → randomly wired association units → response units)
 *   mlp           1986  fully-connected network trained with backprop
 *   cnn           1998  LeNet-5 (feature-map stacks, subsampling, dense head)
 *   deep          2012  AlexNet (two GPU streams, cross-talk at some layers)
 *   transformer   2017  stacked token rows, every token attends to every token (two heads)
 *   constellation now   a knowledge graph
 *
 * API:  const s = createScene(canvas, { palette, density, asideOpacity })
 *       s.setShape('cnn'); s.setMode('hero'|'aside'); s.burst(); s.setPalette(p); s.destroy()
 */
import * as THREE from 'three';

const DENSITY = { low: { pulses: 40, dust: 30 }, medium: { pulses: 90, dust: 60 }, high: { pulses: 160, dust: 90 } };
const MAX_NODES = 260;
const MAX_EDGES = 420;
const SEG = 3; // wobble segments per edge
const CAM_Z = 13;
const FOV = 42;

// ------------------------------------------------------------------ deterministic random
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ------------------------------------------------------------------ textures (drawn on a canvas, so they look hand-made)
function wobblyCircle(ctx, cx, cy, r, jitter, rnd, phase = 0) {
  const n = 48;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 + phase;
    const rr = r + Math.sin(a * 3 + phase * 7) * jitter + (rnd() - 0.5) * jitter * 0.6;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function makeTexture(kind, seed = 7) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const rnd = mulberry(seed);
  ctx.clearRect(0, 0, size, size);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (kind === 'ring') {
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 7;
    wobblyCircle(ctx, 64, 64, 44, 3.2, rnd, 0.3);
    ctx.stroke();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    wobblyCircle(ctx, 64, 64, 44, 4, rnd, 1.9);
    ctx.stroke();
  } else if (kind === 'disc') {
    ctx.fillStyle = 'rgba(255,255,255,1)';
    wobblyCircle(ctx, 64, 64, 44, 2.5, rnd, 0.3);
    ctx.fill();
  } else if (kind === 'pulse') {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.85)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  } else if (kind === 'star') {
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI;
      ctx.moveTo(64 - Math.cos(a) * 40, 64 - Math.sin(a) * 40);
      ctx.lineTo(64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40);
    }
    ctx.stroke();
  } else if (kind === 'plus') {
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(22, 66); ctx.quadraticCurveTo(64, 58, 106, 62);
    ctx.moveTo(66, 22); ctx.quadraticCurveTo(58, 64, 62, 106);
    ctx.stroke();
  } else if (kind === 'tri') {
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(64, 20); ctx.lineTo(108, 100); ctx.lineTo(20, 104); ctx.closePath();
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  return tex;
}

// ------------------------------------------------------------------ shaders
const VERT = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 color;
  uniform float uScale;
  uniform float uSize;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vAlpha = alpha;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(0.0, size * uSize * uScale / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG_COLOR = /* glsl */ `
  uniform sampler2D map;
  uniform float uOpacity;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 t = texture2D(map, gl_PointCoord);
    float a = t.a * vAlpha * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * t.rgb, a);
  }
`;
const FRAG_INK = /* glsl */ `
  uniform sampler2D map;
  uniform float uOpacity;
  uniform vec3 uInk;
  varying float vAlpha;
  void main() {
    vec4 t = texture2D(map, gl_PointCoord);
    float a = t.a * vAlpha * uOpacity;
    if (a < 0.01) discard;
    gl_FragColor = vec4(uInk, a);
  }
`;

// ------------------------------------------------------------------ layouts
// each returns { nodes: [{p:[x,y,z], c: paletteIndex, s: size}], edges: [[a,b], ...] } (edges are directed: signal flows a -> b)
// palette indices: 0 paper, 1 accent, 2 accent2, 3 accent3, 4 accent4

function grid(cx, cy, cz, rows, cols, spacing, orient = 'yz', tilt = 0.72) {
  // orient 'yz': a plane facing +x, tilted towards the camera by `tilt`; 'xy': facing camera
  const pts = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const u = (j - (cols - 1) / 2) * spacing;
      const v = (i - (rows - 1) / 2) * spacing;
      if (orient === 'xy') pts.push([cx + u, cy - v, cz]);
      else pts.push([cx + u * tilt, cy - v, cz + u * Math.sqrt(1 - tilt * tilt)]);
    }
  }
  return pts;
}

const LAYOUTS = {
  neuron() {
    const rnd = mulberry(11);
    const nodes = [], edges = [];
    const soma = nodes.push({ p: [0.3, 0, 0], c: 1, s: 1.7 }) - 1;
    for (let i = 0; i < 7; i++) {
      const y = (i - 3) * 0.78;
      const a = nodes.push({ p: [-3.6, y, (rnd() - 0.5) * 1.2], c: 3, s: 0.55 }) - 1;
      const b = nodes.push({ p: [-1.7, y * 0.55, (rnd() - 0.5) * 0.8], c: 0, s: 0.42 }) - 1;
      edges.push([a, b], [b, soma]);
    }
    const ax1 = nodes.push({ p: [1.9, 0.05, 0], c: 0, s: 0.45 }) - 1;
    const ax2 = nodes.push({ p: [3.0, 0.1, 0], c: 0, s: 0.45 }) - 1;
    edges.push([soma, ax1], [ax1, ax2]);
    for (let i = 0; i < 3; i++) {
      const t = nodes.push({ p: [4.0, (i - 1) * 0.9, (rnd() - 0.5) * 0.8], c: 2, s: 0.6 }) - 1;
      edges.push([ax2, t]);
    }
    return { nodes, edges };
  },

  perceptron() {
    const rnd = mulberry(1958);
    const nodes = [], edges = [];
    const retina = grid(-3.5, 0, 0, 7, 7, 0.58, 'yz', 0.72);
    const retinaIdx = retina.map((p, i) => nodes.push({ p, c: 0, s: 0.38 + ((i * 7) % 5 === 0 ? 0.06 : 0) }) - 1);
    const assoc = [];
    for (let i = 0; i < 13; i++) {
      const y = (rnd() - 0.5) * 4.2, z = (rnd() - 0.5) * 2.2, x = -0.6 + (rnd() - 0.5) * 1.6;
      assoc.push(nodes.push({ p: [x, y, z], c: rnd() < 0.3 ? 3 : 0, s: 0.62 }) - 1);
    }
    const resp = [];
    for (let i = 0; i < 3; i++) resp.push(nodes.push({ p: [3.4, (i - 1) * 1.3, 0], c: 2, s: 1.05 }) - 1);
    // Mark I: association units were wired to the retina at random
    for (const a of assoc) {
      const used = new Set();
      while (used.size < 6) used.add(Math.floor(rnd() * retinaIdx.length));
      for (const r of used) edges.push([retinaIdx[r], a]);
    }
    for (const a of assoc) for (const r of resp) edges.push([a, r]);
    return { nodes, edges };
  },

  mlp() {
    const rnd = mulberry(1986);
    const nodes = [], edges = [];
    const sizes = [6, 9, 9, 4];
    const xs = [-3.5, -1.15, 1.15, 3.5];
    const layers = sizes.map((n, li) => {
      const arr = [];
      for (let i = 0; i < n; i++) {
        const y = (i - (n - 1) / 2) * 0.62;
        const c = li === 0 ? 3 : li === sizes.length - 1 ? 1 : 0;
        arr.push(nodes.push({ p: [xs[li], y, (rnd() - 0.5) * 0.7], c, s: li === sizes.length - 1 ? 0.8 : 0.58 }) - 1);
      }
      return arr;
    });
    for (let l = 0; l < layers.length - 1; l++) for (const a of layers[l]) for (const b of layers[l + 1]) edges.push([a, b]);
    return { nodes, edges };
  },

  cnn() {
    const rnd = mulberry(1998);
    const nodes = [], edges = [];
    const add = (pts, c, s) => pts.map((p) => nodes.push({ p, c, s }) - 1);
    const input = add(grid(-4.3, 0, 0, 6, 6, 0.46, 'yz', 0.72), 3, 0.3);
    const c1 = [-0.85, 0, 0.85].map((dz, k) => add(grid(-2.5 + k * 0.12, 0.15 * (k - 1), dz, 5, 5, 0.4, 'yz', 0.72), 0, 0.3));
    const s2 = [-0.85, 0, 0.85].map((dz, k) => add(grid(-0.9 + k * 0.12, 0.15 * (k - 1), dz, 3, 3, 0.48, 'yz', 0.72), 0, 0.34));
    const c3 = [-1.2, -0.6, 0, 0.6, 1.2].map((dz, k) => add(grid(0.7 + k * 0.08, 0.1 * (k - 2), dz, 2, 2, 0.5, 'yz', 0.72), 0, 0.36));
    const f = [];
    for (let i = 0; i < 10; i++) f.push(nodes.push({ p: [2.5, (i - 4.5) * 0.5, (rnd() - 0.5) * 0.5], c: 0, s: 0.42 }) - 1);
    const out = [];
    for (let i = 0; i < 4; i++) out.push(nodes.push({ p: [3.9, (i - 1.5) * 0.85, 0], c: 1, s: 0.72 }) - 1);
    // receptive fields: each C1 cell reads a nearby input cell
    for (const m of c1) m.forEach((n, i) => {
      const r = Math.floor(i / 5), cc = i % 5;
      edges.push([input[r * 6 + cc], n]);
      if (rnd() < 0.35) edges.push([input[(r + 1) * 6 + cc + 1], n]);
    });
    // subsampling: S2 cell pools a 2x2 C1 block
    c1.forEach((m, k) => s2[k].forEach((n, i) => {
      const r = Math.floor(i / 3), cc = i % 3;
      edges.push([m[Math.min(4, r * 2) * 5 + Math.min(4, cc * 2)], n]);
      if (rnd() < 0.5) edges.push([m[Math.min(4, r * 2 + 1) * 5 + Math.min(4, cc * 2 + 1)], n]);
    }));
    // C3 mixes maps
    for (const m of c3) for (const n of m) for (let k = 0; k < 2; k++) {
      const src = s2[Math.floor(rnd() * 3)];
      edges.push([src[Math.floor(rnd() * src.length)], n]);
    }
    const c3flat = c3.flat();
    for (const n of f) for (let k = 0; k < 4; k++) edges.push([c3flat[Math.floor(rnd() * c3flat.length)], n]);
    for (const a of f) for (const b of out) edges.push([a, b]);
    return { nodes, edges };
  },

  deep() {
    const rnd = mulberry(2012);
    const nodes = [], edges = [];
    const spec = [[3, 4], [4, 4], [4, 4], [4, 4], [3, 3], [2, 2]];
    const xs = [-3.8, -2.3, -0.8, 0.7, 2.2, 3.5];
    const halves = spec.map(([r, c], li) => [
      grid(xs[li], 1.25, 0, r, c, 0.42, 'yz', 0.72).map((p) => nodes.push({ p, c: li === 0 ? 3 : 0, s: 0.36 }) - 1),
      grid(xs[li], -1.25, 0, r, c, 0.42, 'yz', 0.72).map((p) => nodes.push({ p, c: li === 0 ? 3 : 0, s: 0.36 }) - 1),
    ]);
    const out = [];
    for (let i = 0; i < 5; i++) out.push(nodes.push({ p: [4.5, (i - 2) * 0.7, 0], c: 1, s: 0.66 }) - 1);
    for (let l = 0; l < halves.length - 1; l++) {
      for (let h = 0; h < 2; h++) {
        for (const a of halves[l][h]) for (let k = 0; k < 2; k++) {
          const dst = halves[l + 1][h];
          edges.push([a, dst[Math.floor(rnd() * dst.length)]]);
        }
        // the two GPUs only talk at certain layers (AlexNet: after layer 2 and in the dense head)
        if (l === 1 || l === 4) {
          const dst = halves[l + 1][1 - h];
          for (let k = 0; k < 4; k++) edges.push([halves[l][h][Math.floor(rnd() * halves[l][h].length)], dst[Math.floor(rnd() * dst.length)]]);
        }
      }
    }
    for (const h of halves[halves.length - 1]) for (const a of h) for (const b of out) edges.push([a, b]);
    return { nodes, edges };
  },

  transformer() {
    const rnd = mulberry(2017);
    const nodes = [], edges = [];
    const T = 6, L = 5;
    for (const z of [-0.75, 0.75]) {
      const rows = [];
      for (let l = 0; l < L; l++) {
        const row = [];
        for (let t = 0; t < T; t++) {
          const x = (t - (T - 1) / 2) * 1.25;
          const y = (l - (L - 1) / 2) * 1.05;
          const c = l === 0 ? 3 : l === L - 1 ? 1 : 0;
          row.push(nodes.push({ p: [x, y, z + (rnd() - 0.5) * 0.15], c, s: l === 0 || l === L - 1 ? 0.62 : 0.5 }) - 1);
        }
        rows.push(row);
      }
      for (let l = 0; l < L - 1; l++) for (const a of rows[l]) for (const b of rows[l + 1]) edges.push([a, b]);
    }
    return { nodes, edges };
  },

  constellation() {
    const rnd = mulberry(42);
    const nodes = [], edges = [];
    const N = 110;
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = golden * i;
      const R = 2.9 + (rnd() - 0.5) * 1.1;
      const p = [Math.cos(th) * r * R * 1.25, y * R * 0.85, Math.sin(th) * r * R];
      nodes.push({ p, c: rnd() < 0.14 ? 1 + Math.floor(rnd() * 4) : 0, s: 0.3 + rnd() * 0.45 });
    }
    for (let i = 0; i < 14; i++) nodes.push({ p: [(rnd() - 0.5) * 3, (rnd() - 0.5) * 2.2, (rnd() - 0.5) * 2.4], c: 0, s: 0.3 + rnd() * 0.3 });
    // k nearest neighbours
    const seen = new Set();
    nodes.forEach((n, i) => {
      const d = nodes.map((m, j) => [j, Math.hypot(m.p[0] - n.p[0], m.p[1] - n.p[1], m.p[2] - n.p[2])]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]);
      for (let k = 0; k < 2; k++) {
        const j = d[k][0];
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!seen.has(key)) { seen.add(key); edges.push([i, j]); }
      }
    });
    return { nodes, edges };
  },
};

LAYOUTS.scatter = function scatter() {
  const rnd = mulberry(3);
  const nodes = [];
  for (let i = 0; i < 90; i++) nodes.push({ p: [(rnd() - 0.5) * 16, (rnd() - 0.5) * 10, (rnd() - 0.5) * 8], c: 0, s: 0.25 + rnd() * 0.3 });
  return { nodes, edges: [] };
};

export const SHAPES = Object.keys(LAYOUTS).filter((k) => k !== 'scatter');

// ------------------------------------------------------------------ the scene
export function createScene(canvas, opts = {}) {
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const density = DENSITY[opts.density] || DENSITY.medium;
  let palette = normalisePalette(opts.palette);
  const asideOpacity = opts.asideOpacity ?? 0.55;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);
  const group = new THREE.Group();
  scene.add(group);

  // --- node pool
  const pos = new Float32Array(MAX_NODES * 3);
  const col = new Float32Array(MAX_NODES * 3);
  const sizeA = new Float32Array(MAX_NODES);
  const alphaA = new Float32Array(MAX_NODES);
  const from = { p: new Float32Array(MAX_NODES * 3), c: new Float32Array(MAX_NODES * 3), s: new Float32Array(MAX_NODES) };
  const target = { p: new Float32Array(MAX_NODES * 3), c: new Float32Array(MAX_NODES * 3), s: new Float32Array(MAX_NODES) };
  const delay = new Float32Array(MAX_NODES);
  const rndPool = mulberry(99);
  for (let i = 0; i < MAX_NODES; i++) {
    delay[i] = rndPool() * 0.35;
    // start scattered far away
    pos[i * 3] = (rndPool() - 0.5) * 30; pos[i * 3 + 1] = (rndPool() - 0.5) * 20; pos[i * 3 + 2] = (rndPool() - 0.5) * 10 - 4;
  }
  target.p.set(pos); from.p.set(pos);

  const nodeGeo = new THREE.BufferGeometry();
  nodeGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  nodeGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  nodeGeo.setAttribute('size', new THREE.BufferAttribute(sizeA, 1));
  nodeGeo.setAttribute('alpha', new THREE.BufferAttribute(alphaA, 1));

  const tex = { ring: makeTexture('ring', 5), disc: makeTexture('disc', 9), pulse: makeTexture('pulse'), star: makeTexture('star'), plus: makeTexture('plus'), tri: makeTexture('tri') };
  const uni = { uScale: { value: 300 }, uOpacity: { value: 1 }, uSize: { value: 1 } };
  const discMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG_COLOR, uniforms: { map: { value: tex.disc }, uScale: uni.uScale, uOpacity: uni.uOpacity, uSize: uni.uSize }, transparent: true, depthWrite: false, depthTest: false });
  const ringMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG_INK, uniforms: { map: { value: tex.ring }, uScale: uni.uScale, uOpacity: uni.uOpacity, uSize: uni.uSize, uInk: { value: palette.ink.clone() } }, transparent: true, depthWrite: false, depthTest: false });
  const discs = new THREE.Points(nodeGeo, discMat);
  const rings = new THREE.Points(nodeGeo, ringMat);
  discs.renderOrder = 2; rings.renderOrder = 3;
  group.add(discs, rings);

  // --- two edge buffers (old set fades out while the new set fades in)
  function makeEdgeSet() {
    const p = new Float32Array(MAX_EDGES * SEG * 2 * 3);
    const c = new Float32Array(MAX_EDGES * SEG * 2 * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    geo.setDrawRange(0, 0);
    const mat = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 1, depthWrite: false, depthTest: false });
    const obj = new THREE.LineSegments(geo, mat);
    obj.renderOrder = 1;
    group.add(obj);
    return { geo, p, c, obj, edges: [], wob: new Float32Array(MAX_EDGES * (SEG - 1) * 3), alpha: 0, fading: false };
  }
  const edgeSets = [makeEdgeSet(), makeEdgeSet()];
  let cur = 0;

  // --- pulses
  const pulseCount = reduced ? 0 : density.pulses;
  const pPos = new Float32Array(Math.max(1, pulseCount) * 3);
  const pCol = new Float32Array(Math.max(1, pulseCount) * 3);
  const pSize = new Float32Array(Math.max(1, pulseCount));
  const pAlpha = new Float32Array(Math.max(1, pulseCount));
  const pulses = [];
  const pulseGeo = new THREE.BufferGeometry();
  pulseGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pulseGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  pulseGeo.setAttribute('size', new THREE.BufferAttribute(pSize, 1));
  pulseGeo.setAttribute('alpha', new THREE.BufferAttribute(pAlpha, 1));
  const pulseMat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG_COLOR, uniforms: { map: { value: tex.pulse }, uScale: uni.uScale, uOpacity: uni.uOpacity, uSize: uni.uSize }, transparent: true, depthWrite: false, depthTest: false, blending: THREE.NormalBlending });
  const pulseObj = new THREE.Points(pulseGeo, pulseMat);
  pulseObj.renderOrder = 4;
  group.add(pulseObj);
  const rndP = mulberry(7);
  for (let i = 0; i < pulseCount; i++) pulses.push({ e: -1, t: rndP(), v: 0.35 + rndP() * 0.5, c: 1 + Math.floor(rndP() * 4), s: 0.22 + rndP() * 0.16, burst: false });

  // --- dust (far background doodles)
  const dustGroup = new THREE.Group();
  scene.add(dustGroup);
  const dustKinds = ['star', 'plus', 'tri'];
  const dusts = [];
  const rndD = mulberry(1234);
  dustKinds.forEach((k, ki) => {
    const n = Math.floor(density.dust / dustKinds.length);
    const dp = new Float32Array(n * 3), dc = new Float32Array(n * 3), ds = new Float32Array(n), da = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      dp[i * 3] = (rndD() - 0.5) * 34; dp[i * 3 + 1] = (rndD() - 0.5) * 22; dp[i * 3 + 2] = -6 - rndD() * 10;
      ds[i] = 0.25 + rndD() * 0.35; da[i] = 0.18 + rndD() * 0.25;
      palette.ink.toArray(dc, i * 3);
      dusts.push({ i, ki, base: dp[i * 3 + 1], ph: rndD() * 6.28, sp: 0.2 + rndD() * 0.4 });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(dp, 3));
    g.setAttribute('color', new THREE.BufferAttribute(dc, 3));
    g.setAttribute('size', new THREE.BufferAttribute(ds, 1));
    g.setAttribute('alpha', new THREE.BufferAttribute(da, 1));
    const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG_COLOR, uniforms: { map: { value: tex[k] }, uScale: uni.uScale, uOpacity: { value: 1 }, uSize: { value: 1 } }, transparent: true, depthWrite: false, depthTest: false });
    const o = new THREE.Points(g, m);
    o.userData.geo = g;
    dustGroup.add(o);
  });

  // --- state
  let shapeId = null;
  let nodeCount = 0;
  let morphT = 1;
  let morphDur = 1.7;
  let mode = 'hero';
  const want = { x: 0, y: 0, s: 1, o: 1 };
  const have = { x: 0, y: 0, s: 1, o: 1 };
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let adjacency = [];
  let time = 0;
  let running = true;
  let raf = 0;
  const clock = new THREE.Clock();

  function normalisePalette(p = {}) {
    const c = (v, d) => new THREE.Color(v || d);
    return {
      paper: c(p.paper, '#f7efe1'), ink: c(p.ink, '#2a2622'),
      accents: [c(p.paper2 || p.paper, '#f1e5cf'), c(p.accent, '#e2674a'), c(p.accent2, '#e8b43a'), c(p.accent3, '#2f9e8f'), c(p.accent4, '#6b6fd6')],
      edge: c(p.ink, '#2a2622').lerp(c(p.paper, '#f7efe1'), 0.35),
    };
  }

  function layoutOffsets() {
    const aspect = Number.isFinite(camera.aspect) && camera.aspect > 0 ? camera.aspect : 1.6;
    const w = 2 * CAM_Z * Math.tan((FOV * Math.PI) / 360) * aspect;
    if (mode === 'hero') {
      if (aspect < 0.95) return { x: w * 0.05, y: 1.2, s: 0.5, o: 0.55 };
      if (aspect < 1.3) return { x: w * 0.18, y: 0.4, s: 0.66, o: 0.85 };
      return { x: w * 0.26, y: 0.1, s: Math.min(1, (w * 0.44) / 9.5), o: 1 };
    }
    if (aspect < 0.95) return { x: w * 0.12, y: 1.5, s: 0.5, o: asideOpacity * 0.45 };
    if (aspect < 1.3) return { x: w * 0.25, y: 0, s: 0.65, o: asideOpacity * 0.8 };
    return { x: w * 0.32, y: 0, s: 0.74, o: asideOpacity };
  }

  function resize() {
    const w = canvas.clientWidth || window.innerWidth || 1;
    const h = canvas.clientHeight || window.innerHeight || 1;
    if (w < 2 || h < 2) return; // pane hidden / not laid out yet — try again on the next resize event
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uni.uScale.value = (h * renderer.getPixelRatio()) / (2 * Math.tan((FOV * Math.PI) / 360));
    Object.assign(want, layoutOffsets());
  }

  function applyLayout(layout) {
    const n = Math.min(layout.nodes.length, MAX_NODES);
    from.p.set(pos); from.c.set(col); from.s.set(sizeA);
    const rnd = mulberry(1000 + n);
    for (let i = 0; i < MAX_NODES; i++) {
      if (i < n) {
        const nd = layout.nodes[i];
        target.p[i * 3] = nd.p[0]; target.p[i * 3 + 1] = nd.p[1]; target.p[i * 3 + 2] = nd.p[2];
        palette.accents[nd.c] .toArray(target.c, i * 3);
        target.s[i] = nd.s;
      } else {
        // unused nodes drift out and shrink to nothing
        const px = pos[i * 3], py = pos[i * 3 + 1], pz = pos[i * 3 + 2];
        const len = Math.hypot(px, py, pz) || 1;
        target.p[i * 3] = px / len * 16 + (rnd() - 0.5) * 6;
        target.p[i * 3 + 1] = py / len * 10 + (rnd() - 0.5) * 4;
        target.p[i * 3 + 2] = pz / len * 6 - 4;
        target.s[i] = 0;
      }
    }
    nodeCount = n;
    // edges: swap buffers
    edgeSets[cur].fading = true;
    cur = 1 - cur;
    const es = edgeSets[cur];
    es.edges = layout.edges.slice(0, MAX_EDGES);
    es.fading = false;
    es.alpha = 0;
    const rndW = mulberry(77 + n);
    for (let e = 0; e < es.edges.length; e++) for (let k = 0; k < SEG - 1; k++) {
      es.wob[(e * (SEG - 1) + k) * 3] = (rndW() - 0.5) * 0.16;
      es.wob[(e * (SEG - 1) + k) * 3 + 1] = (rndW() - 0.5) * 0.16;
      es.wob[(e * (SEG - 1) + k) * 3 + 2] = (rndW() - 0.5) * 0.16;
    }
    adjacency = Array.from({ length: n }, () => []);
    es.edges.forEach(([a, b], ei) => { if (a < n) adjacency[a].push(ei); });
    for (const pu of pulses) { pu.e = -1; pu.t = rndP(); }
    morphT = reduced ? 1 : 0;
    if (reduced) { pos.set(target.p); col.set(target.c); sizeA.set(target.s); }
  }

  function updateEdges(es, dt) {
    // alpha
    if (es.fading) es.alpha = Math.max(0, es.alpha - dt * 2.2);
    else es.alpha = Math.min(1, es.alpha + dt * (morphT > 0.55 ? 1.6 : 0.4));
    const n = es.edges.length;
    if (es.alpha <= 0.001 || n === 0) { es.geo.setDrawRange(0, 0); return; }
    const a = es.alpha * have.o;
    const ec = palette.edge, pc = palette.paper;
    const r = pc.r + (ec.r - pc.r) * a, g = pc.g + (ec.g - pc.g) * a, b = pc.b + (ec.b - pc.b) * a;
    let vi = 0;
    for (let e = 0; e < n; e++) {
      const [ia, ib] = es.edges[e];
      const ax = pos[ia * 3], ay = pos[ia * 3 + 1], az = pos[ia * 3 + 2];
      const bx = pos[ib * 3], by = pos[ib * 3 + 1], bz = pos[ib * 3 + 2];
      // shorten so lines stop at the ring edge
      const ra = sizeA[ia] * 0.42, rb = sizeA[ib] * 0.42;
      const len = Math.hypot(bx - ax, by - ay, bz - az) || 1;
      const ux = (bx - ax) / len, uy = (by - ay) / len, uz = (bz - az) / len;
      const sx = ax + ux * ra, sy = ay + uy * ra, sz = az + uz * ra;
      const ex = bx - ux * rb, ey = by - uy * rb, ez = bz - uz * rb;
      let px = sx, py = sy, pz = sz;
      for (let k = 1; k <= SEG; k++) {
        let qx, qy, qz;
        if (k === SEG) { qx = ex; qy = ey; qz = ez; }
        else {
          const t = k / SEG, wi = (e * (SEG - 1) + k - 1) * 3, wl = Math.min(1.4, len * 0.5);
          qx = sx + (ex - sx) * t + es.wob[wi] * wl; qy = sy + (ey - sy) * t + es.wob[wi + 1] * wl; qz = sz + (ez - sz) * t + es.wob[wi + 2] * wl;
        }
        es.p[vi * 3] = px; es.p[vi * 3 + 1] = py; es.p[vi * 3 + 2] = pz;
        es.p[vi * 3 + 3] = qx; es.p[vi * 3 + 4] = qy; es.p[vi * 3 + 5] = qz;
        for (let m = 0; m < 2; m++) { es.c[vi * 3 + m * 3] = r; es.c[vi * 3 + m * 3 + 1] = g; es.c[vi * 3 + m * 3 + 2] = b; }
        vi += 2;
        px = qx; py = qy; pz = qz;
      }
    }
    es.geo.setDrawRange(0, vi);
    es.geo.attributes.position.needsUpdate = true;
    es.geo.attributes.color.needsUpdate = true;
  }

  function updatePulses(dt) {
    if (!pulseCount) return;
    const es = edgeSets[cur];
    const n = es.edges.length;
    for (let i = 0; i < pulses.length; i++) {
      const pu = pulses[i];
      if (n === 0 || morphT < 0.5) { pAlpha[i] = 0; continue; }
      if (pu.e < 0 || pu.e >= n) { pu.e = Math.floor(rndP() * n); pu.t = rndP() * 0.3; }
      pu.t += dt * pu.v * (pu.burst ? 2.2 : 1);
      if (pu.t >= 1) {
        const [, b] = es.edges[pu.e];
        const next = adjacency[b];
        if (next && next.length && rndP() < 0.9) pu.e = next[Math.floor(rndP() * next.length)];
        else { pu.e = Math.floor(rndP() * n); pu.burst = false; }
        pu.t = 0;
      }
      const [ia, ib] = es.edges[pu.e];
      const t = pu.t;
      pPos[i * 3] = pos[ia * 3] + (pos[ib * 3] - pos[ia * 3]) * t;
      pPos[i * 3 + 1] = pos[ia * 3 + 1] + (pos[ib * 3 + 1] - pos[ia * 3 + 1]) * t;
      pPos[i * 3 + 2] = pos[ia * 3 + 2] + (pos[ib * 3 + 2] - pos[ia * 3 + 2]) * t;
      palette.accents[pu.c].toArray(pCol, i * 3);
      pSize[i] = pu.s * (pu.burst ? 1.6 : 1);
      pAlpha[i] = Math.sin(t * Math.PI) * 0.95 * es.alpha;
    }
    pulseGeo.attributes.position.needsUpdate = true;
    pulseGeo.attributes.color.needsUpdate = true;
    pulseGeo.attributes.size.needsUpdate = true;
    pulseGeo.attributes.alpha.needsUpdate = true;
  }

  function updateNodes(dt) {
    if (morphT < 1) {
      morphT = Math.min(1, morphT + dt / morphDur);
      for (let i = 0; i < MAX_NODES; i++) {
        const t = easeInOut(clamp01((morphT - delay[i]) / (1 - 0.35)));
        for (let k = 0; k < 3; k++) {
          pos[i * 3 + k] = from.p[i * 3 + k] + (target.p[i * 3 + k] - from.p[i * 3 + k]) * t;
          col[i * 3 + k] = from.c[i * 3 + k] + (target.c[i * 3 + k] - from.c[i * 3 + k]) * t;
        }
        sizeA[i] = from.s[i] + (target.s[i] - from.s[i]) * t;
      }
    }
    // gentle idle breathing on active nodes
    for (let i = 0; i < nodeCount; i++) alphaA[i] = 1;
    for (let i = nodeCount; i < MAX_NODES; i++) alphaA[i] = Math.max(0, sizeA[i] * 2);
    nodeGeo.attributes.position.needsUpdate = true;
    nodeGeo.attributes.color.needsUpdate = true;
    nodeGeo.attributes.size.needsUpdate = true;
    nodeGeo.attributes.alpha.needsUpdate = true;
  }

  function updateDust(dt) {
    dustGroup.children.forEach((o, ki) => {
      const g = o.userData.geo;
      const p = g.attributes.position.array;
      for (const d of dusts) if (d.ki === ki) p[d.i * 3 + 1] = d.base + Math.sin(time * d.sp + d.ph) * 0.6;
      g.attributes.position.needsUpdate = true;
    });
    dustGroup.rotation.z = Math.sin(time * 0.05) * 0.04;
    dustGroup.position.x = have.x * 0.15 + mouse.x * 0.6;
    dustGroup.position.y = mouse.y * 0.4;
  }

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dtReal = Math.min(0.5, clock.getDelta()); // wall-clock, for time-based tweens (survives throttled tabs)
    const dt = Math.min(0.05, dtReal); // capped, for per-frame physics
    time += dt;
    if (!(renderer.domElement.width > 1)) resize(); // first frames while the pane had no size
    if (![have.x, have.y, have.s, have.o].every(Number.isFinite)) Object.assign(have, want);
    if (![want.x, want.y, want.s, want.o].every(Number.isFinite)) { Object.assign(want, layoutOffsets()); return; }
    // smooth mode transitions
    const k = 1 - Math.pow(0.001, dtReal);
    have.x += (want.x - have.x) * k; have.y += (want.y - have.y) * k; have.s += (want.s - have.s) * k; have.o += (want.o - have.o) * k;
    mouse.x += (mouse.tx - mouse.x) * k; mouse.y += (mouse.ty - mouse.y) * k;
    group.position.set(have.x, have.y, 0);
    group.scale.setScalar(have.s);
    group.rotation.y = (reduced ? 0 : Math.sin(time * 0.17) * 0.28) + mouse.x * 0.35 - 0.12;
    group.rotation.x = (reduced ? 0 : Math.sin(time * 0.13) * 0.06) - mouse.y * 0.22;
    uni.uOpacity.value = have.o;
    uni.uSize.value = have.s;
    updateNodes(dtReal);
    for (const es of edgeSets) updateEdges(es, dtReal);
    updatePulses(dt);
    updateDust(dt);
    renderer.render(scene, camera);
  }

  // --- events
  const onMove = (e) => {
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const y = e.touches ? e.touches[0].clientY : e.clientY;
    mouse.tx = (x / window.innerWidth - 0.5) * 2;
    mouse.ty = (y / window.innerHeight - 0.5) * 2;
  };
  const onVis = () => { if (document.hidden) { running = false; cancelAnimationFrame(raf); } else if (!running) { running = true; clock.getDelta(); frame(); } };
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', onVis);

  resize();
  Object.assign(have, want);
  frame();

  return {
    shapes: SHAPES,
    setShape(id, opts2 = {}) {
      const key = LAYOUTS[id] ? id : 'constellation';
      if (key === shapeId && !opts2.force) return;
      shapeId = key;
      morphDur = opts2.duration || 1.7;
      applyLayout(LAYOUTS[key]());
    },
    setMode(m) {
      if (m === mode) return;
      mode = m;
      Object.assign(want, layoutOffsets());
    },
    burst(n = 24) {
      let done = 0;
      for (const pu of pulses) { if (done++ >= n) break; pu.burst = true; pu.t = 0; pu.e = -1; }
    },
    setPalette(p) {
      palette = normalisePalette(p);
      ringMat.uniforms.uInk.value.copy(palette.ink);
      if (shapeId) applyLayout(LAYOUTS[shapeId]());
    },
    get shape() { return shapeId; },
    debug() {
      return { shapeId, nodeCount, morphT, mode, have: { ...have }, want: { ...want }, edges: edgeSets.map((e) => [e.edges.length, +e.alpha.toFixed(2), e.fading]), uScale: uni.uScale.value, size: [renderer.domElement.width, renderer.domElement.height], pos0: [pos[0], pos[1], pos[2]], size0: sizeA[0], gl: !!renderer.getContext() };
    },
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      renderer.dispose();
    },
  };
}
