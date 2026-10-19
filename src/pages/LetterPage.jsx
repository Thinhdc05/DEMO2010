import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import FloralWreathBorder from '../components/FloralWreathBorder.jsx';
import ArtisticSignatureCard from '../components/ArtisticSignatureCard.jsx';
import defaultSisterPhoto from '../assets/images.jpg';
import { getRandomCardWish } from '../api.js';

export default function LetterPage() {
  const { selectedSister, navigateWithFlowerTransition } = useApp();
  const [cardWish] = useState(() => getRandomCardWish());
  const [imageError, setImageError] = useState(false);

  // Thông tin chị em được vinh danh (ưu tiên dữ liệu từ context)
  const sisterName = selectedSister ? selectedSister.name : 'Bạn';
  const roleText = (selectedSister && (selectedSister.role || selectedSister.dept)) || 'PHÁI ĐẸP TECHCORP';
  
  // Kiểm tra ảnh chân dung: Nếu có ảnh & consent & không lỗi -> dùng ảnh thật; Nếu thiếu -> fallback thẻ chữ ký nghệ thuật!
  const hasExplicitPhoto = Boolean(selectedSister && selectedSister.photo && selectedSister.has_consent !== false);
  const photoUrl = hasExplicitPhoto
    ? selectedSister.photo
    : (!selectedSister ? defaultSisterPhoto : '');
  const hasValidPhoto = Boolean(photoUrl && !imageError);

  // Câu quote vinh danh ấm áp
  const sisterQuote = selectedSister?.quote || '“Nụ cười của bạn là ánh sáng của cả văn phòng”';

  return (
    <div className="page-screen letter-page-screen" id="page-letter">
      {/* KHÔNG GIAN BỐI CẢNH HOÀNG GIA: TẤM THIỆP ĐÔI 3D ĐANG MỞ RỘNG */}
      <div className="bifold-scene-container">
        <div className="bifold-booklet">
          {/* CON DẤU SÁP HOÀNG GIA 20.10 ĐÍNH TRANG TRỌNG TRÊN GÁY THIỆP */}
          <div className="royal-wax-seal" title="Dấu sáp niêm phong hoàng gia 20/10">
            <span className="wax-number">20.10</span>
          </div>

          {/* =========================================================
              TRANG BÊN TRÁI (LEFT PAGE): KHUNG ẢNH CHÂN DUNG & THÔNG TIN BÊN DƯỚI
              ========================================================= */}
          <div className="bifold-page bifold-page-left">
            <div className="page-inner-content">
              {/* Dải danh xưng kiêu sa trên đầu trang */}
              <div className="muse-crown-ribbon">
                👑 NÀNG THƠ TECHCORP
              </div>

              {/* KHUNG ẢNH CHÂN DUNG BỌC GIÀN HOA BOTANICAL UỐN LƯỢN */}
              <div className="portrait-botanical-wrapper">
                {/* GIÀN CÀNH HOA UỐN LƯỢN CỰC ĐẸP BỌC XUNG QUANH */}
                <FloralWreathBorder />

                {/* KHUNG ẢNH CHÂN DUNG THỰC TẾ HOẶC THẺ CHỮ KÝ NGHỆ THUẬT FALLBACK */}
                <div className="portrait-display-frame">
                  {hasValidPhoto ? (
                    <>
                      <img
                        src={photoUrl}
                        alt={sisterName}
                        className="portrait-display-img"
                        onError={() => setImageError(true)}
                      />
                      {/* Viền sáng bóng kính mờ nhẹ */}
                      <div className="portrait-glass-shine"></div>
                    </>
                  ) : (
                    <ArtisticSignatureCard
                      name={sisterName}
                      customQuote="Luôn xinh đẹp, hạnh phúc và tỏa sáng theo cách riêng của mình! 💕"
                    />
                  )}
                </div>
              </div>

              {/* KHỐI THÔNG TIN VINH DANH: ĐẶT BÊN DƯỚI ẢNH (BÊN NGOÀI ẢNH) */}
              <div className="portrait-below-details">
                {/* Tag chức danh màu đỏ nhung viền vàng */}
                <div className="portrait-badge-role">
                  {roleText}
                </div>

                {/* Tên chị em to, sắc nét, màu đỏ rượu vang quý phái */}
                <h2 className="portrait-full-name">
                  {sisterName}
                </h2>

                {/* Câu trích dẫn tri ân ngọt ngào */}
                <p className="portrait-quote-italic">
                  {sisterQuote}
                </p>
              </div>
            </div>
          </div>

          {/* ĐƯỜNG NẾP GẤP VÀ BÓNG ĐỔ SÂU 3D Ở GÁY THIỆP (CARD CREASE DEPTH SHADOW) */}
          <div className="bifold-crease-divider">
            <div className="crease-shadow-left"></div>
            <div className="crease-center-line"></div>
            <div className="crease-shadow-right"></div>
          </div>

          {/* =========================================================
              TRANG BÊN PHẢI (RIGHT PAGE): BỨC THƯ TRI ÂN VIẾT TAY TỪ CÁNH NAM IT
              ========================================================= */}
          <div className="bifold-page bifold-page-right">
            <div className="page-inner-content letter-reading-area">
              {/* Dòng đề mục nhỏ */}
              <div className="letter-eyebrow-accent">
                <span className="eyebrow-dash"></span>
                <span>THƯ TRI ÂN CHUNG TỪ CÁNH NAM IT</span>
                <span className="eyebrow-dash"></span>
              </div>

              {/* Tiêu đề chính trang trọng */}
              <h1 className="letter-honor-title">
                Gửi {sisterName} — Người Phụ Nữ Tuyệt Vời!
              </h1>

              {/* Thư viết tay trên nền giấy da ngà viền chỉ vàng */}
              <div className="parchment-text-card">
                <p className="parchment-lead" style={{ fontStyle: 'italic', color: '#881337', fontSize: '1.2rem', lineHeight: '1.85', marginBottom: '16px', fontWeight: '600' }}>
                  “{cardWish.highlight || cardWish}”
                </p>

                <p className="parchment-body" style={{ fontSize: '1.02rem', lineHeight: '1.8', color: '#334155' }}>
                  {cardWish.message || 'Cảm ơn bạn vì sự nhiệt tình, những nỗ lực và nguồn năng lượng tích cực mà bạn mang đến cho mọi người. Nhân ngày 20/10, chúc bạn luôn được yêu thương, gặp thật nhiều may mắn, công việc thuận lợi và cuộc sống ngập tràn niềm vui. Chúc bạn mãi xinh đẹp, hạnh phúc và luôn tỏa sáng theo cách riêng của mình! 💗'}
                </p>
              </div>

              {/* Lời chúc kết & Chữ ký trang trọng */}
              <div className="letter-bottom-sign">
                <div className="letter-warm-sparkle">
                  Chúc bạn mãi tự tin và toả sáng! 💐
                </div>
                <div className="letter-gentlemen-sign">
                  — Toàn thể anh em Tech &amp; Product
                </div>
              </div>

              {/* Nút hành động đến Bầu Trời Bóng Bay */}
              <div className="letter-next-action">
                <button
                  onClick={() => navigateWithFlowerTransition('/balloons')}
                  className="btn-golden-rose"
                  id="btn-goto-balloons"
                  title="Đến màn Bầu trời bóng bay chứa hàng chục lời chúc chân thành"
                >
                  <span>Đến Bầu Trời Bóng Bay Lời Chúc 🎈</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
