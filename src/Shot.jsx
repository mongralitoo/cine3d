import React, {useMemo} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig, spring, Easing} from 'remotion';
import {ThreeCanvas} from '@remotion/three';
import {useThree} from '@react-three/fiber';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {Post} from './Post';
import {custom} from './custom';

const TAU = Math.PI * 2, rad = (d) => (d * Math.PI) / 180;
const mix = (a, b, p) => (Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * p) : a + (b - a) * p);
const EASE = {linear: (p) => p, smooth: Easing.inOut(Easing.cubic), out: Easing.out(Easing.cubic), in: Easing.in(Easing.cubic)};

// Interpolate a list of keyframes [{t, ...numeric or array fields}] at time t (seconds).
const sample = (keys, t, fps, ease = 'smooth') => {
  if (t <= keys[0].t || keys.length === 1) return keys[0];
  const last = keys[keys.length - 1];
  if (t >= last.t) return last;
  const i = keys.findIndex((k) => k.t > t) - 1, a = keys[i], b = keys[i + 1], d = b.t - a.t;
  const e = b.ease || ease;
  const p = e === 'spring'
    ? spring({frame: (t - a.t) * fps, fps, durationInFrames: d * fps, config: {damping: 13, stiffness: 90, mass: 1}})
    : (EASE[e] || EASE.smooth)((t - a.t) / d);
  const out = {...a};
  for (const k of Object.keys(b)) if (k !== 't' && k !== 'ease' && a[k] !== undefined) out[k] = mix(a[k], b[k], p);
  return out;
};

// Pixel textures (32x32, nearest filtering): tiles | bricks | wood | noise. Tinted by the object's colour.
const TEX = {};
const h2 = (x, y, s) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
const makeTex = (kind, color) => {
  const key = kind + color;
  if (TEX[key]) return TEX[key];
  const N = 32, cv = document.createElement('canvas'); cv.width = cv.height = N;
  const g = cv.getContext('2d'), base = new THREE.Color(color), c = new THREE.Color();
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    let k = 0.9 + h2(x, y, 1) * 0.18;
    if (kind === 'tiles') k = x % 16 === 0 || y % 16 === 0 ? 0.55 : k + (h2(x >> 4, y >> 4, 2) - 0.5) * 0.16;
    if (kind === 'bricks') { const off = (y >> 3) % 2 ? 8 : 0; k = (x + off) % 16 === 0 || y % 8 === 0 ? 0.68 : k + (h2((x + off) >> 4, y >> 3, 3) - 0.5) * 0.14; }
    if (kind === 'wood') k = 0.82 + 0.12 * Math.sin(y * 0.9 + h2(0, y >> 2, 4) * 3) + h2(x, y, 5) * 0.08 - (x % 32 === 0 ? 0.25 : 0);
    g.fillStyle = c.copy(base).multiplyScalar(k).getStyle();
    g.fillRect(x, y, 1, 1);
  }
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return (TEX[key] = t);
};

const PRESETS = {
  studio: {env: 0.55, lights: [
    {pos: [5, 8, 6], color: '#fff4e6', power: 3.2, shadow: true},
    {pos: [-7, 3, 4], color: '#cfe0ff', power: 0.7},
    {pos: [-3, 6, -8], color: '#ffffff', power: 2.4}]},
  dramatic: {env: 0.12, lights: [
    {pos: [7, 5, 2], color: '#ffe2c0', power: 4.5, shadow: true},
    {pos: [-5, 4, -7], color: '#9fc0ff', power: 3.5}]},
  neon: {env: 0.08, lights: [
    {pos: [6, 4, -4], color: '#ff2bd6', power: 5, shadow: true},
    {pos: [-6, 4, -3], color: '#19d3ff', power: 5},
    {pos: [0, 6, 7], color: '#ffffff', power: 0.5}]},
  sunset: {env: 0.3, lights: [
    {pos: [9, 2.5, -3], color: '#ff8a3c', power: 5, shadow: true},
    {pos: [-6, 5, 6], color: '#5a78c8', power: 0.9}]},
  soft: {env: 1.0, lights: [{pos: [3, 9, 5], color: '#ffffff', power: 1.6, shadow: true}]},
};

const Env = ({intensity}) => {
  const {gl, scene} = useThree();
  useMemo(() => {
    const pm = new THREE.PMREMGenerator(gl);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  }, [gl, scene]);
  scene.environmentIntensity = intensity;
  return null;
};

