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

// ---- PS1-style character: boxy head with a painted pixel face (original design) ----
const canvasTex = (w, h, draw) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'));
  const t = new THREE.CanvasTexture(cv);
  t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.colorSpace = THREE.SRGBColorSpace;
  return t;
};
const L = ({m}) => <meshLambertMaterial {...m} />;
const Limb = ({a, b, r, color}) => {
  const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  return (
    <mesh position={A.clone().add(Bv).multiplyScalar(0.5)} quaternion={q}>
      <cylinderGeometry args={[r, r * 0.9, d.length(), 5]} /><meshLambertMaterial color={color} />
    </mesh>
  );
};
const SK = '#e6b48f', COAT = '#e2b62f', HAIR = '#2a211c';

const Retro = ({o, t}) => {
  const face = useMemo(() => canvasTex(32, 32, (g) => {
    const px = (c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
    px(SK, 0, 0, 32, 32);
    px('#d99c7a', 15, 19, 2, 1);                                     // nose shade
    px('#f0a39a', 5, 18, 5, 2); px('#f0a39a', 22, 18, 5, 2);          // blush
    for (const x of [7, 21]) { px('#1d1512', x, 12, 4, 5); px('#ffffff', x + 1, 13, 1, 1); px('#5a3a2c', x, 16, 4, 1); }
    px('#3a2a22', 6, 9, 5, 1); px('#3a2a22', 11, 10, 1, 1); px('#3a2a22', 21, 9, 5, 1); px('#3a2a22', 20, 10, 1, 1); // worried brows
    px('#7a3b33', 14, 23, 4, 1); px('#5a2a24', 15, 24, 2, 1);        // small mouth
  }), []);
  const mats = useMemo(() => {
    const sk = {color: SK}, f = {map: face};
    return [sk, sk, sk, sk, f, sk].map((m) => new THREE.MeshLambertMaterial(m));
  }, [face]);
  const tilt = Math.sin(t * 0.9) * 2 * D, look = Math.sin(t * 0.5) * 4 * D;
  return (
    <group>
      {[-1, 1].map((k) => (
        <group key={k}>
          <mesh position={[k * 0.08, 0.07, 0.02]}><boxGeometry args={[0.11, 0.14, 0.2]} /><L m={{color: '#24364a'}} /></mesh>
          <Limb a={[k * 0.08, 0.13, 0]} b={[k * 0.08, 0.66, 0]} r={0.055} color="#2d3550" />
        </group>
      ))}
      <mesh position={[0, 0.93, 0]} scale={[1, 1, 0.8]}><cylinderGeometry args={[0.17, 0.23, 0.64, 6]} /><L m={{color: COAT}} /></mesh>
      {[0, 1, 2].map((i) => <mesh key={i} position={[0, 1.08 - i * 0.14, 0.15]}><boxGeometry args={[0.03, 0.03, 0.02]} /><L m={{color: '#3a3a3a'}} /></mesh>)}
      <mesh position={[0, 1.24, -0.06]}><boxGeometry args={[0.3, 0.1, 0.18]} /><L m={{color: '#c99a22'}} /></mesh>
      <Limb a={[0, 1.22, 0]} b={[0, 1.3, 0]} r={0.045} color={SK} />
      {[-1, 1].map((k) => (
        <group key={k}>
          <Limb a={[k * 0.2, 1.18, 0]} b={[k * 0.21, 0.95, 0.05]} r={0.055} color={COAT} />
          <Limb a={[k * 0.21, 0.95, 0.05]} b={[k * 0.05, 0.8, 0.16]} r={0.05} color={COAT} />
          <mesh position={[k * 0.035, 0.78, 0.17]}><boxGeometry args={[0.06, 0.07, 0.05]} /><L m={{color: SK}} /></mesh>
        </group>
      ))}
      <group position={[0, 1.42, 0]} rotation={[tilt + 4 * D, look, tilt]}>
        <mesh material={mats}><boxGeometry args={[0.23, 0.26, 0.22]} /></mesh>
        <mesh position={[0, 0.15, -0.01]}><boxGeometry args={[0.26, 0.08, 0.25]} /><L m={{color: HAIR}} /></mesh>
        <mesh position={[0, 0.02, -0.12]}><boxGeometry args={[0.26, 0.26, 0.05]} /><L m={{color: HAIR}} /></mesh>
        {[-1, 1].map((k) => <mesh key={k} position={[k * 0.125, 0.05, -0.02]}><boxGeometry args={[0.03, 0.18, 0.2]} /><L m={{color: HAIR}} /></mesh>)}
        {[[-0.07, 0.1, 6], [0, 0.085, -3], [0.07, 0.1, -8]].map(([x, y, r], i) => (
          <mesh key={i} position={[x, y, 0.112]} rotation={[0, 0, r * D]}><boxGeometry args={[0.09, 0.07, 0.03]} /><L m={{color: HAIR}} /></mesh>
        ))}
      </group>
    </group>
  );
};

// Pixel speech bubble: text drawn on a tiny canvas, shown with nearest filtering.
const Sign = ({o}) => {
  const tex = useMemo(() => canvasTex(96, 64, (g) => {
    g.fillStyle = '#000'; g.beginPath(); g.roundRect(1, 1, 86, 50, 10); g.fill();
    g.fillStyle = '#efece4'; g.beginPath(); g.roundRect(2, 2, 84, 48, 9); g.fill();
    g.beginPath(); g.moveTo(14, 49); g.lineTo(4, 62); g.lineTo(26, 49); g.fill();
    g.fillStyle = '#111'; g.font = 'bold 12px monospace'; g.textAlign = 'center';
    (o.lines || ['...']).forEach((l, i, a) => g.fillText(l, 44, 30 - (a.length - 1) * 7 + i * 14));
  }), []);
  return (
    <mesh scale={o.w || 0.75} >
      <planeGeometry args={[1, 64 / 96]} />
      <meshBasicMaterial map={tex} transparent alphaTest={0.5} />
    </mesh>
  );
};

// ---- configurable character -----------------------------------------------
// o: head 'box'|'round', hs (head scale), face 'ps1'|'mii'|'old'|'kid', hair 'long'|'bun'|'short'|'cap',
//    skin, hairC, top, topStyle 'hoodie'|'cardigan'|'polo'|'tee', inner, bottom, bottomStyle 'pants'|'skirt'|'shorts',
//    shoes, glasses, mustache, arms 'down'|'front', segs (polygon sides), noisy (pixel noise on cloth), smooth (soft face texture)
const noiseTex = (color, n = 16) => canvasTex(n, n, (g) => {
  const c = new THREE.Color(), b = new THREE.Color(color);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { g.fillStyle = c.copy(b).multiplyScalar(0.86 + hash(x, y, 3) * 0.24).getStyle(); g.fillRect(x, y, 1, 1); }
});
const drawFace = (g, kind, ox, oy, skin, o) => {
  const px = (c, x, y, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(ox + x, oy + y, w, h); };
  if (kind === 'mii') {
    for (const x of [9, 21]) { px('#2a2420', x, 13, 2, 4); px('#2a2420', x - 1, 9, 4, 1); px('#2a2420', x - 2, 10, 1, 1); }
    px('#e29a8c', 5, 18, 4, 2); px('#e29a8c', 23, 18, 4, 2);
    px('#c97a64', 15, 18, 2, 2);
    px('#b0443c', 12, 22, 8, 1); px('#b0443c', 11, 21, 1, 1); px('#b0443c', 20, 21, 1, 1); px('#ffffff', 13, 23, 6, 1); px('#b0443c', 13, 24, 6, 1);
  } else if (kind === 'old') {
    for (const x of [8, 20]) { px('#2a201c', x, 14, 4, 2); px('#ffffff', x + 1, 14, 1, 1); px('#9a9590', x - 1, 10, 6, 2); px('#c48f74', x, 17, 4, 1); }
    px('#c48f74', 15, 16, 2, 4); px('#d89a8a', 5, 19, 4, 2); px('#d89a8a', 23, 19, 4, 2);
    px('#8a3e40', 13, 23, 6, 1); px('#c48f74', 9, 22, 1, 3); px('#c48f74', 22, 22, 1, 3);
  } else if (kind === 'kid') {
    for (const x of [7, 19]) { px('#1b1b28', x, 11, 6, 7); px('#ffffff', x + 1, 12, 2, 2); px('#ffffff', x + 4, 16, 1, 1); px('#3d6cc4', x + 1, 15, 4, 2); }
    px('#ff8f8f', 4, 19, 4, 2); px('#ff8f8f', 24, 19, 4, 2);
    px('#6b2a2a', 13, 22, 6, 3); px('#e66b6b', 14, 24, 4, 1);
  } else {
    for (const x of [7, 21]) { px('#1d1512', x, 12, 4, 5); px('#ffffff', x + 1, 13, 1, 1); px('#5a3a2c', x, 16, 4, 1); px('#2a1d18', x - 1, 9, 6, 1); }
    px('#d99c7a', 15, 19, 2, 1); px('#7a3b33', 14, 23, 4, 1);
    if (o.lips) px(o.lips, 13, 23, 6, 2);
  }
  if (o.mustache) { px(o.hairC, 11, 20, 10, 2); px(o.hairC, 10, 21, 1, 2); px(o.hairC, 21, 21, 1, 2); }
};

const Pers = ({o, t}) => {
  const segs = o.segs ?? 6, hs = o.hs ?? 1, round = o.head === 'round', sk = o.skin || '#e6b48f', hc = o.hairC || '#2a211c';
  const mat = useMemo(() => {
    const m = (color, noisy = o.noisy) => (o.lambert === false
      ? new THREE.MeshStandardMaterial({color, roughness: 0.65})
      : new THREE.MeshLambertMaterial(noisy ? {map: noiseTex(color)} : {color}));
    const face = canvasTex(round ? 128 : 32, round ? 64 : 32, (g) => { g.fillStyle = sk; g.fillRect(0, 0, 999, 999); drawFace(g, o.face || 'ps1', round ? 16 : 0, round ? 16 : 0, sk, o); });
    if (o.smooth) { face.magFilter = face.minFilter = THREE.LinearFilter; }
    const fm = o.lambert === false ? new THREE.MeshStandardMaterial({map: face, roughness: 0.6}) : new THREE.MeshLambertMaterial({map: face});
    return {skin: m(sk, false), hair: m(hc), top: m(o.top || '#888'), inner: m(o.inner || '#eee'), bottom: m(o.bottom || '#334'), shoes: m(o.shoes || '#222', false), face: fm, dark: m('#151515', false)};
  }, []);
  const Mx = ({p, r = [0, 0, 0], sc = [1, 1, 1], m, children}) => <mesh position={p} rotation={r} scale={sc} material={m} castShadow>{children}</mesh>;
  const Lb = ({a, b, r, m}) => {
    const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
    return <mesh position={A.clone().add(Bv).multiplyScalar(0.5)} quaternion={q} material={m} castShadow><cylinderGeometry args={[r, r * 0.9, d.length(), segs]} /></mesh>;
  };
  const skirt = o.bottomStyle === 'skirt', shorts = o.bottomStyle === 'shorts';
  const H = 0.13 * hs, hy = 1.3 + H * 0.95, br = Math.sin(t * 2) * 0.006;
  const front = o.arms === 'front';
  const tilt = [Math.sin(t * 0.9) * 2 * D + (o.headPitch || 0) * D, (o.headYaw || 0) * D + Math.sin(t * 0.5) * 3 * D, Math.sin(t * 0.7) * 2 * D];
  return (
    <group>
      {[-1, 1].map((k) => (
        <group key={k}>
          <Mx p={[k * 0.08, 0.05, 0.03]} m={mat.shoes}><boxGeometry args={[0.1, 0.1, 0.19]} /></Mx>
          {shorts ? <>
            <Lb a={[k * 0.08, 0.1, 0]} b={[k * 0.08, 0.45, 0]} r={0.045} m={mat.skin} />
            <Lb a={[k * 0.08, 0.42, 0]} b={[k * 0.08, 0.66, 0]} r={0.07} m={mat.bottom} />
          </> : <Lb a={[k * 0.08, 0.1, 0]} b={[k * 0.08, 0.66, 0]} r={skirt ? 0.042 : 0.055} m={skirt ? mat.dark : mat.bottom} />}
        </group>
      ))}
      {skirt && <Mx p={[0, 0.6, 0]} m={mat.bottom}><cylinderGeometry args={[0.16, 0.25, 0.26, segs + 2]} /></Mx>}
      <Mx p={[0, 0.94, 0]} sc={[1, 1 + br, 0.78]} m={mat.top}><cylinderGeometry args={[0.165, 0.19, 0.58, segs]} /></Mx>
      {o.topStyle === 'cardigan' && <Mx p={[0, 0.98, 0.115]} m={mat.inner}><boxGeometry args={[0.1, 0.48, 0.04]} /></Mx>}
      {o.topStyle === 'polo' && <Mx p={[0, 1.22, 0.02]} m={mat.inner}><boxGeometry args={[0.2, 0.05, 0.18]} /></Mx>}
      {o.topStyle === 'hoodie' && <Mx p={[0, 1.2, -0.08]} m={mat.top}><boxGeometry args={[0.26, 0.1, 0.12]} /></Mx>}
      {o.backpack && <Mx p={[0, 0.98, -0.18]} m={mat.inner}><boxGeometry args={[0.26, 0.32, 0.12]} /></Mx>}
      <Lb a={[0, 1.2, 0]} b={[0, 1.3, 0]} r={0.042} m={mat.skin} />
      {[-1, 1].map((k) => {
        const sh = [k * 0.2, 1.17, 0], el = front ? [k * 0.21, 0.94, 0.05] : [k * 0.23, 0.92, -0.01], ha = front ? [k * 0.05, 0.8, 0.16] : [k * 0.24, 0.7, 0.01];
        return (
          <group key={k}>
            <Lb a={sh} b={el} r={0.05} m={mat.top} />
            <Lb a={el} b={ha} r={0.045} m={o.topStyle === 'polo' || o.topStyle === 'tee' ? mat.skin : mat.top} />
            <Mx p={[ha[0], ha[1] - 0.03, ha[2]]} m={mat.skin}>{round ? <sphereGeometry args={[0.04, 10, 8]} /> : <boxGeometry args={[0.06, 0.07, 0.05]} />}</Mx>
          </group>
        );
      })}
      <group position={[0, hy, 0]} rotation={tilt}>
        {round
          ? <Mx p={[0, 0, 0]} sc={[1, 1.08, 1]} m={mat.face}><sphereGeometry args={[H, 32, 24]} /></Mx>
          : <Mx p={[0, 0, 0]} m={[mat.skin, mat.skin, mat.skin, mat.skin, mat.face, mat.skin]}><boxGeometry args={[H * 1.75, H * 2, H * 1.7]} /></Mx>}
        {round ? <>
          {o.hair !== 'none' && <Mx p={[0, H * 0.12, -H * 0.06]} r={[-14 * D, 0, 0]} sc={[1.07, 1.1, 1.08]} m={mat.hair}><sphereGeometry args={[H, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42]} /></Mx>}
          {o.hair === 'cap' && <Mx p={[0, H * 0.62, H * 0.75]} r={[8 * D, 0, 0]} m={mat.hair}><boxGeometry args={[H * 1.3, H * 0.08, H * 0.9]} /></Mx>}
          {o.hair === 'long' && <Mx p={[0, -H * 0.5, -H * 0.55]} m={mat.hair}><boxGeometry args={[H * 2, H * 2.2, H * 0.4]} /></Mx>}
          {o.hair === 'bun' && <Mx p={[0, H * 1.1, -H * 0.35]} m={mat.hair}><sphereGeometry args={[H * 0.42, 16, 12]} /></Mx>}
          {[-1, 1].map((k) => <Mx key={k} p={[k * H * 1.02, -H * 0.05, 0]} sc={[0.5, 1, 0.8]} m={mat.skin}><sphereGeometry args={[H * 0.25, 10, 8]} /></Mx>)}
        </> : <>
          <Mx p={[0, H * 1.12, -H * 0.05]} m={mat.hair}><boxGeometry args={[H * 1.9, H * 0.42, H * 1.85]} /></Mx>
          <Mx p={[0, o.hair === 'long' ? -H * 0.6 : H * 0.2, -H * 0.92]} m={mat.hair}><boxGeometry args={[H * 1.92, o.hair === 'long' ? H * 3.3 : H * 1.6, H * 0.25]} /></Mx>
          {[-1, 1].map((k) => <Mx key={k} p={[k * H * 0.95, o.hair === 'long' ? -H * 0.5 : H * 0.35, -H * 0.1]} m={mat.hair}><boxGeometry args={[H * 0.22, o.hair === 'long' ? H * 3.1 : H * 1.3, H * 1.65]} /></Mx>)}
          {o.hair === 'long' && <Mx p={[0, H * 0.78, H * 0.88]} m={mat.hair}><boxGeometry args={[H * 1.85, H * 0.42, H * 0.12]} /></Mx>}
          {o.hair === 'bun' && <Mx p={[0, H * 1.55, -H * 0.5]} m={mat.hair}><boxGeometry args={[H * 0.8, H * 0.7, H * 0.8]} /></Mx>}
          {o.hair === 'cap' && <Mx p={[0, H * 1.0, H * 1.2]} m={mat.inner}><boxGeometry args={[H * 1.7, H * 0.1, H * 0.9]} /></Mx>}
        </>}
        {o.glasses && [-1, 1].map((k) => (
          <Mx key={k} p={[k * H * 0.42, H * (round ? 0.12 : 0.1), H * (round ? 1.02 : 0.88)]} m={mat.dark}><torusGeometry args={[H * 0.3, H * 0.05, 4, 8]} /></Mx>
        ))}
      </group>
    </group>
  );
};

export const custom = {Robot, Cat, Floor, Guy, Retro, Sign, Pers};
