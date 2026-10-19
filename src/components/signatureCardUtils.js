/**
 * Signature Card Utilities & 2D Canvas Generator
 * Dành cho trường hợp chị em chưa kịp có ảnh chân dung:
 * Tạo thẻ chữ ký nghệ thuật phong cách thư pháp Vintage / Cinematic (theo chuẩn Ảnh 2)
 * Thiết kế nền màu nước ấm mềm mại, không bị chói lóa, bố cục tràn viền đầy đặn.
 */

export const SIGNATURE_STYLES = [
  {
    id: 1,
    title: 'Chữ ký đơn giản + hoa lá',
    font: '"Great Vibes", cursive',
    quote: 'Luôn xinh đẹp, hạnh phúc và tỏa sáng theo cách riêng của mình!',
    theme: {
      bgStart: '#FDF1F4',
      bgEnd: '#F9DCE3',
      splash: 'rgba(244, 63, 94, 0.28)',
      border: '#E6A7B8',
      text: '#881337',
      accent: '#B45309',
      emblem: 'flower'
    }
  },
  {
    id: 2,
    title: 'Chữ ký bay bổng + vương miện',
    font: '"Alex Brush", cursive',
    quote: 'Luôn rạng rỡ, tự tin và gặt hái thật nhiều thành công rực rỡ!',
    theme: {
      bgStart: '#FAF2E6',
      bgEnd: '#F3E4D0',
      splash: 'rgba(217, 119, 6, 0.22)',
      border: '#D4AF37',
      text: '#78350F',
      accent: '#C9A66B',
      emblem: 'crown'
    }
  },
  {
    id: 3,
    title: 'Chữ ký kèm sakura hoa lá',
    font: '"Great Vibes", cursive',
    quote: 'Chúc chị luôn tươi tắn, dịu dàng và được yêu thương thật nhiều!',
    theme: {
      bgStart: '#FFF0F5',
      bgEnd: '#FAD8E2',
      splash: 'rgba(236, 72, 153, 0.26)',
      border: '#F472B6',
      text: '#9D174D',
      accent: '#E11D48',
      emblem: 'sakura'
    }
  },
  {
    id: 4,
    title: 'Chữ ký quý phái + ánh sao',
    font: '"Dancing Script", cursive',
    quote: 'Mong chị mỗi ngày đều ngập tràn niềm vui và bình an trong tâm hồn!',
    theme: {
      bgStart: '#FDF5E8',
      bgEnd: '#F6E4C8',
      splash: 'rgba(245, 158, 11, 0.24)',
      border: '#E2B876',
      text: '#713F12',
      accent: '#D97706',
      emblem: 'stars'
    }
  },
  {
    id: 5,
    title: 'Chữ ký tối giản & tinh tế',
    font: '"Great Vibes", cursive',
    quote: 'Luôn mạnh khỏe, bình an và ngập tràn hạnh phúc mỗi ngày!',
    theme: {
      bgStart: '#FAF3EB',
      bgEnd: '#F4E5D4',
      splash: 'rgba(168, 85, 247, 0.22)',
      border: '#C084FC',
      text: '#581C87',
      accent: '#9333EA',
      emblem: 'minimal'
    }
  }
];

export function getSignatureStyleForName(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % SIGNATURE_STYLES.length;
  return SIGNATURE_STYLES[index];
}

/**
 * Tạo canvas 2D thẻ chữ ký nghệ thuật chất lượng cao (dùng cho Three.js Texture hoặc xuất ảnh)
 * Tone màu nước pastel ấm, có vệt cọ nghệ thuật nâng đỡ tên, hoa lá tràn viền, chống lóa sáng tuyệt đối.
 */
/**
 * Tạo canvas 2D thẻ chữ ký nghệ thuật "Hồng Nhung & Vòng Hoa Vàng Hoàng Gia"
 * Dùng làm Texture sắc nét cho Three.js (Trạm 2 và Trạm 5) và xuất ảnh.
 * Đồng bộ 100% với giao diện Thiệp Hồng Nhung: vòng tròn vàng, giàn hoa đào botanical hai bên, chữ Pinyon Script.
 */
