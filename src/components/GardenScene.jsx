import React from 'react';
import './garden-scene.css';

/* =====================================================================
   GardenScene v2 — "Golden hour spring"
   Ánh sáng: mặt trời thấp ở bên PHẢI → mọi vật sáng ở mép phải, đổ bóng sang TRÁI.
   Chiều sâu: càng xa càng nhạt, càng ngả về màu sương hồng–đào.
   Mặt đất: tính bằng hàm số, nên cây/nhà/hàng rào/hoa luôn đứng đúng trên đồi.
   ===================================================================== */

function rng(seed) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const f1 = (n) => n.toFixed(1);

/* ---------- Địa hình (các hàm độ cao) ---------- */
const RA = (x) => 300 + 22 * Math.sin(x / 150 + 0.3) + 9 * Math.sin(x / 55); // núi xa
const RB = (x) => 352 + 16 * Math.sin(x / 190 + 1.4) + 6 * Math.sin(x / 64); // núi gần hơn
const T1 = (x) => 402 + 13 * Math.sin(x / 180 + 0.6) + 5 * Math.sin(x / 70 + 2); // đồng xa
const T2 = (x) => 446 + 12 * Math.sin(x / 210 + 2.1) + 5 * Math.sin(x / 83); // đồng gần

function area(fn, step = 12) {
  let d = `M0,${f1(fn(0))}`;
  for (let x = step; x <= 1200; x += step) d += ` L${x},${f1(fn(x))}`;
  return `${d} L1200,600 L0,600 Z`;
}
function line(fn, dy = 0, step = 12) {
  let d = `M0,${f1(fn(0) + dy)}`;
  for (let x = step; x <= 1200; x += step) d += ` L${x},${f1(fn(x) + dy)}`;
  return d;
}

const HOUSE_X = 960;
const HOUSE_Y = T1(HOUSE_X) + 14;

/* ---------- Cây anh đào: tán được dựng từ nhiều "cụm hoa" có 3 tầng sáng ---------- */
const PALETTES = {
  rose: { dark: '#E0698F', mid: '#F598B6', light: '#FFC7D8', hi: '#FFEEF3' },
  blush: { dark: '#E487AB', mid: '#F8B4CB', light: '#FFDAE6', hi: '#FFF7F9' },
  peach: { dark: '#EC8888', mid: '#F8B3A4', light: '#FFD6C0', hi: '#FFF1E4' },
  lilac: { dark: '#A985DC', mid: '#C9A8EE', light: '#E4D0FA', hi: '#F7EEFF' },
};

function buildTree(spec) {
  const r = rng(spec.seed);
  const { rx, ry, n } = spec;
  const blobs = [];
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    blobs.push({
      cx: Math.cos(a) * rx * d * (0.9 + r() * 0.2),
      cy: Math.sin(a) * ry * d * (0.9 + r() * 0.2),
      rad: 9 + r() * 13 + (1 - d) * 5,
    });
  }
  blobs.sort((a, b) => a.cy - b.cy);
  const specks = Array.from({ length: Math.round(n * 1.4) }, () => {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    return { x: Math.cos(a) * rx * d, y: Math.sin(a) * ry * d, rad: 1.2 + r() * 2.2, t: r() };
  });
  const fallen = Array.from({ length: 14 }, () => ({
    x: (r() - 0.7) * rx * 1.9,
    y: 2 + r() * 8,
    rot: r() * 180,
  }));
  return { ...spec, blobs, specks, fallen };
}

const TREES = [
  { id: 'a', seed: 11, x: 105, y: T1(105) + 30, s: 1.25, rx: 58, ry: 46, n: 46, trunk: 80, lean: -4, pal: 'rose' },
  { id: 'b', seed: 23, x: 262, y: T1(262) + 26, s: 0.85, rx: 54, ry: 42, n: 38, trunk: 74, lean: 3, pal: 'blush' },
  { id: 'c', seed: 37, x: 585, y: T1(585) + 14, s: 0.55, rx: 50, ry: 40, n: 30, trunk: 70, lean: 2, pal: 'lilac' },
  { id: 'd', seed: 51, x: 1150, y: T1(1150) + 30, s: 1.05, rx: 56, ry: 44, n: 42, trunk: 78, lean: 5, pal: 'peach' },
].map(buildTree);

function BlossomTree({ t }) {
  const pal = PALETTES[t.pal];
  const cy0 = -t.trunk - t.ry * 0.5;
  const clip = `gs-cc-${t.id}`;
  return (
    <g transform={`translate(${t.x} ${f1(t.y)}) scale(${t.s})`}>
      {/* bóng đổ sang trái (nắng từ phải) */}
      <ellipse cx={-t.rx * 0.6} cy="4" rx={t.rx * 1.3} ry="9" fill="url(#gs-shadow)" />
      {/* cánh hoa rụng quanh gốc */}
      {t.fallen.map((p, i) => (
        <ellipse key={i} cx={p.x} cy={p.y} rx="3.2" ry="1.4" fill="#FFC7D8" opacity="0.9" transform={`rotate(${f1(p.rot)} ${f1(p.x)} ${f1(p.y)})`} />
      ))}
      {/* thân + cành */}
      <path d={`M-7,3 C-6,-${t.trunk * 0.3} -3,-${t.trunk * 0.6} ${t.lean - 3.5},-${t.trunk} L${t.lean + 3.5},-${t.trunk} C3,-${t.trunk * 0.6} 5,-${t.trunk * 0.3} 8,3 Z`} fill="#7B4B4A" />
      <path d={`M7,2 C4,-${t.trunk * 0.3} 3,-${t.trunk * 0.6} ${t.lean + 3},-${t.trunk}`} stroke="#C99080" strokeWidth="1.8" fill="none" opacity="0.7" strokeLinecap="round" />
      <path d={`M${t.lean},-${t.trunk * 0.62} C${t.lean - 14},-${t.trunk * 0.8} ${t.lean - 26},-${t.trunk * 0.95} ${t.lean - 34},-${t.trunk + 14}`} stroke="#7B4B4A" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d={`M${t.lean},-${t.trunk * 0.7} C${t.lean + 12},-${t.trunk * 0.86} ${t.lean + 24},-${t.trunk * 0.98} ${t.lean + 34},-${t.trunk + 10}`} stroke="#7B4B4A" strokeWidth="3.4" fill="none" strokeLinecap="round" />

      {/* tán hoa */}
      <g transform={`translate(${t.lean} ${f1(cy0)})`}>
        <clipPath id={clip}>
          {t.blobs.map((b, i) => (
            <circle key={i} cx={f1(b.cx)} cy={f1(b.cy)} r={f1(b.rad)} />
          ))}
        </clipPath>
        {t.blobs.map((b, i) => (
          <g key={i}>
            <circle cx={f1(b.cx)} cy={f1(b.cy)} r={f1(b.rad)} fill={pal.dark} />
            <circle cx={f1(b.cx + b.rad * 0.16)} cy={f1(b.cy - b.rad * 0.18)} r={f1(b.rad * 0.82)} fill={pal.mid} />
            <circle cx={f1(b.cx + b.rad * 0.3)} cy={f1(b.cy - b.rad * 0.34)} r={f1(b.rad * 0.48)} fill={pal.light} />
          </g>
        ))}
        {/* đổ bóng lớn: dưới–trái tối, trên–phải sáng; viền sáng ấm phía mặt trời */}
        <g clipPath={`url(#${clip})`}>
          <rect x={-t.rx - 30} y={-t.ry - 30} width={t.rx * 2 + 60} height={t.ry * 2 + 60} fill="url(#gs-canopy-shade)" />
          <rect x={-t.rx - 30} y={-t.ry - 30} width={t.rx * 2 + 60} height={t.ry * 2 + 60} fill="url(#gs-rim)" />
        </g>
        {t.specks.map((p, i) => (
          <circle key={i} cx={f1(p.x)} cy={f1(p.y)} r={f1(p.rad)} fill={p.t > 0.5 ? pal.hi : '#FFFFFF'} opacity={p.x > 0 ? 0.85 : 0.5} />
        ))}
      </g>
    </g>
  );
}

