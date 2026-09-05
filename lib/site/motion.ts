/**
 * Motion math for the public site — the part of a cinematic page that must be
 * provably right: frame-rate-independent damping, normalized easings, a small
 * mat4 camera stack for the WebGL particle field, and the morph-target
 * geometry the field interpolates between.
 *
 * Everything here is pure and deterministic. Nothing touches the DOM, so the
 * whole motion system is unit-testable without a browser.
 */

export const clamp = (v: number, min: number, max: number): number => (v < min ? min : v > max ? max : v);
export const clamp01 = (v: number): number => clamp(v, 0, 1);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Exponential smoothing toward `target`, independent of frame duration:
 * two 60fps steps land exactly where one 30fps step does. `lambda` is the
 * approach rate (higher = snappier); `dt` is seconds since the last frame.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Where `value` sits inside the window [start, end], clamped to 0..1. */
export function progress(value: number, start: number, end: number): number {
  const span = end - start;
  if (span === 0) return value < start ? 0 : 1;
  return clamp01((value - start) / span);
}

/** Rescale a clamped value from one range onto another. */
export function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return lerp(outMin, outMax, progress(value, inMin, inMax));
}

/**
 * Item `i` of `count`'s own 0..1 progress inside a shared timeline, so a list
 * cascades instead of arriving all at once. `overlap` is how much of the
 * timeline each item occupies (1 = fully overlapping, 0 = strictly sequential).
 */
export function stagger(i: number, count: number, p: number, overlap = 0.55): number {
  if (count <= 1) return clamp01(p);
  const window = overlap + (1 - overlap) / count;
  const start = (1 - window) * (i / (count - 1));
  return progress(p, start, start + window);
}

// ---------------------------------------------------------------- easings
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
export const easeInOutQuint = (t: number): number =>
  t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
/** Overshoots past the target and settles back — used for arrivals, sparingly. */
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

// ------------------------------------------------------------------ mat4
/** Column-major 4x4, the layout WebGL's uniformMatrix4fv expects. */
export type Mat4 = Float32Array;
export type Vec3 = [number, number, number];

export function identity4(): Mat4 {
  const m = new Float32Array(16);
  m[0] = m[5] = m[10] = m[15] = 1;
  return m;
}

export function multiply4(a: Mat4, b: Mat4): Mat4 {
  const out = new Float32Array(16);
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 4; r++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = sum;
    }
  }
  return out;
}

export function perspective4(fovY: number, aspect: number, near: number, far: number): Mat4 {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  const m = new Float32Array(16);
  m[0] = f / aspect;
  m[5] = f;
  m[10] = (far + near) * nf;
  m[11] = -1;
  m[14] = 2 * far * near * nf;
  return m;
}

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export function lookAt4(eye: Vec3, target: Vec3, up: Vec3): Mat4 {
  const z = norm(sub(eye, target));
  const x = norm(cross(up, z));
  const y = cross(z, x);
  const m = new Float32Array(16);
  m[0] = x[0]; m[4] = x[1]; m[8] = x[2]; m[12] = -dot(x, eye);
  m[1] = y[0]; m[5] = y[1]; m[9] = y[2]; m[13] = -dot(y, eye);
  m[2] = z[0]; m[6] = z[1]; m[10] = z[2]; m[14] = -dot(z, eye);
  m[15] = 1;
  return m;
}

/** Apply a mat4 to a point, returning homogeneous [x, y, z, w]. */
export function transformPoint(m: Mat4, p: Vec3): [number, number, number, number] {
  const [x, y, z] = p;
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
    m[3] * x + m[7] * y + m[11] * z + m[15],
  ];
}

// ---------------------------------------------------------- morph targets
export const SHAPES = ['sphere', 'lattice', 'ring'] as const;
export type ShapeName = (typeof SHAPES)[number];

/** Deterministic hash noise — no Math.random, so SSR and client agree. */
export function hashNoise(i: number, salt = 0): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Points spread evenly over a sphere by the golden-angle spiral — the even
 * distribution is what stops a particle sphere from looking like a globe with
 * bald poles.
 */
export function fibonacciSphere(count: number, radius = 1): Float32Array {
  const out = new Float32Array(count * 3);
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    out[i * 3] = Math.cos(theta) * r * radius;
    out[i * 3 + 1] = y * radius;
    out[i * 3 + 2] = Math.sin(theta) * r * radius;
  }
  return out;
}

/** A cubic lattice — the "structured" pole of the morph: order out of swarm. */
export function latticePoints(count: number, size = 1): Float32Array {
  const out = new Float32Array(count * 3);
  const side = Math.max(2, Math.ceil(Math.cbrt(count)));
  const step = (size * 2) / (side - 1);
  for (let i = 0; i < count; i++) {
    const x = i % side;
    const y = Math.floor(i / side) % side;
    const z = Math.floor(i / (side * side)) % side;
    out[i * 3] = -size + x * step;
    out[i * 3 + 1] = -size + y * step;
    out[i * 3 + 2] = -size + z * step;
  }
  return out;
}

/** A flat-ish annulus — the "orbit" pole: the agents circling the conductor. */
export function ringPoints(count: number, radius = 1, thickness = 0.25): Float32Array {
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 * 3 + hashNoise(i, 3) * 0.4;
    const r = radius + (hashNoise(i, 1) - 0.5) * thickness * 2;
    out[i * 3] = Math.cos(a) * r;
    out[i * 3 + 1] = (hashNoise(i, 2) - 0.5) * thickness * 1.4;
    out[i * 3 + 2] = Math.sin(a) * r;
  }
  return out;
}

const SHAPE_BUILDERS: Record<ShapeName, (count: number) => Float32Array> = {
  sphere: (n) => fibonacciSphere(n, 1.5),
  lattice: (n) => latticePoints(n, 1.35),
  ring: (n) => ringPoints(n, 2.05, 0.34),
};

export function shapePoints(name: ShapeName, count: number): Float32Array {
  return SHAPE_BUILDERS[name](count);
}

/**
 * Edge list (pairs of point indices) linking each point to its nearest
 * neighbors within `maxDist`. Computed once at init over a few hundred points,
 * so a naive O(n²) scan is both fast enough and easy to verify.
 */
export function nearestNeighborEdges(points: Float32Array, k: number, maxDist: number): Uint16Array {
  const n = points.length / 3;
  const seen = new Set<number>();
  const edges: number[] = [];
  const max2 = maxDist * maxDist;
  const candidates: { j: number; d2: number }[] = [];
  for (let i = 0; i < n; i++) {
    candidates.length = 0;
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const dx = points[i * 3] - points[j * 3];
      const dy = points[i * 3 + 1] - points[j * 3 + 1];
      const dz = points[i * 3 + 2] - points[j * 3 + 2];
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 <= max2) candidates.push({ j, d2 });
    }
    candidates.sort((a, b) => a.d2 - b.d2);
    for (const c of candidates.slice(0, k)) {
      const key = i < c.j ? i * n + c.j : c.j * n + i;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(i, c.j);
    }
  }
  return Uint16Array.from(edges);
}
