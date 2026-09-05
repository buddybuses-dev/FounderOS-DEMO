/**
 * GLSL for the two hand-written WebGL scenes on the public site. Kept as plain
 * strings in one module so the shader sources are reviewable, diffable, and
 * checkable in tests (uniform/attribute lists are derived from the source, so a
 * typo in a getUniformLocation name fails the suite instead of the frame).
 *
 * Targets GLSL ES 1.00 / WebGL1 deliberately: it runs everywhere, including
 * the machines a prospect happens to open the site on.
 */

/** Precision preamble that degrades on hardware without highp fragments. */
const PRECISION = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;

// ---------------------------------------------------------------- the hero
/** Fullscreen triangle: three vertices, no geometry, no matrices. */
export const HERO_VERTEX = `
precision highp float;
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

/**
 * "The Monolith" — a raymarched signed-distance scene: a machined slab turning
 * over a black mirror floor, two agent rings orbiting it, soft shadows, ambient
 * occlusion, a single reflective bounce, volumetric glow, ACES tonemapping and
 * per-pixel grain. Camera dollies in on reveal, drifts with the pointer, and
 * rises with scroll.
 */
export const HERO_FRAGMENT = `${PRECISION}
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uPointer;
uniform float uScroll;
uniform float uReveal;
uniform vec3 uInk;
uniform vec3 uAccent;

#define STEPS 96
#define REFLECT_STEPS 40
#define FAR 42.0
#define SURF 0.0018

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

vec2 opU(vec2 a, vec2 b) { return a.x < b.x ? a : b; }

/** Scene SDF. x = distance, y = material id. */
vec2 map(vec3 p) {
  vec3 q = p;
  q.y -= 0.15;
  q.xz = rot(uTime * 0.15 + uPointer.x * 0.45) * q.xz;

  // The slab, with a machined light-slit and a lower port cut out of it.
  float slab = sdRoundBox(q, vec3(0.60, 1.50, 0.145), 0.028);
  float slit = sdRoundBox(q - vec3(0.0, 0.66, 0.0), vec3(0.9, 0.010, 0.4), 0.004);
  float port = sdRoundBox(q - vec3(0.0, -0.62, 0.0), vec3(0.26, 0.010, 0.4), 0.004);
  slab = max(slab, -slit);
  slab = max(slab, -port);
  vec2 res = vec2(slab, 1.0);

  // Inner orbit ring + three satellites riding it.
  vec3 r = p;
  r.y -= 0.15;
  r.yz = rot(0.44) * r.yz;
  r.xz = rot(-uTime * 0.26) * r.xz;
  res = opU(res, vec2(sdTorus(r, vec2(2.18, 0.0075)), 2.0));
  for (int i = 0; i < 3; i++) {
    float a = float(i) * 2.0943951;
    vec3 s = vec3(cos(a) * 2.18, 0.0, sin(a) * 2.18);
    res = opU(res, vec2(length(r - s) - 0.042, 3.0));
  }

  // Outer ring, counter-rotating on a different axis.
  vec3 r2 = p;
  r2.y -= 0.15;
  r2.xy = rot(-0.58) * r2.xy;
  r2.xz = rot(uTime * 0.17) * r2.xz;
  res = opU(res, vec2(sdTorus(r2, vec2(2.95, 0.0045)), 2.0));

  // The floor.
  res = opU(res, vec2(p.y + 1.85, 4.0));
  return res;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(1.0, -1.0) * 0.0009;
  return normalize(
    e.xyy * map(p + e.xyy).x +
    e.yyx * map(p + e.yyx).x +
    e.yxy * map(p + e.yxy).x +
    e.xxx * map(p + e.xxx).x
  );
}

