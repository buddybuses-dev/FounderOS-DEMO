import { describe, expect, test } from 'vitest';
import {
  clamp,
  clamp01,
  lerp,
  damp,
  progress,
  mapRange,
  stagger,
  easeOutCubic,
  easeInOutCubic,
  easeOutExpo,
  easeOutBack,
  identity4,
  multiply4,
  perspective4,
  lookAt4,
  transformPoint,
  fibonacciSphere,
  latticePoints,
  ringPoints,
  shapePoints,
  SHAPES,
  nearestNeighborEdges,
} from '@/lib/site/motion';

describe('scalar motion helpers', () => {
  test('clamp / clamp01 pin to their range', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
    expect(clamp01(2)).toBe(1);
    expect(clamp01(-2)).toBe(0);
  });

  test('lerp interpolates and extrapolates linearly', () => {
    expect(lerp(0, 10, 0.5)).toBe(5);
    expect(lerp(-4, 4, 0)).toBe(-4);
    expect(lerp(-4, 4, 1)).toBe(4);
  });

  test('damp is frame-rate independent: two half-steps ≈ one whole step', () => {
    const one = damp(0, 1, 6, 1 / 30);
    let two = damp(0, 1, 6, 1 / 60);
    two = damp(two, 1, 6, 1 / 60);
    expect(Math.abs(one - two)).toBeLessThan(1e-9);
  });

  test('damp converges toward the target and never overshoots', () => {
    let v = 0;
    for (let i = 0; i < 240; i++) v = damp(v, 1, 8, 1 / 60);
    expect(v).toBeGreaterThan(0.99);
    expect(v).toBeLessThanOrEqual(1);
  });

  test('progress maps a window to 0..1, clamped outside it', () => {
    expect(progress(100, 100, 300)).toBe(0);
    expect(progress(200, 100, 300)).toBe(0.5);
    expect(progress(400, 100, 300)).toBe(1);
    expect(progress(0, 100, 300)).toBe(0);
    // a zero-width window is a step, not a division by zero
    expect(Number.isFinite(progress(5, 5, 5))).toBe(true);
  });

  test('mapRange rescales between two ranges', () => {
    expect(mapRange(0.5, 0, 1, 10, 20)).toBe(15);
    expect(mapRange(2, 0, 1, 10, 20)).toBe(20); // clamped
  });

  test('stagger gives each item its own slice of a shared progress', () => {
    expect(stagger(0, 4, 0)).toBe(0);
    expect(stagger(3, 4, 1)).toBe(1);
    // the first item leads the last one
    expect(stagger(0, 4, 0.5)).toBeGreaterThan(stagger(3, 4, 0.5));
    // a single item just passes progress through
    expect(stagger(0, 1, 0.42)).toBeCloseTo(0.42, 5);
  });

  test('every easing is normalized: f(0)=0, f(1)=1, and monotone in between', () => {
    for (const ease of [easeOutCubic, easeInOutCubic, easeOutExpo]) {
      expect(ease(0)).toBeCloseTo(0, 6);
      expect(ease(1)).toBeCloseTo(1, 6);
      let prev = -Infinity;
      for (let i = 0; i <= 20; i++) {
        const v = ease(i / 20);
        expect(v).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = v;
      }
    }
  });

  test('easeOutBack overshoots past 1 before settling — that is the point', () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 6);
    expect(easeOutBack(1)).toBeCloseTo(1, 6);
    let peak = 0;
    for (let i = 0; i <= 100; i++) peak = Math.max(peak, easeOutBack(i / 100));
    expect(peak).toBeGreaterThan(1);
  });
});

