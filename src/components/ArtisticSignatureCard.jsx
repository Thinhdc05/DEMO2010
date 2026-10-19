import React from 'react';

/**
 * Thẻ Chúc Mừng Nghệ Thuật "Hồng Nhung & Vòng Hoa Vàng Hoàng Gia"
 * Tích hợp vòng tròn vàng hoàng kim, giàn hoa đào/hoa hồng Botanical ôm tròn hai bên,
 * chữ thư pháp Pinyon Script lộng lẫy và cánh hoa rơi lãng mạn.
 */
export default function ArtisticSignatureCard({
  name = 'Bạn',
  customQuote = '',
  className = ''
}) {
  const displayName = name.replace(/^(Chị\s+|Em\s+)/i, '').trim() || 'Bạn';
  const wishText = customQuote || 'Chúc bạn luôn vui vẻ, rạng rỡ và ngập tràn hạnh phúc!';

  return (
    <div className={`signature-art-card ${className}`}>
      {/* 4 Hoa văn góc hoàng gia */}
      <i className="card-corner-arc c1" />
      <i className="card-corner-arc c2" />
      <i className="card-corner-arc c3" />
      <i className="card-corner-arc c4" />

      {/* Cánh hoa hồng rơi tự nhiên */}
      <i className="card-floating-petal p1" />
      <i className="card-floating-petal p2" />
      <i className="card-floating-petal p3" />
      <i className="card-floating-petal p4" />
      <i className="card-floating-petal p5" />
      <i className="card-floating-petal p6" />
      <i className="card-floating-petal p7" />

      {/* Vòng tròn vàng kim (Golden Metallic Ring) */}
      <div className="card-golden-ring" />

      {/* Cành hoa đào/hoa hồng Botanical ôm tròn 2 bên vòng tròn */}
      <svg className="card-floral-svg" viewBox="0 0 1448 1086" aria-hidden="true">
        <defs>
          <linearGradient id="sig-pg" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="-46">
            <stop offset="0" stopColor="#e8527f" />
            <stop offset="0.3" stopColor="#f4a0b8" />
            <stop offset="0.75" stopColor="#fbd3de" />
            <stop offset="1" stopColor="#fef0f3" />
          </linearGradient>

          <linearGradient id="sig-lg" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#9aa070" />
            <stop offset="1" stopColor="#cfd0a3" />
          </linearGradient>

          <filter id="sig-wc2" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="5" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="7" />
            <feGaussianBlur stdDeviation="0.6" />
          </filter>

          <filter id="sig-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2" />
            <feColorMatrix values="0 0 0 0 .55  0 0 0 0 .3  0 0 0 0 .3  0 0 0 .5 0" />
          </filter>

          {/* Cánh hoa lẻ */}
          <g id="sig-petal">
            <path
              d="M0,0 C-24,-6 -32,-36 -11,-47 L0,-39 L11,-47 C32,-36 24,-6 0,0Z"
              fill="url(#sig-pg)"
              stroke="#e46d93"
              strokeOpacity="0.45"
              strokeWidth="0.7"
            />
            <path
              d="M0,-4 L0,-30 M0,-4 L-8,-28 M0,-4 L8,-28"
              stroke="#d94d7d"
              strokeOpacity="0.3"
              strokeWidth="0.6"
              fill="none"
            />
            <path
              d="M-9,-38 C-4,-44 4,-44 9,-38 C4,-41 -4,-41 -9,-38Z"
              fill="#fff"
              opacity="0.5"
            />
          </g>

          {/* Bông hoa anh đào nở rộ (5 cánh kèm nhụy) */}
          <g id="sig-blossom">
            <use href="#sig-petal" transform="rotate(0)" />
            <use href="#sig-petal" transform="rotate(72)" />
            <use href="#sig-petal" transform="rotate(144)" />
            <use href="#sig-petal" transform="rotate(216)" />
            <use href="#sig-petal" transform="rotate(288)" />
            <circle r="5" fill="#e0537f" opacity="0.85" />
            {[-70, -48, -26, -6, 14, 34, 56, 78, 100, -92].map((deg, i) => (
              <g key={i} transform={`rotate(${deg})`}>
                <path d="M0,-3 Q1,-8.5 0,-17" stroke="#c2416f" strokeWidth="0.7" fill="none" />
                <circle cy="-17" r="1.7" fill="#d4467c" />
              </g>
            ))}
            <circle r="2.2" fill="#a8305c" />
          </g>

          {/* Búp hoa */}
          <g id="sig-bud">
            <path d="M0,0 C-6,-6 -6,-17 0,-24 C6,-17 6,-6 0,0Z" fill="#ee7a9c" />
            <path d="M-1,-8 C-3,-13 -2,-18 0,-21 C-4,-17 -4,-11 -1,-8Z" fill="#fbb8ca" opacity="0.8" />
            <path d="M0,0 C-4,-3 -5,-8 -4,-11 L0,-8 L4,-11 C5,-8 4,-3 0,0Z" fill="#9ea46f" />
          </g>

          {/* Chiếc lá xanh nhạt */}
          <g id="sig-leaf">
            <path
              d="M0,0 C12,-13 34,-15 48,0 C34,13 12,13 0,0Z"
              fill="url(#sig-lg)"
              stroke="#8a9160"
              strokeOpacity="0.5"
              strokeWidth="0.6"
            />
            <path d="M2,0 L44,0" stroke="#7d8556" strokeOpacity="0.6" strokeWidth="0.7" />
          </g>

          {/* Nhánh hoa lớn ôm trọn cung tròn bên trái */}
          <g id="sig-floralL">
            {/* Thân cây gỗ uốn lượn theo cung tròn */}
            <path
              d="M520,946 C510,941 481,931 463,921 C445,911 426,899 410,886 C394,872 379,857 366,841 C353,824 342,805 334,786 C325,768 318,747 313,727 C308,707 305,686 302,666 C300,646 299,626 298,606 C298,586 298,566 298,546 C299,526 299,506 301,486 C302,466 304,446 308,426 C312,406 316,385 323,365 C330,346 344,318 349,308"
              stroke="#8a6a55"
              strokeWidth="7"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M520,946 C510,941 481,931 463,921 C445,911 426,899 410,886 C394,872 379,857 366,841 C353,824 342,805 334,786 C325,768 318,747 313,727 C308,707 305,686 302,666 C300,646 299,626 298,606 C298,586 298,566 298,546 C299,526 299,506 301,486 C302,466 304,446 308,426 C312,406 316,385 323,365 C330,346 344,318 349,308"
              stroke="#b9987d"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              opacity="0.6"
              transform="translate(-1.5,-1)"
            />

            {/* Các cành phụ */}
            <path d="M309,712 Q322,700 341,701" stroke="#8a6a55" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M298,546 Q286,538 269,545" stroke="#8a6a55" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M387,864 Q411,841 433,823" stroke="#8a6a55" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M312,403 Q322,410 347,416" stroke="#8a6a55" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M334,786 Q313,792 310,800" stroke="#8a6a55" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M299,628 Q264,625 244,637" stroke="#8a6a55" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M302,471 Q306,478 313,474" stroke="#8a6a55" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M325,358 Q310,349 309,349" stroke="#8a6a55" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M349,308 Q358,321 363,317" stroke="#8a6a55" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M449,913 Q457,903 462,896" stroke="#8a6a55" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M301,651 Q342,636 366,637" stroke="#8a6a55" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M300,494 Q323,493 333,499" stroke="#8a6a55" strokeWidth="3.2" fill="none" strokeLinecap="round" />
            <path d="M477,928 Q467,926 470,938" stroke="#8a6a55" strokeWidth="3.2" fill="none" strokeLinecap="round" />

            {/* Những chiếc lá */}
            <use href="#sig-leaf" transform="translate(449,913) rotate(120) scale(1.7)" />
            <use href="#sig-leaf" transform="translate(300,636) rotate(200) scale(1.6)" />
            <use href="#sig-leaf" transform="translate(327,772) rotate(95) scale(1.3)" />
            <use href="#sig-leaf" transform="translate(320,373) rotate(240) scale(1.3)" />
            <use href="#sig-leaf" transform="translate(298,591) rotate(335) scale(1.2)" />
            <use href="#sig-leaf" transform="translate(366,841) rotate(150) scale(1.1)" />

            {/* Búp hoa non */}
            <use href="#sig-bud" transform="translate(310,800) rotate(240) scale(1.5)" />
            <use href="#sig-bud" transform="translate(244,637) rotate(261) scale(1.4)" />
            <use href="#sig-bud" transform="translate(313,474) rotate(102) scale(1.4)" />
            <use href="#sig-bud" transform="translate(309,349) rotate(-63) scale(1.6)" />
            <use href="#sig-bud" transform="translate(363,317) rotate(124) scale(1.5)" />
            <use href="#sig-bud" transform="translate(462,896) rotate(38) scale(1.3)" />
            <use href="#sig-bud" transform="translate(366,637) rotate(78) scale(1.2)" />
            <use href="#sig-bud" transform="translate(333,499) rotate(99) scale(1.1)" />
            <use href="#sig-bud" transform="translate(470,938) rotate(214) scale(1.2)" />

            {/* 4 Đóa hoa bung nở */}
            <g filter="url(#sig-wc2)">
              <use href="#sig-blossom" transform="translate(347,416) rotate(25) scale(0.75)" />
              <use href="#sig-blossom" transform="translate(433,823) rotate(40) scale(0.95)" />
              <use href="#sig-blossom" transform="translate(269,545) rotate(-20) scale(1.05)" />
              <use href="#sig-blossom" transform="translate(341,701) rotate(12) scale(1.6)" />
            </g>
          </g>
        </defs>

        {/* Lớp hạt mờ nghệ thuật nhẹ */}
        <rect width="1448" height="1086" filter="url(#sig-grain)" opacity="0.12" />

        {/* 2 Nhánh hoa ôm lấy hai bên của vòng tròn (trái & phải đối xứng) */}
        <g style={{ filter: 'drop-shadow(0 4px 8px rgba(190,80,110,.2))' }}>
          <use href="#sig-floralL" />
          <use href="#sig-floralL" transform="translate(1448,0) scale(-1,1)" />
        </g>
      </svg>

      {/* Nội dung trang nhã đặt ở trung tâm vòng tròn */}
      <div className="card-center-content">
        <div className="card-top-eyebrow">
          WITH LOVE · 20.10
        </div>

        <h1 className="card-calligraphy-name">
          {displayName}
          <span className="card-name-heart">♡</span>
        </h1>

        <div className="card-underline-swash" />

        <p className="card-wish-quote">
          {wishText}
        </p>

        <div className="card-heart-symbol">
          ♥
        </div>
      </div>
    </div>
  );
}
