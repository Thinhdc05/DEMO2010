/**
 * 3D World Constants: Stations & Camera Presets
 */

// Camera presets cho xe hoa khi bám theo xe (chỉ giữ các góc bám xe)
export const VAN_PRESETS = {
  chase: { rel: true, cam: [4.6, 2.9, -9.5], tgt: [0, 1.5, 2.5] },
  close: { rel: true, cam: [3.8, 1.6, -4.8], tgt: [0, 1.3, 0.2] },
  side: { rel: true, cam: [8.8, 2.1, 0.6], tgt: [0, 1.3, 0.2] },
  top: { rel: true, cam: [0, 16, -6], tgt: [0, 0, 1.5] }
};

// Camera presets cho cỗ xe bạch mã hoàng gia (tương thích góc quay chuẩn cinematic từ horse.html)
export const CARRIAGE_PRESETS = {
  tq: { rel: true, cam: [14, 4.6, 14], tgt: [0, 1.9, 4.2], label: '✨ Góc 3/4' },
  side: { rel: true, cam: [17, 2.8, 4.2], tgt: [0, 1.9, 4.2], label: '🌼 Bên hông' },
  carr: { rel: true, cam: [7.5, 3.2, -1.5], tgt: [0, 2.4, 0], label: '👑 Cận xe' },
  back: { rel: true, cam: [1.5, 4, -11], tgt: [0, 2.2, 4.5], label: '💐 Phía sau' },
  close: { rel: true, cam: [4.8, 2.4, 12.5], tgt: [0, 1.8, 8], label: '🐎 Cận ngựa' }
};

// 6 Master 3D Stations along the scenic flower road (Hành trình đóa hoa 20/10)
export const STATIONS = [
  {
    id: 'gift',
    u: 0.02,
    chapter: 'Chương 1',
    chapterTitle: 'Món Quà Bất Ngờ Chớm Nở',
    name: 'Hộp Quà Hoàng Gia',
    subtitle: 'Chạm Hộp Quà Mở Bung Nắp, Thả Bướm & Bong Bóng 20.10',
    icon: '🎁'
  },
  {
    id: 'letter',
    u: 0.18,
    chapter: 'Chương 2',
    chapterTitle: 'Lời Tâm Tình Gửi Trao',
    name: 'Đại Điện Thư Ngỏ',
    subtitle: 'Tấm Thiệp Bifold Khổng Lồ Dát Vàng & Chân Dung Tri Ân',
    icon: '💌'
  },
  {
    id: 'balloons',
    u: 0.35,
    chapter: 'Chương 3',
    chapterTitle: 'Ngàn Ước Nguyện Bay Xa',
    name: 'Thung Lũng Bóng Bay',
    subtitle: 'Chạm Nổ Bóng Nhận Ngay Những Lời Chúc May Mắn Ngọt Ngào',
    icon: '🎈'
  },
  {
    id: 'courier',
    u: 0.52,
    chapter: 'Chương 4',
    chapterTitle: 'Chuyến Xe Mang Niềm Vui Đi Khắp Thế Giới',
    name: 'Đại Lộ Xe Hoa 20/10',
    subtitle: 'Chuyến Xe Hoa Cổ Điển Rực Rỡ & Hòm Thư Bưu Kiện Riêng',
    icon: '🚐'
  },
  {
    id: 'video',
    u: 0.70,
    chapter: 'Chương 5',
    chapterTitle: 'Thước Phim Thanh Xuân Rực Rỡ',
    name: 'Rạp Chiếu Điện Ảnh',
    subtitle: 'Khán Đài Hoàng Hôn & 5 Video Tri Ân ',
    icon: '🎬'
  },
  {
    id: 'party',
    u: 0.88,
    chapter: 'Chương 6',
    chapterTitle: 'Đêm Đại Tiệc Vinh Danh Phái Đẹp',
    name: 'Lâu Đài Tiệc Mừng',
    subtitle: 'Cung Điện Tiệc Hoàng Gia & Tải Thiệp Kỷ Niệm 2x Retina',
    icon: '💐'
  }
];
