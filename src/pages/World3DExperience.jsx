import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { fetchPrivateWishes, getRandomCardWish } from '../api.js';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const mergeGeos = BufferGeometryUtils.mergeGeometries;
import confetti from 'canvas-confetti';
import { playPopSound, playLetterOpenSound, playTruckHonkSound, playSparkleSound, playSoftTapSound } from '../utils/soundEffects.js';
import { createSignatureCardCanvas } from '../components/signatureCardUtils.js';
import CardStudio from '../components/CardStudio.jsx';

// [TỐI ƯU CONFETTI] Tự động giảm hạt trên thiết bị di động & tôn trọng prefers-reduced-motion
const isMobileDevice = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
const fireConfetti = (opts = {}) => {
  if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }
  const count = opts.particleCount || 75;
  const adaptedCount = isMobileDevice ? Math.min(45, Math.max(15, Math.floor(count * 0.45))) : count;
  confetti({
    ...opts,
    particleCount: adaptedCount,
    ticks: opts.ticks || 180,
    disableForReducedMotion: true
  });
};

import {
  Y_AXIS,
  rngFactory,
  smooth,
  noise2,
  normAngle,
  windify,
  taperedTube,
  makeHeartGeometry,
  VAN_PRESETS,
  CARRIAGE_PRESETS,
  STATIONS,
  fireflyTexture,
  glowTexture,
  petalTexture,
  cloudTexture,
  signTexture,
  paint,
  petal,
  makeRoseHead,
  makeTulipHead,
  makeDaisyHead,
  makeLavenderHead,
  makeStem,
  makeBlade,
  buildVegetationField,
  buildRoyalCarriage
} from '../components/world3d/index.js';

export { STATIONS };

/* ================================================================== */
/*  [P1] CINEMATIC COLOR GRADING SHADER — "FILM LOOK"                  */
/*  Split toning + vignette + grain + chromatic aberration             */
/*  Dùng chung cho cả 5 phần — tên: ColorGradeShader                   */
/* ================================================================== */
const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uStrength: { value: 1.0 },
    uVignette: { value: 0.35 },
    uGrain: { value: 0.012 },
    uAberration: { value: 0.0004 },
    uSaturation: { value: 1.08 },
    uVignetteColor: { value: new THREE.Color(0x0a0510) },
    uShadowTint: { value: new THREE.Color(0.06, 0.08, 0.14) },
    uHighlightTint: { value: new THREE.Color(1.06, 1.0, 0.92) }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uStrength;
    uniform float uVignette;
    uniform float uGrain;
    uniform float uAberration;
    uniform float uSaturation;
    uniform vec3 uVignetteColor;
    uniform vec3 uShadowTint;
    uniform vec3 uHighlightTint;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }

    vec3 filmicCurve(vec3 x) {
      vec3 a = x * (2.51 * x + 0.03);
      vec3 b = x * (2.43 * x + 0.59) + 0.14;
      return clamp(a / b, 0.0, 1.0);
    }

    void main() {
      vec2 uv = vUv;
      vec2 centered = uv - 0.5;
      float r2 = dot(centered, centered);

      float ab = uAberration * r2 * 4.0;
      vec2 dir = normalize(centered + 1e-6);
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir * ab).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir * ab).b;

      col = mix(col, filmicCurve(col), 0.35 * uStrength);

      float luma = dot(col, vec3(0.299, 0.587, 0.114));
      float shadowMask = 1.0 - smoothstep(0.0, 0.45, luma);
      float highlightMask = smoothstep(0.55, 1.0, luma);
      vec3 shadowShift = uShadowTint * shadowMask * 0.35 * uStrength;
      vec3 highlightShift = (uHighlightTint - vec3(1.0)) * highlightMask * 0.5 * uStrength;
      col += shadowShift + highlightShift;

      luma = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(vec3(luma), col, uSaturation);

      float vig = smoothstep(0.32, 1.0, length(centered) * 1.35);
      col = mix(col, uVignetteColor, vig * uVignette * uStrength);

      float grain = (hash(uv + fract(uTime * 0.7)) - 0.5) * uGrain;
      col += grain;

      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }
  `
};

/* ================================================================== */
/*  [P1] FLAME SHADER — Ngọn lửa nến uốn lượn thật (dùng ở PHẦN 4)     */
/*  Vertex shader uốn theo noise + thời gian → lửa không đứng yên       */
/* ================================================================== */
const FlameShader = {
  uniforms: {
    uTime: { value: 0 },
    uColorInner: { value: new THREE.Color(0xFFF4C2) },
    uColorOuter: { value: new THREE.Color(0xFF9A3C) }
  },
  vertexShader: `
    uniform float uTime;
    varying float vY;
    void main() {
      vec3 pos = position;
      vY = position.y + 0.5;
      float sway = sin(uTime * 8.0 + position.y * 6.0) * 0.05 * vY;
      float flick = sin(uTime * 13.0 + position.x * 9.0) * 0.03 * vY;
      pos.x += sway;
      pos.z += flick;
      pos.y += sin(uTime * 11.0 + position.x * 5.0) * 0.02;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColorInner;
    uniform vec3 uColorOuter;
    varying float vY;
    void main() {
      vec3 col = mix(uColorOuter, uColorInner, smoothstep(0.0, 0.7, vY));
      float alpha = smoothstep(1.0, 0.2, vY);
      gl_FragColor = vec4(col, alpha);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  side: THREE.DoubleSide
};

/* ================================================================== */
/*  [P1] FIREWORK PARTICLE SHADER — Hạt pháo hoa có "đuôi" mờ dần      */
/*  Dùng ở PHẦN 4 — tên: FireworkParticleShader                       */
/* ================================================================== */
const FireworkParticleShader = {
  uniforms: {
    uTex: { value: null },
    uSize: { value: 1.15 }
  },
  vertexShader: `
    uniform float uSize;
    attribute vec3 color;
    attribute float aLife;
    varying vec3 vColor;
    varying float vLife;
    void main() {
      vColor = color;
      vLife = aLife;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_PointSize = uSize * aLife * (300.0 / -mv.z);
      gl_Position = projectionMatrix * mv;
    }
  `,
  fragmentShader: `
    uniform sampler2D uTex;
    varying vec3 vColor;
    varying float vLife;
    void main() {
      vec4 tex = texture2D(uTex, gl_PointCoord);
      if (tex.a < 0.01) discard;
      float alpha = tex.a * vLife;
      gl_FragColor = vec4(vColor, alpha);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false
};

/* ================================================================== */
/*  [P1] MAIN COMPONENT                                                */
/*  Toàn bộ state/handler giữ nguyên tên như file gốc + biến mới:      */
/*    - worldAtmosphereRef thêm: renderer, ssaoPass, bokehPass,        */
/*      colorGrade, flameUniforms                                     */
/*    - giftAnimationRef giữ nguyên                                    */
/* ================================================================== */
export default function World3DExperience() {
  const {
    selectedSister,
    updateExperienceMode,
    wishes,
    setActiveModalWish,
    isPlayingMusic,
    setIsPlayingMusic
  } = useApp();

  const sisterName = selectedSister ? selectedSister.name : 'Bạn';

  // [P1] Navigation & Camera states
  const [activeStationIndex, setActiveStationIndex] = useState(0);
  const [activeVanCamPreset, setActiveVanCamPreset] = useState('chase');
  const [selectedVehicle, setSelectedVehicle] = useState('van'); // 'van' | 'carriage'
  const selectedVehicleRef = useRef('van');
  const royalCarriageRef = useRef(null);
  const [isLookingAtSky, setIsLookingAtSky] = useState(false);
  const [isNavPadOpen, setIsNavPadOpen] = useState(false);
  const navMoveIntervalRef = useRef(null);
  const autoRotateRef = useRef(false);

  // [P1] Guided tour pulse — có clearTimeout để tránh timer cũ chạy
  const [shouldPulseNext, setShouldPulseNext] = useState(false);
  const pulseTimerRef = useRef(null);

  // Ref đồng bộ activeStationIndex cho renderLoop để tránh stale closure
  const activeStationRef = useRef(activeStationIndex);
  useEffect(() => {
    activeStationRef.current = activeStationIndex;
  }, [activeStationIndex]);

  useEffect(() => {
    setShouldPulseNext(false);
    if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = setTimeout(() => {
      setShouldPulseNext(true);
    }, 8500);
    return () => {
      if (pulseTimerRef.current) clearTimeout(pulseTimerRef.current);
    };
  }, [activeStationIndex]);

  // [P1] Mobile detect
  const [isMobileScreen, setIsMobileScreen] = useState(() => {
    return typeof window !== 'undefined' ? (window.innerWidth <= 768 || 'ontouchstart' in window) : false;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobileScreen(window.innerWidth <= 768 || 'ontouchstart' in window);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // [P1] Night mode
  const [isNightMode, setIsNightMode] = useState(false);
  const nightModeRef = useRef(false);
  nightModeRef.current = isNightMode;

  // [P1] HUD cinema
  const [isHudHidden, setIsHudHidden] = useState(false);

  // [P1] Atmosphere ref — mở rộng cho post-processing
  const worldAtmosphereRef = useRef({
    skyMat: null,
    starMat: null,
    sunLight: null,
    hemiLight: null,
    lampMaterials: [],
    lampHalos: [],
    flyMat: null,
    letterMat: null,
    bloom: null,
    renderer: null,
    ssaoPass: null,
    bokehPass: null,
    colorGrade: null,
    flameUniforms: null
  });

  // [P1] Modals
  const [messages, setMessages] = useState([]);
  const [isMailboxOpen, setIsMailboxOpen] = useState(false);
  const [readingMessage, setReadingMessage] = useState(null);
  const [activeVideoModal, setActiveVideoModal] = useState(false);
  const [activePartyCardModal, setActivePartyCardModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastPaused, setToastPaused] = useState(false);
  const [isSceneReady, setIsSceneReady] = useState(false);
  const [isDownloadingCard, setIsDownloadingCard] = useState(false);

  // 5 Video Options Tri Ân 20/10
  const videoPlaylist = [
    {
      id: 1,
      title: "Lời Chúc: Leader FE",
      tag: "Leader FE",
      icon: "👑",
      duration: "0:10",
      src: "/videochucmung.mp4",
      poster: "/images.jpg",
      desc: "Thông điệp chúc mừng 20/10 ngọt ngào, ấm áp và trân trọng nhất từ Leader FE."
    },
    {
      id: 2,
      title: "Lời Chúc: Râu Con Kiến (Sơn)",
      tag: "Râu con kiến",
      icon: "🐜",
      duration: "0:10",
      src: "/videchucmungSon.mp4",
      poster: "/images.jpg",
      desc: "Clip chúc mừng hóm hỉnh, vui tươi và tràn đầy năng lượng tích cực từ Sơn (Râu con kiến)."
    },
    {
      id: 3,
      title: "Lời Chúc: Cửu Bảo (Sơn B)",
      tag: "Cửu bảo",
      icon: "🛡️",
      duration: "0:10",
      src: "/videochucmungSonb.mp4",
      poster: "/images.jpg",
      desc: "Lời nhắn gửi chân thành, vững chãi từ Sơn B (Cửu bảo) gửi tặng phái đẹp công ty."
    },
    {
      id: 4,
      title: "Lời Chúc: Lính (Hoàng)",
      tag: "Lính",
      icon: "⚔️",
      duration: "0:10",
      src: "/videochucmungHoang.mp4",
      poster: "/images.jpg",
      desc: "Lời chúc nhiệt huyết, hết mình và vui nhộn từ Hoàng (Lính) gửi tặng các chị em."
    },
    {
      id: 5,
      title: "Lời Chúc: Food Reviewer(Huy)",
      tag: "Food Reviewer",
      icon: "🍳",
      duration: "0:10",
      src: "/videochucmungHuy.mp4",
      poster: "/images.jpg",
      desc: "Hương vị ấm áp và sự chu đáo từ Huy (Food Reviewer) chúc mừng ngày Phụ nữ Việt Nam 20/10."
    }
  ];
  const [selected3DVideoIndex, setSelected3DVideoIndex] = useState(0);
  const [is3DVideoAutoNext, setIs3DVideoAutoNext] = useState(true);
  const video3DPlayerRef = useRef(null);

  // Ref tạm dừng renderLoop khi xem video để giải phóng 100% tài nguyên GPU
  const renderPausedRef = useRef(false);
  const wasPlayingMusicBeforeVideoRef = useRef(false);
  useEffect(() => {
    renderPausedRef.current = activeVideoModal;
    if (activeVideoModal) {
      if (isPlayingMusic) {
        wasPlayingMusicBeforeVideoRef.current = true;
        if (typeof setIsPlayingMusic === 'function') setIsPlayingMusic(false);
      }
    } else {
      if (wasPlayingMusicBeforeVideoRef.current) {
        wasPlayingMusicBeforeVideoRef.current = false;
        if (typeof setIsPlayingMusic === 'function') setIsPlayingMusic(true);
      }
    }
  }, [activeVideoModal, isPlayingMusic, setIsPlayingMusic]);

  // [P1] Refs for Three.js World — giữ nguyên tên
  const containerRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const vanStateRef = useRef({ pos: new THREE.Vector3(), yaw: 0 });
  const transRef = useRef(null);
  const followVanRef = useRef(false);
  const printableCardRef = useRef(null);

  // [P1] Gift animation ref — giữ nguyên
  const giftAnimationRef = useRef({
    opened: false,
    lidMesh: null,
    butterflies: [],
    balloons: [],
    openProgress: 0,
    crystalHeart: null,
    heartHalo: null,
    welcomeSign: null
  });

  // [P1] Load private wishes
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

  const toastTimerRef = useRef(null);
  const toastRemainingRef = useRef(3500);
  const toastStartRef = useRef(0);

  // [P1] showToast với khả năng pause on hover & progress bar
  const showToast = (msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    setToastPaused(false);
    toastRemainingRef.current = 3500;
    toastStartRef.current = performance.now();
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
    }, 3500);
  };

  const handleToastMouseEnter = () => {
    if (!toastMessage) return;
    setToastPaused(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    const elapsed = performance.now() - toastStartRef.current;
    toastRemainingRef.current = Math.max(500, toastRemainingRef.current - elapsed);
  };

  const handleToastMouseLeave = () => {
    if (!toastMessage) return;
    setToastPaused(false);
    toastStartRef.current = performance.now();
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
    }, toastRemainingRef.current);
  };

  // [UX Polish] Đóng modal bằng phím ESC (Accessibility standard)
  useEffect(() => {
    const handleEscKey = (e) => {
      if (e.key === 'Escape') {
        if (readingMessage) {
          setReadingMessage(null);
        } else if (isMailboxOpen) {
          setIsMailboxOpen(false);
        } else if (activeVideoModal) {
          setActiveVideoModal(false);
        } else if (activePartyCardModal) {
          setActivePartyCardModal(false);
        }
      }
    };
    window.addEventListener('keydown', handleEscKey);
    return () => window.removeEventListener('keydown', handleEscKey);
  }, [readingMessage, isMailboxOpen, activeVideoModal, activePartyCardModal]);

  // [P1] Cinematic Veil Curtain & Auto-tour & Photo mode & Easter egg states
  const [isVeilOpen, setIsVeilOpen] = useState(false);
  const [isAutoTourActive, setIsAutoTourActive] = useState(false);
  const autoTourTimerRef = useRef(null);
  const easterEggCountRef = useRef(0);

  // [P1] Achievement System (Khám phá X/6 trạm)
  const [visitedStations, setVisitedStations] = useState(() => new Set([0]));
  const achievementUnlockedRef = useRef(false);

  // Lời chúc thiệp ngẫu nhiên từ 50 lời chúc chọn lọc
  const [cardWish] = useState(() => getRandomCardWish());

  // [P1] Personalization: Theme màu sắc & loài hoa theo tên chị em (Nhóm 5.2)
  const sisterTheme = useMemo(() => {
    const name = sisterName || '';
    const lower = name.toLowerCase();
    if (lower.includes('mai') || lower.includes('cúc') || lower.includes('hoàng')) {
      return { primary: '#D97706', accent: '#FDE68A', flower: 'Hoa Mai Vàng & Champagne', lightColor: 0xfff0b0 };
    }
    if (lower.includes('hồng') || lower.includes('anh') || lower.includes('ngọc')) {
      return { primary: '#E11D48', accent: '#FDA4AF', flower: 'Hoa Hồng Ngọc & Phong Lan', lightColor: 0xffd6e7 };
    }
    if (lower.includes('thủy') || lower.includes('hà') || lower.includes('thanh')) {
      return { primary: '#0284C7', accent: '#BAE6FD', flower: 'Hoa Cẩm Tú Cầu Lam Ngọc', lightColor: 0xd0f0ff };
    }
    if (lower.includes('phương') || lower.includes('ngân') || lower.includes('ánh')) {
      return { primary: '#9333EA', accent: '#E9D5FF', flower: 'Hoa Lavender Tím Kiêu Kỳ', lightColor: 0xf3e8ff };
    }
    return { primary: '#BE123C', accent: '#FDE68A', flower: 'Ngàn Hoa Rực Rỡ', lightColor: 0xffecd0 };
  }, [sisterName]);

  // [P1] Procedural Web Audio API Ambient Sound (Gió vi vu & chuông pha lê - Nhóm 2.5)
  const ambientAudioRef = useRef(null);
  const initAmbientAudio = () => {
    if (ambientAudioRef.current) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Buffer tạo pink noise (gió thảo nguyên dịu nhẹ)
      const bufferSize = ctx.sampleRate * 2;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.032;
        b6 = white * 0.115926;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;
      whiteNoise.loop = true;

      // Filter gió nhẹ (biquad lowpass)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, ctx.currentTime);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, ctx.currentTime);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      whiteNoise.start(0);

      ambientAudioRef.current = { ctx, gain, whiteNoise };
    } catch (e) {
      console.warn('[Ambient Audio] Failed to init procedural audio:', e);
    }
  };

  // Auto-tour: tự động chuyển trạm mỗi 8.5s để xem phim rảnh tay
  useEffect(() => {
    if (!isAutoTourActive) {
      if (autoTourTimerRef.current) clearTimeout(autoTourTimerRef.current);
      return;
    }
    const runStep = () => {
      autoTourTimerRef.current = setTimeout(() => {
        setActiveStationIndex((curr) => {
          const next = typeof curr === 'number' ? (curr + 1) % STATIONS.length : 0;
          flyToStation(next, 3200);
          return next;
        });
        runStep();
      }, 8500);
    };
    runStep();
    return () => {
      if (autoTourTimerRef.current) clearTimeout(autoTourTimerRef.current);
    };
  }, [isAutoTourActive]);

  // Nhận diện thời gian thực buổi tối (sau 18h30) để chuyển sang Dạ Tiệc Đêm lung linh
  useEffect(() => {
    const hours = new Date().getHours();
    if (hours >= 18 || hours < 5) {
      setTimeout(() => {
        if (!nightModeRef.current) {
          toggleNightMode();
          showToast('🌙 Chào buổi tối! Vương Quốc đã tự động thắp sáng Bầu Trời Dạ Tiệc Đêm!');
        }
      }, 2400);
    }
  }, []);

  // Easter egg: Chạm 3 lần vào logo 🌸 để bắn pháo hoa bí mật & mưa sao băng (Nhóm 3.1)
  const triggerEasterEgg = () => {
    easterEggCountRef.current += 1;
    if (easterEggCountRef.current === 3) {
      easterEggCountRef.current = 0;
      playSparkleSound();
      fireConfetti({
        particleCount: 140,
        spread: 140,
        origin: { y: 0.38 },
        colors: ['#FDE68A', '#F43F5E', '#C084FC', '#38BDF8', '#FFF']
      });
      showToast('✨ BẠN ĐÃ MỞ KHÓA BÍ MẬT 20/10: Triệu vì sao lung linh & đàn bướm dạ quang tỏa sáng mừng phái đẹp! 💖');
    }
  };

  // Photo mode: Ẩn tạm thời HUD trong 5s để chụp ảnh kỷ niệm không vướng giao diện
  const triggerPhotoMode = () => {
    setIsHudHidden(true);
    showToast('📸 Đã vào Chế Độ Chụp Ảnh! HUD sẽ tự động hiện lại sau 5 giây.');
    setTimeout(() => {
      setIsHudHidden(false);
    }, 5000);
  };

  /* ================================================================== */
  /*  [P1] TOGGLE NIGHT MODE — cập nhật exposure + colorGrade + vignette */
  /* ================================================================== */
  const toggleNightMode = () => {
    setIsNightMode((prev) => {
      const next = !prev;
      nightModeRef.current = next;
      const atmo = worldAtmosphereRef.current;
      if (atmo && atmo.skyMat) {
        if (next) {
          atmo.skyMat.uniforms.top.value.setHex(0x070312);
          atmo.skyMat.uniforms.mid.value.setHex(0x1a0924);
          atmo.skyMat.uniforms.hor.value.setHex(0x3e132c);
          if (atmo.starMat) atmo.starMat.opacity = 0.95;
          if (atmo.sunLight) {
            atmo.sunLight.color.setHex(0xbcd4ff);
            atmo.sunLight.intensity = 1.2;
          }
          if (atmo.hemiLight) {
            atmo.hemiLight.color.setHex(0x382255);
            atmo.hemiLight.groundColor.setHex(0x10081c);
            atmo.hemiLight.intensity = 0.65;
          }
          atmo.lampMaterials.forEach((m) => { m.emissiveIntensity = 4.5; });
          atmo.lampHalos.forEach((h) => { h.scale.set(3.8, 3.8, 1); h.material.opacity = 0.95; });
          if (atmo.flyMat) {
            atmo.flyMat.opacity = 0.98;
            atmo.flyMat.size = 4.5;
          }
          if (atmo.letterMat) atmo.letterMat.emissiveIntensity = 0.55;
          if (atmo.bloom) atmo.bloom.strength = 0.55;
          if (atmo.renderer) atmo.renderer.toneMappingExposure = 1.05;
          if (atmo.scene && atmo.scene.fog) atmo.scene.fog.color.setHex(0x10081c);
          if (atmo.colorGrade) {
            atmo.colorGrade.uniforms.uVignette.value = 0.5;
            atmo.colorGrade.uniforms.uVignetteColor.value.setHex(0x02000a);
          }
          fireConfetti({ particleCount: 70, spread: 90, origin: { y: 0.6 }, colors: ['#FDE68A', '#FCD34D', '#C084FC', '#FFF'] });
          showToast('🌙 Đã kích hoạt Dạ Tiệc Đêm lung linh ánh đèn!');
        } else {
          atmo.skyMat.uniforms.top.value.setHex(0x2a1650);
          atmo.skyMat.uniforms.mid.value.setHex(0xb85c8a);
          atmo.skyMat.uniforms.hor.value.setHex(0xffb48a);
          if (atmo.starMat) atmo.starMat.opacity = 0;
          if (atmo.sunLight) {
            atmo.sunLight.color.setHex(0xffc890);
            atmo.sunLight.intensity = 2.7;
          }
          if (atmo.hemiLight) {
            atmo.hemiLight.color.setHex(0xffb7c5);
            atmo.hemiLight.groundColor.setHex(0x2a3a22);
            atmo.hemiLight.intensity = 0.95;
          }
          atmo.lampMaterials.forEach((m) => { m.emissiveIntensity = 2.4; });
          atmo.lampHalos.forEach((h) => { h.scale.set(2.8, 2.8, 1); h.material.opacity = 0.8; });
          if (atmo.flyMat) {
            atmo.flyMat.opacity = 0.75;
            atmo.flyMat.size = 3.2;
          }
          if (atmo.letterMat) atmo.letterMat.emissiveIntensity = 0.18;
          if (atmo.bloom) atmo.bloom.strength = 0.42;
          if (atmo.renderer) atmo.renderer.toneMappingExposure = 1.08;
          if (atmo.scene && atmo.scene.fog) atmo.scene.fog.color.setHex(0xe6a08f);
          if (atmo.colorGrade) {
            atmo.colorGrade.uniforms.uVignette.value = 0.35;
            atmo.colorGrade.uniforms.uVignetteColor.value.setHex(0x0a0510);
          }
          showToast('🌅 Đã chuyển về Bầu Trời Hoàng Hôn ấm áp!');
        }
      }
      return next;
    });
  };

  /* ================================================================== */
  /*  [P1] FLY TO WORLD SCENIC                                          */
  /* ================================================================== */
  const flyToWorldScenic = () => {
    playSoftTapSound();
    setActiveStationIndex('scenic');
    followVanRef.current = false;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl || !transRef.current) return;

    transRef.current.active = true;
    transRef.current.t0 = performance.now();
    transRef.current.dur = 1600;
    transRef.current.fromCam = cam.position.clone();
    transRef.current.toCam = new THREE.Vector3(0, 36, 68);
    transRef.current.fromTgt = ctrl.target.clone();
    transRef.current.toTgt = new THREE.Vector3(0, 3, 0);
    transRef.current.isVanRelative = false;

    showToast('🌄 Đang chuyển sang Góc Nhìn Toàn Cảnh Vương Quốc Hoa 3D!');
  };

  /* ================================================================== */
  /*  [P1] FLY TO STATION — có guard chống undefined                    */
  /* ================================================================== */
  const flyToStation = (idx, customDur = null) => {
    playSoftTapSound();
    setActiveStationIndex(idx);
    if (idx !== 5) setIsLookingAtSky(false);
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl || !transRef.current) return;

    if (idx === 3) {
      followVanRef.current = false;
      transRef.current.active = true;
      transRef.current.t0 = performance.now();
      transRef.current.dur = customDur || 1800;
      transRef.current.fromCam = cam.position.clone();
      transRef.current.fromTgt = ctrl.target.clone();
      const isCarriage = selectedVehicleRef.current === 'carriage';
      const presets = isCarriage ? CARRIAGE_PRESETS : VAN_PRESETS;
      transRef.current.preset = presets[activeVanCamPreset] || (isCarriage ? CARRIAGE_PRESETS.tq : VAN_PRESETS.chase);
      transRef.current.isVanRelative = true;
      transRef.current.arcHeight = 0;
      showToast(isCarriage ? '🐎 Đang bay bám theo Cỗ Xe Ngựa Hoàng Gia 20/10!' : '🚐 Đang bay bám theo Chuyến Xe Hoa 20/10!');
      return;
    }

    followVanRef.current = false;
    if (idx !== 3 && typeof window.__ensureStation === 'function') {
      window.__ensureStation(idx);
    }
    const stConfig = transRef.current.stationsPos[idx];
    if (!stConfig) return;

    // [P1] Track Achievement Progress (Khám phá X/6 trạm)
    setVisitedStations((prev) => {
      const next = new Set(prev);
      next.add(idx);
      if (next.size === 6 && !achievementUnlockedRef.current) {
        achievementUnlockedRef.current = true;
        setTimeout(() => {
          playSparkleSound();
          fireConfetti({
            particleCount: 130,
            spread: 120,
            origin: { y: 0.45 },
            colors: ['#FDE68A', '#F43F5E', '#C084FC', '#38BDF8', '#FFF']
          });
          showToast('👑 VINH QUANG! Bạn đã khám phá đủ 6 trạm và mở khóa danh hiệu: NỮ THẦN VƯƠNG QUỐC 20/10! 💖');
        }, 1200);
      }
      return next;
    });

    transRef.current.active = true;
    transRef.current.t0 = performance.now();
    transRef.current.dur = customDur || (idx === 1 ? 3200 : 2500);
    transRef.current.fromCam = cam.position.clone();
    transRef.current.toCam = stConfig.camPos.clone();
    transRef.current.fromTgt = ctrl.target.clone();
    transRef.current.toTgt = stConfig.targetPos.clone();
    transRef.current.isVanRelative = false;
    transRef.current.arcHeight = 4.0;

    const stData = STATIONS[idx];
    showToast(`✨ [${stData.chapter}] Đang bay đến: ${stData.name} — ${stData.chapterTitle}`);
  };

  /* ================================================================== */
  /*  [P1] VAN CAMERA PRESET                                            */
  /* ================================================================== */
  const setVanCameraPreset = (name) => {
    setActiveVanCamPreset(name);
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl || !transRef.current) return;

    followVanRef.current = false;
    transRef.current.active = true;
    transRef.current.t0 = performance.now();
    transRef.current.dur = 1200;
    transRef.current.fromCam = cam.position.clone();
    transRef.current.fromTgt = ctrl.target.clone();
    const presets = selectedVehicleRef.current === 'carriage' ? CARRIAGE_PRESETS : VAN_PRESETS;
    transRef.current.preset = presets[name] || CARRIAGE_PRESETS[name] || VAN_PRESETS[name] || VAN_PRESETS.chase;
    transRef.current.isVanRelative = true;
  };

  /* ================================================================== */
  /*  [P1] SWITCH VEHICLE (XE HOA RETRO <-> CỖ XE BẠCH MÃ HOÀNG GIA)    */
  /* ================================================================== */
  const switchVehicle = (vehicleType) => {
    if (selectedVehicleRef.current === vehicleType) return;
    playSparkleSound();
    fireConfetti({
      particleCount: 55,
      spread: 75,
      origin: { y: 0.65 },
      colors: ['#FDE68A', '#F43F5E', '#C084FC', '#FFF']
    });
    selectedVehicleRef.current = vehicleType;
    setSelectedVehicle(vehicleType);
    if (royalCarriageRef.current && royalCarriageRef.current.root) {
      royalCarriageRef.current.root.visible = vehicleType === 'carriage';
    }

    const defaultPreset = vehicleType === 'carriage' ? 'tq' : 'chase';
    setActiveVanCamPreset(defaultPreset);
    if (transRef.current) {
      transRef.current.active = true;
      transRef.current.t0 = performance.now();
      transRef.current.dur = 1100;
      if (cameraRef.current) transRef.current.fromCam = cameraRef.current.position.clone();
      if (controlsRef.current) transRef.current.fromTgt = controlsRef.current.target.clone();
      transRef.current.preset = vehicleType === 'carriage' ? CARRIAGE_PRESETS.tq : VAN_PRESETS.chase;
      transRef.current.isVanRelative = true;
    }

    if (vehicleType === 'carriage') {
      showToast('🐎 Đã triệu hồi Cỗ Xe Bạch Mã Hoàng Gia Cổ Tích!');
    } else {
      showToast('🚐 Đã chuyển sang Chuyến Xe Hoa 20/10 Retro!');
    }
  };

  /* ================================================================== */
  /*  [P1] DOWNLOAD RETINA CARD                                         */
  /* ================================================================== */
  const downloadRetinaCard = async () => {
    if (!printableCardRef.current) return;
    try {
      setIsDownloadingCard(true);
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default || html2canvasModule;
      const canvas = await html2canvas(printableCardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FAF3EA'
      });
      const link = document.createElement('a');
      link.download = `Thiep_Chuc_Mung_2010_${sisterName.replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      fireConfetti({ particleCount: 75, spread: 80, origin: { y: 0.6 } });
      showToast('🎉 Đã tải thiệp kỷ niệm 2x Retina thành công!');
    } catch (err) {
      console.error(err);
      showToast('⚠️ Không thể tải thiệp, xin vui lòng thử lại!');
    } finally {
      setIsDownloadingCard(false);
    }
  };

  /* ================================================================== */
  /*  [P1] VIRTUAL D-PAD NAVIGATION & CASTLE SKY CAMERA TOGGLE          */
  /* ================================================================== */
  const moveCamera = (dir, factor = 1) => {
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl) return;

    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();

    const right = new THREE.Vector3();
    right.crossVectors(fwd, Y_AXIS).normalize();

    const step = 2.4 * factor;

    if (dir === 'forward') {
      cam.position.addScaledVector(fwd, step);
      ctrl.target.addScaledVector(fwd, step);
    } else if (dir === 'backward') {
      cam.position.addScaledVector(fwd, -step);
      ctrl.target.addScaledVector(fwd, -step);
    } else if (dir === 'left') {
      cam.position.addScaledVector(right, -step);
      ctrl.target.addScaledVector(right, -step);
    } else if (dir === 'right') {
      cam.position.addScaledVector(right, step);
      ctrl.target.addScaledVector(right, step);
    } else if (dir === 'up') {
      cam.position.y += step;
      ctrl.target.y += step;
    } else if (dir === 'down') {
      cam.position.y = Math.max(1.8, cam.position.y - step);
      ctrl.target.y = Math.max(1.0, ctrl.target.y - step);
    }
    ctrl.update();
  };

  const startNavMovement = (dir, e) => {
    if (e) e.preventDefault();
    moveCamera(dir, 1);
    if (navMoveIntervalRef.current) clearInterval(navMoveIntervalRef.current);
    navMoveIntervalRef.current = setInterval(() => {
      moveCamera(dir, 0.7);
    }, 45);
  };

  const stopNavMovement = () => {
    if (navMoveIntervalRef.current) {
      clearInterval(navMoveIntervalRef.current);
      navMoveIntervalRef.current = null;
    }
  };

  const resetCurrentStationView = () => {
    playSoftTapSound();
    if (activeStationIndex === 'scenic') {
      flyToWorldScenic();
    } else if (typeof activeStationIndex === 'number') {
      flyToStation(activeStationIndex);
    }
    setIsLookingAtSky(false);
    showToast('🎯 Đã đặt lại góc nhìn mặc định của trạm!');
  };

  const toggleCastleView = () => {
    playSoftTapSound();
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;
    if (!cam || !ctrl || !transRef.current) return;
    const st5 = transRef.current.stationsPos[5];
    if (!st5) return;

    if (isLookingAtSky) {
      // Hạ góc nhìn xuống bàn tiệc hoàng gia
      transRef.current.active = true;
      transRef.current.t0 = performance.now();
      transRef.current.dur = 1600;
      transRef.current.fromCam = cam.position.clone();
      transRef.current.toCam = st5.camPos.clone();
      transRef.current.fromTgt = ctrl.target.clone();
      transRef.current.toTgt = st5.targetPos.clone();
      transRef.current.isVanRelative = false;
      setIsLookingAtSky(false);
      showToast('🍽️ Đã hạ góc nhìn xuống Bàn Tiệc Hoàng Gia & Hòm Quà 20/10');
    } else {
      // Ngước lên bầu trời ngắm pháo hoa — Góc nhìn điện ảnh góc thấp & lùi xa để bao trọn 3 tầng pháo hoa
      const stCam = st5.camPos.clone();
      const stTgt = st5.targetPos.clone();
      const fwd = stTgt.clone().sub(stCam);
      fwd.y = 0;
      fwd.normalize();
      const camToPos = stCam.clone().sub(fwd.clone().multiplyScalar(11.0)).add(new THREE.Vector3(0, -2.6, 0));
      const camToTarget = stTgt.clone().add(fwd.clone().multiplyScalar(4.0)).add(new THREE.Vector3(0, 32.0, 0));

      transRef.current.active = true;
      transRef.current.t0 = performance.now();
      transRef.current.dur = 1800;
      transRef.current.fromCam = cam.position.clone();
      transRef.current.toCam = camToPos;
      transRef.current.fromTgt = ctrl.target.clone();
      transRef.current.toTgt = camToTarget;
      transRef.current.isVanRelative = false;
      setIsLookingAtSky(true);
      showToast('🎆 Ngước lên chiêm ngưỡng Bầu Trời Pháo Hoa 3D Đại Tiệc');
    }
  };

  /* ================================================================== */
  /*  [P1] THREE.JS WORLD LIFECYCLE — BẮT ĐẦU useEffect chính           */
  /*  PHẦN 2 sẽ nối tiếp ngay bên trong useEffect này                   */
  /* ================================================================== */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const lowPower = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
    const isWeakDevice = lowPower || (typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 4) <= 4);
    // Level up tối đa: Q = 1.0 (desktop - 100% mật độ hoa ngút ngàn) / 0.45 (mobile mượt mà)
    const Q = isWeakDevice ? 0.45 : 1.0;
    const rand = rngFactory(20102026);
    const timeU = { value: 0 };

    // Shared texture preloader cho /images.jpg — decode 1 lần duy nhất trên GPU, loại bỏ 1.5s lag khi bay trạm
    const sharedImageTextureRef = { current: null, callbacks: [] };
    const getSharedImageTexture = (cb) => {
      if (sharedImageTextureRef.current) {
        cb(sharedImageTextureRef.current);
        return;
      }
      sharedImageTextureRef.callbacks.push(cb);
      if (sharedImageTextureRef.callbacks.length === 1) {
        new THREE.TextureLoader().load('/images.jpg', (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.anisotropy = 4;
          sharedImageTextureRef.current = tex;
          sharedImageTextureRef.callbacks.forEach((fn) => fn(tex));
          sharedImageTextureRef.callbacks.length = 0;
        });
      }
    };
    getSharedImageTexture(() => {}); // Kích hoạt nạp ngay từ đầu

    const fwTimers = [];
    let vegTimer = null;
    const resumeAudio = () => {
      try {
        const ctx = window._sharedAudioContext || (THREE.AudioContext && THREE.AudioContext.getContext && THREE.AudioContext.getContext());
        if (ctx && ctx.state === 'suspended') {
          ctx.resume();
        }
      } catch (e) {}
    };
    window.addEventListener('pointerdown', resumeAudio, { once: true });

    const width = container.clientWidth || window.innerWidth || 1200;
    const height = container.clientHeight || window.innerHeight || 800;

    // [P1] Các biến/hàm khai báo tại đây sẽ được PHẦN 2, 3, 4, 5 sử dụng:
    //   renderer, pr, scene, camera, controls, skyMat, sky, starMat, sun,
    //   hemiLight, curve, curveLen, samplePts, heightAt, scatter,
    //   scatterLandscape, envTex, glowTex, dummy, tint, vanRoot, bodyGroup,
    //   spinGroups, steerPivots, fairyOrbs, floatingItems, interactiveMeshes,
    //   stationCameraPositions, transRef, composer, bloom, ssaoPass,
    //   bokehPass, colorGrade, smaaPass, raycaster, onPointerDown,
    //   onPointerUp, renderLoop, handleResize, animId, v.v...
    // PHẦN 2 bắt đầu nối tiếp từ đây.

