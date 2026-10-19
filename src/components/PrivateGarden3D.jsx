import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { fetchPrivateWishes } from '../api.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import confetti from 'canvas-confetti';
import PrivateGarden2D from '../components/PrivateGarden2D.jsx';

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const mergeGeos = BufferGeometryUtils.mergeGeometries;

const rngFactory = (seed) => {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const noise2 = (x, z) => Math.sin(x * 0.21 + 1.3) * Math.cos(z * 0.19 - 0.7) + 0.5 * Math.sin((x + z) * 0.11 + 2.0);
const normAngle = (a) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};

// Vị trí camera: rel = tính theo hệ toạ độ của xe (z+ là phía trước xe)
const PRESETS = {
  chase: { rel: true, cam: [4.6, 2.9, -9.5], tgt: [0, 1.5, 2.5] },
  close: { rel: true, cam: [3.8, 1.6, -4.8], tgt: [0, 1.3, 0.2] },
  side: { rel: true, cam: [8.8, 2.1, 0.6], tgt: [0, 1.3, 0.2] },
  top: { rel: true, cam: [0, 16, -6], tgt: [0, 0, 1.5] },
  scenic: { rel: false, cam: [0, 50, 82], tgt: [0, 0, 4] }
};

function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(255,255,255,0.35)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner);
  gr.addColorStop(0.35, mid);
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function petalTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.translate(32, 32);
  g.rotate(-0.6);
  const gr = g.createRadialGradient(0, 0, 2, 0, 0, 26);
  gr.addColorStop(0, '#fff1f5');
  gr.addColorStop(0.6, '#f9a8c4');
  gr.addColorStop(1, 'rgba(249,168,196,0)');
  g.fillStyle = gr;
  g.beginPath();
  g.ellipse(0, 0, 24, 13, 0, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const g = c.getContext('2d');
  const rnd = rngFactory(77);
  for (let i = 0; i < 16; i++) {
    const x = 30 + rnd() * 196;
    const y = 30 + rnd() * 36;
    const r = 22 + rnd() * 30;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 96);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture(text) {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 160;
  const g = c.getContext('2d');
  g.fillStyle = '#7a1f3d';
  g.beginPath();
  g.roundRect ? g.roundRect(6, 6, 628, 148, 28) : g.rect(6, 6, 628, 148);
  g.fill();
  g.strokeStyle = '#e8c27a';
  g.lineWidth = 6;
  g.stroke();
  g.strokeStyle = 'rgba(232,194,122,0.55)';
  g.lineWidth = 2;
  g.strokeRect(22, 22, 596, 116);
  g.fillStyle = '#f4d58d';
  g.font = 'italic 600 58px Georgia, "Times New Roman", serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 320, 84);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function paint(geo, color, shade = 1) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r * shade;
    arr[i * 3 + 1] = c.g * shade;
    arr[i * 3 + 2] = c.b * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// Một cánh hoa: ellipsoid dẹt, gốc ở trục, nghiêng ra ngoài
function petal({ sx, sy, sz, tilt, yaw, r, y, color, shade }) {
  const g = new THREE.SphereGeometry(1, 6, 4);
  g.scale(sx, sy, sz);
  g.translate(0, sy * 0.9, 0);
  g.rotateX(tilt);
  g.translate(0, 0, r);
  g.rotateY(yaw);
  g.translate(0, y, 0);
  return paint(g, color, shade);
}

function makeRoseHead() {
  const parts = [];
  const rings = [
    [4, 0.018, 0.1, 0.034, 0.06, 0.0, 0.6],
    [5, 0.04, 0.32, 0.05, 0.07, -0.004, 0.75],
    [6, 0.068, 0.58, 0.062, 0.074, -0.014, 0.88],
    [7, 0.096, 0.88, 0.066, 0.07, -0.03, 1.0]
  ];
  rings.forEach(([n, r, tilt, sx, sy, y, sh], ri) => {
    for (let i = 0; i < n; i++) {
      parts.push(petal({ sx, sy, sz: 0.016, tilt, yaw: (i / n) * Math.PI * 2 + ri * 0.45, r, y, color: 0xffffff, shade: sh }));
    }
  });
  const bud = new THREE.SphereGeometry(0.03, 6, 4);
  bud.translate(0, 0.03, 0);
  parts.push(paint(bud, 0xffffff, 0.5));
  return mergeGeos(parts);
}

function makeTulipHead() {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    parts.push(petal({ sx: 0.036, sy: 0.085, sz: 0.017, tilt: 0.2, yaw: (i / 3) * Math.PI * 2, r: 0.024, y: 0, color: 0xffffff, shade: 0.95 }));
    parts.push(petal({ sx: 0.034, sy: 0.078, sz: 0.016, tilt: 0.1, yaw: (i / 3) * Math.PI * 2 + Math.PI / 3, r: 0.018, y: 0.005, color: 0xffffff, shade: 0.8 }));
  }
  return mergeGeos(parts);
}

function makeDaisyHead() {
  const parts = [];
  const n = 13;
  for (let i = 0; i < n; i++) {
    const g = new THREE.SphereGeometry(1, 5, 3);
    g.scale(0.017, 0.0035, 0.075);
    g.translate(0, 0, 0.085);
    g.rotateX(-0.14);
    g.rotateY((i / n) * Math.PI * 2);
    parts.push(paint(g, 0xffffff, 0.98));
  }
  const center = new THREE.SphereGeometry(0.036, 7, 5);
  center.scale(1, 0.55, 1);
  center.translate(0, 0.008, 0);
  parts.push(paint(center, 0xf4b400, 1));
  return mergeGeos(parts);
}

function makeLavenderHead() {
  const parts = [];
  const n = 22;
  const a = new THREE.Color(0x7c3aed);
  const b = new THREE.Color(0xc4b5fd);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const rad = 0.05 * (1 - t * 0.75);
    const ang = i * 2.4;
    const g = new THREE.SphereGeometry(0.022 * (1 - t * 0.4), 5, 4);
    g.translate(Math.cos(ang) * rad, 0.02 + t * 0.26, Math.sin(ang) * rad);
    parts.push(paint(g, a.clone().lerp(b, t), 1));
  }
  return mergeGeos(parts);
}

function makeStem(h, leaves = true) {
  const parts = [];
  const s = new THREE.CylinderGeometry(0.007, 0.011, h, 5);
  s.translate(0, h / 2, 0);
  parts.push(paint(s, 0x2f6d2b, 1));
  const cal = new THREE.ConeGeometry(0.02, 0.05, 6);
  cal.translate(0, h - 0.01, 0);
  parts.push(paint(cal, 0x3b7d33, 1));
  if (leaves) {
    for (let i = 0; i < 3; i++) {
      parts.push(
        petal({ sx: 0.03, sy: 0.15, sz: 0.007, tilt: 0.9 + i * 0.1, yaw: i * 2.1 + 0.5, r: 0.0, y: h * (0.18 + i * 0.16), color: 0x3f8a36, shade: 0.9 })
      );
    }
  }
  return mergeGeos(parts);
}

function makeBlade() {
  const g = new THREE.PlaneGeometry(1, 1, 1, 3);
  const p = g.attributes.position;
  const cols = new Float32Array(p.count * 3);
  const root = new THREE.Color(0x163a17);
  const tip = new THREE.Color(0xa8d860);
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + 0.5;
    const x = p.getX(i);
    p.setXYZ(i, x * 0.09 * (1 - 0.9 * y), y * 0.6, y * y * 0.12);
    c.copy(root).lerp(tip, y);
    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  return g;
}

