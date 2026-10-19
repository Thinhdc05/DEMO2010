import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import cardWishesData from '../data/cardWishes.json';

const W = 540, H = 675; // xuất scale 2 => 1080 x 1350 (tỉ lệ 4:5)

const THEMES = {
  hong: { label: 'Hồng đào', bg: '#FCEFEF', main: '#B23A5E', soft: '#F2C4CE', gold: '#B8914F', ink: '#3A1626' },
  ruou: { label: 'Đỏ rượu', bg: '#F9ECEA', main: '#7F1B3B', soft: '#E4B0B6', gold: '#B8914F', ink: '#2A1018' },
  ngoc: { label: 'Xanh ngọc', bg: '#EAF5F1', main: '#1E7562', soft: '#B9DDD0', gold: '#B8914F', ink: '#10302A' },
  tim: { label: 'Lavender', bg: '#F2EEFA', main: '#68489E', soft: '#D3C6EC', gold: '#B8914F', ink: '#24173B' },
};

// 4 Lời chúc thơ mộng mở đầu
const INITIAL_WISHES = [
  { h: 'Rạng rỡ theo cách của riêng chị', m: 'Cảm ơn chị vì năng lượng tích cực và sự đồng hành mỗi ngày. Chúc chị luôn xinh đẹp, bình an và tỏa sáng.' },
  { h: 'Mỗi ngày đều xứng đáng được tô hồng', m: 'Chúc chị một mùa 20/10 ngập hoa, ngập tiếng cười và những điều dịu dàng nhất.' },
  { h: 'Vững vàng như cây, dịu dàng như hoa', m: 'Chúc chị luôn khỏe mạnh, hạnh phúc và được yêu thương đúng như cách chị yêu thương mọi người.' },
  { h: 'Người phụ nữ làm nên khác biệt', m: 'Cảm ơn chị đã làm cho nơi này ấm áp hơn. Chúc chị thật nhiều niềm vui hôm nay và mọi ngày.' },
];

// Trích xuất và chuẩn hóa 50 lời chúc sâu sắc từ cardWishes.json
const EXTENDED_WISHES = (cardWishesData || []).map(item => {
  const firstSentence = (item.highlight || '').split(/[.!?:;]/)[0].trim();
  const title = (firstSentence.length > 8 && firstSentence.length < 55)
    ? firstSentence
    : (item.highlight || '').substring(0, 50).trim();

  const parts = (item.message || '').split(/[.!?:;]/).map(s => s.trim()).filter(Boolean);
  const text = parts.slice(0, 2).join('. ') + '.';

  return {
    h: title || 'Rạng rỡ & Vẹn toàn niềm vui',
    m: text.length > 20 ? text : (item.message || '')
  };
});

const ALL_WISHES = [...INITIAL_WISHES, ...EXTENDED_WISHES];

const Flower = ({ x, y, r, t }) => (
  <g transform={`translate(${x} ${y})`}>
    {[0, 72, 144, 216, 288].map((a) => (
      <ellipse key={a} cx="0" cy={-r * 0.85} rx={r * 0.55} ry={r} fill={t.soft} stroke={t.main} strokeWidth="1.2" transform={`rotate(${a})`} />
    ))}
    <circle r={r * 0.35} fill={t.gold} />
  </g>
);

const Corner = ({ t, flip }) => (
  <svg width="210" height="210" viewBox="0 0 210 210"
    style={{ position: 'absolute', ...(flip ? { right: 0, bottom: 0, transform: 'rotate(180deg)' } : { left: 0, top: 0 }) }}>
    <path d="M14 196 C 24 120, 84 56, 196 24" stroke={t.gold} strokeWidth="2" fill="none" />
    {[[38, 146, 20], [58, 110, 35], [88, 80, 50], [124, 56, 65], [160, 38, 75]].map(([x, y, a], i) => (
      <ellipse key={i} cx={x} cy={y} rx="7" ry="20" fill={t.main} opacity=".3" transform={`rotate(${a} ${x} ${y})`} />
    ))}
    <Flower x={64} y={78} r={17} t={t} />
    <Flower x={122} y={36} r={11} t={t} />
    <Flower x={34} y={128} r={9} t={t} />
  </svg>
);

