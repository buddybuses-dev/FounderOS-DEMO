'use client';

/**
 * The agent field: a GPU point cloud of the workforce that reorganizes as you
 * scroll — swarm → hierarchy → orbit. The three formations are three position
 * attributes; the vertex shader blends them by a weight vector driven by scroll
 * progress, so morphing costs nothing per frame.
 *
 * The constellation links are drawn by the same program with `uMode = 1`, which
 * means the lines morph with the points instead of being re-solved every frame.
 */
import { useEffect, useRef, useState } from 'react';
import {
  createProgram,
  drawingSize,
  pointerToNdc,
  renderScale,
  resolveDpr,
  uniformMap,
  type GLLike,
} from '@/lib/site/gl';
import { FIELD_FRAGMENT, FIELD_UNIFORMS, FIELD_VERTEX, SCENE_ACCENT, SCENE_INK } from '@/lib/site/shaders';
import {
  clamp01,
  damp,
  easeOutExpo,
  hashNoise,
  lookAt4,
  multiply4,
  nearestNeighborEdges,
  perspective4,
  progress,
  shapePoints,
} from '@/lib/site/motion';
import { prefersReducedMotion } from '@/components/site/use-site-motion';

const DESKTOP_POINTS = 900;
const MOBILE_POINTS = 420;
const REVEAL_SECONDS = 1.8;

/**
 * Triangular blend across the three formations: weight 1 at its own stop,
 * falling to 0 at the neighbouring stops, always summing to 1.
 */
export function morphWeights(p: number): [number, number, number] {
  const t = clamp01(p) * 2; // stops at 0, 1, 2
  const a = Math.max(0, 1 - Math.abs(t - 0));
  const b = Math.max(0, 1 - Math.abs(t - 1));
  const c = Math.max(0, 1 - Math.abs(t - 2));
  const sum = a + b + c || 1;
  return [a / sum, b / sum, c / sum];
}