// ===== PHẦN 1/5 — KẾT THÚC =====
// ===== PHẦN 2/5 — BẮT ĐẦU =====
    /* ---------- [P2] Renderer / Scene / Camera ---------- */
    const renderer = new THREE.WebGLRenderer({
      antialias: !lowPower,
      powerPreference: 'high-performance',
      stencil: false
    });
    const pr = Math.min(window.devicePixelRatio || 1, lowPower ? 1.5 : 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.info.autoReset = false;
    renderer.debug.checkShaderErrors = false;
    container.appendChild(renderer.domElement);
    worldAtmosphereRef.current.renderer = renderer;

    // [PARALLEL SHADER COMPILATION & BENCHMARKS]
    try {
      const gl = renderer.getContext();
      if (gl) gl.getExtension('KHR_parallel_shader_compile');
    } catch (e) {}

    const benchMarks = { start: performance.now(), terrain: 0, st0: 0, firstFrame: 0 };
    const markBench = (name) => { benchMarks[name] = performance.now(); };
    const getBenchElapsed = (name) => (performance.now() - (benchMarks[name] || benchMarks.start)).toFixed(1);

    const scene = new THREE.Scene();
    const FOG_COLOR = 0xe6a08f;
    scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0095);
    worldAtmosphereRef.current.scene = scene;

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

    /* ---------- [P2] Sky + reflections ---------- */
    const sunDir = new THREE.Vector3(-0.6, 0.26, -0.75).normalize();
    const skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      fog: false,
      uniforms: {
        top: { value: new THREE.Color(isNightMode ? 0x070312 : 0x2a1650) },
        mid: { value: new THREE.Color(isNightMode ? 0x1a0924 : 0xb85c8a) },
        hor: { value: new THREE.Color(isNightMode ? 0x3e132c : 0xffb48a) },
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
    worldAtmosphereRef.current.skyMat = skyMat;

    // [P2] Vòm sao
    const starGeo = new THREE.BufferGeometry();
    const starCount = 1200;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 0.95 + 0.05);
      const rad = 660;
      starPositions[i * 3] = rad * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = rad * Math.cos(phi);
      starPositions[i * 3 + 2] = rad * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2.2,
      transparent: true,
      opacity: isNightMode ? 0.95 : 0,
      fog: false,
      depthWrite: false
    });
    const starField = new THREE.Points(starGeo, starMat);
    scene.add(starField);
    worldAtmosphereRef.current.starMat = starMat;

    // [P2] Mây
    const cloudTex = cloudTexture();
    for (let i = 0; i < 14; i++) {
      const sm = new THREE.SpriteMaterial({
        map: cloudTex,
        color: 0xffc6b4,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        depthTest: false,
        fog: false
      });
      const sp = new THREE.Sprite(sm);
      const a = rand() * Math.PI * 2;
      const el = 0.12 + rand() * 0.22;
      sp.position.set(Math.cos(a) * Math.cos(el) * 480, Math.sin(el) * 480, Math.sin(a) * Math.cos(el) * 480);
      sp.scale.set(240 + rand() * 160, 60 + rand() * 40, 1);
      sp.renderOrder = -9;
      sky.add(sp);
    }

    // [P2] Siêu tối ưu IBL: Dùng canvas 64x32 nạp vào PMREM equirectangular thay vì render 3D scene 6 hướng
    // Tiết kiệm ngay 5-8 giây GPU stall khi khởi tạo lần đầu
    let envRT = null;
    let envTex = null;
    try {
      const c = document.createElement('canvas');
      c.width = 64; c.height = 32;
      const ctx = c.getContext('2d');
      const gr = ctx.createLinearGradient(0, 0, 0, 32);
      gr.addColorStop(0, isNightMode ? '#070312' : '#2a1650');
      gr.addColorStop(0.5, isNightMode ? '#1a0924' : '#b85c8a');
      gr.addColorStop(1, isNightMode ? '#3e132c' : '#ffb48a');
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, 64, 32);
      const ct = new THREE.CanvasTexture(c);
      ct.colorSpace = THREE.SRGBColorSpace;
      const pmrem = new THREE.PMREMGenerator(renderer);
      envRT = pmrem.fromEquirectangular(ct);
      envTex = envRT.texture;
      ct.dispose();
      pmrem.dispose();
    } catch (e) {
      envTex = null;
    }

    /* ---------- [P2] Lights ---------- */
    const hemiLight = new THREE.HemisphereLight(
      isNightMode ? 0x382255 : 0xffb7c5,
      isNightMode ? 0x10081c : 0x2a3a22,
      isNightMode ? 0.65 : 0.95
    );
    scene.add(hemiLight);
    worldAtmosphereRef.current.hemiLight = hemiLight;

    // [P2] Sun — shadow 2048 (desktop) / 1024 (mobile) vừa nét vừa nhẹ gấp 4 lần
    const sun = new THREE.DirectionalLight(
      isNightMode ? 0xbcd4ff : 0xffc890,
      isNightMode ? 1.2 : 2.7
    );
    sun.castShadow = true;
    const shadowSize = lowPower ? 1024 : 2048;
    sun.shadow.mapSize.set(shadowSize, shadowSize);
    sun.shadow.camera.left = -60;
    sun.shadow.camera.right = 60;
    sun.shadow.camera.top = 60;
    sun.shadow.camera.bottom = -60;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 280;
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.04;
    scene.add(sun);
    scene.add(sun.target);
    worldAtmosphereRef.current.sunLight = sun;

    const fill = new THREE.DirectionalLight(0x8a6cff, 0.4);
    fill.position.set(40, 20, 50);
    scene.add(fill);

    /* ---------- [P2] Scenic Road Curve ---------- */
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
    // [P2] SPATIAL GRID 2D (BĂM KHÔNG GIAN) — TỐI ƯU CỰC HẠN distToPath
    // Giảm số phép tính từ 28.8 TRIỆU xuống dưới 800.000 phép tính (Nhanh hơn 30 LẦN!)
    const GRID_SIZE = 12;
    const GRID_OFFSET = 160;
    const GRID_DIM = 28;
    const gridBuckets = Array.from({ length: GRID_DIM * GRID_DIM }, () => []);

    for (let i = 0; i < SAMPLES; i++) {
      const gx = Math.min(GRID_DIM - 1, Math.max(0, Math.floor((sx[i] + GRID_OFFSET) / GRID_SIZE)));
      const gz = Math.min(GRID_DIM - 1, Math.max(0, Math.floor((sz[i] + GRID_OFFSET) / GRID_SIZE)));
      gridBuckets[gz * GRID_DIM + gx].push(i);
    }

    // [SIÊU TỐI ƯU distToPath] Bỏ qua toàn bộ phép tính đắt đỏ nếu điểm nằm ngoài vùng đường (X: > 75, Z: > 65)
    const distToPath = (x, z) => {
      const absX = Math.abs(x);
      const absZ = Math.abs(z);
      if (absX > 75 || absZ > 65) {
        return Math.hypot(Math.max(0, absX - 65), Math.max(0, absZ - 55)) + 12;
      }

      const gx = Math.floor((x + GRID_OFFSET) / GRID_SIZE);
      const gz = Math.floor((z + GRID_OFFSET) / GRID_SIZE);

      let best = 1e9;
      const minX = Math.max(0, gx - 1), maxX = Math.min(GRID_DIM - 1, gx + 1);
      const minZ = Math.max(0, gz - 1), maxZ = Math.min(GRID_DIM - 1, gz + 1);

      for (let cz = minZ; cz <= maxZ; cz++) {
        const rowOff = cz * GRID_DIM;
        for (let cx = minX; cx <= maxX; cx++) {
          const bucket = gridBuckets[rowOff + cx];
          const bLen = bucket.length;
          for (let k = 0; k < bLen; k++) {
            const idx = bucket[k];
            const dx = x - sx[idx];
            const dz = z - sz[idx];
            const d2 = dx * dx + dz * dz;
            if (d2 < best) best = d2;
          }
        }
      }

      if (best === 1e9) return 16;
      return Math.sqrt(best);
    };

    const heightAt = (x, z, dIn) => {
      const d = dIn === undefined ? distToPath(x, z) : dIn;
      const e = smooth(2.7, 10, d);
      const far = smooth(14, 48, d);
      return e * (0.55 + 0.45 * Math.sin(x * 0.13) * Math.cos(z * 0.11)) * 1.3 + far * 5.5 + 0.28 * noise2(x * 1.7, z * 1.7) * smooth(3.5, 9, d);
    };

    const tmpV = new THREE.Vector3();
    // [SIÊU TỐI ƯU SCATTER O(N)] Sinh trực tiếp theo pháp tuyến spline, latMag chính là khoảng cách tới đường!
    // Giảm thời gian sinh 28.000 điểm từ 6.000ms xuống còn DƯỚI 8ms!
    const scatter = (count, latMin, latMax, pw) => {
      const out = [];
      for (let i = 0; i < count; i++) {
        const idx = Math.floor(rand() * SAMPLES);
        const p = samplePts[idx];
        const q = samplePts[idx + 1] || samplePts[0];
        tmpV.set(q.x - p.x, 0, q.z - p.z).normalize();
        const lx = tmpV.z;
        const lz = -tmpV.x;
        const latMag = latMin + Math.pow(rand(), pw) * (latMax - latMin);
        const lat = latMag * (rand() < 0.5 ? -1 : 1);
        const x = p.x + lx * lat + (rand() - 0.5) * 0.5;
        const z = p.z + lz * lat + (rand() - 0.5) * 0.5;
        out.push({ x, z, d: latMag, y: heightAt(x, z, latMag) });
      }
      return out;
    };

    const scatterLandscape = (count, minDistFromRoad = 2.4, maxExtent = 115) => {
      const out = [];
      let guard = 0;
      const MAX_GUARD = count * 2;
      while (out.length < count && guard++ < MAX_GUARD) {
        const x = (rand() - 0.5) * 2 * maxExtent;
        const z = (rand() - 0.5) * 2 * maxExtent;
        let d;
        if (Math.abs(x) > 75 || Math.abs(z) > 65) {
          d = Math.hypot(Math.max(0, Math.abs(x) - 65), Math.max(0, Math.abs(z) - 55)) + 12;
        } else {
          d = distToPath(x, z);
        }
        if (d < minDistFromRoad) continue;
        out.push({ x, z, d, y: heightAt(x, z, d) });
      }
      return out;
    };

    /* ---------- [P2] Ground Mesh ---------- */
    // 96x96 đỉnh (desktop) / 72x72 (mobile) - mịn màng hoàn mỹ, tiết kiệm hơn 5.000 đỉnh
    const groundGeo = new THREE.PlaneGeometry(240, 240, lowPower ? 72 : 96, lowPower ? 72 : 96);
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

    /* ---------- [P2] Road Mesh ---------- */
    {
      const RS = 400; // 400 đoạn cong tối ưu thay vì 700, giảm hơn 4.000 đỉnh
      const HW = 2.2;
      const LAT = 11;
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

    /* ---------- [P2] Vegetation (Progressive Multi-slice Loading) ---------- */
    vegTimer = setTimeout(() => {
      buildVegetationField({
        scene,
        scatter,
        scatterLandscape,
        timeU,
        rand,
        Q,
        onProgress: (txt) => {
          if (txt) console.log(`🌸 [Vegetation] ${txt}`);
        }
      });
    }, 120);

    /* ---------- [P2] Cherry Blossom Trees (Deferred) ---------- */
    const dummy = new THREE.Object3D();
    const tint = new THREE.Color();
    const treeGroup = new THREE.Group();
    scene.add(treeGroup);

    const buildCherryTrees = () => {
      const barkMat = new THREE.MeshStandardMaterial({ color: 0x4b2f23, roughness: 1 });
      const blossomGeo = new THREE.IcosahedronGeometry(1, 1);
      const blossomMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, emissive: 0x4a1230, emissiveIntensity: 0.35 });
      const blossomPal = [0xf9a8d4, 0xfbcfe8, 0xf472b6, 0xfce7f3, 0xfdf2f8, 0xf0abfc].map((h) => new THREE.Color(h));
      const treeSpots = [];
      const cand = scatter(80, 8, 36, 1.0);
      for (const c of cand) {
        if (treeSpots.length >= (isWeakDevice ? 8 : 12)) break;
        if (treeSpots.every((t) => Math.hypot(t.x - c.x, t.z - c.z) > 8)) treeSpots.push(c);
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
        const NB = Math.floor(450 * Q);
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
    };

    /* ---------- [P2] Vintage Fence (Deferred) ---------- */
    const buildVintageFence = () => {
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
    };

    /* ---------- [P2] Street Lamps (Deferred) ---------- */
    const glowTex = glowTexture('rgba(255,236,190,1)', 'rgba(255,190,110,0.35)');
    const lampGlassMat = new THREE.MeshStandardMaterial({
      color: 0xffe4b0,
      emissive: 0xffb45a,
      emissiveIntensity: isNightMode ? 4.5 : 2.4,
      roughness: 0.3
    });
    worldAtmosphereRef.current.lampMaterials = [lampGlassMat];
    worldAtmosphereRef.current.lampHalos = [];

    const buildStreetLamps = () => {
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
      const capGeo = new THREE.ConeGeometry(0.3, 0.26, 6);

      const spawnLamp = (x, z) => {
        const y = heightAt(x, z);
        const lamp = new THREE.Group();
        lamp.add(new THREE.Mesh(postGeo, ironMat));
        const glass = new THREE.Mesh(lampGlassGeo, lampGlassMat);
        glass.position.y = 3.1;
        lamp.add(glass);
        const cap = new THREE.Mesh(capGeo, ironMat);
        cap.position.y = 3.5;
        lamp.add(cap);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex,
          color: 0xffc27a,
          transparent: true,
          opacity: isNightMode ? 0.95 : 0.8,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        }));
        halo.scale.set(isNightMode ? 3.8 : 2.8, isNightMode ? 3.8 : 2.8, 1);
        halo.position.y = 3.1;
        lamp.add(halo);
        lamp.position.set(x, y, z);
        scene.add(lamp);
        worldAtmosphereRef.current.lampHalos.push(halo);
      };

      const NL = 18;
      for (let i = 0; i < NL; i++) {
        const u = (i + 0.3) / NL;
        const p = curve.getPointAt(u);
        const T = curve.getTangentAt(u);
        const side = i % 2 === 0 ? 1 : -1;
        const x = p.x + T.z * side * 3.15;
        const z = p.z - T.x * side * 3.15;
        spawnLamp(x, z);
      }

      spawnLamp(-4.2, 5.0);
      spawnLamp(4.2, 5.0);
      spawnLamp(14.5, -3.8);
      spawnLamp(18.5, 4.2);
      spawnLamp(-18.0, 16.5);
      spawnLamp(-12.5, 23.5);
      spawnLamp(-24.5, -12.0);
      spawnLamp(-15.5, -21.0);
    };

    /* ---------- [P2] Fireflies (320) ---------- */
    const flyCount = 320;
    const flyGeo = new THREE.BufferGeometry();
    const flyPositions = new Float32Array(flyCount * 3);
    const flyData = [];
    for (let i = 0; i < flyCount; i++) {
      const u = Math.random();
      const p = curve.getPointAt(u);
      const offsetR = 3.5 + Math.random() * 30;
      const offsetA = Math.random() * Math.PI * 2;
      const fx = p.x + Math.cos(offsetA) * offsetR;
      const fz = p.z + Math.sin(offsetA) * offsetR;
      const fy = heightAt(fx, fz) + 0.8 + Math.random() * 2.8;
      flyPositions[i * 3] = fx;
      flyPositions[i * 3 + 1] = fy;
      flyPositions[i * 3 + 2] = fz;
      flyData.push({
        baseX: fx,
        baseY: fy,
        baseZ: fz,
        radiusX: 1.2 + Math.random() * 2.8,
        radiusZ: 1.2 + Math.random() * 2.8,
        speed: 0.35 + Math.random() * 0.75,
        freqY: 0.5 + Math.random() * 1.1,
        phase: Math.random() * Math.PI * 2
      });
    }
    flyGeo.setAttribute('position', new THREE.BufferAttribute(flyPositions, 3));
    const fireflyTex = fireflyTexture();
    const flyMat = new THREE.PointsMaterial({
      map: fireflyTex,
      color: 0xffffff,
      size: isNightMode ? 4.5 : 3.2,
      transparent: true,
      opacity: isNightMode ? 0.98 : 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const firefliesMesh = new THREE.Points(flyGeo, flyMat);
    scene.add(firefliesMesh);
    worldAtmosphereRef.current.flyMat = flyMat;

    /* ================================================================== */
    /*  [P2] FLORAL DELIVERY TRUCK (Deferred)                             */
    /* ================================================================== */
    const vanRoot = new THREE.Group();
    vanRoot.userData.isCart = true;
    const bodyGroup = new THREE.Group();
    vanRoot.add(bodyGroup);
    const escort = new THREE.Group();
    vanRoot.add(escort);
    const steerPivots = [];
    const spinGroups = [];
    const floatingItems = [];
    const fairyOrbs = [];
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f5, metalness: 1, roughness: 0.15, envMap: envTex, envMapIntensity: 1.4 });

    let royalCarriage = null;
    const buildCarriageVehicle = () => {
      try {
        royalCarriage = buildRoyalCarriage({ scene, envTex });
        royalCarriageRef.current = royalCarriage;
        if (royalCarriage && royalCarriage.root) {
          royalCarriage.root.visible = selectedVehicleRef.current === 'carriage';
        }
      } catch (err) {
        console.warn('[Royal Carriage] Build error:', err);
      }
    };

    const buildTruck = () => {
      const creamMat = new THREE.MeshPhysicalMaterial({ color: 0xf7ecdc, roughness: 0.38, metalness: 0.05, clearcoat: 0.7, clearcoatRoughness: 0.2, envMap: envTex, envMapIntensity: 0.9 });
      const wineMat = new THREE.MeshPhysicalMaterial({ color: 0x9b2c4d, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2, envMap: envTex, envMapIntensity: 0.9, side: THREE.DoubleSide });
      const goldMat = new THREE.MeshStandardMaterial({ color: 0xd9ad5f, metalness: 0.9, roughness: 0.28, envMap: envTex, envMapIntensity: 1.2 });
      const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x1b2742, roughness: 0.06, metalness: 0.3, clearcoat: 1, envMap: envTex, envMapIntensity: 1.6, side: THREE.DoubleSide });
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x171316, roughness: 0.92 });

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

    const skirt = new THREE.Mesh(new RoundedBoxGeometry(2.03, 0.42, 4.5, 4, 0.12), wineMat);
    skirt.position.set(0, 0.8, 0.03);
    bodyGroup.add(skirt);

    const signTexMesh = signTexture('Bưu Điện Hoa · 20/10');
    const signMat = new THREE.MeshStandardMaterial({ map: signTexMesh, roughness: 0.5, transparent: true });
    [-1, 1].forEach((side) => {
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 0.425), signMat);
      sign.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      sign.position.set(side * 0.985, 1.45, -0.85);
      bodyGroup.add(sign);

      const wp = [[0.12, 1.5], [0.88, 1.5], [0.74, 1.9], [0.12, 1.9]];
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

      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.012, 1.25, 0.014), new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.8 }));
      seam.position.set(side * 0.985, 1.35, 0.06);
      bodyGroup.add(seam);
      const handle = new THREE.Mesh(new RoundedBoxGeometry(0.03, 0.05, 0.2, 2, 0.015), chromeMat);
      handle.position.set(side * 1.0, 1.3, 0.22);
      bodyGroup.add(handle);
    });

    const ws = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.58), glassMat);
    ws.rotation.x = -0.4636;
    ws.position.set(0, 1.77, 0.96);
    bodyGroup.add(ws);
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.42), glassMat);
    rw.rotation.y = Math.PI;
    rw.position.set(0, 1.75, -2.17);
    bodyGroup.add(rw);

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

    const fenderGeo = new THREE.CylinderGeometry(0.6, 0.6, 0.34, 28, 1, true, 0, Math.PI);
    fenderGeo.rotateZ(Math.PI / 2);
    const wheelDefs = [
      { x: -1.06, z: 1.38, front: true, side: -1 },
      { x: 1.06, z: 1.38, front: true, side: 1 },
      { x: -1.06, z: -1.25, front: false, side: -1 },
      { x: 1.06, z: -1.25, front: false, side: 1 }
    ];
    // steerPivots & spinGroups defined outside for renderLoop safe access
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

    // [P2] Giá hoa nóc xe
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
      [-RX, RZ0], [RX, RZ0], [-RX, RZ1], [RX, RZ1]
    ].forEach(([x, z]) => rackBar(x, (RY0 + RY1) / 2, z, 0.04, RY1 - RY0, 0.04));
    rackBar(0, RY1, RZ0, RX * 2, 0.04, 0.04);
    rackBar(0, RY1, RZ1, RX * 2, 0.04, 0.04);
    rackBar(-RX, RY1, (RZ0 + RZ1) / 2, 0.04, 0.04, RZ1 - RZ0);
    rackBar(RX, RY1, (RZ0 + RZ1) / 2, 0.04, 0.04, RZ1 - RZ0);
    rackBar(-RX, (RY0 + RY1) / 2, (RZ0 + RZ1) / 2, 0.03, 0.03, RZ1 - RZ0);
    rackBar(RX, (RY0 + RY1) / 2, (RZ0 + RZ1) / 2, 0.03, 0.03, RZ1 - RZ0);

    // [P2] HOA TRÊN XE NGẬP TRÀN & RỰC RỠ (Hoa Hồng + Tulip + Daisy + Lavender + Dải hoa mui trước)
    {
      // 1. 220 Hoa hồng nhung trên nóc xe
      const nR = 220;
      const roofRoses = new THREE.InstancedMesh(makeRoseHead(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide }), nR);
      const palRoof = [0xe11d48, 0xfb7185, 0xfda4af, 0xfff1f2, 0xf43f5e, 0xfcd34d, 0xbe123c, 0xffe4e6].map((h) => new THREE.Color(h));
      for (let i = 0; i < nR; i++) {
        const px = (rand() * 2 - 1) * (RX - 0.04);
        const pz = RZ0 + 0.05 + rand() * (RZ1 - RZ0 - 0.1);
        const nx = px / RX;
        const nz = (pz - (RZ0 + RZ1) / 2) / ((RZ1 - RZ0) / 2);
        const dome = Math.max(0, 1 - nx * nx * 0.65 - nz * nz * 0.45);
        dummy.position.set(px, RY0 + 0.06 + dome * 0.42 + rand() * 0.09, pz);
        dummy.rotation.set((rand() - 0.5) * 0.8, rand() * 6.28, (rand() - 0.5) * 0.8);
        dummy.scale.setScalar(0.85 + rand() * 0.7);
        dummy.updateMatrix();
        roofRoses.setMatrixAt(i, dummy.matrix);
        roofRoses.setColorAt(i, palRoof[Math.floor(rand() * palRoof.length)]);
      }
      bodyGroup.add(roofRoses);

      // 2. 70 Hoa Tulip kiêu sa vươn cao
      const nTulip = 70;
      const roofTulips = new THREE.InstancedMesh(makeTulipHead(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, side: THREE.DoubleSide }), nTulip);
      const palTulip = [0xf43f5e, 0xfb7185, 0xfde68a, 0xf59e0b, 0xffe4e6].map((h) => new THREE.Color(h));
      for (let i = 0; i < nTulip; i++) {
        const px = (rand() * 2 - 1) * (RX - 0.12);
        const pz = RZ0 + 0.12 + rand() * (RZ1 - RZ0 - 0.24);
        const dome = Math.max(0, 1 - (px / RX) ** 2 * 0.7);
        dummy.position.set(px, RY0 + 0.14 + dome * 0.38 + rand() * 0.1, pz);
        dummy.rotation.set((rand() - 0.5) * 0.4, rand() * 6.28, (rand() - 0.5) * 0.4);
        dummy.scale.setScalar(0.75 + rand() * 0.5);
        dummy.updateMatrix();
        roofTulips.setMatrixAt(i, dummy.matrix);
        roofTulips.setColorAt(i, palTulip[Math.floor(rand() * palTulip.length)]);
      }
      bodyGroup.add(roofTulips);

      // 3. 70 Hoa Cúc Họa Mi / Daisy trắng nhụy vàng tinh khiết
      const nDaisy = 70;
      const roofDaisies = new THREE.InstancedMesh(makeDaisyHead(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, side: THREE.DoubleSide }), nDaisy);
      const palDaisy = [0xffffff, 0xfffaf0, 0xfef3c7, 0xfda4af].map((h) => new THREE.Color(h));
      for (let i = 0; i < nDaisy; i++) {
        const px = (rand() * 2 - 1) * (RX - 0.08);
        const pz = RZ0 + 0.08 + rand() * (RZ1 - RZ0 - 0.16);
        dummy.position.set(px, RY0 + 0.08 + rand() * 0.32, pz);
        dummy.rotation.set((rand() - 0.5) * 0.6, rand() * 6.28, (rand() - 0.5) * 0.6);
        dummy.scale.setScalar(0.8 + rand() * 0.55);
        dummy.updateMatrix();
        roofDaisies.setMatrixAt(i, dummy.matrix);
        roofDaisies.setColorAt(i, palDaisy[Math.floor(rand() * palDaisy.length)]);
      }
      bodyGroup.add(roofDaisies);

      // 4. 50 Cành Hoa Lavender tím pastel dịu dàng
      const nLav = 50;
      const roofLav = new THREE.InstancedMesh(makeLavenderHead(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }), nLav);
      const palLav = [0xc084fc, 0xa855f7, 0xddd6fe, 0xe879f9].map((h) => new THREE.Color(h));
      for (let i = 0; i < nLav; i++) {
        const px = (rand() * 2 - 1) * (RX - 0.15);
        const pz = RZ0 + 0.15 + rand() * (RZ1 - RZ0 - 0.3);
        dummy.position.set(px, RY0 + 0.12 + rand() * 0.35, pz);
        dummy.rotation.set((rand() - 0.5) * 0.35, rand() * 6.28, (rand() - 0.5) * 0.35);
        dummy.scale.setScalar(0.7 + rand() * 0.5);
        dummy.updateMatrix();
        roofLav.setMatrixAt(i, dummy.matrix);
        roofLav.setColorAt(i, palLav[Math.floor(rand() * palLav.length)]);
      }
      bodyGroup.add(roofLav);

      // 5. Dải hoa hồng & hoa cúc trang trí mui trước xe hoa (Front Hood / Grille Floral Garland)
      const nFront = 32;
      const frontGarland = new THREE.InstancedMesh(makeRoseHead(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, side: THREE.DoubleSide }), nFront);
      const palFront = [0xe11d48, 0xf43f5e, 0xfb7185, 0xfff1f2, 0xfde68a].map((h) => new THREE.Color(h));
      for (let i = 0; i < nFront; i++) {
        const t = (i / (nFront - 1)) * 2 - 1; // -1 to 1
        const fx = t * 0.68;
        const fy = 1.20 - (t * t) * 0.08 + rand() * 0.04;
        const fz = 1.62 + (1 - t * t) * 0.12;
        dummy.position.set(fx, fy, fz);
        dummy.rotation.set(0.4 + (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.3);
        dummy.scale.setScalar(0.75 + rand() * 0.45);
        dummy.updateMatrix();
        frontGarland.setMatrixAt(i, dummy.matrix);
        frontGarland.setColorAt(i, palFront[Math.floor(rand() * palFront.length)]);
      }
      bodyGroup.add(frontGarland);
    }

    // [P2] Túi thư + phong bì
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

    // [P2] Chùm bóng bay mini 3D gắn đuôi xe hoa (đung đưa theo nhịp xe chạy)
    const vanBalloons = [];
    {
      const bColorsVan = [0xF43F5E, 0xFB7185, 0xFBBF24, 0xC084FC, 0xFDA4AF, 0xFFE4E6, 0x38BDF8];
      const heartGeoMini = makeHeartGeometry(0.22, 0.08);
      const sphereGeoMini = new THREE.SphereGeometry(0.28, 14, 12);
      sphereGeoMini.scale(1.0, 1.25, 1.0);
      const strGeoMini = new THREE.CylinderGeometry(0.005, 0.005, 1.3, 4);
      strGeoMini.translate(0, -0.65, 0);
      const strMatMini = new THREE.MeshBasicMaterial({ color: 0xFFFBEB });

      const anchorPos = new THREE.Vector3(-RX + 0.15, RY1 + 0.1, RZ1 - 0.1);

      for (let i = 0; i < 7; i++) {
        const isH = i % 2 === 0;
        const col = bColorsVan[i % bColorsVan.length];
        const bMat = new THREE.MeshPhysicalMaterial({
          color: col,
          roughness: 0.18,
          metalness: 0.05,
          clearcoat: 1,
          transmission: 0.35,
          thickness: 0.2,
          ior: 1.45,
          envMap: envTex,
          envMapIntensity: 1.2
        });
        const bMesh = new THREE.Mesh(isH ? heartGeoMini : sphereGeoMini, bMat);
        const a = (i / 6) * Math.PI * 2;
        const rad = 0.26 + (i % 3) * 0.12;
        const bx = anchorPos.x + Math.cos(a) * rad;
        const bz = anchorPos.z + Math.sin(a) * rad - 0.18;
        const by = anchorPos.y + 0.85 + (i % 3) * 0.28;
        bMesh.position.set(bx, by, bz);
        bMesh.castShadow = true;

        const strMesh = new THREE.Mesh(strGeoMini, strMatMini);
        bMesh.add(strMesh);
        bodyGroup.add(bMesh);

        vanBalloons.push({
          mesh: bMesh,
          baseX: bx,
          baseY: by,
          baseZ: bz,
          speed: 1.2 + rand() * 0.8,
          phase: rand() * Math.PI * 2
        });
      }
    }

    // [P2] Dải đèn LED nhỏ quanh xe và hoa (124 bóng phát sáng lung linh)
    {
      const orbGeo = new THREE.SphereGeometry(0.032, 8, 6);
      let idx = 0;

      // 1. Dải LED viền quanh giá hoa trên nóc xe (48 bóng)
      const loop = [[-RX, RZ0], [RX, RZ0], [RX, RZ1], [-RX, RZ1]];
      for (let e = 0; e < 4; e++) {
        const [ax, az] = loop[e];
        const [bx, bz] = loop[(e + 1) % 4];
        for (let k = 0; k < 12; k++) {
          const t = k / 12;
          const orb = new THREE.Mesh(
            orbGeo,
            new THREE.MeshStandardMaterial({
              color: 0xfff0c0,
              emissive: idx % 2 === 0 ? 0xffc857 : 0xff8fb0,
              emissiveIntensity: 3.5,
              roughness: 0.3
            })
          );
          orb.position.set(ax + (bx - ax) * t, RY1 - 0.03 - Math.sin(t * Math.PI) * 0.07, az + (bz - az) * t);
          bodyGroup.add(orb);
          fairyOrbs.push({ orb, off: idx++ });
        }
      }

      // 2. Dải LED đan chéo giữa các khóm hoa trên mui xe (36 bóng)
      for (let k = 0; k < 36; k++) {
        const t = k / 35;
        const fx = Math.sin(t * Math.PI * 5) * (RX - 0.16);
        const fz = RZ0 + 0.1 + t * (RZ1 - RZ0 - 0.2);
        const fy = RY0 + 0.28 + Math.sin(t * Math.PI * 3) * 0.12;
        const orb = new THREE.Mesh(
          orbGeo,
          new THREE.MeshStandardMaterial({
            color: 0xfff5e6,
            emissive: idx % 2 === 0 ? 0xffd97d : 0xf43f5e,
            emissiveIntensity: 4.0,
            roughness: 0.25
          })
        );
        orb.position.set(fx, fy, fz);
        bodyGroup.add(orb);
        fairyOrbs.push({ orb, off: idx++ });
      }

      // 3. Dải LED viền quanh thân xe (skirt / running board 2 bên) (40 bóng)
      const skirtZ0 = -1.95, skirtZ1 = 1.95;
      [-1, 1].forEach((side) => {
        const sx = side * 1.04;
        for (let k = 0; k < 20; k++) {
          const t = k / 19;
          const sz = skirtZ0 + t * (skirtZ1 - skirtZ0);
          const orb = new THREE.Mesh(
            orbGeo,
            new THREE.MeshStandardMaterial({
              color: 0xfff0c0,
              emissive: 0xffd97d,
              emissiveIntensity: 3.2,
              roughness: 0.3
            })
          );
          orb.position.set(sx, 0.82 + Math.sin(t * Math.PI) * 0.04, sz);
          bodyGroup.add(orb);
          fairyOrbs.push({ orb, off: idx++ });
        }
      });
    }

    // [P2] Floating letters & hearts quanh xe
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

    // escort defined outside for renderLoop safe access

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
      return { group, wingL, wingR };
    }

    function makeCrystalHeart(idx) {
      const group = new THREE.Group();
      group.userData = { isFloatingItem: true, index: idx };
      const h = new THREE.Mesh(heartGeoItem, heartMat);
      group.add(h);
      group.add(makeGlowSprite(0xff6b8f, 1.9));
      return { group };
    }

    // floatingItems defined outside for renderLoop safe access
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

    const vanSignTex = signTexture('Chạm Mở Hòm Thư Mật 💌');
    const vanSignSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: vanSignTex, transparent: true }));
    vanSignSprite.position.set(0, 3.8, -0.6);
    vanSignSprite.scale.set(4.4, 1.1, 1);
    vanRoot.add(vanSignSprite);
  };

  scene.add(vanRoot);

    /* ---------- [P2] Gazebo ---------- */
    {
      const gazeboPt = curve.getPointAt(0.52);
      const gazT = curve.getTangentAt(0.52);
      const gazNorm = new THREE.Vector3(gazT.z, 0, -gazT.x).normalize();
      const gazPos = gazeboPt.clone().add(gazNorm.clone().multiplyScalar(8.2));
      const gazeboGroup = new THREE.Group();
      gazeboGroup.position.set(gazPos.x, heightAt(gazPos.x, gazPos.z), gazPos.z);

      const gazBase = new THREE.Mesh(
        new THREE.CylinderGeometry(5.2, 5.8, 0.5, 24),
        new THREE.MeshStandardMaterial({ color: 0xFFFDF9, roughness: 0.5 })
      );
      gazeboGroup.add(gazBase);

      const colMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.4 });
      for (let c = 0; c < 8; c++) {
        const a = (c / 8) * Math.PI * 2;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 3.8, 12), colMat);
        col.position.set(Math.cos(a) * 4.2, 2.1, Math.sin(a) * 4.2);
        gazeboGroup.add(col);
      }
      const domeMat = new THREE.MeshStandardMaterial({
        color: 0xC9A66B,
        metalness: 0.85,
        roughness: 0.25,
        envMap: envTex
      });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(4.4, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
      dome.position.y = 4.0;
      gazeboGroup.add(dome);
      scene.add(gazeboGroup);
    }

    /* ---------- [P2] Petals & Trail ---------- */
    const petalTex = petalTexture();
    const dotTex = glowTexture();
    const PETALS = Math.floor(260 * Q);
    const petalGeo = new THREE.BufferGeometry();
    const petalPos = new Float32Array(PETALS * 3);
    petalGeo.setAttribute('position', new THREE.BufferAttribute(petalPos, 3));
    const petalPts = new THREE.Points(
      petalGeo,
      new THREE.PointsMaterial({ map: petalTex, size: 0.26, transparent: true, depthWrite: false, alphaTest: 0.02, color: 0xffd0e0 })
    );
    petalPts.frustumCulled = false;
    scene.add(petalPts);

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

