// Escape hatch: register hand-written R3F components here, use them with {"shape":"custom","use":"Name"}.
// Each receives {o, t} (the object spec and the time in seconds).
import React, {useMemo} from 'react';
import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const D = Math.PI / 180;
const GEO = new RoundedBoxGeometry(1, 1, 1, 2, 0.09);
const TILE = new RoundedBoxGeometry(0.285, 0.06, 0.285, 2, 0.02);
const hash = (x, y, z, s = 0) => { const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7 + s * 19.3) * 43758.5453; return n - Math.floor(n); };
const c01 = (x) => Math.max(0, Math.min(1, x));
const sstep = (a, b, x) => { const p = c01((x - a) / (b - a)); return p * p * (3 - 2 * p); };
const backOut = (p) => 1 + 2.9 * Math.pow(p - 1, 3) + 1.9 * Math.pow(p - 1, 2);

// ---- voxel helpers --------------------------------------------------------
// Hollow block of n=[nx,ny,nz] voxels of size v, centred on p. paint(x,y,z) may return a colour.
const Vox = ({n, v = 0.1, p = [0, 0, 0], color, paint, seed = 0}) => {
  const mesh = useMemo(() => {
    const cells = [];
    for (let x = 0; x < n[0]; x++) for (let y = 0; y < n[1]; y++) for (let z = 0; z < n[2]; z++)
      if (!x || !y || !z || x === n[0] - 1 || y === n[1] - 1 || z === n[2] - 1) cells.push([x, y, z]);
    const m = new THREE.InstancedMesh(GEO, new THREE.MeshStandardMaterial({roughness: 0.88}), cells.length);
    const M = new THREE.Matrix4(), c = new THREE.Color();
    cells.forEach(([x, y, z], i) => {
      M.makeScale(v * 0.95, v * 0.95, v * 0.95).setPosition((x + 0.5 - n[0] / 2) * v, (y + 0.5 - n[1] / 2) * v, (z + 0.5 - n[2] / 2) * v);
      m.setMatrixAt(i, M);
      c.set((paint && paint(x, y, z)) || color).multiplyScalar(0.84 + hash(x, y, z, seed) * 0.26);
      m.setColorAt(i, c);
    });
    m.castShadow = m.receiveShadow = true;
    return m;
  }, []);
  return <primitive object={mesh} position={p} />;
};

const B = ({s, p, color, glow = 0}) => (
  <mesh position={p} castShadow>
    <boxGeometry args={s} />
    <meshStandardMaterial color={color} roughness={0.5} emissive={glow ? color : '#000'} emissiveIntensity={glow} />
  </mesh>
);

// ---- timeline -------------------------------------------------------------
const WALK_END = 5.2, SIT = [5.2, 6.4];
const TALK = {robot: [[1.6, 3.3], [6.6, 8.0]], cat: [[3.5, 5.0], [8.2, 9.8]]};
const talking = (who, t) => TALK[who].some(([a, b]) => t > a && t < b);
const walkAmp = (t) => 1 - sstep(WALK_END - 0.35, WALK_END, t);
const sitP = (t) => sstep(SIT[0], SIT[1], t);
const lookAt = (t) => sstep(1.2, 2.0, t);
const walkZ = (o, t) => { const z0 = o.z0 ?? -3.2, z1 = o.z1 ?? 0; return z0 + ((z1 - z0) * Math.min(t, WALK_END)) / WALK_END; };

const Bubble = ({t, spans, y, x, side}) => {
  const span = spans.find(([a, b]) => t > a && t < b);
  if (!span) return null;
  const s = backOut(c01((t - span[0]) / 0.35)) * c01((span[1] - t) / 0.2);
  return (
    <group position={[x, y, 0.15]} scale={Math.max(s, 0.001)}>
      <Vox n={[8, 5, 1]} v={0.09} color="#f2eee6" seed={3} />
      <Vox n={[2, 2, 1]} v={0.09} p={[side * 0.18, -0.31, 0]} color="#f2eee6" seed={4} />
      {[0, 1, 2].map((i) => (
        <B key={i} s={[0.09, 0.09, 0.05]} p={[(i - 1) * 0.18, 0.05 * Math.max(0, Math.sin(t * 9 - i * 0.9)), 0.06]} color="#2b2b2e" />
      ))}
    </group>
  );
};

