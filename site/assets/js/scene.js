/*
 * scene.js — the 3D "history of learning machines" background.
 *
 * Clean ink diagrams of real architectures. When the shape changes, the current diagram
 * dissolves into dust that drifts away, and the next one condenses out of dust and draws
 * its connections in.
 *
 *   neuron        1943  McCulloch–Pitts threshold unit
 *   perceptron    1958  Rosenblatt's Mark I (retina → randomly wired association units → response units)
 *   mlp           1986  fully-connected network trained with backprop
 *   cnn           1998  LeNet-5 (feature maps, subsampling, dense head)
 *   deep          2012  AlexNet (two GPU streams that only talk at some layers)
 *   transformer   2017  stacked token rows, every token attends to every token
 *   constellation now   a knowledge graph
 *
 * API:  const s = createScene(canvas, { palette, density, asideOpacity, renderScale, preserveDrawingBuffer })
 *       s.setShape('cnn'); s.setMode('hero'|'aside'); s.burst(); s.setPalette(p); s.destroy()
 */
import * as THREE from 'three';

const DENSITY = { low: { pulses: 12, ppn: 6 }, medium: { pulses: 26, ppn: 10 }, high: { pulses: 40, ppn: 14 } };
const MAX_NODES = 128;
const MAX_EDGES = 200;
const CAM_Z = 13;
const FOV = 42;
const DUR = 2.6; // seconds for a full dissolve + assemble

// ------------------------------------------------------------------ helpers
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
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t) => t * t * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (t) => t * t * (3 - 2 * t);