// ===== PHẦN 2/5 — KẾT THÚC =====
// ===== PHẦN 3/5 — BẮT ĐẦU =====
    /* ================================================================== */
    /*  [P3] STATIONS ARRAY + INTERACTIVE                                   */
    /* ================================================================== */
    const interactiveMeshes = [];

    // [TỐI ƯU CLICK XE HOA] Hitbox riêng để click không phải duyệt đệ quy cây con của xe
    if (typeof vanRoot !== 'undefined' && vanRoot) {
      const vanHitbox = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 2.2, 4.8),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      vanHitbox.position.set(0, 1.4, 0);
      vanRoot.add(vanHitbox);

      interactiveMeshes.push({
        mesh: vanHitbox,
        onClick: () => {
          playTruckHonkSound();
          fireConfetti({ particleCount: 75, spread: 85, origin: { y: 0.55 } });
          setTimeout(() => {
            playLetterOpenSound();
            setIsMailboxOpen(true);
          }, 350);
        }
      });
    }

    const stationCameraPositions = {};

    let chestAura1 = null, chestAura2 = null, cakeAura = null;

    /* ================= [P3] FIREWORKS SYSTEM ================= */
    const FW = { max: 12000, parts: [], rockets: [], lights: [], li: 0 };

    // [P3] Sprite pháo hoa sắc nét (giữ cho PHẦN 4 dùng tiếp)
    const fwTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,1)');
      gr.addColorStop(0.25, 'rgba(255,255,255,0.85)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();

    const fwGeo = new THREE.BufferGeometry();
    const fwPos = new Float32Array(FW.max * 3);
    const fwCol = new Float32Array(FW.max * 3);
    const fwLife = new Float32Array(FW.max);
    fwGeo.setAttribute('position', new THREE.BufferAttribute(fwPos, 3));
    fwGeo.setAttribute('color', new THREE.BufferAttribute(fwCol, 3));
    fwGeo.setAttribute('aLife', new THREE.BufferAttribute(fwLife, 1));
    fwGeo.setDrawRange(0, 0);

    // [P3] Material dùng shader riêng (FireworkParticleShader định nghĩa ở PHẦN 1)
    const fwMat = new THREE.ShaderMaterial({
      uniforms: {
        uTex: { value: fwTex },
        uSize: { value: 1.15 }
      },
      vertexShader: FireworkParticleShader.vertexShader,
      fragmentShader: FireworkParticleShader.fragmentShader,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const fwPoints = new THREE.Points(fwGeo, fwMat);
    fwPoints.frustumCulled = false;
    scene.add(fwPoints);

    // [P3] 4 PointLight xoay vòng cho flash
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 160, 1.5);
      scene.add(l); FW.lights.push(l);
    }
    const fwFlash = (pos, color) => {
      const l = FW.lights[FW.li++ % FW.lights.length];
      l.position.copy(pos); l.color.copy(color); l.intensity = 14;
    };

    // [P3] Âm thanh WebAudio
    let fwAC = null, fwNoise = null, lastCrackle = 0;
    const getAC = () => {
      if (!fwAC) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          fwAC = new AudioContextClass();
          const len = fwAC.sampleRate * 2;
          fwNoise = fwAC.createBuffer(1, len, fwAC.sampleRate);
          const d = fwNoise.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        }
      }
      if (fwAC && fwAC.state === 'suspended') {
        fwAC.resume().catch(() => {});
      }
      return fwAC;
    };
    const noiseSrc = (ac) => { const s = ac.createBufferSource(); s.buffer = fwNoise; return s; };

    const soundLaunch = () => {
      const ac = getAC(); if (!ac) return;
      const t = ac.currentTime;
      try {
        const s = noiseSrc(ac), f = ac.createBiquadFilter(), g = ac.createGain();
        f.type = 'bandpass'; f.Q.value = 2;
        f.frequency.setValueAtTime(500, t);
        f.frequency.exponentialRampToValueAtTime(2500, t + 1.0);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.18, t + 0.1);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
        s.connect(f).connect(g).connect(ac.destination);
        s.start(t); s.stop(t + 1.2);
      } catch (e) {}
    };
    const soundBoom = (delay = 0.05, vol = 0.7) => {
      const ac = getAC(); if (!ac) return;
      const t = ac.currentTime + delay;
      try {
        const s = noiseSrc(ac), f = ac.createBiquadFilter(), g = ac.createGain();
        f.type = 'lowpass'; f.frequency.setValueAtTime(900, t);
        f.frequency.exponentialRampToValueAtTime(80, t + 1.2);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
        s.connect(f).connect(g).connect(ac.destination);
        s.start(t); s.stop(t + 1.5);
        const o = ac.createOscillator(), og = ac.createGain();
        o.frequency.setValueAtTime(110, t);
        o.frequency.exponentialRampToValueAtTime(28, t + 0.6);
        og.gain.setValueAtTime(vol * 0.9, t);
        og.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
        o.connect(og).connect(ac.destination); o.start(t); o.stop(t + 0.8);
      } catch (e) {}
    };
    const soundCrackle = () => {
      const now = performance.now();
      if (now - lastCrackle < 120) return; lastCrackle = now;
      const ac = getAC(); if (!ac) return;
      const t0 = ac.currentTime;
      try {
        for (let i = 0; i < 8; i++) {
          const t = t0 + Math.random() * 0.6;
          const s = noiseSrc(ac), f = ac.createBiquadFilter(), g = ac.createGain();
          f.type = 'highpass'; f.frequency.value = 2500;
          g.gain.setValueAtTime(0.25, t);
          g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
          s.connect(f).connect(g).connect(ac.destination);
          s.start(t, Math.random()); s.stop(t + 0.05);
        }
      } catch (e) {}
    };

    const soundClink = () => {
      const ac = getAC(); if (!ac) return;
      const t = ac.currentTime;
      try {
        const o1 = ac.createOscillator(), g1 = ac.createGain();
        o1.type = 'sine';
        o1.frequency.setValueAtTime(2800, t);
        o1.frequency.exponentialRampToValueAtTime(2200, t + 0.9);
        g1.gain.setValueAtTime(0.35, t);
        g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
        o1.connect(g1).connect(ac.destination);
        o1.start(t); o1.stop(t + 0.95);

        const o2 = ac.createOscillator(), g2 = ac.createGain();
        o2.type = 'sine';
        o2.frequency.setValueAtTime(3600, t + 0.04);
        o2.frequency.exponentialRampToValueAtTime(2900, t + 0.85);
        g2.gain.setValueAtTime(0.2, t + 0.04);
        g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
        o2.connect(g2).connect(ac.destination);
        o2.start(t + 0.04); o2.stop(t + 0.9);
      } catch (e) {}
    };

    // [P3] Hạt pháo hoa
    const addPart = (pos, vel, color, life, decay, drag, grav, flicker = false, crackle = false) => {
      if (FW.parts.length >= FW.max) return;
      FW.parts.push({ pos: pos.clone(), vel, color, life, decay, drag, grav, flicker, crackle });
    };

    const PALETTES = [
      [0xF43F5E, 0xFDE68A], [0x38BDF8, 0xFFFFFF], [0xC084FC, 0xFDE047],
      [0x34D399, 0xFEF08A], [0xFB923C, 0xFDE68A], [0xFF4D8D, 0x60A5FA], [0xFFD700, 0xFFFFFF]
    ];
    const pickPal = () => PALETTES[Math.floor(rand() * PALETTES.length)].map(c => new THREE.Color(c));

    const randDir = () => {
      const th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
      return new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph), Math.sin(ph) * Math.sin(th));
    };

    let triggerCastleFireworks = () => {};

    /* ================================================================== */
    /*  [P3] STATION 0 — GIFT BOX                                          */
    /* ================================================================== */
    {
      const pt = curve.getPointAt(STATIONS[0].u);
      const T = curve.getTangentAt(STATIONS[0].u);
      const norm = new THREE.Vector3(T.z, 0, -T.x).normalize();
      const st0Center = pt.clone().add(norm.clone().multiplyScalar(6.5));
      const st0Group = new THREE.Group();
      st0Group.position.set(st0Center.x, heightAt(st0Center.x, st0Center.z), st0Center.z);

      const pl = new THREE.Mesh(
        new THREE.CylinderGeometry(5.2, 5.6, 0.4, 32),
        new THREE.MeshStandardMaterial({ color: 0xFFFAF3, roughness: 0.6 })
      );
      st0Group.add(pl);

      // [P3] Nhung hồng có clearcoat nhẹ
      const giftBodyMat = new THREE.MeshPhysicalMaterial({
        color: 0xFB7185,
        roughness: 0.35,
        metalness: 0.2,
        clearcoat: 0.5,
        clearcoatRoughness: 0.3,
        sheen: 0.6,
        sheenColor: new THREE.Color(0xFFD0E0),
        sheenRoughness: 0.5,
        envMap: envTex
      });
      const ribbonMat = new THREE.MeshStandardMaterial({ color: 0xE5C388, metalness: 0.85, roughness: 0.25, envMap: envTex });
      const bodyBox = new THREE.Mesh(new RoundedBoxGeometry(2.4, 2.0, 2.4, 5, 0.12), giftBodyMat);
      bodyBox.position.y = 1.2;
      bodyBox.castShadow = true;
      bodyBox.receiveShadow = true;
      st0Group.add(bodyBox);

      const rH = new THREE.Mesh(new THREE.BoxGeometry(2.46, 2.02, 0.45), ribbonMat);
      rH.position.y = 1.2;
      st0Group.add(rH);
      const rV = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.02, 2.46), ribbonMat);
      rV.position.y = 1.2;
      st0Group.add(rV);

      const lidGroup = new THREE.Group();
      lidGroup.position.set(0, 2.25, 0);
      const lidBox = new THREE.Mesh(new RoundedBoxGeometry(2.55, 0.45, 2.55, 4, 0.08), giftBodyMat);
      lidGroup.add(lidBox);
      const lidRH = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.47, 0.46), ribbonMat);
      lidGroup.add(lidRH);
      const lidRV = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.47, 2.58), ribbonMat);
      lidGroup.add(lidRV);

      const bowL = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.14, 8, 20), ribbonMat);
      bowL.rotation.z = Math.PI / 4;
      bowL.rotation.y = 0.4;
      bowL.position.set(-0.35, 0.5, 0);
      lidGroup.add(bowL);
      const bowR = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.14, 8, 20), ribbonMat);
      bowR.rotation.z = -Math.PI / 4;
      bowR.rotation.y = -0.4;
      bowR.position.set(0.35, 0.5, 0);
      lidGroup.add(bowR);
      st0Group.add(lidGroup);
      giftAnimationRef.current.lidMesh = lidGroup;

      // Bướm
      const butterflyGroup = new THREE.Group();
      const bPal = [0xf43f5e, 0xfbbf24, 0x60a5fa, 0x34d399, 0xa78bfa, 0xf472b6];
      const butterflyObjs = [];
      for (let b = 0; b < 10; b++) {
        const bGroup = new THREE.Group();
        const wingShape = new THREE.Shape();
        wingShape.moveTo(0, 0);
        wingShape.bezierCurveTo(0.1, 0.25, 0.35, 0.3, 0.5, 0.1);
        wingShape.bezierCurveTo(0.35, -0.15, 0.1, -0.05, 0, 0);
        const wMat = new THREE.MeshPhysicalMaterial({
          color: bPal[b % bPal.length],
          side: THREE.DoubleSide,
          emissive: bPal[b % bPal.length],
          emissiveIntensity: 0.35,
          sheen: 0.8,
          sheenColor: new THREE.Color(0xFFFFFF),
          transmission: 0.15,
          thickness: 0.02
        });
        const wGeo = new THREE.ShapeGeometry(wingShape, 6);
        const wingLeft = new THREE.Mesh(wGeo, wMat);
        const wingRight = new THREE.Mesh(wGeo, wMat);
        wingRight.scale.x = -1;
        wingLeft.castShadow = false;
        wingLeft.receiveShadow = false;
        wingRight.castShadow = false;
        wingRight.receiveShadow = false;
        bGroup.add(wingLeft, wingRight);
        bGroup.position.set((rand() - 0.5) * 1.2, 1.2, (rand() - 0.5) * 1.2);
        const baseScale = 0.7 + rand() * 0.5;
        bGroup.scale.setScalar(0.0001); // Precompile sẵn để không giật khung hình
        bGroup.visible = true;
        butterflyGroup.add(bGroup);
        butterflyObjs.push({
          group: bGroup,
          wingLeft,
          wingRight,
          baseScale,
          initialPos: bGroup.position.clone(),
          targetOffset: new THREE.Vector3((rand() - 0.5) * 6, 4 + rand() * 5, (rand() - 0.5) * 6),
          speed: 1.5 + rand() * 1.5
        });
      }
      st0Group.add(butterflyGroup);
      giftAnimationRef.current.butterflies = butterflyObjs;

      // Bóng bay mini
      const balloonObjs = [];
      const miniBMat = [0xf43f5e, 0xfb7185, 0xfbbf24, 0xc084fc, 0x38bdf8];
      for (let m = 0; m < 8; m++) {
        const spMesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.35, 16, 16).scale(1, 1.2, 1),
          new THREE.MeshPhysicalMaterial({
            color: miniBMat[m % miniBMat.length],
            roughness: 0.15,
            metalness: 0.1,
            clearcoat: 1,
            clearcoatRoughness: 0.1,
            transmission: 0.35,
            thickness: 0.15,
            envMap: envTex
          })
        );
        spMesh.position.set((rand() - 0.5) * 0.8, 1.3, (rand() - 0.5) * 0.8);
        spMesh.castShadow = false;
        spMesh.receiveShadow = false;
        spMesh.scale.setScalar(0.0001);
        spMesh.visible = true;
        st0Group.add(spMesh);
        balloonObjs.push({
          mesh: spMesh,
          initialPos: spMesh.position.clone(),
          targetOffset: new THREE.Vector3((rand() - 0.5) * 4, 5 + rand() * 6, (rand() - 0.5) * 4),
          speed: 1.2 + rand() * 1.0
        });
      }
      giftAnimationRef.current.balloons = balloonObjs;

      // Crystal heart
      const crystalHeartGeo = makeHeartGeometry(0.55, 0.2);
      const crystalHeartMat = new THREE.MeshPhysicalMaterial({
        color: 0xFF2A55,
        roughness: 0.12,
        metalness: 0.2,
        transmission: 0.75,
        thickness: 0.6,
        emissive: 0xBE123C,
        emissiveIntensity: 1.4,
        envMap: envTex
      });
      const crystalHeart = new THREE.Mesh(crystalHeartGeo, crystalHeartMat);
      crystalHeart.position.set(0, 1.2, 0);
      crystalHeart.castShadow = false;
      crystalHeart.receiveShadow = false;
      crystalHeart.scale.setScalar(0.0001);
      crystalHeart.visible = true;
      st0Group.add(crystalHeart);
      giftAnimationRef.current.crystalHeart = crystalHeart;

      const heartHalo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, color: 0xFDE68A, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending
      }));
      heartHalo.scale.set(0.0001, 0.0001, 1);
      heartHalo.position.set(0, 1.2, 0);
      heartHalo.visible = true;
      st0Group.add(heartHalo);
      giftAnimationRef.current.heartHalo = heartHalo;

      const welcomeSignTex = signTexture(`Chào Mừng ${sisterName} • Hành Trình 20/10 ✨`);
      const welcomeSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: welcomeSignTex, transparent: true }));
      welcomeSprite.position.set(0, 1.2, 0);
      welcomeSprite.scale.set(0.0001, 0.0001, 1);
      welcomeSprite.visible = true;
      st0Group.add(welcomeSprite);
      giftAnimationRef.current.welcomeSign = welcomeSprite;

      const giftSignTex = signTexture('Mở Hộp Quà 20/10');
      const giftSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: giftSignTex, transparent: true }));
      giftSprite.position.set(0, 4.4, 0);
      giftSprite.scale.set(4.2, 1.05, 1);
      st0Group.add(giftSprite);

      scene.add(st0Group);

      const onGiftClick = () => {
        playSparkleSound();
        giftAnimationRef.current.opened = true;
        fireConfetti({
          particleCount: 80,
          spread: 90,
          origin: { y: 0.55 },
          colors: ['#F43F5E', '#FDA4AF', '#FCD34D', '#FFF1F2', '#E11D48'],
          ticks: 200,
          disableForReducedMotion: true
        });
        showToast(`🎁 Điều kỳ diệu đã xuất hiện! Dành tặng riêng đóa hoa ${sisterName}...`);
        setTimeout(() => { flyToStation(1, 3200); }, 4200);
      };

      interactiveMeshes.push({ mesh: bodyBox, onClick: onGiftClick });
      interactiveMeshes.push({ mesh: lidBox, onClick: onGiftClick });
      interactiveMeshes.push({ mesh: giftSprite, onClick: onGiftClick });
      interactiveMeshes.push({ mesh: crystalHeart, onClick: onGiftClick });

      // [P3] Góc nhìn chính diện trực tiếp mặt trước hộp quà (căn thẳng trục nơ vàng & bảng chữ)
      stationCameraPositions[0] = {
        targetPos: st0Center.clone().add(new THREE.Vector3(0, 1.45, 0)),
        camPos: st0Center.clone().add(new THREE.Vector3(0, 3.6, 12.6))
      };
    }

    /* ================================================================== */
    /*  [P3] STATION 1 — LETTER (PBR thiệp nâng cấp)                       */
    /* ================================================================== */
    const buildStation1 = () => {
      const pt = curve.getPointAt(STATIONS[1].u);
      const T = curve.getTangentAt(STATIONS[1].u);
      const norm = new THREE.Vector3(T.z, 0, -T.x).normalize();
      const st1Center = pt.clone().add(norm.clone().multiplyScalar(7.2));
      const st1Group = new THREE.Group();
      st1Group.position.set(st1Center.x, heightAt(st1Center.x, st1Center.z), st1Center.z);
      st1Group.rotation.set(0, Math.atan2(norm.x, norm.z), 0);

      const pl = new THREE.Mesh(
        new THREE.CylinderGeometry(7.2, 7.8, 0.45, 32),
        new THREE.MeshStandardMaterial({ color: 0xFFFAF3, roughness: 0.6 })
      );
      st1Group.add(pl);

      const bifoldRoot = new THREE.Group();
      bifoldRoot.position.set(0, 2.4, 0);

      // [P3] Thiệp giấy mỹ thuật có sheen nhẹ
      const cardMat = new THREE.MeshPhysicalMaterial({
        color: 0xFAF3EA,
        roughness: 0.82,
        metalness: 0.02,
        sheen: 0.3,
        sheenColor: new THREE.Color(0xFFF5E0),
        clearcoat: 0.08,
        envMap: envTex
      });
      const goldFrameMat = new THREE.MeshStandardMaterial({ color: 0xE5C388, metalness: 0.85, roughness: 0.25, envMap: envTex });

      const leftWing = new THREE.Mesh(new RoundedBoxGeometry(3.4, 4.4, 0.14, 4, 0.04), cardMat);
      leftWing.position.set(-1.75, 0, 0.35);
      leftWing.rotation.y = 0.22;
      leftWing.castShadow = true;
      leftWing.receiveShadow = true;
      bifoldRoot.add(leftWing);

      const photoFrame = new THREE.Mesh(new THREE.BoxGeometry(2.7, 3.5, 0.04), goldFrameMat);
      photoFrame.position.set(0, 0.2, 0.05);
      leftWing.add(photoFrame);

      // [FALLBACK THIẾU ẢNH THẬT] Hiển thị ảnh chân dung hoặc Thẻ chữ ký nghệ thuật (Mẫu chuẩn Ảnh 2)
      const hasPhoto = Boolean(selectedSister && selectedSister.photo && selectedSister.has_consent !== false);
      const photoMat = new THREE.MeshStandardMaterial({
        roughness: 0.82,
        metalness: 0.02
      });
      photoMat.polygonOffset = true;
      photoMat.polygonOffsetFactor = -1;

      if (hasPhoto) {
        new THREE.TextureLoader().load(
          selectedSister.photo,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 4;
            photoMat.map = tex;
            photoMat.emissiveMap = tex;
            photoMat.emissive = new THREE.Color(0xffffff);
            photoMat.emissiveIntensity = isNightMode ? 0.45 : 0.15;
            photoMat.needsUpdate = true;
          },
          undefined,
          () => {
            // Lỗi tải ảnh -> Fallback sang thẻ chữ ký nghệ thuật
            const sigCanvas = createSignatureCardCanvas(sisterName, '', 800, 1060);
            const sigTex = new THREE.CanvasTexture(sigCanvas);
            sigTex.colorSpace = THREE.SRGBColorSpace;
            sigTex.anisotropy = 4;
            photoMat.map = sigTex;
            photoMat.emissiveMap = sigTex;
            photoMat.emissive = new THREE.Color(0xffffff);
            photoMat.emissiveIntensity = isNightMode ? 0.45 : 0.15;
            photoMat.needsUpdate = true;
          }
        );
      } else {
        // Chị em chưa có ảnh -> Dùng thẻ chữ ký nghệ thuật phong cách calligraphy cổ điển (chống lóa & tràn đầy)
        const sigCanvas = createSignatureCardCanvas(sisterName, '', 800, 1060);
        const sigTex = new THREE.CanvasTexture(sigCanvas);
        sigTex.colorSpace = THREE.SRGBColorSpace;
        sigTex.anisotropy = 4;
        photoMat.map = sigTex;
        photoMat.emissiveMap = sigTex;
        photoMat.emissive = new THREE.Color(0xffffff);
        photoMat.emissiveIntensity = isNightMode ? 0.45 : 0.15;
        photoMat.needsUpdate = true;
      }

      const photoMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 3.3), photoMat);
      photoMesh.position.set(0, 0.2, 0.10);
      leftWing.add(photoMesh);

      const namePlate = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.45, 0.03), goldFrameMat);
      namePlate.position.set(0, -1.7, 0.08);
      leftWing.add(namePlate);

      const rightWing = new THREE.Mesh(new RoundedBoxGeometry(3.4, 4.4, 0.14, 4, 0.04), cardMat);
      rightWing.position.set(1.75, 0, 0.35);
      rightWing.rotation.y = -0.22;
      rightWing.castShadow = true;
      rightWing.receiveShadow = true;
      bifoldRoot.add(rightWing);

      // Nội dung thư — Nâng cấp canvas 800x1060 trải rộng, chữ to rõ, chuẩn phong cách Editorial (giống 2D)
      const letterCanvas = document.createElement('canvas');
      letterCanvas.width = 800;
      letterCanvas.height = 1060;
      const lG = letterCanvas.getContext('2d');

      // 1. Nền giấy da ngà mỹ thuật cao cấp
      const bgGrad = lG.createLinearGradient(0, 0, 0, 1060);
      bgGrad.addColorStop(0, '#FFFFFF');
      bgGrad.addColorStop(0.3, '#FFFDF8');
      bgGrad.addColorStop(1, '#F6EEE3');
      lG.fillStyle = bgGrad;
      lG.fillRect(0, 0, 800, 1060);

      // 2. Khung viền đôi mạ vàng trang nhã
      lG.strokeStyle = '#C9A66B';
      lG.lineWidth = 4;
      lG.strokeRect(22, 22, 756, 1016);
      lG.strokeStyle = 'rgba(201, 166, 107, 0.45)';
      lG.lineWidth = 1.5;
      lG.strokeRect(32, 32, 736, 996);

      // 4 Họa tiết Baroque góc
      lG.fillStyle = '#B8860B';
      lG.font = '22px serif';
      lG.fillText('❧', 42, 58);
      lG.fillText('☙', 742, 58);
      lG.fillText('❧', 42, 1014);
      lG.fillText('☙', 742, 1014);

      // 3. Header đề mục tri ân
      lG.fillStyle = '#BE123C';
      lG.font = '700 14px "Be Vietnam Pro", sans-serif';
      lG.fillText('✦ THƯ TRI ÂN TỪ CÁNH NAM IT ✦', 55, 76);

      // 4. Lời đề từ kính gửi (Salutation)
      const cleanSisterName = (sisterName || 'Bạn').replace(/^(Chị\s+|Em\s+)/i, '').trim() || 'Bạn';
      lG.fillStyle = '#881337';
      lG.font = 'italic bold 34px "Playfair Display", Georgia, serif';
      const salutationText = cleanSisterName === 'Bạn' ? 'Thân Gửi Bạn,' : `Thân Gửi Chị ${cleanSisterName},`;
      lG.fillText(salutationText, 55, 122);

      // Đường kẻ chỉ vàng trang trí
      lG.strokeStyle = 'rgba(201, 166, 107, 0.55)';
      lG.lineWidth = 1.5;
      lG.beginPath();
      lG.moveTo(55, 142);
      lG.lineTo(745, 142);
      lG.stroke();

      // Hàm ngắt dòng canvas thông minh
      const wrapCanvasText = (ctx, text, x, y, maxWidth, lineHeight) => {
        const words = text.split(' ');
        let line = '';
        let curY = y;
        for (let n = 0; n < words.length; n++) {
          const testLine = line + words[n] + ' ';
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, curY);
            line = words[n] + ' ';
            curY += lineHeight;
          } else {
            line = testLine;
          }
        }
        ctx.fillText(line, x, curY);
        return curY;
      };

      const wishHighlight = typeof cardWish === 'object' && cardWish.highlight ? cardWish.highlight : cardWish;
      const wishMessage = typeof cardWish === 'object' && cardWish.message
        ? cardWish.message
        : 'Cảm ơn sự nhiệt tình, những nỗ lực và nguồn năng lượng tích cực mà bạn mang đến cho mọi người. Nhân ngày 20/10, chúc bạn luôn được yêu thương, gặp thật nhiều may mắn và cuộc sống ngập tràn niềm vui!';

      // 5. Câu chúc nổi bật (Wine red, nghiêng, to rõ, độ tương phản cao)
      lG.fillStyle = '#7A0C2E';
      lG.font = 'italic 700 24px "Playfair Display", "Be Vietnam Pro", serif';
      const afterWishY = wrapCanvasText(lG, `“${wishHighlight}”`, 55, 190, 690, 42);

      // 6. Đoạn tâm tình chân thành (dày dặn, thoáng đãng, dễ đọc, màu đậm nét)
      lG.fillStyle = '#0F172A';
      lG.font = '500 21px "Be Vietnam Pro", sans-serif';
      const afterBodyY = wrapCanvasText(lG, wishMessage, 55, afterWishY + 38, 690, 36);

      // 7. Lời chúc kết và chữ ký (đồng bộ hoàn toàn với bản 2D)
      const signY = Math.max(afterBodyY + 48, 650);
      lG.fillStyle = '#7A0C2E';
      lG.font = 'italic 700 22px "Playfair Display", Georgia, serif';
      lG.fillText('Chúc chị mãi rạng rỡ, tự tin và toả sáng! 💐', 55, signY);

      lG.fillStyle = '#92400E';
      lG.font = '700 18px "Be Vietnam Pro", sans-serif';
      lG.fillText('— Toàn thể anh em Tech & Product —', 55, signY + 36);

      // 8. Họa tiết hoa văn tinh tế phía trên con dấu sáp 3D
      lG.fillStyle = 'rgba(201, 166, 107, 0.75)';
      lG.font = '22px serif';
      lG.textAlign = 'center';
      lG.fillText('❖  ✦  ❖', 400, 835);
      lG.textAlign = 'left';

      const letterTex = new THREE.CanvasTexture(letterCanvas);
      letterTex.colorSpace = THREE.SRGBColorSpace;
      letterTex.anisotropy = 4;
      const letterMat = new THREE.MeshStandardMaterial({
        map: letterTex,
        emissiveMap: letterTex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: isNightMode ? 0.55 : 0.18,
        roughness: 0.82,
        metalness: 0.02
      });
      letterMat.polygonOffset = true;
      letterMat.polygonOffsetFactor = -1;
      const letterMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 4.0), letterMat);
      letterMesh.position.set(0, 0, 0.10);
      rightWing.add(letterMesh);
      worldAtmosphereRef.current.letterMat = letterMat;

      // [P3] KHUNG VIỀN KIM LOẠI VÀNG 3D CHO LÁ THƯ TRI ÂN
      const frameGeo = new THREE.BoxGeometry(3.14, 4.14, 0.06);
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0xC9A66B,
        roughness: 0.28,
        metalness: 0.85,
        envMap: envTex,
        envMapIntensity: 1.2
      });
      const letterFrame = new THREE.Mesh(frameGeo, frameMat);
      letterFrame.position.set(0, 0, 0.05);
      rightWing.add(letterFrame);

      // [P3] CON DẤU SÁP ĐỎ 3D NỔI VỚI VÀNH KHUY VÀNG CHAMPAGNE (Thay thế hình vẽ 2D bẹt)
      const sealGroup = new THREE.Group();
      sealGroup.position.set(0, -1.35, 0.14);

      const waxCylinderGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.06, 32);
      waxCylinderGeo.rotateX(Math.PI / 2);
      const waxMat = new THREE.MeshStandardMaterial({
        color: 0xBE123C,
        roughness: 0.32,
        metalness: 0.1
      });
      const waxMesh = new THREE.Mesh(waxCylinderGeo, waxMat);
      sealGroup.add(waxMesh);

      const goldRimGeo = new THREE.TorusGeometry(0.26, 0.022, 16, 32);
      const goldRimMesh = new THREE.Mesh(goldRimGeo, frameMat);
      sealGroup.add(goldRimMesh);

      const heartEmblem = new THREE.Mesh(makeHeartGeometry(0.12, 0.04), frameMat);
      heartEmblem.position.set(0, -0.02, 0.035);
      heartEmblem.scale.set(0.9, 0.9, 0.9);
      sealGroup.add(heartEmblem);

      rightWing.add(sealGroup);

      const letterLight = new THREE.PointLight(0xffecd0, 1.8, 8.5);
      letterLight.position.set(1.75, 2.2, 1.8);
      st1Group.add(letterLight);

      st1Group.add(bifoldRoot);
      scene.add(st1Group);

      interactiveMeshes.push({
        mesh: leftWing,
        onClick: () => {
          playLetterOpenSound();
          fireConfetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
          showToast(`🌸 Vinh danh đóa hoa rạng rỡ: ${sisterName}!`);
        }
      });
      interactiveMeshes.push({
        mesh: rightWing,
        onClick: () => {
          playLetterOpenSound();
          fireConfetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
          showToast('💌 Thư ngỏ chân tình từ toàn thể anh em công ty gửi tặng chị em!');
        }
      });
      interactiveMeshes.push({
        mesh: waxMesh,
        onClick: () => {
          playLetterOpenSound();
          fireConfetti({ particleCount: 70, spread: 85, origin: { y: 0.6 } });
          showToast('💌 Con dấu sáp hoàng gia 20.10 chứng nhận tình cảm trân quý từ anh em!');
        }
      });

      stationCameraPositions[1] = {
        targetPos: st1Center.clone().add(new THREE.Vector3(0, 2.2, 0)),
        camPos: st1Center.clone().add(norm.clone().multiplyScalar(10.8)).add(new THREE.Vector3(0, 3.8, 0))
      };
    };

    /* ================================================================== */
    /*  [P3] STATION 2 — BALLOONS (PBR bóng bay)                          */
    /* ================================================================== */
    const buildStation2 = () => {
      const pt = curve.getPointAt(STATIONS[2].u);
      const T = curve.getTangentAt(STATIONS[2].u);
      const norm = new THREE.Vector3(T.z, 0, -T.x).normalize();
      const st2Center = pt.clone().add(norm.clone().multiplyScalar(6.5));
      const st2Group = new THREE.Group();
      st2Group.position.set(st2Center.x, heightAt(st2Center.x, st2Center.z), st2Center.z);

      const heartGeo = makeHeartGeometry(0.35, 0.12);
      const sphereGeo = new THREE.SphereGeometry(0.72, 20, 16);
      sphereGeo.scale(1.0, 1.25, 1.0);

      const bColors = [0xF43F5E, 0xFB7185, 0xFBBF24, 0xC084FC, 0xFDA4AF, 0xE11D48, 0xFFE4E6, 0x38BDF8];
      const stringGeo = new THREE.CylinderGeometry(0.006, 0.006, 2.2, 4);
      stringGeo.translate(0, -1.1, 0);
      const stringMat = new THREE.MeshBasicMaterial({ color: 0xFFFBEB });

      // [P3] TĂNG BÓNG BAY 3D (36 bóng bay đa tầng PBR có đung đưa nhịp nhàng)
      const balloonMeshes = [];
      const nBalloons = 36;
      const bColorsExtended = [
        0xF43F5E, 0xFB7185, 0xFBBF24, 0xC084FC, 0xFDA4AF, 0xE11D48, 0xFFE4E6, 0x38BDF8, 0xF59E0B, 0xEC4899, 0xD946EF, 0xFFF1F2
      ];

      for (let i = 0; i < nBalloons; i++) {
        const isH = i % 2 === 0;
        const col = bColorsExtended[i % bColorsExtended.length];
        const bMat = new THREE.MeshPhysicalMaterial({
          color: col,
          roughness: 0.16,
          metalness: 0.05,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          transmission: 0.38,
          thickness: 0.28,
          ior: 1.45,
          envMap: envTex,
          envMapIntensity: 1.3
        });
        const bMesh = new THREE.Mesh(isH ? heartGeo : sphereGeo, bMat);

        // Phân bổ bóng bay thành vòm cung 360 độ đa tầng
        const angle = -2.2 + (i / (nBalloons - 1)) * 4.4;
        const tier = i % 4; // 4 tầng độ cao
        const rad = 2.4 + (i % 3) * 0.65 + (rand() - 0.5) * 0.35;
        const bY = 1.1 + tier * 0.72 + Math.sin(i * 1.35) * 0.28;
        const posX = Math.sin(angle) * rad;
        const posZ = Math.cos(angle) * rad * 0.55;

        bMesh.position.set(posX, bY, posZ);
        bMesh.rotation.y = (rand() - 0.5) * 0.8;
        bMesh.castShadow = true;

        // Dây bóng bay rủ xuống với độ dài thích ứng theo bY
        const strLen = Math.max(1.4, bY + 0.2);
        const dynamicStrGeo = new THREE.CylinderGeometry(0.005, 0.005, strLen, 4);
        dynamicStrGeo.translate(0, -strLen / 2, 0);
        const strMesh = new THREE.Mesh(dynamicStrGeo, stringMat);
        bMesh.add(strMesh);
        st2Group.add(bMesh);

        // Dữ liệu đung đưa tự nhiên theo gió
        bMesh.userData = {
          baseX: posX,
          baseY: bY,
          baseZ: posZ,
          speed: 0.85 + rand() * 0.75,
          phase: rand() * Math.PI * 2,
          swayAmpX: 0.08 + rand() * 0.08,
          swayAmpY: 0.12 + rand() * 0.10,
          swayAmpZ: 0.06 + rand() * 0.07,
          rotAmp: 0.08 + rand() * 0.06
        };

        const wishData = (wishes && wishes.length > 0)
          ? wishes[i % wishes.length]
          : {
            id: `wish_${i}`, name: 'Đồng Nghiệp IT', dept: 'Engineering Team',
            text: 'Chúc bạn ngày 20/10 rạng rỡ, xinh đẹp và luôn đón nhận niềm vui bất ngờ trong cuộc sống!'
          };

        interactiveMeshes.push({
          mesh: bMesh,
          onClick: () => {
            bMesh.visible = false;
            playPopSound();
            fireConfetti({
              particleCount: 80, spread: 90, origin: { y: 0.5 },
              colors: ['#F43F5E', '#FDA4AF', '#FCD34D', '#FFF']
            });
            showToast('🎈 Bóng bay nổ bung! Một lời chúc ngọt ngào đã hiện ra!');
            setActiveModalWish(wishData);
          }
        });
        balloonMeshes.push(bMesh);
      }

      scene.add(st2Group);
      worldAtmosphereRef.current.balloonMeshes = balloonMeshes;

      stationCameraPositions[2] = {
        targetPos: st2Center.clone().add(new THREE.Vector3(0, 2.6, 0)),
        camPos: st2Center.clone().add(norm.clone().multiplyScalar(14.5)).add(new THREE.Vector3(0, 5.5, 0))
      };
    };

    /* ================================================================== */
    /*  [P3] STATION 4 — CINEMA                                            */
    /* ================================================================== */
    const buildStation4 = () => {
      const pt = curve.getPointAt(STATIONS[4].u);
      const T = curve.getTangentAt(STATIONS[4].u);
      const norm = new THREE.Vector3(T.z, 0, -T.x).normalize();
      const st4Center = pt.clone().add(norm.clone().multiplyScalar(7.5));
      const st4Group = new THREE.Group();
      st4Group.position.set(st4Center.x, heightAt(st4Center.x, st4Center.z), st4Center.z);
      st4Group.rotation.set(0, Math.atan2(norm.x, norm.z), 0);

      const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3d28, roughness: 0.85 });
      const deck = new THREE.Mesh(new THREE.CylinderGeometry(8.0, 8.5, 0.4, 32), woodMat);
      deck.receiveShadow = true;
      st4Group.add(deck);

      const screenFrameMat = new THREE.MeshStandardMaterial({ color: 0x2A0B18, roughness: 0.6 });
      const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(6.4, 3.8, 0.2), screenFrameMat);
      screenFrame.position.set(0, 2.6, 0);
      screenFrame.castShadow = true;
      screenFrame.receiveShadow = true;

      const scCanvas = document.createElement('canvas');
      scCanvas.width = 1024; scCanvas.height = 576;
      const scG = scCanvas.getContext('2d');

      // Gradient background
      const bgGrad = scG.createLinearGradient(0, 0, 0, 576);
      bgGrad.addColorStop(0, '#260B1E');
      bgGrad.addColorStop(0.5, '#150610');
      bgGrad.addColorStop(1, '#0C0309');
      scG.fillStyle = bgGrad;
      scG.fillRect(0, 0, 1024, 576);

      // Gold ornate border
      scG.strokeStyle = '#D4AF37';
      scG.lineWidth = 8;
      scG.strokeRect(18, 18, 988, 540);
      scG.strokeStyle = 'rgba(253, 230, 138, 0.4)';
      scG.lineWidth = 2;
      scG.strokeRect(28, 28, 968, 520);

      // Top Tag
      scG.fillStyle = '#FDA4AF';
      scG.font = 'bold 24px monospace';
      scG.textAlign = 'center';
      scG.fillText('🎬 TECHCORP ROYAL CINEMA • 20/10 SPECIAL', 512, 75);

      // Title
      scG.fillStyle = '#FAF3EA';
      scG.font = 'italic bold 44px "Playfair Display", Georgia, serif';
      scG.fillText('Tuyển Tập 5 Thước Phim Tri Ân Phái Đẹp', 512, 140);

      // Subtitle
      scG.fillStyle = '#FDE68A';
      scG.font = '600 22px "Be Vietnam Pro", sans-serif';
      scG.fillText('Các clip tri ân chân thành từ tập thể anh em công ty:', 512, 185);

      // 5 Video Options Pills on 3D canvas
      const pillData = [
        { name: '👑 Leader FE', color: '#BE123C' },
        { name: '🐜 Râu con kiến', color: '#9D174D' },
        { name: '🛡️ Cửu bảo', color: '#831843' },
        { name: '⚔️ Lính', color: '#701A75' },
        { name: '🍳 Food Reviewer', color: '#B45309' }
      ];

      // Draw Row 1: 3 pills
      const row1 = pillData.slice(0, 3);
      const r1W = 190, r1H = 50, r1Gap = 20;
      const startX1 = 512 - ((3 * r1W + 2 * r1Gap) / 2);
      row1.forEach((p, i) => {
        const px = startX1 + i * (r1W + r1Gap);
        const py = 225;
        scG.fillStyle = 'rgba(255, 255, 255, 0.08)';
        scG.strokeStyle = '#C9A66B';
        scG.lineWidth = 2;
        scG.beginPath();
        scG.roundRect(px, py, r1W, r1H, 25);
        scG.fill();
        scG.stroke();

        scG.fillStyle = '#FFF';
        scG.font = 'bold 20px "Be Vietnam Pro", sans-serif';
        scG.fillText(p.name, px + r1W / 2, py + 32);
      });

      // Draw Row 2: 2 pills
      const row2 = pillData.slice(3, 5);
      const r2W = 190, r2H = 50, r2Gap = 20;
      const startX2 = 512 - ((2 * r2W + 1 * r2Gap) / 2);
      row2.forEach((p, i) => {
        const px = startX2 + i * (r2W + r2Gap);
        const py = 295;
        scG.fillStyle = 'rgba(255, 255, 255, 0.08)';
        scG.strokeStyle = '#C9A66B';
        scG.lineWidth = 2;
        scG.beginPath();
        scG.roundRect(px, py, r2W, r2H, 25);
        scG.fill();
        scG.stroke();

        scG.fillStyle = '#FFF';
        scG.font = 'bold 20px "Be Vietnam Pro", sans-serif';
        scG.fillText(p.name, px + r2W / 2, py + 32);
      });

      // Center Big Call To Action Button
      scG.fillStyle = '#BE123C';
      scG.strokeStyle = '#FDE68A';
      scG.lineWidth = 3;
      scG.beginPath();
      scG.roundRect(512 - 280, 400, 560, 68, 34);
      scG.fill();
      scG.stroke();

      scG.fillStyle = '#FFFFFF';
      scG.font = 'bold 26px "Be Vietnam Pro", sans-serif';
      scG.fillText('▶ CHẠM ĐỂ MỞ PHÒNG CHIẾU 5 VIDEO', 512, 442);

      scG.fillStyle = 'rgba(254, 243, 199, 0.85)';
      scG.font = '17px "Be Vietnam Pro", sans-serif';
      scG.fillText('(Hỗ trợ chuyển tập tự động & phát âm thanh HD)', 512, 505);

      const scTex = new THREE.CanvasTexture(scCanvas);
      scTex.colorSpace = THREE.SRGBColorSpace;
      const screenMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(6.2, 3.6),
        new THREE.MeshBasicMaterial({ map: scTex })
      );
      screenMesh.position.set(0, 0, 0.12);
      screenFrame.add(screenMesh);
      st4Group.add(screenFrame);

      // Marquee 3D Sign above cinema frame
      const signCanvas = document.createElement('canvas');
      signCanvas.width = 512; signCanvas.height = 120;
      const signG = signCanvas.getContext('2d');
      signG.fillStyle = '#1E0F18';
      signG.fillRect(0, 0, 512, 120);
      signG.strokeStyle = '#D4AF37';
      signG.lineWidth = 5;
      signG.strokeRect(6, 6, 500, 108);
      signG.fillStyle = '#FDE68A';
      signG.font = 'bold 26px "Playfair Display", Georgia, serif';
      signG.textAlign = 'center';
      signG.fillText('✨ RẠP CHIẾU 5 VIDEO TRI ÂN ✨', 256, 52);
      signG.fillStyle = '#FDA4AF';
      signG.font = 'bold 18px monospace';
      signG.fillText('TECHCORP GALA • 20.10', 256, 90);

      const signTex = new THREE.CanvasTexture(signCanvas);
      signTex.colorSpace = THREE.SRGBColorSpace;
      const signMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(4.2, 1.0),
        new THREE.MeshBasicMaterial({ map: signTex })
      );
      signMesh.position.set(0, 4.85, 0.15);
      st4Group.add(signMesh);

      for (let f = 0; f < 12; f++) {
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0xFDE68A }));
        const bx = -3.2 + (f / 11) * 6.4;
        bulb.position.set(bx, 4.6 + Math.sin((f / 11) * Math.PI) * 0.4, 0.2);
        st4Group.add(bulb);
      }

      scene.add(st4Group);

      const openCinemaModal = () => {
        setActiveVideoModal(true);
        showToast('🎬 Mở phòng chiếu 5 video tri ân 20/10!');
      };

      interactiveMeshes.push({
        mesh: screenMesh,
        onClick: openCinemaModal
      });
      interactiveMeshes.push({
        mesh: signMesh,
        onClick: openCinemaModal
      });
      interactiveMeshes.push({
        mesh: screenFrame,
        onClick: openCinemaModal
      });

      stationCameraPositions[4] = {
        targetPos: st4Center.clone().add(new THREE.Vector3(0, 2.5, 0)),
        camPos: st4Center.clone().add(norm.clone().multiplyScalar(12.8)).add(new THREE.Vector3(0, 4.8, 0))
      };
    };

    /* ================================================================== */
    /*  [P3] STATION 5 — CASTLE PARTY (PBR MẠNH)                          */
    /* ================================================================== */
    const buildStation5 = () => {
      const pt = curve.getPointAt(STATIONS[5].u);
      const T = curve.getTangentAt(STATIONS[5].u);
      const norm = new THREE.Vector3(T.z, 0, -T.x).normalize();
      const st5Center = pt.clone().add(norm.clone().multiplyScalar(9.5));
      const st5Group = new THREE.Group();
      st5Group.position.set(st5Center.x, heightAt(st5Center.x, st5Center.z), st5Center.z);
      st5Group.rotation.set(0, Math.atan2(norm.x, norm.z), 0);

      // [P3] Đá cẩm thạch trong mờ — PBR nâng cấp
      const marbleMat = new THREE.MeshPhysicalMaterial({
        color: 0xFFFDF9,
        roughness: 0.35,
        metalness: 0.08,
        transmission: 0.12,
        thickness: 0.5,
        ior: 1.48,
        clearcoat: 0.3,
        clearcoatRoughness: 0.4,
        envMap: envTex
      });
      const palaceWallMat = new THREE.MeshPhysicalMaterial({
        color: 0xFAF3EA,
        roughness: 0.6,
        metalness: 0.04,
        clearcoat: 0.15,
        sheen: 0.2,
        sheenColor: new THREE.Color(0xFFF8F0),
        envMap: envTex
      });
      const goldTrimMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.9, roughness: 0.2, envMap: envTex });
      const roofSpireMat = new THREE.MeshStandardMaterial({ color: 0x8C2F4B, roughness: 0.35, metalness: 0.3, envMap: envTex });
      const stainedGlassMat = new THREE.MeshPhysicalMaterial({
        color: 0xFDE68A,
        emissive: 0xF59E0B,
        emissiveIntensity: 2.2,
        roughness: 0.15,
        transmission: 0.4,
        thickness: 0.2,
        ior: 1.5
      });

      const basePlatform1 = new THREE.Mesh(new THREE.CylinderGeometry(15.0, 16.2, 1.2, 40), marbleMat);
      basePlatform1.position.y = 0.6;
      basePlatform1.receiveShadow = true;
      basePlatform1.castShadow = true;
      st5Group.add(basePlatform1);

      const basePlatform2 = new THREE.Mesh(new THREE.CylinderGeometry(12.5, 13.5, 0.8, 36), marbleMat);
      basePlatform2.position.y = 1.6;
      basePlatform2.receiveShadow = true;
      st5Group.add(basePlatform2);

      for (let b = 0; b < 28; b++) {
        const ang = (b / 28) * Math.PI * 2;
        if (Math.abs(ang - Math.PI / 2) > 0.35) {
          const bal = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.9, 8), marbleMat);
          bal.position.set(Math.cos(ang) * 12.2, 2.45, Math.sin(ang) * 12.2);
          st5Group.add(bal);
        }
      }
      const railTop = new THREE.Mesh(new THREE.TorusGeometry(12.2, 0.12, 8, 48), goldTrimMat);
      railTop.rotation.x = Math.PI / 2;
      railTop.position.y = 2.95;
      st5Group.add(railTop);

      const royalRedCarpet = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 0.06, 12.0),
        new THREE.MeshPhysicalMaterial({
          color: 0x8C1D40,
          roughness: 0.7,
          sheen: 0.8,
          sheenColor: new THREE.Color(0xB02050),
          sheenRoughness: 0.6
        })
      );
      royalRedCarpet.position.set(0, 2.04, 5.0);
      royalRedCarpet.receiveShadow = true;
      st5Group.add(royalRedCarpet);

      [
        [-9.5, 9.5], [9.5, 9.5], [-9.5, -9.5], [9.5, -9.5]
      ].forEach(([bx, bz]) => {
        const brazier = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.65, 1.4, 8), goldTrimMat);
        brazier.position.set(bx, 2.7, bz);
        brazier.castShadow = true;
        st5Group.add(brazier);
        const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xFDE68A, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }));
        flame.scale.set(1.8, 1.8, 1);
        flame.position.set(bx, 3.6, bz);
        st5Group.add(flame);
      });

      const mainKeep = new THREE.Mesh(new RoundedBoxGeometry(15.0, 9.5, 8.5, 4, 0.3), palaceWallMat);
      mainKeep.position.set(0, 6.75, -2.5);
      mainKeep.castShadow = true;
      mainKeep.receiveShadow = true;
      st5Group.add(mainKeep);

      const archPortal = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.45, 12, 28, Math.PI), goldTrimMat);
      archPortal.position.set(0, 5.2, 1.8);
      st5Group.add(archPortal);

      [-2.6, 2.6].forEach(px => {
        const pCol = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, 4.2, 16), goldTrimMat);
        pCol.position.set(px, 3.1, 1.8);
        pCol.castShadow = true;
        st5Group.add(pCol);
      });

      const woodenDoors = new THREE.Mesh(
        new THREE.BoxGeometry(4.6, 4.8, 0.25),
        new THREE.MeshStandardMaterial({ color: 0x4A2E1B, roughness: 0.85 })
      );
      woodenDoors.position.set(0, 3.4, 1.7);
      st5Group.add(woodenDoors);

      const winGeo = new THREE.PlaneGeometry(1.2, 2.4);
      [-4.8, 4.8].forEach(wx => {
        [4.2, 8.0].forEach(wy => {
          const winL = new THREE.Mesh(winGeo, stainedGlassMat);
          winL.position.set(wx, wy, 1.78);
          st5Group.add(winL);
          const winFrame = new THREE.Mesh(new THREE.BoxGeometry(1.35, 2.55, 0.08), goldTrimMat);
          winFrame.position.set(wx, wy, 1.76);
          st5Group.add(winFrame);
        });
      });

      const royalBalcony = new THREE.Mesh(new RoundedBoxGeometry(6.4, 0.6, 1.8, 3, 0.08), marbleMat);
      royalBalcony.position.set(0, 6.8, 2.4);
      st5Group.add(royalBalcony);

      [
        [-7.6, 1.6], [7.6, 1.6], [-7.6, -6.6], [7.6, -6.6]
      ].forEach(([tx, tz]) => {
        const towerShaft = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.9, 13.5, 20), palaceWallMat);
        towerShaft.position.set(tx, 8.75, tz);
        towerShaft.castShadow = true;
        towerShaft.receiveShadow = true;
        st5Group.add(towerShaft);

        const crenel = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 1.7, 0.8, 16), goldTrimMat);
        crenel.position.set(tx, 15.6, tz);
        st5Group.add(crenel);

        const spire = new THREE.Mesh(new THREE.ConeGeometry(2.1, 6.5, 20), roofSpireMat);
        spire.position.set(tx, 19.2, tz);
        spire.castShadow = true;
        st5Group.add(spire);

        const spireTip = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 12), goldTrimMat);
        spireTip.position.set(tx, 22.6, tz);
        st5Group.add(spireTip);
      });

      const centralKeep = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.2, 18.0, 8), palaceWallMat);
      centralKeep.position.set(0, 11.0, -2.5);
      centralKeep.castShadow = true;
      centralKeep.receiveShadow = true;
      st5Group.add(centralKeep);

      const midRing = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 2.7, 1.0, 8), goldTrimMat);
      midRing.position.set(0, 20.2, -2.5);
      st5Group.add(midRing);

      const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 0.2, 24), goldTrimMat);
      clockFace.rotation.x = Math.PI / 2;
      clockFace.position.set(0, 16.5, 0.6);
      st5Group.add(clockFace);

      const grandSpire = new THREE.Mesh(new THREE.ConeGeometry(3.0, 8.5, 16), goldTrimMat);
      grandSpire.position.set(0, 24.8, -2.5);
      grandSpire.castShadow = true;
      st5Group.add(grandSpire);

      const grandFlagPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), chromeMat);
      grandFlagPole.position.set(0, 29.8, -2.5);
      st5Group.add(grandFlagPole);

      const grandFlag = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 1.2),
        new THREE.MeshPhysicalMaterial({
          color: 0xBE123C,
          side: THREE.DoubleSide,
          sheen: 1.0,
          sheenColor: new THREE.Color(0xE91E63),
          sheenRoughness: 0.4,
          roughness: 0.7
        })
      );
      grandFlag.position.set(1.2, 30.2, -2.5);
      st5Group.add(grandFlag);

      // [P3] Bàn tiệc trái — khăn trải bàn cánh cung sang bên trái (Nhóm 2.3)
      const banquetTableGeo = new RoundedBoxGeometry(5.6, 0.9, 2.8, 4, 0.14);
      const banquetTable = new THREE.Mesh(
        banquetTableGeo,
        new THREE.MeshPhysicalMaterial({
          color: 0xFFFDF8,
          roughness: 0.5,
          sheen: 1.0,
          sheenColor: new THREE.Color(0xFFFFFF),
          sheenRoughness: 0.5,
          clearcoat: 0.1
        })
      );
      banquetTable.position.set(-5.6, 2.45, 2.8);
      banquetTable.rotation.y = 0.22;
      banquetTable.castShadow = true;
      banquetTable.receiveShadow = true;
      st5Group.add(banquetTable);

      const tableRunner = new THREE.Mesh(
        new RoundedBoxGeometry(5.62, 0.04, 1.35, 4, 0.02),
        new THREE.MeshPhysicalMaterial({
          color: 0x8C2F4B,
          roughness: 0.45,
          sheen: 1.2,
          sheenColor: new THREE.Color(0xC71585),
          sheenRoughness: 0.35,
          clearcoat: 0.2
        })
      );
      tableRunner.position.set(-5.6, 2.92, 2.8);
      tableRunner.rotation.y = 0.22;
      st5Group.add(tableRunner);

      /* ===== [P3] BÁNH KEM 4 TẦNG (CÁNH TRÁI BÀN TIỆC) ===== */
      const cakeGroup = new THREE.Group();
      cakeGroup.position.set(-5.6, 2.92, 2.8);
      cakeGroup.rotation.y = 0.22;

      const cakeStand = new THREE.Mesh(new THREE.CylinderGeometry(1.48, 1.62, 0.16, 32), goldTrimMat);
      cakeStand.position.y = 0.08;
      cakeStand.castShadow = true;
      cakeGroup.add(cakeStand);

      const cakeColors = [0xFFFDF7, 0x9E1B32, 0xFAF3EA, 0xFFE4E6];
      const cakeTiersData = [
        { r: 1.25, h: 0.44, y: 0.38 },
        { r: 0.94, h: 0.40, y: 0.80 },
        { r: 0.68, h: 0.36, y: 1.18 },
        { r: 0.44, h: 0.30, y: 1.51 }
      ];

      cakeTiersData.forEach((t, ti) => {
        // [P3] Kem: sheen + clearcoat → cảm giác kem mềm, bóng nhẹ
        const tierMat = new THREE.MeshPhysicalMaterial({
          color: cakeColors[ti],
          roughness: 0.3,
          metalness: 0.02,
          clearcoat: 0.6,
          clearcoatRoughness: 0.3,
          sheen: 0.5,
          sheenColor: new THREE.Color(0xFFFFFF),
          sheenRoughness: 0.4
        });
        const tierMesh = new THREE.Mesh(new THREE.CylinderGeometry(t.r, t.r, t.h, 32), tierMat);
        tierMesh.position.y = t.y;
        tierMesh.castShadow = true;
        tierMesh.receiveShadow = true;
        cakeGroup.add(tierMesh);

        // [P3] Chuỗi ngọc trai thật (thay Torus = 60 sphere nhỏ)
        const pearlCount = 60;
        const pearlGeo = new THREE.SphereGeometry(0.038, 8, 6);
        const pearlMat = ti === 1 ? goldTrimMat : new THREE.MeshPhysicalMaterial({
          color: 0xFFFAF0,
          roughness: 0.15,
          metalness: 0.05,
          clearcoat: 1,
          clearcoatRoughness: 0.1,
          transmission: 0.2,
          thickness: 0.05
        });
        const pearlMesh = new THREE.InstancedMesh(pearlGeo, pearlMat, pearlCount);
        const pearlDummy = new THREE.Object3D();
        for (let p = 0; p < pearlCount; p++) {
          const ang = (p / pearlCount) * Math.PI * 2;
          pearlDummy.position.set(Math.cos(ang) * (t.r + 0.015), t.y - t.h * 0.48, Math.sin(ang) * (t.r + 0.015));
          pearlDummy.scale.setScalar(1);
          pearlDummy.updateMatrix();
          pearlMesh.setMatrixAt(p, pearlDummy.matrix);
        }
        cakeGroup.add(pearlMesh);
      });

      const cakeRoseColors = [0xFFFAF0, 0xFDA4AF, 0xBE123C, 0xFED7AA].map(c => new THREE.Color(c));
      for (let cr = 0; cr < 10; cr++) {
        const rHead = new THREE.Mesh(makeRoseHead(), new THREE.MeshPhysicalMaterial({
          color: cakeRoseColors[cr % cakeRoseColors.length],
          roughness: 0.35,
          side: THREE.DoubleSide,
          sheen: 0.6,
          sheenColor: new THREE.Color(0xFFD0E0),
          clearcoat: 0.2
        }));
        const t = cr / 9;
        const cy = 0.35 + t * 1.25;
        const cradius = 1.25 - t * 0.85 + 0.08;
        const cangle = t * Math.PI * 2.8 + 0.2;
        rHead.position.set(Math.sin(cangle) * cradius, cy, Math.cos(cangle) * cradius);
        rHead.rotation.set(-0.2 + (rand() - 0.5) * 0.3, cangle, 0.3);
        rHead.scale.setScalar(1.2 + (cr % 3) * 0.2);
        cakeGroup.add(rHead);
      }

      const topperCrown = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.025, 12, 24), goldTrimMat);
      topperCrown.rotation.x = Math.PI / 2;
      topperCrown.position.y = 1.72;
      cakeGroup.add(topperCrown);

      const topperStar = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 12), goldTrimMat);
      topperStar.position.y = 1.84;
      cakeGroup.add(topperStar);

      // [P3] Nến sáp có transmission nhẹ
      for (let cn = 0; cn < 6; cn++) {
        const ca = (cn / 6) * Math.PI * 2;
        const cRad = cn < 4 ? 0.82 : 0.56;
        const cBaseY = cn < 4 ? 1.0 : 1.36;

        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.045, 0.03, 10), goldTrimMat);
        cup.position.set(Math.sin(ca) * cRad, cBaseY, Math.cos(ca) * cRad);
        cakeGroup.add(cup);

        const wax = new THREE.Mesh(
          new THREE.CylinderGeometry(0.022, 0.026, 0.36, 10),
          new THREE.MeshPhysicalMaterial({
            color: 0xFFFBF2,
            roughness: 0.3,
            transmission: 0.35,
            thickness: 0.1,
            ior: 1.45
          })
        );
        wax.position.set(Math.sin(ca) * cRad, cBaseY + 0.18, Math.cos(ca) * cRad);
        cakeGroup.add(wax);

        const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.04, 6), new THREE.MeshBasicMaterial({ color: 0x1F2937 }));
        wick.position.set(Math.sin(ca) * cRad, cBaseY + 0.38, Math.cos(ca) * cRad);
        cakeGroup.add(wick);
      }

      cakeAura = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xFBBF24, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }));
      cakeAura.scale.set(4.2, 4.2, 1);
      cakeAura.position.y = 1.85;
      cakeGroup.add(cakeAura);

      st5Group.add(cakeGroup);

      /* ===== [P3] THÁP CHAMPAGNE 30 LY (CÁNH PHẢI BÀN TIỆC - Nhóm 2.3) ===== */
      const champTableGeo = new RoundedBoxGeometry(5.2, 0.9, 2.8, 4, 0.14);
      const champTable = new THREE.Mesh(champTableGeo, banquetTable.material);
      champTable.position.set(5.6, 2.45, 2.8);
      champTable.rotation.y = -0.22;
      champTable.castShadow = true;
      champTable.receiveShadow = true;
      st5Group.add(champTable);

      const champagneGroup = new THREE.Group();
      champagneGroup.position.set(5.6, 2.92, 2.8);
      champagneGroup.rotation.y = -0.22;

      const standRiser = new THREE.Mesh(new RoundedBoxGeometry(1.68, 0.12, 1.68, 4, 0.03), marbleMat);
      standRiser.position.y = 0.06;
      champagneGroup.add(standRiser);

      const standGoldTrim = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.03, 1.7), goldTrimMat);
      standGoldTrim.position.y = 0.11;
      champagneGroup.add(standGoldTrim);

      // [P3] Pha lê đúng vật lý: transmission 1.0, ior 1.52
      const crystalMat = new THREE.MeshPhysicalMaterial({
        color: 0xFFFFFF,
        transmission: 1.0,
        opacity: 1,
        transparent: true,
        roughness: 0.02,
        ior: 1.52,
        thickness: 0.15,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
        envMap: envTex,
        envMapIntensity: 1.8,
        side: THREE.DoubleSide
      });

      // [P3] Rượu champagne: attenuation Beer-Lambert → đậm dần theo độ sâu
      const champagneLiquidMat = new THREE.MeshPhysicalMaterial({
        color: 0xF59E0B,
        transmission: 0.92,
        roughness: 0.1,
        ior: 1.45,
        thickness: 0.3,
        attenuationColor: new THREE.Color(0xD97706),
        attenuationDistance: 0.25,
        transparent: true,
        opacity: 1
      });

      // [P3] Bọt sủi — 80 hạt trong tháp champagne
      const bubbleCount = 80;
      const bubbleGeo = new THREE.SphereGeometry(0.008, 6, 5);
      const bubbleMat = new THREE.MeshPhysicalMaterial({
        color: 0xFFFFFF,
        transmission: 0.9,
        roughness: 0.05,
        ior: 1.4,
        thickness: 0.02
      });
      const champagneBubbles = new THREE.InstancedMesh(bubbleGeo, bubbleMat, bubbleCount);
      const bubbleData = [];
      for (let b = 0; b < bubbleCount; b++) {
        bubbleData.push({
          x: (rand() - 0.5) * 0.28,
          z: (rand() - 0.5) * 0.28,
          y: rand() * 1.0,
          speed: 0.15 + rand() * 0.25
        });
      }
      champagneBubbles.userData = { isChampagneBubbles: true, bubbleData };
      champagneGroup.add(champagneBubbles);

      const createFlute = () => {
        const flute = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.052, 0.012, 12), crystalMat);
        base.position.y = 0.006;
        flute.add(base);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.12, 8), crystalMat);
        stem.position.y = 0.07;
        flute.add(stem);
        const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.02, 0.12, 12), crystalMat);
        cup.position.y = 0.18;
        flute.add(cup);
        const wine = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.022, 0.09, 10), champagneLiquidMat);
        wine.position.y = 0.17;
        flute.add(wine);
        return flute;
      };

      const SPAN = 0.23;
      const FLUTE_H = 0.245;
      const pyramidTiers = [
        { count: 4, y: 0.12 },
        { count: 3, y: 0.12 + FLUTE_H },
        { count: 2, y: 0.12 + FLUTE_H * 2 },
        { count: 1, y: 0.12 + FLUTE_H * 3 }
      ];

      pyramidTiers.forEach((tier) => {
        const offset = ((tier.count - 1) * SPAN) / 2;
        for (let gx = 0; gx < tier.count; gx++) {
          for (let gz = 0; gz < tier.count; gz++) {
            const flute = createFlute();
            flute.position.set(gx * SPAN - offset, tier.y, gz * SPAN - offset);
            champagneGroup.add(flute);
          }
        }
      });

      const champBubbles = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xFDE68A, transparent: true, blending: THREE.AdditiveBlending }));
      champBubbles.scale.set(1.4, 1.4, 1);
      champBubbles.position.y = 0.12 + FLUTE_H * 4.1;
      champagneGroup.add(champBubbles);

      st5Group.add(champagneGroup);

      [-3.8, 3.8].forEach(fx => {
        const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.32, 0.52, 16), goldTrimMat);
        basket.position.set(fx, 3.18, 3.0);
        basket.castShadow = true;
        st5Group.add(basket);
        const bouquet = new THREE.Mesh(
          new THREE.SphereGeometry(0.58, 14, 12),
          new THREE.MeshPhysicalMaterial({
            color: 0xBE123C,
            roughness: 0.4,
            sheen: 0.8,
            sheenColor: new THREE.Color(0xFF5080),
            clearcoat: 0.3
          })
        );
        bouquet.position.set(fx, 3.55, 3.0);
        bouquet.castShadow = true;
        st5Group.add(bouquet);
      });

      [-1.3, 1.3].forEach(nx => {
        [-0.85, 0.85].forEach(nz => {
          const cand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.55, 8), goldTrimMat);
          cand.position.set(nx, 3.18, 3.0 + nz);
          st5Group.add(cand);
          const cF = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xFDE68A, transparent: true, blending: THREE.AdditiveBlending }));
          cF.scale.set(0.7, 0.7, 1);
          cF.position.set(nx, 3.55, 3.0 + nz);
          st5Group.add(cF);
        });
      });

      // [P3] Bệ đá cẩm thạch tròn hoàng gia cho hòm quà trung tâm (Nhóm 2.3)
      const chestStand = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.45, 32), marbleMat);
      chestStand.position.set(0, 2.22, 3.8);
      chestStand.castShadow = true;
      chestStand.receiveShadow = true;
      const chestRim = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.04, 8, 32), goldTrimMat);
      chestRim.rotation.x = Math.PI / 2;
      chestRim.position.set(0, 2.44, 3.8);
      st5Group.add(chestStand);
      st5Group.add(chestRim);

      // GROUP HÒM QUÀ HOÀNG GIA (ROYAL CHEST GROUP) TẠI TRUNG TÂM KHÔNG BỊ CHE KHUẤT
      const royalChestGroup = new THREE.Group();
      royalChestGroup.position.set(0, 2.92, 3.8);
      st5Group.add(royalChestGroup);

      const chestBodyMat = new THREE.MeshPhysicalMaterial({
        color: 0x6E1934, // Đỏ rượu vang hoàng gia
        roughness: 0.28,
        metalness: 0.25,
        clearcoat: 0.4,
        clearcoatRoughness: 0.2,
        sheen: 0.6,
        sheenColor: new THREE.Color(0xF43F5E),
        envMap: envTex
      });
      const chestGoldMat = new THREE.MeshStandardMaterial({
        color: 0xD4AF37,
        metalness: 0.92,
        roughness: 0.18,
        envMap: envTex
      });

      // Thân hòm quà
      const royalChest = new THREE.Mesh(new RoundedBoxGeometry(1.9, 0.76, 1.25, 4, 0.08), chestBodyMat);
      royalChest.position.set(0, -0.22, 0);
      royalChest.castShadow = true;
      royalChest.receiveShadow = true;
      royalChestGroup.add(royalChest);

      // Viền nẹp vàng thân hộp
      const bodyRimTop = new THREE.Mesh(new THREE.BoxGeometry(1.94, 0.06, 1.29), chestGoldMat);
      bodyRimTop.position.set(0, 0.15, 0);
      royalChestGroup.add(bodyRimTop);
      const bodyBand1 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.78, 1.29), chestGoldMat);
      bodyBand1.position.set(-0.54, -0.22, 0);
      royalChestGroup.add(bodyBand1);
      const bodyBand2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.78, 1.29), chestGoldMat);
      bodyBand2.position.set(0.54, -0.22, 0);
      royalChestGroup.add(bodyBand2);

      // Nắp hòm quà có bản lề xoay mở phía sau
      const chestLidPivot = new THREE.Group();
      chestLidPivot.position.set(0, 0.16, -0.62); // Bản lề tại mép sau
      royalChestGroup.add(chestLidPivot);

      const chestLidMesh = new THREE.Mesh(new RoundedBoxGeometry(1.96, 0.38, 1.3, 4, 0.08), chestBodyMat);
      chestLidMesh.position.set(0, 0.19, 0.62);
      chestLidMesh.castShadow = true;
      chestLidPivot.add(chestLidMesh);

      // Nẹp vàng và nơ ruy băng vàng trên nắp hòm (như hình hộp quà)
      const lidBandX = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.08, 0.16), chestGoldMat);
      lidBandX.position.set(0, 0.38, 0.62);
      chestLidPivot.add(lidBandX);
      const lidBandZ = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 1.32), chestGoldMat);
      lidBandZ.position.set(0, 0.38, 0.62);
      chestLidPivot.add(lidBandZ);

      // Nơ hoàng gia 3D trên đỉnh nắp (Royal Gold Ribbon Bow)
      const bowLoop1 = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 12, 24), chestGoldMat);
      bowLoop1.rotation.set(0.4, 0.6, 0.3);
      bowLoop1.position.set(-0.16, 0.52, 0.62);
      chestLidPivot.add(bowLoop1);
      const bowLoop2 = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.05, 12, 24), chestGoldMat);
      bowLoop2.rotation.set(0.4, -0.6, -0.3);
      bowLoop2.position.set(0.16, 0.52, 0.62);
      chestLidPivot.add(bowLoop2);
      const bowCenter = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), chestGoldMat);
      bowCenter.position.set(0, 0.44, 0.62);
      chestLidPivot.add(bowCenter);

      // Ổ khóa hoàng gia phía trước
      const chestLock = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.14, 16), chestGoldMat);
      chestLock.rotation.x = Math.PI / 2;
      chestLock.position.set(0, 0.14, 1.28);
      chestLidPivot.add(chestLock);

      // Đèn PointLight lung linh bên trong hòm quà
      const chestPointLight = new THREE.PointLight(0xF59E0B, 3.2, 12, 1.2);
      chestPointLight.position.set(0, 0.5, 0);
      royalChestGroup.add(chestPointLight);

      // Aura hào quang tỏa ra từ hòm quà
      chestAura1 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xF59E0B, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending }));
      chestAura1.scale.set(5.8, 5.8, 1);
      chestAura1.position.set(0, 0.2, 0);
      royalChestGroup.add(chestAura1);

      chestAura2 = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xEF4444, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }));
      chestAura2.scale.set(4.5, 4.5, 1);
      chestAura2.position.set(0, 0.2, 0);
      royalChestGroup.add(chestAura2);

      const chestAuraRays = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xFDE68A, transparent: true, opacity: 0.65, blending: THREE.AdditiveBlending }));
      chestAuraRays.scale.set(7.5, 7.5, 1);
      chestAuraRays.position.set(0, 0.2, 0);
      royalChestGroup.add(chestAuraRays);

      // Biển bảng chỉ dẫn nổi 3D với hiệu ứng nhấp nháy thu hút sự chú ý
      const partySignTex = signTexture('✨ CHẠM MỞ HÒM QUÀ ĐẠI TIỆC 20/10 ✨');
      const partySignSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: partySignTex, transparent: true }));
      partySignSprite.position.set(0, 2.35, 0);
      partySignSprite.scale.set(5.4, 1.35, 1);
      royalChestGroup.add(partySignSprite);

      // Cấu hình animation hòm quà cho renderLoop
      const st5ChestAnim = {
        opened: false,
        openProgress: 0,
        group: royalChestGroup,
        lid: chestLidPivot,
        light: chestPointLight,
        aura1: chestAura1,
        aura2: chestAura2,
        auraRays: chestAuraRays,
        sign: partySignSprite
      };
      worldAtmosphereRef.current.st5ChestAnim = st5ChestAnim;

      /* ===== [P3] EASEL 3 CHÂN ===== */
      const easelGroup = new THREE.Group();
      easelGroup.position.set(-4.5, 2.0, 5.2);
      easelGroup.rotation.y = 0.28;

      const easelWoodMat = new THREE.MeshPhysicalMaterial({
        color: 0x8C5E3C,
        roughness: 0.6,
        metalness: 0.05,
        clearcoat: 0.15,
        sheen: 0.3,
        sheenColor: new THREE.Color(0xB08060)
      });

      const legGeo = new THREE.BoxGeometry(0.065, 3.8, 0.065);
      const leftLeg = new THREE.Mesh(legGeo, easelWoodMat);
      leftLeg.position.set(-0.68, 1.85, 0.12);
      leftLeg.rotation.z = -0.15;
      leftLeg.rotation.x = -0.08;
      leftLeg.castShadow = true;
      easelGroup.add(leftLeg);

      const rightLeg = new THREE.Mesh(legGeo, easelWoodMat);
      rightLeg.position.set(0.68, 1.85, 0.12);
      rightLeg.rotation.z = 0.15;
      rightLeg.rotation.x = -0.08;
      rightLeg.castShadow = true;
      easelGroup.add(rightLeg);

      const backLeg = new THREE.Mesh(new THREE.BoxGeometry(0.065, 3.6, 0.065), easelWoodMat);
      backLeg.position.set(0, 1.75, -0.75);
      backLeg.rotation.x = 0.28;
      easelGroup.add(backLeg);

      const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.07, 0.14), easelWoodMat);
      shelf.position.set(0, 1.45, 0.22);
      easelGroup.add(shelf);

      const centerMast = new THREE.Mesh(new THREE.BoxGeometry(0.065, 4.0, 0.065), easelWoodMat);
      centerMast.position.set(0, 1.95, -0.02);
      centerMast.rotation.x = -0.08;
      easelGroup.add(centerMast);

      const topClamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.12), easelWoodMat);
      topClamp.position.set(0, 3.42, 0.08);
      easelGroup.add(topClamp);

      const boardMat = new THREE.MeshPhysicalMaterial({
        color: 0xFFFFFF,
        roughness: 0.8,
        sheen: 0.3,
        sheenColor: new THREE.Color(0xFFF8F0),
        clearcoat: 0.1
      });
      const artBoard = new THREE.Mesh(new RoundedBoxGeometry(1.85, 2.55, 0.05, 3, 0.02), boardMat);
      artBoard.position.set(0, 2.45, 0.16);
      artBoard.rotation.x = -0.08;
      artBoard.castShadow = true;
      easelGroup.add(artBoard);

      // [FALLBACK THIẾU ẢNH THẬT TRÊN GIÁ VẼ EASEL]
      const hasPhoto = Boolean(selectedSister && selectedSister.photo && selectedSister.has_consent !== false);
      const pMat = new THREE.MeshStandardMaterial({
        roughness: 0.82,
        metalness: 0.02
      });
      pMat.polygonOffset = true;
      pMat.polygonOffsetFactor = -1;

      if (hasPhoto) {
        new THREE.TextureLoader().load(
          selectedSister.photo,
          (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = 4;
            pMat.map = tex;
            pMat.emissiveMap = tex;
            pMat.emissive = new THREE.Color(0xffffff);
            pMat.emissiveIntensity = isNightMode ? 0.45 : 0.15;
            pMat.needsUpdate = true;
          },
          undefined,
          () => {
            const sCanvas = createSignatureCardCanvas(sisterName, '', 512, 640);
            const sTex = new THREE.CanvasTexture(sCanvas);
            sTex.colorSpace = THREE.SRGBColorSpace;
            sTex.anisotropy = 4;
            pMat.map = sTex;
            pMat.emissiveMap = sTex;
            pMat.emissive = new THREE.Color(0xffffff);
            pMat.emissiveIntensity = isNightMode ? 0.45 : 0.15;
            pMat.needsUpdate = true;
          }
        );
      } else {
        const sCanvas = createSignatureCardCanvas(sisterName, '', 512, 640);
        const sTex = new THREE.CanvasTexture(sCanvas);
        sTex.colorSpace = THREE.SRGBColorSpace;
        sTex.anisotropy = 4;
        pMat.map = sTex;
        pMat.emissiveMap = sTex;
        pMat.emissive = new THREE.Color(0xffffff);
        pMat.emissiveIntensity = isNightMode ? 0.45 : 0.15;
        pMat.needsUpdate = true;
      }

      const pMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 2.05), pMat);
      pMesh.position.set(0, 0.15, 0.035);
      artBoard.add(pMesh);

      const captionCanvas = document.createElement('canvas');
      captionCanvas.width = 512; captionCanvas.height = 128;
      const cG = captionCanvas.getContext('2d');
      cG.fillStyle = '#FFFFFF'; cG.fillRect(0, 0, 512, 128);
      cG.fillStyle = '#8C2F4B';
      cG.font = 'italic bold 26px "Playfair Display", Georgia, serif';
      cG.textAlign = 'center';
      cG.fillText(`Đóa Hoa Rực Rỡ • ${sisterName}`, 256, 52);
      cG.fillStyle = '#6B4226';
      cG.font = '600 16px "Be Vietnam Pro", sans-serif';
      cG.fillText('TECHCORP GALA TRIBUTE 20.10', 256, 88);
      const captionTex = new THREE.CanvasTexture(captionCanvas);
      captionTex.colorSpace = THREE.SRGBColorSpace;
      const capMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.65, 0.42), new THREE.MeshBasicMaterial({ map: captionTex }));
      capMesh.position.set(0, -1.02, 0.035);
      artBoard.add(capMesh);

      const baseFlowerGroup = new THREE.Group();
      baseFlowerGroup.position.set(0, 0.15, 0.25);

      const easelRosePal = [0xFFE4E6, 0xFDA4AF, 0xFFFAF0, 0xFBCFE8].map(h => new THREE.Color(h));
      for (let r = 0; r < 14; r++) {
        const rMesh = new THREE.Mesh(makeRoseHead(), new THREE.MeshPhysicalMaterial({
          color: easelRosePal[r % easelRosePal.length],
          roughness: 0.4,
          side: THREE.DoubleSide,
          sheen: 0.7,
          sheenColor: new THREE.Color(0xFFD0E0),
          transmission: 0.08,
          thickness: 0.05
        }));
        const ra = -0.8 + (r / 13) * 1.6;
        const rr = 0.4 + (r % 3) * 0.18;
        rMesh.position.set(Math.sin(ra) * rr, 0.12 + (r % 4) * 0.15, Math.cos(ra) * rr * 0.6);
        rMesh.rotation.set(-0.2 + (rand() - 0.5) * 0.4, rand() * Math.PI, 0.1);
        rMesh.scale.setScalar(1.6 + (r % 3) * 0.3);
        baseFlowerGroup.add(rMesh);
      }

      for (let l = 0; l < 6; l++) {
        const lily = new THREE.Group();
        const petalLily = new THREE.Mesh(
          new THREE.ConeGeometry(0.12, 0.42, 16, 1, true),
          new THREE.MeshPhysicalMaterial({
            color: 0xFFFFFF,
            roughness: 0.25,
            side: THREE.DoubleSide,
            sheen: 0.9,
            sheenColor: new THREE.Color(0xFFFFFF),
            transmission: 0.15,
            thickness: 0.05
          })
        );
        petalLily.rotation.x = Math.PI + 0.3;
        lily.add(petalLily);
        const pistil = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.35, 8), new THREE.MeshBasicMaterial({ color: 0xFDE047 }));
        pistil.position.y = 0.05;
        lily.add(pistil);
        const la = -0.6 + (l / 5) * 1.2;
        lily.position.set(Math.sin(la) * 0.65, 0.35 + (l % 3) * 0.2, Math.cos(la) * 0.4);
        lily.rotation.set(-0.35, la, 0.2);
        baseFlowerGroup.add(lily);
      }

      const leafMat = new THREE.MeshStandardMaterial({ color: 0x2A6228, roughness: 0.6 });
      for (let f = 0; f < 10; f++) {
        const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.55), leafMat);
        leaf.position.set((f - 4.5) * 0.15, 0.2 + (f % 3) * 0.08, 0.1 + (f % 2) * 0.2);
        leaf.rotation.set(-0.4, (f - 4.5) * 0.3, 0.2);
        baseFlowerGroup.add(leaf);
      }
      easelGroup.add(baseFlowerGroup);
      st5Group.add(easelGroup);

      /* ===== [P3] SEAL PEDESTAL ===== */
      const sealGroup = new THREE.Group();
      sealGroup.position.set(4.5, 2.0, 5.2);
      sealGroup.rotation.y = -0.28;

      const pedestalMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 1.35, 20), marbleMat);
      pedestalMesh.position.y = 0.68;
      pedestalMesh.castShadow = true;
      pedestalMesh.receiveShadow = true;
      sealGroup.add(pedestalMesh);

      const scrollMesh = new THREE.Mesh(
        new RoundedBoxGeometry(1.6, 0.08, 1.2, 4, 0.04),
        new THREE.MeshPhysicalMaterial({ color: 0xFFFDF5, roughness: 0.7, sheen: 0.4, sheenColor: new THREE.Color(0xFFFFFF) })
      );
      scrollMesh.position.set(0, 1.4, 0);
      sealGroup.add(scrollMesh);

      const sealWaxMat = new THREE.MeshPhysicalMaterial({
        color: 0xBE123C,
        roughness: 0.35,
        metalness: 0.15,
        clearcoat: 0.5,
        clearcoatRoughness: 0.3
      });
      const waxSealMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.26, 0.08, 24), sealWaxMat);
      waxSealMesh.position.set(0, 1.48, 0.2);
      sealGroup.add(waxSealMesh);

      const sealGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xFDE68A, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending }));
      sealGlow.scale.set(1.4, 1.4, 1);
      sealGlow.position.set(0, 1.55, 0.2);
      sealGroup.add(sealGlow);

      st5Group.add(sealGroup);

      // ⚠️ KHÔNG gán đè triggerCastleFireworks ở đây!
      // PHẦN 4 đã override bằng bản Upgraded (3 giàn pháo độc lập, 12 chủng loại hoàng gia).
      // Chỉ cần buildStation5() gán stationCameraPositions[5] là đủ.

      scene.add(st5Group);

      const onPartyClick = () => {
        const cAnim = worldAtmosphereRef.current.st5ChestAnim;
        if (cAnim && cAnim.opened) {
          // Khi hòm quà đã mở rồi, bấm lại sẽ bắn thêm đợt pháo hoa rực rỡ và mở thiệp Retina 2x
          triggerCastleFireworks();
          setActivePartyCardModal(true);
          return;
        }

        if (cAnim) {
          cAnim.opened = true;
        }

        playSparkleSound();
        soundBoom(0.05, 0.9);

        // Hiệu ứng pháo giấy 2D phụ trợ
        fireConfetti({
          particleCount: 160, spread: 140, origin: { y: 0.55 },
          colors: ['#F43F5E', '#FDA4AF', '#FCD34D', '#FFF1F2', '#BE123C', '#F59E0B']
        });

        // 1. TỰ ĐỘNG CHUYỂN BẦU TRỜI DẠ TIỆC ĐÊM ĐỂ PHÁO HOA RỰC RỠ NHẤT
        if (!nightModeRef.current) {
          toggleNightMode();
        }

        // 2. CAMERA CHUYỂN LÊN CAO VÀ NGỬA LÊN TRỜI ĐỂ NGẮM NHÌN BẦU TRỜI PHÁO HOA
        setIsLookingAtSky(true);
        const st5 = stationCameraPositions[5];
        if (st5) {
          const stCam = st5.camPos.clone();
          const stTgt = st5.targetPos.clone();
          const fwd = stTgt.clone().sub(stCam);
          fwd.y = 0;
          fwd.normalize();

          // Lùi camera xa hơn (11m) và hạ thấp sát đất (-2.6m) để mở rộng góc ngước vòm trời trọn vẹn 3 tầng
          const camToPos = stCam.clone().sub(fwd.clone().multiplyScalar(11.0)).add(new THREE.Vector3(0, -2.6, 0));
          // Điểm nhìn hướng lên bầu trời đêm phía trên lâu đài (+32m)
          const camToTarget = stTgt.clone().add(fwd.clone().multiplyScalar(4.0)).add(new THREE.Vector3(0, 32.0, 0));

          Object.assign(transRef.current, {
            active: true,
            t0: performance.now(),
            dur: 2600,
            fromCam: camera.position.clone(),
            fromTgt: controls.target.clone(),
            toCam: camToPos,
            toTgt: camToTarget,
            isVanRelative: false
          });
        }

        // 3. BẮN PHÁO HOA 3D THẬT LÊN TRỜI
        triggerCastleFireworks();

        showToast('🎆 Bầu trời pháo hoa 3D đại tiệc 20/10 đã bừng sáng! Bấm nút [Xem & Tải Thiệp 2X Retina] ở thanh đáy để nhận quà bất cứ lúc nào!');
      };

      let cakeClicks = 0;
      const onCakeClick = () => {
        cakeClicks++;
        soundClink();
        if (cakeClicks >= 3) {
          cakeClicks = 0;
          triggerCastleFireworks();
          fireConfetti({
            particleCount: 130, spread: 110, origin: { y: 0.5 },
            colors: ['#FDE68A', '#FDA4AF', '#BE123C', '#FFF1F2']
          });
          showToast('🎂 Ăn nhiều bánh ngọt không sợ béo, chúc chị em luôn xinh đẹp rạng ngời! 💖');
        } else {
          showToast(`🍰 Bánh kem đại tiệc 4 tầng! (Chạm thêm ${3 - cakeClicks} lần nữa để xem bất ngờ ✨)`);
        }
      };

      const onChampagneClick = () => {
        soundClink();
        triggerCastleFireworks();
        fireConfetti({
          particleCount: 110, spread: 110, origin: { y: 0.52 },
          colors: ['#F59E0B', '#FDE68A', '#FFFFFF', '#BE123C']
        });
        showToast('🥂 Nâng ly Champagne hảo hạng chúc mừng phái đẹp TechCorp ngày 20/10!');
      };

      const onEaselClick = () => {
        playSparkleSound();
        triggerCastleFireworks();
        fireConfetti({
          particleCount: 90, spread: 90, origin: { y: 0.55 },
          colors: ['#FDE68A', '#FDA4AF', '#FFFFFF', '#BE123C']
        });
        showToast(`👑 Bức họa vinh danh: Đóa hoa ngát hương ${sisterName}!`);
      };

      const onWaxSealClick = () => {
        playLetterOpenSound();
        triggerCastleFireworks();
        fireConfetti({
          particleCount: 95, spread: 90, origin: { y: 0.5 },
          colors: ['#BE123C', '#F43F5E', '#FDE68A', '#FFFFFF']
        });
        showToast('💌 Con dấu sáp đỏ 20.10 đã mở! Triệu đóa hồng gửi trao phái đẹp!');
      };

      // Vùng tương tác mở rộng vô hình cho hòm quà để click cực nhạy
      const chestClickZone = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 3.6, 3.2),
        new THREE.MeshBasicMaterial({ visible: false })
      );
      chestClickZone.position.set(0, 0.4, 0);
      royalChestGroup.add(chestClickZone);

      // Đăng ký các vùng tương tác chính của hòm quà và bàn tiệc (không duyệt hàng trăm viên ngọc con)
      interactiveMeshes.push({ mesh: chestClickZone, onClick: onPartyClick });
      interactiveMeshes.push({ mesh: chestLidPivot, onClick: onPartyClick });
      interactiveMeshes.push({ mesh: chestStand, onClick: onPartyClick });
      interactiveMeshes.push({ mesh: banquetTable, onClick: onPartyClick });
      interactiveMeshes.push({ mesh: cakeStand, onClick: onCakeClick });
      interactiveMeshes.push({ mesh: standRiser, onClick: onChampagneClick });
      interactiveMeshes.push({ mesh: partySignSprite, onClick: onPartyClick });
      interactiveMeshes.push({ mesh: artBoard, onClick: onEaselClick });
      interactiveMeshes.push({ mesh: waxSealMesh, onClick: onWaxSealClick });

      const camLocal = new THREE.Vector3(0, 6.2, 17.5);
      const tgtLocal = new THREE.Vector3(0, 3.2, 2.5);
      stationCameraPositions[5] = {
        targetPos: tgtLocal.applyEuler(st5Group.rotation).add(st5Group.position),
        camPos: camLocal.applyEuler(st5Group.rotation).add(st5Group.position)
      };

      // [P3] Lưu bubbleData để PHẦN 4 update bọt sủi
      st5Group.userData.bubbleData = bubbleData;
      st5Group.userData.champagneBubbles = champagneBubbles;
    };

    /* ================================================================== */
    /*  [P3] HIDDEN SECRET STATION: VỌNG LÂU NGẮM SAO (Nhóm 3.2)         */
    /* ================================================================== */
    const buildStation6 = () => {
      const ptSecret = curve.getPointAt(0.84);
      const TSecret = curve.getTangentAt(0.84);
      const normSecret = new THREE.Vector3(TSecret.z, 0, -TSecret.x).normalize();
      const secretCenter = ptSecret.clone().add(normSecret.clone().multiplyScalar(13.5));
      const secretGroup = new THREE.Group();
      secretGroup.position.set(secretCenter.x, heightAt(secretCenter.x, secretCenter.z), secretCenter.z);

      const secretMarbleMat = new THREE.MeshStandardMaterial({ color: 0xFFFDF9, roughness: 0.4 });
      const secretGoldMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.9, roughness: 0.2 });

      // Bệ đài đá cẩm thạch hình bát giác
      const pagodaBase = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 0.6, 8), secretMarbleMat);
      pagodaBase.position.y = 0.3;
      pagodaBase.castShadow = true;
      pagodaBase.receiveShadow = true;
      secretGroup.add(pagodaBase);

      // 6 cột trụ vàng champagne
      const pagodaLanterns = [];
      for (let p = 0; p < 6; p++) {
        const ang = (p / 6) * Math.PI * 2;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 4.2, 12), secretGoldMat);
        col.position.set(Math.cos(ang) * 3.4, 2.4, Math.sin(ang) * 3.4);
        col.castShadow = true;
        secretGroup.add(col);

        // Đèn lồng treo phát sáng
        const lantern = new THREE.Mesh(
          new THREE.SphereGeometry(0.24, 12, 12),
          new THREE.MeshStandardMaterial({
            color: 0xFFFBEB,
            emissive: 0xFDE68A,
            emissiveIntensity: 2.2,
            roughness: 0.2
          })
        );
        lantern.position.set(Math.cos(ang) * 3.4, 4.2, Math.sin(ang) * 3.4);
        secretGroup.add(lantern);
        pagodaLanterns.push(lantern);
      }

      // Mái vòm cong cung đình
      const pagodaRoof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 2.4, 8), new THREE.MeshStandardMaterial({ color: 0x8C2F4B, roughness: 0.35, metalness: 0.4 }));
      pagodaRoof.position.y = 5.6;
      pagodaRoof.castShadow = true;
      secretGroup.add(pagodaRoof);

      // Đỉnh sao vàng
      const starSpire = new THREE.Mesh(new THREE.OctahedronGeometry(0.4), secretGoldMat);
      starSpire.position.y = 7.0;
      secretGroup.add(starSpire);

      // Đèn PointLight lung linh
      const secretLight = new THREE.PointLight(0xFDE68A, 2.8, 18);
      secretLight.position.set(0, 3.8, 0);
      secretGroup.add(secretLight);

      // Biển tên thần bí
      const secretSignTex = signTexture('🌟 VỌNG LÂU NGẮM SAO BÍ MẬT 🌟');
      const secretSign = new THREE.Sprite(new THREE.SpriteMaterial({ map: secretSignTex, transparent: true }));
      secretSign.position.set(0, 4.8, 0);
      secretSign.scale.set(4.2, 1.05, 1);
      secretGroup.add(secretSign);

      scene.add(secretGroup);

      const onSecretClick = () => {
        playSparkleSound();
        pagodaLanterns.forEach(l => {
          l.material.emissiveIntensity = 5.5;
          setTimeout(() => { l.material.emissiveIntensity = 2.2; }, 3200);
        });
        fireConfetti({
          particleCount: 90,
          spread: 110,
          origin: { y: 0.48 },
          colors: ['#FDE68A', '#38BDF8', '#C084FC', '#FFF']
        });
        showToast('🌟 BÍ MẬT: Bạn đã khám phá Vọng Lâu Ngắm Sao! Nơi hội tụ vạn vì tinh tú may mắn cho phái đẹp! ✨');
      };

      interactiveMeshes.push({ mesh: pagodaBase, onClick: onSecretClick });
      interactiveMeshes.push({ mesh: pagodaRoof, onClick: onSecretClick });
      interactiveMeshes.push({ mesh: secretSign, onClick: onSecretClick });
    };

    // [PRE-COMPUTED CAMERA TARGETS & POSITIONS]
    [1, 2, 4, 5].forEach((idx) => {
      const pt = curve.getPointAt(STATIONS[idx].u);
      const T = curve.getTangentAt(STATIONS[idx].u);
      const norm = new THREE.Vector3(T.z, 0, -T.x).normalize();
      const mult = idx === 5 ? 9.5 : (idx === 4 ? 7.5 : (idx === 2 ? 6.5 : 7.2));
      const center = pt.clone().add(norm.clone().multiplyScalar(mult));
      stationCameraPositions[idx] = {
        targetPos: center.clone().add(new THREE.Vector3(0, 2.0, 0)),
        camPos: center.clone().add(norm.clone().multiplyScalar(12)).add(new THREE.Vector3(0, 3.5, 0))
      };
    });

    const builtStations = { 0: true, 1: false, 2: false, 3: true, 4: false, 5: false, 6: false };
    const stationBuilders = {
      1: buildStation1,
      2: buildStation2,
      4: buildStation4,
      5: buildStation5,
      6: buildStation6
    };

    const ensureStation = (idx) => {
      if (!builtStations[idx] && stationBuilders[idx]) {
        builtStations[idx] = true;
        try {
          stationBuilders[idx]();
        } catch (e) {
          console.warn(`[Build Station ${idx}] Error:`, e);
        }
      }
    };
    window.__ensureStation = ensureStation;

    // Dựng dần các thành phần theo từng khung hình sau khi Trạm 0 và khung cảnh chính đã vẽ lên màn hình
    const stagedTasks = [
      { name: 'Xe Hoa 20/10', run: buildTruck },
      { name: 'Cỗ Xe Bạch Mã Hoàng Gia', run: buildCarriageVehicle },
      { name: 'Hàng Rào Cổ Điển', run: buildVintageFence },
      { name: 'Đèn Đường Cổ Điển', run: buildStreetLamps },
      { name: 'Rừng Anh Đào', run: buildCherryTrees },
      { name: 'Trạm 1 (Bưu Điện Hoa)', run: () => ensureStation(1) },
      { name: 'Trạm 2 (Vườn Trà & Bánh)', run: () => ensureStation(2) },
      { name: 'Trạm 4 (Quảng Trường Hoa)', run: () => ensureStation(4) },
      { name: 'Trạm 5 (Lâu Đài Cổ Tích)', run: () => ensureStation(5) },
      { name: 'Trạm 6 (Vọng Lâu Ngắm Sao)', run: () => ensureStation(6) }
    ];

    let stagedIdx = 0;
    const processNextStage = () => {
      if (stagedIdx >= stagedTasks.length) return;
      const task = stagedTasks[stagedIdx++];
      try {
        const t0 = performance.now();
        task.run();
        const dt = (performance.now() - t0).toFixed(1);
        console.log(`⏱️ [Progressive Stage] ${task.name} sẵn sàng (+${dt}ms)`);
      } catch (err) {
        console.warn(`[Progressive Stage] Error loading ${task.name}:`, err);
      }
      requestAnimationFrame(processNextStage);
    };

    /* ---------- [P3] Camera transitions dictionary ---------- */
    transRef.current = {
      active: false,
      t0: 0,
      dur: 1400,
      fromCam: new THREE.Vector3(),
      toCam: new THREE.Vector3(),
      fromTgt: new THREE.Vector3(),
      toTgt: new THREE.Vector3(),
      stationsPos: stationCameraPositions,
      isVanRelative: true,
      preset: VAN_PRESETS.chase
    };