// ---- characters -----------------------------------------------------------
const GREY = '#6c6d6b', LIGHT = '#8f8c84', DARK = '#5f605f';

const Robot = ({o, t}) => {
  const amp = o.still ? 0 : walkAmp(t), s = o.still ? 0 : sitP(t), ph = t * 2 * Math.PI * 0.9;
  const sw = Math.sin(ph) * 28 * D * amp;
  const bob = Math.abs(Math.cos(ph)) * 0.035 * amp - s * 0.25;
  const talk = talking('robot', t);
  const eye = talk ? 0.55 + 0.45 * Math.abs(Math.sin(t * 11)) : 1;
  const head = [talk ? Math.sin(t * 6) * 3 * D : 0, lookAt(t) * 22 * D + Math.sin(t * 1.3) * 3 * D, 0];
  return (
    <group position={[0, 0, walkZ(o, t)]}>
      <group position={[0, 0.4 + bob, 0]}>
        {[-1, 1].map((k) => (
          <group key={k} position={[k * 0.2, 0, 0]} rotation={[k * sw * (1 - s) - 90 * D * s, 0, 0]}>
            <Vox n={[3, 4, 3]} p={[0, -0.2, 0]} color={GREY} seed={k + 5} paint={(x, y) => (y === 0 ? DARK : null)} />
          </group>
        ))}
        <Vox n={[8, 6, 6]} p={[0, 0.3, 0]} color={GREY} seed={1}
          paint={(x, y, z) => (z === 5 && y >= 2 && y <= 3 && x >= 2 && x <= 5 ? DARK : null)} />
        {[-1, 1].map((k) => (
          <group key={k} position={[k * 0.57, 0.55, 0]} rotation={[-k * sw * 0.8 * (1 - s) - 25 * D * s, 0, k * 4 * D]}>
            <Vox n={[3, 5, 3]} p={[0, -0.2, 0]} color={GREY} seed={k + 7} />
          </group>
        ))}
        <group position={[0, 0.6, 0]} rotation={head}>
          <Vox n={[10, 8, 9]} p={[0, 0.4, 0]} color={GREY} seed={2} paint={(x, y, z) => (y === 7 && hash(x, y, z, 9) > 0.55 ? LIGHT : null)} />
          <B s={[0.76, 0.48, 0.02]} p={[0, 0.38, 0.455]} color="#202224" />
          {[-1, 1].map((k) => <B key={k} s={[0.13, 0.2 * eye, 0.03]} p={[k * 0.17, 0.4, 0.47]} color="#4fe6bd" glow={1.8} />)}
          {[-1, 1].map((k) => <Vox key={k} n={[2, 3, 3]} p={[k * 0.56, 0.42, 0]} color={GREY} seed={k + 11} />)}
        </group>
      </group>
      <Bubble t={t} spans={TALK.robot} y={2.2 - s * 0.25} x={-0.25} side={1} />
    </group>
  );
};

const OR = '#e07a2a', STRIPE = '#c4601b', CREAM = '#f1d1a3';

