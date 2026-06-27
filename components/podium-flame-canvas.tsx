"use client";

import { useEffect, useRef } from "react";

type Ember = {
  offset: number;
  phase: number;
  speed: number;
  rise: number;
  size: number;
  drift: number;
};

const palettes = {
  gold: {
    core: "255,250,214",
    body: "255,191,36",
    edge: "255,82,18"
  },
  lime: {
    core: "245,255,218",
    body: "190,255,34",
    edge: "67,174,28"
  },
  bronze: {
    core: "255,239,201",
    body: "239,145,44",
    edge: "162,59,24"
  }
};

function rgba(value: string, alpha: number) {
  return `rgba(${value},${alpha})`;
}

export function PodiumFlameCanvas({ tone = "lime", jet = false }: { tone?: keyof typeof palettes; jet?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return;

    const palette = palettes[tone];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const count = jet ? 38 : 28;
    const embers: Ember[] = Array.from({ length: count }, () => ({
      offset: (Math.random() - 0.5) * 1.8,
      phase: Math.random(),
      speed: 0.00011 + Math.random() * 0.00007,
      rise: 46 + Math.random() * (jet ? 68 : 48),
      size: 5 + Math.random() * 9,
      drift: (Math.random() - 0.5) * 18
    }));

    let frame = 0;
    let lastFrame = 0;
    let visible = true;

    function resize() {
      if (!canvas || !context) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(1.6, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function flameBlob(
      x: number,
      y: number,
      radius: number,
      alpha: number,
      color: string,
      stretch: number
    ) {
      if (!context) return;
      const gradient = context.createRadialGradient(x, y, 0, x, y, radius * 2.2);
      gradient.addColorStop(0, rgba(color, alpha));
      gradient.addColorStop(0.36, rgba(color, alpha * 0.7));
      gradient.addColorStop(1, rgba(color, 0));
      context.fillStyle = gradient;
      context.beginPath();
      context.ellipse(x, y, radius * 1.2, radius * stretch, 0, 0, Math.PI * 2);
      context.fill();
    }

    function draw(time: number) {
      frame = requestAnimationFrame(draw);
      if (!canvas || !context) return;
      if (!visible || time - lastFrame < 33) return;
      lastFrame = time;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const cx = width / 2;
      const cy = height * 0.59;
      const scale = Math.min(width, height) / 160;
      const avatarRadius = Math.min(width, height) * (jet ? 0.235 : 0.225);
      context.clearRect(0, 0, width, height);
      context.save();
      context.globalCompositeOperation = "lighter";

      const halo = context.createRadialGradient(cx, cy, avatarRadius * 0.4, cx, cy, avatarRadius * 2);
      halo.addColorStop(0, rgba(palette.core, 0.2));
      halo.addColorStop(0.48, rgba(palette.body, 0.16));
      halo.addColorStop(1, rgba(palette.edge, 0));
      context.fillStyle = halo;
      context.beginPath();
      context.arc(cx, cy, avatarRadius * 2, 0, Math.PI * 2);
      context.fill();

      for (const ember of embers) {
        const progress = reduced ? ember.phase : (time * ember.speed + ember.phase) % 1;
        const life = Math.sin(progress * Math.PI);
        const side = Math.abs(ember.offset);
        const baseX = cx + ember.offset * avatarRadius;
        const baseY = cy + avatarRadius * (0.72 + side * 0.1);
        const sway = Math.sin(progress * Math.PI * 2 + ember.phase * 7) * ember.drift * scale;
        const x = baseX + sway * progress;
        const y = baseY - progress * ember.rise * scale;
        const size = ember.size * scale * (1 - progress * 0.48);
        const alpha = Math.max(0, life) * (0.36 + (1 - side / 1.2) * 0.2);

        flameBlob(x, y + size * 0.35, size * 1.45, alpha * 0.42, palette.edge, 1.8);
        flameBlob(x, y, size, alpha * 0.78, palette.body, 1.65);
        flameBlob(x, y + size * 0.28, size * 0.45, alpha * 0.78, palette.core, 1.45);
      }

      context.restore();
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    }, { rootMargin: "120px" });
    observer.observe(canvas);
    resize();
    window.addEventListener("resize", resize);
    frame = requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(frame);
    };
  }, [jet, tone]);

  return <canvas className="podium-flame-canvas" ref={ref} aria-hidden="true" />;
}
