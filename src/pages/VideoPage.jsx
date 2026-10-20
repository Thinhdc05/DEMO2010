import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext.jsx';

export default function VideoPage() {
  const { navigateWithFlowerTransition, setIsPlayingMusic } = useApp();

  // 1. Danh sách 5 video ngắn tri ân đúng tên file và option theo yêu cầu
  const videoPlaylist = [
    {
      id: 1,
      title: "Lời Chúc: Leader FE",
      tag: "Leader FE",
      icon: "👑",
      duration: "0:10",
      src: "/videochucmung.mp4",
      poster: "/thumbnails/thumb_fe.jpg",
      desc: "Thông điệp chúc mừng 20/10 ngọt ngào, ấm áp và trân trọng nhất từ Leader FE."
    },
    {
      id: 2,
      title: "Lời Chúc: Râu Con Kiến (Sơn)",
      tag: "Râu con kiến",
      icon: "🐜",
      duration: "0:10",
      src: "/videchucmungSon.mp4",
      poster: "/thumbnails/thumb_son.jpg",
      desc: "Clip chúc mừng hóm hỉnh, vui tươi và tràn đầy năng lượng tích cực từ Sơn (Râu con kiến)."
    },
    {
      id: 3,
      title: "Lời Chúc: Boy phố(Sơn B)",
      tag: "Boy phố",
      icon: "🛡️",
      duration: "0:10",
      src: "/videochucmungSonb.mp4",
      poster: "/thumbnails/thumb_sonb.jpg",
      desc: "Lời nhắn gửi chân thành, vững chãi từ Sơn B (Boy phố) gửi tặng phái đẹp công ty."
    },
    {
      id: 4,
      title: "Lời Chúc: Chú lính chì (Hoàng)",
      tag: "Chú lính chì",
      icon: "⚔️",
      duration: "0:10",
      src: "/videochucmungHoang.mp4",
      poster: "/thumbnails/thumb_hoang.jpg",
      desc: "Lời chúc nhiệt huyết, hết mình và vui nhộn từ Hoàng (Chú Lính Chì) gửi tặng các chị em."
    },
    {
      id: 5,
      title: "Lời Chúc: Food Reviewer(Huy)",
      tag: "Food Reviewer",
      icon: "🍳",
      duration: "0:10",
      src: "/videochucmungHuy.mp4",
      poster: "/thumbnails/thumb_huy.jpg",
      desc: "Hương vị ấm áp và sự chu đáo từ Huy (Food Reviewer) chúc mừng ngày Phụ nữ Việt Nam 20/10."
    },
    {
      id: 6,
      title: "Lời Chúc: Bá khéo",
      tag: "Bá khéo",
      icon: "🎯",
      duration: "0:10",
      src: "/videochucmungViet.mp4",
      poster: "/thumbnails/thumb_viet.jpg",
      desc: "Lời chúc ấm áp, khéo léo và chân thành từ Việt (Bá khéo) gửi tặng các chị em."
    },
    {
      id: 7,
      title: "Lời Chúc: Tam ca",
      tag: "Tam ca",
      icon: "🎶",
      duration: "0:10",
      src: "/videochucmung3.mp4",
      poster: "/thumbnails/thumb_tamca.jpg",
      desc: "Giai điệu đồng ca chúc mừng 20/10 ngập tràn niềm vui và gắn kết từ toàn thể anh em."
    },
    {
      id: 8,
      title: "Lời Chúc: Vanh",
      tag: "Vanh",
      icon: "🌟",
      duration: "0:10",
      src: "/videochucmungVietAnh.mp4",
      poster: "/thumbnails/thumb_vanh.jpg",
      desc: "Lời chúc mừng 20/10 ngập tràn năng lượng tươi vui và chân thành từ Việt Anh (Vanh)."
    }
  ];

  // 2. Danh sách quotes tri ân
  const quotes = [
    {
      category: "DÀNH TẶNG NỤ CƯỜI TỎA NẮNG",
      icon: "✨",
      text: "“Cảm ơn vì đã luôn làm cho công ty này rực rỡ, vui tươi và tràn ngập năng lượng tích cực mỗi ngày!”",
      author: "Toàn thể Anh Em Tech & Product Team",
      badge: "Tech & Product Family"
    },
    {
      category: "TRI ÂN SỰ ĐỒNG HÀNH TRONG TỪNG SPRINT",
      icon: "🚀",
      text: "“Mọi sprint release cam go, mọi đêm OT dự án đều trở nên êm đềm và đáng nhớ hơn nhờ nụ cười, sự thấu cảm và kiên trì của các chị em!”",
      author: "Engineering & QA Family",
      badge: "Dev & QA Brothers"
    },
    {
      category: "VINH DANH NHỮNG ĐÓA HOA XUẤT CHÚNG",
      icon: "👑",
      text: "“Chúc các đóa hoa IT luôn tự tin, kiên cường, hạnh phúc và mãi là phiên bản tài năng, rực rỡ nhất trong cuộc sống!”",
      author: "From Brothers with Sincere Respect",
      badge: "With Love & Honor"
    },
    {
      category: "LỜI CHÚC TỪ TRÁI TIM",
      icon: "🌸",
      text: "“Mỗi dòng code chúng mình viết ra có thể chứa bug, nhưng sự trân trọng và biết ơn dành cho các chị em thì luôn hoàn hảo 100%!”",
      author: "Frontend, Backend & DevOps Club",
      badge: "Code with Love"
    }
  ];

  const [viewMode, setViewMode] = useState('video'); // 'video' hoặc 'quotes'
  const [selectedVideoIndex, setSelectedVideoIndex] = useState(0);
  const [isAutoPlayNext, setIsAutoPlayNext] = useState(true);
  const videoRef = useRef(null);

  // Quotes slideshow states
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [isQuoteAutoPlay, setIsQuoteAutoPlay] = useState(true);

  // Auto-slide cho tab Quotes
  useEffect(() => {
    if (!isQuoteAutoPlay || viewMode !== 'quotes') return;
    const timer = setInterval(() => {
      setCurrentQuoteIndex(prev => (prev + 1) % quotes.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isQuoteAutoPlay, quotes.length, viewMode]);

  // Khi chuyển video, tải và phát video mới
  const handleSelectVideo = (idx) => {
    setSelectedVideoIndex(idx);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
      videoRef.current.src = videoPlaylist[idx].src;
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  };

  // Khi hết video (10s), tự động chuyển sang tập tiếp theo nếu bật AutoPlayNext
  const handleVideoEnded = () => {
    if (isAutoPlayNext) {
      const nextIndex = (selectedVideoIndex + 1) % videoPlaylist.length;
      handleSelectVideo(nextIndex);
    }
  };

  // Quản lý âm thanh: Tạm dừng nhạc nền khi xem video để không bị đè âm
  const handleVideoPlay = () => {
    if (setIsPlayingMusic) setIsPlayingMusic(false);
  };

  const activeVideo = videoPlaylist[selectedVideoIndex];
  const currentQuote = quotes[currentQuoteIndex];

  return (
    <div className="page-screen" id="page-video">
      <div className="cinema-screen-container">
        {/* Header Phòng Chiếu */}
        <div className="cinema-header">
          <div className="cinema-eyebrow">
            SPECIAL TRIBUTE CINEMA • 20.10
          </div>
          <h2 className="cinema-title">Rạp Chiếu Phim Tri Ân</h2>
          <p className="cinema-sub">
            Những xúc cảm và lời trân trọng chân thành nhất được gửi gắm trong từng thước phim ngắn dành tặng các chị em.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '16px' }}>
            <button
              onClick={() => setViewMode('video')}
              className={`btn-rose ${viewMode === 'video' ? 'active' : ''}`}
              style={{
                padding: '8px 20px',
                fontSize: '0.88rem',
                background: viewMode === 'video' ? 'linear-gradient(135deg, #BE123C, #8C2F4B)' : 'rgba(255,255,255,0.08)',
                color: '#FFF',
                border: '1.5px solid rgba(253, 230, 138, 0.4)'
              }}
            >
              🎬 Xem Video Tri Ân ({videoPlaylist.length} Video)
            </button>
            <button
              onClick={() => setViewMode('quotes')}
              className={`btn-rose ${viewMode === 'quotes' ? 'active' : ''}`}
              style={{
                padding: '8px 20px',
                fontSize: '0.88rem',
                background: viewMode === 'quotes' ? 'linear-gradient(135deg, #BE123C, #8C2F4B)' : 'rgba(255,255,255,0.08)',
                color: '#FFF',
                border: '1.5px solid rgba(253, 230, 138, 0.4)'
              }}
            >
              💬 Thước Phim Lời Chúc
            </button>
          </div>
        </div>

        {viewMode === 'video' ? (
          <div className="cinema-theatre-box" style={{ padding: '16px 20px 24px', background: '#FAF3EA' }}>
            {/* Quick Option Pills ngay trên đầu Player */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '14px' }}>
              {videoPlaylist.map((video, idx) => {
                const isSelected = idx === selectedVideoIndex;
                return (
                  <button
                    key={video.id}
                    onClick={() => handleSelectVideo(idx)}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '9999px',
                      fontSize: '0.84rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      transition: 'all 0.25s',
                      background: isSelected ? 'linear-gradient(135deg, #BE123C, #8C2F4B)' : '#FFF',
                      color: isSelected ? '#FFF' : '#334155',
                      border: isSelected ? '1.5px solid var(--champagne-gold)' : '1px solid var(--rose-200)',
                      boxShadow: isSelected ? '0 4px 12px rgba(190, 18, 60, 0.35)' : 'none',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    <span>{video.icon}</span>
                    <span>{video.tag}</span>
                  </button>
                );
              })}
            </div>

            {/* 1. Màn Hình Rạp Chiếu Chính (Duy nhất 1 player, preload metadata để siêu mượt) */}
            <div className="cinema-video-player-wrapper">
              <div className="cinema-video-frame">
                <video
                  ref={videoRef}
                  key={activeVideo.src}
                  src={activeVideo.src}
                  poster={activeVideo.poster}
                  preload="auto"
                  controls
                  autoPlay
                  playsInline
                  onPlay={handleVideoPlay}
                  onEnded={handleVideoEnded}
                  className="cinema-video-element"
                />
              </div>

              {/* Thanh Thông Tin Video Đang Phát */}
              <div className="cinema-current-video-bar">
                <div>
                  <div className="current-video-title">
                    <span>{activeVideo.icon} {activeVideo.title}</span>
                    <span style={{ fontSize: '0.75rem', background: 'var(--rose-700)', color: '#FFF', padding: '2px 8px', borderRadius: '9999px' }}>
                      Option: {activeVideo.tag}
                    </span>
                  </div>
                  <div className="current-video-desc">
                    {activeVideo.desc}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => setIsAutoPlayNext(!isAutoPlayNext)}
                    style={{
                      background: isAutoPlayNext ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                      border: '1px solid ' + (isAutoPlayNext ? '#10B981' : 'rgba(255,255,255,0.2)'),
                      color: isAutoPlayNext ? '#A7F3D0' : '#E2E8F0',
                      borderRadius: '9999px',
                      padding: '4px 12px',
                      fontSize: '0.78rem',
                      cursor: 'pointer'
                    }}
                    title="Tự động phát video tiếp theo khi hết 10 giây"
                  >
                    {isAutoPlayNext ? '✓ Tự chuyển tiếp' : 'Dừng khi hết'}
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Danh Sách Các Video Tri Ân (Playlist Options) */}
            <div className="cinema-playlist-container">
              <div className="playlist-header-row">
                <div className="playlist-title">
                  <span>🎞️ CHỌN VIDEO LỜI CHÚC ({videoPlaylist.length} OPTION)</span>
                </div>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>
                  Bấm vào ô để đổi video
                </span>
              </div>

              <div className="playlist-grid">
                {videoPlaylist.map((video, idx) => {
                  const isActive = idx === selectedVideoIndex;
                  return (
                    <div
                      key={video.id}
                      className={`playlist-card ${isActive ? 'active' : ''}`}
                      onClick={() => handleSelectVideo(idx)}
                    >
                      <div className="card-thumbnail-box">
                        <img
                          src={video.poster}
                          alt={video.title}
                          className="card-thumbnail-img"
                          loading="lazy"
                        />
                        {isActive && (
                          <div className="card-playing-badge">
                            ▶ Đang chiếu
                          </div>
                        )}
                        <div className="card-duration-badge">
                          ⏱ {video.duration}
                        </div>
                      </div>

                      <div className="card-video-name">
                        {video.icon} {video.tag}
                      </div>
                      <div className="card-video-tag">
                        {video.title}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Khung Chiếu Trích Dẫn Tri Ân */
          <div className="cinema-theatre-box">
            <div className="theatre-badge-pill">
              <span>{currentQuote.icon}</span>
              <span>{currentQuote.category}</span>
            </div>

            <div className="theatre-quote-box">
              <h3
                key={currentQuoteIndex}
                className="theatre-quote-text quote-fade-anim"
              >
                {currentQuote.text}
              </h3>
            </div>

            <div
              key={`author-${currentQuoteIndex}`}
              className="theatre-author-info quote-fade-anim"
            >
              <div className="author-name">— {currentQuote.author} —</div>
              <div className="author-tag">✦ {currentQuote.badge} ✦</div>
            </div>

            <div className="theatre-timeline-bar">
              {quotes.map((q, idx) => (
                <div
                  key={idx}
                  className={`timeline-segment ${idx === currentQuoteIndex ? 'active' : ''}`}
                  onClick={() => setCurrentQuoteIndex(idx)}
                />
              ))}
            </div>

            <div className="theatre-controls-row">
              <button
                onClick={() => setCurrentQuoteIndex((currentQuoteIndex - 1 + quotes.length) % quotes.length)}
                className="btn-theatre-ctrl"
                title="Khung hình trước"
              >
                ❮
              </button>

              <button
                onClick={() => setIsQuoteAutoPlay(!isQuoteAutoPlay)}
                className="btn-theatre-play"
                title={isQuoteAutoPlay ? "Tạm dừng chiếu" : "Tiếp tục chiếu"}
              >
                {isQuoteAutoPlay ? '⏸ Tạm dừng' : '▶️ Tự động chiếu'}
              </button>

              <button
                onClick={() => setCurrentQuoteIndex((currentQuoteIndex + 1) % quotes.length)}
                className="btn-theatre-ctrl"
                title="Khung hình kế tiếp"
              >
                ❯
              </button>
            </div>
          </div>
        )}

        {/* Nút Chuyển Màn Tiếp Theo */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={() => navigateWithFlowerTransition('/party')}
            className="btn-golden-rose"
          >
            <span>Màn Kết: Nhận Quà Thật &amp; Tải Thiệp Kỷ Niệm 💐</span>
          </button>
        </div>
      </div>
    </div>
  );
}