const Cat = ({o, t}) => {
  const amp = walkAmp(t), s = sitP(t), ph = t * 2 * Math.PI * 1.3;
  const sw = Math.sin(ph) * 30 * D * amp, pitch = -30 * D * s;
  const pivotY = 0.4 - 0.3 * s + Math.abs(Math.cos(ph)) * 0.02 * amp;
  const talk = talking('cat', t), mouth = talk ? Math.abs(Math.sin(t * 12)) : 0;
  const head = [-pitch + (talk ? Math.sin(t * 7) * 3 * D : 0), -lookAt(t) * 25 * D, Math.sin(t * 1.7) * 3 * D];
  const leg = (k, front) => (
    <group key={`${front}${k}`} position={[k * 0.15, 0, front ? 0.68 : 0.12]}
      rotation={[front ? -k * sw * (1 - s) - pitch : k * sw * (1 - s) - 60 * D * s, 0, 0]}>
      <Vox n={[2, 4, 2]} p={[0, -0.2, 0]} color={OR} seed={k + (front ? 3 : 8)} paint={(x, y) => (y === 0 ? CREAM : null)} />
    </group>
  );
  return (
    <group position={[0, 0, walkZ(o, t)]}>
      <group position={[0, pivotY, -0.45]} rotation={[pitch, 0, 0]}>
        <Vox n={[5, 5, 8]} p={[0, 0.25, 0.4]} color={OR} seed={1}
          paint={(x, y, z) => ((z === 7 && y < 4 && x > 0 && x < 4) || (y === 0 && z > 3) ? CREAM : y === 4 && z % 2 ? STRIPE : null)} />
        {[-1, 1].map((k) => leg(k, false))}
        {[-1, 1].map((k) => leg(k, true))}
        <group position={[0, 0.35, 0]} rotation={[(35 * (1 - s) + 15 * s) * D, Math.sin(t * 3) * 25 * D, 0]}>
          <Vox n={[2, 2, 5]} p={[0, 0, -0.25]} color={OR} seed={6} paint={(x, y, z) => (z === 0 ? CREAM : null)} />
        </group>
        <group position={[0, 0.45, 0.85]} rotation={head}>
          <Vox n={[7, 6, 6]} p={[0, 0.2, 0]} color={OR} seed={2}
            paint={(x, y, z) => (z === 5 && y <= 2 && x >= 1 && x <= 5 ? CREAM : y === 5 && x % 2 ? STRIPE : null)} />
          {[-1, 1].map((k) => (
            <group key={k}>
              <Vox n={[2, 2, 2]} p={[k * 0.22, 0.6, -0.05]} color={OR} seed={k + 20} paint={(x, y, z) => (z === 1 && y === 0 ? '#f0b49a' : null)} />
              <B s={[0.09, 0.09, 0.09]} p={[k * 0.25, 0.74, -0.05]} color={OR} />
              <B s={[0.09, 0.12, 0.02]} p={[k * 0.15, 0.28, 0.305]} color="#141414" />
            </group>
          ))}
          <B s={[0.1, 0.06, 0.02]} p={[0, 0.15, 0.305]} color="#d9887a" />
          <B s={[0.12, 0.02 + 0.07 * mouth, 0.02]} p={[0, 0.07 - 0.035 * mouth, 0.305]} color="#2a1a14" />
        </group>
      </group>
      <Bubble t={t} spans={TALK.cat} y={1.75} x={0.1} side={-1} />
    </group>
  );
};

const Floor = () => {
  const mesh = useMemo(() => {
    const nx = 34, nz = 52, m = new THREE.InstancedMesh(TILE, new THREE.MeshStandardMaterial({roughness: 0.9}), nx * nz);
    const M = new THREE.Matrix4(), c = new THREE.Color(), pal = ['#a8743f', '#b9864c', '#94653a', '#c4955a', '#8a5b33'];
    for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
      const k = i * nz + j;
      m.setMatrixAt(k, M.makeTranslation((i - nx / 2) * 0.3, -0.03, 6 - j * 0.3));
      m.setColorAt(k, c.set(pal[Math.floor(hash(i, j, 0, 1) * pal.length)]).multiplyScalar(0.62 + hash(i, j, 1) * 0.12));
    }
    m.receiveShadow = true;
    return m;
  }, []);
  return <primitive object={mesh} />;
};

// ---- low-poly character (flat shaded, PS2-era proportions, original design) ----
const F = ({geo, p = [0, 0, 0], r = [0, 0, 0], sc = [1, 1, 1], color}) => (
  <mesh position={p} rotation={r} scale={sc} castShadow receiveShadow>
    {geo}
    <meshStandardMaterial color={color} roughness={0.75} flatShading />
  </mesh>
);
const cyl = (rt, rb, h, n = 6) => <cylinderGeometry args={[rt, rb, h, n]} />;
const SKIN = '#9a6446', HOOD = '#d9622b', HOOD2 = '#b84f22', PANTS = '#4f5140', SHOE = '#ecebe6';

