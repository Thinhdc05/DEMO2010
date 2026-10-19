import React, { useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';
import confetti from 'canvas-confetti';
import { playPopSound } from '../utils/soundEffects.js';

export default function BalloonsPage() {
  const { wishes, openedBalloons, popBalloon, setIsArchiveOpen, navigateWithFlowerTransition } = useApp();
  const canvasRef = useRef(null);
  const activeBalloonsRef = useRef([]);

  // Bảng màu bóng bay Hồng ngát pastel & Champagne ngọt ngào cho bóng lời chúc
  const sweetBalloonPalettes = [
    { main: '#F43F5E', light: '#FDA4AF', gold: '#FDE68A' },
    { main: '#FB7185', light: '#FECDD3', gold: '#FFFBEB' },
    { main: '#E11D48', light: '#FDA4AF', gold: '#FCD34D' },
    { main: '#D97706', light: '#FDE68A', gold: '#FFFBEB' },
    { main: '#A855F7', light: '#F3E8FF', gold: '#FDE68A' },
    { main: '#EC4899', light: '#FCE7F3', gold: '#FFFBEB' },
    { main: '#10B981', light: '#D1FAE5', gold: '#FEF3C7' }
  ];

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let w = (canvas.width = canvas.parentElement.clientWidth);
    let h = (canvas.height = canvas.parentElement.clientHeight);

    const handleResize = () => {
      if (!canvas.parentElement) return;
      w = canvas.width = canvas.parentElement.clientWidth;
      h = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // 1. Bóng lời chúc thật (1 bóng = 1 lời chúc chưa mở)
    const unpopped = wishes.filter(w => !openedBalloons.has(w.id));
    const wishBalloons = unpopped.map((wish, idx) => {
      const radius = Math.min(40, Math.max(28, w / 23));
      const palette = sweetBalloonPalettes[idx % sweetBalloonPalettes.length];
      return {
        id: `wish_${wish.id}`,
        isDecor: false,
        wish,
        radius,
        x: Math.random() * (w - radius * 3) + radius * 1.5,
        y: h + (idx * 30) + Math.random() * 85,
        speedY: Math.random() * 0.85 + 0.8,
        palette,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.02 + 0.014,
        wobbleAmp: Math.random() * 1.3 + 0.7,
        sparkleTimer: Math.random() * 100
      };
    });

    // 2. 10 bóng trắng ngọc trai & 10 bóng đen bóng (bóng đệm lãng mạn)
    const decorBalloons = [];
    for (let i = 0; i < 10; i++) {
      const radius = Math.min(36, Math.max(26, w / 25));
      decorBalloons.push({
        id: `decor_white_${i}`,
        isDecor: true,
        decorColor: 'white',
        radius,
        x: Math.random() * (w - radius * 3) + radius * 1.5,
        y: h + Math.random() * (h * 1.2),
        speedY: Math.random() * 0.8 + 0.75,
        palette: { main: '#FFFFFF', light: '#F8FAFC', base: '#E2E8F0' },
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.02 + 0.014,
        wobbleAmp: Math.random() * 1.2 + 0.7,
        sparkleTimer: Math.random() * 100
      });
    }
    for (let i = 0; i < 10; i++) {
      const radius = Math.min(36, Math.max(26, w / 25));
      decorBalloons.push({
        id: `decor_black_${i}`,
        isDecor: true,
        decorColor: 'black',
        radius,
        x: Math.random() * (w - radius * 3) + radius * 1.5,
        y: h + Math.random() * (h * 1.2),
        speedY: Math.random() * 0.8 + 0.75,
        palette: { main: '#1A1A1A', light: '#4B5563', base: '#0A0A0A' },
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: Math.random() * 0.02 + 0.014,
        wobbleAmp: Math.random() * 1.2 + 0.7,
        sparkleTimer: Math.random() * 100
      });
    }

    activeBalloonsRef.current = [...wishBalloons, ...decorBalloons];

    let animId;
    function render() {
      ctx.clearRect(0, 0, w, h);

      activeBalloonsRef.current.forEach(b => {
        b.y -= b.speedY;
        b.wobble += b.wobbleSpeed;
        b.sparkleTimer += 0.05;
        const currentX = b.x + Math.sin(b.wobble) * b.wobbleAmp * 12;

        if (b.y < -b.radius * 2.5) {
          b.y = h + b.radius * 2 + Math.random() * 45;
          b.x = Math.random() * (w - b.radius * 3) + b.radius * 1.5;
        }

        const x = currentX;
        const y = b.y;
        const r = b.radius;

        ctx.save();

        // 1. Dải ruy băng lụa mềm mại
        ctx.strokeStyle = b.isDecor
          ? (b.decorColor === 'black' ? '#D4AF37' : '#E2E8F0')
          : '#FDA4AF';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, y + r);
        ctx.bezierCurveTo(x - 6, y + r + 15, x + 8, y + r + 28, x - 3, y + r + 42);
        ctx.stroke();

        // 2. Nơ buộc bóng vàng kim
        ctx.fillStyle = '#F59E0B';
        ctx.beginPath();
        ctx.ellipse(x - 4, y + r + 3, 4.5, 2.2, -0.3, 0, Math.PI * 2);
        ctx.ellipse(x + 4, y + r + 3, 4.5, 2.2, 0.3, 0, Math.PI * 2);
        ctx.fill();

        // 3. Nút thắt bóng
        ctx.fillStyle = b.palette.main;
        ctx.beginPath();
        ctx.moveTo(x - 5, y + r);
        ctx.lineTo(x + 5, y + r);
        ctx.lineTo(x, y + r + 5);
        ctx.closePath();
        ctx.fill();

        if (b.isDecor) {
          if (b.decorColor === 'black') {
            // Bóng đen bóng (Glossy Black) cực sang trọng
            const balloonGrad = ctx.createRadialGradient(
              x - r * 0.35, y - r * 0.35, r * 0.08,
              x, y, r
            );
            balloonGrad.addColorStop(0, '#6B7280');
            balloonGrad.addColorStop(0.2, '#374151');
            balloonGrad.addColorStop(0.6, '#1F2937');
            balloonGrad.addColorStop(0.9, '#111827');
            balloonGrad.addColorStop(1, '#050505');

            ctx.fillStyle = balloonGrad;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.38)';
            ctx.lineWidth = 1.6;
            ctx.stroke();

            // Phản quang bóng loáng sắc nét
            ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
            ctx.beginPath();
            ctx.ellipse(x - r * 0.35, y - r * 0.35, r * 0.32, r * 0.16, -Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
          } else {
            // Bóng trắng ngọc trai (Glossy White Pearl)
            const balloonGrad = ctx.createRadialGradient(
              x - r * 0.35, y - r * 0.35, r * 0.08,
              x, y, r
            );
            balloonGrad.addColorStop(0, '#FFFFFF');
            balloonGrad.addColorStop(0.35, '#F8FAFC');
            balloonGrad.addColorStop(0.85, '#E2E8F0');
            balloonGrad.addColorStop(1, '#CBD5E1');

            ctx.fillStyle = balloonGrad;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.lineWidth = 1.8;
            ctx.stroke();

            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.beginPath();
            ctx.ellipse(x - r * 0.35, y - r * 0.35, r * 0.32, r * 0.16, -Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
          }
        } else {
          // 4. Thân bóng hình giọt ngọc 3D lộng lẫy (cho bóng lời chúc)
          const balloonGrad = ctx.createRadialGradient(
            x - r * 0.35, y - r * 0.35, r * 0.1,
            x, y, r
          );
          balloonGrad.addColorStop(0, '#FFFFFF');
          balloonGrad.addColorStop(0.25, b.palette.light);
          balloonGrad.addColorStop(0.85, b.palette.main);
          balloonGrad.addColorStop(1, '#9F1239');

          ctx.fillStyle = balloonGrad;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();

          // 5. Viền phản quang
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
          ctx.lineWidth = 1.8;
          ctx.stroke();

          // 6. Ánh sáng phản chiếu bóng loáng (Crystal Sheen)
          ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.beginPath();
          ctx.ellipse(x - r * 0.35, y - r * 0.35, r * 0.3, r * 0.15, -Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();

          // 7. Tên người gửi trên bóng (chỉ có ở bóng lời chúc)
          ctx.font = '700 11.5px "Be Vietnam Pro", sans-serif';
          ctx.fillStyle = '#FFFFFF';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
          ctx.shadowBlur = 4;

          const senderRaw = (b.wish && (b.wish.from_name || b.wish.name || b.wish.sender)) || 'Tech';
          const shortName = String(senderRaw).trim().split(' ').slice(-1)[0] || '20.10';
          ctx.fillText(shortName, x, y + 2);
        }

        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    }

    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [wishes]);

  // Khi có lời chúc được mở từ Modal hoặc Drawer, lọc bỏ bóng lời chúc tương ứng mà KHÔNG xóa bóng decor
  useEffect(() => {
    activeBalloonsRef.current = activeBalloonsRef.current.filter(b => b.isDecor || !openedBalloons.has(b.wish?.id));
  }, [openedBalloons]);

  const handleCanvasClick = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const clickedIdx = activeBalloonsRef.current.findIndex(b => {
      const currentX = b.x + Math.sin(b.wobble) * b.wobbleAmp * 12;
      return Math.hypot(currentX - clickX, b.y - clickY) <= b.radius + 10;
    });

    if (clickedIdx !== -1) {
      const balloon = activeBalloonsRef.current[clickedIdx];
      activeBalloonsRef.current.splice(clickedIdx, 1);

      const screenX = e.clientX / window.innerWidth;
      const screenY = e.clientY / window.innerHeight;

      if (balloon.isDecor) {
        // Bóng trắng/đen: chỉ nổ pháo giấy kim tuyến + tiếng pop, không mở modal
        playPopSound();
        confetti({
          particleCount: 40,
          spread: 70,
          origin: { x: screenX, y: screenY },
          colors: balloon.decorColor === 'black'
            ? ['#262626', '#4B5563', '#D4AF37', '#FFFFFF']
            : ['#FFFFFF', '#FDE68A', '#FDA4AF', '#FFF1F2']
        });
      } else {
        popBalloon(balloon.wish, { x: screenX, y: screenY });
      }
    }
  };

  const handleRandomPop = () => {
    const wishBalloons = activeBalloonsRef.current.filter(b => !b.isDecor);
    if (wishBalloons.length === 0) {
      alert('Chị em đã khám phá hết những lời chúc rồi! Cùng bước tiếp sang Chuyến Xe Thư nhé! 🌸');
      return;
    }
    const randIdx = Math.floor(Math.random() * wishBalloons.length);
    const balloon = wishBalloons[randIdx];

    const realIdx = activeBalloonsRef.current.indexOf(balloon);
    if (realIdx !== -1) {
      activeBalloonsRef.current.splice(realIdx, 1);
    }

    const canvas = canvasRef.current;
    const rect = canvas ? canvas.getBoundingClientRect() : { left: 0, top: 0 };
    const currentX = balloon.x + Math.sin(balloon.wobble) * balloon.wobbleAmp * 12;
    const screenX = (rect.left + currentX) / window.innerWidth;
    const screenY = (rect.top + balloon.y) / window.innerHeight;

    popBalloon(balloon.wish, { x: screenX, y: screenY });
  };

  return (
    <div className="page-screen" id="page-balloons">
      <div className="balloons-screen-container">
        {/* Header Bầu Trời */}
        <div className="sky-header">
          <div className="sky-eyebrow">
            FLOATING BALLOONS SKY • 20.10
          </div>
          <h2 className="sky-title">Bầu Trời Lời Chúc Ngọt Ngào</h2>
          <p className="sky-sub">
            Những quả bóng bay chở đầy yêu thương liên tục bay lên ngập tràn bầu trời. Chạm vào bất kỳ quả bóng nào để đón nhận lời chúc từ anh em! 🎈
          </p>
        </div>

        {/* Khung Bầu Trời Hoàng Hôn Pastel */}
        <div className="sky-viewport">
          {/* Floating Controls HUD */}
          <div className="sky-hud">
            <div className="hud-counter-badge">
              Đã mở: <strong>{openedBalloons.size}</strong> / {wishes.length} lời chúc
            </div>
            <div className="hud-buttons">
              <button onClick={handleRandomPop} className="pill-btn" title="Mở ngẫu nhiên">
                <span>🎲 Mở ngẫu nhiên</span>
              </button>
              <button onClick={() => setIsArchiveOpen(true)} className="pill-btn" title="Xem danh sách">
                <span>📜 Danh sách lời chúc</span>
              </button>
            </div>
          </div>

          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            id="balloons-physics-canvas"
          />
        </div>

        {/* Nút Chuyển Màn Tiếp Theo Sang Xe Hoa */}
        <div style={{ marginTop: '28px', textAlign: 'center' }}>
          <button
            onClick={() => navigateWithFlowerTransition('/private')}
            className="btn-golden-rose"
          >
            <span>Bước Tiếp Theo: Chuyến Xe Thư Tri Ân 20/10 🌸</span>
          </button>
        </div>
      </div>
    </div>
  );
}