/* ---------- Cụm cây nhỏ phía xa: cùng tông, mờ vì sương ---------- */
const FAR_CLUMPS = (() => {
  const r = rng(404);
  const out = [];
  for (let i = 0; i < 34; i++) {
    const x = 10 + r() * 1180;
    if (Math.abs(x - 105) < 80 || Math.abs(x - 262) < 55 || Math.abs(x - HOUSE_X) < 120 || Math.abs(x - 1150) < 70) continue;
    const n = 3 + Math.floor(r() * 3);
    const base = T1(x) + 2;
    out.push({
      key: i,
      circles: Array.from({ length: n }, () => ({ cx: x + (r() - 0.5) * 20, cy: base - 6 - r() * 10, rad: 6 + r() * 7 })),
    });
  }
  return out;
})();

/* ---------- Hoa: 4 loài, to nhỏ theo độ sâu ---------- */
const FLOWER_COLORS = ['#FB7185', '#F9A8D4', '#FDE68A', '#FFFFFF', '#C4B5FD', '#FDA4AF', '#FCA5A5'];
const FLOWERS = (() => {
  const r = rng(2010);
  const list = [];
  for (let i = 0; i < 64; i++) {
    const x = 6 + r() * 1188;
    const y = T2(x) + 8 + r() * (496 - T2(x) - 8);
    if (Math.abs(x - HOUSE_X) < 48) continue;
    list.push({
      key: i,
      x,
      y,
      s: 0.5 + ((y - 440) / 60) * 0.6,
      c: FLOWER_COLORS[Math.floor(r() * FLOWER_COLORS.length)],
      kind: ['daisy', 'cosmos', 'tulip', 'lavender'][Math.floor(r() * 4)],
    });
  }
  return list.sort((a, b) => a.y - b.y);
})();

