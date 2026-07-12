"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Heart, Play } from "lucide-react";
import styles from "./landing-phone.module.css";

type Clip = { poster: string; label: string; views: string; payout: string };

const clips: Clip[] = [
  { poster: "/assets/gaming-order.webp", label: "Нарезка стрима", views: "121K", payout: "+2 400 ₽" },
  { poster: "/assets/podcast-order.webp", label: "Момент из подкаста", views: "64K", payout: "+1 280 ₽" },
  { poster: "/assets/creator-nika.webp", label: "Обзор продукта", views: "38K", payout: "+760 ₽" },
  { poster: "/assets/hero-studio.webp", label: "Хайлайт матча", views: "205K", payout: "+4 100 ₽" }
];

export function LandingPhone() {
  const [active, setActive] = useState(0);
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && setVisible(true),
      { rootMargin: "120px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setInterval(() => setActive((value) => (value + 1) % clips.length), 2600);
    return () => clearInterval(timer);
  }, [visible]);

  const clip = clips[active];

  return (
    <div className={styles.wrap} ref={ref} aria-hidden="true">
      <div className={styles.phone}>
        <span className={styles.notch} />
        <div className={styles.screen}>
          <span className={styles.example}>пример</span>
          {clips.map((item, index) => (
            <img
              key={item.poster}
              src={visible ? item.poster : undefined}
              alt=""
              loading="lazy"
              className={index === active ? styles.slideActive : styles.slide}
            />
          ))}
          <span className={styles.play}><Play size={26} fill="currentColor" /></span>
          <div className={styles.overlay}>
            <b>{clip.label}</b>
            <div className={styles.stats}>
              <span><Eye size={13} /> {clip.views}</span>
              <span><Heart size={13} /> live</span>
            </div>
          </div>
        </div>
      </div>
      <div className={styles.payout} key={clip.payout}>{clip.payout}</div>
      <div className={styles.dots}>
        {clips.map((item, index) => (
          <i key={item.poster} className={index === active ? styles.dotOn : styles.dot} />
        ))}
      </div>
    </div>
  );
}