/** Penumbra shadow — the soft edge is what stops the scene reading as clip art. */
float softShadow(vec3 ro, vec3 rd, float k) {
  float res = 1.0;
  float t = 0.05;
  for (int i = 0; i < 32; i++) {
    float h = map(ro + rd * t).x;
    res = min(res, k * h / t);
    t += clamp(h, 0.02, 0.35);
    if (res < 0.004 || t > 12.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

float ambientOcclusion(vec3 p, vec3 n) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.02 + 0.11 * float(i);
    occ += (h - map(p + n * h).x) * sca;
    sca *= 0.72;
  }
  return clamp(1.0 - 2.4 * occ, 0.0, 1.0);
}

/** March and also gather the volumetric bloom shed by emissive materials. */
vec2 march(vec3 ro, vec3 rd, int maxSteps, out float glow) {
  float t = 0.02;
  vec2 hit = vec2(-1.0, -1.0);
  glow = 0.0;
  for (int i = 0; i < STEPS; i++) {
    if (i >= maxSteps) break;
    vec3 p = ro + rd * t;
    vec2 h = map(p);
    if (h.y > 1.5 && h.y < 3.5) glow += exp(-max(h.x, 0.0) * 26.0) * 0.030;
    if (h.x < SURF * t) { hit = vec2(t, h.y); break; }
    t += h.x * 0.92;
    if (t > FAR) break;
  }
  return hit;
}

vec3 skyColor(vec3 rd) {
  float h = clamp(rd.y * 0.5 + 0.5, 0.0, 1.0);
  vec3 low = uInk * 0.06;
  vec3 high = uInk * 0.012;
  vec3 col = mix(low, high, pow(h, 0.7));
  // a cold horizon bloom behind the slab
  float horizon = exp(-abs(rd.y) * 9.0);
  col += uAccent * horizon * 0.035;
  return col;
}

vec3 shade(vec3 p, vec3 rd, float matId, out vec3 normalOut, out float reflectance) {
  vec3 n = calcNormal(p);
  normalOut = n;
  vec3 key = normalize(vec3(0.55, 0.82, 0.42));
  float diff = clamp(dot(n, key), 0.0, 1.0);
  float sha = softShadow(p + n * 0.006, key, 12.0);
  float ao = ambientOcclusion(p, n);
  float fres = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 4.0);
  vec3 h = normalize(key - rd);
  float spec = pow(clamp(dot(n, h), 0.0, 1.0), 90.0);

  vec3 col;
  reflectance = 0.0;

  if (matId < 1.5) {
    // The monolith: near-black graphite, hard specular, white fresnel edge.
    col = uInk * 0.05;
    col += uInk * diff * sha * 0.11;
    col += uInk * spec * sha * 0.85;
    col += uInk * fres * 0.55;
    col += uAccent * fres * 0.28;
    col *= mix(0.55, 1.0, ao);
    reflectance = 0.22;
  } else if (matId < 2.5) {
    // Orbit rings: emissive filament.
    col = mix(uAccent, uInk, 0.35) * 1.35;
  } else if (matId < 3.5) {
    // Satellites: hot cores.
    col = uInk * 1.7 + uAccent * 0.5;
  } else {
    // The floor: a black mirror with a faint measured grid.
    // Derivative-free grid (no OES_standard_derivatives dependency): the
    // line widens with distance, which both fakes AA and reads as perspective.
    vec2 gv = abs(fract(p.xz * 0.5) - 0.5);
    float d2 = length(p.xz);
    float w = 0.010 + d2 * 0.0016;
    float line = 1.0 - smoothstep(w, w * 2.6, min(gv.x, gv.y));
    float fade = exp(-d2 * 0.10);
    col = uInk * 0.010;
    col += uInk * line * 0.055 * fade;
    col += uAccent * line * 0.030 * fade;
    col += uInk * diff * sha * 0.02;
    col *= mix(0.35, 1.0, ao);
    reflectance = 0.34 * fade + 0.06;
  }
  return col;
}

// Narkowicz ACES approximation — filmic rolloff instead of clipped highlights.
vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