function Flower({ x, y, s, c, kind }) {
  const stem = <path d="M0,0 C-2,-10 2,-20 0,-30" stroke="#2C8A52" strokeWidth="1.8" fill="none" strokeLinecap="round" />;
  const leaf = <ellipse cx="-5" cy="-11" rx="5" ry="2.2" fill="#3FB06A" transform="rotate(-30 -5 -11)" />;
  let head;
  if (kind === 'daisy') {
    head = (
      <g transform="translate(0 -33)">
        {Array.from({ length: 10 }, (_, i) => (
          <ellipse key={i} cx="0" cy="-5.2" rx="1.7" ry="5" fill="#FFFFFF" stroke="rgba(190,24,93,0.12)" strokeWidth="0.4" transform={`rotate(${i * 36})`} />
        ))}
        <circle r="3" fill="#FCD34D" />
      </g>
    );
  } else if (kind === 'tulip') {
    head = (
      <g transform="translate(0 -30)">
        <path d="M-5.5,0 C-7,-9 -2,-13 0,-17 C2,-13 7,-9 5.5,0 C2,2 -2,2 -5.5,0 Z" fill={c} />
        <path d="M0,-17 C-2,-12 -3,-6 -1,1 C3,0 4,-8 0,-17 Z" fill="#FFFFFF" opacity="0.28" />
      </g>
    );
  } else if (kind === 'lavender') {
    head = (
      <g transform="translate(0 -30)">
        {Array.from({ length: 7 }, (_, i) => (
          <ellipse key={i} cx={i % 2 ? 2 : -2} cy={-i * 3.2} rx="2.3" ry="1.8" fill={i % 3 ? '#B79AF0' : '#CDB6F7'} />
        ))}
      </g>
    );
  } else {
    head = (
      <g transform="translate(0 -33)">
        {Array.from({ length: 8 }, (_, i) => (
          <ellipse key={i} cx="0" cy="-5.5" rx="3.4" ry="6" fill={c} stroke="rgba(190,24,93,0.16)" strokeWidth="0.5" transform={`rotate(${i * 45})`} />
        ))}
        <circle r="3.2" fill="#FDE68A" />
        <circle cx="1" cy="-1" r="1.1" fill="#FFFBEB" />
      </g>
    );
  }
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) scale(${f1(s)})`}>
      <ellipse cx="-3" cy="1" rx="8" ry="2" fill="url(#gs-shadow)" />
      {stem}
      {leaf}
      {head}
    </g>
  );
}

/* ---------- Cỏ ---------- */
const BLADES = (() => {
  const r = rng(77);
  let dark = '';
  let light = '';
  for (let i = 0; i < 300; i++) {
    const x = r() * 1200;
    const y = T2(x) + r() * (498 - T2(x));
    const h = 5 + r() * 9;
    const lean = (r() - 0.5) * 5;
    const d = `M${f1(x)},${f1(y)} q${f1(lean * 0.4)},${f1(-h * 0.6)} ${f1(lean)},${f1(-h)} `;
    if (r() > 0.45) dark += d;
    else light += d;
  }
  return { dark, light };
})();

const FORE_BLADES = (() => {
  const r = rng(909);
  return Array.from({ length: 46 }, (_, i) => {
    const x = (i / 46) * 1200 + r() * 18;
    const h = 16 + r() * 22;
    const lean = (r() - 0.5) * 12;
    return `M${f1(x)},604 Q${f1(x + lean * 0.5)},${f1(604 - h * 0.6)} ${f1(x + lean)},${f1(604 - h)} Q${f1(x + lean * 0.5 + 4)},${f1(604 - h * 0.5)} ${f1(x + 6)},604 Z`;
  }).join(' ');
})();

const BOKEH = (() => {
  const r = rng(31);
  return Array.from({ length: 9 }, () => ({
    cx: r() * 1200,
    cy: 572 + r() * 24,
    rad: 7 + r() * 11,
    c: ['#FFD1E0', '#FFF3C4', '#FFFFFF'][Math.floor(r() * 3)],
  }));
})();

/* ---------- Cụm hoa hồng nhung chân thực (Layered Botanical Roses) ---------- */
export function BotanicalRose({ x, y, s = 1, pal = 'crimson', rot = 0 }) {
  const p = {
    crimson: { base: '#4A0E1C', mid: '#8C2F4B', hi: '#BE123C', rim: '#FDA4AF' },
    ruby: { base: '#701026', mid: '#BE123C', hi: '#F43F5E', rim: '#FECDD3' },
    champagne: { base: '#5E2B08', mid: '#B4833E', hi: '#E5C388', rim: '#FFFBEB' },
    blush: { base: '#831843', mid: '#DB2777', hi: '#F472B6', rim: '#FFF1F2' },
    cream: { base: '#A16207', mid: '#E5C388', hi: '#FEF3C7', rim: '#FFFFFF' },
  }[pal] || { base: '#4A0E1C', mid: '#8C2F4B', hi: '#BE123C', rim: '#FDA4AF' };

  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) scale(${f1(s)}) rotate(${f1(rot)})`}>
      {/* Đài hoa và lá xanh có gân lá sắc sảo */}
      <path d="M-6,3 Q-13,11 -17,7 Q-11,-2 -5,-3 Z" fill="#14532D" stroke="#166534" strokeWidth="0.4" />
      <path d="M6,3 Q13,11 17,7 Q11,-2 5,-3 Z" fill="#166534" stroke="#15803D" strokeWidth="0.4" />
      <path d="M0,5 Q-5,14 -2,17 Q4,14 2,5 Z" fill="#0F3F22" />

      {/* Cánh hoa ngoài cùng hình chén nhiều lớp xòe rộng (Outer Layer Petals) */}
      <ellipse cx="-4.5" cy="-2.5" rx="7" ry="5.5" fill={p.base} stroke={p.rim} strokeWidth="0.4" transform="rotate(-30 -4.5 -2.5)" />
      <ellipse cx="4.5" cy="-2.5" rx="7" ry="5.5" fill={p.base} stroke={p.rim} strokeWidth="0.4" transform="rotate(30 4.5 -2.5)" />
      <ellipse cx="0" cy="4.5" rx="7.5" ry="5" fill={p.mid} stroke={p.rim} strokeWidth="0.4" />
      <ellipse cx="0" cy="-6.5" rx="7" ry="4.8" fill={p.base} stroke={p.rim} strokeWidth="0.4" />

      {/* Cánh hoa giữa đan xen ôm tròn (Mid Layer Petals) */}
      <path d="M-5.5,-4.5 C-8,-1 -4,4.5 0,5.5 C4.5,4.5 8,-1 5.5,-4.5 C2.5,-7 -2.5,-7 -5.5,-4.5 Z" fill={p.mid} />
      <path d="M-4,-2 C-2,2.5 2,2.5 4,-2 C2,-4.5 -2,-4.5 -4,-2 Z" fill={p.hi} stroke={p.rim} strokeWidth="0.5" />

      {/* Tâm nụ hoa cuộn xoắn nghệ thuật (Inner Spiral Core) */}
      <circle cx="0" cy="-1" r="3.2" fill={p.base} />
      <path d="M-2.2,-2.2 C-1.2,-3.4 1.2,-3.4 2.2,-1.2 C2.2,1.2 0,1.8 -1.2,0.8" fill="none" stroke={p.rim} strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="0.5" cy="-0.5" r="0.9" fill="#FDE68A" />
    </g>
  );
}

