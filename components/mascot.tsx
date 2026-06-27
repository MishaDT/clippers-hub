"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const defaultTips = [
  "Привет! Я Ридзи. Помогаю быстро понять, где деньги, правила и следующий шаг.",
  "Смотри на ставку за 1000 просмотров: чем она выше, тем выгоднее заказ.",
  "Сделал ролик? Выложи его на площадку и отправь ссылку во вкладке «Выложить».",
  "Перед откликом проверь цель, срок и запреты. Так меньше переделок.",
  "Оплата приходит после проверки просмотров и базового антифрода."
];

function tipsForPath(pathname: string, mode: "worker" | "client") {
  if (mode === "client") {
    if (pathname === "/campaigns") {
      return [
        "Здесь собраны только ваши кампании. Откройте нужную, чтобы проверить ролики и просмотры.",
        "Новая кампания создаётся центральной кнопкой «Создать»."
      ];
    }
    if (pathname === "/leaderboard") {
      return [
        "Откройте профиль исполнителя, чтобы посмотреть его работы и отправить приглашение."
      ];
    }
    if (pathname === "/feed") {
      return [
        "В ленте можно посмотреть опубликованные ролики и понять, какой формат работает лучше."
      ];
    }
    return [
      "Режим заказчика: кампании, ролики, исполнители и бюджет находятся в отдельных разделах."
    ];
  }

  if (/^\/campaigns\/[^/]+$/.test(pathname)) {
    return [
      "На этой странице главное: выплата, цель по просмотрам и срок. Если все подходит, жми «Откликнуться».",
      "Перед монтажом открой исходник и проверь правила публикации: площадки, теги и запреты.",
      "Лучший клип начинается с сильного первого кадра и крупных субтитров.",
      "Отклик не заставляет сразу сдавать работу. Он просто добавляет заказ в твой рабочий список."
    ];
  }

  if (pathname === "/campaigns") {
    return [
      "Выбирай заказ по ставке, сроку и сложности. Карточка покажет самое важное.",
      "Фильтры помогают быстро найти свою нишу: стримы, юмор, игры или бизнес."
    ];
  }

  if (pathname === "/upload") {
    return [
      "Здесь отправляешь готовую работу: ссылка должна вести на публичный ролик.",
      "Проверь, что в описании ролика есть нужные теги и код заказа."
    ];
  }

  return defaultTips;
}

export function Mascot() {
  const pathname = usePathname();
  const [mode, setMode] = useState<"worker" | "client">("worker");
  const tips = tipsForPath(pathname, mode);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(0);

  const blocked = pathname === "/login" || pathname === "/register" || pathname === "/chats";
  const quietPage = /^\/campaigns\/[^/]+$/.test(pathname) || pathname === "/leaderboard";

  useEffect(() => {
    setMode(document.cookie.includes("rp_role_mode=client") ? "client" : "worker");
  }, [pathname]);

  useEffect(() => {
    if (blocked) {
      setVisible(false);
      return;
    }

    setVisible(true);
    setTip(0);

    if (!quietPage && !sessionStorage.getItem("mascot-greeted")) {
      sessionStorage.setItem("mascot-greeted", "1");
      const t1 = setTimeout(() => setOpen(true), 1800);
      const t2 = setTimeout(() => setOpen(false), 9000);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [blocked, pathname, quietPage]);

  if (blocked || !visible) return null;

  const pageClass = `mascot-page-${pathname.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home"}`;

  return (
    <div className={`mascot ${pageClass}`} aria-live="polite">
      {open ? (
        <div className="mascot-bubble">
          {tips[tip]}
          <button className="mascot-close" type="button" aria-label="Скрыть Ридзи" onClick={() => setOpen(false)}>
            ×
          </button>
        </div>
      ) : null}
      <button
        className="mascot-body"
        type="button"
        aria-label="Подсказка от Ридзи"
        onClick={() => {
          setTip((t) => (t + 1) % tips.length);
          setOpen(true);
        }}
      >
        <svg viewBox="0 0 72 72" width="62" height="62" aria-hidden="true">
          <defs>
            <linearGradient id="mascotGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#fb7185" />
              <stop offset="0.52" stopColor="#ef4444" />
              <stop offset="1" stopColor="#f97316" />
            </linearGradient>
          </defs>
          <line x1="36" y1="13" x2="36" y2="5" stroke="#fb7185" strokeWidth="2.6" strokeLinecap="round" />
          <circle cx="36" cy="4" r="3.2" fill="#fb7185" />
          <path d="M13 38 a23 21 0 0 1 46 0" fill="none" stroke="#fb7185" strokeWidth="4.5" strokeLinecap="round" />
          <rect x="13" y="15" width="46" height="43" rx="15" fill="url(#mascotGrad)" />
          <rect x="19" y="23" width="34" height="27" rx="11" fill="#0b0b10" fillOpacity="0.32" />
          <g className="mascot-eyes">
            <circle cx="29" cy="35" r="5.2" fill="#fff" />
            <circle cx="43" cy="35" r="5.2" fill="#fff" />
            <circle cx="30" cy="36" r="2.5" fill="#0b0b10" />
            <circle cx="44" cy="36" r="2.5" fill="#0b0b10" />
            <circle cx="31.4" cy="34.2" r="1" fill="#fff" />
            <circle cx="45.4" cy="34.2" r="1" fill="#fff" />
          </g>
          <path d="M30 44 q6 4.5 12 0" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
          <rect x="8" y="32" width="9.5" height="16" rx="4.7" fill="#fb7185" />
          <rect x="54.5" y="32" width="9.5" height="16" rx="4.7" fill="#fb7185" />
        </svg>
      </button>
    </div>
  );
}