float grain(vec2 uv, float t) {
  return fract(sin(dot(uv + t, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes.xy) / uRes.y;

  // Camera: dollies in as the page reveals, drifts with the pointer, climbs
  // and tilts down as the hero scrolls away.
  float dolly = mix(12.5, 6.6, uReveal) + uScroll * 1.5;
  float ang = 0.30 + uPointer.x * 0.30 + uTime * 0.025;
  float hgt = 0.50 + uPointer.y * 0.55 + uScroll * 2.6;
  vec3 ro = vec3(sin(ang) * dolly, hgt, cos(ang) * dolly);
  vec3 ta = vec3(0.0, 0.18 - uScroll * 0.5, 0.0);

  vec3 fw = normalize(ta - ro);
  vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fw));
  vec3 up = cross(fw, rt);
  vec3 rd = normalize(uv.x * rt + uv.y * up + 1.55 * fw);

  float glow;
  vec2 hit = march(ro, rd, STEPS, glow);
  vec3 col = skyColor(rd);

  if (hit.x > 0.0) {
    vec3 p = ro + rd * hit.x;
    vec3 n;
    float reflectance;
    col = shade(p, rd, hit.y, n, reflectance);

    // One mirror bounce — the floor carries the monolith, which is most of
    // the perceived production value for very little cost.
    if (reflectance > 0.01) {
      vec3 rrd = reflect(rd, n);
      float rglow;
      vec2 rhit = march(p + n * 0.01, rrd, REFLECT_STEPS, rglow);
      vec3 rcol = skyColor(rrd);
      if (rhit.x > 0.0) {
        vec3 rp = p + n * 0.01 + rrd * rhit.x;
        vec3 rn;
        float rr;
        rcol = shade(rp, rrd, rhit.y, rn, rr);
      }
      rcol += uAccent * rglow * 0.6;
      col = mix(col, rcol, reflectance);
    }

    // Distance fog toward the sky, so nothing has a hard cutoff.
    col = mix(col, skyColor(rd), 1.0 - exp(-0.0016 * hit.x * hit.x));
  }

  col += uAccent * glow * 0.9;
  col += uInk * glow * 0.35;

  // Grade: exposure, filmic curve, vignette, grain, ordered dither.
  col *= mix(0.0, 1.18, uReveal);
  col = aces(col);
  vec2 vig = gl_FragCoord.xy / uRes.xy - 0.5;
  col *= 1.0 - dot(vig, vig) * 0.85;
  float g = grain(gl_FragCoord.xy / uRes.xy, fract(uTime));
  col += (g - 0.5) * 0.022;
  col += (grain(gl_FragCoord.xy, 0.0) - 0.5) / 255.0;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;

export const HERO_UNIFORMS = ['uRes', 'uTime', 'uPointer', 'uScroll', 'uReveal', 'uInk', 'uAccent'] as const;

// -------------------------------------------------------- the agent field
/**
 * A GPU point cloud that morphs between three formations — swarm sphere,
 * ordered lattice, orbit ring — by blending three position attributes with a
 * scroll-driven weight vector. The same program draws the constellation lines
 * (uMode = 1), so the links morph with the points for free.
 */
export const FIELD_VERTEX = `
precision highp float;
attribute vec3 aSphere;
attribute vec3 aLattice;
attribute vec3 aRing;
attribute float aSeed;

uniform mat4 uProj;
uniform mat4 uView;
uniform float uTime;
uniform vec3 uMix;
uniform float uSize;
uniform vec2 uPointer;
uniform float uReveal;

varying float vDepth;
varying float vSeed;

void main() {
  vec3 p = aSphere * uMix.x + aLattice * uMix.y + aRing * uMix.z;

  // Per-point drift so the formation breathes instead of freezing between
  // morph states, plus a pointer-driven repulsion around the cursor axis.
  float ph = aSeed * 6.2831853;
  p += 0.055 * vec3(sin(uTime * 0.7 + ph), cos(uTime * 0.62 + ph * 1.7), sin(uTime * 0.53 + ph * 2.3));
  vec2 away = p.xy - uPointer * 2.2;
  p.xy += normalize(away + 0.0001) * 0.16 / (1.0 + dot(away, away) * 1.6);

  // Points fly in from the outside on reveal.
  p *= mix(2.4, 1.0, uReveal);

  vec4 mv = uView * vec4(p, 1.0);
  gl_Position = uProj * mv;

  float dist = max(-mv.z, 0.001);
  gl_PointSize = uSize * (4.5 / dist) * (0.55 + aSeed * 0.9);
  vDepth = clamp(1.0 - (dist - 3.0) / 7.0, 0.06, 1.0);
  vSeed = aSeed;
}
`;

export const FIELD_FRAGMENT = `${PRECISION}
uniform float uAlpha;
uniform float uMode;
uniform vec3 uInk;
uniform vec3 uAccent;

varying float vDepth;
varying float vSeed;

void main() {
  float mask = 1.0;
  if (uMode < 0.5) {
    // Soft round sprite — square points are the tell of a cheap particle demo.
    vec2 d = gl_PointCoord - 0.5;
    float r = dot(d, d);
    if (r > 0.25) discard;
    mask = smoothstep(0.25, 0.02, r);
  }
  vec3 col = mix(uInk, uAccent, smoothstep(0.55, 1.0, vSeed));
  float a = mask * uAlpha * pow(vDepth, 1.4);
  gl_FragColor = vec4(col * a, a);
}
`;

export const FIELD_UNIFORMS = [
  'uProj',
  'uView',
  'uTime',
  'uMix',
  'uSize',
  'uPointer',
  'uReveal',
  'uAlpha',
  'uMode',
  'uInk',
  'uAccent',
] as const;

export const FIELD_ATTRIBUTES = ['aSphere', 'aLattice', 'aRing', 'aSeed'] as const;

const nameList = (src: string, keyword: 'uniform' | 'attribute'): string[] => {
  const re = new RegExp(`\\b${keyword}\\s+\\w+\\s+(\\w+)\\s*;`, 'g');
  const out = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) out.add(m[1]);
  return [...out];
};

/** Uniform names the GLSL actually declares — the truth the JS must match. */
export const declaredUniforms = (src: string): string[] => nameList(src, 'uniform');
/** Attribute names the GLSL actually declares. */
export const declaredAttributes = (src: string): string[] => nameList(src, 'attribute');

/**
 * Scene palette, fed to both programs as uniforms. Mirrors `--site-ink` and
 * `--site-accent` in app/site/site.css — shaders cannot read CSS variables, so
 * these are the one place the two surfaces are kept in step.
 */
export const SCENE_INK = new Float32Array([0.957, 0.965, 0.98]);
export const SCENE_ACCENT = new Float32Array([0.412, 0.478, 1.0]);
