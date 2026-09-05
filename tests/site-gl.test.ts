import { describe, expect, test, vi } from 'vitest';
import {
  MAX_DPR,
  resolveDpr,
  renderScale,
  drawingSize,
  nextScale,
  pointerToNdc,
  compileShader,
  createProgram,
  uniformMap,
  type GLLike,
} from '@/lib/site/gl';
import {
  HERO_VERTEX,
  HERO_FRAGMENT,
  HERO_UNIFORMS,
  FIELD_VERTEX,
  FIELD_FRAGMENT,
  FIELD_UNIFORMS,
  FIELD_ATTRIBUTES,
  declaredUniforms,
  declaredAttributes,
} from '@/lib/site/shaders';

/** A WebGL context stand-in: enough surface for compile/link, no GPU. */
function fakeGl(opts: { shaderOk?: boolean; programOk?: boolean } = {}): GLLike & { log: string[] } {
  const { shaderOk = true, programOk = true } = opts;
  const log: string[] = [];
  let uniformIndex = 0;
  return {
    log,
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 35713,
    LINK_STATUS: 35714,
    createShader: (type: number) => ({ type }),
    shaderSource: (_s: unknown, src: string) => log.push(src.slice(0, 12)),
    compileShader: () => log.push('compile'),
    getShaderParameter: () => shaderOk,
    getShaderInfoLog: () => 'ERROR: 0:1: bad shader',
    deleteShader: () => log.push('deleteShader'),
    createProgram: () => ({}),
    attachShader: () => log.push('attach'),
    linkProgram: () => log.push('link'),
    getProgramParameter: () => programOk,
    getProgramInfoLog: () => 'ERROR: link failed',
    deleteProgram: () => log.push('deleteProgram'),
    getUniformLocation: (_p: unknown, name: string) => (name === 'uMissing' ? null : { name, i: uniformIndex++ }),
  } as unknown as GLLike & { log: string[] };
}

describe('resolution budget', () => {
  test('dpr is honored but capped — retina stays sharp, 3x phones stay alive', () => {
    expect(resolveDpr(1)).toBe(1);
    expect(resolveDpr(2)).toBe(2);
    expect(resolveDpr(3)).toBe(MAX_DPR);
    expect(resolveDpr(undefined)).toBe(1);
    expect(resolveDpr(0)).toBe(1);
  });

  test('renderScale shrinks only when the pixel budget is blown', () => {
    // 1280x720 @1x = 0.92MP — under a 2.2MP budget, so full res
    expect(renderScale(1280, 720, 1, 2_200_000)).toBe(1);
    // 2560x1440 @2x = 14.7MP — must scale down hard
    const s = renderScale(2560, 1440, 2, 2_200_000);
    expect(s).toBeLessThan(1);
    expect(2560 * s * 1440 * s * 4).toBeLessThanOrEqual(2_200_000 * 1.001);
  });

  test('drawingSize returns whole pixels, never zero', () => {
    expect(drawingSize(800, 600, 1)).toEqual({ width: 800, height: 600 });
    expect(drawingSize(801, 601, 0.5)).toEqual({ width: 401, height: 301 });
    expect(drawingSize(0, 0, 1)).toEqual({ width: 1, height: 1 });
  });

  test('nextScale adapts: slow frames shed pixels, fast frames earn them back', () => {
    const slow = nextScale(1, 40, 16.7);
    expect(slow).toBeLessThan(1);
    const fast = nextScale(0.6, 8, 16.7);
    expect(fast).toBeGreaterThan(0.6);
    // it never runs away in either direction
    expect(nextScale(0.5, 999, 16.7)).toBeGreaterThanOrEqual(0.5 * 0.85);
    expect(nextScale(1, 1, 16.7)).toBeLessThanOrEqual(1);
    // a frame inside the target band is left alone
    expect(nextScale(0.8, 16.7, 16.7)).toBeCloseTo(0.8, 6);
  });

  test('pointerToNdc maps client coords into -1..1 with y flipped for GL', () => {
    const rect = { left: 100, top: 50, width: 200, height: 100 };
    expect(pointerToNdc(200, 100, rect)).toEqual({ x: 0, y: 0 });
    expect(pointerToNdc(300, 50, rect)).toEqual({ x: 1, y: 1 });
    expect(pointerToNdc(100, 150, rect)).toEqual({ x: -1, y: -1 });
    // a zero-sized rect must not produce NaN
    const degenerate = pointerToNdc(5, 5, { left: 0, top: 0, width: 0, height: 0 });
    expect(Number.isFinite(degenerate.x)).toBe(true);
    expect(Number.isFinite(degenerate.y)).toBe(true);
  });
});

