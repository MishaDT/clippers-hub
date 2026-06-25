"use client";

import { useEffect, useRef } from "react";

type Flame = {
  angle: number;
  radius: number;
  length: number;
  width: number;
  speed: number;
  phase: number;
};

const palettes = {
  gold: { hot: "255, 247, 194", mid: "255, 216, 77", cold: "200, 255, 31" },
  lime: { hot: "242, 255, 208", mid: "200, 255, 31", cold: "124, 255, 37" },
  bronze: { hot: "255, 229, 173", mid: "231, 161, 70", cold: "200, 255, 31" }
};

function rgba(rgb: string, alpha: number) {
  return `rgba(${rgb}, ${alpha})`;
}

export function PodiumFlameCanvas({ tone = "lime", jet = false }: { tone?: keyof typeof palettes; jet?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    const canvasEl = canvas;
    const context = ctx;
    const palette = palettes[tone];
    const flameCount = jet ? 54 : 42;
    const flames: Flame[] = Array.from({ length: flameCount }, (_, index) => ({
      angle: (Math.PI * 2 * index) / flameCount + (Math.random() - 0.5) * 0.08,
      radius: 36 + Math.random() * 7,
      length: 8 + Math.random() * (jet ? 18 : 14),
      width: 1.8 + Math.random() * 3.8,
      speed: 0.012 + Math.random() * 0.018,
      phase: Math.random() * Math.PI * 2
    }));
    let raf = 0;

    function resize() {
      const rect = canvasEl.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvasEl.width = Math.max(1, Math.floor(rect.width * dpr));
      canvasEl.height = Math.max(1, Math.floor(rect.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function draw(time: number) {
      const w = canvasEl.clientWidth;
      const h = canvasEl.clientHeight;
      const cx = w / 2;
      const cy = h * (jet ? 0.58 : 0.55);
      context.clearRect(0, 0, w, h);
      context.save();
      context.globalCompositeOperation = "lighter";

      const base = context.createRadialGradient(cx, cy, 0, cx, cy, w * 0.55);
      base.addColorStop(0, rgba(palette.hot, 0.95));
      base.addColorStop(0.22, rgba(palette.mid, 0.58));
      base.addColorStop(0.5, rgba(palette.cold, 0.28));
      base.addColorStop(1, "transparent");
      context.fillStyle = base;
      context.beginPath();
      context.arc(cx, cy, w * 0.46, 0, Math.PI * 2);
      context.fill();

      const ringRadius = Math.min(w, h) * (jet ? 0.27 : 0.29);
      const flameScale = Math.min(w, h) / 180;
      for (const flame of flames) {
        const pulse = Math.sin(time * flame.speed + flame.phase);
        const a = flame.angle + Math.sin(time * 0.0008 + flame.phase) * 0.08;
        const inner = ringRadius + pulse * 4 * flameScale;
        const outer = inner + flame.length * flameScale * (0.9 + Math.max(0, pulse) * 0.62);
        const sx = cx + Math.cos(a) * inner;
        const sy = cy + Math.sin(a) * inner;
        const ex = cx + Math.cos(a) * outer;
        const ey = cy + Math.sin(a) * outer;
        const nx = Math.cos(a + Math.PI / 2);
        const ny = Math.sin(a + Math.PI / 2);
        const width = flame.width * flameScale * (0.62 + Math.max(0, pulse) * 0.42);
        const grad = context.createRadialGradient(ex, ey, 0, ex, ey, flame.length * 1.5);
        grad.addColorStop(0, rgba(palette.hot, 1));
        grad.addColorStop(0.24, rgba(palette.mid, 0.9));
        grad.addColorStop(0.72, rgba(palette.cold, 0.55));
        grad.addColorStop(1, "transparent");
        context.fillStyle = grad;
        context.beginPath();
        context.moveTo(sx + nx * width, sy + ny * width);
        context.quadraticCurveTo(cx + Math.cos(a) * (inner + outer) * 0.5 + nx * width * 1.05, cy + Math.sin(a) * (inner + outer) * 0.5 + ny * width * 1.05, ex, ey);
        context.quadraticCurveTo(cx + Math.cos(a) * (inner + outer) * 0.5 - nx * width * 1.05, cy + Math.sin(a) * (inner + outer) * 0.5 - ny * width * 1.05, sx - nx * width, sy - ny * width);
        context.closePath();
        context.fill();
      }

      if (jet) {
        for (let i = 0; i < 7; i += 1) {
          const sway = Math.sin(time * 0.003 + i) * 9;
          const top = cy - 90 - i * 7 + Math.sin(time * 0.004 + i) * 8;
          const grad = context.createLinearGradient(cx, cy - 15, cx + sway, top);
          grad.addColorStop(0, rgba(palette.hot, 0.95));
          grad.addColorStop(0.45, rgba(palette.mid, 0.82));
          grad.addColorStop(1, "transparent");
          context.fillStyle = grad;
          context.beginPath();
          context.moveTo(cx - 18 + i * 2, cy - 12);
          context.quadraticCurveTo(cx - 28 + sway, cy - 60, cx + sway, top);
          context.quadraticCurveTo(cx + 28 + sway, cy - 58, cx + 18 - i * 2, cy - 12);
          context.closePath();
          context.fill();
        }
      }

      context.restore();
      raf = requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);
    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, [jet, tone]);

  return <canvas className="podium-flame-canvas" ref={ref} aria-hidden="true" />;
}