const Cam = ({cam, t, fps, aspect}) => {
  const camera = useThree((s) => s.camera);
  const keys = cam.keys || [{t: 0, pos: cam.pos || [0, 2, 8], look: cam.look || [0, 1, 0], lens: cam.lens || 50}];
  const k = sample(keys.map((x) => ({lens: cam.lens || 50, look: [0, 1, 0], ...x})), t, fps, cam.ease);
  const s = cam.shake || 0; // handheld drift, in world units
  const n = (f, ph) => (Math.sin(t * f + ph) + Math.sin(t * f * 2.3 + ph * 1.7) * 0.5) * s;
  camera.position.set(k.pos[0] + n(1.1, 0), k.pos[1] + n(0.9, 2), k.pos[2] + n(0.7, 4));
  camera.lookAt(k.look[0] + n(0.8, 1) * 0.5, k.look[1] + n(1.0, 3) * 0.5, k.look[2]);
  const half = Math.atan(12 / k.lens); // 24mm short side of a full-frame sensor
  camera.fov = (2 * (aspect >= 1 ? half : Math.atan(Math.tan(half) / aspect)) * 180) / Math.PI;
  camera.near = 0.1; camera.far = 300;
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  return null;
};

const Geo = ({o}) => {
  const s = o.size || [1, 1, 1];
  const box = useMemo(() => (o.shape && o.shape !== 'box' ? null
    : new RoundedBoxGeometry(s[0], s[1], s[2], 6, Math.min(o.bevel ?? 0.04, Math.min(...s) / 2))), [s.join(), o.bevel, o.shape]);
  switch (o.shape) {
    case 'sphere': return <sphereGeometry args={[s[0] / 2, 64, 48]} />;
    case 'cyl': return <cylinderGeometry args={[(s[2] ?? s[0]) / 2, s[0] / 2, s[1], 64]} />;
    case 'cone': return <coneGeometry args={[s[0] / 2, s[1], 64]} />;
    case 'torus': return <torusGeometry args={[s[0] / 2, s[1] / 2, 32, 128]} />;
    case 'capsule': return <capsuleGeometry args={[s[0] / 2, s[1], 16, 32]} />;
    case 'plane': return <planeGeometry args={[s[0], s[1]]} />;
    case 'ico': return <icosahedronGeometry args={[s[0] / 2, o.detail ?? 0]} />;
    default: return <primitive object={box} attach="geometry" />;
  }
};

// One object instance; i = index inside a grid (drives stagger and phase).
const Item = ({o, t, fps, i, offset}) => {
  const map = useMemo(() => {
    if (!o.tex) return null;
    const m = makeTex(o.tex, o.color || '#cccccc').clone(), s = o.size || [1, 1, 1], ts = o.texScale || 1;
    m.repeat.set(s[0] / ts, s[1] / ts); m.needsUpdate = true;
    return m;
  }, [o.tex, o.color, o.texScale, (o.size || []).join()]);
  let pos = [...(o.pos || [0, 0, 0])], rot = (o.rot || [0, 0, 0]).map(rad), sc = o.scale ?? 1, op = o.opacity ?? 1;
  if (o.keys) {
    const k = sample(o.keys, t, fps, o.ease);
    if (k.pos) pos = [...k.pos];
    if (k.rot) rot = k.rot.map(rad);
    if (k.scale !== undefined) sc = k.scale;
  }
  pos = pos.map((v, j) => v + offset[j]);
  if (o.in) {
    const at = (o.in.at || 0) + i * (o.in.stagger || 0), d = o.in.dist ?? 2;
    if (t < at) return null;
    const p = spring({frame: (t - at) * fps, fps, config: {damping: o.in.damping ?? 11, stiffness: o.in.stiffness ?? 110, mass: 1}});
    const kind = o.in.kind || 'pop';
    if (kind === 'pop') sc *= Math.max(p, 0.0001);
    if (kind === 'rise') pos[1] -= (1 - p) * d;
    if (kind === 'drop') pos[1] += (1 - p) * d;
    if (kind === 'slide') pos[0] -= (1 - p) * d;
    if (kind === 'fade' || kind === 'rise' || kind === 'drop' || kind === 'slide') op *= Math.min(1, Math.max(0, (t - at) * 4));
  }
  if (o.spin) rot = rot.map((v, j) => v + o.spin[j] * t * TAU);
  if (o.float) pos[1] += Math.sin(TAU * (o.float[1] ?? 0.3) * t + i * 1.3) * o.float[0];
  if (o.shape === 'custom') { const C = custom[o.use]; return C ? <group position={pos} rotation={rot} scale={sc}><C o={o} t={t} /></group> : null; }
  const glass = o.glass ? {transmission: 1, thickness: 0.6, ior: 1.45, roughness: o.rough ?? 0.05} : {};
  return (
    <mesh position={pos} rotation={rot} scale={sc} castShadow receiveShadow>
      <Geo o={o} />
      <meshPhysicalMaterial map={map} color={map ? '#ffffff' : o.color || '#d8d8d8'} roughness={o.rough ?? 0.4} metalness={o.metal ?? 0}
        emissive={o.glow || '#000000'} emissiveIntensity={o.glowPower ?? (o.glow ? 1.4 : 0)} clearcoat={o.coat ?? 0}
        clearcoatRoughness={0.15} transparent={op < 1} opacity={op} side={o.shape === 'plane' ? THREE.DoubleSide : THREE.FrontSide} {...glass} />
    </mesh>
  );
};