const Guy = ({o, t}) => {
  const br = Math.sin(t * 2.2) * 0.008, sway = Math.sin(t * 1.1) * 2 * D;
  return (
    <group rotation={[0, (o.turn || 0) * D, 0]}>
      {[-1, 1].map((k) => (
        <group key={k}>
          <F geo={<boxGeometry args={[0.13, 0.09, 0.3]} />} p={[k * 0.11, 0.045, 0.04]} color={SHOE} />
          <F geo={<boxGeometry args={[0.135, 0.03, 0.31]} />} p={[k * 0.11, 0.015, 0.04]} color="#c9502a" />
          <F geo={cyl(0.085, 0.07, 0.46)} p={[k * 0.11, 0.32, 0]} color={PANTS} />
          <F geo={cyl(0.105, 0.088, 0.44)} p={[k * 0.11, 0.76, 0]} color={PANTS} />
          <F geo={<boxGeometry args={[0.06, 0.12, 0.09]} />} p={[k * 0.2, 0.74, 0.02]} color="#45473a" />
        </group>
      ))}
      <group position={[0, 0, 0]} rotation={[0, 0, sway]}>
        <F geo={cyl(0.2, 0.18, 0.18, 7)} p={[0, 0.98, 0]} sc={[1, 1, 0.75]} color={PANTS} />
        <F geo={cyl(0.235, 0.2, 0.56, 7)} p={[0, 1.33, 0]} sc={[1, 1 + br, 0.72]} color={HOOD} />
        <F geo={<boxGeometry args={[0.26, 0.13, 0.04]} />} p={[0, 1.17, 0.145]} color={HOOD2} />
        <F geo={<torusGeometry args={[0.12, 0.05, 5, 8]} />} p={[0, 1.6, -0.05]} r={[80 * D, 0, 0]} color={HOOD2} />
        <F geo={cyl(0.055, 0.06, 0.09)} p={[0, 1.64, 0]} color={SKIN} />
        <group position={[0, 1.79, 0.01]} rotation={[Math.sin(t * 0.8) * 2 * D, Math.sin(t * 0.6) * 6 * D, 0]}>
          <F geo={<icosahedronGeometry args={[0.13, 1]} />} sc={[0.88, 1.12, 0.95]} color={SKIN} />
          <F geo={cyl(0.095, 0.135, 0.13, 8)} p={[0, 0.1, -0.005]} color="#24262b" />
          <F geo={cyl(0.137, 0.137, 0.035, 8)} p={[0, 0.045, -0.005]} color="#33363c" />
          <F geo={<boxGeometry args={[0.03, 0.05, 0.04]} />} p={[0, -0.01, 0.125]} color="#8a573b" />
          {[-1, 1].map((k) => <F key={k} geo={<boxGeometry args={[0.035, 0.018, 0.01]} />} p={[k * 0.045, 0.025, 0.118]} color="#1a1210" />)}
          <F geo={<boxGeometry args={[0.06, 0.012, 0.01]} />} p={[0, -0.065, 0.112]} color="#5e3626" />
        </group>
        {[-1, 1].map((k) => (
          <group key={k} position={[k * 0.27, 1.52, 0]} rotation={[Math.sin(t * 1.1 + k) * 2 * D, 0, k * 9 * D]}>
            <F geo={cyl(0.07, 0.06, 0.33)} p={[0, -0.16, 0]} color={HOOD} />
            <F geo={cyl(0.06, 0.055, 0.3)} p={[0, -0.47, 0.01]} color={HOOD} />
            <F geo={<icosahedronGeometry args={[0.055, 0]} />} p={[0, -0.66, 0.02]} sc={[0.8, 1.2, 0.9]} color={SKIN} />
          </group>
        ))}
      </group>
    </group>
  );
};

export const custom = {Robot, Cat, Floor, Guy};
