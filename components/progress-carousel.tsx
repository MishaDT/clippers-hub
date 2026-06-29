"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Sparkles, Star, Trophy } from "lucide-react";

type Props = {
  league: {
    name: string;
    emoji: string;
    next: string | null;
    progress: number;
    viewsLabel: string;
  };
  achievement: {
    title: string;
    description: string;
    progress: number;
    valueLabel: string;
  };
  level: {
    value: number;
    progress: number;
    currentLabel: string;
    weekLabel: string;
  };
};

export function ProgressCarousel({ league, achievement, level }: Props) {
  const [active, setActive] = useState(0);
  const touchStart = useRef<number | null>(null);
  const slides = [
    {
      key: "league",
      eyebrow: "Текущая лига",
      icon: <span className="progress-carousel-emoji">{league.emoji}</span>,
      title: league.name,
      description: league.next ? `Следующая: ${league.next}` : "Высшая лига достигнута",
      progress: league.progress,
      footer: league.viewsLabel
    },
    {
      key: "achievement",
      eyebrow: "Ближайшая ачивка",
      icon: <Star size={20} />,
      title: achievement.title,
      description: achievement.description,
      progress: achievement.progress,
      footer: achievement.valueLabel
    },
    {
      key: "level",
      eyebrow: "Твой прогресс",
      icon: <Sparkles size={20} />,
      title: `Уровень ${level.value}`,
      description: level.weekLabel,
      progress: level.progress,
      footer: level.currentLabel
    }
  ];
  const move = (direction: number) => setActive((current) => (current + direction + slides.length) % slides.length);

  return (
    <section
      className="progress-carousel"
      aria-label="Лиги, ачивки и прогресс"
      onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientX ?? null; }}
      onTouchEnd={(event) => {
        if (touchStart.current == null) return;
        const delta = event.changedTouches[0].clientX - touchStart.current;
        if (Math.abs(delta) > 42) move(delta < 0 ? 1 : -1);
        touchStart.current = null;
      }}
    >
      <header>
        <span><Trophy size={16} /> Достижения</span>
        <Link href="/progress">Подробнее</Link>
      </header>
      <div className="progress-carousel-window">
        <div className="progress-carousel-track" style={{ transform: `translateX(-${active * 100}%)` }}>
          {slides.map((slide, index) => (
            <article aria-hidden={active !== index} key={slide.key}>
              <div className="progress-carousel-icon">{slide.icon}</div>
              <div className="progress-carousel-copy">
                <small>{slide.eyebrow}</small>
                <strong>{slide.title}</strong>
                <p>{slide.description}</p>
                <div className="progress-carousel-bar"><i style={{ width: `${Math.max(3, slide.progress)}%` }} /></div>
                <em>{slide.footer}</em>
              </div>
            </article>
          ))}
        </div>
      </div>
      <footer>
        <button type="button" onClick={() => move(-1)} aria-label="Предыдущий блок"><ChevronLeft size={16} /></button>
        <div>
          {slides.map((slide, index) => (
            <button
              className={active === index ? "active" : ""}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Открыть: ${slide.eyebrow}`}
              aria-current={active === index}
              key={slide.key}
            />
          ))}
        </div>
        <button type="button" onClick={() => move(1)} aria-label="Следующий блок"><ChevronRight size={16} /></button>
      </footer>
    </section>
  );
}