export function AgentField() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [generation, setGeneration] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: true,
      powerPreference: 'high-performance',
    }) ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

    if (!gl) {
      setFailed(true);
      return;
    }

    let program: WebGLProgram;
    try {
      program = createProgram(gl as unknown as GLLike, FIELD_VERTEX, FIELD_FRAGMENT);
    } catch (err) {
      if (process.env.NODE_ENV !== 'production') console.warn(err);
      setFailed(true);
      return;
    }

    const count = window.innerWidth < 760 ? MOBILE_POINTS : DESKTOP_POINTS;
    const sphere = shapePoints('sphere', count);
    const lattice = shapePoints('lattice', count);
    const ring = shapePoints('ring', count);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) seeds[i] = hashNoise(i, 7);
    // Links are solved once per formation. Drawing all three with an alpha
    // that follows the morph weights means each state shows the links that are
    // actually short in that state — one edge set stretched across a morph
    // reads as scribble, not structure.
    const edgeSets = [
      nearestNeighborEdges(sphere, 2, 0.3),
      nearestNeighborEdges(lattice, 3, 0.32),
      nearestNeighborEdges(ring, 2, 0.3),
    ];

    const attribute = (name: string, data: Float32Array, size: number) => {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(program, name);
      if (loc >= 0) {
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      }
      return buf;
    };

    gl.useProgram(program);
    const buffers = [
      attribute('aSphere', sphere, 3),
      attribute('aLattice', lattice, 3),
      attribute('aRing', ring, 3),
      attribute('aSeed', seeds, 1),
    ];
    const indexBuffers = edgeSets.map((edges) => {
      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, edges, gl.STATIC_DRAW);
      return buf;
    });

    const u = uniformMap(gl as unknown as GLLike, program, FIELD_UNIFORMS);
    gl.uniform3fv(u.uInk, SCENE_INK);
    gl.uniform3fv(u.uAccent, SCENE_ACCENT);
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    // Premultiplied source: the fragment shader outputs colour already scaled
    // by alpha, so overlapping points accumulate light instead of muddying.
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const reduced = prefersReducedMotion();
    const state = {
      dpr: resolveDpr(window.devicePixelRatio),
      pointer: { x: 0, y: 0 },
      target: { x: 0, y: 0 },
      mix: 0,
      mixTarget: 0,
      aspect: 1,
      visible: true,
      onScreen: true,
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = renderScale(rect.width, rect.height, state.dpr);
      const { width, height } = drawingSize(rect.width * state.dpr, rect.height * state.dpr, scale);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      state.aspect = Math.max(0.2, rect.width / Math.max(1, rect.height));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    // The scroll track is the ancestor marked by the page, so the morph is
    // driven by the whole section rather than by the canvas box alone.
    const track = canvas.closest<HTMLElement>('[data-scene-track]') ?? canvas;

    const readProgress = () => {
      const el = track;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      // 0 when the section's top reaches the viewport bottom, 1 once its
      // bottom passes the top — the section owns a full scroll of morphing.
      state.mixTarget = clamp01(progress(vh - rect.top, vh * 0.25, rect.height + vh * 0.75));
    };

    const onPointer = (e: PointerEvent) => {
      const ndc = pointerToNdc(e.clientX, e.clientY, canvas.getBoundingClientRect());
      state.target.x = ndc.x;
      state.target.y = ndc.y;
    };
    const onVisibility = () => {
      state.visible = !document.hidden;
      last = 0;
    };
    const onLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(raf);
    };
    const onRestored = () => setGeneration((g) => g + 1);

    const io =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              state.onScreen = entries.some((entry) => entry.isIntersecting);
              last = 0;
            },
            { threshold: 0 },
          );
    io?.observe(canvas);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => resize());
    ro?.observe(canvas);

    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('scroll', readProgress, { passive: true });
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    resize();
    readProgress();

    let raf = 0;
    let start = 0;
    let last = 0;
    let painted = false;
    let paintedMix = -1;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!start) start = now;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      if ((!state.visible || !state.onScreen) && painted) return;

      const elapsed = (now - start) / 1000;
      const reveal = reduced ? 1 : easeOutExpo(clamp01(elapsed / REVEAL_SECONDS));
      state.mix = reduced ? state.mixTarget : damp(state.mix, state.mixTarget, 4.5, dt);
      // Under reduced motion the field is a still image that re-composes only
      // when the scroll position genuinely changed the formation.
      if (reduced && painted && Math.abs(state.mix - paintedMix) < 0.002) return;
      state.pointer.x = reduced ? 0 : damp(state.pointer.x, state.target.x, 2.6, dt);
      state.pointer.y = reduced ? 0 : damp(state.pointer.y, state.target.y, 2.6, dt);

      const spin = reduced ? 0.6 : elapsed * 0.13 + state.pointer.x * 0.35;
      const eye: [number, number, number] = [
        Math.sin(spin) * 6.4,
        0.9 + state.pointer.y * 0.8,
        Math.cos(spin) * 6.4,
      ];
      const view = lookAt4(eye, [0, 0, 0], [0, 1, 0]);
      const proj = perspective4((38 * Math.PI) / 180, state.aspect, 0.1, 60);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniformMatrix4fv(u.uProj, false, proj);
      gl.uniformMatrix4fv(u.uView, false, view);
      gl.uniform1f(u.uTime, reduced ? 3.1 : elapsed);
      const weights = morphWeights(state.mix);
      gl.uniform3fv(u.uMix, weights);
      gl.uniform2f(u.uPointer, state.pointer.x, state.pointer.y);
      gl.uniform1f(u.uReveal, reveal);
      // Point size follows the drawing buffer, so a point is the same physical
      // size on a laptop panel and a 5K display.
      gl.uniform1f(u.uSize, canvas.height * 0.01);

      // Links underneath, then the points on top of them.
      gl.uniform1f(u.uMode, 1);
      for (let i = 0; i < indexBuffers.length; i++) {
        const weight = weights[i];
        if (weight < 0.02) continue;
        gl.uniform1f(u.uAlpha, 0.2 * Math.pow(weight, 1.4) * reveal);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffers[i]);
        gl.drawElements(gl.LINES, edgeSets[i].length, gl.UNSIGNED_SHORT, 0);
      }

      gl.uniform1f(u.uMode, 0);
      gl.uniform1f(u.uAlpha, 0.95 * reveal);
      gl.drawArrays(gl.POINTS, 0, count);

      painted = true;
      paintedMix = state.mix;
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      ro?.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', readProgress);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      for (const b of buffers) gl.deleteBuffer(b);
      for (const b of indexBuffers) gl.deleteBuffer(b);
      gl.deleteProgram(program);
    };
  }, [generation]);

  return (
    <div className="scene-stage field" aria-hidden="true">
      {failed ? <div className="scene-poster" data-variant="field" /> : <canvas ref={canvasRef} className="scene-canvas" />}
    </div>
  );
}

export default AgentField;