// ===== PHẦN 3/5 — KẾT THÚC =====
// ===== PHẦN 4/5 — BẮT ĐẦU =====
    /* ================================================================== */
    /*  [P4] CAMERA SHAKE REF — dùng ở PHẦN 5                                */
    /* ================================================================== */
    const shakeRef = { intensity: 0, decay: 5 };

    /* ================================================================== */
    /*  [P4] FIREWORKS UPGRADE — 3 TẦNG + TRAIL KHÓI + TÀN LỬA + DOPPLER    */
    /*  Ghi đè explode() cũ bằng phiên bản mới (giữ tên hàm)               */
    /* ================================================================== */
    // [P4] Trail khói cho rocket — 500 Sprite pool
    const SMOKE_MAX = 500;
    const smokeTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, 'rgba(220,200,180,0.55)');
      gr.addColorStop(0.5, 'rgba(180,160,140,0.25)');
      gr.addColorStop(1, 'rgba(120,100,90,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    })();
    const smokePool = [];
    for (let i = 0; i < SMOKE_MAX; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: smokeTex,
        color: 0xFFFFFF,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.NormalBlending
      }));
      sp.visible = false;
      scene.add(sp);
      smokePool.push({ sprite: sp, life: 0, maxLife: 1, vel: new THREE.Vector3() });
    }
    let smokeHead = 0;
    const spawnSmoke = (pos, color = 0xCCBBAA) => {
      const s = smokePool[smokeHead];
      smokeHead = (smokeHead + 1) % SMOKE_MAX;
      s.sprite.position.copy(pos);
      s.sprite.material.color.setHex(color);
      s.sprite.material.opacity = 0.6;
      s.sprite.scale.setScalar(0.3);
      s.sprite.visible = true;
      s.life = 0;
      s.maxLife = 1.2 + rand() * 0.6;
      s.vel.set((rand() - 0.5) * 0.4, 0.3 + rand() * 0.5, (rand() - 0.5) * 0.4);
    };

    // [P4] Hạt tàn lửa rơi xuống đất (spark burst nhỏ khi chạm đất)
    const addGroundSpark = (pos) => {
      for (let i = 0; i < 12; i++) {
        const v = new THREE.Vector3((rand() - 0.5) * 4, 2 + rand() * 3, (rand() - 0.5) * 4);
        addPart(pos, v, new THREE.Color(0xFFB347), 0.6, 4, 1.5, 6, true);
      }
    };

    // [P4] Âm thanh theo khoảng cách camera (Doppler-ish)
    const soundBoomAt = (pos, delay = 0.05, vol = 0.7) => {
      const camPos = camera.position;
      const dist = camPos.distanceTo(pos);
      const distDelay = Math.min(1.2, dist * 0.004);
      const distVol = Math.max(0.15, vol * (1 - Math.min(0.85, dist / 200)));
      soundBoom(delay + distDelay, distVol);
    };

    // [P4] GHI ĐÈ explode() — phiên bản 12 bảng màu cao cấp & 12 loại pháo hoa 3D đỉnh cao
    const PALETTES_V2 = [
      [0xFFD700, 0xFFF2B2, 0xC9A66B], // 24K Gold & Champagne
      [0xFF1493, 0xBE123C, 0xFDA4AF], // Ruby & Rose Neon
      [0xA855F7, 0x38BDF8, 0xFFFFFF], // Violet & Cyan Laser
      [0x10B981, 0x6EE7B7, 0xFDE047], // Emerald & Sunburst
      [0xFB923C, 0xFDE047, 0xFF4D8D], // Sunset Coral
      [0xE0E7FF, 0x93C5FD, 0xFFFFFF], // Diamond Sparkle
      [0x00F5FF, 0x0077FE, 0xFFFFFF], // Ocean Sapphire
      [0xFF007F, 0x00FFFF, 0xFFE600], // Cyberpunk Tri-Color
      [0xFF4500, 0xFFB300, 0xFF1493], // Phoenix Fire
      [0x8A2BE2, 0xDDA0DD, 0xFFFFFF], // Royal Velvet Purple
      [0x00FF88, 0x66FFFF, 0xFFFFFF], // Aurora Borealis
      [0xFFD700, 0xFF69B4, 0xFFFFFF]  // 20/10 Queen Celebration
    ];
    const pickPalV2 = () => PALETTES_V2[Math.floor(rand() * PALETTES_V2.length)].map(c => new THREE.Color(c));

    const explodeUpgraded = (pos, type) => {
      const pal = pickPalV2();
      fwFlash(pos, pal[0]);

      // 1. FLASH TRẮNG TỨC THÌ (WHITE FLASH SPRITE) — Đánh dấu tâm nổ giúp mắt nhận diện trọn vẹn quả cầu pháo hoa
      try {
        const flashSprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: fwTex,
          color: 0xFFFFFF,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        }));
        flashSprite.position.copy(pos);
        flashSprite.scale.setScalar(26);
        scene.add(flashSprite);

        const flashT0 = performance.now();
        const flashLife = 220; // 220ms bùng sáng rồi mờ dần
        const flashAnim = () => {
          const t = (performance.now() - flashT0) / flashLife;
          if (t >= 1) {
            scene.remove(flashSprite);
            flashSprite.material.dispose();
            return;
          }
          flashSprite.material.opacity = (1 - t) * 0.95;
          flashSprite.scale.setScalar(26 + t * 24);
          requestAnimationFrame(flashAnim);
        };
        flashAnim();
      } catch (e) {}

      // Hào quang flash tức thì tại tâm nổ để mắt người nhận diện rõ quả cầu bùng sáng
      for (let f = 0; f < 8; f++) {
        addPart(pos, randDir().multiplyScalar(4 + rand() * 6), new THREE.Color(0xFFFFFF), 1, 3.2, 0.4, 0, false);
      }
      addPart(pos, new THREE.Vector3(), new THREE.Color(0xffffff), 1, 6, 0, 0);

      soundBoomAt(pos, 0.08 + rand() * 0.1, 0.9);
      triggerShake(pos, 0.22 + rand() * 0.12);

      // [P4] Trail khói tại điểm nổ
      for (let s = 0; s < 12; s++) spawnSmoke(pos.clone().add(new THREE.Vector3((rand() - 0.5) * 3, (rand() - 0.5) * 3, (rand() - 0.5) * 3)));

      // BỘ HẰNG SỐ VẬT LÝ VÀNG: Trọng lực nhẹ + lực cản êm + tuổi thọ dài
      // Giúp quả cầu pháo hoa bung tròn đều 360 độ, không bị bóp méo thành giọt nước rơi
      const GRAV_STANDARD = 2.8;
      const DRAG_SMOOTH = 0.68;
      const DECAY_LONG = 0.26 + rand() * 0.12;

      if (type === 'heart') {
        // [ĐẶC QUYỀN 20/10] Trái tim hồng ngọc & vàng champagne khổng lồ tỏa sáng trên bầu trời
        const heartPal = [new THREE.Color(0xFF1493), new THREE.Color(0xFDA4AF), new THREE.Color(0xFFE4E6), new THREE.Color(0xFFD700)];
        const rotY = rand() * Math.PI * 2;
        for (let i = 0; i < 280; i++) {
          const t = (i / 280) * Math.PI * 2;
          const hx = 16 * Math.pow(Math.sin(t), 3);
          const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
          const v = new THREE.Vector3(hx * 2.6, hy * 2.6, (rand() - 0.5) * 4);
          v.applyAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
          const c = heartPal[i % heartPal.length];
          addPart(pos, v, c.clone(), 1, DECAY_LONG, 0.65, 2.2, true);
        }
      } else if (type === 'star') {
        // [ĐẶC QUYỀN 20/10] Ngôi sao 5 cánh vàng 24K rực sáng đỉnh lâu đài
        const starPal = [new THREE.Color(0xFFD700), new THREE.Color(0xFFF2B2), new THREE.Color(0xFFFFFF)];
        for (let pt = 0; pt < 5; pt++) {
          const baseAngle = (pt / 5) * Math.PI * 2 - Math.PI / 2;
          for (let k = 0; k < 45; k++) {
            const t = k / 45;
            const armDir = new THREE.Vector3(Math.cos(baseAngle), Math.sin(baseAngle), (rand() - 0.5) * 0.2).normalize();
            const v = armDir.multiplyScalar(18 + t * 30).add(randDir().multiplyScalar(1.5));
            addPart(pos, v, starPal[k % starPal.length].clone(), 1, DECAY_LONG, 0.65, 2.4, true);
          }
        }
      } else if (type === 'multibreak') {
        // [ĐẶC QUYỀN 20/10] Pháo chùm hoa đăng đa tầng tự nổ liên hoàn
        for (let i = 0; i < 200; i++) {
          const v = randDir().multiplyScalar(36 + rand() * 8);
          addPart(pos, v, pal[i % pal.length].clone(), 1, DECAY_LONG, DRAG_SMOOTH, 2.8, true);
        }
        for (let s = 0; s < 6; s++) {
          const sDir = randDir().multiplyScalar(20 + rand() * 10);
          const subPos = pos.clone().add(sDir.clone().multiplyScalar(0.45));
          setTimeout(() => {
            explodeUpgraded(subPos, 'crackle');
          }, 350 + s * 130);
        }
      } else if (type === 'saturn') {
        // [ĐẶC QUYỀN 20/10] Hành tinh Saturn có vành đai sao chổi nghiêng
        for (let i = 0; i < 150; i++) {
          addPart(pos, randDir().multiplyScalar(24 + rand() * 6), pal[0].clone(), 1, DECAY_LONG, DRAG_SMOOTH, 2.8, true);
        }
        const ringTilt = 0.45;
        for (let i = 0; i < 190; i++) {
          const a = (i / 190) * Math.PI * 2;
          const rv = new THREE.Vector3(Math.cos(a) * 40, Math.sin(a) * 40 * Math.sin(ringTilt), Math.sin(a) * 40 * Math.cos(ringTilt));
          addPart(pos, rv, (pal[1] || pal[0]).clone(), 1, DECAY_LONG, 0.65, 2.4, true);
        }
      } else if (type === 'chrysanthemum') {
        // 3 tầng dày dặc: outer speed 38-44, mid 24-28, inner 13-16 (Tổng 320 hạt bung tròn rộng chân trời)
        for (let i = 0; i < 320; i++) {
          const speed = i < 160 ? (38 + rand() * 6) : (i < 250 ? (24 + rand() * 4) : (13 + rand() * 3));
          const c = i < 160 ? pal[0] : (i < 250 ? pal[1] : (pal[2] || pal[0]));
          addPart(pos, randDir().multiplyScalar(speed), c.clone(), 1, DECAY_LONG, DRAG_SMOOTH, GRAV_STANDARD, true);
        }
      } else if (type === 'palm') {
        // 14 nhánh dày xòe rộng rực rỡ, mỗi nhánh 22 hạt, tốc độ 40
        const branches = 14;
        for (let b = 0; b < branches; b++) {
          const bdir = randDir();
          for (let i = 0; i < 22; i++) {
            const v = bdir.clone().multiplyScalar(40).add(new THREE.Vector3((rand() - 0.5) * 4, (rand() - 0.5) * 4, (rand() - 0.5) * 4));
            addPart(pos, v, pal[b % pal.length].clone(), 1, DECAY_LONG, 0.70, 2.6, true);
          }
        }
      } else if (type === 'willow') {
        // Liễu vàng 24K rơi rủ lấp lánh như cơn mưa vàng hoàng gia
        for (let i = 0; i < 260; i++) {
          const gold = new THREE.Color(0xFFD700).lerp(new THREE.Color(0xFFE57F), rand() * 0.7);
          addPart(pos, randDir().multiplyScalar(20 + rand() * 8), gold, 1, 0.20 + rand() * 0.1, 0.75, 2.0, true);
        }
      } else if (type === 'crackle') {
        // Crackle đa tầng giòn giã rợp trời
        for (let i = 0; i < 240; i++) {
          addPart(pos, randDir().multiplyScalar(34 + rand() * 8), pal[i % pal.length].clone(), 1, DECAY_LONG, DRAG_SMOOTH, 2.8, true, true);
        }
      } else if (type === 'sphere') {
        for (let i = 0; i < 280; i++)
          addPart(pos, randDir().multiplyScalar(34 + rand() * 10), pal[i % pal.length].clone(), 1, DECAY_LONG, DRAG_SMOOTH, GRAV_STANDARD, true);
      } else if (type === 'double') {
        for (let i = 0; i < 180; i++)
          addPart(pos, randDir().multiplyScalar(42 + rand() * 6), pal[0].clone(), 1, DECAY_LONG, DRAG_SMOOTH, GRAV_STANDARD, true);
        for (let i = 0; i < 120; i++)
          addPart(pos, randDir().multiplyScalar(22 + rand() * 4), pal[1].clone(), 1, DECAY_LONG, DRAG_SMOOTH, GRAV_STANDARD, true);
      } else if (type === 'ring') {
        const axis = randDir();
        const u = new THREE.Vector3().crossVectors(axis, new THREE.Vector3(0, 1, 0.3)).normalize();
        const v = new THREE.Vector3().crossVectors(axis, u);
        for (let i = 0; i < 160; i++) {
          const a = (i / 160) * Math.PI * 2;
          const d = u.clone().multiplyScalar(Math.cos(a)).add(v.clone().multiplyScalar(Math.sin(a)));
          addPart(pos, d.multiplyScalar(36 + rand() * 4), pal[0].clone(), 1, DECAY_LONG, DRAG_SMOOTH, 2.5, true);
        }
      } else if (type === 'brocade') {
        for (let i = 0; i < 280; i++) {
          const diamond = new THREE.Color(0xFFFFFF).lerp(new THREE.Color(0xFFE082), rand());
          addPart(pos, randDir().multiplyScalar(34 + rand() * 8), diamond, 1, DECAY_LONG, DRAG_SMOOTH, 2.4, true);
        }
      }
    };

    // [P4] Gán lại explode cho toàn bộ hệ thống dùng phiên bản mới
    // (Vì explode được khai báo bằng const, ta phải thay thế tham chiếu trong rocket)
    // → Sửa launchRocket và updateFireworks: dùng explodeUpgraded
    // Nhưng để đơn giản, ta ghi đè biến toàn cục bằng let
    // → Cách sạch: đổi const explode → let explode ở PHẦN 3
    // → Nhưng PHẦN 3 đã gửi rồi, nên ta dùng kỹ thuật "wrapper":
    //   launchRocket ở PHẦN 3 gọi explode(...) — vẫn chạy phiên bản cũ.
    //   Ta phải override bằng cách: gán lại FW.rockets handler.
    //   Giải pháp: tạo biến mới explodeCurrent và patch updateFireworks.
    //   → Đơn giản nhất: từ đây, mọi launchRocket PHẦN 4 (nếu có) gọi explodeUpgraded.
    //   → Và ta override updateFireworks để dùng explodeUpgraded thay explode.

    // [P4] Trigger camera shake
    function triggerShake(pos, strength) {
      const dist = camera.position.distanceTo(pos);
      const factor = Math.max(0, 1 - dist / 80);
      shakeRef.intensity = Math.min(0.8, shakeRef.intensity + strength * factor);
    }

    // [P4] GHI ĐÈ updateFireworks — dùng explodeUpgraded + trail khói + tàn lửa
    // Do updateFireworks ở PHẦN 3 là const, ta phải viết phiên bản mới và
    // gán lại vào biến global để PHẦN 5 gọi. Cách: tạo updateFireworksV2,
    // và trong PHẦN 5 ta sẽ gọi updateFireworksV2 thay vì updateFireworks.
    const updateFireworksV2 = (dt) => {
      dt = Math.min(dt, 0.05);

      // Rocket bay + trail khói + tàn lửa
      for (let i = FW.rockets.length - 1; i >= 0; i--) {
        const r = FW.rockets[i];
        r.pos.addScaledVector(r.vel, dt);
        r.vel.y -= 6 * dt;
        r.fuse -= dt;

        // Trail lửa
        for (let k = 0; k < 3; k++)
          addPart(r.pos, new THREE.Vector3((rand() - 0.5) * 2, -2 - rand() * 3, (rand() - 0.5) * 2),
            new THREE.Color(0xFFC857), 0.8, 2.5 + rand(), 1, 2, true);

        // Trail khói
        if (rand() < 0.5) spawnSmoke(r.pos.clone(), 0x998877);

        if (r.fuse <= 0) {
          explodeUpgraded(r.pos, r.type);
          FW.rockets.splice(i, 1);
        }
      }

      // Hạt pháo hoa
      for (let i = FW.parts.length - 1; i >= 0; i--) {
        const p = FW.parts[i];
        p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
        p.vel.y -= p.grav * dt;
        // Gió nhẹ tự nhiên khiến tàn pháo hoa trôi bồng bềnh
        p.vel.x += Math.sin(p.pos.y * 0.08) * 0.18 * dt;
        p.vel.z += Math.cos(p.pos.y * 0.08) * 0.18 * dt;
        p.pos.addScaledVector(p.vel, dt);
        p.life -= p.decay * dt;

        // [P4] Hạt chạm đất → tàn lửa nhỏ
        if (p.pos.y < 0.1 && p.vel.y < 0 && p.life > 0.1) {
          addGroundSpark(new THREE.Vector3(p.pos.x, 0.1, p.pos.z));
          p.life = 0;
        }

        if (p.life <= 0) {
          if (p.crackle) {
            soundCrackle();
            for (let k = 0; k < 3; k++)
              addPart(p.pos, randDir().multiplyScalar(5), new THREE.Color(0xffffff), 0.5, 3, 1, 4, true);
          }
          FW.parts[i] = FW.parts[FW.parts.length - 1];
          FW.parts.pop();
        }
      }

      // Nạp buffer
      const n = FW.parts.length;
      for (let i = 0; i < n; i++) {
        const p = FW.parts[i];
        const f = p.life * (p.flicker ? (0.4 + Math.random() * 0.8) : 1);
        fwPos[i * 3] = p.pos.x; fwPos[i * 3 + 1] = p.pos.y; fwPos[i * 3 + 2] = p.pos.z;
        fwCol[i * 3] = p.color.r * f; fwCol[i * 3 + 1] = p.color.g * f; fwCol[i * 3 + 2] = p.color.b * f;
        fwLife[i] = p.life;
      }
      fwGeo.setDrawRange(0, n);
      fwGeo.attributes.position.needsUpdate = true;
      fwGeo.attributes.color.needsUpdate = true;
      fwGeo.attributes.aLife.needsUpdate = true;

      // Đèn chớp tắt dần
      FW.lights.forEach(l => { l.intensity *= Math.pow(0.02, dt); });

      // [P4] Update smoke pool
      for (let i = 0; i < SMOKE_MAX; i++) {
        const s = smokePool[i];
        if (!s.sprite.visible) continue;
        s.life += dt;
        if (s.life >= s.maxLife) {
          s.sprite.visible = false;
          s.sprite.material.opacity = 0;
          continue;
        }
        const t = s.life / s.maxLife;
        s.sprite.position.addScaledVector(s.vel, dt);
        s.sprite.scale.setScalar(0.3 + t * 2.5);
        s.sprite.material.opacity = 0.6 * (1 - t);
      }
    };

    // [P4] Trigger pháo castle 3 giàn độc lập (Trái - Giữa - Phải) siêu hoành tráng
    let triggerCastleFireworks_Upgraded = () => {};
    {
      triggerCastleFireworks_Upgraded = () => {
        getAC();
        const st5 = stationCameraPositions[5];
        if (!st5) {
          console.warn('[Fireworks] Station 5 camera position not ready');
          return;
        }
        const stCam = st5.camPos;
        const stTgt = st5.targetPos;
        const fwd = stTgt.clone().sub(stCam);
        fwd.y = 0;
        fwd.normalize();
        const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
        const castleCenter = stTgt.clone().add(fwd.clone().multiplyScalar(8.0));

        // 3 GIÀN PHÁO ĐỘC LẬP TRẢI RỘNG 120 ĐỘ (TRÁI - GIỮA - PHẢI) PHỦ KÍN BẦU TRỜI
        const batteryLeft = castleCenter.clone().sub(side.clone().multiplyScalar(24.0)).add(fwd.clone().multiplyScalar(-3.0));
        const batteryCenter = castleCenter.clone().add(fwd.clone().multiplyScalar(6.0));
        const batteryRight = castleCenter.clone().add(side.clone().multiplyScalar(24.0)).add(fwd.clone().multiplyScalar(-3.0));

        const types = ['heart', 'star', 'multibreak', 'saturn', 'chrysanthemum', 'palm', 'willow', 'crackle', 'sphere', 'double', 'ring', 'brocade'];

        const launchFromBattery = (batteryPos, aimSideOffset, altSpeed, fuseDuration, forcedType) => {
          const type = forcedType || types[Math.floor(rand() * types.length)];
          const rPos = batteryPos.clone()
            .add(side.clone().multiplyScalar((rand() - 0.5) * 8))
            .add(fwd.clone().multiplyScalar((rand() - 0.5) * 6));
          const baseH = heightAt(rPos.x, rPos.z);

          // Vector vận tốc bắn chéo nghiêng vào vòm trời trung tâm
          const vel = side.clone().multiplyScalar(aimSideOffset)
            .add(new THREE.Vector3(0, altSpeed + rand() * 6, 0))
            .add(fwd.clone().multiplyScalar((rand() - 0.5) * 4));

          FW.rockets.push({
            pos: new THREE.Vector3(rPos.x, baseH + 3.0, rPos.z),
            vel,
            fuse: fuseDuration + rand() * 0.35,
            type
          });
          soundLaunch();
        };

        // 1. KHAI MÀN ĐỒNG LOẠT 3 GIÀN TRẢI RỘNG (FAN TRIPLE LAUNCH) — 3 TẦNG TRỜI NGAY TRONG TẦM MẮT
        const fireFanSalvo = (delay = 0, forcedType) => {
          setTimeout(() => {
            launchFromBattery(batteryLeft, 6.5, 29, 1.22, forcedType);
            launchFromBattery(batteryCenter, 0, 33, 1.25, forcedType);
            launchFromBattery(batteryRight, -6.5, 29, 1.22, forcedType);
          }, delay);
        };

        // Khai màn rực sáng ngay giây đầu tiên: Quả pháo Heart hình trái tim khổng lồ ở giữa
        fireFanSalvo(0, 'heart');
        fireFanSalvo(600, 'brocade');

        // 2. CÁC ĐỢT PHÁO KẾ TIẾP ĐAN XEN GIỮA 3 GIÀN SUỐT 14 GIÂY (3 TẦNG ĐỘ CAO KHÔNG GIAN)
        for (let w = 0; w < 16; w++) {
          const delay = 1200 + w * 650;
          setTimeout(() => {
            const batteryChoice = w % 3;
            if (batteryChoice === 0) {
              launchFromBattery(batteryLeft, 5.0, 28, 1.2, 'multibreak');
              launchFromBattery(batteryCenter, (rand() - 0.5) * 3, 33, 1.25, 'star');
            } else if (batteryChoice === 1) {
              launchFromBattery(batteryCenter, 0, 35, 1.3, 'heart');
              launchFromBattery(batteryRight, -5.0, 28, 1.2, 'saturn');
            } else {
              fireFanSalvo(0);
            }
          }, delay);
        }

        // 3. ĐẠI KẾT GRAND CLIMAX BÙNG NỔ HOÀNG GIA (12s): 24 PHÁO NỔ ĐỒNG LOẠT PHỦ KÍN 3 TẦNG BẦU TRỜI
        setTimeout(() => {
          showToast('👑 ĐẠI TIỆC PHÁO HOA 20/10 RỰC RỠ TRÊN VƯƠNG QUỐC HOA!');
          for (let f = 0; f < 24; f++) {
            setTimeout(() => {
              const b = f % 3 === 0 ? batteryLeft : (f % 3 === 1 ? batteryCenter : batteryRight);
              const aim = f % 3 === 0 ? (4 + rand() * 3) : (f % 3 === 1 ? (rand() - 0.5) * 4 : -(4 + rand() * 3));
              const speedTier = f % 3 === 0 ? 27 : (f % 3 === 1 ? 32 : 36);
              const fuseTier = f % 3 === 0 ? 1.15 : (f % 3 === 1 ? 1.25 : 1.32);
              launchFromBattery(b, aim, speedTier + rand() * 3, fuseTier + rand() * 0.15, types[f % types.length]);
            }, f * 95);
          }
        }, 11500);
      };

      // Gán lại biến cũ để nút click dùng bản mới
      triggerCastleFireworks = triggerCastleFireworks_Upgraded;
    }

    /* ================================================================== */
    /*  [P4] NẾN LỬA THẬT — FlameShader + PointLight flicker               */
    /*  Quét scene tìm các nến đã tạo ở PHẦN 3 (trong cakeGroup) và thay    */
    /*  Sprite glow cũ bằng flame mesh thật                                 */
    /* ================================================================== */
    const realCandleFlames = [];
    {
      // Duyệt scene để tìm nến (cylinder wax trắng có vị trí gần bánh kem)
      // → Thay vì phức tạp, ta tạo thêm flame thật tại vị trí đã biết
      //   từ PHẦN 3 (cakeGroup ở st5Center + local offset)
      const pt = curve.getPointAt(STATIONS[5].u);
      const T = curve.getTangentAt(STATIONS[5].u);
      const norm = new THREE.Vector3(T.z, 0, -T.x).normalize();
      const st5Center = pt.clone().add(norm.clone().multiplyScalar(9.5));
      const st5Y = heightAt(st5Center.x, st5Center.z);
      const st5RotY = Math.atan2(norm.x, norm.z);

      const cakeBaseLocal = new THREE.Vector3(-2.5, 2.92, 3.0);
      const cakeBaseWorld = cakeBaseLocal.clone().applyEuler(new THREE.Euler(0, st5RotY, 0)).add(new THREE.Vector3(st5Center.x, st5Y, st5Center.z));

      // 6 nến + 1 nến chủ trên bánh
      const candlePositions = [];
      for (let cn = 0; cn < 6; cn++) {
        const ca = (cn / 6) * Math.PI * 2;
        const cRad = cn < 4 ? 0.82 : 0.56;
        const cBaseY = cn < 4 ? 1.0 : 1.36;
        candlePositions.push(new THREE.Vector3(
          Math.sin(ca) * cRad,
          cakeBaseWorld.y + cBaseY + 0.46,
          Math.cos(ca) * cRad
        ));
      }
      candlePositions.push(new THREE.Vector3(0, cakeBaseWorld.y + 1.96, 0));

      // Tạo geometry lửa
      const flameGeo = new THREE.ConeGeometry(0.045, 0.14, 8, 4, true);

      // [TỐI ƯU ÁNH SÁNG] Thay thế 7 đèn nến riêng lẻ bằng 1 PointLight trung tâm ấm áp
      // Tiết kiệm 6 phép tính nguồn sáng động mỗi frame
      const cakeCenterLight = new THREE.PointLight(0xFFB060, 1.8, 5.0, 2);
      cakeCenterLight.position.set(cakeBaseWorld.x, cakeBaseWorld.y + 1.2, cakeBaseWorld.z);
      scene.add(cakeCenterLight);

      candlePositions.forEach((localPos, idx) => {
        const uniform = { value: 0 };
        const flameMat = new THREE.ShaderMaterial({
          uniforms: {
            uTime: uniform,
            uColorInner: { value: new THREE.Color(0xFFF4C2) },
            uColorOuter: { value: new THREE.Color(0xFF9A3C) }
          },
          vertexShader: FlameShader.vertexShader,
          fragmentShader: FlameShader.fragmentShader,
          transparent: true,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide
        });
        const flameMesh = new THREE.Mesh(flameGeo, flameMat);
        flameMesh.position.set(
          cakeBaseWorld.x + localPos.x,
          localPos.y,
          cakeBaseWorld.z + localPos.z
        );
        flameMesh.renderOrder = 5;
        scene.add(flameMesh);

        realCandleFlames.push({
          mesh: flameMesh,
          uniform,
          light: cakeCenterLight,
          baseIntensity: 1.8,
          phase: rand() * Math.PI * 2,
          seed: idx
        });
      });
      worldAtmosphereRef.current.flameUniforms = realCandleFlames;
    }

    /* ================================================================== */
    /*  [P4] BƯỚM NOISE WANDER — thay lerp tuyến tính bằng noise 3D         */
    /* ================================================================== */
    const butterflyWander = giftAnimationRef.current.butterflies.map((b) => ({
      b,
      seed: rand() * 1000,
      t: 0,
      phaseX: rand() * Math.PI * 2,
      phaseY: rand() * Math.PI * 2,
      phaseZ: rand() * Math.PI * 2,
      freq: 0.6 + rand() * 0.9
    }));

    const updateButterfliesWander = (dt, elapsed) => {
      const giftAnim = giftAnimationRef.current;
      if (!giftAnim.opened) return;
      const prog = giftAnim.openProgress;
      const easeProg = 1 - Math.pow(1 - prog, 3);

      butterflyWander.forEach((w, i) => {
        const b = w.b;
        b.group.visible = true;
        b.group.scale.setScalar((b.baseScale || 1.0) * Math.min(1.0, easeProg * 1.5));
        w.t += dt * w.freq;

        // Vị trí đích (targetOffset) + noise wander
        const tx = b.targetOffset.x * easeProg;
        const ty = b.targetOffset.y * easeProg;
        const tz = b.targetOffset.z * easeProg;

        const wanderX = Math.sin(w.t * 1.3 + w.phaseX) * 1.8 + Math.sin(w.t * 2.1 + w.seed) * 0.6;
        const wanderY = Math.sin(w.t * 0.9 + w.phaseY) * 1.5 + Math.sin(w.t * 1.7 + w.seed + 10) * 0.5;
        const wanderZ = Math.cos(w.t * 1.1 + w.phaseZ) * 1.8 + Math.cos(w.t * 1.9 + w.seed + 20) * 0.6;

        b.group.position.set(
          b.initialPos.x + tx + wanderX,
          b.initialPos.y + ty + wanderY,
          b.initialPos.z + tz + wanderZ
        );

        // Xoay theo hướng bay (approximate)
        b.group.rotation.y = Math.atan2(wanderX, wanderZ);
        b.group.rotation.x = Math.sin(w.t * 1.5 + w.seed) * 0.15;

        // Cánh vỗ có nhịp điệu (thỉnh thoảng ngưng nghỉ)
        const flapMod = Math.sin(w.t * 3 + w.seed) > 0.7 ? 0.3 : 1.0;
        const flap = Math.sin(elapsed * 18 + i * 0.5) * 0.7 * flapMod;
        b.wingLeft.rotation.y = flap;
        b.wingRight.rotation.y = -flap;
      });
    };

    /* ================================================================== */
    /*  [P4] BỌT CHAMPAGNE ANIMATE — bay lên + tái sinh                     */
    /* ================================================================== */
    let champagneBubblesMesh = null;
    let champagneBubbleData = null;
    scene.traverse((obj) => {
      if (obj.isInstancedMesh && obj.userData && obj.userData.isChampagneBubbles) {
        champagneBubblesMesh = obj;
        champagneBubbleData = obj.userData.bubbleData;
      }
    });

    const updateChampagneBubbles = (dt) => {
      if (!champagneBubblesMesh || !champagneBubbleData) return;
      const dummy = new THREE.Object3D();
      for (let i = 0; i < champagneBubbleData.length; i++) {
        const b = champagneBubbleData[i];
        b.y += b.speed * dt;
        if (b.y > 1.05) {
          b.y = 0;
          b.x = (rand() - 0.5) * 0.28;
          b.z = (rand() - 0.5) * 0.28;
        }
        dummy.position.set(b.x, b.y, b.z);
        dummy.scale.setScalar(0.6 + Math.sin(b.y * 10) * 0.3);
        dummy.updateMatrix();
        champagneBubblesMesh.setMatrixAt(i, dummy.matrix);
      }
      champagneBubblesMesh.instanceMatrix.needsUpdate = true;
    };

    /* ================================================================== */
    /*  [P4] PETAL INSTANCED — thay Points bằng InstancedMesh Plane         */
    /*  Xoay theo gió + noise 2D                                            */
    /* ================================================================== */
    const PETALS_INST = Math.floor(260 * Q);
    const petalInstGeo = new THREE.PlaneGeometry(0.18, 0.12);
    const petalInstMat = new THREE.MeshPhysicalMaterial({
      color: 0xFFD0E0,
      side: THREE.DoubleSide,
      roughness: 0.6,
      sheen: 0.5,
      sheenColor: new THREE.Color(0xFFFFFF),
      transparent: true,
      opacity: 0.92
    });
    const petalInstMesh = new THREE.InstancedMesh(petalInstGeo, petalInstMat, PETALS_INST);
    petalInstMesh.frustumCulled = false;
    petalInstMesh.castShadow = false;
    scene.add(petalInstMesh);

    const petalData = [];
    for (let i = 0; i < PETALS_INST; i++) {
      const u = rand();
      const p = curve.getPointAt(u);
      const offsetR = 2 + rand() * 35;
      const offsetA = rand() * Math.PI * 2;
      const px = p.x + Math.cos(offsetA) * offsetR;
      const pz = p.z + Math.sin(offsetA) * offsetR;
      petalData.push({
        x: px,
        y: 3 + rand() * 8,
        z: pz,
        vx: (rand() - 0.5) * 0.3,
        vy: -0.3 - rand() * 0.4,
        vz: (rand() - 0.5) * 0.3,
        rotX: rand() * Math.PI * 2,
        rotY: rand() * Math.PI * 2,
        rotZ: rand() * Math.PI * 2,
        rotSpeedX: (rand() - 0.5) * 2,
        rotSpeedY: (rand() - 0.5) * 2,
        rotSpeedZ: (rand() - 0.5) * 2,
        scale: 0.6 + rand() * 0.8
      });
    }

    const petalDummy = new THREE.Object3D();
    const updatePetals = (dt, elapsed) => {
      for (let i = 0; i < petalData.length; i++) {
        const p = petalData[i];
        // Gió nhẹ
        const windX = Math.sin(elapsed * 0.3 + p.z * 0.05) * 0.4;
        const windZ = Math.cos(elapsed * 0.4 + p.x * 0.05) * 0.4;
        p.x += (p.vx + windX) * dt;
        p.y += p.vy * dt;
        p.z += (p.vz + windZ) * dt;
        p.rotX += p.rotSpeedX * dt;
        p.rotY += p.rotSpeedY * dt;
        p.rotZ += p.rotSpeedZ * dt;

        if (p.y < 0.2) {
          p.y = 8 + rand() * 4;
          const u = rand();
          const cp = curve.getPointAt(u);
          p.x = cp.x + (rand() - 0.5) * 40;
          p.z = cp.z + (rand() - 0.5) * 40;
        }

        petalDummy.position.set(p.x, p.y, p.z);
        petalDummy.rotation.set(p.rotX, p.rotY, p.rotZ);
        petalDummy.scale.setScalar(p.scale);
        petalDummy.updateMatrix();
        petalInstMesh.setMatrixAt(i, petalDummy.matrix);
      }
      petalInstMesh.instanceMatrix.needsUpdate = true;
    };

    // Ẩn petalPts cũ (Points) — vẫn giữ để không break PHẦN 5
    if (petalPts) petalPts.visible = false;

    /* ================================================================== */
    /*  [P4] KHÓI ỐNG XẢ XE HOA                                            */
    /* ================================================================== */
    const EXHAUST_MAX = 60;
    const exhaustTex = (() => {
      const c = document.createElement('canvas'); c.width = c.height = 32;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(200,200,210,0.5)');
      gr.addColorStop(1, 'rgba(180,180,190,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
      const tex = new THREE.CanvasTexture(c);
      return tex;
    })();
    const exhaustPool = [];
    for (let i = 0; i < EXHAUST_MAX; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: exhaustTex,
        color: 0xCCCCCC,
        transparent: true,
        opacity: 0,
        depthWrite: false
      }));
      sp.visible = false;
      scene.add(sp);
      exhaustPool.push({ sprite: sp, life: 0, maxLife: 1.5, vel: new THREE.Vector3() });
    }
    let exhaustHead = 0;
    let exhaustAcc = 0;

    const updateExhaust = (dt, vanPos, yaw) => {
      exhaustAcc += dt;
      if (exhaustAcc > 0.12) {
        exhaustAcc = 0;
        const s = exhaustPool[exhaustHead];
        exhaustHead = (exhaustHead + 1) % EXHAUST_MAX;
        // Vị trí ống xả phía sau xe (local -2.3 z)
        const localExhaust = new THREE.Vector3(0, 0.55, -2.35);
        localExhaust.applyAxisAngle(Y_AXIS, yaw).add(vanPos);
        s.sprite.position.copy(localExhaust);
        s.sprite.material.opacity = 0.5;
        s.sprite.scale.setScalar(0.3);
        s.sprite.visible = true;
        s.life = 0;
        s.vel.set(
          -Math.sin(yaw) * 0.5 + (rand() - 0.5) * 0.2,
          0.4 + rand() * 0.3,
          -Math.cos(yaw) * 0.5 + (rand() - 0.5) * 0.2
        );
      }
      for (let i = 0; i < EXHAUST_MAX; i++) {
        const s = exhaustPool[i];
        if (!s.sprite.visible) continue;
        s.life += dt;
        if (s.life >= s.maxLife) {
          s.sprite.visible = false;
          continue;
        }
        const t = s.life / s.maxLife;
        s.sprite.position.addScaledVector(s.vel, dt);
        s.sprite.scale.setScalar(0.3 + t * 1.2);
        s.sprite.material.opacity = 0.5 * (1 - t);
      }
    };

    /* ================================================================== */
    /*  [P4] END — Các biến/hàm PHẦN 4 export cho PHẦN 5 dùng:             */
    /*    - shakeRef                                                        */
    /*    - updateFireworksV2                                               */
    /*    - updateButterfliesWander                                         */
    /*    - updateChampagneBubbles                                          */
    /*    - updatePetals                                                    */
    /*    - updateExhaust                                                   */
    /*    - realCandleFlames                                                */
    /*    - explodeUpgraded, triggerCastleFireworks_Upgraded                */
    /*    - triggerShake, soundBoomAt                                       */
    /* ================================================================== */