/* ---------- Vọng Lâu Tri Ân 20.10 (Tribute Pavilion) ---------- */
function TributePavilion({ x, y, s, sisterName }) {
  // GIÀN HOA HỒNG LEO DỌC 2 BÊN CỘT: DÀY DẶN, TẤP NẬP, KHÔNG CHE CHỮ
  const leftClimbingRoses = [
    { x: -54, y: -16, s: 1.15, pal: 'crimson', rot: -15 },
    { x: -48, y: -24, s: 0.95, pal: 'blush', rot: 25 },
    { x: -53, y: -33, s: 1.1, pal: 'ruby', rot: -10 },
    { x: -46, y: -42, s: 0.9, pal: 'champagne', rot: 20 },
    { x: -52, y: -51, s: 1.15, pal: 'crimson', rot: -5 },
    { x: -47, y: -60, s: 0.95, pal: 'blush', rot: 15 },
    { x: -51, y: -69, s: 1.05, pal: 'ruby', rot: -20 },
    { x: -45, y: -76, s: 0.85, pal: 'champagne', rot: 10 },
  ];

  const rightClimbingRoses = [
    { x: 54, y: -16, s: 1.15, pal: 'crimson', rot: 15 },
    { x: 48, y: -24, s: 0.95, pal: 'blush', rot: -25 },
    { x: 53, y: -33, s: 1.1, pal: 'ruby', rot: 10 },
    { x: 46, y: -42, s: 0.9, pal: 'champagne', rot: -20 },
    { x: 52, y: -51, s: 1.15, pal: 'crimson', rot: 5 },
    { x: 47, y: -60, s: 0.95, pal: 'blush', rot: -15 },
    { x: 51, y: -69, s: 1.05, pal: 'ruby', rot: 20 },
    { x: 45, y: -76, s: 0.85, pal: 'champagne', rot: -10 },
  ];

  return (
    <g transform={`translate(${x} ${f1(y)}) scale(${s})`}>
      {/* Bóng đổ dài sang trái theo ánh nắng hoàng hôn */}
      <ellipse cx="-44" cy="3" rx="120" ry="10" fill="url(#gs-shadow)" />

      {/* Bậc thềm đá cẩm thạch trắng ngà & viền vàng champagne */}
      <rect x="-72" y="-6" width="144" height="6" rx="2" fill="#FAF3EA" stroke="#C9A66B" strokeWidth="1" />
      <rect x="-64" y="-12" width="128" height="6" rx="1.5" fill="#FFF9F5" stroke="#C9A66B" strokeWidth="0.8" />
      <rect x="-58" y="-16" width="116" height="4" rx="1" fill="#FFFFFF" />

      {/* Ánh sáng ấm từ bên trong vọng lâu */}
      <ellipse cx="0" cy="-56" rx="48" ry="42" fill="url(#gs-glow)" opacity="0.95" style={{ mixBlendMode: 'screen' }} />

      {/* Rèm nhung hoàng gia đỏ rượu vang (Wine Red Velvet Drapes) */}
      <path d="M-48,-74 Q-30,-50 -44,-16 L-34,-16 Q-22,-48 -36,-74 Z" fill="url(#gs-velvet)" />
      <path d="M48,-74 Q30,-50 44,-16 L34,-16 Q22,-48 36,-74 Z" fill="url(#gs-velvet)" />
      {/* Dây thắt rèm vàng champagne */}
      <rect x="-44" y="-42" width="8" height="3" rx="1.5" fill="#FDE68A" />
      <rect x="36" y="-42" width="8" height="3" rx="1.5" fill="#FDE68A" />

      {/* Các cột trụ La Mã cổ điển trắng - vàng (4 Pillars) */}
      {[-44, -16, 16, 44].map((px, idx) => (
        <g key={idx}>
          <rect x={px - 5} y="-20" width="10" height="4" rx="1" fill="#C9A66B" />
          <rect x={px - 3.5} y="-74" width="7" height="54" fill="#FFFDF8" stroke="#E5C388" strokeWidth="0.8" />
          <line x1={px} y1="-74" x2={px} y2="-20" stroke="#E5C388" strokeWidth="0.6" opacity="0.6" />
          <rect x={px - 5.5} y="-78" width="11" height="4" rx="1" fill="#C9A66B" />
          <circle cx={px} cy="-76" r="1.5" fill="#FDE68A" />
        </g>
      ))}

      {/* Đèn chùm pha lê vàng hoàng gia treo giữa vọng lâu */}
      <line x1="0" y1="-82" x2="0" y2="-62" stroke="#C9A66B" strokeWidth="1.2" />
      <circle cx="0" cy="-56" r="16" fill="url(#gs-glow)" style={{ mixBlendMode: 'screen' }} />
      <path d="M-8,-62 L8,-62 L5,-50 L0,-44 L-5,-50 Z" fill="#C9A66B" opacity="0.9" />
      <circle cx="0" cy="-52" r="4" fill="#FFFBEB" />
      <circle cx="0" cy="-52" r="2" fill="#FCD34D" />

      {/* Mái vòm hoàng gia (Rotunda Dome) */}
      <path d="M-52,-78 C-52,-114 52,-114 52,-78 Z" fill="url(#gs-dome)" />
      <path d="M-52,-78 C-52,-114 0,-118 0,-78 Z" fill="#C9A66B" opacity="0.25" />
      <rect x="-56" y="-82" width="112" height="5" rx="2" fill="#C9A66B" stroke="#8C2F4B" strokeWidth="0.8" />

      {/* Đỉnh mái vòm: Vương miện vàng 20.10 dát vàng */}
      <line x1="0" y1="-114" x2="0" y2="-128" stroke="#C9A66B" strokeWidth="2" />
      <circle cx="0" cy="-132" r="7" fill="#C9A66B" />
      <circle cx="0" cy="-132" r="5" fill="#FFFBEB" />
      <path d="M0,-140 L2.5,-134 L8,-134 L3.5,-130 L5.5,-124 L0,-128 L-5.5,-124 L-3.5,-130 L-8,-134 L-2.5,-134 Z" fill="#C9A66B" />

      {/* DÂY LEO VÀ TÁN LÁ HOA HỒNG QUẤN QUANH 2 CỘT BIÊN */}
      <path d="M-48,-16 Q-56,-36 -46,-52 Q-56,-68 -48,-78" fill="none" stroke="#166534" strokeWidth="3" strokeLinecap="round" />
      <path d="M-49,-16 Q-43,-34 -52,-50 Q-42,-66 -49,-78" fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" />
      <path d="M48,-16 Q56,-36 46,-52 Q56,-68 48,-78" fill="none" stroke="#166534" strokeWidth="3" strokeLinecap="round" />
      <path d="M49,-16 Q43,-34 52,-50 Q42,-66 49,-78" fill="none" stroke="#2D6A4F" strokeWidth="2" strokeLinecap="round" />

      {/* HOA BABY TRẮNG LI TI TĂNG ĐỘ TẤP NẬP */}
      {[-18, -28, -38, -48, -58, -68].map((ly, idx) => (
        <g key={`gyp-${idx}`}>
          <circle cx={-50 + (idx % 2 ? 4 : -4)} cy={ly} r="1.6" fill="#FFFFFF" />
          <circle cx={-50 + (idx % 2 ? -3 : 3)} cy={ly + 3} r="1.3" fill="#FFFBEB" />
          <circle cx={50 + (idx % 2 ? -4 : 4)} cy={ly} r="1.6" fill="#FFFFFF" />
          <circle cx={50 + (idx % 2 ? 3 : -3)} cy={ly + 3} r="1.3" fill="#FFFBEB" />
        </g>
      ))}

      {/* DẢI HOA HỒNG BOTANICAL DÀY DẶN 2 BÊN CỘT */}
      {leftClimbingRoses.map((r, i) => (
        <BotanicalRose key={`l-${i}`} {...r} />
      ))}
      {rightClimbingRoses.map((r, i) => (
        <BotanicalRose key={`r-${i}`} {...r} />
      ))}

      {/* GIÁ TRANH NGHỆ THUẬT (EASEL) PHÓNG TO, RÕ NÉT, HOÀN TOÀN KHÔNG BỊ BỤI CÂY CHE */}
      <g transform="translate(-86, -42)">
        {/* Chân giá vẽ bằng gỗ sồi bóng viền đồng */}
        <line x1="-22" y1="52" x2="0" y2="-12" stroke="#663A3A" strokeWidth="3" strokeLinecap="round" />
        <line x1="22" y1="52" x2="0" y2="-12" stroke="#663A3A" strokeWidth="3" strokeLinecap="round" />
        <line x1="0" y1="52" x2="0" y2="-20" stroke="#4B2727" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="-30" y1="36" x2="30" y2="36" stroke="#C9A66B" strokeWidth="2.5" strokeLinecap="round" />

        {/* Khung tranh lớn dát vàng hoàng gia sang trọng (Width: 84, Height: 58) */}
        <rect x="-42" y="-10" width="84" height="56" rx="6" fill="#FAF3EA" stroke="#C9A66B" strokeWidth="3" />
        <rect x="-38" y="-6" width="76" height="48" rx="4.5" fill="#4A1222" />

        {/* Viền chỉ vàng đôi bên trong tranh */}
        <rect x="-35" y="-3" width="70" height="42" rx="3" fill="none" stroke="#E5C388" strokeWidth="1.2" opacity="0.9" />

        {/* Vương miện vàng kiêu sa */}
        <text x="0" y="6" fontFamily="'Be Vietnam Pro', sans-serif" fontSize="5.6" fontWeight="bold" fill="#FDE68A" textAnchor="middle" letterSpacing="1">
          👑 NỮ VƯƠNG 20/10 👑
        </text>

        {/* Tên chị em to nổi bật, sắc nét, trang trọng */}
        <text x="0" y="21" fontFamily="'Playfair Display', serif" fontSize="11" fontWeight="bold" fill="#FFFFFF" textAnchor="middle" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.5))">
          {sisterName || 'Bạn'}
        </text>

        {/* Dòng tri ân thanh lịch */}
        <text x="0" y="31" fontFamily="'Be Vietnam Pro', sans-serif" fontSize="5.2" fontWeight="600" fill="#FECDD3" textAnchor="middle" fontStyle="italic">
          Bông Hoa Rạng Rỡ TechCorp 🌹
        </text>

        {/* Cụm hoa hồng botanical lớn gắn góc khung tranh */}
        <BotanicalRose x={-36} y={-8} s={0.85} pal="ruby" rot={-30} />
        <BotanicalRose x={36} y={-8} s={0.85} pal="champagne" rot={30} />
        <BotanicalRose x={-36} y={38} s={0.75} pal="blush" rot={-15} />
        <BotanicalRose x={36} y={38} s={0.75} pal="crimson" rot={15} />
      </g>

      {/* CỔNG CHỮ TRI ÂN 20.10: ĐẶT Ở LAYER TRÊN CÙNG CỦA PAVILION, TUYỆT ĐỐI KHÔNG BỊ BẤT KỲ DẢI HOA NÀO CHE KHUẤT! */}
      <g transform="translate(0, -96)">
        {/* Dây xích vàng treo cổng chữ từ đỉnh vòm */}
        <line x1="-50" y1="-8" x2="-50" y2="4" stroke="#C9A66B" strokeWidth="1.2" />
        <line x1="50" y1="-8" x2="50" y2="4" stroke="#C9A66B" strokeWidth="1.2" />

        {/* Đổ bóng cho dải băng chữ */}
        <path d="M-82,2 Q0,-7 82,2 L80,20 Q0,11 -80,20 Z" fill="rgba(0,0,0,0.22)" />
        {/* Bảng lụa đỏ rượu vang viền vàng champagne sắc sảo */}
        <path d="M-80,0 Q0,-9 80,0 L78,18 Q0,9 -78,18 Z" fill="url(#gs-gold-ribbon)" stroke="#E5C388" strokeWidth="1.8" />
        {/* Đuôi nơ hoàng gia 2 bên vòm */}
        <path d="M-80,0 L-89,9 L-78,18 Z" fill="#4A0E1C" stroke="#C9A66B" strokeWidth="1" />
        <path d="M80,0 L89,9 L78,18 Z" fill="#4A0E1C" stroke="#C9A66B" strokeWidth="1" />

        {/* Tiêu đề 20/10 nổi bật, sắc nét */}
        <text
          x="0"
          y="12.5"
          fontFamily="'Playfair Display', serif"
          fontSize="8.2"
          fontWeight="bold"
          fill="#FFFBEB"
          textAnchor="middle"
          letterSpacing="1"
          filter="drop-shadow(0 1px 2px rgba(0,0,0,0.4))"
        >
          🌸 20/10 • TRI ÂN NỮ TÀI SẮC 🌸
        </text>
      </g>
    </g>
  );
}

