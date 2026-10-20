import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwuex0SUfkMbiD6zx0aIsoOyO9kMskPanbVtIbsCg1YQNckoPpwjJdR41_k5TtHMMs/exec";

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function syncAllData() {
  console.log('🚀 Bắt đầu kéo dữ liệu từ Google Apps Script...');

  // 1. Kéo danh sách chị em
  console.log('1. Đang kéo danh sách Chị Em (people)...');
  const peopleRes = await fetchJson(`${APPS_SCRIPT_URL}?action=people`);
  if (!peopleRes.success || !Array.isArray(peopleRes.data)) {
    throw new Error('Không thể lấy danh sách people từ Sheet');
  }
  const people = peopleRes.data;
  console.log(`✓ Đã lấy được ${people.length} chị em`);

  // 2. Kéo danh sách lời chúc bóng bay công khai
  console.log('2. Đang kéo lời chúc công khai (public wishes)...');
  const publicRes = await fetchJson(`${APPS_SCRIPT_URL}?action=public`);
  if (!publicRes.success || !Array.isArray(publicRes.data)) {
    throw new Error('Không thể lấy danh sách public wishes từ Sheet');
  }
  const publicWishes = publicRes.data;
  console.log(`✓ Đã lấy được ${publicWishes.length} lời chúc công khai`);

  // 3. Kéo lời chúc riêng tư của từng chị
  console.log('3. Đang kéo lời chúc riêng tư của từng chị em...');
  const allPrivateWishes = [];
  let totalWishes = 0;

  for (let i = 0; i < people.length; i++) {
    const sister = people[i];
    console.log(`   [${i + 1}/${people.length}] Kéo lời chúc cho ${sister.name} (${sister.id})...`);
    try {
      const pRes = await fetchJson(`${APPS_SCRIPT_URL}?action=private&id=${encodeURIComponent(sister.id)}`);
      if (pRes.success && Array.isArray(pRes.data)) {
        // Gắn recipientId vào từng wish để dễ dàng tra cứu
        for (const w of pRes.data) {
          allPrivateWishes.push({
            recipientId: sister.id,
            recipient_name: sister.name,
            ...w
          });
          totalWishes++;
        }
      }
    } catch (err) {
      console.warn(`   ⚠️ Lỗi kéo lời chúc riêng cho ${sister.name}:`, err.message);
    }
  }
  console.log(`✓ Đã gom được tổng cộng ${totalWishes} lời chúc riêng tư`);

  // 4. Ghi vào các file trong src/data/
  const sistersPath = path.join(ROOT_DIR, 'src', 'data', 'sisters.json');
  const balloonPath = path.join(ROOT_DIR, 'src', 'data', 'balloonWishes.json');
  const privatePath = path.join(ROOT_DIR, 'src', 'data', 'privateWishes.json');

  fs.writeFileSync(sistersPath, JSON.stringify(people, null, 2), 'utf-8');
  console.log(`💾 Đã ghi: ${sistersPath}`);

  fs.writeFileSync(balloonPath, JSON.stringify(publicWishes, null, 2), 'utf-8');
  console.log(`💾 Đã ghi: ${balloonPath}`);

  fs.writeFileSync(privatePath, JSON.stringify(allPrivateWishes, null, 2), 'utf-8');
  console.log(`💾 Đã ghi: ${privatePath}`);

  console.log('🎉 Hoàn tất đồng bộ toàn bộ dữ liệu từ Sheet vào Project!');
}

syncAllData().catch(err => {
  console.error('❌ Lỗi đồng bộ:', err);
  process.exit(1);
});