// ===== PHẦN 4/5 — KẾT THÚC =====
// ===== PHẦN 5/5 — BẮT ĐẦU =====
    /* ================================================================== */
    /*  [P5] CINEMATIC POST-PROCESSING PIPELINE                             */
    /*  Render → Bloom → SSAO → Bokeh → ColorGrade → SMAA → Output         */
    /* ================================================================== */
    const rt = new THREE.WebGLRenderTarget(width * pr, height * pr, {
      type: THREE.HalfFloatType,
      samples: lowPower ? 0 : 4
    });
    const composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(pr);
    composer.setSize(width, height);

    composer.addPass(new RenderPass(scene, camera));

    // [P5] Bloom tinh chỉnh: threshold cao → chỉ vật phát sáng thật mới glow
    const bloom = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      isNightMode ? 0.55 : 0.42,
      0.55,
      1.0
    );
    composer.addPass(bloom);
    worldAtmosphereRef.current.bloom = bloom;

    // [P5] Color grading Film Look (nhẹ, nhanh, chuẩn điện ảnh)

    // [P5] Color grading Film Look
    const colorGrade = new ShaderPass(ColorGradeShader);
    colorGrade.uniforms.uStrength.value = 1.0;
    colorGrade.uniforms.uVignette.value = 0.35;
    colorGrade.uniforms.uGrain.value = 0.012;
    colorGrade.uniforms.uAberration.value = 0.0004;
    colorGrade.uniforms.uSaturation.value = 1.08;
    colorGrade.uniforms.uTime.value = 0;
    composer.addPass(colorGrade);
    worldAtmosphereRef.current.colorGrade = colorGrade;

    // [P5] SMAA
    const smaaPass = new SMAAPass(width * pr, height * pr);
    composer.addPass(smaaPass);

    // [P5] Output
    composer.addPass(new OutputPass());

    /* ================================================================== */
    /*  [P5] POINTER INTERACTIONS — raycast đệ quy fix                     */
    /* ================================================================== */
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let isPointerDown = false;
    let downPos = { x: 0, y: 0 };
    let lastTapTime = 0;

    const onPointerDown = (e) => {
      initAmbientAudio();
      if (e.target.closest('button, .hud-aside-dock, .hud-bottom-bar, .modal-overlay, .fairy-mailbox-overlay, .hud-top-minimal-pill, .hud-van-angles-dock, .hud-nav-pad-cluster, .btn-camera-sky-toggle, .hud-center-guide-pill')) return;
      isPointerDown = true;
      downPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e) => {
      if (!isPointerDown) return;
      isPointerDown = false;
      const now = performance.now();
      const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);

      // Nhấp đúp (Double click) chuột trái vào khoảng không gian 3D để đặt lại góc nhìn mặc định của trạm
      // Chỉ kích hoạt khi click chuột trái (không xung đột với thao tác zoom 2 ngón trên màn hình cảm ứng)
      if (e.pointerType === 'mouse' && e.button === 0 && dist < 8 && now - lastTapTime < 320) {
        lastTapTime = 0;
        resetCurrentStationView();
        return;
      }
      if (e.button === 0 || !e.pointerType || e.pointerType === 'touch') lastTapTime = now;

      if (dist < 28) {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        // [TỐI ƯU RAYCAST] Không đệ quy (recursive = false) → click nhanh hơn 10-30x
        const allTargets = interactiveMeshes.map(im => im.mesh).filter(Boolean);
        const hits = raycaster.intersectObjects(allTargets, false);
        if (hits.length > 0) {
          const hit = hits[0];
          const matched = interactiveMeshes.find(im => im.mesh === hit.object);
          if (matched && matched.onClick) {
            matched.onClick(hit);
            return;
          }
        }
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);

    /* ================================================================== */
    /*  [P5] MAIN ANIMATION LOOP                                           */
    /* ================================================================== */
    let animId;
    let prevT = performance.now();
    const startT = prevT;
    let vanU = 0.35; // Khởi đầu tại u=0.35 để không bị đè vào Gazebo (Station 2 tại u=0.52)
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
      if (royalCarriage && royalCarriage.root) {
        royalCarriage.root.position.copy(vanPos);
        royalCarriage.root.rotation.y = yaw;
      }
      vanStateRef.current.pos.copy(vanPos);
      vanStateRef.current.yaw = yaw;
    };
    placeVan();
    lastVan.copy(vanPos);
    lastYaw = yaw;

    // Camera ban đầu: Trạm 0
    if (stationCameraPositions[0]) {
      camera.position.copy(stationCameraPositions[0].camPos);
      controls.target.copy(stationCameraPositions[0].targetPos);
    } else {
      camera.position.set(0, 4.5, 12);
      controls.target.set(0, 1.5, 0);
    }
    controls.update();

    // [INSTANT FIRST FRAME] Vẽ ngay 1 frame trước để user thấy ngay cảnh sắc không bị đen/đơ
    try {
      renderer.render(scene, camera);
    } catch (e) {
      console.warn('[First Frame Render] Warning:', e);
    }
    setIsSceneReady(true);
    setTimeout(() => {
      setIsVeilOpen(true);
      // Bắt đầu chuỗi nạp các thành phần & trạm ngầm theo từng nhịp rAF
      requestAnimationFrame(processNextStage);
    }, 250);

    let spawnAcc = 0;
    const camTmpA = new THREE.Vector3();
    const camTmpB = new THREE.Vector3();
    const camDestA = new THREE.Vector3();
    const camDestB = new THREE.Vector3();
    const shakeOffset = new THREE.Vector3();

    function renderLoop() {
      const now = performance.now();

      // [TỐI ƯU VIDEO 60FPS] Tạm dừng WebGL render khi xem video để giải phóng 100% GPU cho video decoding
      if (renderPausedRef.current) {
        prevT = now; // Giữ mốc thời gian tươi mới để tránh delta-time spike khi resume
        animId = requestAnimationFrame(renderLoop);
        return;
      }

      const dt = Math.min(0.05, (now - prevT) / 1000);
      prevT = now;
      const elapsed = (now - startT) * 0.001;
      timeU.value = elapsed;

      // [P5] Update shader times
      if (colorGrade) colorGrade.uniforms.uTime.value = elapsed;

      // [P4→P5] Update flame uniforms & single warm candle light
      if (worldAtmosphereRef.current.flameUniforms) {
        const flames = worldAtmosphereRef.current.flameUniforms;
        flames.forEach((f) => {
          f.uniform.value = elapsed;
        });
        if (flames.length > 0 && flames[0].light) {
          const flick = 0.8 + Math.sin(elapsed * 9) * 0.12 + Math.sin(elapsed * 19) * 0.08;
          flames[0].light.intensity = flames[0].baseIntensity * flick;
        }
      }

      /* --- 1. Van & Royal Carriage --- */
      vanU = (vanU + (SPEED * dt) / curveLen) % 1;
      const prevYaw = yaw;
      placeVan();
      const yr = dt > 0 ? normAngle(yaw - prevYaw) / dt : 0;
      yawRateS += (yr - yawRateS) * Math.min(1, dt * 4);

      const isCarriage = selectedVehicleRef.current === 'carriage';
      vanRoot.visible = !isCarriage;
      if (royalCarriage && royalCarriage.root) {
        royalCarriage.root.visible = isCarriage;
        if (isCarriage) {
          royalCarriage.update(dt, elapsed, SPEED, yawRateS);
        }
      }

      if (!isCarriage) {
        wheelAngle += (SPEED * dt) / 0.48;
        spinGroups.forEach((s) => (s.rotation.x = wheelAngle));
        const steer = Math.max(-0.4, Math.min(0.4, (yawRateS / SPEED) * 2.6));
        steerPivots.forEach((p) => p && (p.rotation.y = steer));

        bodyGroup.position.y = Math.sin(elapsed * 9) * 0.007 + Math.sin(elapsed * 3.1) * 0.012;
        bodyGroup.rotation.z = yawRateS * 0.35 + Math.sin(elapsed * 2.1) * 0.004;
        bodyGroup.rotation.x = Math.sin(elapsed * 2.4) * 0.006;
      }

      // 1b. Dải đèn LED nhỏ quanh xe và hoa: nhấp nháy phát quang lung linh
      fairyOrbs.forEach((f) => {
        const pulse = Math.sin(elapsed * 3.6 + f.off * 0.75);
        f.orb.scale.setScalar(0.85 + pulse * 0.3);
        if (f.orb.material && f.orb.material.emissiveIntensity !== undefined) {
          f.orb.material.emissiveIntensity = 2.5 + pulse * 1.8;
        }
      });

      // 1c. Đung đưa chùm bóng bay mini 3D gắn trên xe hoa theo gia tốc xe
      if (typeof vanBalloons !== 'undefined' && vanBalloons.length) {
        vanBalloons.forEach((vb) => {
          const t = elapsed * vb.speed + vb.phase;
          vb.mesh.position.y = vb.baseY + Math.sin(t) * 0.08;
          vb.mesh.position.x = vb.baseX + Math.sin(t * 0.9) * 0.05 - yawRateS * 0.16;
          vb.mesh.position.z = vb.baseZ + Math.cos(t * 0.8) * 0.05;
          vb.mesh.rotation.z = Math.sin(t * 1.2) * 0.1 - yawRateS * 0.32;
          vb.mesh.rotation.x = Math.cos(t * 1.0) * 0.08;
        });
      }

      // 1d. Đung đưa bồng bềnh nhẹ nhàng cho 36 bóng bay 3D tại Trạm 2
      if (worldAtmosphereRef.current.balloonMeshes) {
        const bList = worldAtmosphereRef.current.balloonMeshes;
        for (let i = 0; i < bList.length; i++) {
          const b = bList[i];
          if (!b.visible) continue;
          const u = b.userData;
          if (!u || !u.swayAmpY) continue;
          const t = elapsed * u.speed + u.phase;
          b.position.y = u.baseY + Math.sin(t) * u.swayAmpY;
          b.position.x = u.baseX + Math.sin(t * 0.85) * u.swayAmpX;
          b.position.z = u.baseZ + Math.cos(t * 0.72) * u.swayAmpZ;
          b.rotation.z = Math.sin(t * 1.1) * u.rotAmp;
          b.rotation.x = Math.cos(t * 0.95) * (u.rotAmp * 0.75);
        }
      }

      /* --- 2. Đom đóm --- */
      if (firefliesMesh) {
        const fPos = firefliesMesh.geometry.attributes.position.array;
        for (let i = 0; i < flyCount; i++) {
          const d = flyData[i];
          const t = elapsed * d.speed + d.phase;
          fPos[i * 3] = d.baseX + Math.sin(t) * d.radiusX + Math.cos(t * 0.45) * 1.2;
          fPos[i * 3 + 1] = d.baseY + Math.sin(t * d.freqY) * 0.85 + Math.sin(elapsed * 2.2 + i * 0.3) * 0.4;
          fPos[i * 3 + 2] = d.baseZ + Math.cos(t) * d.radiusZ + Math.sin(t * 0.55) * 1.2;
        }
        firefliesMesh.geometry.attributes.position.needsUpdate = true;
        const nightPulse = Math.sin(elapsed * 3.2) * 0.18 + 0.82;
        flyMat.opacity = (isNightMode ? 0.95 : 0.75) * nightPulse;
      }

      /* --- 3. Floating items (winged letters + hearts) --- */
      floatingItems.forEach((item, idx) => {
        const ph = elapsed * item.speed * 0.5 + idx * 1.7;
        item.group.position.set(
          item.baseV.x + Math.cos(ph * 0.6) * 0.45,
          item.baseV.y + Math.sin(ph) * 0.28,
          item.baseV.z + Math.sin(ph * 0.5) * 0.5
        );
        item.group.rotation.y = Math.PI + Math.sin(elapsed * 1.1 + idx) * 0.4;
        if (item.type === 'wing') {
          const flap = Math.sin(elapsed * 9 + idx) * 0.5;
          item.wingR.rotation.z = flap;
          item.wingL.rotation.z = -flap;
        } else {
          item.group.scale.setScalar(item.scale * (1 + Math.pow(Math.max(0, Math.sin(elapsed * 4.2)), 6) * 0.14));
        }
      });

      /* --- 4. Gift animation --- */
      const giftAnim = giftAnimationRef.current;
      if (giftAnim.opened && giftAnim.openProgress < 1.0) {
        giftAnim.openProgress = Math.min(1.0, giftAnim.openProgress + dt * 0.9);
        const prog = giftAnim.openProgress;
        const easeProg = 1 - Math.pow(1 - prog, 3);

        if (giftAnim.lidMesh) {
          giftAnim.lidMesh.position.y = 2.25 + easeProg * 2.8;
          giftAnim.lidMesh.rotation.x = -easeProg * 1.1;
          giftAnim.lidMesh.rotation.z = easeProg * 0.35;
        }
        if (giftAnim.crystalHeart) {
          giftAnim.crystalHeart.visible = true;
          giftAnim.crystalHeart.position.y = 1.2 + easeProg * 3.4;
          giftAnim.crystalHeart.rotation.y = elapsed * 2.5;
          const beat = (1.0 + Math.sin(elapsed * 6) * 0.12) * easeProg;
          giftAnim.crystalHeart.scale.setScalar(beat);
        }
        if (giftAnim.heartHalo) {
          giftAnim.heartHalo.visible = true;
          giftAnim.heartHalo.position.y = 1.2 + easeProg * 3.4;
          giftAnim.heartHalo.scale.setScalar((3.2 + Math.sin(elapsed * 4) * 0.5) * easeProg);
        }
        if (giftAnim.welcomeSign) {
          giftAnim.welcomeSign.visible = true;
          giftAnim.welcomeSign.position.y = 1.2 + easeProg * 4.9;
          giftAnim.welcomeSign.scale.set(5.6 * easeProg, 1.4 * easeProg, 1);
        }
        // Balloons lerp
        giftAnim.balloons.forEach((bm) => {
          bm.mesh.visible = true;
          bm.mesh.scale.setScalar(Math.min(1.0, easeProg * 1.2));
          bm.mesh.position.lerpVectors(bm.initialPos, bm.targetOffset, easeProg);
        });
      } else if (giftAnim.opened) {
        if (giftAnim.crystalHeart) {
          giftAnim.crystalHeart.rotation.y = elapsed * 2.5;
          const beat = 1.0 + Math.sin(elapsed * 6) * 0.1;
          giftAnim.crystalHeart.scale.setScalar(beat);
        }
      }

      // [P4→P5] Butterflies wander
      updateButterfliesWander(dt, elapsed);

      /* --- 5. Sparkle trail --- */
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

      /* --- 6. Exhaust smoke --- */
      updateExhaust(dt, vanPos, yaw);

      /* --- 7. Sun follow controls.target --- */
      sun.position.copy(controls.target).addScaledVector(sunDir, 100);
      sun.target.position.copy(controls.target);

      /* --- 8. Camera transitions --- */
      const tr = transRef.current;
      if (tr && tr.active) {
        const k = Math.min(1, (now - tr.t0) / tr.dur);
        const ease = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;

        if (tr.isVanRelative) {
          if (tr.preset.rel) {
            camDestA.set(...tr.preset.cam).applyAxisAngle(Y_AXIS, yaw).add(vanPos);
            camDestB.set(...tr.preset.tgt).applyAxisAngle(Y_AXIS, yaw).add(vanPos);
          } else {
            camDestA.set(...tr.preset.cam);
            camDestB.set(...tr.preset.tgt);
          }
          camera.position.lerpVectors(tr.fromCam, camDestA, ease);
          controls.target.lerpVectors(tr.fromTgt, camDestB, ease);
        } else {
          camera.position.lerpVectors(tr.fromCam, tr.toCam, ease);
          if (tr.arcHeight) {
            camera.position.y += Math.sin(k * Math.PI) * tr.arcHeight;
          }
          controls.target.lerpVectors(tr.fromTgt, tr.toTgt, ease);
        }

        if (k >= 1) {
          tr.active = false;
          followVanRef.current = tr.isVanRelative && tr.preset.rel && activeStationRef.current === 3;
        }
      } else if (followVanRef.current && activeStationRef.current === 3) {
        const dyaw = normAngle(yaw - lastYaw);
        camTmpA.copy(camera.position).sub(lastVan).applyAxisAngle(Y_AXIS, dyaw);
        camTmpB.copy(controls.target).sub(lastVan).applyAxisAngle(Y_AXIS, dyaw);

        camera.position.copy(vanPos).add(camTmpA);
        controls.target.copy(vanPos).add(camTmpB);
      }
      lastVan.copy(vanPos);
      lastYaw = yaw;



      /* --- 10. Fireworks V2 --- */
      updateFireworksV2(dt);

      /* --- 11. Champagne bubbles --- */
      updateChampagneBubbles(dt);

      /* --- 12. Petals instanced --- */
      updatePetals(dt, elapsed);

      /* --- 13. Station 5 Royal Chest Wobble & Aura ("Đung đưa như sắp nổ") --- */
      const cAnim = worldAtmosphereRef.current.st5ChestAnim;
      if (cAnim && cAnim.group) {
        if (!cAnim.opened) {
          // Chu kỳ đung đưa hồi hộp: mỗi ~2.2s lại có một nhịp rung lắc nảy mạnh như sắp nổ
          const cycle = (elapsed * 0.45) % 1.0;
          let wobbleZ = 0;
          let wobbleX = 0;
          let hopY = 0;
          let scalePulse = 1.0 + Math.sin(elapsed * 4.0) * 0.03;

          if (cycle > 0.68) {
            // Nhịp rung lắc mạnh (excited burst shake)
            const shakeT = (cycle - 0.68) / 0.32;
            const shakeFreq = Math.sin(shakeT * Math.PI * 8);
            wobbleZ = shakeFreq * 0.12;
            wobbleX = Math.cos(shakeT * Math.PI * 6) * 0.08;
            hopY = Math.abs(Math.sin(shakeT * Math.PI * 4)) * 0.22;
            scalePulse = 1.0 + Math.abs(shakeFreq) * 0.14;
          }

          cAnim.group.rotation.z = wobbleZ;
          cAnim.group.rotation.x = wobbleX;
          cAnim.group.position.y = 3.74 + hopY;
          cAnim.group.scale.set(scalePulse, scalePulse * (1 + (hopY > 0.05 ? 0.08 : 0)), scalePulse);

          // Hào quang aura tỏa sáng nhấp nháy
          if (cAnim.aura1 && cAnim.aura2) {
            const p1 = Math.sin(elapsed * 6.5);
            const p2 = Math.cos(elapsed * 5.2);
            cAnim.aura1.scale.setScalar(5.4 + p1 * 1.5 + (hopY > 0.05 ? 2.2 : 0));
            cAnim.aura1.material.opacity = 0.75 + p1 * 0.25;
            cAnim.aura2.scale.setScalar(4.2 + p2 * 1.2 + (hopY > 0.05 ? 1.8 : 0));
            cAnim.aura2.material.opacity = 0.85 + p2 * 0.15;
          }
          if (cAnim.auraRays) {
            cAnim.auraRays.rotation.z = elapsed * 0.8;
            cAnim.auraRays.scale.setScalar(7.2 + Math.sin(elapsed * 4.0) * 1.2);
          }
          if (cAnim.light) {
            cAnim.light.intensity = 2.4 + Math.sin(elapsed * 5.0) * 1.0 + (hopY > 0.05 ? 2.5 : 0);
          }
          if (cAnim.sign) {
            cAnim.sign.position.y = 2.35 + Math.sin(elapsed * 3.2) * 0.18;
          }
        } else {
          // KHI ĐÃ MỞ: Nắp hòm mở dần ra phía sau
          if (cAnim.openProgress < 1.0) {
            cAnim.openProgress = Math.min(1.0, cAnim.openProgress + dt * 1.8);
            const ease = 1 - Math.pow(1 - cAnim.openProgress, 3);
            if (cAnim.lid) {
              cAnim.lid.rotation.x = -ease * (Math.PI * 0.65);
            }
          }
          cAnim.group.rotation.set(0, 0, 0);
          cAnim.group.position.y = 3.74;
          cAnim.group.scale.set(1, 1, 1);
          if (cAnim.sign) {
            cAnim.sign.visible = false;
          }
          if (cAnim.light) {
            cAnim.light.intensity = 4.2;
          }
        }
      }

      if (cakeAura) {
        const cp = Math.sin(elapsed * 5.8);
        cakeAura.scale.setScalar(4.2 + cp * 0.9);
        cakeAura.material.opacity = 0.75 + cp * 0.25;
      }

      /* --- 14. Controls + sky --- */
      controls.autoRotate = autoRotateRef.current;
      controls.autoRotateSpeed = 1.2;
      controls.update();

      // [Camera Shake từ pháo nổ chân thực]
      if (shakeRef && shakeRef.intensity > 0.001) {
        shakeRef.intensity *= Math.exp(-shakeRef.decay * dt);
        shakeOffset.set(
          (Math.random() - 0.5) * shakeRef.intensity * 0.45,
          (Math.random() - 0.5) * shakeRef.intensity * 0.45,
          (Math.random() - 0.5) * shakeRef.intensity * 0.45
        );
        camera.position.add(shakeOffset);
      }

      sky.position.copy(camera.position);

      renderer.info.reset();
      composer.render();
      animId = requestAnimationFrame(renderLoop);
    }
    renderLoop();

    /* ================================================================== */
    /*  [P5] RESIZE + CLEANUP                                              */
    /* ================================================================== */
    const handleResize = () => {
      const nw = container.clientWidth || window.innerWidth;
      const nh = container.clientHeight || window.innerHeight;
      if (nw > 0 && nh > 0) {
        camera.aspect = nw / nh;
        camera.updateProjectionMatrix();
        renderer.setSize(nw, nh);
        composer.setSize(nw, nh);
        bloom.setSize(nw, nh);
        if (smaaPass) smaaPass.setSize(nw * pr, nh * pr);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      fwTimers.forEach((t) => clearTimeout(t));
      if (vegTimer) clearTimeout(vegTimer);
      window.removeEventListener('pointerdown', resumeAudio);
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', handleResize);
      controls.dispose();
      renderer.dispose();
      if (envRT && envRT.dispose) envRT.dispose();
      if (composer && composer.dispose) composer.dispose();
      if (rt) rt.dispose();
      if (container && renderer.domElement) {
        try { container.removeChild(renderer.domElement); } catch (e) {}
      }
      if (ambientAudioRef.current) {
        try {
          ambientAudioRef.current.whiteNoise.stop();
          ambientAudioRef.current.ctx.close();
        } catch (e) {}
        ambientAudioRef.current = null;
      }
    };
  }, []);

  /* ================================================================== */
  /*  [P5] JSX RETURN — HUD + 4 MODALS (giữ nguyên)                      */
  /* ================================================================== */
  return (
    <div className="page-garden-3d" id="world-3d-sanctuary">
      <div ref={containerRef} className="garden-3d-viewport" />

      {/* [P1] BỨC MÀN CINEMATIC VEIL LOADER — Che đậy lúc chuyển cảnh từ / sang /#/3d, không bị đơ/đen template */}
      <div className={`cinematic-veil-overlay ${isVeilOpen ? 'veil-fade-out' : ''}`} aria-hidden={isVeilOpen}>
        <div className="cinematic-veil-spinner-wrap">
          <div className="cinematic-veil-ring" />
          <div className="cinematic-veil-icon">🌸</div>
        </div>
        <h2 className="cinematic-veil-title">
          Vương Quốc Hoa 3D • 20/10<br />
          Dành Riêng Cho <strong>{sisterName || 'Chị Em'}</strong> ✨
        </h2>
        <p className="cinematic-veil-sub">
          Đang chuẩn bị không gian ngập tràn hoa và ánh sáng kỳ diệu...
        </p>
      </div>

      {/* [P1] BANNER CHẾ ĐỘ AUTO-TOUR ĐANG CHẠY */}
      {isAutoTourActive && (
        <div className="autotour-active-banner">
          <span>🎬 Đang chiếu Chuyến Du Ngoạn Tự Động 3D (Hands-free Tour)</span>
          <button
            className="btn-autotour-stop"
            onClick={() => setIsAutoTourActive(false)}
            title="Dừng chế độ tự động và quay lại khám phá tự do"
          >
            ⏹️ Dừng Tour
          </button>
        </div>
      )}

      <div className="garden-game-hud">
        {!isSceneReady && (
          <div className="hud-loading-skeleton" aria-live="polite">
            <div className="hud-skeleton-pill hud-skeleton-shimmer">
              <span className="hud-skeleton-icon">🌸</span>
              <span className="hud-skeleton-text">Đang mở cánh cổng Vương Quốc Hoa 3D...</span>
            </div>
            <div className="hud-skeleton-aside hud-skeleton-shimmer" />
            <div className="hud-skeleton-bottom hud-skeleton-shimmer" />
          </div>
        )}

        {isHudHidden && (
          <button
            className="btn-hud-reopen-floating"
            onClick={() => setIsHudHidden(false)}
            title="Mở lại thanh điều khiển và danh sách các trạm"
          >
            <span>👁️ Hiện HUD</span>
          </button>
        )}

        {!isHudHidden && (
          <>
            {/* Thanh tiêu đề tối giản và gọn gàng trên cùng */}
            <div className="hud-top-minimal-pill">
              <span className="pill-badge" style={{ background: sisterTheme.primary }}>
                🌸 20.10 WORLD 3D
              </span>
              <span className="pill-text">
                Vương Quốc Tri Ân • {sisterTheme.flower} • Dành Riêng Cho <strong>{sisterName}</strong> ✨
                {typeof activeStationIndex === 'number' && STATIONS[activeStationIndex] && (
                  <span style={{ color: '#FDE68A', marginLeft: '6px' }}>
                    [{STATIONS[activeStationIndex].chapter}: {STATIONS[activeStationIndex].chapterTitle}]
                  </span>
                )}
              </span>

              {/* [P1] Achievement Tracker Badge (Khám phá X/6 trạm) */}
              <div
                className={`hud-achievement-pill ${visitedStations.size === 6 ? 'unlocked' : ''}`}
                onClick={() => {
                  if (visitedStations.size === 6) {
                    showToast('👑 Bạn đã là NỮ THẦN VƯƠNG QUỐC 20/10! Toàn bộ 6 trạm đã được thắp sáng rực rỡ.');
                  } else {
                    showToast(`🏆 Tiến trình: Bạn đã khám phá ${visitedStations.size}/6 trạm. Tiếp tục du ngoạn để mở khóa danh hiệu Hoàng Gia!`);
                  }
                }}
                title="Huy hiệu tiến trình khám phá các trạm"
              >
                <span>{visitedStations.size === 6 ? '👑' : '🏆'}</span>
                <span>{visitedStations.size === 6 ? 'Nữ Thần 20/10' : `${visitedStations.size}/6 Trạm`}</span>
              </div>
            </div>

            {/* Thẻ hướng dẫn điều khiển chuột & cuộn đặt ngay dưới thanh Vương Quốc Tri Ân */}
            <div className="hud-center-guide-pill" aria-hidden="true">
              <span className="guide-icon">🖱️</span>
              <span>Giữ &amp; kéo chuột xoay 360°</span>
              <span className="guide-sep">•</span>
              <span className="guide-icon">🔍</span>
              <span>Cuộn chuột thu / phóng</span>
              <span className="guide-sep">•</span>
              <span className="guide-icon">✨</span>
              <span>Chạm trạm &amp; hòm quà</span>
            </div>

            {/* THANH ASIDE DỌC THỜI THƯỢNG (HIỂN THỊ LABEL TRONG SUỐT CHO TẤT CẢ, ACTIVE NỔI BẬT ĐẬM HƠN) */}
            <aside className="hud-aside-dock">
              <div
                className="hud-dock-brand"
                onClick={triggerEasterEgg}
                style={{ cursor: 'pointer' }}
                title={`20.10 World 3D • Dành tặng ${sisterName} (Chạm 3 lần để mở quà bí mật 🌸)`}
              >
                <span className="hud-dock-logo">🌸</span>
                <span className="hud-dock-brand-text">20.10 WORLD</span>
              </div>

              <div className="hud-dock-divider" />

              <nav className="hud-dock-stations" aria-label="Danh sách các trạm">
                {STATIONS.map((st, idx) => {
                  const isActive = activeStationIndex === idx;
                  return (
                    <button
                      key={st.id}
                      className={`hud-dock-station-btn ${isActive ? 'active' : ''}`}
                      onClick={() => flyToStation(idx)}
                      aria-current={isActive ? 'step' : undefined}
                      title={`${st.chapter}: ${st.name} — ${st.subtitle}`}
                    >
                      <span className="station-icon">{st.icon}</span>
                      <span className="station-label">{st.name}</span>
                      {isActive && <span className="active-glow-pip" />}
                    </button>
                  );
                })}
              </nav>

              <div className="hud-dock-divider" />

              <div className="hud-dock-tools">
                <button
                  className={`hud-dock-tool-btn ${isNightMode ? 'active-night' : ''}`}
                  onClick={toggleNightMode}
                  title="Chuyển đổi Bầu Trời: Dạ Tiệc Đêm / Hoàng Hôn"
                >
                  <span className="tool-icon">{isNightMode ? '🌙' : '🌅'}</span>
                  <span className="tool-label">{isNightMode ? 'Dạ Tiệc Đêm' : 'Hoàng Hôn'}</span>
                </button>

                <button
                  className={`hud-dock-tool-btn ${isAutoTourActive ? 'active-tour' : ''}`}
                  onClick={() => {
                    setIsAutoTourActive(!isAutoTourActive);
                    showToast(
                      !isAutoTourActive
                        ? '🎬 Bắt đầu Chuyến Du Ngoạn Tự Động (Hands-free Tour)! Thư thái chiêm ngưỡng từng trạm.'
                        : '⏹️ Đã dừng tour tự động.'
                    );
                  }}
                  title="Tự động dẫn bạn du ngoạn qua tất cả các trạm rảnh tay"
                >
                  <span className="tool-icon">{isAutoTourActive ? '⏹️' : '🎬'}</span>
                  <span className="tool-label">{isAutoTourActive ? 'Dừng Tour' : 'Auto Tour'}</span>
                </button>

                <button
                  className="hud-dock-tool-btn"
                  onClick={triggerPhotoMode}
                  title="Chụp ảnh: Ẩn tạm thời toàn bộ giao diện trong 5 giây"
                >
                  <span className="tool-icon">📸</span>
                  <span className="tool-label">Chụp Ảnh</span>
                </button>

                <button
                  className={`hud-dock-tool-btn ${activeStationIndex === 'scenic' ? 'active-scenic' : ''}`}
                  onClick={flyToWorldScenic}
                  title="Góc nhìn toàn cảnh thế giới từ trên cao"
                >
                  <span className="tool-icon">🌄</span>
                  <span className="tool-label">Toàn Cảnh</span>
                  {activeStationIndex === 'scenic' && <span className="active-glow-pip" />}
                </button>

                <button
                  className="hud-dock-tool-btn"
                  onClick={() => {
                    setIsHudHidden(true);
                    showToast('👁️ Đã ẩn thanh điều khiển. Bấm nút mắt ở góc để mở lại.');
                  }}
                  title="Ẩn thanh điều khiển để chiêm ngưỡng toàn cảnh 3D"
                >
                  <span className="tool-icon">👁️</span>
                  <span className="tool-label">Ẩn HUD</span>
                </button>

                <button
                  className="hud-dock-tool-btn btn-2d-mode"
                  onClick={() => updateExperienceMode('2d')}
                  title="Chuyển sang bản Tạp chí 2D Cổ Tích"
                >
                  <span className="tool-icon">🌸</span>
                  <span className="tool-label">Bản 2D</span>
                </button>
              </div>
            </aside>
          </>
        )}

        {/* NÚT CON NHỘNG HẠ GÓC NHÌN / NGƯỚC XEM PHÁO HOA TẠI TRẠM 5 (LÂU ĐÀI) */}
        {activeStationIndex === 5 && (
          <button
            className="btn-camera-sky-toggle"
            onClick={toggleCastleView}
            title={isLookingAtSky ? 'Hạ góc nhìn xuống bàn tiệc hoàng gia & hòm quà' : 'Ngước lên chiêm ngưỡng bầu trời pháo hoa'}
          >
            <span>{isLookingAtSky ? '⬇️ Hạ Xuống Bàn Tiệc' : '⬆️ Ngước Xem Pháo Hoa'}</span>
          </button>
        )}

        {/* BÀN PHÍM ẢO TRONG SUỐT ĐIỀU KHIỂN QUAN SÁT (VIRTUAL D-PAD) */}
        <div className={`hud-nav-pad-cluster ${isNavPadOpen || activeStationIndex === 'scenic' ? 'open' : 'minimized'}`}>
          <button
            className="btn-nav-pad-toggle"
            onClick={() => setIsNavPadOpen(!isNavPadOpen)}
            title="Bật/Tắt bàn phím ảo điều khiển góc nhìn tự do"
          >
            <span>🎮</span>
            <span className="nav-toggle-text">{isNavPadOpen || activeStationIndex === 'scenic' ? 'Thu Gọn' : 'Quan Sát'}</span>
          </button>

          {(isNavPadOpen || activeStationIndex === 'scenic') && (
            <div className="nav-pad-controls">
              <div className="nav-pad-header">
                <span className="nav-pad-title">🕹️ Quan Sát 3D</span>
                <button
                  className="btn-nav-reset"
                  onClick={resetCurrentStationView}
                  title="Đặt lại góc nhìn mặc định của trạm"
                >
                  🔄 Reset
                </button>
              </div>

              <div className="nav-pad-grid">
                <div />
                <button
                  className="nav-btn nav-btn-up"
                  onPointerDown={(e) => startNavMovement('forward', e)}
                  onPointerUp={stopNavMovement}
                  onPointerLeave={stopNavMovement}
                  title="Tiến lên phía trước"
                >
                  ⬆️
                </button>
                <button
                  className="nav-btn nav-btn-elevate-up"
                  onPointerDown={(e) => startNavMovement('up', e)}
                  onPointerUp={stopNavMovement}
                  onPointerLeave={stopNavMovement}
                  title="Bay lên cao"
                >
                  🔼
                </button>

                <button
                  className="nav-btn nav-btn-left"
                  onPointerDown={(e) => startNavMovement('left', e)}
                  onPointerUp={stopNavMovement}
                  onPointerLeave={stopNavMovement}
                  title="Sang trái"
                >
                  ⬅️
                </button>
                <button
                  className="nav-btn nav-btn-down"
                  onPointerDown={(e) => startNavMovement('backward', e)}
                  onPointerUp={stopNavMovement}
                  onPointerLeave={stopNavMovement}
                  title="Lùi lại phía sau"
                >
                  ⬇️
                </button>
                <button
                  className="nav-btn nav-btn-right"
                  onPointerDown={(e) => startNavMovement('right', e)}
                  onPointerUp={stopNavMovement}
                  onPointerLeave={stopNavMovement}
                  title="Sang phải"
                >
                  ➡️
                </button>

                <div />
                <button
                  className="nav-btn nav-btn-elevate-down"
                  onPointerDown={(e) => startNavMovement('down', e)}
                  onPointerUp={stopNavMovement}
                  onPointerLeave={stopNavMovement}
                  title="Hạ thấp độ cao"
                >
                  🔽
                </button>
                <div />
              </div>
            </div>
          )}
        </div>

        {/* THANH ĐÁY ĐIỀU HƯỚNG TRẠM VÀ HÒM THƯ (CĂN GIỮA MÀN HÌNH) */}
        {!isHudHidden && (
          <div className="hud-bottom-master-dock">
            {/* 1. HUD ĐIỀU KHIỂN XE & GÓC NHÌN (CHỈ HIỆN KHI Ở TRẠM 3) */}
            {activeStationIndex === 3 && (
              <div className="hud-van-angles-dock">
                <div className="hud-vehicle-selector">
                  <button
                    type="button"
                    className={`btn-vehicle-select ${selectedVehicle === 'van' ? 'active' : ''}`}
                    onClick={() => switchVehicle('van')}
                    title="Chuyến Xe Hoa Retro 20/10"
                  >
                    <span>🚐</span>
                    <span>Xe Hoa</span>
                  </button>
                  <button
                    type="button"
                    className={`btn-vehicle-select ${selectedVehicle === 'carriage' ? 'active' : ''}`}
                    onClick={() => switchVehicle('carriage')}
                    title="Cỗ Xe Bạch Mã Hoàng Gia Cổ Tích Dát Vàng"
                  >
                    <span>🐎</span>
                    <span>Xe Ngựa</span>
                  </button>
                </div>
                <div className="hud-van-angles-divider" />
                <span className="van-angle-title">Góc nhìn:</span>
                {selectedVehicle === 'carriage' ? (
                  <>
                    <button className={`btn-van-angle ${activeVanCamPreset === 'tq' ? 'active' : ''}`} onClick={() => setVanCameraPreset('tq')}>✨ Góc 3/4</button>
                    <button className={`btn-van-angle ${activeVanCamPreset === 'side' ? 'active' : ''}`} onClick={() => setVanCameraPreset('side')}>🌼 Bên hông</button>
                    <button className={`btn-van-angle ${activeVanCamPreset === 'carr' ? 'active' : ''}`} onClick={() => setVanCameraPreset('carr')}>👑 Cận xe</button>
                    <button className={`btn-van-angle ${activeVanCamPreset === 'back' ? 'active' : ''}`} onClick={() => setVanCameraPreset('back')}>💐 Phía sau</button>
                    <button className={`btn-van-angle ${activeVanCamPreset === 'close' ? 'active' : ''}`} onClick={() => setVanCameraPreset('close')}>🐎 Cận ngựa</button>
                  </>
                ) : (
                  <>
                    <button className={`btn-van-angle ${activeVanCamPreset === 'chase' ? 'active' : ''}`} onClick={() => setVanCameraPreset('chase')}>Theo Xe</button>
                    <button className={`btn-van-angle ${activeVanCamPreset === 'close' ? 'active' : ''}`} onClick={() => setVanCameraPreset('close')}>Cận Cảnh</button>
                    <button className={`btn-van-angle ${activeVanCamPreset === 'side' ? 'active' : ''}`} onClick={() => setVanCameraPreset('side')}>Bên Hông</button>
                    <button className={`btn-van-angle ${activeVanCamPreset === 'top' ? 'active' : ''}`} onClick={() => setVanCameraPreset('top')}>Trên Cao</button>
                  </>
                )}
              </div>
            )}

            {/* 2. THANH HÒM THƯ BƯU ĐIỆN (CHỈ HIỆN KHI Ở CHẶNG THEO XE - TRẠM 3) */}
            {activeStationIndex === 3 && (
              <button className="btn-hud-mailbox" onClick={() => { playLetterOpenSound(); setIsMailboxOpen(true); }}>
                <span>🕊️ Hòm Thư Bưu Điện</span>
                <span className="mailbox-badge">{messages.length} Món Quà</span>
              </button>
            )}

            {/* 2b. THANH CHỌN 5 VIDEO TRI ÂN (CHỈ HIỆN KHI Ở TRẠM 4 - RẠP CHIẾU) */}
            {activeStationIndex === 4 && (
              <div className="hud-van-angles-dock" style={{ flexWrap: 'wrap', justifyContent: 'center', gap: '8px', maxWidth: '780px' }}>
                <span className="van-angle-title" style={{ color: '#FDA4AF', fontWeight: '700' }}>🎬 Chọn Video Tri Ân:</span>
                {videoPlaylist.map((v, idx) => {
                  const isCur = idx === selected3DVideoIndex;
                  return (
                    <button
                      key={v.id}
                      className={`btn-van-angle ${isCur ? 'active' : ''}`}
                      onClick={() => {
                        setSelected3DVideoIndex(idx);
                        if (video3DPlayerRef.current) {
                          video3DPlayerRef.current.src = v.src;
                          video3DPlayerRef.current.load();
                          video3DPlayerRef.current.play().catch(() => {});
                        }
                        setActiveVideoModal(true);
                      }}
                      title={v.title}
                      style={{
                        background: isCur ? 'linear-gradient(135deg, #BE123C, #8C2F4B)' : 'rgba(255,255,255,0.08)',
                        color: isCur ? '#FFF' : '#E2E8F0',
                        border: isCur ? '1.5px solid var(--champagne-gold)' : '1px solid rgba(201,166,107,0.3)',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <span>{v.icon}</span>
                      <span>{v.tag}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 3. NÚT CHUYỂN CHẶNG THEO KỊCH BẢN (LUÔN CĂN GIỮA DƯỚI CÙNG) */}
            <div className="hud-bottom-action-row">
              {activeStationIndex === 4 && (
                <button
                  onClick={() => setActiveVideoModal(true)}
                  className="btn-rose pulse-guide-attention"
                  style={{
                    background: 'linear-gradient(135deg, #BE123C, #8C2F4B)',
                    color: '#FFF',
                    fontWeight: '800',
                    border: '1.5px solid var(--champagne-gold)',
                    boxShadow: '0 0 22px rgba(190, 18, 60, 0.7)',
                    padding: '12px 28px',
                    fontSize: '0.96rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <span>🎬 Mở Rạp Chiếu 5 Video Tri Ân</span>
                  <span style={{ background: '#FDA4AF', color: '#881337', borderRadius: '9999px', fontSize: '0.72rem', padding: '2px 8px', fontWeight: '800' }}>5 Clips</span>
                </button>
              )}
              {activeStationIndex === 5 && (
                <button
                  onClick={() => setActivePartyCardModal(true)}
                  className="btn-rose"
                  style={{
                    background: 'linear-gradient(135deg, #D4AF37, #B48A27)',
                    color: '#1E0F18',
                    fontWeight: '800',
                    border: '1.5px solid #FFF',
                    boxShadow: '0 0 18px rgba(253, 230, 138, 0.6)'
                  }}
                >
                  📜 Xem & Tải Thiệp 2X Retina
                </button>
              )}

              <button
                onClick={() => {
                  const nextIndex = typeof activeStationIndex === 'number'
                    ? (activeStationIndex + 1) % STATIONS.length
                    : 0;
                  flyToStation(nextIndex);
                }}
                className={`btn-rose ${shouldPulseNext ? 'pulse-guide-attention' : ''}`}
                style={{ fontSize: '0.94rem', padding: '12px 28px' }}
              >
                {shouldPulseNext && (
                  <span className="pulse-guide-tag">✨ Tiếp tục!</span>
                )}
                <span>
                  {typeof activeStationIndex === 'number' && STATIONS[(activeStationIndex + 1) % STATIONS.length]
                    ? `Trạm Tiếp Theo: ${STATIONS[(activeStationIndex + 1) % STATIONS.length].name} ➔`
                    : 'Khám Phá Các Trạm: Hộp Quà ➔'}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {isMailboxOpen && !readingMessage && (
        <div className="parcel-chest-overlay" onClick={() => setIsMailboxOpen(false)}>
          <div className="parcel-chest-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-wax-seal-badge">20.10</div>
            <div className="parcel-chest-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '2.4rem' }}>🚚</span>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', color: 'var(--rose-900)', margin: 0, fontWeight: '700' }}>
                    Kho Bưu Kiện Chuyến Xe Hoa 20/10
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: 'var(--rose-600)' }}>
                    Chuyến xe bưu điện đã dừng trạm • Dành riêng gửi tặng <strong>{sisterName}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsMailboxOpen(false)}
                className="royal-btn-close"
                style={{ position: 'static' }}
                title="Đóng hòm thư"
              >
                ✕
              </button>
            </div>

            <div className="parcel-chest-body">
              {messages.map((msg, idx) => {
                const isHeart = msg.type === 'heart';
                return (
                  <div
                    key={msg.id || idx}
                    onClick={() => {
                      playLetterOpenSound();
                      setReadingMessage(msg);
                    }}
                    className="winged-card"
                  >
                    <svg className="mini-wing left" viewBox="0 0 100 100" width="34" height="34" fill="#fda4af">
                      <path d="M90,70 C70,20 20,20 10,60 C20,50 40,60 50,70 C30,70 20,80 15,90 C35,85 60,85 90,70 Z" />
                    </svg>
                    <svg className="mini-wing right" viewBox="0 0 100 100" width="34" height="34" fill="#fda4af">
                      <path d="M90,70 C70,20 20,20 10,60 C20,50 40,60 50,70 C30,70 20,80 15,90 C35,85 60,85 90,70 Z" />
                    </svg>

                    <div className="winged-card-content">
                      <div className={`card-icon-slot ${isHeart ? 'purple-grad' : 'rose-grad'}`}>
                        <span className="heart-card-icon">{isHeart ? '💖' : '🕊️'}</span>
                      </div>
                      <span className="winged-card-badge">
                        {msg.badge || (isHeart ? '💖 Trái Tim Tri Ân' : '🕊️ Cánh Thư May Mắn')}
                      </span>
                      <h4 className="winged-card-title">{msg.title || 'Món Quà Tinh Thần'}</h4>
                      <span className="winged-card-sender">Từ: {msg.from_name || 'Đồng nghiệp'}</span>
                      <p className="winged-card-snippet">“{msg.text}”</p>
                      <div className="winged-card-action">
                        <span>Chạm để đọc thư</span>
                        <span className="action-arrow">→</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="parcel-chest-footer">
              <span style={{ fontSize: '0.85rem', color: 'var(--rose-700)' }}>
                💡 Chọn từng phong thư để mở con dấu sáp và đọc trọn vẹn lời chúc
              </span>
              <button onClick={() => setIsMailboxOpen(false)} className="btn-rose" style={{ padding: '8px 22px' }}>
                <span>🌿 Quay lại ngắm Vương Quốc Hoa 3D</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {readingMessage && (
        <div className="modal-overlay open" onClick={() => setReadingMessage(null)}>
          <div className="royal-parchment-box" onClick={(e) => e.stopPropagation()}>
            <div className="parchment-wax-seal">20.10</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <span style={{ fontSize: '2.5rem' }}>{readingMessage.type === 'heart' ? '💖' : '🕊️'}</span>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--rose-600)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '700' }}>
                  {readingMessage.badge || 'Lời Nhắn Gửi Chân Tình'}
                </span>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', color: 'var(--rose-900)', fontWeight: '700', margin: 0 }}>
                  Thư Gửi Riêng {sisterName}
                </h3>
              </div>
            </div>

            <div style={{ background: 'rgba(244, 63, 94, 0.06)', borderLeft: '4px solid var(--rose-500)', borderRadius: '16px', padding: '22px 24px', margin: '20px 0' }}>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '1.05rem', lineHeight: '1.85', color: '#1E293B', fontStyle: 'italic', margin: 0 }}>
                “{readingMessage.text}”
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748B', display: 'block' }}>Người gửi:</span>
                <strong style={{ fontFamily: 'var(--font-serif)', fontSize: '1.1rem', color: 'var(--rose-900)' }}>
                  {readingMessage.from_name || 'Một người đồng nghiệp giấu tên'}
                </strong>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    setReadingMessage(null);
                    setIsMailboxOpen(true);
                  }}
                  className="btn-rose"
                  style={{ padding: '10px 18px', fontSize: '0.88rem', background: '#FFF', color: 'var(--rose-700)', border: '1.5px solid var(--rose-300)' }}
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

      {activeVideoModal && (
        <div className="modal-overlay open" onClick={() => setActiveVideoModal(false)}>
          <div
            className="cinema-stage-box"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '880px',
              width: '100%',
              maxHeight: '92vh',
              overflowY: 'auto',
              padding: '24px 22px 28px',
              position: 'relative'
            }}
          >
            <div className="modal-wax-seal-badge">20.10</div>

            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', borderBottom: '1px solid rgba(201,166,107,0.25)', paddingBottom: '12px' }}>
              <div>
                <span style={{ fontSize: '0.78rem', color: '#FDA4AF', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.12em', fontFamily: 'var(--font-mono)' }}>
                  TRẠM 4 • RẠP CHIẾU PHIM TRI ÂN 3D
                </span>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', color: 'var(--champagne-light)', margin: '4px 0 0', fontStyle: 'italic' }}>
                  🎬 Thước Phim Tri Ân ({videoPlaylist.length} Video Clip)
                </h3>
              </div>
              <button onClick={() => setActiveVideoModal(false)} className="royal-btn-close" style={{ position: 'static' }}>
                ✕
              </button>
            </div>

            {/* Quick Option Pills */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '14px' }}>
              {videoPlaylist.map((v, idx) => {
                const isSelected = idx === selected3DVideoIndex;
                return (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelected3DVideoIndex(idx);
                      if (video3DPlayerRef.current) {
                        video3DPlayerRef.current.src = v.src;
                        video3DPlayerRef.current.load();
                        video3DPlayerRef.current.play().catch(() => {});
                      }
                    }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '9999px',
                      fontSize: '0.84rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.25s',
                      background: isSelected ? 'linear-gradient(135deg, #BE123C, #8C2F4B)' : 'rgba(255,255,255,0.08)',
                      color: isSelected ? '#FFF' : '#E2E8F0',
                      border: isSelected ? '1.5px solid var(--champagne-gold)' : '1px solid rgba(201,166,107,0.3)',
                      boxShadow: isSelected ? '0 4px 14px rgba(190, 18, 60, 0.45)' : 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>{v.icon}</span>
                    <span>{v.tag}</span>
                  </button>
                );
              })}
            </div>

            {/* Cinema Screen Viewport */}
            <div className="cinema-screen-viewport" style={{ aspectRatio: '16/9', width: '100%', borderRadius: '18px', overflow: 'hidden', background: '#000', border: '1.5px solid var(--champagne-gold)', boxShadow: '0 12px 35px rgba(0,0,0,0.6)' }}>
              <video
                ref={video3DPlayerRef}
                key={videoPlaylist[selected3DVideoIndex].src + selected3DVideoIndex}
                src={videoPlaylist[selected3DVideoIndex].src}
                poster={videoPlaylist[selected3DVideoIndex].poster}
                controls
                autoPlay
                playsInline
                preload="metadata"
                onEnded={() => {
                  if (is3DVideoAutoNext) {
                    const nextIdx = (selected3DVideoIndex + 1) % videoPlaylist.length;
                    setSelected3DVideoIndex(nextIdx);
                    if (video3DPlayerRef.current) {
                      video3DPlayerRef.current.src = videoPlaylist[nextIdx].src;
                      video3DPlayerRef.current.load();
                      video3DPlayerRef.current.play().catch(() => {});
                    }
                  }
                }}
                style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
              />
            </div>

            {/* Video Info & Auto-Next Bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(0,0,0,0.35)', borderRadius: '12px', marginTop: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '1.05rem', color: 'var(--champagne-light)', fontWeight: '700' }}>
                  {videoPlaylist[selected3DVideoIndex].icon} {videoPlaylist[selected3DVideoIndex].title}
                </div>
                <div style={{ fontSize: '0.82rem', color: '#CBD5E1', marginTop: '2px' }}>
                  {videoPlaylist[selected3DVideoIndex].desc}
                </div>
              </div>
              <button
                onClick={() => setIs3DVideoAutoNext(!is3DVideoAutoNext)}
                style={{
                  background: is3DVideoAutoNext ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.08)',
                  border: '1px solid ' + (is3DVideoAutoNext ? '#10B981' : 'rgba(255,255,255,0.2)'),
                  color: is3DVideoAutoNext ? '#A7F3D0' : '#CBD5E1',
                  borderRadius: '9999px',
                  padding: '5px 12px',
                  fontSize: '0.78rem',
                  cursor: 'pointer'
                }}
              >
                {is3DVideoAutoNext ? '✓ Tự chuyển tiếp' : 'Dừng khi hết clip'}
              </button>
            </div>

            {/* Playlist Cards Grid */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ fontSize: '0.78rem', color: 'var(--rose-400)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px', fontFamily: 'var(--font-mono)' }}>
                DANH SÁCH 5 OPTION VIDEO TRI ÂN
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
                {videoPlaylist.map((v, idx) => {
                  const isCur = idx === selected3DVideoIndex;
                  return (
                    <div
                      key={v.id}
                      onClick={() => {
                        setSelected3DVideoIndex(idx);
                        if (video3DPlayerRef.current) {
                          video3DPlayerRef.current.src = v.src;
                          video3DPlayerRef.current.load();
                          video3DPlayerRef.current.play().catch(() => {});
                        }
                      }}
                      style={{
                        background: isCur ? 'rgba(190, 18, 60, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                        border: isCur ? '1.5px solid var(--rose-500)' : '1px solid rgba(201,166,107,0.2)',
                        borderRadius: '14px',
                        padding: '8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.2s'
                      }}
                    >
                      <div style={{ width: '100%', aspectRatio: '16/9', borderRadius: '8px', overflow: 'hidden', background: '#000', position: 'relative', marginBottom: '6px' }}>
                        <img src={v.poster} alt={v.tag} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                        {isCur && (
                          <div style={{ position: 'absolute', top: '4px', left: '4px', background: 'var(--rose-600)', color: '#FFF', fontSize: '0.62rem', fontWeight: '800', padding: '2px 6px', borderRadius: '9999px' }}>
                            ▶ Đang phát
                          </div>
                        )}
                        <div style={{ position: 'absolute', bottom: '4px', right: '4px', background: 'rgba(0,0,0,0.7)', color: '#FFF', fontSize: '0.62rem', padding: '1px 5px', borderRadius: '4px', fontFamily: 'var(--font-mono)' }}>
                          {v.duration}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.86rem', fontWeight: '700', color: isCur ? 'var(--champagne-light)' : '#E2E8F0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {v.icon} {v.tag}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: '#94A3B8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {v.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {activePartyCardModal && (
        <div className="modal-overlay open" onClick={() => setActivePartyCardModal(false)}>
          <div className="party-honor-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px', width: '100%', maxHeight: '92vh', overflowY: 'auto', padding: '28px 20px', position: 'relative' }}>
            <div className="modal-wax-seal-badge">20.10</div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingBottom: '10px', borderBottom: '1px solid rgba(201,166,107,0.3)' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#BE123C', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
                  GRAND FINALE • TRẠM LÂU ĐÀI 3D
                </span>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', color: 'var(--rose-900)', margin: '4px 0 0', fontWeight: '700' }}>
                  Studio Khắc Thiệp Tri Ân 20/10
                </h3>
              </div>
              <button onClick={() => setActivePartyCardModal(false)} className="royal-btn-close" style={{ position: 'static' }}>
                ✕
              </button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: '0.94rem', color: '#881337', fontStyle: 'italic', textAlign: 'center' }}>
              🎁 Những đóa hoa tươi thắm và món quà kỷ niệm đang chờ đón bạn ngoài đời thực!
            </p>

            <CardStudio
              defaultName={selectedSister ? `Chị ${selectedSister.name}` : 'Chị Em Thân Thương'}
              defaultSender="Toàn thể anh em công ty kính chúc 💐"
            />

            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <button
                onClick={() => setActivePartyCardModal(false)}
                className="btn-rose"
                style={{ padding: '10px 24px', background: '#FFF', color: 'var(--rose-800)', border: '1.5px solid var(--rose-300)' }}
              >
                <span>🌿 Đóng &amp; Tiếp Tục Thưởng Thức Thế Giới 3D</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast thông báo cao cấp với Progress Bar & Pause on Hover */}
      {toastMessage && (
        <div className="hud-toast-container" role="status" aria-live="polite">
          <div
            className="hud-toast"
            onMouseEnter={handleToastMouseEnter}
            onMouseLeave={handleToastMouseLeave}
            onClick={() => setToastMessage('')}
            title="Nhấp để đóng thông báo"
          >
            <span className="hud-toast-text">{toastMessage}</span>
            <div
              className="hud-toast-progress"
              style={{ animationPlayState: toastPaused ? 'paused' : 'running' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
// ===== PHẦN 5/5 — KẾT THÚC =====