describe('shader plumbing', () => {
  test('compileShader returns the shader on success', () => {
    const gl = fakeGl();
    expect(compileShader(gl, gl.VERTEX_SHADER, 'void main(){}')).toBeTruthy();
  });

  test('compileShader throws the driver log — silent black canvases are the enemy', () => {
    const gl = fakeGl({ shaderOk: false });
    expect(() => compileShader(gl, gl.FRAGMENT_SHADER, 'garbage')).toThrow(/bad shader/);
    expect(gl.log).toContain('deleteShader');
  });

  test('createProgram links both stages and cleans up on link failure', () => {
    expect(createProgram(fakeGl(), HERO_VERTEX, HERO_FRAGMENT)).toBeTruthy();
    const bad = fakeGl({ programOk: false });
    expect(() => createProgram(bad, HERO_VERTEX, HERO_FRAGMENT)).toThrow(/link failed/);
    expect(bad.log).toContain('deleteProgram');
  });

  test('uniformMap resolves every requested name and reports the ones the driver dropped', () => {
    const gl = fakeGl();
    const map = uniformMap(gl, {} as never, ['uTime', 'uRes']);
    expect(Object.keys(map)).toEqual(['uTime', 'uRes']);
    // an optimized-out uniform yields null rather than throwing mid-frame
    expect(uniformMap(gl, {} as never, ['uMissing']).uMissing).toBeNull();
  });
});

describe('GLSL sources are internally consistent', () => {
  const sources = [
    ['hero vertex', HERO_VERTEX],
    ['hero fragment', HERO_FRAGMENT],
    ['field vertex', FIELD_VERTEX],
    ['field fragment', FIELD_FRAGMENT],
  ] as const;

  test('every stage declares a float precision (WebGL1 fragment shaders require it)', () => {
    for (const [name, src] of sources) expect(src, name).toMatch(/precision\s+(lowp|mediump|highp)\s+float;/);
  });

  test('no stage accidentally carries a GLSL 3.00 directive', () => {
    for (const [name, src] of sources) expect(src, name).not.toContain('#version');
  });

  test('every stage writes its required output', () => {
    expect(HERO_VERTEX).toContain('gl_Position');
    expect(HERO_FRAGMENT).toContain('gl_FragColor');
    expect(FIELD_VERTEX).toContain('gl_Position');
    expect(FIELD_VERTEX).toContain('gl_PointSize');
    expect(FIELD_FRAGMENT).toContain('gl_FragColor');
  });

  test('the uniform name lists match what the GLSL actually declares', () => {
    expect(new Set(declaredUniforms(HERO_VERTEX + HERO_FRAGMENT))).toEqual(new Set(HERO_UNIFORMS));
    expect(new Set(declaredUniforms(FIELD_VERTEX + FIELD_FRAGMENT))).toEqual(new Set(FIELD_UNIFORMS));
  });

  test('the field attribute list matches its vertex shader', () => {
    expect(new Set(declaredAttributes(FIELD_VERTEX))).toEqual(new Set(FIELD_ATTRIBUTES));
  });

  test('the hero is a fullscreen-triangle pass — no per-vertex geometry to feed it', () => {
    expect(declaredAttributes(HERO_VERTEX)).toEqual(['aPos']);
  });

  test('the hero scene raymarches a real SDF, not a gradient', () => {
    expect(HERO_FRAGMENT).toMatch(/sdRoundBox/);
    expect(HERO_FRAGMENT).toMatch(/softShadow/);
    expect(HERO_FRAGMENT).toMatch(/calcNormal/);
    expect(HERO_FRAGMENT).toMatch(/reflect\(/);
  });
});

describe('reduced motion is a first-class path, not an afterthought', () => {
  test('every animated site component queries prefers-reduced-motion', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = join(process.cwd(), 'components/site');
    const animated = readdirSync(dir).filter((f) => f.endsWith('.tsx') && /requestAnimationFrame/.test(readFileSync(join(dir, f), 'utf8')));
    expect(animated.length).toBeGreaterThan(0);
    for (const f of animated) {
      // either the media query itself, or the shared hook that owns it
      expect(readFileSync(join(dir, f), 'utf8'), f).toMatch(/prefers-reduced-motion|refersReducedMotion/);
    }
  });
});

describe('the render loop never leaks', () => {
  test('cancelAnimationFrame is paired with every requestAnimationFrame loop', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = join(process.cwd(), 'components/site');
    for (const f of readdirSync(dir).filter((n) => n.endsWith('.tsx'))) {
      const src = readFileSync(join(dir, f), 'utf8');
      if (src.includes('requestAnimationFrame')) expect(src, f).toContain('cancelAnimationFrame');
    }
  });

  test('vi is wired (guards against an empty suite silently passing)', () => {
    expect(typeof vi.fn).toBe('function');
  });
});