function Fence({ from, to, step = 10.5 }) {
  const picks = [];
  for (let px = from; px <= to; px += step) picks.push(px);
  const yAt = (px) => T1(px) + 15;
  const rail = (dy) => picks.map((px, i) => `${i ? 'L' : 'M'}${f1(px + 3)},${f1(yAt(px) + dy)}`).join(' ');
  return (
    <g>
      <path d={rail(-18)} stroke="#F2D4DD" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d={rail(-8)} stroke="#F2D4DD" strokeWidth="3" fill="none" strokeLinecap="round" />
      {picks.map((px) => {
        const y0 = yAt(px);
        return (
          <g key={px}>
            <path d={`M${f1(px)},${f1(y0)} L${f1(px)},${f1(y0 - 24)} L${f1(px + 3)},${f1(y0 - 28)} L${f1(px + 6)},${f1(y0 - 24)} L${f1(px + 6)},${f1(y0)} Z`} fill="#FFF9F6" stroke="#E7B9C6" strokeWidth="0.8" />
            <path d={`M${f1(px + 4.6)},${f1(y0)} L${f1(px + 4.6)},${f1(y0 - 24)}`} stroke="#FFFFFF" strokeWidth="1.2" opacity="0.8" />
          </g>
        );
      })}
    </g>
  );
}

