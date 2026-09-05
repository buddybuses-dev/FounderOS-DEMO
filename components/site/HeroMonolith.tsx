'use client';

/**
 * The hero scene: a raymarched signed-distance field rendered by a
 * hand-written WebGL program — no 3D library, no meshes, no textures. The
 * whole image (slab, orbit rings, mirror floor, shadows, bloom, grain) is
 * computed per pixel in `HERO_FRAGMENT`.
 *
 * Everything expensive is conditional: it renders only while on screen and the
 * tab is visible, drops resolution when frames run long, refuses to animate
 * under `prefers-reduced-motion`, and falls back to a static poster when the
 * machine has no WebGL at all.
 */
import { useEffect, useRef, useState } from 'react';
import {
  createProgram,
  drawingSize,
  nextScale,
  pointerToNdc,
  renderScale,
  resolveDpr,
  uniformMap,
  type GLLike,
} from '@/lib/site/gl';
import { HERO_FRAGMENT, HERO_UNIFORMS, HERO_VERTEX, SCENE_ACCENT, SCENE_INK } from '@/lib/site/shaders';
import { clamp01, damp, easeOutExpo, progress } from '@/lib/site/motion';
import { prefersReducedMotion } from '@/components/site/use-site-motion';

/** How long the opening camera dolly takes, in seconds. */
const REVEAL_SECONDS = 2.2;
const TARGET_FRAME_MS = 1000 / 60;

export function HeroMonolith() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [generation, setGeneration] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = (canvas.getContext('webgl', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
    }) ?? canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;

    if (!gl) {
      setFailed(true);
      return;
    }

    let program: WebGLProgram;
    try {
      program = createProgram(gl as unknown as GLLike, HERO_VERTEX, HERO_FRAGMENT);
    } catch (err) {
      // A driver that cannot compile the scene gets the poster, not a black box.
      if (process.env.NODE_ENV !== 'production') console.warn(err);
      setFailed(true);
      return;
    }

    const u = uniformMap(gl as unknown as GLLike, program, HERO_UNIFORMS);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // One oversized triangle covers the viewport with no seam down the middle.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(program);
    gl.uniform3fv(u.uInk, SCENE_INK);
    gl.uniform3fv(u.uAccent, SCENE_ACCENT);

    const reduced = prefersReducedMotion();
    const state = {
      pointer: { x: 0, y: 0 },
      target: { x: 0, y: 0 },
      scroll: 0,
      scale: 1,
      dpr: resolveDpr(window.devicePixelRatio),
      cssW: 0,
      cssH: 0,
      visible: true,
      onScreen: true,
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const budgetScale = renderScale(rect.width, rect.height, state.dpr);
      const { width, height } = drawingSize(rect.width * state.dpr, rect.height * state.dpr, budgetScale * state.scale);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      state.cssW = rect.width;
      state.cssH = rect.height;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    const onPointer = (e: PointerEvent) => {
      const ndc = pointerToNdc(e.clientX, e.clientY, canvas.getBoundingClientRect());
      state.target.x = ndc.x;
      state.target.y = ndc.y;
    };
    const onScroll = () => {
      const rect = canvas.getBoundingClientRect();
      state.scroll = clamp01(progress(-rect.top, 0, Math.max(1, rect.height)));
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
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    resize();
    onScroll();

    let raf = 0;
    let start = 0;
    let last = 0;
    let painted = false;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!start) start = now;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      const frameMs = last ? now - last : TARGET_FRAME_MS;
      last = now;

      // Reduced motion still gets one composed frame — the image, not the ride.
      if (reduced && painted) return;
      if (!state.visible || !state.onScreen) {
        if (painted) return;
      }

      const elapsed = (now - start) / 1000;
      const reveal = reduced ? 1 : easeOutExpo(clamp01(elapsed / REVEAL_SECONDS));

      state.pointer.x = reduced ? 0 : damp(state.pointer.x, state.target.x, 3.2, dt);
      state.pointer.y = reduced ? 0 : damp(state.pointer.y, state.target.y, 3.2, dt);

      // Adaptive resolution: keep the frame inside budget before quality.
      if (!reduced && painted) {
        const proposed = nextScale(state.scale, frameMs, TARGET_FRAME_MS * 1.35);
        if (Math.abs(proposed - state.scale) > 0.02) {
          state.scale = proposed;
          resize();
        }
      }

      gl.uniform2f(u.uRes, canvas.width, canvas.height);
      gl.uniform1f(u.uTime, reduced ? 4.2 : elapsed);
      gl.uniform2f(u.uPointer, state.pointer.x, state.pointer.y);
      gl.uniform1f(u.uScroll, state.scroll);
      gl.uniform1f(u.uReveal, reveal);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      painted = true;
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      io?.disconnect();
      ro?.disconnect();
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, [generation]);

  return (
    <div className="scene-stage" aria-hidden="true">
      {failed ? (
        <div className="scene-poster" data-variant="monolith" />
      ) : (
        <canvas ref={canvasRef} className="scene-canvas" />
      )}
      <div className="scene-scrim" />
    </div>
  );
}

export default HeroMonolith;