function makeTexture(kind) {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  if (kind === 'dot') {
    const g = ctx.createRadialGradient(64, 64, 40, 64, 64, 48);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(64, 64, 48, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'ring') {
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 9;
    ctx.beginPath(); ctx.arc(64, 64, 40, 0, Math.PI * 2); ctx.stroke();
    // soften the ring edges
    ctx.globalCompositeOperation = 'destination-out';
    const g = ctx.createRadialGradient(64, 64, 46, 64, 64, 50);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  } else if (kind === 'soft') {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 60);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

// ------------------------------------------------------------------ shaders
const VERT = /* glsl */ `
  attribute float size;
  attribute float alpha;
  attribute vec3 color;
  attribute float kind;
  uniform float uScale;
  uniform float uSize;
  uniform float uKind;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vColor = color;
    vAlpha = alpha * (uKind < 0.0 || abs(kind - uKind) < 0.5 ? 1.0 : 0.0);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = max(0.0, size * uSize * uScale / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const FRAG = /* glsl */ `
  uniform sampler2D map;
  uniform float uOpacity;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 t = texture2D(map, gl_PointCoord);
    float a = t.a * vAlpha * uOpacity;
    if (a < 0.008) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

// ------------------------------------------------------------------ layouts
// nodes: { p:[x,y,z], c: 0 solid ink | 1 hollow ink | 2 solid accent | 3 solid soft-ink, s: size }
// edges: [a, b] — directed, signal flows a -> b

function grid(cx, cy, cz, rows, cols, spacing, tilt = 0.72) {
  const pts = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const u = (j - (cols - 1) / 2) * spacing, v = (i - (rows - 1) / 2) * spacing;
    pts.push([cx + u * tilt, cy - v, cz + u * Math.sqrt(1 - tilt * tilt)]);
  }
  return pts;
}
const column = (x, n, spacing, z = 0) => Array.from({ length: n }, (_, i) => [x, (i - (n - 1) / 2) * spacing, z]);

const LAYOUTS = {
  neuron() {
    const nodes = [], edges = [];
    const soma = nodes.push({ p: [0, 0, 0], c: 2, s: 1.15 }) - 1;
    column(-3.4, 6, 0.8).forEach((p) => edges.push([nodes.push({ p, c: 1, s: 0.42 }) - 1, soma]));
    const ax = nodes.push({ p: [1.9, 0, 0], c: 3, s: 0.3 }) - 1;
    const out = nodes.push({ p: [3.5, 0, 0], c: 0, s: 0.5 }) - 1;
    edges.push([soma, ax], [ax, out]);
    return { nodes, edges };
  },

  perceptron() {
    const rnd = mulberry(1958);
    const nodes = [], edges = [];
    const retina = grid(-3.4, 0, 0, 6, 6, 0.6).map((p) => nodes.push({ p, c: 1, s: 0.3 }) - 1);
    const assoc = column(0.2, 8, 0.58).map((p) => nodes.push({ p, c: 0, s: 0.42 }) - 1);
    const resp = column(3.3, 3, 1.3).map((p) => nodes.push({ p, c: 2, s: 0.7 }) - 1);
    for (const a of assoc) {
      const used = new Set();
      while (used.size < 4) used.add(Math.floor(rnd() * retina.length));
      for (const r of used) edges.push([retina[r], a]);
      for (const r of resp) edges.push([a, r]);
    }
    return { nodes, edges };
  },

  mlp() {
    const nodes = [], edges = [];
    const sizes = [5, 7, 7, 3], xs = [-3.4, -1.15, 1.15, 3.4];
    const layers = sizes.map((n, li) => column(xs[li], n, 0.66).map((p) => nodes.push({ p, c: li === 0 ? 1 : li === sizes.length - 1 ? 2 : 0, s: li === sizes.length - 1 ? 0.6 : 0.42 }) - 1));
    for (let l = 0; l < layers.length - 1; l++) for (const a of layers[l]) for (const b of layers[l + 1]) edges.push([a, b]);
    return { nodes, edges };
  },

  cnn() {
    const rnd = mulberry(1998);
    const nodes = [], edges = [];
    const add = (pts, c, s) => pts.map((p) => nodes.push({ p, c, s }) - 1);
    const input = add(grid(-4.2, 0, 0, 6, 6, 0.44), 1, 0.24);
    const c1 = [-0.7, 0.7].map((dz) => add(grid(-2.3, 0, dz, 4, 4, 0.42), 0, 0.26));
    const s2 = [-0.7, 0.7].map((dz) => add(grid(-0.7, 0, dz, 2, 2, 0.5), 0, 0.3));
    const c3 = [-0.9, 0, 0.9].map((dz) => add(grid(0.8, 0, dz, 2, 2, 0.46), 0, 0.3));
    const f = add(column(2.5, 6, 0.55), 3, 0.32);
    const out = add(column(3.9, 3, 0.9), 2, 0.55);
    c1.forEach((m) => m.forEach((n, i) => { const r = Math.floor(i / 4), c = i % 4; edges.push([input[(r + 1) * 6 + c + 1], n]); }));
    c1.forEach((m, k) => s2[k].forEach((n, i) => { const r = Math.floor(i / 2), c = i % 2; edges.push([m[(r * 2) * 4 + c * 2], n], [m[(r * 2 + 1) * 4 + c * 2 + 1], n]); }));
    for (const m of c3) for (const n of m) for (let k = 0; k < 2; k++) { const src = s2[Math.floor(rnd() * 2)]; edges.push([src[Math.floor(rnd() * src.length)], n]); }
    const c3f = c3.flat();
    for (const n of f) for (let k = 0; k < 3; k++) edges.push([c3f[Math.floor(rnd() * c3f.length)], n]);
    for (const a of f) for (const b of out) edges.push([a, b]);
    return { nodes, edges };
  },

  deep() {
    const rnd = mulberry(2012);
    const nodes = [], edges = [];
    const xs = [-3.6, -1.9, -0.2, 1.5, 3.0];
    const halves = xs.map((x, li) => [1.05, -1.05].map((y) => grid(x, y, 0, 3, 3, 0.4).map((p) => nodes.push({ p, c: li === 0 ? 1 : 0, s: 0.28 }) - 1)));
    const out = column(4.3, 3, 0.8).map((p) => nodes.push({ p, c: 2, s: 0.5 }) - 1);
    for (let l = 0; l < halves.length - 1; l++) for (let h = 0; h < 2; h++) {
      halves[l][h].forEach((a, i) => edges.push([a, halves[l + 1][h][i]]));
      if (l === 1 || l === 3) for (let k = 0; k < 3; k++) edges.push([halves[l][h][Math.floor(rnd() * 9)], halves[l + 1][1 - h][Math.floor(rnd() * 9)]]);
    }
    for (const h of halves[halves.length - 1]) for (const a of h) for (const b of out) if (rnd() < 0.6) edges.push([a, b]);
    return { nodes, edges };
  },

  transformer() {
    const nodes = [], edges = [];
    const T = 5, L = 4;
    const rows = [];
    for (let l = 0; l < L; l++) {
      rows.push(Array.from({ length: T }, (_, t) => nodes.push({ p: [(t - (T - 1) / 2) * 1.5, (l - (L - 1) / 2) * 1.3, 0], c: l === 0 ? 1 : l === L - 1 ? 2 : 0, s: l === L - 1 ? 0.55 : 0.42 }) - 1));
    }
    for (let l = 0; l < L - 1; l++) for (const a of rows[l]) for (const b of rows[l + 1]) edges.push([a, b]);
    return { nodes, edges };
  },

  constellation() {
    const rnd = mulberry(42);
    const nodes = [], edges = [];
    const N = 60, golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = golden * i, R = 2.8 + (rnd() - 0.5) * 0.8;
      nodes.push({ p: [Math.cos(th) * r * R * 1.3, y * R * 0.8, Math.sin(th) * r * R], c: rnd() < 0.12 ? 2 : rnd() < 0.5 ? 0 : 1, s: 0.24 + rnd() * 0.3 });
    }
    const seen = new Set();
    nodes.forEach((n, i) => {
      const d = nodes.map((m, j) => [j, Math.hypot(m.p[0] - n.p[0], m.p[1] - n.p[1], m.p[2] - n.p[2])]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]);
      for (let k = 0; k < 2; k++) { const j = d[k][0], key = i < j ? `${i}-${j}` : `${j}-${i}`; if (!seen.has(key)) { seen.add(key); edges.push([i, j]); } }
    });
    return { nodes, edges };
  },
};