export function createSignatureCardCanvas(name = 'Bạn', customQuote = '', width = 800, height = 1060) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const displayName = name.replace(/^(Chị\s+|Em\s+)/i, '').trim() || 'Bạn';
  const wish = customQuote || 'Chúc bạn luôn vui vẻ, may mắn và hạnh phúc!';

  // 1. Nền radial gradient ấm áp phong cách Thiệp Hồng Nhung
  const bgGrad = ctx.createRadialGradient(
    width * 0.5, height * 0.45, 40,
    width * 0.5, height * 0.45, width * 0.75
  );
  bgGrad.addColorStop(0, '#fdeae4');
  bgGrad.addColorStop(0.6, '#fde6df');
  bgGrad.addColorStop(1, '#fbd9d2');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Khung viền đôi hoàng gia
  ctx.save();
  ctx.strokeStyle = '#ee8f86';
  ctx.lineWidth = 3;
  ctx.strokeRect(width * 0.022, height * 0.022, width * 0.956, height * 0.956);

  ctx.strokeStyle = 'rgba(238, 143, 134, 0.55)';
  ctx.lineWidth = 1.8;
  ctx.strokeRect(width * 0.034, height * 0.034, width * 0.932, height * 0.932);

  // 4 Hoa văn góc uốn cong
  const cornerR = width * 0.05;
  const drawCornerArc = (x, y, startA, endA) => {
    ctx.strokeStyle = 'rgba(238, 143, 134, 0.75)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(x, y, cornerR, startA, endA);
    ctx.stroke();
  };
  drawCornerArc(width * 0.036 + cornerR, height * 0.036 + cornerR, Math.PI, Math.PI * 1.5);
  drawCornerArc(width * 0.964 - cornerR, height * 0.036 + cornerR, Math.PI * 1.5, 0);
  drawCornerArc(width * 0.036 + cornerR, height * 0.964 - cornerR, Math.PI * 0.5, Math.PI);
  drawCornerArc(width * 0.964 - cornerR, height * 0.964 - cornerR, 0, Math.PI * 0.5);
  ctx.restore();

  // 3. Vài cánh hoa hồng mềm mại rơi lãng mạn
  const drawFallenPetal = (x, y, scale, rot) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.scale(scale, scale);
    const grad = ctx.createLinearGradient(-15, -25, 15, 25);
    grad.addColorStop(0, '#fbcbd6');
    grad.addColorStop(1, '#f4a9bb');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(0, -25);
    ctx.bezierCurveTo(20, -10, 20, 15, 0, 25);
    ctx.bezierCurveTo(-20, 15, -20, -10, 0, -25);
    ctx.fill();
    ctx.restore();
  };

  drawFallenPetal(width * 0.11, height * 0.14, 0.9, 35);
  drawFallenPetal(width * 0.08, height * 0.22, 0.6, 60);
  drawFallenPetal(width * 0.91, height * 0.09, 0.8, -40);
  drawFallenPetal(width * 0.10, height * 0.86, 1.0, 25);
  drawFallenPetal(width * 0.93, height * 0.72, 0.85, -55);
  drawFallenPetal(width * 0.86, height * 0.92, 1.1, 30);
  drawFallenPetal(width * 0.20, height * 0.93, 0.7, -30);

  // 4. Vòng tròn vàng kim (Golden Metallic Ring)
  const ringCX = width / 2;
  const ringCY = height * 0.44;
  const ringRadius = width * 0.32;

  ctx.save();
  ctx.shadowColor = 'rgba(201, 161, 90, 0.35)';
  ctx.shadowBlur = 16;
  const ringGrad = ctx.createLinearGradient(
    ringCX - ringRadius, ringCY - ringRadius,
    ringCX + ringRadius, ringCY + ringRadius
  );
  ringGrad.addColorStop(0, '#b8893f');
  ringGrad.addColorStop(0.28, '#f5deb3');
  ringGrad.addColorStop(0.5, '#e8cf8f');
  ringGrad.addColorStop(0.72, '#b8893f');
  ringGrad.addColorStop(1, '#e8cf8f');

  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(ringCX, ringCY, ringRadius, 0, Math.PI * 2);
  ctx.stroke();

  // Viền mỏng phụ lấp lánh bên trong vòng tròn
  ctx.strokeStyle = 'rgba(232, 207, 143, 0.5)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(ringCX, ringCY, ringRadius - 6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // 5. Cành hoa đào / hoa hồng Botanical ôm tròn hai bên vòng tròn
  const drawBlossom = (bx, by, size, angle) => {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(angle);
    ctx.scale(size, size);

    // 5 Cánh hoa hồng đào loang màu
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.rotate((i * 72 * Math.PI) / 180);
      const pGrad = ctx.createLinearGradient(0, 0, 0, -32);
      pGrad.addColorStop(0, '#e8527f');
      pGrad.addColorStop(0.35, '#f4a0b8');
      pGrad.addColorStop(0.75, '#fbd3de');
      pGrad.addColorStop(1, '#fef0f3');
      ctx.fillStyle = pGrad;
      ctx.strokeStyle = 'rgba(228, 109, 147, 0.5)';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(-18, -6, -22, -28, 0, -32);
      ctx.bezierCurveTo(22, -28, 18, -6, 0, 0);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Tâm hoa & nhụy
    ctx.fillStyle = 'rgba(224, 83, 127, 0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
    ctx.fill();

    // Các tia nhụy hoa
    for (let r = 0; r < 8; r++) {
      const a = (r * 45 * Math.PI) / 180;
      ctx.strokeStyle = '#c2416f';
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 12, Math.sin(a) * 12);
      ctx.stroke();

      ctx.fillStyle = '#d4467c';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * 13, Math.sin(a) * 13, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#a8305c';
    ctx.beginPath();
    ctx.arc(0, 0, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  const drawLeaf = (lx, ly, len, wid, angle) => {
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(angle);
    const lGrad = ctx.createLinearGradient(0, 0, len, 0);
    lGrad.addColorStop(0, '#9aa070');
    lGrad.addColorStop(1, '#cfd0a3');
    ctx.fillStyle = lGrad;
    ctx.strokeStyle = 'rgba(138, 145, 96, 0.6)';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.4, -wid, len, 0);
    ctx.quadraticCurveTo(len * 0.4, wid, 0, 0);
    ctx.fill();
    ctx.stroke();

    // Gân lá
    ctx.strokeStyle = 'rgba(125, 133, 86, 0.7)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(len - 2, 0);
    ctx.stroke();
    ctx.restore();
  };

  const drawBud = (bx, by, size, angle) => {
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(angle);
    ctx.scale(size, size);
    ctx.fillStyle = '#ee7a9c';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-6, -6, -6, -18, 0, -22);
    ctx.bezierCurveTo(6, -18, 6, -6, 0, 0);
    ctx.fill();

    // Đài hoa xanh
    ctx.fillStyle = '#9ea46f';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-4, -8);
    ctx.lineTo(0, -6);
    ctx.lineTo(4, -8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };

  // Hàm vẽ 1 nhánh hoa ôm vòng tròn (bên trái)
  const drawBotanicalBranch = (isRight = false) => {
    ctx.save();
    if (isRight) {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }

    // Nhánh cây uốn lượn ôm cung tròn
    ctx.strokeStyle = '#8a6a55';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(ringCX - ringRadius * 0.68, ringCY + ringRadius * 0.88);
    ctx.bezierCurveTo(
      ringCX - ringRadius * 1.08, ringCY + ringRadius * 0.6,
      ringCX - ringRadius * 1.14, ringCY - ringRadius * 0.2,
      ringCX - ringRadius * 0.72, ringCY - ringRadius * 0.82
    );
    ctx.stroke();

    // Lớp vệt sáng trên thân cành
    ctx.strokeStyle = 'rgba(185, 152, 125, 0.65)';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(ringCX - ringRadius * 0.68, ringCY + ringRadius * 0.88);
    ctx.bezierCurveTo(
      ringCX - ringRadius * 1.08, ringCY + ringRadius * 0.6,
      ringCX - ringRadius * 1.14, ringCY - ringRadius * 0.2,
      ringCX - ringRadius * 0.72, ringCY - ringRadius * 0.82
    );
    ctx.stroke();

    // Các nhánh phụ nhỏ
    ctx.strokeStyle = '#8a6a55';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(ringCX - ringRadius * 1.06, ringCY + ringRadius * 0.2);
    ctx.quadraticCurveTo(ringCX - ringRadius * 1.22, ringCY + ringRadius * 0.15, ringCX - ringRadius * 1.3, ringCY + ringRadius * 0.28);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(ringCX - ringRadius * 0.98, ringCY - ringRadius * 0.45);
    ctx.quadraticCurveTo(ringCX - ringRadius * 1.18, ringCY - ringRadius * 0.52, ringCX - ringRadius * 1.24, ringCY - ringRadius * 0.42);
    ctx.stroke();

    // Các cụm lá xanh
    drawLeaf(ringCX - ringRadius * 0.82, ringCY + ringRadius * 0.8, 38, 14, (120 * Math.PI) / 180);
    drawLeaf(ringCX - ringRadius * 1.08, ringCY + ringRadius * 0.42, 34, 12, (190 * Math.PI) / 180);
    drawLeaf(ringCX - ringRadius * 1.12, ringCY - ringRadius * 0.1, 32, 11, (160 * Math.PI) / 180);
    drawLeaf(ringCX - ringRadius * 0.92, ringCY - ringRadius * 0.62, 30, 11, (240 * Math.PI) / 180);

    // Búp hoa non
    drawBud(ringCX - ringRadius * 1.3, ringCY + ringRadius * 0.28, 1.2, (-45 * Math.PI) / 180);
    drawBud(ringCX - ringRadius * 1.24, ringCY - ringRadius * 0.42, 1.1, (30 * Math.PI) / 180);
    drawBud(ringCX - ringRadius * 0.66, ringCY - ringRadius * 0.88, 1.3, (75 * Math.PI) / 180);

    // 4 Đóa hoa đào nở rộ dọc theo cành
    drawBlossom(ringCX - ringRadius * 1.02, ringCY + ringRadius * 0.58, 0.95, (12 * Math.PI) / 180);
    drawBlossom(ringCX - ringRadius * 1.14, ringCY + ringRadius * 0.05, 1.1, (-15 * Math.PI) / 180);
    drawBlossom(ringCX - ringRadius * 1.04, ringCY - ringRadius * 0.38, 0.85, (25 * Math.PI) / 180);
    drawBlossom(ringCX - ringRadius * 0.72, ringCY - ringRadius * 0.8, 0.75, (40 * Math.PI) / 180);

    ctx.restore();
  };

  // Vẽ 2 nhánh hoa ôm lấy 2 bên của vòng tròn
  drawBotanicalBranch(false); // Trái
  drawBotanicalBranch(true);  // Phải đối xứng

  // 6. Nội dung đặt trang nhã ngay tâm vòng tròn
  ctx.textAlign = 'center';

  // Eyebrow: WITH LOVE · 20.10
  ctx.fillStyle = '#b83a68';
  ctx.font = '500 18px "Be Vietnam Pro", sans-serif';
  ctx.letterSpacing = '6px';
  ctx.fillText('WITH LOVE · 20.10', ringCX, ringCY - 105);
  ctx.letterSpacing = '0px';

  // Tên thư pháp (Pinyon Script / Great Vibes lộng lẫy với gradient)
  const nameGrad = ctx.createLinearGradient(0, ringCY - 70, 0, ringCY + 15);
  nameGrad.addColorStop(0, '#f0548a');
  nameGrad.addColorStop(1, '#d93d78');
  ctx.fillStyle = nameGrad;
  ctx.font = '400 86px "Pinyon Script", "Great Vibes", "Alex Brush", cursive';
  ctx.shadowColor = 'rgba(232, 70, 124, 0.25)';
  ctx.shadowBlur = 10;
  ctx.fillText(`${displayName}`, ringCX - 8, ringCY - 8);
  ctx.shadowBlur = 0;

  // Trái tim nhỏ xinh cuối tên
  ctx.fillStyle = '#e8467c';
  ctx.font = '32px sans-serif';
  const nameWidth = ctx.measureText(displayName).width;
  ctx.fillText('♡', ringCX + nameWidth * 0.48 + 12, ringCY - 30);

  // Nét uốn lượn nghệ thuật dưới chân tên (Swash)
  ctx.strokeStyle = '#e8467c';
  ctx.lineWidth = 2.6;
  ctx.beginPath();
  ctx.moveTo(ringCX - 150, ringCY + 18);
  ctx.quadraticCurveTo(ringCX + 10, ringCY + 46, ringCX + 150, ringCY + 12);
  ctx.stroke();

  // Lời chúc dịu dàng, trang nhã
  ctx.fillStyle = '#b83a68';
  ctx.font = '300 24px "Be Vietnam Pro", sans-serif';

  const words = wish.split(' ');
  let line = '';
  let curY = ringCY + 75;
  const maxWidth = ringRadius * 1.55;
  const lineHeight = 36;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, ringCX, curY);
      line = words[n] + ' ';
      curY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, ringCX, curY);

  // Trái tim biểu tượng chân tình ở tâm dưới vòng tròn
  ctx.fillStyle = '#e8467c';
  ctx.font = '28px serif';
  ctx.fillText('♥', ringCX, curY + 45);

  return canvas;
}

