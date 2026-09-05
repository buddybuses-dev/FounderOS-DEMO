/**
 * The WebGL plumbing shared by the site's two scenes: context sizing under a
 * pixel budget, adaptive resolution, shader compilation that reports the
 * driver's log instead of a silent black canvas, and pointer→NDC mapping.
 *
 * The GL surface is typed structurally (GLLike) rather than as
 * WebGLRenderingContext, so this module stays importable — and testable —
 * outside a browser.
 */

export type GLLike = {
  VERTEX_SHADER: number;
  FRAGMENT_SHADER: number;
  COMPILE_STATUS: number;
  LINK_STATUS: number;
  createShader(type: number): WebGLShader | null;
  shaderSource(shader: WebGLShader, source: string): void;
  compileShader(shader: WebGLShader): void;
  getShaderParameter(shader: WebGLShader, pname: number): unknown;
  getShaderInfoLog(shader: WebGLShader): string | null;
  deleteShader(shader: WebGLShader | null): void;
  createProgram(): WebGLProgram | null;
  attachShader(program: WebGLProgram, shader: WebGLShader): void;
  linkProgram(program: WebGLProgram): void;
  getProgramParameter(program: WebGLProgram, pname: number): unknown;
  getProgramInfoLog(program: WebGLProgram): string | null;
  deleteProgram(program: WebGLProgram | null): void;
  getUniformLocation(program: WebGLProgram, name: string): WebGLUniformLocation | null;
};

/** Retina is worth paying for; 3x phone panels are not. */
export const MAX_DPR = 2;

/** Roughly 2.2 megapixels of fragments — one 1440p-ish frame's worth. */
export const PIXEL_BUDGET = 2_200_000;

export function resolveDpr(devicePixelRatio: number | undefined): number {
  if (!devicePixelRatio || !Number.isFinite(devicePixelRatio) || devicePixelRatio <= 0) return 1;
  return Math.min(devicePixelRatio, MAX_DPR);
}

/**
 * The scale (≤ 1) to apply to `cssW × cssH × dpr` so the fragment count stays
 * inside the budget. A raymarcher is fill-rate bound; this is the single knob
 * that keeps a 5K display from dropping the page to 8fps.
 */
export function renderScale(cssW: number, cssH: number, dpr: number, budget = PIXEL_BUDGET): number {
  const pixels = Math.max(1, cssW * dpr * cssH * dpr);
  if (pixels <= budget) return 1;
  return Math.sqrt(budget / pixels);
}

export function drawingSize(cssW: number, cssH: number, scale: number): { width: number; height: number } {
  return {
    width: Math.max(1, Math.round(cssW * scale)),
    height: Math.max(1, Math.round(cssH * scale)),
  };
}

/**
 * Adaptive resolution: shed pixels when frames run long, earn them back when
 * they run short, and never move more than 15% in one step so the change reads
 * as a settle rather than a flicker.
 */
export function nextScale(scale: number, frameMs: number, targetMs: number, min = 0.4, max = 1): number {
  const slow = targetMs * 1.25;
  const fast = targetMs * 0.7;
  if (frameMs > slow) return Math.max(min, Math.max(scale * 0.85, scale - 0.15));
  if (frameMs < fast) return Math.min(max, scale + 0.04);
  return scale;
}

export type Rectish = { left: number; top: number; width: number; height: number };

/** Client coords → -1..1, y up (GL convention). Degenerate rects yield 0. */
export function pointerToNdc(clientX: number, clientY: number, rect: Rectish): { x: number; y: number } {
  const w = rect.width || 1;
  const h = rect.height || 1;
  // `0 - v` rather than `-v`: it keeps a centered pointer at +0, so callers
  // comparing against 0 (and tests) never trip over negative zero.
  return {
    x: ((clientX - rect.left) / w) * 2 - 1,
    y: 0 - (((clientY - rect.top) / h) * 2 - 1),
  };
}

export function compileShader(gl: GLLike, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('gl: could not allocate a shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'unknown compile error';
    gl.deleteShader(shader);
    throw new Error(`gl: shader failed to compile — ${log}`);
  }
  return shader;
}

export function createProgram(gl: GLLike, vertexSource: string, fragmentSource: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!program) throw new Error('gl: could not allocate a program');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  // The shader objects are owned by the program once linked.
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? 'unknown link error';
    gl.deleteProgram(program);
    throw new Error(`gl: program failed to link — ${log}`);
  }
  return program;
}

/**
 * Resolve a list of uniform names once at init. A driver that optimizes a
 * uniform away yields null, which the setters below treat as a no-op — a
 * missing uniform must never throw inside the render loop.
 */
export function uniformMap<T extends readonly string[]>(
  gl: GLLike,
  program: WebGLProgram,
  names: T,
): Record<T[number], WebGLUniformLocation | null> {
  const out = {} as Record<T[number], WebGLUniformLocation | null>;
  for (const name of names) out[name as T[number]] = gl.getUniformLocation(program, name);
  return out;
}
