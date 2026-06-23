"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const tips = [
  "Привет! Я Рилзи 👋 Залей клип — и получай за просмотры.",
  "Совет: бери заказы с высоким CPM — за 1000 просмотров платят больше.",
  "Сделал ролик? Вставь ссылку во вкладке «Выложить».",
  "Чем раньше выложишь, тем больше просмотров успеешь набрать до дедлайна.",
  "Оплата — после проверки. Накрутка не пройдёт: антифрод не дремлет 🙂"
];

export function Mascot() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(true);
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(0);

  const blocked = pathname === "/login" || pathname === "/register" || pathname === "/feed";

  useEffect(() => {
    if (blocked) {
      setHidden(true);
      return;
    }
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("mascot-dismissed")) {
      setHidden(true);
      return;
    }
    setHidden(false);
    if (!sessionStorage.getItem("mascot-greeted")) {
      sessionStorage.setItem("mascot-greeted", "1");
      const t1 = setTimeout(() => setOpen(true), 1800);
      const t2 = setTimeout(() => setOpen(false), 9000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [blocked, pathname]);

  if (blocked || hidden) return null;

  return (
    <div className="mascot" aria-live="polite">
      {open ? (
        <div className="mascot-bubble">
          {tips[tip]}
          <button
            className="mascot-close"
            type="button"
            aria-label="Скрыть Рилзи"
            onClick={() => {
              setOpen(false);
              setHidden(true);
              sessionStorage.setItem("mascot-dismissed", "1");
            }}
          >
            ×
          </button>
        </div>
      ) : null}
      <button
        className="mascot-body"
        type="button"
        aria-label="Подсказка от Рилзи"
        onClick={() => {
          setTip((t) => (t + 1) % tips.length);
          setOpen(true);
        }}
      >
        <svg viewBox="0 0 64 64" width="58" height="58" aria-hidden="true">
          <defs>
            <linearGradient id="mascotGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f43f8f" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          <line x1="32" y1="10" x2="32" y2="3" stroke="#f9a8d4" strokeWidth="2.4" strokeLinecap="round" />
          <circle cx="32" cy="3" r="3" fill="#f9a8d4" />
          <rect x="6" y="9" width="52" height="49" rx="22" fill="url(#mascotGrad)" />
          <ellipse cx="24" cy="31" rx="6.5" ry="7" fill="#fff" />
          <ellipse cx="40" cy="31" rx="6.5" ry="7" fill="#fff" />
          <circle cx="25.5" cy="32.5" r="3" fill="#0b0b10" />
          <circle cx="41.5" cy="32.5" r="3" fill="#0b0b10" />
          <circle cx="27" cy="31" r="1" fill="#fff" />
          <circle cx="43" cy="31" r="1" fill="#fff" />
          <path d="M24 43 Q32 50 40 43" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