function Bush({ x, y, s = 1, seed = 1 }) {
  const r = rng(seed);
  const blobs = Array.from({ length: 6 }, (_, i) => ({ cx: (i - 2.5) * 7 + (r() - 0.5) * 4, cy: -6 - r() * 7, rad: 8 + r() * 5 }));
  const dots = Array.from({ length: 9 }, () => ({ cx: (r() - 0.5) * 44, cy: -6 - r() * 16, c: ['#F9A8D4', '#FB7185', '#FFFFFF'][Math.floor(r() * 3)] }));
  return (
    <g transform={`translate(${f1(x)} ${f1(y)}) scale(${s})`}>
      <ellipse cx="-8" cy="2" rx="28" ry="5" fill="url(#gs-shadow)" />
      {blobs.map((b, i) => (
        <g key={i}>
          <circle cx={f1(b.cx)} cy={f1(b.cy)} r={f1(b.rad)} fill="#2F9C5C" />
          <circle cx={f1(b.cx + 2)} cy={f1(b.cy - 2)} r={f1(b.rad * 0.78)} fill="#4DBE7B" />
          <circle cx={f1(b.cx + 4)} cy={f1(b.cy - 4)} r={f1(b.rad * 0.4)} fill="#86E3A6" />
        </g>
      ))}
      {dots.map((d, i) => (
        <circle key={i} cx={f1(d.cx)} cy={f1(d.cy)} r="2.2" fill={d.c} />
      ))}
    </g>
  );
}

function Butterfly({ className, color }) {
  return (
    <svg className={`gs-butterfly ${className}`} viewBox="0 0 40 32" aria-hidden="true">
      <g className="gs-wing gs-wing-l">
        <path d="M20,16 C8,2 0,6 2,15 C3,22 12,22 20,16 Z" fill={color} />
        <path d="M20,16 C10,22 6,30 12,30 C17,30 20,24 20,16 Z" fill={color} opacity="0.75" />
      </g>
      <g className="gs-wing gs-wing-r">
        <path d="M20,16 C32,2 40,6 38,15 C37,22 28,22 20,16 Z" fill={color} />
        <path d="M20,16 C30,22 34,30 28,30 C23,30 20,24 20,16 Z" fill={color} opacity="0.75" />
      </g>
      <rect x="19" y="9" width="2" height="16" rx="1" fill="#7F1D1D" />
    </svg>
  );
}

const SPARKS = [
  { top: '14%', left: '12%', size: 9, delay: '0s' },
  { top: '22%', left: '34%', size: 7, delay: '1.1s' },
  { top: '11%', left: '58%', size: 10, delay: '2.2s' },
  { top: '33%', left: '74%', size: 8, delay: '0.6s' },
  { top: '40%', left: '22%', size: 7, delay: '1.8s' },
  { top: '27%', left: '92%', size: 9, delay: '2.9s' },
  { top: '46%', left: '48%', size: 6, delay: '3.4s' },
];

const PETALS = [
  { left: '6%', dur: '13s', delay: '0s', drift: '40px' },
  { left: '17%', dur: '16s', delay: '3s', drift: '-30px' },
  { left: '29%', dur: '14s', delay: '6s', drift: '50px' },
  { left: '43%', dur: '17s', delay: '1.5s', drift: '-45px' },
  { left: '55%', dur: '15s', delay: '8s', drift: '35px' },
  { left: '68%', dur: '18s', delay: '4s', drift: '-35px' },
  { left: '79%', dur: '14s', delay: '9.5s', drift: '45px' },
  { left: '90%', dur: '16s', delay: '2.2s', drift: '-40px' },
];

