/**
 * API Client & Data Provider cho 20/10 Cinematic Web
 * Tự động đồng bộ với các file Mock chuẩn hóa trong src/data/
 * Khi có dữ liệu thật từ Google Sheet, chỉ cần dán APPS_SCRIPT_URL hoặc sửa file trong src/data/
 */
import sistersData from './data/sisters.json';
import balloonWishesData from './data/balloonWishes.json';
import privateWishesData from './data/privateWishes.json';
import cardWishesData from './data/cardWishes.json';

// Khi deploy Google Apps Script, dán URL Web App vào đây (dạng https://script.google.com/macros/s/.../exec)
// Nếu để rỗng (""), hệ thống sẽ tự động dùng 100% dữ liệu từ các file trong src/data/
export const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwuex0SUfkMbiD6zx0aIsoOyO9kMskPanbVtIbsCg1YQNckoPpwjJdR41_k5TtHMMs/exec"; 

const CACHE_TTL_MS = 45 * 1000; // 45 giây (tự động đồng bộ nhanh khi admin duyệt sheet)

/**
 * 1. Lấy 1 lời chúc thiệp ngẫu nhiên trong 50 lời chúc chọn lọc
 */
export function getRandomCardWish(index) {
  let item;
  if (typeof index === 'number' && index >= 0 && index < cardWishesData.length) {
    item = cardWishesData[index];
  } else {
    const randomIndex = Math.floor(Math.random() * cardWishesData.length);
    item = cardWishesData[randomIndex];
  }
  return {
    ...item,
    toString() {
      return `“${item.highlight}”\n\n${item.message}`;
    },
    fullText: `“${item.highlight}”\n\n${item.message}`
  };
}

/**
 * Lấy toàn bộ 50 lời chúc thiệp
 */
export function getAllCardWishes() {
  return cardWishesData;
}

/**
 * Tự động chuẩn hóa link ảnh, đặc biệt là link Google Drive sang định dạng direct CDN
 */
export function normalizePhotoUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  // Chuyển link Google Drive (view/sharing) sang link direct image stream
  const driveMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]+)/) || trimmed.match(/id=([a-zA-Z0-9_-]+)/);
  if (driveMatch && (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com'))) {
    const fileId = driveMatch[1];
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  return trimmed;
}

/**
 * 2. Lấy danh sách chị em (Ưu tiên nạp tức thì từ dữ liệu nướng sẵn trong Project)
 */
export async function fetchPeople() {
  // Trả về tức thì dữ liệu 23 chị em đã đồng bộ từ Sheet, không phụ thuộc mạng, 0ms lag
  return sistersData.map(p => ({
    ...p,
    photo: normalizePhotoUrl(p.photo)
  }));
}

/**
 * 3. Lấy danh sách lời chúc công khai (bóng bay & biển bảng)
 */
export async function fetchPublicWishes() {
  // Trả về tức thì danh sách lời chúc đã kiểm duyệt và đồng bộ từ Sheet
  return balloonWishesData.map((item, idx) => ({
    id: item.id || idx + 1,
    name: item.from_name || item.name || "Đồng nghiệp",
    dept: item.dept || "Công ty",
    text: item.text,
    color: item.color || "#C9A66B"
  }));
}

/**
 * 4. Lấy lời nhắn riêng tư (Lấy trực tiếp từ 54 lời chúc đã nướng sẵn trong Project)
 */
export async function fetchPrivateWishes(id, nameOrPin) {
  const cleanId = String(id || '').trim().toLowerCase();
  const overrideName = (typeof nameOrPin === 'string' && !/^\d+$/.test(nameOrPin.trim())) 
    ? nameOrPin.trim() 
    : '';

  // 1. Tìm thông tin chị em
  const foundSister = cleanId 
    ? sistersData.find(s => String(s.id || '').trim().toLowerCase() === cleanId)
    : null;

  const fallbackName = overrideName 
    || (foundSister ? foundSister.name : null)
    || 'Bạn';

  // 2. Lấy lời chúc riêng theo recipientId từ privateWishes.json
  const sisterWishes = cleanId 
    ? privateWishesData.filter(w => String(w.recipientId || '').trim().toLowerCase() === cleanId) 
    : [];

  if (sisterWishes.length > 0) {
    const recipientName = sisterWishes[0].recipient_name || fallbackName;
    return {
      success: true,
      recipient_name: recipientName,
      data: sisterWishes
    };
  }

  // 3. Nếu chưa có lời chúc riêng ghi đích danh, tự sinh thư chúc ấm áp cá nhân hóa theo đúng tên người nhận
  return {
    success: true,
    recipient_name: fallbackName,
    data: [
      {
        id: 1,
        type: "winged_letter",
        badge: "🕊️ Cánh Thư Tri Ân",
        from_name: "Anh em trong công ty",
        text: `Cảm ơn ${fallbackName} đã luôn đồng hành, hỗ trợ và mang lại nguồn năng lượng tích cực cho toàn thể anh em. Chúc ${fallbackName} một ngày 20/10 ngập tràn niềm vui, hoa tươi và những điều ngọt ngào nhất!`
      },
      {
        id: 2,
        type: "heart",
        badge: "💖 Trái Tim Đồng Đội",
        from_name: "Một người đồng nghiệp giấu tên",
        text: `Chúc ${fallbackName} ngày 20/10 luôn rạng rỡ, công việc hanh thông, vạn sự như ý và mãi là đóa hoa xinh đẹp của công ty!`
      }
    ]
  };
}

/**
 * 5. Gửi lời chúc mới từ Form
 */
export async function submitWish(payload) {
  if (!APPS_SCRIPT_URL) {
    console.log("[Local Mode] Lời chúc đã được ghi nhận:", payload);
    return {
      success: true,
      message: "Cảm ơn bạn! Lời chúc đã được lưu thành công. Khi kết nối Google Apps Script, tin nhắn sẽ tự động gửi vào Google Sheet của ban tổ chức."
    };
  }

  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result && result.success) {
      try {
        localStorage.removeItem("tribute_public_wishes_cache");
      } catch (e) {}
    }
    return result;
  } catch (err) {
    console.error("[API] submitWish error:", err);
    return { success: false, message: "Gửi lời chúc thất bại, vui lòng kiểm tra kết nối mạng." };
  }
}

function getCache(key) {
  try {
    // Nếu có tham số ?refresh=1 trên URL, xóa cache để luôn kéo data mới nhất từ Sheet
    if (typeof window !== 'undefined' && window.location.search.includes('refresh=1')) {
      try { localStorage.removeItem(key); } catch (e) {}
      return null;
    }

    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { timestamp, data, url } = JSON.parse(raw);
    if (url !== APPS_SCRIPT_URL) {
      localStorage.removeItem(key);
      return null;
    }

    // Ở môi trường local dev (localhost / 127.0.0.1), giảm cache TTL xuống 5 giây để test thay đổi từ Sheet gần như tức thì
    const isLocalhost = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const effectiveTTL = isLocalhost ? 5000 : CACHE_TTL_MS;

    if (Date.now() - timestamp < effectiveTTL) {
      return data;
    }
    localStorage.removeItem(key);
    return null;
  } catch (e) {
    return null;
  }
}

function setCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({
      timestamp: Date.now(),
      url: APPS_SCRIPT_URL,
      data
    }));
  } catch (e) {
    // Ignore storage quota
  }
}