export const SHAPES = Object.keys(LAYOUTS);

// ------------------------------------------------------------------ the scene
export function createScene(canvas, opts = {}) {
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const density = DENSITY[opts.density] || DENSITY.medium;
  const PPN = density.ppn;
  const MAX_P = MAX_NODES * PPN;
  let palette = normalisePalette(opts.palette);
  const asideOpacity = opts.asideOpacity ?? 0.45;

  const renderScale = opts.renderScale || 1;
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserveDrawingBuffer });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  camera.position.set(0, 0, CAM_Z);
  const group = new THREE.Group();
  scene.add(group);

  const tex = { dot: makeTexture('dot'), ring: makeTexture('ring'), soft: makeTexture('soft') };
  const uni = { uScale: { value: 300 }, uOpacity: { value: 1 }, uSize: { value: 1 } };
  const pointsMat = (map, kind) => new THREE.ShaderMaterial({
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, depthTest: false,
    uniforms: { map: { value: map }, uScale: uni.uScale, uOpacity: uni.uOpacity, uSize: uni.uSize, uKind: { value: kind } },
  });
  const attrs = (geo, n) => {
    const a = { pos: new Float32Array(n * 3), col: new Float32Array(n * 3), size: new Float32Array(n), alpha: new Float32Array(n), kind: new Float32Array(n) };
    geo.setAttribute('position', new THREE.BufferAttribute(a.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(a.col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(a.size, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(a.alpha, 1));
    geo.setAttribute('kind', new THREE.BufferAttribute(a.kind, 1));
    return a;
  };
  const touch = (geo) => { for (const k of ['position', 'color', 'size', 'alpha', 'kind']) geo.attributes[k].needsUpdate = true; };

  // --- nodes (two draws over one geometry: solid dots and hollow rings)
  const nodeGeo = new THREE.BufferGeometry();
  const N = attrs(nodeGeo, MAX_NODES);
  const solid = new THREE.Points(nodeGeo, pointsMat(tex.dot, 0));
  const hollow = new THREE.Points(nodeGeo, pointsMat(tex.ring, 1));
  solid.renderOrder = 3; hollow.renderOrder = 3;
  group.add(solid, hollow);

  // --- dust particles
  const dustGeo = new THREE.BufferGeometry();
  const D = attrs(dustGeo, MAX_P);
  const dust = new THREE.Points(dustGeo, pointsMat(tex.soft, -1));
  dust.renderOrder = 4;
  group.add(dust);
  const P = { off: new Float32Array(MAX_P * 3), dir: new Float32Array(MAX_P * 3), dist: new Float32Array(MAX_P), size: new Float32Array(MAX_P), tw: new Float32Array(MAX_P) };
  {
    const rnd = mulberry(77);
    for (let i = 0; i < MAX_P; i++) {
      const th = rnd() * Math.PI * 2, ph = Math.acos(2 * rnd() - 1);
      P.off[i * 3] = (rnd() - 0.5) * 0.16; P.off[i * 3 + 1] = (rnd() - 0.5) * 0.16; P.off[i * 3 + 2] = (rnd() - 0.5) * 0.16;
      P.dir[i * 3] = Math.sin(ph) * Math.cos(th) + 0.9; // wind blows to the right and slightly up
      P.dir[i * 3 + 1] = Math.sin(ph) * Math.sin(th) + 0.45;
      P.dir[i * 3 + 2] = Math.cos(ph) * 0.6;
      P.dist[i] = 1.2 + rnd() * 2.6;
      P.size[i] = 0.05 + rnd() * 0.07;
      P.tw[i] = rnd() * 6.28;
      D.kind[i] = 0;
    }
  }

  // --- pulses (signals travelling along edges, idle only)
  const pulseGeo = new THREE.BufferGeometry();
  const pulseCount = reduced ? 0 : density.pulses;
  const PU = attrs(pulseGeo, Math.max(1, pulseCount));
  const pulseObj = new THREE.Points(pulseGeo, pointsMat(tex.soft, -1));
  pulseObj.renderOrder = 5;
  group.add(pulseObj);
  const rndP = mulberry(7);
  const pulses = Array.from({ length: pulseCount }, () => ({ e: -1, t: rndP(), v: 0.25 + rndP() * 0.3, s: 0.16 + rndP() * 0.1, burst: false }));

  // --- edges: two straight-line sets (old fading out, new drawing in)
  function makeEdgeSet() {
    const p = new Float32Array(MAX_EDGES * 6), c = new Float32Array(MAX_EDGES * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3));
    geo.setDrawRange(0, 0);
    const obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, depthTest: false }));
    obj.renderOrder = 1;
    group.add(obj);
    return { geo, p, c, obj, edges: [], delay: new Float32Array(MAX_EDGES), progress: 1, fading: false };
  }
  const edgeSets = [makeEdgeSet(), makeEdgeSet()];
  let cur = 0;

  // --- state
  const home = { from: new Float32Array(MAX_NODES * 3), to: new Float32Array(MAX_NODES * 3) };
  const colFrom = new Float32Array(MAX_NODES * 3), colTo = new Float32Array(MAX_NODES * 3);
  const sizeFrom = new Float32Array(MAX_NODES), sizeTo = new Float32Array(MAX_NODES), kindTo = new Float32Array(MAX_NODES);
  const delay = new Float32Array(MAX_NODES);
  { const r = mulberry(5); for (let i = 0; i < MAX_NODES; i++) delay[i] = r(); }
  let nFrom = 0, nTo = 0, shapeId = null, T = 1, adjacency = [];
  let mode = 'hero', time = 0, running = true, raf = 0;
  const want = { x: 0, y: 0, s: 1, o: 1 }, have = { x: 0, y: 0, s: 1, o: 1 }, mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const clock = new THREE.Clock();

  function normalisePalette(p = {}) {
    const c = (v, d) => new THREE.Color(v || d);
    const ink = c(p.ink, '#2a2622'), paper = c(p.paper, '#f7efe1'), accent = c(p.accent, '#e2674a');
    return { ink, paper, accent, soft: ink.clone().lerp(paper, 0.45), edge: ink.clone().lerp(paper, 0.38), nodeColors: [ink, ink, accent, ink.clone().lerp(paper, 0.4)] };
  }

  function layoutOffsets() {
    const aspect = Number.isFinite(camera.aspect) && camera.aspect > 0 ? camera.aspect : 1.6;
    const w = 2 * CAM_Z * Math.tan((FOV * Math.PI) / 360) * aspect;
    if (mode === 'hero') {
      if (aspect < 0.95) return { x: w * 0.08, y: 1.1, s: 0.48, o: 0.38 };
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
    if (w < 2 || h < 2) return;
    renderer.setSize(Math.round(w * renderScale), Math.round(h * renderScale), false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uni.uScale.value = (h * renderScale * renderer.getPixelRatio()) / (2 * Math.tan((FOV * Math.PI) / 360));
    Object.assign(want, layoutOffsets());
  }

  function applyLayout(layout) {
    const n = Math.min(layout.nodes.length, MAX_NODES);
    home.from.set(home.to); colFrom.set(colTo); sizeFrom.set(sizeTo);
    nFrom = T >= 1 ? nTo : Math.min(nFrom, nTo); // if interrupted mid-transition, dissolve whatever is showing
    for (let i = 0; i < n; i++) {
      const nd = layout.nodes[i];
      home.to[i * 3] = nd.p[0]; home.to[i * 3 + 1] = nd.p[1]; home.to[i * 3 + 2] = nd.p[2];
      palette.nodeColors[nd.c].toArray(colTo, i * 3);
      sizeTo[i] = nd.s;
      kindTo[i] = nd.c === 1 ? 1 : 0;
    }
    nTo = n;
    edgeSets[cur].fading = true;
    cur = 1 - cur;
    const es = edgeSets[cur];
    es.edges = layout.edges.slice(0, MAX_EDGES);
    es.fading = false;
    es.progress = 0;
    const r = mulberry(11 + n);
    for (let e = 0; e < es.edges.length; e++) es.delay[e] = r() * 0.6;
    adjacency = Array.from({ length: n }, () => []);
    es.edges.forEach(([a, b], ei) => { if (a < n) adjacency[a].push(ei); });
    for (const pu of pulses) { pu.e = -1; pu.t = rndP(); }
    T = reduced ? 1 : 0;
    if (reduced) { for (let i = 0; i < MAX_NODES; i++) { N.alpha[i] = i < n ? 1 : 0; } }
  }

  // one transition: T 0 -> 1.  dissolve window per node [d0, d0+0.32], assemble window [a0, a0+0.34]
  function updateNodesAndDust() {
    let di = 0;
    for (let i = 0; i < MAX_NODES; i++) {
      const d0 = delay[i] * 0.22, a0 = 0.48 + delay[i] * 0.18;
      const d = i < nFrom ? clamp01((T - d0) / 0.32) : 1;
      const a = i < nTo ? clamp01((T - a0) / 0.34) : 0;
      const assembling = T >= a0 || i >= nFrom;
      const base = assembling ? home.to : home.from;
      N.pos[i * 3] = base[i * 3]; N.pos[i * 3 + 1] = base[i * 3 + 1]; N.pos[i * 3 + 2] = base[i * 3 + 2];
      let alpha, col, size, kind;
      if (assembling) { alpha = i < nTo ? smooth(clamp01((a - 0.72) / 0.28)) : 0; col = colTo; size = sizeTo[i]; kind = kindTo[i]; }
      else { alpha = i < nFrom ? 1 - smooth(clamp01(d * 2.2)) : 0; col = colFrom; size = sizeFrom[i]; kind = kindTo[i]; }
      N.alpha[i] = alpha; N.size[i] = size; N.kind[i] = kind;
      N.col[i * 3] = col[i * 3]; N.col[i * 3 + 1] = col[i * 3 + 1]; N.col[i * 3 + 2] = col[i * 3 + 2];

      // dust for this node
      const dissolving = i < nFrom && d > 0 && d < 1;
      const condensing = i < nTo && a > 0 && a < 1;
      for (let k = 0; k < PPN; k++, di++) {
        if (!dissolving && !condensing) { D.alpha[di] = 0; continue; }
        const j = di * 3;
        let hx, hy, hz, u, spread, alpha2;
        if (dissolving) {
          hx = home.from[i * 3]; hy = home.from[i * 3 + 1]; hz = home.from[i * 3 + 2];
          u = d; spread = easeOutCubic(u); alpha2 = Math.min(1, u * 5) * Math.pow(1 - u, 0.8);
        } else {
          hx = home.to[i * 3]; hy = home.to[i * 3 + 1]; hz = home.to[i * 3 + 2];
          u = a; spread = 1 - easeInOut(u); alpha2 = Math.min(1, u * 4) * Math.pow(1 - u, 0.6);
        }
        const dist = P.dist[di] * spread;
        const wob = Math.sin(time * 2.1 + P.tw[di]) * 0.12 * spread;
        D.pos[j] = hx + P.off[j] + P.dir[j] * dist + wob;
        D.pos[j + 1] = hy + P.off[j + 1] + P.dir[j + 1] * dist + Math.cos(time * 1.7 + P.tw[di]) * 0.1 * spread;
        D.pos[j + 2] = hz + P.off[j + 2] + P.dir[j + 2] * dist;
        D.size[di] = P.size[di] * (1.6 - spread * 0.9) * Math.max(0.6, size);
        D.alpha[di] = alpha2 * 0.85;
        const c = dissolving ? colFrom : colTo;
        D.col[j] = c[i * 3]; D.col[j + 1] = c[i * 3 + 1]; D.col[j + 2] = c[i * 3 + 2];
      }
    }
    touch(nodeGeo); touch(dustGeo);
  }

  function updateEdges(es, dt) {
    if (es.fading) es.progress = Math.max(0, es.progress - dt * 3.2);
    else if (T > 0.86) es.progress = Math.min(1, es.progress + dt / 0.9);
    const n = es.edges.length;
    if (es.progress <= 0.001 || n === 0) { es.geo.setDrawRange(0, 0); return; }
    const pc = palette.paper, ec = palette.edge;
    let vi = 0;
    for (let e = 0; e < n; e++) {
      const [ia, ib] = es.edges[e];
      const local = es.fading ? es.progress : easeOutCubic(clamp01((es.progress - es.delay[e] * 0.5) / 0.5));
      if (local <= 0) continue;
      const ax = N.pos[ia * 3], ay = N.pos[ia * 3 + 1], az = N.pos[ia * 3 + 2];
      const bx = N.pos[ib * 3], by = N.pos[ib * 3 + 1], bz = N.pos[ib * 3 + 2];
      const len = Math.hypot(bx - ax, by - ay, bz - az) || 1;
      const ra = N.size[ia] * 0.4, rb = N.size[ib] * 0.4;
      const ux = (bx - ax) / len, uy = (by - ay) / len, uz = (bz - az) / len;
      const sx = ax + ux * ra, sy = ay + uy * ra, sz = az + uz * ra;
      const reach = es.fading ? 1 : local; // draw the line from a towards b
      const ex = sx + (bx - ux * rb - sx) * reach, ey = sy + (by - uy * rb - sy) * reach, ez = sz + (bz - uz * rb - sz) * reach;
      const a = (es.fading ? es.progress : 1) * have.o * 0.9;
      const r = pc.r + (ec.r - pc.r) * a, g = pc.g + (ec.g - pc.g) * a, b = pc.b + (ec.b - pc.b) * a;
      es.p[vi * 3] = sx; es.p[vi * 3 + 1] = sy; es.p[vi * 3 + 2] = sz; es.p[vi * 3 + 3] = ex; es.p[vi * 3 + 4] = ey; es.p[vi * 3 + 5] = ez;
      for (let m = 0; m < 6; m += 3) { es.c[vi * 3 + m] = r; es.c[vi * 3 + m + 1] = g; es.c[vi * 3 + m + 2] = b; }
      vi += 2;
    }
    es.geo.setDrawRange(0, vi);
    es.geo.attributes.position.needsUpdate = true;
    es.geo.attributes.color.needsUpdate = true;
  }

  function updatePulses(dt) {
    if (!pulseCount) return;
    const es = edgeSets[cur], n = es.edges.length, live = T >= 1 && es.progress >= 1;
    for (let i = 0; i < pulses.length; i++) {
      const pu = pulses[i];
      if (!live || n === 0) { PU.alpha[i] = 0; continue; }
      if (pu.e < 0 || pu.e >= n) { pu.e = Math.floor(rndP() * n); pu.t = rndP() * 0.3; }
      pu.t += dt * pu.v * (pu.burst ? 2.2 : 1);
      if (pu.t >= 1) {
        const next = adjacency[es.edges[pu.e][1]];
        if (next && next.length && rndP() < 0.9) pu.e = next[Math.floor(rndP() * next.length)];
        else { pu.e = Math.floor(rndP() * n); pu.burst = false; }
        pu.t = 0;
      }
      const [ia, ib] = es.edges[pu.e], t = pu.t;
      PU.pos[i * 3] = N.pos[ia * 3] + (N.pos[ib * 3] - N.pos[ia * 3]) * t;
      PU.pos[i * 3 + 1] = N.pos[ia * 3 + 1] + (N.pos[ib * 3 + 1] - N.pos[ia * 3 + 1]) * t;
      PU.pos[i * 3 + 2] = N.pos[ia * 3 + 2] + (N.pos[ib * 3 + 2] - N.pos[ia * 3 + 2]) * t;
      palette.accent.toArray(PU.col, i * 3);
      PU.size[i] = pu.s * (pu.burst ? 1.5 : 1);
      PU.alpha[i] = Math.sin(t * Math.PI) * 0.8;
    }
    touch(pulseGeo);
  }

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dtReal = Math.min(0.5, clock.getDelta());
    const dt = Math.min(0.05, dtReal);
    time += dt;
    if (!(renderer.domElement.width > 1)) resize();
    if (![have.x, have.y, have.s, have.o].every(Number.isFinite)) Object.assign(have, want);
    if (![want.x, want.y, want.s, want.o].every(Number.isFinite)) { Object.assign(want, layoutOffsets()); return; }
    const k = 1 - Math.pow(0.001, dtReal);
    have.x += (want.x - have.x) * k; have.y += (want.y - have.y) * k; have.s += (want.s - have.s) * k; have.o += (want.o - have.o) * k;
    mouse.x += (mouse.tx - mouse.x) * k; mouse.y += (mouse.ty - mouse.y) * k;
    group.position.set(have.x, have.y, 0);
    group.scale.setScalar(have.s);
    group.rotation.y = (reduced ? 0 : Math.sin(time * 0.12) * 0.16) + mouse.x * 0.22 - 0.1;
    group.rotation.x = (reduced ? 0 : Math.sin(time * 0.09) * 0.04) - mouse.y * 0.14;
    uni.uOpacity.value = have.o;
    uni.uSize.value = have.s;
    if (T < 1) T = Math.min(1, T + dtReal / DUR);
    updateNodesAndDust();
    for (const es of edgeSets) updateEdges(es, dtReal);
    updatePulses(dt);
    renderer.render(scene, camera);
  }

  const onMove = (e) => {
    const x = e.touches ? e.touches[0].clientX : e.clientX, y = e.touches ? e.touches[0].clientY : e.clientY;
    mouse.tx = (x / window.innerWidth - 0.5) * 2; mouse.ty = (y / window.innerHeight - 0.5) * 2;
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
    setShape(id, o = {}) {
      const key = LAYOUTS[id] ? id : 'constellation';
      if (key === shapeId && !o.force) return;
      shapeId = key;
      applyLayout(LAYOUTS[key]());
      if (o.instant) { T = 1; }
    },
    setMode(m) { if (m !== mode) { mode = m; Object.assign(want, layoutOffsets()); } },
    burst(n = 12) { let done = 0; for (const pu of pulses) { if (done++ >= n) break; pu.burst = true; pu.t = 0; pu.e = -1; } },
    setPalette(p) { palette = normalisePalette(p); if (shapeId) { applyLayout(LAYOUTS[shapeId]()); T = 1; } },
    get shape() { return shapeId; },
    debug() { return { shapeId, nFrom, nTo, T: +T.toFixed(3), mode, have: { ...have }, edges: edgeSets.map((e) => [e.edges.length, +e.progress.toFixed(2), e.fading]), size: [renderer.domElement.width, renderer.domElement.height] }; },
    destroy() {
      running = false; cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', onVis);
      renderer.dispose();
    },
  };
}