function windify(mat, timeU, amp) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeU;
    shader.uniforms.uAmp = { value: amp };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uAmp;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 iP = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
        #else
          vec3 iP = vec3(0.0);
        #endif
        float sw = pow(max(position.y, 0.0), 1.5) * uAmp;
        transformed.x += sin(uTime * 1.6 + iP.x * 0.35 + iP.z * 0.27) * sw;
        transformed.z += cos(uTime * 1.2 + iP.z * 0.31 + iP.x * 0.22) * sw * 0.7;`
      );
  };
  return mat;
}

function taperedTube(curve, tubular, r0, r1, radial) {
  const g = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const pos = g.attributes.position;
  for (let j = 0; j <= tubular; j++) {
    const u = j / tubular;
    const c = curve.getPointAt(u);
    const r = r0 + (r1 - r0) * u;
    for (let k = 0; k <= radial; k++) {
      const i = j * (radial + 1) + k;
      pos.setXYZ(i, c.x + (pos.getX(i) - c.x) * r, c.y + (pos.getY(i) - c.y) * r, c.z + (pos.getZ(i) - c.z) * r);
    }
  }
  g.computeVertexNormals();
  return g;
}

function makeHeartGeometry(depth = 0.2, bevel = 0.07) {
  const pts = [];
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    pts.push(
      new THREE.Vector2(
        (16 * Math.pow(Math.sin(t), 3)) / 32,
        (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 32
      )
    );
  }
  const shape = new THREE.Shape(pts);
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 6,
    curveSegments: 20
  });
  g.center();
  return g;
}

/* ------------------------------------------------------------------ */
/*  Component 3D Cinematic                                             */
/* ------------------------------------------------------------------ */
function PrivateGarden3D() {
  const { selectedSister, navigateWithFlowerTransition, updateExperienceMode } = useApp();
  const sisterName = selectedSister ? selectedSister.name : 'Chị Lan Anh';

  const containerRef = useRef(null);
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const vanStateRef = useRef({ pos: new THREE.Vector3(), yaw: 0 });
  const transRef = useRef(null);
  const followRef = useRef(true);

  const [autoRotate, setAutoRotate] = useState(false);
  const autoRotateRef = useRef(false);
  autoRotateRef.current = autoRotate;

  const [messages, setMessages] = useState([]);
  const messagesRef = useRef([]);
  messagesRef.current = messages;

  const [activeFilter, setActiveFilter] = useState('all');
  const [isMailboxOpen, setIsMailboxOpen] = useState(false);
  const [readingMessage, setReadingMessage] = useState(null);
  const [hasClickedCart, setHasClickedCart] = useState(false);
  const [activeCamPreset, setActiveCamPreset] = useState('chase');

  // 1. Tải danh sách thư riêng
  useEffect(() => {
    async function loadPrivate() {
      const sisterId = selectedSister ? selectedSister.id : '';
      const sisterNameParam = selectedSister ? selectedSister.name : '';
      const res = await fetchPrivateWishes(sisterId, sisterNameParam);
      if (res.success && Array.isArray(res.data)) {
        setMessages(res.data);
      }
    }
    loadPrivate();
  }, [selectedSister]);

  // 2. Chuyển góc camera (mượt, bám theo xe)
  const setCameraPreset = (name) => {
    setActiveCamPreset(name);
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;
    followRef.current = false;
    transRef.current = {
      t0: performance.now(),
      dur: 1300,
      fromCam: cam.position.clone(),
      fromTgt: ctrl.target.clone(),
      preset: PRESETS[name]
    };
  };

  // 3. Thế giới 3D
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const lowPower = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    const Q = lowPower ? 0.5 : 1;
    const rand = rngFactory(20102010);
    const timeU = { value: 0 };

    const width = container.clientWidth || window.innerWidth || 1200;
    const height = container.clientHeight || window.innerHeight || 800;

    /* ---------- Renderer / Scene / Camera ---------- */
    const renderer = new THREE.WebGLRenderer({ antialias: !lowPower, powerPreference: 'high-performance' });
    const pr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const FOG_COLOR = 0xe6a08f;
    scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0095);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1500);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 2.5;
    controls.maxDistance = 140;
    controls.minPolarAngle = Math.PI / 14;
    controls.maxPolarAngle = Math.PI / 2 - 0.06;
    controlsRef.current = controls;

    /* ---------- Sky + reflections ---------- */
    const sunDir = new THREE.Vector3(-0.6, 0.26, -0.75).normalize();
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(0x2a1650) },
        mid: { value: new THREE.Color(0xb85c8a) },
        hor: { value: new THREE.Color(0xffb48a) },
        sunDir: { value: sunDir }
      },
      vertexShader: `varying vec3 vDir;
        void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunDir; varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir); float h = d.y;
          vec3 col = mix(hor, mid, smoothstep(0.0, 0.28, h));
          col = mix(col, top, smoothstep(0.2, 0.85, h));
          col = mix(hor * 0.75, col, smoothstep(-0.2, 0.02, h));
          float s = max(dot(d, sunDir), 0.0);
          col += vec3(1.0, 0.72, 0.45) * pow(s, 8.0) * 0.45;
          col += vec3(1.0, 0.86, 0.62) * pow(s, 220.0) * 3.0;
          gl_FragColor = vec4(col, 1.0);
        }`
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(700, 32, 16), skyMat);
    sky.renderOrder = -10;
    sky.frustumCulled = false;
    scene.add(sky);

    const cloudTex = cloudTexture();
    for (let i = 0; i < 14; i++) {
      const sm = new THREE.SpriteMaterial({ map: cloudTex, color: 0xffc6b4, transparent: true, opacity: 0.32, depthWrite: false, depthTest: false, fog: false });
      const sp = new THREE.Sprite(sm);
      const a = rand() * Math.PI * 2;
      const el = 0.12 + rand() * 0.22;
      sp.position.set(Math.cos(a) * Math.cos(el) * 480, Math.sin(el) * 480, Math.sin(a) * Math.cos(el) * 480);
      sp.scale.set(240 + rand() * 160, 60 + rand() * 40, 1);
      sp.renderOrder = -9;
      sky.add(sp);
    }

    // Môi trường phản chiếu từ chính bầu trời hoàng hôn (để kim loại/sơn xe ánh lên thật)
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const envSky = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), skyMat.clone());
    envScene.add(envSky);
    const envRT = pmrem.fromScene(envScene, 0.02);
    const envTex = envRT.texture;

    /* ---------- Lights ---------- */
    scene.add(new THREE.HemisphereLight(0xffb7c5, 0x2a3a22, 0.95));
    const sun = new THREE.DirectionalLight(0xffc890, 2.7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(lowPower ? 1024 : 2048, lowPower ? 1024 : 2048);
    sun.shadow.camera.left = -14;
    sun.shadow.camera.right = 14;
    sun.shadow.camera.top = 14;
    sun.shadow.camera.bottom = -14;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 140;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    scene.add(sun);
    scene.add(sun.target);
    const fill = new THREE.DirectionalLight(0x8a6cff, 0.4);
    fill.position.set(40, 20, 50);
    scene.add(fill);

    /* ---------- Đường vòng (CatmullRom) ---------- */
    const loopPts = [];
    const NPTS = 22;
    for (let k = 0; k < NPTS; k++) {
      const a = (k / NPTS) * Math.PI * 2;
      const r = 44 + 6 * Math.sin(3 * a + 1.0) + 3.5 * Math.sin(5 * a + 0.4);
      loopPts.push(new THREE.Vector3(Math.cos(a) * r * 1.2, 0, Math.sin(a) * r));
    }
    const curve = new THREE.CatmullRomCurve3(loopPts, true, 'centripetal');
    const curveLen = curve.getLength();
    const SAMPLES = 360;
    const samplePts = curve.getSpacedPoints(SAMPLES);
    const sx = new Float32Array(SAMPLES);
    const sz = new Float32Array(SAMPLES);
    for (let i = 0; i < SAMPLES; i++) {
      sx[i] = samplePts[i].x;
      sz[i] = samplePts[i].z;
    }
    const distToPath = (x, z) => {
      let best = 1e9;
      for (let i = 0; i < SAMPLES; i++) {
        const dx = x - sx[i];
        const dz = z - sz[i];
        const d2 = dx * dx + dz * dz;
        if (d2 < best) best = d2;
      }
      return Math.sqrt(best);
    };
    const heightAt = (x, z, dIn) => {
      const d = dIn === undefined ? distToPath(x, z) : dIn;
      const e = smooth(2.7, 10, d);
      const far = smooth(14, 48, d);
      return e * (0.55 + 0.45 * Math.sin(x * 0.13) * Math.cos(z * 0.11)) * 1.3 + far * 5.5 + 0.28 * noise2(x * 1.7, z * 1.7) * smooth(3.5, 9, d);
    };
    const tmpV = new THREE.Vector3();
    const scatter = (count, latMin, latMax, pw) => {
      const out = [];
      let guard = 0;
      while (out.length < count && guard++ < count * 6) {
        const idx = Math.floor(rand() * SAMPLES);
        const p = samplePts[idx];
        const q = samplePts[idx + 1];
        tmpV.set(q.x - p.x, 0, q.z - p.z).normalize();
        const lx = tmpV.z;
        const lz = -tmpV.x;
        const lat = (latMin + Math.pow(rand(), pw) * (latMax - latMin)) * (rand() < 0.5 ? -1 : 1);
        const x = p.x + lx * lat + (rand() - 0.5) * 0.6;
        const z = p.z + lz * lat + (rand() - 0.5) * 0.6;
        const d = distToPath(x, z);
        if (d < latMin * 0.92) continue;
        out.push({ x, z, d, y: heightAt(x, z, d) });
      }
      return out;
    };

    // Hàm rải hoa toàn cảnh khắp núi đồi đến chân trời
    const scatterLandscape = (count, minDistFromRoad = 2.4, maxExtent = 115) => {
      const out = [];
      let guard = 0;
      while (out.length < count && guard++ < count * 8) {
        const x = (rand() - 0.5) * 2 * maxExtent;
        const z = (rand() - 0.5) * 2 * maxExtent;
        const d = distToPath(x, z);
        if (d < minDistFromRoad) continue;
        out.push({ x, z, d, y: heightAt(x, z, d) });
      }
      return out;
    };

    /* ---------- Mặt đất đồi cỏ ---------- */
    const groundGeo = new THREE.PlaneGeometry(240, 240, lowPower ? 120 : 190, lowPower ? 120 : 190);
    groundGeo.rotateX(-Math.PI / 2);
    {
      const pos = groundGeo.attributes.position;
      const cols = new Float32Array(pos.count * 3);
      const cA = new THREE.Color(0x1f4a24);
      const cB = new THREE.Color(0x4b8a34);
      const cC = new THREE.Color(0x86a23d);
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const d = distToPath(x, z);
        pos.setY(i, heightAt(x, z, d));
        const n = noise2(x * 0.5, z * 0.5) * 0.33 + 0.5;
        c.copy(cA).lerp(cB, Math.min(1, Math.max(0, n)));
        c.lerp(cC, smooth(0.75, 1.1, noise2(x * 0.13 + 4, z * 0.13)) * 0.45);
        cols[i * 3] = c.r;
        cols[i * 3 + 1] = c.g;
        cols[i * 3 + 2] = c.b;
      }
      groundGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
      groundGeo.computeVertexNormals();
    }
    const groundMesh = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    /* ---------- Con đường cỏ xanh có hai vệt bánh xe ---------- */
    {
      const RS = 700;
      const HW = 2.2;
      const LAT = 13;
      const positions = [];
      const colors = [];
      const idxs = [];
      const cGrass = new THREE.Color(0x58953a);
      const cGrass2 = new THREE.Color(0x4a8532);
      const cRut = new THREE.Color(0x77633f);
      const cEdge = new THREE.Color(0x2f5f26);
      const c = new THREE.Color();
      for (let i = 0; i <= RS; i++) {
        const u = (i % RS) / RS;
        const p = curve.getPointAt(u);
        const T = curve.getTangentAt(u);
        const lx = T.z;
        const lz = -T.x;
        const ln = Math.hypot(lx, lz);
        for (let k = 0; k < LAT; k++) {
          const w = -HW + (k / (LAT - 1)) * HW * 2;
          const aw = Math.abs(w);
          positions.push(p.x + (lx / ln) * w, 0.035 + 0.01 * Math.sin(i * 0.7 + k), p.z + (lz / ln) * w);
          c.copy(cGrass).lerp(cGrass2, 0.5 + 0.5 * Math.sin(i * 0.21 + k * 1.7));
          const rut = Math.exp(-Math.pow((aw - 0.85) / 0.22, 2));
          c.lerp(cRut, rut * 0.55);
          c.lerp(cEdge, smooth(1.5, HW, aw));
          colors.push(c.r, c.g, c.b);
        }
      }
      for (let i = 0; i < RS; i++) {
        for (let k = 0; k < LAT - 1; k++) {
          const a = i * LAT + k;
          const b = a + 1;
          const c1 = a + LAT;
          const d = c1 + 1;
          idxs.push(a, c1, b, b, c1, d);
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      g.setIndex(idxs);
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
      m.receiveShadow = true;
      scene.add(m);
    }

    /* ---------- Cỏ (Dịu nhẹ làm nền) ---------- */
    const bladeGeo = makeBlade();
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    {
      const GN = Math.floor(13000 * Q); // Giảm cỏ để nhường chỗ cho hoa
      const pts = scatter(GN, 2.0, 30, 1.4);
      const mat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), timeU, 0.3);
      const grass = new THREE.InstancedMesh(bladeGeo, mat, pts.length);
      pts.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set((rand() - 0.5) * 0.25, rand() * Math.PI * 2, 0);
        const h = 0.65 + rand() * 0.9;
        dummy.scale.set(0.85 + rand() * 0.5, h, 1);
        dummy.updateMatrix();
        grass.setMatrixAt(i, dummy.matrix);
        tint.setRGB(0.75 + rand() * 0.4, 0.85 + rand() * 0.3, 0.65 + rand() * 0.25);
        grass.setColorAt(i, tint);
      });
      grass.frustumCulled = false;
      scene.add(grass);
    }

    /* ---------- Vườn hoa thật: hồng, tulip, cúc, oải hương phủ khắp thế giới ---------- */
    const roseHeadBase = makeRoseHead();
    const species = [
      {
        count: 4000,
        stemH: 0.72,
        head: roseHeadBase.clone(),
        leaves: true,
        tint: true,
        pal: [0xe11d48, 0xfb7185, 0xfda4af, 0xfff1f2, 0xbe123c, 0xf9a8d4, 0xff2442],
        sc: [1.3, 2.1]
      },
      {
        count: 4000,
        stemH: 0.64,
        head: makeTulipHead(),
        leaves: true,
        tint: true,
        pal: [0xf43f5e, 0xfbbf24, 0xfde68a, 0xf97316, 0xfb7185, 0xe879f9, 0xfacc15],
        sc: [1.4, 2.2]
      },
      { 
        count: 5000, 
        stemH: 0.52, 
        head: makeDaisyHead(), 
        leaves: false, 
        tint: false, 
        pal: null, 
        sc: [1.2, 2.0] 
      },
      {
        count: 4000,
        stemH: 0.98,
        head: makeLavenderHead(),
        leaves: true,
        tint: true,
        pal: [0xffffff, 0xf5d0fe, 0xc7d2fe, 0xddd6fe, 0x8b5cf6, 0xa855f7],
        sc: [1.3, 2.2]
      }
    ];

    species.forEach((sp, si) => {
      const nTotal = Math.floor(sp.count * Q);
      const nNear = Math.floor(nTotal * 0.3);
      const nFar = nTotal - nNear;
      const ptsNear = scatter(nNear, 2.0, 26, 1.2);
      const ptsFar = scatterLandscape(nFar, 2.4, 115);
      const pts = ptsNear.concat(ptsFar);

      const stemGeo = makeStem(sp.stemH, sp.leaves);
      sp.head.translate(0, sp.stemH, 0);
      const stemMat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), timeU, 0.2);
      const headMat = windify(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide }), timeU, 0.2);
      const stems = new THREE.InstancedMesh(stemGeo, stemMat, pts.length);
      const heads = new THREE.InstancedMesh(sp.head, headMat, pts.length);
      pts.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z);
        dummy.rotation.set((rand() - 0.5) * 0.35, rand() * Math.PI * 2, (rand() - 0.5) * 0.35);
        const distScale = p.d > 22 ? 1.35 : 1.0;
        const s = (sp.sc[0] + rand() * (sp.sc[1] - sp.sc[0])) * distScale;
        dummy.scale.setScalar(s);
        dummy.updateMatrix();
        stems.setMatrixAt(i, dummy.matrix);
        heads.setMatrixAt(i, dummy.matrix);
        if (sp.tint) {
          // Màu theo từng khóm (patch) cho giống đồng hoa thật
          const nv = (noise2(p.x * 0.9 + si * 7, p.z * 0.9) / 1.5 + 1) / 2;
          let ci = Math.floor(nv * sp.pal.length);
          if (rand() < 0.2) ci = Math.floor(rand() * sp.pal.length);
          ci = Math.min(sp.pal.length - 1, Math.max(0, ci));
          tint.set(sp.pal[ci]);
          heads.setColorAt(i, tint);
        }
      });
      stems.frustumCulled = false;
      heads.frustumCulled = false;
      scene.add(stems);
      scene.add(heads);
    });

    /* ---------- Cây anh đào ---------- */
    const treeGroup = new THREE.Group();
    const barkMat = new THREE.MeshStandardMaterial({ color: 0x4b2f23, roughness: 1 });
    const blossomGeo = new THREE.IcosahedronGeometry(1, 1);
    const blossomMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, emissive: 0x4a1230, emissiveIntensity: 0.35 });
    const blossomPal = [0xf9a8d4, 0xfbcfe8, 0xf472b6, 0xfce7f3, 0xfdf2f8, 0xf0abfc].map((h) => new THREE.Color(h));
    const treeSpots = [];
    {
      const cand = scatter(40, 11, 28, 1.0);
      for (const c of cand) {
        if (treeSpots.length >= 9) break;
        if (treeSpots.every((t) => Math.hypot(t.x - c.x, t.z - c.z) > 11)) treeSpots.push(c);
      }
    }
    treeSpots.forEach((spot) => {
      const tree = new THREE.Group();
      const trunkCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.2, 0),
        new THREE.Vector3(0.15, 1.2, 0.05),
        new THREE.Vector3(-0.12, 2.4, 0.1),
        new THREE.Vector3(0.2, 3.4, -0.05)
      ]);
      tree.add(new THREE.Mesh(taperedTube(trunkCurve, 20, 0.42, 0.14, 7), barkMat));
      const centers = [new THREE.Vector3(0.2, 3.9, -0.05)];
      for (let b = 0; b < 6; b++) {
        const u = 0.5 + (b / 6) * 0.45;
        const st = trunkCurve.getPointAt(u);
        const a = b * 1.05 + rand();
        const len = 1.7 + rand() * 1.0;
        const end = new THREE.Vector3(st.x + Math.cos(a) * len, st.y + 0.9 + rand() * 0.8, st.z + Math.sin(a) * len);
        const mid = st.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.35, 0));
        const bc = new THREE.CatmullRomCurve3([st, mid, end]);
        tree.add(new THREE.Mesh(taperedTube(bc, 10, 0.15, 0.04, 5), barkMat));
        centers.push(end.clone().add(new THREE.Vector3(0, 0.5, 0)));
      }
      const NB = Math.floor(480 * Q);
      const canopy = new THREE.InstancedMesh(blossomGeo, blossomMat, NB);
      for (let i = 0; i < NB; i++) {
        const ctr = centers[Math.floor(rand() * centers.length)];
        const rr = 1.5 * Math.cbrt(rand());
        const th = rand() * Math.PI * 2;
        const ph = Math.acos(2 * rand() - 1);
        dummy.position.set(ctr.x + rr * Math.sin(ph) * Math.cos(th), ctr.y + rr * Math.cos(ph) * 0.8, ctr.z + rr * Math.sin(ph) * Math.sin(th));
        dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
        dummy.scale.setScalar(0.35 + rand() * 0.4);
        dummy.updateMatrix();
        canopy.setMatrixAt(i, dummy.matrix);
        canopy.setColorAt(i, blossomPal[Math.floor(rand() * blossomPal.length)]);
      }
      tree.add(canopy);
      const s = 1.6 + rand() * 0.7;
      tree.scale.setScalar(s);
      tree.rotation.y = rand() * Math.PI * 2;
      tree.position.set(spot.x, spot.y, spot.z);
      treeGroup.add(tree);
    });
    scene.add(treeGroup);

    // Cánh hoa rụng dưới gốc cây
    if (treeSpots.length) {
      const per = Math.floor(170 * Q);
      const fallenGeo = new THREE.CircleGeometry(0.1, 6);
      fallenGeo.rotateX(-Math.PI / 2);
      const fallen = new THREE.InstancedMesh(fallenGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }), per * treeSpots.length);
      let fi = 0;
      treeSpots.forEach((spot) => {
        for (let i = 0; i < per; i++) {
          const a = rand() * Math.PI * 2;
          const r = 0.6 + Math.pow(rand(), 0.7) * 5.5;
          const x = spot.x + Math.cos(a) * r;
          const z = spot.z + Math.sin(a) * r;
          dummy.position.set(x, heightAt(x, z) + 0.05, z);
          dummy.rotation.set(0, rand() * Math.PI * 2, 0);
          dummy.scale.setScalar(0.7 + rand() * 0.7);
          dummy.updateMatrix();
          fallen.setMatrixAt(fi, dummy.matrix);
          fallen.setColorAt(fi, blossomPal[Math.floor(rand() * blossomPal.length)]);
          fi++;
        }
      });
      scene.add(fallen);
    }

    /* ---------- Hàng rào gỗ + hoa hồng leo hai bên đường ---------- */
    {
      const postGeo = mergeGeos([
        paint(new THREE.CylinderGeometry(0.055, 0.07, 1.05, 6).translate(0, 0.52, 0), 0xffffff, 1),
        paint(new THREE.ConeGeometry(0.07, 0.12, 6).translate(0, 1.11, 0), 0xffffff, 1)
      ]);
      const railGeo = new THREE.BoxGeometry(1, 0.06, 0.05);
      const woodMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
      const FS = 2.6;
      const nF = Math.floor(curveLen / FS);
      const sides = [-1, 1];
      const postsBySide = sides.map(() => []);
      sides.forEach((side, si) => {
        for (let i = 0; i < nF; i++) {
          const gap = (i + si * 9) % 22 < 2;
          const u = i / nF;
          const p = curve.getPointAt(u);
          const T = curve.getTangentAt(u);
          const x = p.x + T.z * side * 3.7;
          const z = p.z - T.x * side * 3.7;
          postsBySide[si].push(gap ? null : new THREE.Vector3(x, heightAt(x, z) - 0.03, z));
        }
      });
      const allPosts = postsBySide.flat().filter(Boolean);
      const posts = new THREE.InstancedMesh(postGeo, woodMat, allPosts.length);
      allPosts.forEach((p, i) => {
        dummy.position.copy(p);
        dummy.rotation.set((rand() - 0.5) * 0.06, rand() * 3, (rand() - 0.5) * 0.06);
        dummy.scale.set(1, 0.92 + rand() * 0.18, 1);
        dummy.updateMatrix();
        posts.setMatrixAt(i, dummy.matrix);
        tint.setRGB(0.45 + rand() * 0.12, 0.33 + rand() * 0.08, 0.22 + rand() * 0.06);
        posts.setColorAt(i, tint);
      });
      scene.add(posts);

      const railList = [];
      postsBySide.forEach((arr) => {
        for (let i = 0; i < arr.length; i++) {
          const a = arr[i];
          const b = arr[(i + 1) % arr.length];
          if (!a || !b) continue;
          [0.4, 0.8].forEach((hh) => {
            const A = a.clone().add(new THREE.Vector3(0, hh, 0));
            const B = b.clone().add(new THREE.Vector3(0, hh, 0));
            railList.push([A, B]);
          });
        }
      });
      const rails = new THREE.InstancedMesh(railGeo, new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.9 }), railList.length);
      const qq = new THREE.Quaternion();
      railList.forEach(([A, B], i) => {
        const dir = B.clone().sub(A);
        const len = dir.length();
        qq.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.normalize());
        dummy.position.copy(A).add(B).multiplyScalar(0.5);
        dummy.quaternion.copy(qq);
        dummy.scale.set(len * 1.02, 1, 1);
        dummy.updateMatrix();
        rails.setMatrixAt(i, dummy.matrix);
        dummy.quaternion.identity();
      });
      scene.add(rails);

      // hoa hồng leo trên hàng rào
      const climbN = Math.floor(320 * Q);
      const climbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide });
      const climbRoses = new THREE.InstancedMesh(roseHeadBase.clone(), climbMat, climbN);
      const leafGeo = paint(new THREE.IcosahedronGeometry(0.16, 0), 0x3f8a36, 1);
      const climbLeaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), climbN * 2);
      const palR = [0xe11d48, 0xfb7185, 0xfda4af, 0xfff1f2].map((h) => new THREE.Color(h));
      for (let i = 0; i < climbN; i++) {
        const p = allPosts[Math.floor(rand() * allPosts.length)];
        dummy.position.set(p.x + (rand() - 0.5) * 1.2, p.y + 0.45 + rand() * 0.7, p.z + (rand() - 0.5) * 1.2);
        dummy.rotation.set(-Math.PI / 2 + (rand() - 0.5) * 0.8, rand() * 6, (rand() - 0.5) * 0.8);
        dummy.scale.setScalar(0.9 + rand() * 0.8);
        dummy.updateMatrix();
        climbRoses.setMatrixAt(i, dummy.matrix);
        climbRoses.setColorAt(i, palR[Math.floor(rand() * palR.length)]);
        for (let k = 0; k < 2; k++) {
          dummy.position.set(p.x + (rand() - 0.5) * 1.3, p.y + 0.3 + rand() * 0.9, p.z + (rand() - 0.5) * 1.3);
          dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
          dummy.scale.set(1 + rand(), 0.5, 1 + rand());
          dummy.updateMatrix();
          climbLeaves.setMatrixAt(i * 2 + k, dummy.matrix);
        }
      }
      scene.add(climbRoses);
      scene.add(climbLeaves);
    }

    /* ---------- Cột đèn cổ ---------- */
    const glowTex = glowTexture('rgba(255,236,190,1)', 'rgba(255,190,110,0.35)');
    {
      const postProfile = [
        [0.2, 0],
        [0.2, 0.12],
        [0.11, 0.28],
        [0.065, 0.55],
        [0.052, 2.6],
        [0.1, 2.72],
        [0.06, 2.84]
      ].map(([x, y]) => new THREE.Vector2(x, y));
      const postGeo = new THREE.LatheGeometry(postProfile, 12);
      const ironMat = new THREE.MeshStandardMaterial({ color: 0x1f2430, metalness: 0.8, roughness: 0.35, envMap: envTex, envMapIntensity: 0.8 });
      const lampGlassGeo = new THREE.CylinderGeometry(0.24, 0.16, 0.5, 6);
      const lampGlassMat = new THREE.MeshStandardMaterial({ color: 0xffe4b0, emissive: 0xffb45a, emissiveIntensity: 2.4, roughness: 0.3 });
      const capGeo = new THREE.ConeGeometry(0.3, 0.26, 6);
      const NL = 10;
      for (let i = 0; i < NL; i++) {
        const u = (i + 0.5) / NL;
        const p = curve.getPointAt(u);
        const T = curve.getTangentAt(u);
        const side = i % 2 === 0 ? 1 : -1;
        const x = p.x + T.z * side * 3.15;
        const z = p.z - T.x * side * 3.15;
        const y = heightAt(x, z);
        const lamp = new THREE.Group();
        lamp.add(new THREE.Mesh(postGeo, ironMat));
        const glass = new THREE.Mesh(lampGlassGeo, lampGlassMat);
        glass.position.y = 3.1;
        lamp.add(glass);
        const cap = new THREE.Mesh(capGeo, ironMat);
        cap.position.y = 3.5;
        lamp.add(cap);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffc27a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.scale.set(2.8, 2.8, 1);
        halo.position.y = 3.1;
        lamp.add(halo);
        lamp.position.set(x, y, z);
        scene.add(lamp);
      }
    }

    /* ================================================================== */
    /*  XE TẢI THƯ CỔ ĐIỂN                                                 */
    /* ================================================================== */
    const vanRoot = new THREE.Group();
    vanRoot.userData.isCart = true;
    const bodyGroup = new THREE.Group();
    vanRoot.add(bodyGroup);

    const creamMat = new THREE.MeshPhysicalMaterial({ color: 0xf7ecdc, roughness: 0.38, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.2, envMap: envTex, envMapIntensity: 0.9 });
    const wineMat = new THREE.MeshPhysicalMaterial({ color: 0x9b2c4d, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2, envMap: envTex, envMapIntensity: 0.9, side: THREE.DoubleSide });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f5, metalness: 1, roughness: 0.15, envMap: envTex, envMapIntensity: 1.4 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xd9ad5f, metalness: 0.9, roughness: 0.28, envMap: envTex, envMapIntensity: 1.2 });
    const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x1b2742, roughness: 0.06, metalness: 0.3, clearcoat: 1, envMap: envTex, envMapIntensity: 1.6, side: THREE.DoubleSide });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x171316, roughness: 0.92 });

    // Thân xe: đường viền cong được extrude + bo cạnh
    const prof = new THREE.Shape();
    prof.moveTo(-2.0, 0.62);
    prof.lineTo(1.95, 0.62);
    prof.quadraticCurveTo(2.08, 0.62, 2.08, 0.78);
    prof.lineTo(2.08, 0.98);
    prof.quadraticCurveTo(2.08, 1.12, 1.92, 1.16);
    prof.lineTo(1.25, 1.24);
    prof.quadraticCurveTo(1.05, 1.27, 0.98, 1.45);
    prof.lineTo(0.72, 1.93);
    prof.quadraticCurveTo(0.66, 2.04, 0.5, 2.04);
    prof.lineTo(-1.7, 2.04);
    prof.quadraticCurveTo(-2.06, 2.04, -2.06, 1.7);
    prof.lineTo(-2.06, 0.78);
    prof.quadraticCurveTo(-2.06, 0.62, -2.0, 0.62);
    const BODY_D = 1.7;
    const bodyGeo = new THREE.ExtrudeGeometry(prof, {
      depth: BODY_D,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.1,
      bevelSegments: 5,
      curveSegments: 14
    });
    bodyGeo.rotateY(-Math.PI / 2);
    bodyGeo.translate(BODY_D / 2, 0, 0);
    bodyGroup.add(new THREE.Mesh(bodyGeo, creamMat));

    // Dải thân dưới màu rượu vang
    const skirt = new THREE.Mesh(new RoundedBoxGeometry(2.03, 0.42, 4.5, 4, 0.12), wineMat);
    skirt.position.set(0, 0.8, 0.03);
    bodyGroup.add(skirt);

    // Bảng hiệu hai bên
    const signTex = signTexture('Bưu Điện Hoa · 20/10');
    const signMat = new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.5, transparent: true });
    [-1, 1].forEach((side) => {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.425), signMat);
      sign.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      sign.position.set(side * 0.985, 1.45, -0.85);
      bodyGroup.add(sign);

      // cửa sổ cabin
      const wp = [
        [0.12, 1.5],
        [0.88, 1.5],
        [0.74, 1.9],
        [0.12, 1.9]
      ];
      const sh = new THREE.Shape();
      wp.forEach(([u, v], i) => {
        const uu = side > 0 ? -u : u;
        if (i === 0) sh.moveTo(uu, v);
        else sh.lineTo(uu, v);
      });
      const wg = new THREE.ShapeGeometry(sh);
      wg.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
      wg.translate(side * 0.985, 0, 0);
      bodyGroup.add(new THREE.Mesh(wg, glassMat));

      // đường ke cửa + tay nắm
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.012, 1.25, 0.014), new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.8 }));
      seam.position.set(side * 0.985, 1.35, 0.06);
      bodyGroup.add(seam);
      const handle = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.05, 0.2, 2, 0.015), chromeMat);
      handle.position.set(side * 1.0, 1.3, 0.22);
      bodyGroup.add(handle);
    });

    // Kính chắn gió + kính sau
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.58), glassMat);
    ws.rotation.x = -0.4636;
    ws.position.set(0, 1.77, 0.96);
    bodyGroup.add(ws);
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.42), glassMat);
    rw.rotation.y = Math.PI;
    rw.position.set(0, 1.75, -2.17);
    bodyGroup.add(rw);

    // Cản + đèn + lưới tản nhiệt
    [2.28, -2.27].forEach((zz) => {
      const bump = new THREE.Mesh(new RoundedBoxGeometry(2.1, 0.12, 0.14, 3, 0.05), chromeMat);
      bump.position.set(0, 0.64, zz);
      bodyGroup.add(bump);
    });
    const headMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: 0xffd27a, emissiveIntensity: 2.4, roughness: 0.2 });
    [-0.62, 0.62].forEach((hx) => {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), headMat);
      lamp.scale.set(1, 1, 0.65);
      lamp.position.set(hx, 0.98, 2.2);
      bodyGroup.add(lamp);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 8, 28), chromeMat);
      ring.position.set(hx, 0.98, 2.2);
      bodyGroup.add(ring);
      const tail = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshStandardMaterial({ color: 0xff3b4a, emissive: 0xd0102a, emissiveIntensity: 1.6 }));
      tail.position.set(hx * 1.25, 1.0, -2.22);
      bodyGroup.add(tail);
    });
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.3, 0.04), new THREE.MeshStandardMaterial({ color: 0x15121a, roughness: 0.5 }));
    grille.position.set(0, 0.88, 2.2);
    bodyGroup.add(grille);
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.016, 0.03), chromeMat);
      bar.position.set(0, 0.78 + i * 0.075, 2.225);
      bodyGroup.add(bar);
    }

    // Dè bùn (fender) + bánh xe
    const fenderGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.34, 28, 1, true, 0, Math.PI);
    fenderGeo.rotateZ(Math.PI / 2);
    const wheelDefs = [
      { x: -1.06, z: 1.38, front: true, side: -1 },
      { x: 1.06, z: 1.38, front: true, side: 1 },
      { x: -1.06, z: -1.25, front: false, side: -1 },
      { x: 1.06, z: -1.25, front: false, side: 1 }
    ];
    const steerPivots = [];
    const spinGroups = [];
    wheelDefs.forEach((wd) => {
      const pivot = new THREE.Group();
      pivot.position.set(wd.x, 0.48, wd.z);
      const spin = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.14, 14, 32), tireMat);
      tire.rotation.y = Math.PI / 2;
      spin.add(tire);
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 28).rotateZ(Math.PI / 2), creamMat);
      spin.add(disc);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.022, 8, 28), chromeMat);
      rim.rotation.y = Math.PI / 2;
      rim.position.x = wd.side * 0.1;
      spin.add(rim);
      const hub = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2).rotateZ(-Math.PI / 2 * wd.side), chromeMat);
      hub.position.x = wd.side * 0.1;
      spin.add(hub);
      for (let k = 0; k < 3; k++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.6, 0.035), goldMat);
        bar.position.x = wd.side * 0.102;
        bar.rotation.x = (k * Math.PI) / 3;
        spin.add(bar);
      }
      pivot.add(spin);
      bodyGroup.add(pivot);
      steerPivots.push(wd.front ? pivot : null);
      spinGroups.push(spin);
      const fender = new THREE.Mesh(fenderGeo, wineMat);
      fender.position.set(wd.x, 0.48, wd.z);
      bodyGroup.add(fender);
    });

    // Giá hoa trên nóc xe + vườn hoa hồng tràn
    const rackBar = (x, y, z, w, h, d) => {
      const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(w, h, d) * 0.4), goldMat);
      m.position.set(x, y, z);
      bodyGroup.add(m);
    };
    const RX = 0.78;
    const RZ0 = -1.78;
    const RZ1 = 0.32;
    const RY0 = 2.17;
    const RY1 = 2.52;
    [
      [-RX, RZ0],
      [RX, RZ0],
      [-RX, RZ1],
      [RX, RZ1]
    ].forEach(([x, z]) => rackBar(x, (RY0 + RY1) / 2, z, 0.04, RY1 - RY0, 0.04));
    rackBar(0, RY1, RZ0, RX * 2, 0.04, 0.04);
    rackBar(0, RY1, RZ1, RX * 2, 0.04, 0.04);
    rackBar(-RX, RY1, (RZ0 + RZ1) / 2, 0.04, 0.04, RZ1 - RZ0);
    rackBar(RX, RY1, (RZ0 + RZ1) / 2, 0.04, 0.04, RZ1 - RZ0);
    rackBar(-RX, (RY0 + RY1) / 2, (RZ0 + RZ1) / 2, 0.03, 0.03, RZ1 - RZ0);
    rackBar(RX, (RY0 + RY1) / 2, (RZ0 + RZ1) / 2, 0.03, 0.03, RZ1 - RZ0);

    {
      const nR = 120;
      const roofRoses = new THREE.InstancedMesh(roseHeadBase.clone(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide }), nR);
      const roofLeaves = new THREE.InstancedMesh(paint(new THREE.IcosahedronGeometry(0.14, 0), 0x3f8a36, 1), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), 70);
      const palRoof = [0xe11d48, 0xfb7185, 0xfda4af, 0xfff1f2, 0xf43f5e, 0xfcd34d].map((h) => new THREE.Color(h));
      for (let i = 0; i < nR; i++) {
        const px = (rand() * 2 - 1) * (RX - 0.1);
        const pz = RZ0 + 0.1 + rand() * (RZ1 - RZ0 - 0.2);
        const nx = px / RX;
        const nz = (pz - (RZ0 + RZ1) / 2) / ((RZ1 - RZ0) / 2);
        const dome = Math.max(0, 1 - nx * nx * 0.7 - nz * nz * 0.5);
        dummy.position.set(px, RY0 + 0.08 + dome * 0.38 + rand() * 0.08, pz);
        dummy.rotation.set(-Math.PI / 2 * 0 + (rand() - 0.5) * 0.7, rand() * 6, (rand() - 0.5) * 0.7);
        dummy.scale.setScalar(0.9 + rand() * 0.7);
        dummy.updateMatrix();
        roofRoses.setMatrixAt(i, dummy.matrix);
        roofRoses.setColorAt(i, palRoof[Math.floor(rand() * palRoof.length)]);
      }
      for (let i = 0; i < 70; i++) {
        dummy.position.set((rand() * 2 - 1) * RX * 0.95, RY0 + 0.1 + rand() * 0.25, RZ0 + rand() * (RZ1 - RZ0));
        dummy.rotation.set(rand() * 3, rand() * 3, rand() * 3);
        dummy.scale.set(1 + rand(), 0.5, 1 + rand());
        dummy.updateMatrix();
        roofLeaves.setMatrixAt(i, dummy.matrix);
      }
      bodyGroup.add(roofRoses);
      bodyGroup.add(roofLeaves);
    }

    // Túi thư da + chồng thư
    {
      const sack = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.42, 6, 14), new THREE.MeshStandardMaterial({ color: 0x8a4a22, roughness: 0.75 }));
      sack.rotation.z = Math.PI / 2 - 0.2;
      sack.rotation.y = 0.3;
      sack.position.set(0.28, RY0 + 0.3, 0.05);
      bodyGroup.add(sack);
      const cord = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 6, 20), goldMat);
      cord.rotation.y = Math.PI / 2;
      cord.position.set(0.08, RY0 + 0.32, 0.12);
      bodyGroup.add(cord);
      const paper = new THREE.MeshStandardMaterial({ color: 0xfff7ea, roughness: 0.6 });
      const sealMat = new THREE.MeshStandardMaterial({ color: 0xc81e43, roughness: 0.4 });
      const sealGeo = makeHeartGeometry(0.05, 0.02).scale(0.08, 0.08, 0.08);
      for (let i = 0; i < 6; i++) {
        const env = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.24), paper);
        env.position.set(-0.45, RY0 + 0.12 + i * 0.024, -0.2);
        env.rotation.y = (i - 3) * 0.12;
        bodyGroup.add(env);
      }
      const topSeal = new THREE.Mesh(sealGeo, sealMat);
      topSeal.rotation.x = -Math.PI / 2;
      topSeal.position.set(-0.45, RY0 + 0.28, -0.2);
      bodyGroup.add(topSeal);
    }

    // Dây đèn nhỏ quanh giá hoa
    const fairyOrbs = [];
    {
      const orbGeo = new THREE.SphereGeometry(0.035, 8, 6);
      const loop = [
        [-RX, RZ0],
        [RX, RZ0],
        [RX, RZ1],
        [-RX, RZ1]
      ];
      let idx = 0;
      for (let e = 0; e < 4; e++) {
        const [ax, az] = loop[e];
        const [bx, bz] = loop[(e + 1) % 4];
        for (let k = 0; k < 8; k++) {
          const t = k / 8;
          const orb = new THREE.Mesh(
            orbGeo,
            new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: idx % 2 ? 0xffb85a : 0xff8fb0, emissiveIntensity: 3, roughness: 0.3 })
          );
          orb.position.set(ax + (bx - ax) * t, RY1 - 0.04 - Math.sin(t * Math.PI) * 0.06, az + (bz - az) * t);
          bodyGroup.add(orb);
          fairyOrbs.push({ orb, off: idx++ });
        }
      }
    }

    const vanLight = new THREE.PointLight(0xffc27a, 1.4, 8, 2);
    vanLight.position.set(0, 2.9, -0.6);
    bodyGroup.add(vanLight);

    bodyGroup.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });

    /* ---------- Thư có cánh & trái tim pha lê bay quanh xe ---------- */
    const heartGeoItem = makeHeartGeometry(0.2, 0.07);
    const heartMat = new THREE.MeshPhysicalMaterial({
      color: 0xe11d48,
      roughness: 0.15,
      clearcoat: 1,
      emissive: 0x7f1230,
      emissiveIntensity: 0.7,
      envMap: envTex,
      envMapIntensity: 1.3
    });
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xfff8ee, roughness: 0.5 });
    const flapMat = new THREE.MeshStandardMaterial({ color: 0xf3e3cf, roughness: 0.6, side: THREE.DoubleSide });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, emissive: 0xffffff, emissiveIntensity: 0.22, side: THREE.DoubleSide });
    const sealHeartGeo = makeHeartGeometry(0.06, 0.025).scale(0.1, 0.1, 0.1);
    const sealItemMat = new THREE.MeshStandardMaterial({ color: 0xc81e43, roughness: 0.35 });

    const featherShape = new THREE.Shape();
    featherShape.moveTo(0, 0);
    featherShape.bezierCurveTo(0.12, 0.075, 0.34, 0.07, 1, 0);
    featherShape.bezierCurveTo(0.34, -0.05, 0.12, -0.045, 0, 0);
    const featherGeo = new THREE.ShapeGeometry(featherShape, 8);

    const escort = new THREE.Group();
    vanRoot.add(escort);

    const makeGlowSprite = (color, scale) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.scale.set(scale, scale, 1);
      return s;
    };

    function makeWingedLetter(idx) {
      const group = new THREE.Group();
      group.userData = { isFloatingItem: true, index: idx };
      group.add(new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.38, 0.03), paperMat));
      const flapShape = new THREE.Shape();
      flapShape.moveTo(-0.28, 0.19);
      flapShape.lineTo(0.28, 0.19);
      flapShape.lineTo(0, -0.04);
      const flap = new THREE.Mesh(new THREE.ShapeGeometry(flapShape), flapMat);
      flap.position.z = 0.017;
      group.add(flap);
      const seal = new THREE.Mesh(sealHeartGeo, sealItemMat);
      seal.position.set(0, -0.03, 0.03);
      group.add(seal);

      const mkWing = (dir) => {
        const w = new THREE.Group();
        for (let i = 0; i < 7; i++) {
          const f = new THREE.Mesh(featherGeo, wingMat);
          f.scale.set(0.58 - i * 0.045, 1.0 + (6 - i) * 0.05, 1);
          f.rotation.z = -0.4 + i * 0.17;
          f.position.z = -0.002 * i;
          w.add(f);
        }
        w.position.set(dir * 0.27, 0.03, 0);
        w.scale.x = dir;
        return w;
      };
      const wingL = mkWing(-1);
      const wingR = mkWing(1);
      group.add(wingL, wingR);

      group.add(makeGlowSprite(0xffd9a0, 1.6));
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 6), new THREE.MeshBasicMaterial());
      hit.material.visible = false;
      group.add(hit);
      return { group, wingL, wingR };
    }

    function makeCrystalHeart(idx) {
      const group = new THREE.Group();
      group.userData = { isFloatingItem: true, index: idx };
      const h = new THREE.Mesh(heartGeoItem, heartMat);
      group.add(h);
      group.add(makeGlowSprite(0xff6b8f, 1.9));
      const hit = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial());
      hit.material.visible = false;
      group.add(hit);
      return { group };
    }

    const floatingItems = [];
    const itemDefs = [
      { type: 'wing', base: [-1.3, 3.7, -3.0], speed: 2.0, scale: 1.7 },
      { type: 'heart', base: [1.9, 3.5, -1.8], speed: 2.4, scale: 1.5 },
      { type: 'wing', base: [0.2, 4.6, 0.4], speed: 1.8, scale: 1.7 },
      { type: 'heart', base: [-2.1, 3.4, 1.0], speed: 2.1, scale: 1.4 },
      { type: 'wing', base: [1.7, 4.2, 2.4], speed: 2.2, scale: 1.7 }
    ];
    itemDefs.forEach((def, idx) => {
      const it = def.type === 'wing' ? makeWingedLetter(idx) : makeCrystalHeart(idx);
      it.group.scale.setScalar(def.scale);
      it.group.position.set(...def.base);
      escort.add(it.group);
      floatingItems.push({ ...it, ...def, baseV: new THREE.Vector3(...def.base) });
    });

    scene.add(vanRoot);

    /* ---------- Hạt: cánh hoa rơi, đom đóm, bụi lấp lánh sau xe ---------- */
    const petalTex = petalTexture();
    const dotTex = glowTexture();

    const PETALS = Math.floor(280 * Q);
    const petalGeo = new THREE.BufferGeometry();
    const petalPos = new Float32Array(PETALS * 3);
    const petalVel = new Float32Array(PETALS * 2);
    petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPos, 3));
    const petalPts = new THREE.Points(
      petalGeo,
      new THREE.PointsMaterial({ map: petalTex, size: 0.26, transparent: true, depthWrite: false, alphaTest: 0.02, color: 0xffd0e0 })
    );
    petalPts.frustumCulled = false;
    scene.add(petalPts);

    const FLIES = Math.floor(170 * Q);
    const flyGeo = new THREE.BufferGeometry();
    const flyPos = new Float32Array(FLIES * 3);
    const flyBase = new Float32Array(FLIES * 3);
    const flyPhase = new Float32Array(FLIES);
    flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPos, 3));
    const flyPts = new THREE.Points(
      flyGeo,
      new THREE.PointsMaterial({ map: dotTex, size: 0.32, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe29a })
    );
    flyPts.frustumCulled = false;
    scene.add(flyPts);

    const TRAIL = 220;
    const trailGeo = new THREE.BufferGeometry();
    const trailPos = new Float32Array(TRAIL * 3).fill(-999);
    const trailCol = new Float32Array(TRAIL * 3);
    const trailVel = new Float32Array(TRAIL * 3);
    const trailLife = new Float32Array(TRAIL);
    const trailBase = new Float32Array(TRAIL * 3);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(trailCol, 3));
    const trailPts = new THREE.Points(
      trailGeo,
      new THREE.PointsMaterial({ map: dotTex, size: 0.28, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true })
    );
    trailPts.frustumCulled = false;
    scene.add(trailPts);
    let trailHead = 0;
    const trailPalette = [new THREE.Color(0xffb3c9), new THREE.Color(0xffe29a), new THREE.Color(0xffffff), new THREE.Color(0xf9a8d4)];

    /* ---------- Trạng thái xe & camera ---------- */
    let vanU = 0.02;
    const vanPos = new THREE.Vector3();
    const lastVan = new THREE.Vector3();
    let yaw = 0;
    let lastYaw = 0;
    let yawRateS = 0;
    let wheelAngle = 0;
    const SPEED = 3.6;

    const placeVan = () => {
      const p = curve.getPointAt(vanU);
      const T = curve.getTangentAt(vanU);
      vanPos.set(p.x, 0.035, p.z);
      yaw = Math.atan2(T.x, T.z);
      vanRoot.position.copy(vanPos);
      vanRoot.rotation.y = yaw;
      vanStateRef.current.pos.copy(vanPos);
      vanStateRef.current.yaw = yaw;
    };
    placeVan();
    lastVan.copy(vanPos);
    lastYaw = yaw;

    const presetToWorld = (arr) => new THREE.Vector3(arr[0], arr[1], arr[2]).applyAxisAngle(Y_AXIS, yaw).add(vanPos);
    {
      const pr0 = PRESETS.chase;
      camera.position.copy(presetToWorld(pr0.cam));
      controls.target.copy(presetToWorld(pr0.tgt));
      followRef.current = true;
      transRef.current = null;
      controls.update();
    }

    // đom đóm / cánh hoa khởi tạo quanh xe
    const respawnFly = (i) => {
      const a = rand() * Math.PI * 2;
      const r = 4 + Math.sqrt(rand()) * 22;
      const x = vanPos.x + Math.cos(a) * r;
      const z = vanPos.z + Math.sin(a) * r;
      flyBase[i * 3] = x;
      flyBase[i * 3 + 1] = heightAt(x, z) + 0.6 + rand() * 3.4;
      flyBase[i * 3 + 2] = z;
      flyPhase[i] = rand() * 100;
    };
    const respawnPetal = (i, initial) => {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 24;
      petalPos[i * 3] = vanPos.x + Math.cos(a) * r;
      petalPos[i * 3 + 1] = initial ? rand() * 8 : 7 + rand() * 3;
      petalPos[i * 3 + 2] = vanPos.z + Math.sin(a) * r;
      petalVel[i * 2] = 0.25 + rand() * 0.35;
      petalVel[i * 2 + 1] = rand() * 6.28;
    };
    for (let i = 0; i < FLIES; i++) respawnFly(i);
    for (let i = 0; i < PETALS; i++) respawnPetal(i, true);

    /* ---------- Tương tác ---------- */
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isPointerDown = false;
    let downPos = { x: 0, y: 0 };
    let cartHopProgress = 0;
    const interactiveTargets = [vanRoot];

    const isUiTarget = (t) => t && t.closest && t.closest('button, .fairy-mailbox-overlay, .modal-overlay, .hud-camera-toolbar, .cart-floating-indicator');

    const onPointerDown = (e) => {
      if (isUiTarget(e.target)) return;
      isPointerDown = true;
      downPos = { x: e.clientX, y: e.clientY };
    };
    const onPointerMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(interactiveTargets, true);
      container.style.cursor = hits.length > 0 ? 'pointer' : 'default';
    };
    const triggerCartAction = (hit) => {
      setHasClickedCart(true);
      cartHopProgress = 1;
      confetti({
        particleCount: 85,
        spread: 95,
        origin: { y: 0.55 },
        colors: ['#F43F5E', '#FDA4AF', '#FCD34D', '#FFF1F2', '#FECDD3']
      });
      let obj = hit ? hit.object : null;
      while (obj && !obj.userData?.isFloatingItem && !obj.userData?.isCart && obj.parent) obj = obj.parent;
      if (obj && obj.userData && obj.userData.isFloatingItem) {
        const m = messagesRef.current[obj.userData.index];
        if (m) {
          setReadingMessage(m);
          return;
        }
      }
      setIsMailboxOpen(true);
    };
    const onPointerUp = (e) => {
      if (isPointerDown) {
        const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
        if (dist < 10) {
          const rect = renderer.domElement.getBoundingClientRect();
          mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
          mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
          raycaster.setFromCamera(mouse, camera);
          const hits = raycaster.intersectObjects(interactiveTargets, true);
          if (hits.length > 0) triggerCartAction(hits[0]);
        }
      }
      isPointerDown = false;
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    /* ---------- Post-processing: bloom nhẹ cho ánh hoàng hôn ---------- */
    const rt = new THREE.WebGLRenderTarget(width * pr, height * pr, { type: THREE.HalfFloatType, samples: lowPower ? 0 : 4 });
    const composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(width, height), 0.42, 0.7, 0.88);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    /* ---------- Vòng lặp ---------- */
    let animId;
    let prevT = performance.now();
    const startT = prevT;
    const camTmpA = new THREE.Vector3();
    const camTmpB = new THREE.Vector3();
    const camDestA = new THREE.Vector3();
    const camDestB = new THREE.Vector3();
    let spawnAcc = 0;

    function renderLoop() {
      const now = performance.now();
      const dt = Math.min(0.05, (now - prevT) / 1000);
      prevT = now;
      const elapsed = (now - startT) * 0.001;
      timeU.value = elapsed;

      /* --- xe chạy trên đường --- */
      vanU = (vanU + (SPEED * dt) / curveLen) % 1;
      const prevYaw = yaw;
      placeVan();
      const yr = dt > 0 ? normAngle(yaw - prevYaw) / dt : 0;
      yawRateS += (yr - yawRateS) * Math.min(1, dt * 4);

      wheelAngle += (SPEED * dt) / 0.48;
      spinGroups.forEach((s) => (s.rotation.x = wheelAngle));
      const steer = Math.max(-0.4, Math.min(0.4, (yawRateS / SPEED) * 2.6));
      steerPivots.forEach((p) => p && (p.rotation.y = steer));

      if (cartHopProgress > 0) {
        cartHopProgress -= dt * 2.4;
        const hop = Math.sin((1 - Math.max(0, cartHopProgress)) * Math.PI);
        bodyGroup.position.y = hop * 0.35;
        bodyGroup.scale.set(1 + hop * 0.03, 1 - hop * 0.04, 1 + hop * 0.03);
      } else {
        bodyGroup.scale.set(1, 1, 1);
        bodyGroup.position.y = Math.sin(elapsed * 9) * 0.007 + Math.sin(elapsed * 3.1) * 0.012;
      }
      bodyGroup.rotation.z = yawRateS * 0.35 + Math.sin(elapsed * 2.1) * 0.004;
      bodyGroup.rotation.x = Math.sin(elapsed * 2.4) * 0.006;

      fairyOrbs.forEach((f) => f.orb.scale.setScalar(0.8 + Math.sin(elapsed * 3.4 + f.off * 0.9) * 0.35));

      /* --- thư & trái tim bay quanh xe --- */
      floatingItems.forEach((item, idx) => {
        const ph = elapsed * item.speed * 0.5 + idx * 1.7;
        item.group.position.set(
          item.baseV.x + Math.cos(ph * 0.6) * 0.45,
          item.baseV.y + Math.sin(ph) * 0.28,
          item.baseV.z + Math.sin(ph * 0.5) * 0.5
        );
        item.group.rotation.y = Math.PI + Math.sin(elapsed * 1.1 + idx) * 0.4;
        item.group.rotation.z = Math.sin(elapsed * 1.5 + idx) * 0.08;
        if (item.type === 'wing') {
          const flap = Math.sin(elapsed * 9 + idx) * 0.5;
          item.wingR.rotation.z = flap;
          item.wingL.rotation.z = -flap;
        } else {
          item.group.scale.setScalar(item.scale * (1 + Math.pow(Math.max(0, Math.sin(elapsed * 4.2)), 6) * 0.14));
          item.group.rotation.y = Math.PI + Math.sin(elapsed * 1.6 + idx) * 0.9;
        }
      });

      /* --- hạt --- */
      for (let i = 0; i < PETALS; i++) {
        petalPos[i * 3 + 1] -= petalVel[i * 2] * dt * 1.2;
        petalPos[i * 3] += Math.sin(elapsed * 0.9 + petalVel[i * 2 + 1]) * dt * 0.5;
        petalPos[i * 3 + 2] += Math.cos(elapsed * 0.7 + petalVel[i * 2 + 1]) * dt * 0.4;
        const dx = petalPos[i * 3] - vanPos.x;
        const dz = petalPos[i * 3 + 2] - vanPos.z;
        if (petalPos[i * 3 + 1] < 0.1 || dx * dx + dz * dz > 30 * 30) respawnPetal(i, false);
      }
      petalGeo.attributes.position.needsUpdate = true;

      for (let i = 0; i < FLIES; i++) {
        const dx = flyBase[i * 3] - vanPos.x;
        const dz = flyBase[i * 3 + 2] - vanPos.z;
        if (dx * dx + dz * dz > 30 * 30) respawnFly(i);
        const t = elapsed * 0.8 + flyPhase[i];
        flyPos[i * 3] = flyBase[i * 3] + Math.sin(t * 1.3) * 0.7;
        flyPos[i * 3 + 1] = flyBase[i * 3 + 1] + Math.sin(t * 1.9) * 0.4;
        flyPos[i * 3 + 2] = flyBase[i * 3 + 2] + Math.cos(t * 1.1) * 0.7;
      }
      flyGeo.attributes.position.needsUpdate = true;

      // bụi lấp lánh sau xe
      spawnAcc += dt * 60;
      while (spawnAcc >= 1) {
        spawnAcc -= 1;
        const i = trailHead;
        trailHead = (trailHead + 1) % TRAIL;
        tmpV.set((rand() - 0.5) * 1.6, 0.25 + rand() * 0.4, -2.4 - rand() * 0.3).applyAxisAngle(Y_AXIS, yaw).add(vanPos);
        trailPos[i * 3] = tmpV.x;
        trailPos[i * 3 + 1] = tmpV.y;
        trailPos[i * 3 + 2] = tmpV.z;
        trailVel[i * 3] = (rand() - 0.5) * 0.5;
        trailVel[i * 3 + 1] = 0.3 + rand() * 0.6;
        trailVel[i * 3 + 2] = (rand() - 0.5) * 0.5;
        trailLife[i] = 1;
        const c = trailPalette[Math.floor(rand() * trailPalette.length)];
        trailBase[i * 3] = c.r;
        trailBase[i * 3 + 1] = c.g;
        trailBase[i * 3 + 2] = c.b;
      }
      for (let i = 0; i < TRAIL; i++) {
        if (trailLife[i] > 0) {
          trailLife[i] -= dt * 0.7;
          trailPos[i * 3] += trailVel[i * 3] * dt;
          trailPos[i * 3 + 1] += trailVel[i * 3 + 1] * dt;
          trailPos[i * 3 + 2] += trailVel[i * 3 + 2] * dt;
          const f = Math.max(0, trailLife[i]);
          trailCol[i * 3] = trailBase[i * 3] * f;
          trailCol[i * 3 + 1] = trailBase[i * 3 + 1] * f;
          trailCol[i * 3 + 2] = trailBase[i * 3 + 2] * f;
        } else {
          trailCol[i * 3] = trailCol[i * 3 + 1] = trailCol[i * 3 + 2] = 0;
        }
      }
      trailGeo.attributes.position.needsUpdate = true;
      trailGeo.attributes.color.needsUpdate = true;

      /* --- ánh sáng theo xe --- */
      sun.position.copy(vanPos).addScaledVector(sunDir, 70);
      sun.target.position.copy(vanPos);

      /* --- camera: chuyển cảnh / bám theo xe --- */
      const tr = transRef.current;
      if (tr) {
        const k = Math.min(1, (now - tr.t0) / tr.dur);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        if (tr.preset.rel) {
          camDestA.set(...tr.preset.cam).applyAxisAngle(Y_AXIS, yaw).add(vanPos);
          camDestB.set(...tr.preset.tgt).applyAxisAngle(Y_AXIS, yaw).add(vanPos);
        } else {
          camDestA.set(...tr.preset.cam);
          camDestB.set(...tr.preset.tgt);
        }
        camera.position.lerpVectors(tr.fromCam, camDestA, e);
        controls.target.lerpVectors(tr.fromTgt, camDestB, e);
        if (k >= 1) {
          transRef.current = null;
          followRef.current = tr.preset.rel;
        }
      } else if (followRef.current) {
        const dyaw = normAngle(yaw - lastYaw);
        camTmpA.copy(camera.position).sub(lastVan).applyAxisAngle(Y_AXIS, dyaw);
        camTmpB.copy(controls.target).sub(lastVan).applyAxisAngle(Y_AXIS, dyaw);
        camera.position.copy(vanPos).add(camTmpA);
        controls.target.copy(vanPos).add(camTmpB);
      }
      lastVan.copy(vanPos);
      lastYaw = yaw;

      controls.autoRotate = autoRotateRef.current;
      controls.autoRotateSpeed = 1.2;
      controls.update();
      sky.position.copy(camera.position);

      composer.render();
      animId = requestAnimationFrame(renderLoop);
    }
    renderLoop();

    const handleResize = () => {
      const nw = container.clientWidth || window.innerWidth;
      const nh = container.clientHeight || window.innerHeight;
      if (nw > 0 && nh > 0) {
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
        composer.setSize(nw, nh);
        bloom.setSize(nw, nh);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      controlsRef.current = null;
      cameraRef.current = null;

      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => {
            if (m.map) m.map.dispose();
            m.dispose();
          });
        }
      });
      envScene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      envRT.dispose();
      pmrem.dispose();
      [glowTex, petalTex, dotTex, cloudTex, signTex].forEach((t) => t.dispose());
      composer.dispose && composer.dispose();
      rt.dispose();
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const filteredMessages = messages.filter((msg) => {
    if (activeFilter === 'all') return true;
    return msg.type === activeFilter;
  });

  return (
    <div className="page-garden-3d" id="page-garden-private">
      {/* Three.js 3D Viewport Canvas */}
      <div ref={containerRef} className="garden-3d-viewport" />

      {/* In-Game HUD Overlays */}
      <div className="garden-game-hud">
        {/* KHUNG CONSOLE ĐIỀU KHIỂN & TIÊU ĐỀ DÓNG GỌN Ở GIỮA PHÍA TRÊN */}
        <div className="hud-top-console-wrapper">
          <div className="hud-top-console">
            {/* Dòng tiêu đề Vườn Hoa Tri Ân */}
            <div className="hud-console-header">
              <span className="hud-console-badge">🌹 20.10 TRIBUTE</span>
              <span className="hud-console-title">
                Vườn Hoa Tri Ân 20/10 • Chuyến Xe Hoa Dành Tặng <strong>{sisterName}</strong> ✨
              </span>
            </div>

            {/* Thanh điều hướng camera & chuyển chế độ */}
            <div className="hud-camera-toolbar">
              <button className={`btn-cam-preset ${activeCamPreset === 'chase' ? 'active' : ''}`} onClick={() => setCameraPreset('chase')} title="Bám theo xe từ phía sau">
                🚐 Theo Xe
              </button>
              <button className={`btn-cam-preset ${activeCamPreset === 'close' ? 'active' : ''}`} onClick={() => setCameraPreset('close')} title="Cận cảnh chiếc xe thư">
                🔍 Cận Cảnh
              </button>
              <button className={`btn-cam-preset ${activeCamPreset === 'side' ? 'active' : ''}`} onClick={() => setCameraPreset('side')} title="Nhìn ngang bên hông xe">
                🌼 Bên Hông
              </button>
              <button className={`btn-cam-preset ${activeCamPreset === 'top' ? 'active' : ''}`} onClick={() => setCameraPreset('top')} title="Nhìn từ trên cao xuống">
                🕊️ Từ Trên Cao
              </button>
              <button className={`btn-cam-preset ${activeCamPreset === 'scenic' ? 'active' : ''}`} onClick={() => setCameraPreset('scenic')} title="Toàn cảnh cả vườn hoa">
                🌄 Toàn Cảnh
              </button>
              <button
                className={`btn-cam-preset ${autoRotate ? 'autorotate-active' : ''}`}
                onClick={() => setAutoRotate(!autoRotate)}
                title="Tự động quay quanh xe"
              >
                🎥 {autoRotate ? 'Dừng 360°' : 'Quay 360°'}
              </button>

              <button
                className="btn-cam-preset btn-cam-switch-2d"
                onClick={() => updateExperienceMode('2d')}
                title="Chuyển sang bản 2D Cổ Tích"
              >
                🌸 Bản 2D Cổ Tích
              </button>
            </div>
          </div>
        </div>

        {/* Nhóm chỉ dẫn tương tác đặt ở vị trí trung tâm phía dưới */}
        <div className="hud-interaction-guide-group">
          {!hasClickedCart && (
            <button
              type="button"
              className="cart-floating-indicator"
              onClick={() => {
                setHasClickedCart(true);
                setIsMailboxOpen(true);
              }}
              title="Chạm vào xe để mở hòm thư!"
            >
              <span>✨ Chạm vào xe hoặc những cánh thư đang bay để nhận quà! 💌</span>
            </button>
          )}

          <div>
            <span className="hud-interaction-hint">
              🖱️ Giữ chuột trái để xoay • Cuộn để phóng to • Chạm xe thư để mở thư
            </span>
          </div>
        </div>

        <div className="hud-bottom-bar">
          <button className="btn-hud-mailbox" onClick={() => setIsMailboxOpen(true)}>
            <span>🕊️ Hòm Thư Xe Hoa</span>
            <span className="mailbox-badge">{messages.length} Món Quà</span>
          </button>

          <button onClick={() => navigateWithFlowerTransition('/video')} className="btn-rose" style={{ fontSize: '0.98rem', padding: '12px 26px' }}>
            <span>Bước Tiếp Theo: Rạp Chiếu Phim Tri Ân 🎬</span>
          </button>
        </div>
      </div>

      {/* FAIRY MAILBOX MODAL */}
      {isMailboxOpen && (
        <div className="fairy-mailbox-overlay" onClick={() => setIsMailboxOpen(false)}>
          <div className="fairy-mailbox-window" onClick={(e) => e.stopPropagation()}>
            <div className="fairy-mailbox-header">
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--rose-400)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '700' }}>
                  Special Delivery • 20.10 Collection
                </span>
                <h2 className="font-serif" style={{ fontSize: 'clamp(1.4rem, 3.5vw, 1.85rem)', color: 'var(--champagne-light)', fontStyle: 'italic', margin: '4px 0 6px' }}>
                  Hòm Thư Tri Ân Gửi Tặng {sisterName} 🌸
                </h2>
                <p style={{ fontSize: '0.86rem', color: '#CBD5E1', margin: 0 }}>
                  Chạm vào từng cánh thư hoặc trái tim để đón nhận những lời chúc chân thành từ anh em nhé!
                </p>
              </div>

              <button
                onClick={() => setIsMailboxOpen(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%', width: '38px', height: '38px', color: '#FFF', fontSize: '1.2rem', cursor: 'pointer' }}
                title="Đóng hòm thư"
              >
                ✕
              </button>
            </div>

            <div className="fairy-filter-tabs">
              <button className={`fairy-tab-btn ${activeFilter === 'all' ? 'active' : ''}`} onClick={() => setActiveFilter('all')}>
                ✨ Tất cả ({messages.length})
              </button>
              <button className={`fairy-tab-btn ${activeFilter === 'winged_letter' ? 'active' : ''}`} onClick={() => setActiveFilter('winged_letter')}>
                🕊️ Thư có cánh ({messages.filter((m) => m.type === 'winged_letter').length})
              </button>
              <button className={`fairy-tab-btn ${activeFilter === 'heart' ? 'active' : ''}`} onClick={() => setActiveFilter('heart')}>
                💖 Trái tim bí mật ({messages.filter((m) => m.type === 'heart').length})
              </button>
            </div>

            <div className="fairy-mailbox-body">
              {filteredMessages.map((msg, idx) => {
                const isHeart = msg.type === 'heart';
                return (
                  <div key={msg.id || idx} className="fairy-gift-card" onClick={() => setReadingMessage(msg)}>
                    <div className="card-visual-slot">
                      {isHeart ? (
                        <div className="beating-heart-box">
                          <span className="gem-heart-emoji">💖</span>
                        </div>
                      ) : (
                        <div className="winged-visual-box">
                          <svg className="feather-wing left" viewBox="0 0 40 40">
                            <path d="M40 20 C25 5 10 10 0 25 C10 28 20 25 25 32 C30 25 35 22 40 20 Z" />
                          </svg>
                          <span className="letter-envelope-emoji">💌</span>
                          <svg className="feather-wing right" viewBox="0 0 40 40">
                            <path d="M0 20 C15 5 30 10 40 25 C30 28 20 25 15 32 C10 25 5 22 0 20 Z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="card-badge">{msg.badge || (isHeart ? '💖 Trái Tim Tri Ân' : '🕊️ Cánh Thư May Mắn')}</div>
                      <div className="card-sender">{msg.from_name}</div>
                      <p className="card-snippet">“{msg.text}”</p>
                    </div>

                    <div className="card-action-hint">
                      <span>{isHeart ? 'Chạm để mở trái tim' : 'Mở bức thư có cánh'}</span>
                      <span>→</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ROYAL PARCHMENT LETTER MODAL */}
      {readingMessage && (
        <div className="modal-overlay open" onClick={() => setReadingMessage(null)}>
          <div className="royal-parchment-box" onClick={(e) => e.stopPropagation()}>
            <div className="parchment-seal">20.10</div>

            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--rose-600)', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: '700' }}>
              Special Tribute • Royal Delivery
            </span>

            <h2 className="font-serif" style={{ fontSize: 'clamp(1.5rem, 4vw, 2.1rem)', color: 'var(--rose-700)', fontStyle: 'italic', margin: '8px 0 16px' }}>
              Thân Gửi Chị {sisterName} Quý Mến,
            </h2>

            <div style={{ background: 'rgba(244, 63, 94, 0.06)', borderLeft: '4px solid var(--rose-500)', borderRadius: '16px', padding: '22px 24px', margin: '20px 0' }}>
              <p style={{ fontSize: '1.12rem', lineHeight: '1.9', color: '#334155', fontStyle: 'italic' }}>“{readingMessage.text}”</p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1.5px dashed var(--rose-200)', paddingTop: '18px', marginTop: '20px', flexWrap: 'wrap', gap: '14px' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.2rem', color: 'var(--rose-700)', fontWeight: '700' }}>— {readingMessage.from_name}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: '#94A3B8' }}>With all our sincere gratitude ❤️</div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    setReadingMessage(null);
                    setIsMailboxOpen(true);
                  }}
                  className="btn-rose"
                  style={{ padding: '10px 20px', fontSize: '0.88rem', background: '#FFF', color: 'var(--rose-700)', border: '1.5px solid var(--rose-300)' }}
                >
                  <span>← Chọn thư khác</span>
                </button>

                <button onClick={() => setReadingMessage(null)} className="btn-rose" style={{ padding: '10px 22px', fontSize: '0.88rem' }}>
                  <span>Gấp thư lại 🕊️</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default PrivateGarden3D;