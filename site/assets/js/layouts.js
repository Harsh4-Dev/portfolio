/*
 * layouts.js — node/edge layouts of real architectures from ML history.
 * Shared by the 3D scene (scene.js) and the ASCII diagram renderer (ascii-diagram.js).
 * nodes: { p:[x,y,z], c: 0 solid ink | 1 hollow ink | 2 solid accent | 3 solid soft-ink, s: size }
 * edges: [a, b] — directed, signal flows a -> b
 */
export function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function grid(cx, cy, cz, rows, cols, spacing, tilt = 0.72) {
  const pts = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
    const u = (j - (cols - 1) / 2) * spacing, v = (i - (rows - 1) / 2) * spacing;
    pts.push([cx + u * tilt, cy - v, cz + u * Math.sqrt(1 - tilt * tilt)]);
  }
  return pts;
}
const column = (x, n, spacing, z = 0) => Array.from({ length: n }, (_, i) => [x, (i - (n - 1) / 2) * spacing, z]);

export const LAYOUTS = {
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