export default function CardStudio({ defaultName = 'Chị Hồng Anh', defaultSender = 'Toàn thể anh em công ty kính chúc' }) {
  const cardRef = useRef(null);
  const [name, setName] = useState(defaultName);
  const [sender, setSender] = useState(defaultSender);
  const [photo, setPhoto] = useState(null);
  const [themeKey, setThemeKey] = useState('hong');
  const [wishIdx, setWishIdx] = useState(0);
  const [wishTitle, setWishTitle] = useState(ALL_WISHES[0].h);
  const [wishMsg, setWishMsg] = useState(ALL_WISHES[0].m);

  const [k, setK] = useState(1);
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const canShare = typeof navigator !== 'undefined' && !!navigator.share;
  const t = THEMES[themeKey];
  const nameSize = Math.max(28, Math.min(46, 46 - (name.length - 10) * 1.2)); // tên dài thì chữ nhỏ lại
  const initial = (name.trim().split(/\s+/).pop() || '♥')[0].toUpperCase();

  // Đồng bộ lại khi defaultName từ props thay đổi
  useEffect(() => {
    if (defaultName) setName(defaultName);
  }, [defaultName]);

  useEffect(() => {
    const f = () => setK(Math.min(1, (window.innerWidth - 32) / W));
    f();
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);

  // Đổi lời chúc: xoay vòng qua 50+ câu trong kho
  const handleNextWish = () => {
    const nextIdx = (wishIdx + 1) % ALL_WISHES.length;
    setWishIdx(nextIdx);
    setWishTitle(ALL_WISHES[nextIdx].h);
    setWishMsg(ALL_WISHES[nextIdx].m);
  };

  // Đọc ảnh -> cắt vuông (lệch về phía đầu) -> thu về tối đa 600px -> JPEG Base64.
  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // cho phép chọn lại đúng file cũ
    if (!file) return;
    const fail = () => setErr('Không đọc được ảnh này. Hãy thử ảnh JPG hoặc PNG khác.');
    const r = new FileReader();
    r.onerror = fail;
    r.onload = () => {
      const img = new Image();
      img.onerror = fail;
      img.onload = () => {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) * 0.25; // ảnh dọc: ưu tiên phần trên (mặt)
        const size = Math.min(600, side);
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; // ảnh PNG trong suốt không bị đen khi sang JPEG
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        setErr('');
        setPhoto(c.toDataURL('image/jpeg', 0.9));
      };
      img.src = r.result;
    };
    r.readAsDataURL(file);
  };

  const render = async () => {
    await document.fonts.ready; // đảm bảo font đã tải xong trước khi chụp
    return html2canvas(cardRef.current, {
      scale: 2, backgroundColor: t.bg, useCORS: true,
      onclone: (_, el) => { el.style.transform = 'none'; }, // bỏ scale xem trước khi xuất
    });
  };

  const run = async (fn) => {
    if (busy) return;
    setBusy(true); setErr('');
    try { await fn(); }
    catch (e) { if (e?.name !== 'AbortError') setErr('Xuất thiệp thất bại. Hãy thử lại hoặc chọn ảnh khác.'); }
    finally { setBusy(false); }
  };

  const download = () => run(async () => {
    const c = await render();
    const url = c.toDataURL('image/png');
    setOut(url);
    const a = document.createElement('a');
    a.href = url;
    const safeName = String(name || 'Nguoi_Dac_Biet').trim().replace(/\s+/g, '_');
    a.download = `thiep-20-10-${safeName}.png`;
    a.click();
  });

  const share = () => run(async () => {
    const c = await render();
    const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
    const safeName = String(name || 'Nguoi_Dac_Biet').trim().replace(/\s+/g, '_');
    const f = new File([blob], `thiep-20-10-${safeName}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [f] })) {
      await navigator.share({
        files: [f],
        title: 'Chúc mừng 20/10 🌸',
        text: `Mến tặng ${name} tấm thiệp tri ân 20/10 ngọt ngào! ❤️`
      });
    } else {
      setOut(c.toDataURL('image/png'));
    }
  });

  return (
    <div className="cs">
      <style>{CSS}</style>

      {/* KHUNG THIỆP XEM TRƯỚC VÀ XUẤT ẢNH 4:5 */}
      <div style={{ width: W * k, height: H * k, margin: '0 auto' }}>
        <div ref={cardRef} style={{
          width: W, height: H, background: t.bg, position: 'relative', overflow: 'hidden',
          transform: `scale(${k})`, transformOrigin: 'top left', boxSizing: 'border-box',
          fontFamily: '"Be Vietnam Pro", sans-serif', color: t.ink,
        }}>
          <div style={{ position: 'absolute', inset: 16, border: `1.5px solid ${t.gold}`, borderRadius: 20 }} />
          <Corner t={t} />
          <Corner t={t} flip />

          <div style={{ position: 'relative', height: '100%', padding: '60px 52px 50px', boxSizing: 'border-box',
            display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ fontSize: 13, letterSpacing: '0.18em', color: t.main, fontWeight: 600 }}>Chúc mừng ngày Phụ nữ Việt Nam</div>
            <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 38, fontWeight: 700, color: t.gold, lineHeight: 1.1, margin: '5px 0 18px' }}>20.10</div>

            {/* Khung ảnh chân dung / Monogram chữ cái đầu */}
            <div style={{ padding: 6, borderRadius: '50%', border: `2px solid ${t.gold}`, background: t.bg }}>
              <div style={{ width: 162, height: 162, borderRadius: '50%', overflow: 'hidden', background: t.soft,
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {photo
                  ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 88, color: t.main }}>{initial}</span>}
              </div>
            </div>

            {/* Tên người nhận (Tự co giãn font) */}
            <h1 style={{ fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontWeight: 700, fontSize: nameSize, whiteSpace: 'nowrap',
              lineHeight: 1.15, color: t.main, margin: '20px 0 12px' }}>{name || 'Người đặc biệt'}</h1>

            {/* Tiêu đề lời chúc */}
            <div style={{ fontFamily: '"Playfair Display", serif', fontSize: 19, fontWeight: 600, lineHeight: 1.35, marginBottom: 8, maxWidth: 390, wordBreak: 'break-word' }}>
              {wishTitle || 'Món quà từ trái tim'}
            </div>

            {/* Đoạn văn lời chúc */}
            <p style={{ fontSize: 14, lineHeight: 1.65, margin: 0, maxWidth: 380, opacity: 0.88, wordBreak: 'break-word' }}>
              {wishMsg || 'Gửi trọn những tình cảm chân thành và ngọt ngào nhất tới bạn!'}
            </p>

            {/* Người gửi tặng ở chân thiệp */}
            <div style={{ marginTop: 'auto', fontFamily: '"Playfair Display", serif', fontStyle: 'italic', fontSize: 15.5, color: t.main }}>
              {sender || 'Toàn thể anh em công ty kính chúc'}
            </div>
          </div>
        </div>
      </div>

      {/* BẢNG ĐIỀU KHIỂN STUDIO TẠO THIỆP */}
      <div className="panel">
        {/* 1. Tên người nhận & Người gửi */}
        <div className="input-group-row">
          <label>
            <span>Tên người nhận (Chị em, Mẹ, Vợ...):</span>
            <input value={name} maxLength={28} onChange={(e) => setName(e.target.value)} placeholder="Nhập tên người nhận..." />
          </label>
          <label>
            <span>Người gửi tặng:</span>
            <input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="Nhập tên người gửi..." />
          </label>
        </div>

        {/* 2. Tùy chỉnh Lời Chúc (Nhập tự do hoặc Đổi từ kho 50+ câu) */}
        <div className="wish-custom-box">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '700', color: '#1E293B' }}>
              ✍️ Tùy chỉnh Lời chúc (Nhập tự do hoặc rút thăm mẫu):
            </span>
            <button type="button" className="ghost mini-dice" onClick={handleNextWish} title="Rút câu chúc tiếp theo từ kho 50+ câu">
              <span>🎲 Đổi câu khác ({wishIdx + 1}/{ALL_WISHES.length})</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <input
              type="text"
              value={wishTitle}
              maxLength={60}
              onChange={(e) => setWishTitle(e.target.value)}
              placeholder="Tiêu đề lời chúc (VD: Mẹ là điều tuyệt vời nhất của con...)"
              className="wish-input-title"
            />
            <textarea
              value={wishMsg}
              rows={2}
              maxLength={190}
              onChange={(e) => setWishMsg(e.target.value)}
              placeholder="Nội dung lời chúc chi tiết (Gõ thoải mái tặng Mẹ, Vợ, Bạn gái...)"
              className="wish-input-body"
            />
          </div>
        </div>

        {/* 3. Chọn Màu & Tải Ảnh */}
        <div className="row theme-and-wishes">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '600', color: '#64748B' }}>Màu thiệp:</span>
            {Object.entries(THEMES).map(([key, v]) => (
              <button key={key} className={'sw' + (key === themeKey ? ' on' : '')} title={v.label}
                style={{ background: v.main }} onClick={() => setThemeKey(key)} aria-label={v.label} />
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label className="ghost file">
              <span>📷 {photo ? 'Đổi ảnh' : 'Thêm ảnh chân dung'}</span>
              <input type="file" accept="image/*" onChange={onFile} hidden />
            </label>
            {photo && <button className="ghost" onClick={() => setPhoto(null)}>✕ Gỡ ảnh</button>}
          </div>
        </div>

        {/* 4. Các nút Tải & Chia sẻ */}
        <div className="row cta-actions">
          <button className="main" onClick={download} disabled={busy}>
            <span>{busy ? 'Đang xuất ảnh 2x Retina... ⏳' : '📥 Tải thiệp về máy (1080×1350)'}</span>
          </button>
          {canShare && (
            <button className="main alt" onClick={share} disabled={busy}>
              <span>📲 Gửi qua Zalo / Facebook</span>
            </button>
          )}
        </div>

        {err && <p className="err" role="alert">{err}</p>}

        {out && (
          <div className="out">
            <p>🎉 Thiệp đã xuất sắc nét! Nếu máy không tự tải: hãy nhấn giữ vào ảnh bên dưới (trên điện thoại) hoặc chuột phải chọn "Lưu ảnh thành..." (trên máy tính).</p>
            <img src={out} alt="Thiệp 20/10 đã xuất" />
          </div>
        )}
      </div>
    </div>
  );
}

const CSS = `
.cs {
  font-family: "Be Vietnam Pro", sans-serif;
  padding: 16px;
  color: #3A1626;
  max-width: 680px;
  margin: 0 auto;
}
.panel {
  max-width: 540px;
  margin: 22px auto 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: rgba(255, 255, 255, 0.75);
  backdrop-filter: blur(14px);
  padding: 22px 24px;
  border-radius: 20px;
  border: 1px solid rgba(201, 166, 107, 0.35);
  box-shadow: 0 10px 30px rgba(0,0,0,0.06);
}
.input-group-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
@media (max-width: 520px) {
  .input-group-row {
    grid-template-columns: 1fr;
  }
}
.panel label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 13px;
  font-weight: 600;
  color: #475569;
}
.panel input:not([type=file]),
.wish-input-title,
.wish-input-body {
  padding: 10px 13px;
  border: 1.5px solid #E2E8F0;
  border-radius: 12px;
  font: inherit;
  font-size: 14px;
  background: #FFF;
  color: #1E293B;
  transition: border-color 0.2s;
  box-sizing: border-box;
  width: 100%;
}
.wish-input-body {
  resize: none;
  font-size: 13.5px;
  line-height: 1.5;
}
.panel input:focus,
.wish-input-title:focus,
.wish-input-body:focus {
  outline: none;
  border-color: #B23A5E;
}
.wish-custom-box {
  background: rgba(244, 63, 94, 0.04);
  border: 1px dashed rgba(201, 166, 107, 0.5);
  border-radius: 14px;
  padding: 12px 14px;
}
.mini-dice {
  padding: 5px 12px !important;
  font-size: 12.5px !important;
  background: #FFFDF8 !important;
  border-color: #C9A66B !important;
  color: #8C2F4B !important;
}
.row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}
.theme-and-wishes {
  justify-content: space-between;
  border-top: 1px dashed rgba(201, 166, 107, 0.3);
  padding-top: 12px;
}
.sw {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #cbd5e1;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}
.sw:hover {
  transform: scale(1.1);
}
.sw.on {
  box-shadow: 0 0 0 2.5px #B8914F;
  transform: scale(1.15);
}
.ghost {
  padding: 8px 14px;
  border: 1.5px solid #E2E8F0;
  border-radius: 12px;
  background: #fff;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s;
}
.ghost:hover {
  background: #F8FAFC;
  border-color: #CBD5E1;
}
.ghost.file {
  cursor: pointer;
}
.main {
  flex: 1;
  min-width: 200px;
  padding: 13px 20px;
  border: 0;
  border-radius: 14px;
  background: linear-gradient(135deg, #B23A5E 0%, #8C2F4B 100%);
  color: #fff;
  font: inherit;
  font-weight: 700;
  font-size: 15px;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(178, 58, 94, 0.3);
  transition: transform 0.2s, box-shadow 0.2s;
}
.main:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 22px rgba(178, 58, 94, 0.4);
}
.main.alt {
  background: linear-gradient(135deg, #2D1424 0%, #150A12 100%);
  box-shadow: 0 6px 18px rgba(0,0,0,0.25);
}
.main:disabled {
  opacity: .6;
  cursor: wait;
}
.err {
  color: #b3261e;
  font-size: 13px;
  margin: 0;
}
.out {
  border-top: 1px solid rgba(201, 166, 107, 0.4);
  padding-top: 14px;
}
.out img {
  width: 100%;
  border-radius: 16px;
  margin-top: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.12);
}
.out p {
  font-size: 13px;
  margin: 0;
  color: #15803d;
  font-weight: 500;
}
`;
