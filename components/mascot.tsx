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
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(0);

  const blocked = pathname === "/login" || pathname === "/register";

  useEffect(() => {
    if (blocked) {
      setVisible(false);
      return;
    }
    if (typeof window === "undefined") return;
    setVisible(true);
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

  if (blocked || !visible) return null;

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
        <svg viewBox="0 0 72 72" width="62" height="62" aria-hidden="true">
          <defs>
            <linearGradient id="mascotGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#f43f8f" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          {/* antenna */}
          <line x1="36" y1="13" x2="36" y2="5" stroke="#f9a8d4" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="36" cy="4" r="3.2" fill="#f9a8d4" />
          {/* headphone band */}
          <path d="M13 38 a23 21 0 0 1 46 0" fill="none" stroke="#c4b5fd" strokeWidth="4.5" strokeLinecap="round" />
          {/* head */}
          <rect x="13" y="15" width="46" height="43" rx="15" fill="url(#mascotGrad)" />
          {/* screen face */}
          <rect x="19" y="23" width="34" height="27" rx="11" fill="#0b0b10" fillOpacity="0.32" />
          {/* eyes */}
          <g className="mascot-eyes">
            <circle cx="29" cy="35" r="5.2" fill="#fff" />
            <circle cx="43" cy="35" r="5.2" fill="#fff" />
            <circle cx="30" cy="36" r="2.5" fill="#0b0b10" />
            <circle cx="44" cy="36" r="2.5" fill="#0b0b10" />
            <circle cx="31.4" cy="34.2" r="1" fill="#fff" />
            <circle cx="45.4" cy="34.2" r="1" fill="#fff" />
          </g>
          {/* smile */}
          <path d="M30 44 q6 4.5 12 0" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
          {/* headphone cups */}
          <rect x="8" y="32" width="9.5" height="16" rx="4.7" fill="#a78bfa" />
          <rect x="54.5" y="32" width="9.5" height="16" rx="4.7" fill="#a78bfa" />
        </svg>
      </button>
    </div>
  );
}