/* ======================== CẢNH CHÍNH ======================== */
function GardenScene({ sisterName }) {
  return (
    <div className="gs-scene" aria-hidden="true">
      <svg className="gs-svg" viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="gs-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#C9B3F2" />
            <stop offset="0.32" stopColor="#F2BDE0" />
            <stop offset="0.6" stopColor="#FFCFC9" />
            <stop offset="0.8" stopColor="#FFE2BF" />
            <stop offset="1" stopColor="#FFEBC9" />
          </linearGradient>
          <radialGradient id="gs-sun-glow">
            <stop offset="0" stopColor="#FFF8DC" stopOpacity="0.95" />
            <stop offset="0.25" stopColor="#FFE7A8" stopOpacity="0.55" />
            <stop offset="0.6" stopColor="#FFC9A0" stopOpacity="0.2" />
            <stop offset="1" stopColor="#FFC9A0" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="gs-sun-core">
            <stop offset="0" stopColor="#FFFFF4" />
            <stop offset="0.7" stopColor="#FFF3BF" />
            <stop offset="1" stopColor="#FFE08A" />
          </radialGradient>
          <linearGradient id="gs-ray" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFF6D8" stopOpacity="0.55" />
            <stop offset="1" stopColor="#FFF6D8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gs-cloudfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" />
            <stop offset="0.6" stopColor="#FFF0F5" />
            <stop offset="1" stopColor="#F8C6DB" />
          </linearGradient>
          <linearGradient id="gs-ridgeA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#BFA8EC" />
            <stop offset="1" stopColor="#D9B9EA" />
          </linearGradient>
          <linearGradient id="gs-ridgeB" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#E0A3D2" />
            <stop offset="1" stopColor="#EDB4CF" />
          </linearGradient>
          {/* sương mù: càng xuống thấp càng đậm → tạo chiều sâu */}
          <linearGradient id="gs-haze" gradientUnits="userSpaceOnUse" x1="0" y1="300" x2="0" y2="412">
            <stop offset="0" stopColor="#FFE3D0" stopOpacity="0" />
            <stop offset="1" stopColor="#FFE3D0" stopOpacity="0.82" />
          </linearGradient>
          <linearGradient id="gs-m1" gradientUnits="userSpaceOnUse" x1="0" y1="388" x2="0" y2="452">
            <stop offset="0" stopColor="#C6F2C9" />
            <stop offset="1" stopColor="#8FE0A6" />
          </linearGradient>
          <linearGradient id="gs-m2" gradientUnits="userSpaceOnUse" x1="0" y1="434" x2="0" y2="510">
            <stop offset="0" stopColor="#7BDD9C" />
            <stop offset="1" stopColor="#3DB972" />
          </linearGradient>
          <radialGradient id="gs-shadow">
            <stop offset="0" stopColor="#2C6B66" stopOpacity="0.42" />
            <stop offset="1" stopColor="#2C6B66" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="gs-glow">
            <stop offset="0" stopColor="#FFE9A8" stopOpacity="0.85" />
            <stop offset="1" stopColor="#FFC27A" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="gs-ground-light">
            <stop offset="0" stopColor="#FFF1C4" stopOpacity="0.6" />
            <stop offset="1" stopColor="#FFF1C4" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="gs-wall" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#EFD2DB" />
            <stop offset="0.55" stopColor="#FBEBEA" />
            <stop offset="1" stopColor="#FFFAF2" />
          </linearGradient>
          <linearGradient id="gs-roof-l" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#D83A5E" />
            <stop offset="1" stopColor="#C42A52" />
          </linearGradient>
          <linearGradient id="gs-roof-r" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FF7C96" />
            <stop offset="1" stopColor="#F2587A" />
          </linearGradient>
          <linearGradient id="gs-glass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFF3C4" />
            <stop offset="1" stopColor="#FFC98A" />
          </linearGradient>
          <linearGradient id="gs-canopy-shade" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
            <stop offset="0.55" stopColor="#B5457A" stopOpacity="0.1" />
            <stop offset="1" stopColor="#8A2A66" stopOpacity="0.4" />
          </linearGradient>
          <linearGradient id="gs-rim" x1="1" y1="0" x2="0.4" y2="0">
            <stop offset="0" stopColor="#FFE6B8" stopOpacity="0.6" />
            <stop offset="1" stopColor="#FFE6B8" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gs-fore" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#35A765" />
            <stop offset="1" stopColor="#1E7A48" />
          </linearGradient>
          <radialGradient id="gs-vignette" cx="0.5" cy="0.5" r="0.75">
            <stop offset="0.55" stopColor="#7A2A70" stopOpacity="0" />
            <stop offset="1" stopColor="#7A2A70" stopOpacity="0.26" />
          </radialGradient>
          <linearGradient id="gs-warm-wash" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FFD79A" stopOpacity="0.3" />
            <stop offset="0.6" stopColor="#FFD79A" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="gs-dome" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#FFF4D9" />
            <stop offset="0.45" stopColor="#E5C388" />
            <stop offset="1" stopColor="#B88A44" />
          </linearGradient>
          <linearGradient id="gs-velvet" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#A83252" />
            <stop offset="0.5" stopColor="#8C2F4B" />
            <stop offset="1" stopColor="#5E162B" />
          </linearGradient>
          <linearGradient id="gs-gold-ribbon" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8C2F4B" />
            <stop offset="0.5" stopColor="#BE123C" />
            <stop offset="1" stopColor="#8C2F4B" />
          </linearGradient>

          <symbol id="gs-cloudA" viewBox="0 0 120 50" overflow="visible">
            <path d="M14,44 C2,44 0,28 14,26 C14,12 34,6 44,16 C52,2 80,4 82,22 C98,16 112,30 102,44 Z" fill="url(#gs-cloudfill)" />
          </symbol>
          <symbol id="gs-cloudB" viewBox="0 0 160 40" overflow="visible">
            <path d="M6,34 C-4,34 -2,22 10,22 C14,12 30,12 36,18 C42,6 66,6 72,18 C84,10 104,12 108,22 C124,18 140,24 134,34 Z" fill="url(#gs-cloudfill)" />
          </symbol>
          <filter id="gs-blur3" x="-20%" y="-50%" width="140%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
          <filter id="gs-blur1" x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="1.1" />
          </filter>
          <filter id="gs-blur6" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <filter id="gs-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="4" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.2  0 0 0 0 0.35  0 0 0 0.6 0" />
          </filter>
        </defs>

        {/* ---------- Trời, mặt trời, tia nắng ---------- */}
        <rect width="1200" height="600" fill="url(#gs-sky)" />
        <circle cx="880" cy="272" r="360" fill="url(#gs-sun-glow)" />
        <g className="gs-rays" style={{ mixBlendMode: 'screen' }}>
          {[
            [120, 250], [330, 430], [520, 600], [700, 800], [1000, 1140], [1160, 1290],
          ].map(([a, b], i) => (
            <path key={i} d={`M880,272 L${a},600 L${b},600 Z`} fill="url(#gs-ray)" opacity="0.5" />
          ))}
        </g>
        <ellipse cx="880" cy="272" rx="520" ry="12" fill="#FFE3B0" opacity="0.5" filter="url(#gs-blur6)" />
        <circle cx="880" cy="272" r="52" fill="#FFF1C2" opacity="0.4" filter="url(#gs-blur3)" />
        <circle cx="880" cy="272" r="37" fill="url(#gs-sun-core)" />

        {/* mây ngang dải sương + mây bông */}
        <ellipse cx="300" cy="270" rx="240" ry="6" fill="#FFD9D0" opacity="0.6" filter="url(#gs-blur3)" />
        <ellipse cx="640" cy="236" rx="180" ry="5" fill="#FFE6D0" opacity="0.55" filter="url(#gs-blur3)" />
        <use className="gs-cloud gs-c1" href="#gs-cloudA" x="90" y="70" width="170" height="70" />
        <use className="gs-cloud gs-c2" href="#gs-cloudB" x="500" y="38" width="190" height="48" />
        <use className="gs-cloud gs-c3" href="#gs-cloudA" x="1010" y="100" width="140" height="58" />
        <use className="gs-cloud gs-c4" href="#gs-cloudB" x="330" y="170" width="150" height="38" opacity="0.8" />

        {/* chim bay xa */}
        {[[300, 150, 'gs-bd1'], [346, 168, 'gs-bd2'], [800, 120, 'gs-bd3']].map(([bx, by, cls]) => (
          <g key={cls} transform={`translate(${bx} ${by})`}>
            <g className={`gs-bird ${cls}`}>
              <path d="M0,0 q4,-5 8,0 q4,-5 8,0" fill="none" stroke="#7C4A7A" strokeWidth="1.3" strokeLinecap="round" opacity="0.55" />
            </g>
          </g>
        ))}

        {/* ---------- Núi xa phủ sương ---------- */}
        <path d={area(RA)} fill="url(#gs-ridgeA)" />
        <path d={area(RA)} fill="url(#gs-haze)" />
        <path d={area(RB)} fill="url(#gs-ridgeB)" />
        <path d={area(RB)} fill="url(#gs-haze)" />

        {/* ---------- Đồng xa ---------- */}
        <path d={area(T1)} fill="url(#gs-m1)" />
        <path d={line(T1, 12)} stroke="#FFFFFF" strokeWidth="9" opacity="0.1" fill="none" />
        <path d={line(T1, 26)} stroke="#FFFFFF" strokeWidth="7" opacity="0.08" fill="none" />
        <path d={line(T1, 0)} stroke="#E9FFE9" strokeWidth="2" opacity="0.7" fill="none" />
        <ellipse cx="900" cy="420" rx="470" ry="42" fill="url(#gs-ground-light)" style={{ mixBlendMode: 'screen' }} />

        {FAR_CLUMPS.map((cl) => (
          <g key={cl.key} opacity="0.8">
            {cl.circles.map((c, i) => (
              <g key={i}>
                <circle cx={f1(c.cx)} cy={f1(c.cy)} r={f1(c.rad)} fill="#E7A6C8" />
                <circle cx={f1(c.cx + 2)} cy={f1(c.cy - 2)} r={f1(c.rad * 0.7)} fill="#F2C0D8" />
              </g>
            ))}
          </g>
        ))}
        <path d={area(T1)} fill="url(#gs-haze)" opacity="0.28" />

        {/* ---------- Nhà, hàng rào, bụi hoa, cây lớn ---------- */}
        <BlossomTree t={TREES[1]} />
        <BlossomTree t={TREES[2]} />
        <Fence from={782} to={868} />
        <Fence from={1060} to={1088} />
        <TributePavilion x={HOUSE_X} y={HOUSE_Y} s={1.25} sisterName={sisterName} />
        <Bush x={HOUSE_X - 180} y={HOUSE_Y + 4} s={1.05} seed={3} />
        <Bush x={HOUSE_X + 96} y={HOUSE_Y + 2} s={1.0} seed={8} />
        <BlossomTree t={TREES[0]} />
        <BlossomTree t={TREES[3]} />

        {/* ---------- Đồng gần ---------- */}
        <path d={area(T2)} fill="url(#gs-m2)" />
        <path d={line(T2, 0)} stroke="#E9FFE9" strokeWidth="2.2" opacity="0.75" fill="none" />
        <path d={line(T2, 14)} stroke="#FFFFFF" strokeWidth="9" opacity="0.09" fill="none" />
        <path d={line(T2, 30)} stroke="#FFFFFF" strokeWidth="8" opacity="0.07" fill="none" />
        <ellipse cx="860" cy="458" rx="440" ry="30" fill="url(#gs-ground-light)" style={{ mixBlendMode: 'screen' }} />

        {/* lối đi lát đá từ cửa nhà ra đường */}
        <path
          d={`M${HOUSE_X - 11},${f1(HOUSE_Y)} C${HOUSE_X - 34},${f1(HOUSE_Y + 26)} ${HOUSE_X + 22},${f1(HOUSE_Y + 44)} ${HOUSE_X - 30},500 L${HOUSE_X + 38},500 C${HOUSE_X + 36},${f1(HOUSE_Y + 44)} ${HOUSE_X + 40},${f1(HOUSE_Y + 26)} ${HOUSE_X + 11},${f1(HOUSE_Y)} Z`}
          fill="#FFEFE2"
          opacity="0.92"
        />
        {[0.2, 0.42, 0.64, 0.86].map((k, i) => (
          <ellipse key={i} cx={HOUSE_X - 6 + Math.sin(k * 5) * 10} cy={f1(HOUSE_Y + 10 + k * (500 - HOUSE_Y - 14))} rx={5 + k * 6} ry={1.6 + k * 1.6} fill="#F4D3C4" />
        ))}

        <path d={BLADES.dark} stroke="#2A8F57" strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.7" />
        <path d={BLADES.light} stroke="#B8F2C6" strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.75" />

        {FLOWERS.map((f) => (
          <Flower key={f.key} x={f.x} y={f.y} s={f.s} c={f.c} kind={f.kind} />
        ))}

        {/* ---------- Tiền cảnh dưới đường: cỏ + bokeh (mờ ngoài tiêu cự) ---------- */}
        <rect x="0" y="556" width="1200" height="44" fill="url(#gs-fore)" />
        <g filter="url(#gs-blur6)" opacity="0.55">
          {BOKEH.map((b, i) => (
            <circle key={i} cx={f1(b.cx)} cy={f1(b.cy)} r={f1(b.rad)} fill={b.c} />
          ))}
        </g>
        <path d={FORE_BLADES} fill="#1A6B3F" opacity="0.85" filter="url(#gs-blur1)" />

        {/* ---------- Hoàn thiện ảnh: ánh ấm, tối góc, hạt phim ---------- */}
        <rect width="1200" height="600" fill="url(#gs-warm-wash)" style={{ mixBlendMode: 'soft-light' }} />
        <rect width="1200" height="600" fill="url(#gs-vignette)" />
        <rect width="1200" height="600" filter="url(#gs-grain)" opacity="0.1" style={{ mixBlendMode: 'overlay' }} />
      </svg>

      <Butterfly className="gs-b1" color="#F472B6" />
      <Butterfly className="gs-b2" color="#A78BFA" />

      {SPARKS.map((p, i) => (
        <span key={i} className="gs-spark" style={{ top: p.top, left: p.left, width: p.size, height: p.size, animationDelay: p.delay }} />
      ))}

      {PETALS.map((p, i) => (
        <span key={i} className="gs-petal" style={{ left: p.left, '--dur': p.dur, '--delay': p.delay, '--drift': p.drift }} />
      ))}
    </div>
  );
}

export default React.memo(GardenScene);
