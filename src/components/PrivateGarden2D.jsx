import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { fetchPrivateWishes } from '../api.js';
import confetti from 'canvas-confetti';
import { playTruckHonkSound, playLetterOpenSound, playSoftTapSound } from '../utils/soundEffects.js';
import GardenScene, { BotanicalRose } from './GardenScene.jsx';
import './garden-scene.css';

/* ==========================================================
   COMPONENT CHÍNH: KHU VƯỜN 2D VỚI XE CHUYỂN THƯ TƯƠNG TÁC
   ========================================================== */
export default function PrivateGarden2D() {
  const { selectedSister, navigateWithFlowerTransition, experienceMode, updateExperienceMode } = useApp();
  const sisterName = selectedSister ? selectedSister.name : 'Chị Em Thân Thương';

  const [messages, setMessages] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all');
  const [readingMessage, setReadingMessage] = useState(null);
  const [isTruckStopped, setIsTruckStopped] = useState(false);
  const [truckHonked, setTruckHonked] = useState(false);
  const [isChestModalOpen, setIsChestModalOpen] = useState(false);

  // Tải danh sách thư riêng cá nhân hóa
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

  // Nhấn vào xe hoa: Dừng xe, nổ pháo hoa và BUNG MỞ KHO BƯU KIỆN
  const handleTruckClick = (e) => {
    if (e) e.stopPropagation();
    playTruckHonkSound();
    setIsTruckStopped(true);
    setTruckHonked(true);

    confetti({
      particleCount: 90,
      spread: 95,
      origin: { y: 0.62 },
      colors: ['#F43F5E', '#FDA4AF', '#FCD34D', '#FFF1F2', '#FECDD3', '#C084FC']
    });

    setTimeout(() => {
      setTruckHonked(false);
      setIsChestModalOpen(true);
      playLetterOpenSound();
    }, 450);
  };

  const handleOpenChest = () => {
    playLetterOpenSound();
    setIsTruckStopped(true);
    setIsChestModalOpen(true);
  };

  const handleCloseChest = () => {
    playSoftTapSound();
    setIsChestModalOpen(false);
  };

  const filteredMessages = messages.filter((msg) => {
    if (activeFilter === 'all') return true;
    return msg.type === activeFilter;
  });

  const wingedCount = messages.filter(m => m.type === 'winged_letter').length;
  const heartCount = messages.filter(m => m.type === 'heart').length;

  return (
    <div className="garden-2d-screen">
      {/* Tiêu đề & Giới thiệu đậm chất 20/10 */}
      <div className="garden-2d-header">
        <div className="garden-honor-badge">
          <span>👑</span> Mừng Ngày Phụ Nữ Việt Nam 20/10 • Khu Vườn Tri Ân Phái Đẹp 🌹
        </div>
        <h2 className="garden-2d-title">
          Khu Vườn Tri Ân 20.10 &amp; Chuyến Xe Hoa Cổ Điển
        </h2>
        <p className="garden-2d-sub">
          Chuyến xe hoa hoàng gia chở đầy hoa hồng nhung và bưu kiện tình cảm đang dừng tại Vọng Lâu để trao tận tay{' '}
          <strong className="garden-sister-highlight">{sisterName}</strong>{' '}
          những cánh thư tri ân và trái tim ấm áp từ anh em TechCorp!
        </p>

        {/* Chuyển đổi chế độ Demo 2D <-> 3D */}
        <div className="garden-demo-switcher">
          <span className="demo-pill-tag">✨ Đang xem: Bản 2D Cổ Tích</span>
          <button
            onClick={() => updateExperienceMode('3d')}
            className="btn-switch-3d"
            title="Chuyển sang bản 3D Three.js hoàng hôn"
          >
            <span>🚀 Chuyển sang Bản 3D Điện Ảnh (Three.js) →</span>
          </button>
        </div>
      </div>

      {/* KHUNG CẢNH TOÀN CẢNH DIORAMA KÍCH THƯỚC LỚN HOÀNH TRÁNG */}
      <div className="garden-diorama-wrapper">
        <div className="garden-diorama">
          {/* Lớp nền phong cảnh tự nhiên SVG & Vọng lâu tri ân */}
          <GardenScene sisterName={sisterName} />

          {/* Thanh trên cùng của Diorama */}
          <div className="diorama-top-bar">
            <div className="station-badge">
              <span className="station-dot"></span>
              <span className="station-title">Trạm Dừng: TechCorp 20.10 Floral Pavilion</span>
            </div>

            <button onClick={handleOpenChest} className="btn-station-truck" title="Mở kho bưu kiện thư 20.10">
              <span>🚚 Mở Hòm Bưu Phẩm ({messages.length})</span>
            </button>
          </div>

          {/* Con đường hoa uốn lượn màu hồng phấn */}
          <div className="garden-road">
            <div className="road-line"></div>
          </div>

          {/* CHIẾC XE HOA CỔ ĐIỂN HOÀNG GIA CHUYỂN ĐỘNG TRÊN ĐƯỜNG */}
          <div className="truck-lane">
            <div
              className={`mail-truck ${isTruckStopped ? 'stopped' : 'driving'}`}
              onClick={handleTruckClick}
              title="Chạm vào xe để đỗ lại và mở kho bưu kiện 20.10!"
            >
              <div className="exhaust-puffs">💖 🌸 🕊️</div>
              <div className="truck-bounce">
                <svg viewBox="0 0 260 135" className="truck-svg" style={{ overflow: 'visible' }}>
                  <defs>
                    <linearGradient id="gs-headlight-beam" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0.8" />
                      <stop offset="35%" stopColor="#FDE68A" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#FDE68A" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="gs-car-crimson" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#BE123C" />
                      <stop offset="45%" stopColor="#8C2F4B" />
                      <stop offset="100%" stopColor="#5E162B" />
                    </linearGradient>
                    <linearGradient id="gs-chrome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FFFFFF" />
                      <stop offset="35%" stopColor="#E5C388" />
                      <stop offset="70%" stopColor="#C9A66B" />
                      <stop offset="100%" stopColor="#784E1A" />
                    </linearGradient>
                    <linearGradient id="gs-wood" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#854D0E" />
                      <stop offset="50%" stopColor="#A16207" />
                      <stop offset="100%" stopColor="#713F12" />
                    </linearGradient>
                    <radialGradient id="gs-car-shadow" cx="0.4" cy="0.5" r="0.5">
                      <stop offset="0%" stopColor="rgba(30, 11, 24, 0.45)" />
                      <stop offset="100%" stopColor="rgba(30, 11, 24, 0)" />
                    </radialGradient>
                  </defs>

                  {/* Bóng đổ của xe kéo dài sang trái (chiều ngược lại của ánh nắng) */}
                  <ellipse cx="115" cy="126" rx="125" ry="9" fill="url(#gs-car-shadow)" />

                  {/* Luồng ánh sáng đèn pha chiếu về phía trước trên đường */}
                  <polygon points="218,92 360,65 360,135 218,106" fill="url(#gs-headlight-beam)" opacity="0.6" style={{ mixBlendMode: 'screen' }} />

                  {/* THÙNG HÀNG XE BẰNG GỖ VINTAGE CHỞ ĐẦY HOA & BƯU KIỆN */}
                  <rect x="22" y="42" width="116" height="52" rx="8" fill="url(#gs-wood)" stroke="#522C0A" strokeWidth="1.5" />
                  <rect x="25" y="45" width="110" height="12" rx="3" fill="#A16207" opacity="0.4" />
                  <rect x="25" y="60" width="110" height="12" rx="3" fill="#A16207" opacity="0.4" />
                  <rect x="25" y="75" width="110" height="15" rx="3" fill="#A16207" opacity="0.4" />
                  <circle cx="30" cy="49" r="1.5" fill="#FDE68A" />
                  <circle cx="130" cy="49" r="1.5" fill="#FDE68A" />
                  <circle cx="30" cy="65" r="1.5" fill="#FDE68A" />
                  <circle cx="130" cy="65" r="1.5" fill="#FDE68A" />

                  {/* Biển hiệu đồng mạ vàng bên sườn xe */}
                  <rect x="32" y="58" width="96" height="22" rx="6" fill="#8C2F4B" stroke="#E5C388" strokeWidth="1.2" />
                  <text x="80" y="69" fontFamily="'Playfair Display', serif" fontSize="7" fontWeight="bold" fill="#FFFBEB" textAnchor="middle" letterSpacing="0.8">TECHCORP COURIER</text>
                  <text x="80" y="76.5" fontFamily="'Be Vietnam Pro', sans-serif" fontSize="5.2" fontWeight="bold" fill="#FDE68A" textAnchor="middle" letterSpacing="0.5">💌 CHUYẾN XE 20/10 💌</text>

                  {/* HỘP BƯU PHẨM & PHONG THƯ CỘT DÂY LỤA TRÊN THÙNG XE */}
                  <g transform="translate(32, 24)">
                    <rect x="8" y="4" width="24" height="18" rx="2" fill="#FAF3EA" stroke="#C9A66B" strokeWidth="1" />
                    <line x1="20" y1="4" x2="20" y2="22" stroke="#8C2F4B" strokeWidth="2.5" />
                    <line x1="8" y1="13" x2="32" y2="13" stroke="#8C2F4B" strokeWidth="2.5" />
                    <circle cx="20" cy="4" r="3" fill="#BE123C" />
                    <rect x="36" y="6" width="24" height="16" rx="2" fill="#FFF9F5" stroke="#FDA4AF" strokeWidth="1" transform="rotate(-6 36 6)" />
                    <circle cx="47" cy="13" r="3.2" fill="#8C2F4B" />
                  </g>

                  {/* DẢI RUY BĂNG LỤA HOÀNG GIA BAY PHẤP PHỚI PHÍA SAU XE */}
                  <path d="M18,34 Q-6,22 -26,35 Q-12,45 12,40 Z" fill="#E5C388" stroke="#C9A66B" strokeWidth="0.8" opacity="0.9" />
                  <path d="M16,36 Q-12,42 -30,55 Q-16,60 10,46 Z" fill="#8C2F4B" opacity="0.85" />

                  {/* CỐP HOA BOTANICAL ROSES TẤP NẬP, DÀY ĐẶC VÀ NGẬP TRÀN SẮC HOA */}
                  {/* Lớp lá xanh ngọc & dây thường xuân rủ xuống thành xe */}
                  <g className="cargo-ivy">
                    <path d="M22,46 Q16,60 12,72" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" />
                    <path d="M38,48 Q32,64 36,76" fill="none" stroke="#15803D" strokeWidth="2.2" strokeLinecap="round" />
                    <path d="M126,48 Q134,62 130,75" fill="none" stroke="#166534" strokeWidth="2" strokeLinecap="round" />
                    <circle cx="12" cy="72" r="3" fill="#4ADE80" />
                    <circle cx="36" cy="76" r="3.5" fill="#22C55E" />
                    <circle cx="130" cy="75" r="3" fill="#4ADE80" />
                  </g>

                  {/* HOA BABY TRẮNG LI TI (GYPSOPHILA) ĐAN XEN GIỮA CÁC ĐÓA HỒNG */}
                  <g className="cargo-baby-breath">
                    {[
                      [24, 18], [38, 12], [54, 10], [68, 8], [84, 11], [100, 14], [116, 20], [130, 26],
                      [18, 30], [32, 24], [48, 22], [62, 18], [78, 20], [94, 24], [110, 28], [128, 34],
                    ].map(([gx, gy], i) => (
                      <g key={`bb-${i}`}>
                        <circle cx={gx} cy={gy} r="1.8" fill="#FFFFFF" />
                        <circle cx={gx + 2} cy={gy - 2} r="1.3" fill="#FFFBEB" />
                        <circle cx={gx - 2} cy={gy + 2} r="1.2" fill="#FEF3C7" />
                      </g>
                    ))}
                  </g>

                  {/* HƠN 22 ĐÓA HOA HỒNG BOTANICAL ROSES CHÂN THỰC TẦNG TẦNG LỚP LỚP */}
                  {/* Tầng 1: Hàng hoa phía sau nhô cao vượt thành xe */}
                  <BotanicalRose x={28} y={15} s={1.1} pal="crimson" rot={-15} />
                  <BotanicalRose x={46} y={10} s={1.2} pal="ruby" rot={12} />
                  <BotanicalRose x={64} y={7} s={1.25} pal="champagne" rot={-5} />
                  <BotanicalRose x={82} y={9} s={1.2} pal="crimson" rot={18} />
                  <BotanicalRose x={100} y={12} s={1.15} pal="blush" rot={-10} />
                  <BotanicalRose x={118} y={17} s={1.1} pal="cream" rot={16} />
                  <BotanicalRose x={132} y={24} s={0.95} pal="ruby" rot={-22} />

                  {/* Tầng 2: Hàng hoa ở giữa sum suê, rực rỡ */}
                  <BotanicalRose x={20} y={25} s={1.15} pal="blush" rot={-24} />
                  <BotanicalRose x={38} y={21} s={1.25} pal="crimson" rot={6} />
                  <BotanicalRose x={55} y={18} s={1.3} pal="ruby" rot={-14} />
                  <BotanicalRose x={73} y={17} s={1.25} pal="champagne" rot={15} />
                  <BotanicalRose x={91} y={20} s={1.2} pal="crimson" rot={-8} />
                  <BotanicalRose x={108} y={23} s={1.15} pal="blush" rot={12} />
                  <BotanicalRose x={125} y={30} s={1.05} pal="ruby" rot={-16} />

                  {/* Tầng 3: Hàng hoa phía trước tràn trĩu ra ngoài thành xe */}
                  <BotanicalRose x={15} y={36} s={1.05} pal="ruby" rot={-32} />
                  <BotanicalRose x={30} y={33} s={1.2} pal="crimson" rot={10} />
                  <BotanicalRose x={48} y={29} s={1.25} pal="champagne" rot={-8} />
                  <BotanicalRose x={66} y={28} s={1.3} pal="crimson" rot={16} />
                  <BotanicalRose x={84} y={29} s={1.2} pal="blush" rot={-15} />
                  <BotanicalRose x={102} y={32} s={1.15} pal="ruby" rot={8} />
                  <BotanicalRose x={120} y={37} s={1.05} pal="cream" rot={-12} />
                  <BotanicalRose x={136} y={40} s={0.95} pal="crimson" rot={24} />

                  {/* CABIN ĐẦU XE VINTAGE QUÝ TỘC */}
                  <path d="M42,94 C42,66 94,66 94,94 L84,94 C84,74 52,74 52,94 Z" fill="url(#gs-car-crimson)" stroke="#C9A66B" strokeWidth="1.2" />

                  <path d="M130,42 L150,42 C162,42 178,54 186,68 L220,74 C228,75 234,82 234,90 L234,98 L130,98 Z" fill="url(#gs-car-crimson)" />
                  <path d="M152,46 L174,46 C182,46 190,56 195,68 L158,68 Z" fill="#E0F2FE" opacity="0.85" stroke="#FFFFFF" strokeWidth="1" />
                  <line x1="164" y1="48" x2="182" y2="66" stroke="#FFFFFF" strokeWidth="2" opacity="0.75" />

                  <circle cx="170" cy="62" r="5" fill="none" stroke="#A16207" strokeWidth="1.8" />
                  <line x1="170" y1="62" x2="170" y2="67" stroke="#A16207" strokeWidth="1.5" />

                  <path d="M186,68 L224,74 C232,75 238,82 238,90 L238,98 L186,98 Z" fill="url(#gs-car-crimson)" stroke="#C9A66B" strokeWidth="1" />
                  <line x1="186" y1="74" x2="236" y2="80" stroke="#E5C388" strokeWidth="1.5" />

                  <path d="M176,96 C176,68 230,68 236,96 L226,96 C220,76 186,76 186,96 Z" fill="url(#gs-car-crimson)" stroke="#C9A66B" strokeWidth="1.2" />

                  {/* Lưới tản nhiệt cổ điển Chrome mạ vàng */}
                  <path d="M234,78 L244,82 L244,104 L234,104 Z" fill="url(#gs-chrome)" stroke="#784E1A" strokeWidth="1" />
                  <line x1="237" y1="84" x2="237" y2="102" stroke="#522C0A" strokeWidth="0.8" />
                  <line x1="240" y1="86" x2="240" y2="102" stroke="#522C0A" strokeWidth="0.8" />

                  {/* Tượng hoa hồng vàng trên mũi xe */}
                  <circle cx="242" cy="80" r="3" fill="#FDE68A" stroke="#C9A66B" strokeWidth="0.8" />
                  <path d="M242,77 L244,73 L241,75 L238,73 Z" fill="#FDE68A" />

                  {/* Đèn pha tròn mạ crom sáng rực */}
                  <circle cx="230" cy="88" r="9" fill="url(#gs-chrome)" stroke="#C9A66B" strokeWidth="1.2" />
                  <circle cx="230" cy="88" r="7" fill="#FFFBEB" />
                  <circle cx="230" cy="88" r="4.5" fill="#FEF08A" />
                  <circle cx="232" cy="86" r="2" fill="#FFFFFF" />

                  {/* Cản trước kim loại sáng bóng */}
                  <rect x="238" y="104" width="8" height="12" rx="3" fill="url(#gs-chrome)" stroke="#784E1A" strokeWidth="1" />
                  <path d="M242,98 L244,116" stroke="url(#gs-chrome)" strokeWidth="3" strokeLinecap="round" />

                  {/* Biển số xe mạ vàng 20.10: 20-10 • FOR HER */}
                  <g transform="translate(228, 108)">
                    <rect x="-8" y="0" width="22" height="9" rx="2" fill="#FAF3EA" stroke="#C9A66B" strokeWidth="1" />
                    <text x="3" y="6.8" fontFamily="'Playfair Display', serif" fontSize="4.6" fontWeight="bold" fill="#8C2F4B" textAnchor="middle" letterSpacing="0.4">
                      20.10
                    </text>
                  </g>

                  {/* Kèn đồng bưu điện vintage gắn cạnh cửa sổ */}
                  <path d="M152,66 C144,66 140,60 144,56 L154,60 Z" fill="#C9A66B" />
                  <circle cx="140" cy="58" r="3.5" fill="#FDE68A" stroke="#C9A66B" strokeWidth="0.8" />

                  {/* BÁNH XE SAU NAN HOA CỔ ĐIỂN VỚI VIỀN TRẮNG HOÀNG GIA (VỊ TRÍ CHUẨN XÁC TRONG HỐC BÁNH) */}
                  <g transform="translate(68, 98)">
                    {/* Lốp xe đen quý tộc */}
                    <circle cx="0" cy="0" r="21" fill="#200E19" stroke="#12060E" strokeWidth="2" />
                    {/* Viền trắng cổ điển (White-wall tire) */}
                    <circle cx="0" cy="0" r="15" fill="#FFF9F5" stroke="#C9A66B" strokeWidth="0.8" />
                    {/* Mâm xe mạ vàng Champagne Chrome */}
                    <circle cx="0" cy="0" r="9.5" fill="url(#gs-chrome)" stroke="#C9A66B" strokeWidth="1.2" />
                    {/* Nan hoa xoay tròn nhẹ nhàng quanh tâm */}
                    <g>
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 0 0"
                        to="360 0 0"
                        dur="0.85s"
                        repeatCount="indefinite"
                      />
                      {[0, 45, 90, 135].map(deg => (
                        <line key={deg} x1="-8.5" y1="0" x2="8.5" y2="0" stroke="#C9A66B" strokeWidth="1" transform={`rotate(${deg})`} />
                      ))}
                    </g>
                    {/* Trục bánh xe đính đá ruby sang trọng */}
                    <circle cx="0" cy="0" r="4" fill="#8C2F4B" stroke="#FDE68A" strokeWidth="0.8" />
                  </g>

                  {/* BÁNH XE TRƯỚC NAN HOA CỔ ĐIỂN (VỊ TRÍ CHUẨN XÁC TRONG HỐC BÁNH TRƯỚC) */}
                  <g transform="translate(202, 98)">
                    {/* Lốp xe đen quý tộc */}
                    <circle cx="0" cy="0" r="21" fill="#200E19" stroke="#12060E" strokeWidth="2" />
                    {/* Viền trắng cổ điển (White-wall tire) */}
                    <circle cx="0" cy="0" r="15" fill="#FFF9F5" stroke="#C9A66B" strokeWidth="0.8" />
                    {/* Mâm xe mạ vàng Champagne Chrome */}
                    <circle cx="0" cy="0" r="9.5" fill="url(#gs-chrome)" stroke="#C9A66B" strokeWidth="1.2" />
                    {/* Nan hoa xoay tròn nhẹ nhàng quanh tâm */}
                    <g>
                      <animateTransform
                        attributeName="transform"
                        type="rotate"
                        from="0 0 0"
                        to="360 0 0"
                        dur="0.85s"
                        repeatCount="indefinite"
                      />
                      {[0, 45, 90, 135].map(deg => (
                        <line key={deg} x1="-8.5" y1="0" x2="8.5" y2="0" stroke="#C9A66B" strokeWidth="1" transform={`rotate(${deg})`} />
                      ))}
                    </g>
                    {/* Trục bánh xe đính đá ruby sang trọng */}
                    <circle cx="0" cy="0" r="4" fill="#8C2F4B" stroke="#FDE68A" strokeWidth="0.8" />
                  </g>
                </svg>

                {/* Bong bóng gợi ý tương tác gắn liền với chiếc xe hoa */}
                <div className="truck-bubble">
                  {truckHonked ? '🎉 Bíp bíp! Đã dừng xe trao bưu kiện 20/10!' : '💌 Chạm vào xe nhận bưu kiện 20/10!'}
                </div>
              </div>
            </div>
          </div>

          {/* Dải thông tin dưới chân Diorama */}
          <div className="diorama-bottom-status">
            <div className="status-pill">
              📮 Hòm bưu phẩm: <strong>{messages.length} bức thư riêng dành cho {sisterName}</strong>
            </div>
            <div className="status-hint">
              ✨ Chạm trực tiếp vào xe hoa để mở hòm bưu kiện
            </div>
          </div>
        </div>
      </div>

      {/* THANH HÀNH ĐỘNG & NÚT BẤM TO DƯỚI DIORAMA (KHÔNG LỘ THƯ TRỰC TIẾP) */}
      <div className="garden-cta-bar">
        <button onClick={handleTruckClick} className="btn-open-truck-vault">
          <span>🚚 Bấm Vào Xe Hoa Hoặc Tại Đây Để Mở Bưu Kiện 20/10 ({messages.length})</span>
          <span style={{ fontSize: '1.3rem' }}>✨</span>
        </button>

        {/* Physical Gift Reminder */}
        <div className="gift-reminder-box" style={{ width: '100%', marginTop: '12px' }}>
          <div className="reminder-icon">🎁</div>
          <div className="reminder-text">
            <strong>Món Quà Tinh Thần Đích Thực:</strong> Bên cạnh những cánh thư bưu điện ấm áp này, các món quà hiện vật xinh xắn từ anh em công ty đang được chuẩn bị trao tặng tận tay chị em tại sảnh văn phòng vào{' '}
            <span className="highlight-time">15:30 ngày 20/10</span>!
          </div>
        </div>

        {/* Nút điều hướng màn tiếp theo */}
        <div className="garden-bottom-actions" style={{ marginTop: '16px' }}>
          <button
            onClick={() => navigateWithFlowerTransition('/balloons')}
            className="btn-rose"
            style={{ background: '#FFF', color: 'var(--rose-700)', border: '1.5px solid var(--rose-300)' }}
          >
            <span>← Bầu Trời Bóng Bay 🎈</span>
          </button>

          <button
            onClick={() => navigateWithFlowerTransition('/video')}
            className="btn-rose"
          >
            <span>Tiếp tục: Video &amp; Slideshow Tri Ân 🎬 →</span>
          </button>
        </div>
      </div>

      {/* ==========================================================
          MODAL 1: KHO BƯU KIỆN CHUYẾN XE HOA (BUNG MỞ KHI ẤN VÀO XE)
          ========================================================== */}
      {isChestModalOpen && !readingMessage && (
        <div className="parcel-chest-overlay" onClick={handleCloseChest}>
          <div className="parcel-chest-box" onClick={(e) => e.stopPropagation()}>
            {/* Header Modal */}
            <div className="parcel-chest-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '2.4rem' }}>🚚</span>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', color: 'var(--rose-900)', margin: 0, fontWeight: '700' }}>
                    Kho Bưu Kiện Của Chuyến Xe Hoa 20/10
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.85rem', color: 'var(--rose-600)' }}>
                    Chuyến xe bưu điện đã dừng trạm • Dành riêng gửi tặng <strong>{sisterName}</strong>
                  </p>
                </div>
              </div>

              <button
                onClick={handleCloseChest}
                style={{
                  background: 'var(--rose-100)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  cursor: 'pointer',
                  fontSize: '1.1rem',
                  color: 'var(--rose-800)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.2s'
                }}
                title="Đóng hòm thư"
              >
                ✕
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="parcel-chest-filter">
              <button
                className={`fairy-tab-btn ${activeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setActiveFilter('all')}
              >
                ✨ Tất cả bưu phẩm ({messages.length})
              </button>
              <button
                className={`fairy-tab-btn ${activeFilter === 'winged_letter' ? 'active' : ''}`}
                onClick={() => setActiveFilter('winged_letter')}
              >
                🕊️ Thư có cánh ({wingedCount})
              </button>
              <button
                className={`fairy-tab-btn ${activeFilter === 'heart' ? 'active' : ''}`}
                onClick={() => setActiveFilter('heart')}
              >
                💖 Trái tim bí mật ({heartCount})
              </button>
            </div>

            {/* Grid of Winged & Heart Letters inside the Chest */}
            <div className="parcel-chest-body">
              {filteredMessages.map((msg, idx) => {
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
                    {/* SVG Fluttering Wings */}
                    <svg className="mini-wing left" viewBox="0 0 100 100" width="34" height="34" fill="#fda4af" aria-hidden="true">
                      <path d="M90,70 C70,20 20,20 10,60 C20,50 40,60 50,70 C30,70 20,80 15,90 C35,85 60,85 90,70 Z" />
                    </svg>
                    <svg className="mini-wing right" viewBox="0 0 100 100" width="34" height="34" fill="#fda4af" aria-hidden="true">
                      <path d="M90,70 C70,20 20,20 10,60 C20,50 40,60 50,70 C30,70 20,80 15,90 C35,85 60,85 90,70 Z" />
                    </svg>

                    <div className="winged-card-content">
                      <div className={`card-icon-slot ${isHeart ? 'purple-grad' : 'rose-grad'}`}>
                        <span className="heart-card-icon">{isHeart ? '💖' : '🕊️'}</span>
                      </div>

                      <span className="winged-card-badge">
                        {msg.badge || (isHeart ? '💖 Trái Tim Tri Ân' : '🕊️ Cánh Thư May Mắn')}
                      </span>

                      <h4 className="winged-card-title">
                        {msg.title || (isHeart ? 'Lời Nhắn Trái Tim' : 'Thư Tay Gửi Bạn')}
                      </h4>

                      <span className="winged-card-sender">
                        Từ: {msg.from_name || 'Đồng nghiệp giấu tên'}
                      </span>

                      <p className="winged-card-snippet">
                        "{msg.text || 'Gửi trọn tình cảm tri ân chân thành nhất tới bạn...'}"
                      </p>

                      <div className="winged-card-action">
                        <span>Chạm để mở đọc thư</span>
                        <span className="action-arrow">→</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Modal */}
            <div className="parcel-chest-footer">
              <span style={{ fontSize: '0.85rem', color: 'var(--rose-700)' }}>
                💡 Chọn từng phong thư để mở con dấu sáp và đọc lời chúc trọn vẹn
              </span>

              <button
                onClick={handleCloseChest}
                className="btn-rose"
                style={{ padding: '8px 20px', fontSize: '0.88rem' }}
              >
                <span>🌿 Quay lại ngắm vườn hoa &amp; xe thư</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================
          MODAL 2: ROYAL PARCHMENT LETTER (ĐỌC THƯ CHI TIẾT CÓ DẤU SÁP)
          ========================================================== */}
      {readingMessage && (
        <div className="modal-overlay open" onClick={() => setReadingMessage(null)}>
          <div className="royal-parchment-box" onClick={(e) => e.stopPropagation()}>
            {/* Wax seal */}
            <div className="parchment-wax-seal">20.10</div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
              <span style={{ fontSize: '2.5rem' }}>{readingMessage.type === 'heart' ? '💖' : '🕊️'}</span>
              <div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: 'var(--rose-400)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: '700' }}>
                  {readingMessage.badge || 'Lời Nhắn Gửi Chân Tình'}
                </span>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.45rem', color: 'var(--rose-900)', fontWeight: '700', margin: 0 }}>
                  Thư Gửi Riêng {sisterName}
                </h3>
              </div>
            </div>

            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', color: 'var(--rose-800)', fontStyle: 'italic', marginBottom: '12px' }}>
              {readingMessage.title || 'Món Quà Tinh Thần Ý Nghĩa'}
            </h2>

            <div style={{ background: 'rgba(244, 63, 94, 0.06)', borderLeft: '4px solid var(--rose-500)', borderRadius: '16px', padding: '22px 24px', margin: '20px 0' }}>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: '1.05rem', lineHeight: '1.8', color: '#1E293B', fontStyle: 'italic', margin: 0 }}>
                "{readingMessage.text}"
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '0.8rem', color: '#64748B', display: 'block' }}>Người gửi:</span>
                <strong style={{ fontFamily: 'var(--font-serif)', fontSize: '1rem', color: 'var(--rose-900)' }}>
                  {readingMessage.from_name || 'Một người đồng nghiệp giấu tên'}
                </strong>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => {
                    setReadingMessage(null);
                    setIsChestModalOpen(true);
                  }}
                  className="btn-rose"
                  style={{ padding: '10px 18px', fontSize: '0.88rem', background: '#FFF', color: 'var(--rose-700)', border: '1.5px solid var(--rose-300)' }}
                >
                  <span>← Chọn thư khác</span>
                </button>

                <button
                  onClick={() => {
                    setReadingMessage(null);
                    setIsChestModalOpen(false);
                  }}
                  className="btn-rose"
                  style={{ padding: '10px 22px', fontSize: '0.88rem' }}
                >
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