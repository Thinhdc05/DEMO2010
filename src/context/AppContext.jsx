import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchPeople, fetchPublicWishes } from '../api.js';
import confetti from 'canvas-confetti';
import { playPopSound, playSparkleSound } from '../utils/soundEffects.js';

const AppContext = createContext();

export function AppProvider({ children, navigate }) {
  const [people, setPeople] = useState([]);
  const [wishes, setWishes] = useState([]);
  const [selectedSister, setSelectedSisterState] = useState(() => {
    try {
      const saved = localStorage.getItem('tribute_selected_sister');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  const setSelectedSister = (sister) => {
    setSelectedSisterState(sister);
    try {
      if (sister) {
        localStorage.setItem('tribute_selected_sister', JSON.stringify(sister));
      } else {
        localStorage.removeItem('tribute_selected_sister');
      }
    } catch (e) {}
  };

  const [openedBalloons, setOpenedBalloons] = useState(new Set());
  const [activeModalWish, setActiveModalWish] = useState(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Audio state
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);

  // Demo Experience Mode: '3d' | '2d'
  const [experienceMode, setExperienceMode] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const modeParam = (params.get('mode') || '').toLowerCase().trim();
    if (modeParam === '2d' || modeParam === '3d') {
      return modeParam;
    }
    // Nếu truy cập trực tiếp route #/3d
    if (typeof window !== 'undefined' && window.location.hash.includes('/3d')) {
      return '3d';
    }
    // MẶC ĐỊNH LUÔN LÀ '2d' để trang chủ luôn mở Hộp Quà 20/10 đầu tiên cho tất cả mọi người
    return '2d';
  });

  const updateExperienceMode = (mode, targetPath) => {
    setExperienceMode(mode);
    try {
      localStorage.setItem('tribute_mode', mode);
    } catch (e) {}

    if (targetPath) {
      navigateWithFlowerTransition(targetPath);
    } else if (mode === '3d') {
      navigateWithFlowerTransition('/3d');
    } else {
      navigateWithFlowerTransition('/letter');
    }
  };

  const toggleExperienceMode = () => {
    const next = experienceMode === '3d' ? '2d' : '3d';
    updateExperienceMode(next);
  };

  // Nạp dữ liệu ban đầu
  useEffect(() => {
    async function loadData() {
      const [peopleData, wishesData] = await Promise.all([
        fetchPeople(),
        fetchPublicWishes()
      ]);
      setPeople(peopleData);
      setWishes(wishesData);

      // Kiểm tra URL param (?to= hoặc ?id= hoặc ?mode=)
      const params = new URLSearchParams(window.location.search);
      const toParam = (params.get('to') || params.get('id') || '').toLowerCase().trim();
      if (toParam) {
        const found = peopleData.find(
          p => p.id === toParam || p.name.toLowerCase().includes(toParam)
        );
        if (found) {
          setSelectedSister(found);
        }
      } else {
        setSelectedSisterState(prev => {
          if (!prev || !prev.id) return prev;
          const matched = peopleData.find(p => p.id === prev.id);
          if (matched) {
            try {
              localStorage.setItem('tribute_selected_sister', JSON.stringify(matched));
            } catch (e) {}
            return matched;
          }
          return prev;
        });
      }
      const modeParam = (params.get('mode') || '').toLowerCase().trim();
      if (modeParam === '2d' || modeParam === '3d') {
        updateExperienceMode(modeParam);
      }
    }
    loadData();
  }, []);

  // Hàm chuyển trang kèm hiệu ứng Bão Cánh Hoa Điện Ảnh (Cinematic Floral Wipe)
  const navigateWithFlowerTransition = (targetPath) => {
    setIsTransitioning(true);
    playSparkleSound();

    // Kích hoạt pháo hoa cánh hoa tung bay toàn màn hình
    confetti({
      particleCount: 70,
      spread: 120,
      origin: { y: 0.5 },
      colors: ['#F43F5E', '#FDA4AF', '#FCD34D', '#FFF1F2', '#FECDD3']
    });

    setTimeout(() => {
      if (navigate) {
        navigate(targetPath);
      } else {
        window.location.hash = targetPath;
      }
    }, 450);

    setTimeout(() => {
      setIsTransitioning(false);
    }, 1100);
  };

  // Nổ bóng
  const popBalloon = (wish, coords) => {
    setOpenedBalloons(prev => new Set([...prev, wish.id]));
    setActiveModalWish(wish);
    playPopSound();

    // Bắn hạt cánh hoa tại tọa độ bóng
    const origin = coords || { x: 0.5, y: 0.5 };
    confetti({
      particleCount: 35,
      spread: 80,
      origin,
      colors: [wish.color || '#F43F5E', '#FDA4AF', '#FCD34D', '#FFFFFF', '#FECDD3']
    });
  };

  // Đánh dấu lời chúc đã mở khi chuyển thư tiếp theo trong modal
  const markWishOpened = (wishId) => {
    if (!wishId) return;
    setOpenedBalloons(prev => new Set([...prev, wishId]));
  };

  return (
    <AppContext.Provider value={{
      people,
      wishes,
      selectedSister,
      setSelectedSister,
      openedBalloons,
      popBalloon,
      markWishOpened,
      activeModalWish,
      setActiveModalWish,
      isArchiveOpen,
      setIsArchiveOpen,
      isTransitioning,
      navigateWithFlowerTransition,
      isPlayingMusic,
      setIsPlayingMusic,
      experienceMode,
      updateExperienceMode,
      toggleExperienceMode
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
