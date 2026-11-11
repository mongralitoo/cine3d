// Single-file film pipeline: depth-of-field, bloom + halation, ACES tone mapping, grain, vignette.
// Built synchronously and rendered from useFrame so the very first frame of a still is already correct.
import {useMemo} from 'react';
import {useFrame, useThree} from '@react-three/fiber';
import * as THREE from 'three';

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`;
const BRIGHT = `uniform sampler2D tex; uniform float th; varying vec2 vUv;
void main(){ vec3 c = min(texture2D(tex, vUv).rgb, vec3(40.)); float l = max(c.r, max(c.g, c.b));
  gl_FragColor = vec4(c * smoothstep(th, th + 0.6, l), 1.); }`;
const BLUR = `uniform sampler2D tex; uniform vec2 dir; varying vec2 vUv;
void main(){ vec3 c = texture2D(tex, vUv).rgb * 0.227027;
  c += (texture2D(tex, vUv + dir * 1.384615).rgb + texture2D(tex, vUv - dir * 1.384615).rgb) * 0.316216;
  c += (texture2D(tex, vUv + dir * 3.230769).rgb + texture2D(tex, vUv - dir * 3.230769).rgb) * 0.070270;
  gl_FragColor = vec4(c, 1.); }`;
const FINAL = `#include <packing>
uniform sampler2D tex, depth, b1, b2; uniform vec2 px;
uniform float near, far, focus, maxR, bloom, hal, grain, vig, seed, expo, aspect;
varying vec2 vUv;
float vz(vec2 uv){ return -perspectiveDepthToViewZ(texture2D(depth, uv).x, near, far); }
float coc(float z){ return clamp(abs(z - focus) / max(z, 0.001) * 1.6, 0., 1.); }
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + seed) * 43758.5453); }
void main(){
  float z0 = vz(vUv), c0 = coc(z0), jit = hash(vUv / px + 7.) * 6.2832; vec3 acc = texture2D(tex, vUv).rgb; float w = 1.;
  if (maxR > 0.5) for (int i = 1; i < 48; i++) {
    float fi = float(i), r = sqrt(fi / 48.), a = fi * 2.399963 + jit;
    vec2 uv = vUv + vec2(cos(a), sin(a)) * r * maxR * px;
    float zs = vz(uv), cs = coc(zs);
    if (zs > z0) cs = min(cs, c0);            // background must not bleed over a sharp foreground
    float k = smoothstep(r - 0.08, r + 0.08, cs);
    acc += texture2D(tex, uv).rgb * k; w += k;
  }
  vec3 c = acc / w;
  c += texture2D(b1, vUv).rgb * bloom + texture2D(b2, vUv).rgb * (bloom * 0.6 + hal * vec3(1., 0.42, 0.22));
  c *= expo;
  c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0., 1.);   // ACES (Narkowicz fit)
  vec2 q = (vUv - 0.5) * vec2(max(aspect, 1.), max(1. / aspect, 1.));
  c *= 1. - vig * smoothstep(0.35, 1.05, length(q) * 1.25);
  c = pow(c, vec3(1. / 2.2));
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c += (hash(vUv / px) - 0.5) * grain * (1. - lum * 0.6);
  gl_FragColor = vec4(c, 1.);
}`;

export const Post = ({focusPoint, fstop, look, frame}) => {
  const {gl, size} = useThree();
  const S = useMemo(() => {
    const v = gl.getDrawingBufferSize(new THREE.Vector2()), w = v.x, h = v.y;
    const rt = (W, H, extra = {}) => new THREE.WebGLRenderTarget(W, H, {type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, ...extra});
    const main = rt(w, h, {depthBuffer: true, depthTexture: new THREE.DepthTexture(w, h), samples: look.msaa ?? 4});
    const q = [rt(w >> 2, h >> 2), rt(w >> 2, h >> 2)], e = [rt(w >> 3, h >> 3), rt(w >> 3, h >> 3)];
    const mat = (frag, u) => new THREE.ShaderMaterial({vertexShader: VERT, fragmentShader: frag, uniforms: u, depthTest: false, depthWrite: false, toneMapped: false});
    const bright = mat(BRIGHT, {tex: {value: null}, th: {value: 1}});
    const blur = mat(BLUR, {tex: {value: null}, dir: {value: new THREE.Vector2()}});
    const fin = mat(FINAL, Object.fromEntries(['tex', 'depth', 'b1', 'b2', 'px', 'near', 'far', 'focus', 'maxR', 'bloom', 'hal', 'grain', 'vig', 'seed', 'expo', 'aspect'].map((k) => [k, {value: null}])));
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bright);
    const sc = new THREE.Scene(); sc.add(quad);
    return {w, h, main, q, e, bright, blur, fin, quad, sc, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)};
  }, [gl, size.width, size.height]);

  useFrame(({scene, camera}) => {
    const {w, h, main, q, e, bright, blur, fin, quad, sc, cam} = S;
    const pass = (m, target) => { quad.material = m; gl.setRenderTarget(target); gl.render(sc, cam); };
    gl.setRenderTarget(main); gl.clear(); gl.render(scene, camera);
    bright.uniforms.tex.value = main.texture; bright.uniforms.th.value = look.bloomAt ?? 1.0; pass(bright, q[0]);
    const gauss = (pair, src, n) => { let s = src; for (let i = 0; i < n; i++) {
      blur.uniforms.tex.value = s.texture; blur.uniforms.dir.value.set((1 + i) / pair[1].width, 0); pass(blur, pair[1]);
      blur.uniforms.tex.value = pair[1].texture; blur.uniforms.dir.value.set(0, (1 + i) / pair[0].height); pass(blur, pair[0]); s = pair[0]; } };
    gauss(q, q[0], 2); gauss(e, q[0], 3);
    const dir = camera.getWorldDirection(new THREE.Vector3());
    const u = fin.uniforms, f = fstop >= 16 ? 0 : h * 0.02 * Math.min(2.5, 2.8 / fstop);
    Object.assign(u.tex, {value: main.texture}); u.depth.value = main.depthTexture; u.b1.value = q[0].texture; u.b2.value = e[0].texture;
    u.px.value = new THREE.Vector2(1 / w, 1 / h); u.near.value = camera.near; u.far.value = camera.far;
    u.focus.value = Math.max(0.2, new THREE.Vector3(...focusPoint).sub(camera.position).dot(dir));
    u.maxR.value = f; u.bloom.value = look.bloom ?? 0.22; u.hal.value = look.halation ?? 0.1;
    u.grain.value = look.grain ?? 0.06; u.vig.value = look.vignette ?? 0.45; u.seed.value = (frame % 97) * 0.731;
    u.expo.value = look.exposure ?? 1; u.aspect.value = w / h;
    pass(fin, null);
  }, 1);
  return null;
};