const Obj = ({o, t, fps}) => {
  const n = o.grid?.n || [1, 1, 1], g = o.grid?.gap || [0, 0, 0], items = [];
  for (let x = 0; x < n[0]; x++) for (let y = 0; y < n[1]; y++) for (let z = 0; z < n[2]; z++) {
    const i = items.length;
    items.push(<Item key={i} o={o} t={t} fps={fps} i={i}
      offset={[(x - (n[0] - 1) / 2) * g[0], (y - (n[1] - 1) / 2) * g[1], (z - (n[2] - 1) / 2) * g[2]]} />);
  }
  return <>{items}</>;
};

const Title = ({ti, t, fps, h}) => {
  const at = ti.at || 0, end = at + (ti.dur ?? 99);
  if (t < at || t > end) return null;
  const p = spring({frame: (t - at) * fps, fps, config: {damping: 16, stiffness: 90}});
  const out = Math.min(1, (end - t) * 3);
  const where = {center: {alignItems: 'center'}, top: {alignItems: 'flex-start', paddingTop: h * 0.1}, bottom: {alignItems: 'flex-end', paddingBottom: h * 0.1}}[ti.place || 'bottom'];
  return (
    <AbsoluteFill style={{justifyContent: 'center', display: 'flex', flexDirection: 'row', ...where}}>
      <div style={{fontFamily: ti.font || 'Inter, "Helvetica Neue", Helvetica, Arial, sans-serif', fontWeight: ti.weight || 700,
        fontSize: h * (ti.size || 0.06), color: ti.color || '#fff', letterSpacing: ti.track || '-0.02em', textAlign: 'center',
        maxWidth: '84%', lineHeight: 1.1, opacity: Math.min(p, out), transform: `translateY(${(1 - p) * h * 0.03}px)`,
        textShadow: '0 2px 30px rgba(0,0,0,.55)', textTransform: ti.upper ? 'uppercase' : 'none'}}>{ti.text}</div>
    </AbsoluteFill>
  );
};

export const Shot = (spec) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps, look = spec.look || {}, cam = spec.camera || {};
  const L = typeof spec.lights === 'string' ? {preset: spec.lights} : spec.lights || {};
  const P = PRESETS[L.preset || 'studio'] || PRESETS.studio;
  const lights = [...(L.replace ? [] : P.lights), ...(L.add || [])];
  const bg = look.bg || '#0c0d10', fog = look.fog === undefined ? [12, 60] : look.fog;
  const floor = spec.floor === undefined ? {} : spec.floor;
  const focus = cam.focus || sample((cam.keys || [{t: 0, look: cam.look || [0, 1, 0]}]).map((x) => ({look: [0, 1, 0], ...x})), t, fps, cam.ease).look;
  const fstop = cam.fstop ?? 2.8;
  return (
    <AbsoluteFill style={{backgroundColor: bg}}>
      <ThreeCanvas width={width} height={height} shadows={{type: THREE.PCFSoftShadowMap}}
        gl={{antialias: true, preserveDrawingBuffer: true, toneMapping: THREE.NoToneMapping}}>
        <color attach="background" args={[bg]} />
        {fog && <fog attach="fog" args={[bg, fog[0], fog[1]]} />}
        <Env intensity={L.env ?? P.env} />
        <Cam cam={cam} t={t} fps={fps} aspect={width / height} />
        {lights.map((l, i) => l.point
          ? <pointLight key={i} position={l.pos} color={l.color} intensity={(l.power ?? 2) * 20} decay={2} castShadow={!!l.shadow} />
          : <directionalLight key={i} position={l.pos} color={l.color} intensity={l.power ?? 2} castShadow={!!l.shadow}
              shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-radius={6}
              shadow-camera-left={-12} shadow-camera-right={12} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-camera-far={60} />)}
        {floor && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floor.y ?? 0, 0]} receiveShadow>
            <planeGeometry args={[400, 400]} />
            <meshStandardMaterial color={floor.color || bg} roughness={floor.rough ?? 0.55} metalness={floor.metal ?? 0.1} />
          </mesh>
        )}
        {(spec.objects || []).map((o, i) => <Obj key={i} o={o} t={t} fps={fps} />)}
        {look.post !== false && <Post focusPoint={focus} fstop={fstop} look={look} frame={frame} />}
      </ThreeCanvas>
      {(spec.titles || []).map((ti, i) => <Title key={i} ti={ti} t={t} fps={fps} h={Math.min(width, height)} />)}
    </AbsoluteFill>
  );
};