describe('mat4 — the camera math behind the particle field', () => {
  test('identity is the multiplicative unit', () => {
    const p = perspective4(Math.PI / 4, 1.5, 0.1, 100);
    const out = multiply4(identity4(), p);
    for (let i = 0; i < 16; i++) expect(out[i]).toBeCloseTo(p[i], 6);
  });

  test('perspective4 builds the standard GL projection', () => {
    const m = perspective4(Math.PI / 2, 2, 1, 101);
    const f = 1 / Math.tan(Math.PI / 4); // = 1
    expect(m[0]).toBeCloseTo(f / 2, 6);
    expect(m[5]).toBeCloseTo(f, 6);
    expect(m[11]).toBe(-1);
    expect(m[10]).toBeCloseTo((101 + 1) / (1 - 101), 6);
    expect(m[15]).toBe(0);
  });

  test('lookAt4 puts the eye at the origin looking down -z', () => {
    const view = lookAt4([0, 0, 6], [0, 0, 0], [0, 1, 0]);
    const eye = transformPoint(view, [0, 0, 6]);
    expect(eye[0]).toBeCloseTo(0, 6);
    expect(eye[1]).toBeCloseTo(0, 6);
    expect(eye[2]).toBeCloseTo(0, 6);
    const target = transformPoint(view, [0, 0, 0]);
    expect(target[2]).toBeCloseTo(-6, 6);
  });

  test('a point projects inside the clip cube when it is in front of the camera', () => {
    const view = lookAt4([0, 0, 6], [0, 0, 0], [0, 1, 0]);
    const proj = perspective4(Math.PI / 4, 1, 0.1, 100);
    const [x, y, z, w] = transformPoint(multiply4(proj, view), [0, 0, 0]);
    expect(w).toBeGreaterThan(0);
    expect(Math.abs(x / w)).toBeLessThan(1);
    expect(Math.abs(y / w)).toBeLessThan(1);
    expect(Math.abs(z / w)).toBeLessThan(1);
  });
});

describe('morph targets — every shape is the same buffer shape', () => {
  const N = 256;

  test('fibonacciSphere puts every point on the sphere', () => {
    const pts = fibonacciSphere(N, 2);
    expect(pts).toHaveLength(N * 3);
    for (let i = 0; i < N; i++) {
      const r = Math.hypot(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]);
      expect(r).toBeCloseTo(2, 4);
    }
  });

  test('lattice and ring stay inside their declared bounds', () => {
    const lat = latticePoints(N, 3);
    expect(lat).toHaveLength(N * 3);
    for (const v of lat) expect(Math.abs(v)).toBeLessThanOrEqual(3.001);
    const ring = ringPoints(N, 2, 0.35);
    for (let i = 0; i < N; i++) {
      const r = Math.hypot(ring[i * 3], ring[i * 3 + 2]);
      expect(r).toBeGreaterThan(2 - 0.7);
      expect(r).toBeLessThan(2 + 0.7);
    }
  });

  test('all registered shapes agree on point count and are finite', () => {
    for (const name of SHAPES) {
      const pts = shapePoints(name, N);
      expect(pts, name).toHaveLength(N * 3);
      for (const v of pts) expect(Number.isFinite(v), name).toBe(true);
    }
  });

  test('shapePoints is deterministic — the same seed geometry every call', () => {
    expect(Array.from(shapePoints('lattice', 64))).toEqual(Array.from(shapePoints('lattice', 64)));
  });

  test('nearestNeighborEdges links close points only, with no duplicate pairs', () => {
    const pts = fibonacciSphere(120, 1);
    const edges = nearestNeighborEdges(pts, 2, 0.5);
    expect(edges.length % 2).toBe(0);
    const seen = new Set<string>();
    for (let i = 0; i < edges.length; i += 2) {
      const a = edges[i];
      const b = edges[i + 1];
      expect(a).not.toBe(b);
      const key = `${Math.min(a, b)}:${Math.max(a, b)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
      const d = Math.hypot(pts[a * 3] - pts[b * 3], pts[a * 3 + 1] - pts[b * 3 + 1], pts[a * 3 + 2] - pts[b * 3 + 2]);
      expect(d).toBeLessThanOrEqual(0.5);
    }
    expect(edges.length).toBeGreaterThan(0);
  });
});
