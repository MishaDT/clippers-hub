"use client";

import { ChevronDown, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "reelpay:campaign-guide-collapsed";

export function CampaignGuide() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  function setGuideCollapsed(next: boolean) {
    setCollapsed(next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    if (next) videoRef.current?.pause();
  }

  async function playGuide() {
    const video = videoRef.current;
    if (!video) return;
    setStarted(true);
    video.load();
    await video.play();
  }

  if (collapsed) {
    return (
      <button className="campaign-guide-collapsed" type="button" onClick={() => setGuideCollapsed(false)}>
        <span><Play size={16} fill="currentColor" /> Как получить оплату за ролик</span>
        <ChevronDown size={18} />
      </button>
    );
  }

  return (
    <section className="campaign-guide" aria-label="Краткая инструкция">
      <button
        className="campaign-guide-close"
        type="button"
        onClick={() => setGuideCollapsed(true)}
        aria-label="Свернуть инструкцию"
      >
        <X size={18} />
      </button>
      <div className="campaign-guide-copy">
        <span>Старт за минуту</span>
        <h2>Как здесь заработать</h2>
        <ol>
          <li><b>1</b> Выбери заказ</li>
          <li><b>2</b> Сделай и опубликуй ролик</li>
          <li><b>3</b> Получи оплату после проверки</li>
        </ol>
      </div>
      <div className={`campaign-guide-media ${started ? "is-playing" : ""}`}>
        <video
          ref={videoRef}
          poster="/assets/reelpay-guide-poster.jpg"
          preload="none"
          playsInline
          controls={started}
          onEnded={() => setStarted(false)}
        >
          <source src="/assets/reelpay-guide.mp4" type="video/mp4" />
        </video>
        {!started ? (
          <button type="button" onClick={playGuide} aria-label="Посмотреть инструкцию">
            <Play size={22} fill="currentColor" />
            <span>Смотреть · 9 сек.</span>
          </button>
        ) : null}
      </div>
    </section>
  );
}
