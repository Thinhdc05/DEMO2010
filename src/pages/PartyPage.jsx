import React, { useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import confetti from 'canvas-confetti';
import CardStudio from '../components/CardStudio.jsx';

export default function PartyPage() {
  const { selectedSister } = useApp();
  const [thanksSent, setThanksSent] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const defaultName = selectedSister ? `Chị ${selectedSister.name}` : 'Chị Em Thân Thương';

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 4000);
  };

  // Thả tim cảm ơn các anh em
  const handleReaction = (emoji) => {
    confetti({
      particleCount: 50,
      spread: 80,
      origin: { y: 0.8 },
      colors: ['#F43F5E', '#FDA4AF', '#FCD34D', '#FFF1F2', '#FECDD3']
    });
    setThanksSent(true);
    showToast(`Bạn vừa gửi trao biểu tượng ${emoji} ngọt ngào đến toàn thể anh em! ❤️`);
  };

  return (
    <div className="page-screen" id="page-party">
      <div className="party-screen-container">
        {/* Header Màn Kết */}
        <div className="party-header">
          <div className="party-eyebrow">
            GRAND FINALE • HAPPY VIETNAMESE WOMEN'S DAY 20.10
          </div>
          <h2 className="party-title">
            Rạng Rỡ &amp; Vẹn Tròn Niềm Vui
          </h2>
          <p className="party-sub" style={{ maxWidth: '640px', margin: '0 auto 16px', lineHeight: '1.7', fontSize: '1.05rem', color: '#881337', fontStyle: 'italic' }}>
            🎁 Các anh em đã chuẩn bị những đóa hoa tươi thắm, trà bánh ngọt ngào và những phần quà kỷ niệm trực tiếp tại văn phòng dành tặng bạn!
          </p>
        </div>

        {/* STUDIO KHẮC THIỆP 4:5 CAO CẤP TÙY BIẾN CHO BẠN VÀ NGƯỜI THÂN */}
        <CardStudio
          defaultName={defaultName}
          defaultSender="Toàn thể anh em công ty kính chúc 💐"
        />

        {/* Khối Thả Tim Tri Ân */}
        <div className="reaction-sweet-box" style={{ marginTop: '36px' }}>
          <p className="reaction-sweet-title">
            Thả tim / Gửi lời cảm ơn lại đến toàn thể anh em bằng một chạm:
          </p>
          <div className="reaction-buttons-row">
            {['❤️', '🥰', '💐', '✨', '🎉'].map((emoji, idx) => (
              <button
                key={idx}
                onClick={() => handleReaction(emoji)}
                className="reaction-emoji-btn"
                type="button"
                title={`Thả biểu tượng ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
          {thanksSent && (
            <div className="thanks-feedback-msg">
              Cảm ơn bạn! Anh em đã nhận được tim và niềm vui từ bạn! Chúc bạn ngày 20/10 thật hạnh phúc! 🥰
            </div>
          )}
        </div>

        {/* Footer Bản Quyền */}
        <footer style={{ marginTop: '50px', paddingBottom: '20px', fontFamily: 'var(--font-sans)', fontSize: '0.84rem', color: '#94A3B8', textAlign: 'center' }}>
          <p style={{ marginBottom: '6px' }}>Built with ❤️ by anh em Dev, Tech &amp; Product Team • 20/10/2026</p>
          <p style={{ fontSize: '0.78rem' }}>
            <a href="#/sender" style={{ color: 'var(--rose-600)', textDecoration: 'none', fontWeight: '600' }} title="Chế độ soạn thảo của Anh Em">🔑 Studio Soạn Thảo Của Anh Em</a>
          </p>
        </footer>
      </div>

      {toastMsg && <div className="sweet-toast show">{toastMsg}</div>}
    </div>
  );
}
