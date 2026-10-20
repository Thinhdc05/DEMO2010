import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import confetti from 'canvas-confetti';
import IdentitySelector from '../components/IdentitySelector.jsx';

export default function GiftPage() {
  const { 
    selectedSister, 
    navigateWithFlowerTransition, 
    experienceMode, 
    updateExperienceMode 
  } = useApp();
  const [isLidOpened, setIsLidOpened] = useState(false);
  const [showWelcomeChoice, setShowWelcomeChoice] = useState(false);

  const [requireNameNotice, setRequireNameNotice] = useState(false);

  // Pre-load 3D chunk ngầm khi người dùng ở trang chủ để khi bấm 3D là mở tức thì 0s delay
  React.useEffect(() => {
    const timer = setTimeout(() => {
      import('./World3DExperience.jsx').catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  // Khi chọn tên chị em: xóa thông báo nhắc nhở, nhưng KHÔNG tự nhảy modal 2D/3D
  // Hộp quà bên dưới sẽ tự phát quang hào quang (aura) để dẫn dắt chị em chạm mở!
  const lastSelectedIdRef = React.useRef(selectedSister?.id);
  React.useEffect(() => {
    if (selectedSister && selectedSister.id !== lastSelectedIdRef.current) {
      lastSelectedIdRef.current = selectedSister.id;
      setRequireNameNotice(false);
      // KHÔNG tự động mở modal lựa chọn ở đây nữa
    }
  }, [selectedSister]);

  const handleOpenGift = () => {
    // BUỘC PHẢI CHỌN TÊN CHỊ EM MỚI ĐƯỢC MỞ
    if (!selectedSister) {
      setRequireNameNotice(true);
      const selBox = document.querySelector('.identity-selector-box');
      if (selBox) {
        selBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
        selBox.classList.add('identity-shake-highlight');
        setTimeout(() => selBox.classList.remove('identity-shake-highlight'), 1000);
      }
      return;
    }

    // Nếu đã mở nắp rồi thì mở lại modal chọn trải nghiệm
    if (isLidOpened) {
      setShowWelcomeChoice(true);
      return;
    }

    setIsLidOpened(true);

    // Bắn pháo hoa cánh hoa tung bay ngọt ngào khi nắp bật mở
    confetti({
      particleCount: 120,
      spread: 100,
      origin: { y: 0.58 },
      colors: ['#F43F5E', '#FDA4AF', '#FCD34D', '#FFF1F2', '#FECDD3', '#FB7185']
    });

    // Sau khi nắp hộp mở ra 550ms, hiện modal chào mừng trang trọng hỏi chọn 3D hay 2D
    setTimeout(() => {
      setShowWelcomeChoice(true);
    }, 550);
  };

  return (
    <div className="page-screen" id="page-gift">
      <div className="gift-page-container">
        {/* Badge Header */}
        <div className="gift-honor-badge">
          <span className="crown">👑</span>
          <span>
            {selectedSister 
              ? `Món Quà Riêng Tặng: Chị ${selectedSister.name}` 
              : 'Chào Mừng Ngày Phụ Nữ Việt Nam 20/10'}
          </span>
          <span>🌸</span>
        </div>

        {/* Tiêu đề chính */}
        <h1 className="gift-hero-title">
          Món Quà Ngọt Ngào Dành Tặng Bạn 🎁
        </h1>
        <p className="gift-hero-sub">
          Có một chiếc hộp bí mật chứa đựng những đóa hoa tươi thắm và lời chúc chân thành nhất từ toàn thể anh em công ty gửi đến bạn...
        </p>

        {/* BỘ CHỌN TÊN CHỊ EM (ĐẶT NGAY ĐẦU TRANG, TRỰC QUAN & RÕ RÀNG) */}
        <IdentitySelector onOpenGift={handleOpenGift} />

        {/* Lời nhắc bắt buộc chọn tên nếu bấm mở quà trước khi chọn */}
        {requireNameNotice && !selectedSister && (
          <div className="gift-require-name-alert">
            <span className="alert-icon">🌸</span>
            <span className="alert-text">
              Chị ơi, hãy chọn tên của mình ở danh sách phía trên để mở món quà bí mật này nhé!
            </span>
          </div>
        )}

        {/* Hào quang gợi ý chạm mở sau khi đã chọn tên chị em */}
        {selectedSister && !isLidOpened && (
          <div className="gift-aura-callout-badge" onClick={handleOpenGift}>
            <span className="badge-sparkle">✨</span>
            <span>Món quà dành riêng cho Chị {selectedSister.name} đã sẵn sàng! Chạm để mở</span>
            <span className="badge-sparkle">✨</span>
          </div>
        )}

        {/* HỘP QUÀ HỒNG PHẤN 3D NƠ VÀNG CHAMPAGNE (CÓ HÀO QUANG AURA PHÁT QUANG) */}
        <div
          className={`sweet-gift-wrapper ${isLidOpened ? 'box-is-open' : 'gift-wobble-anim'} ${selectedSister && !isLidOpened ? 'gift-aura-glowing' : ''}`}
          onClick={handleOpenGift}
          title={selectedSister ? `Chạm để mở món quà của Chị ${selectedSister.name}!` : "Vui lòng chọn tên chị em ở trên trước"}
        >
          <svg className="sweet-gift-svg" viewBox="0 0 240 240" fill="none">
            <defs>
              {/* Bóng đổ */}
              <ellipse id="boxShadow" cx="120" cy="222" rx="82" ry="15" fill="#F43F5E" opacity="0.22" />

              {/* Thân hộp màu hồng phấn pastel cao cấp */}
              <linearGradient id="sweetBoxGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDA4AF" />
                <stop offset="40%" stopColor="#FB7185" />
                <stop offset="100%" stopColor="#E11D48" />
              </linearGradient>

              {/* Nắp hộp */}
              <linearGradient id="sweetLidGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFF1F2" />
                <stop offset="35%" stopColor="#FDA4AF" />
                <stop offset="100%" stopColor="#F43F5E" />
              </linearGradient>

              {/* Ruy băng vàng champagne */}
              <linearGradient id="sweetGoldRibbon" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FFFBEB" />
                <stop offset="30%" stopColor="#FDE68A" />
                <stop offset="70%" stopColor="#C9A66B" />
                <stop offset="100%" stopColor="#B45309" />
              </linearGradient>
            </defs>

            {/* Bóng đổ dưới đáy */}
            <use href="#boxShadow" />

            {/* THÂN HỘP */}
            <rect x="48" y="98" width="144" height="116" rx="18" fill="url(#sweetBoxGrad)" />
            {/* Vệt sáng mép trái thân hộp */}
            <path d="M 50 112 L 50 200" stroke="#FFF" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />
            
            {/* Ruy băng vàng dọc thân */}
            <rect x="108" y="98" width="24" height="116" fill="url(#sweetGoldRibbon)" />
            <rect x="118" y="98" width="4" height="116" fill="#FFF" opacity="0.6" />

            {/* Ruy băng vàng ngang thân */}
            <rect x="48" y="148" width="144" height="22" fill="url(#sweetGoldRibbon)" />
            <rect x="48" y="157" width="144" height="4" fill="#FFF" opacity="0.5" />

            {/* NẮP HỘP VÀ NƠ VÀNG (BẬT MỞ KHI CLICK) */}
            <g className="sweet-gift-lid">
              {/* Vành nắp hộp */}
              <rect x="38" y="78" width="164" height="30" rx="9" fill="url(#sweetLidGrad)" stroke="#FDA4AF" strokeWidth="1.5" />
              <line x1="40" y1="82" x2="200" y2="82" stroke="#FFF" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />

              {/* Ruy băng trên nắp */}
              <rect x="108" y="78" width="24" height="30" fill="url(#sweetGoldRibbon)" />
              <rect x="118" y="78" width="4" height="30" fill="#FFF" opacity="0.7" />

              {/* NƠ BƯỚM VÀNG CHAMPAGNE ĐA TẦNG */}
              {/* Cánh nơ trái */}
              <path
                d="M 120 80 C 95 40 55 46 68 70 C 78 84 105 80 120 80 Z"
                fill="url(#sweetGoldRibbon)"
                stroke="#C9A66B"
                strokeWidth="1.2"
              />
              <path
                d="M 118 78 C 100 48 72 52 82 70 C 90 78 110 78 118 78 Z"
                fill="#FFFBEB"
                opacity="0.6"
              />

              {/* Cánh nơ phải */}
              <path
                d="M 120 80 C 145 40 185 46 172 70 C 162 84 135 80 120 80 Z"
                fill="url(#sweetGoldRibbon)"
                stroke="#C9A66B"
                strokeWidth="1.2"
              />
              <path
                d="M 122 78 C 140 48 168 52 158 70 C 150 78 130 78 122 78 Z"
                fill="#FFFBEB"
                opacity="0.6"
              />

              {/* Đuôi nơ rủ xuống */}
              <path d="M 114 82 Q 88 102 96 122 Q 104 108 118 84 Z" fill="url(#sweetGoldRibbon)" />
              <path d="M 126 82 Q 152 102 144 122 Q 136 108 122 84 Z" fill="url(#sweetGoldRibbon)" />

              {/* Nút thắt nơ trung tâm */}
              <circle cx="120" cy="80" r="10" fill="url(#sweetGoldRibbon)" stroke="#B45309" strokeWidth="1" />
              <circle cx="120" cy="80" r="5" fill="#E11D48" />
              <circle cx="118" cy="78" r="2" fill="#FFF" opacity="0.8" />
            </g>
          </svg>
        </div>

        {/* Nút Mở Hộp Quà */}
        <div style={{ marginBottom: '28px' }}>
          <button
            onClick={handleOpenGift}
            className={`btn-rose ${selectedSister && !isLidOpened ? 'btn-pulse-glow' : ''}`}
            style={{ fontSize: '1.08rem' }}
          >
            <span>{selectedSister ? `Mở Hộp Quà Chị ${selectedSister.name} 🌸` : 'Mở Hộp Quà Ngay 🌸'}</span>
          </button>
        </div>
      </div>

      {/* [P1] MODAL CHÀO MỪNG ĐỊNH HƯỚNG 3D VS 2D KHI VỪA CHỌN TÊN */}
      {showWelcomeChoice && selectedSister && (
        <div className="modal-overlay open" onClick={() => setShowWelcomeChoice(false)}>
          <div className="onboarding-welcome-modal" onClick={(e) => e.stopPropagation()}>
            <div className="onboarding-modal-wax-seal">20.10</div>
            <div className="onboarding-badge">🌸 CHÀO MỪNG ĐÓA HOA RẠNG RỠ</div>
            <h2 className="onboarding-title">
              Chào Mừng Chị <strong>{selectedSister.name}</strong>! 💖
            </h2>
            <p className="onboarding-desc">
              Toàn thể anh em FE Team đã chuẩn bị không gian tri ân riêng dành tặng chị. Chị muốn bắt đầu khám phá qua trải nghiệm nào?
            </p>

            <div className="onboarding-choices">
              <button
                type="button"
                className="btn-onboarding-choice primary-3d-highlight"
                onClick={() => {
                  setShowWelcomeChoice(false);
                  updateExperienceMode('3d', '/3d');
                }}
              >
                <div className="choice-icon-wrap">✨</div>
                <div className="choice-text-wrap">
                  <div className="choice-title">
                    Vương Quốc 3D Điện Ảnh <span className="recommended-tag">Khuyên Dùng</span>
                  </div>
                  <div className="choice-sub">
                    Dạo bước hoàng hôn 3D • Xe hoa cổ điển • Bầu trời pháo hoa & bóng bay
                  </div>
                </div>
                <span className="choice-arrow">➔</span>
              </button>

              <button
                type="button"
                className="btn-onboarding-choice secondary-2d"
                onClick={() => {
                  setShowWelcomeChoice(false);
                  updateExperienceMode('2d', '/letter');
                }}
              >
                <div className="choice-icon-wrap">💌</div>
                <div className="choice-text-wrap">
                  <div className="choice-title">Tạp Chí 2D Cổ Tích</div>
                  <div className="choice-sub">
                    Thiệp bifold mở rộng • Con dấu sáp đỏ • Suối hoa nhẹ nhàng
                  </div>
                </div>
                <span className="choice-arrow">➔</span>
              </button>
            </div>

            <button
              type="button"
              className="onboarding-close-text"
              onClick={() => setShowWelcomeChoice(false)}
            >
              Tôi muốn ở lại trang này tự khám phá
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


