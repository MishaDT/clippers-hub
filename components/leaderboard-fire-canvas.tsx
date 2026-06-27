"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  hue: number;
};

function spawn(width: number, height: number, crown = false): Particle {
  const center = width * (crown ? 0.5 : 0.5 + (Math.random() - 0.5) * 0.72);
  const base = crown ? height * 0.43 : height * (0.68 + Math.random() * 0.22);
  return {
    x: center + (Math.random() - 0.5) * (crown ? 64 : 120),
    y: base,
    vx: (Math.random() - 0.5) * (crown ? 0.45 : 0.8),
    vy: -(0.24 + Math.random() * (crown ? 0.72 : 0.52)),
    life: 0,
    max: 52 + Math.random() * 54,
    size: crown ? 3 + Math.random() * 8 : 2 + Math.random() * 6,
    hue: crown ? 44 + Math.random() * 34 : 72 + Math.random() * 34
  };
}

export function LeaderboardFireCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    const canvasEl = canvas;
    const context = ctx;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const particles: Particle[] = [];
    let raf = 0;
    let frame = 0;
    let lastFrame = 0;
    let visible = true;

    function resize() {
      const rect = canvasEl.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvasEl.width = Math.max(1, Math.floor(rect.width * dpr));
      canvasEl.height = Math.max(1, Math.floor(rect.height * dpr));
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function drawBranches(width: number, height: number, t: number) {
      context.save();
      context.globalCompositeOperation = "lighter";
      context.lineCap = "round";
      for (let side = -1; side <= 1; side += 2) {
        for (let i = 0; i < 9; i += 1) {
          const startX = width * 0.5;
          const startY = height * (0.75 - i * 0.035);
          const len = 70 + i * 13;
          const endX = startX + side * len;
          const endY = startY - 40 - i * 17;
          const pulse = 0.34 + Math.sin(t * 0.002 + i) * 0.12;
          const grad = context.createLinearGradient(startX, startY, endX, endY);
          grad.addColorStop(0, `rgba(202,255,37,${pulse})`);
          grad.addColorStop(1, "rgba(202,255,37,0)");
          context.strokeStyle = grad;
          context.lineWidth = Math.max(0.7, 2.1 - i * 0.12);
          context.beginPath();
          context.moveTo(startX, startY);
          context.quadraticCurveTo(startX + side * len * 0.38, startY - 18 - i * 4, endX, endY);
          context.stroke();
        }
      }
      context.restore();
    }

    function loop(time: number) {
      raf = requestAnimationFrame(loop);
      if (!visible || time - lastFrame < 33) return;
      lastFrame = time;
      const width = canvasEl.clientWidth;
      const height = canvasEl.clientHeight;
      context.clearRect(0, 0, width, height);
      drawBranches(width, height, time);

      if (!reduced) {
        frame += 1;
        const count = frame % 2 === 0 ? (width < 620 ? 1 : 2) : 0;
        for (let i = 0; i < count; i += 1) particles.push(spawn(width, height, frame % 6 === 0));
        if (particles.length > 100) particles.splice(0, particles.length - 100);
      }

      context.save();
      context.globalCompositeOperation = "lighter";
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.life += 1;
        p.x += p.vx + Math.sin((p.life + p.y) * 0.07) * 0.35;
        p.y += p.vy;
        p.vy -= 0.0008;
        const k = 1 - p.life / p.max;
        if (k <= 0) {
          particles.splice(i, 1);
          continue;
        }
        const radius = p.size * (0.7 + k * 1.2);
        const g = context.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 4.2);
        g.addColorStop(0, `hsla(${p.hue}, 100%, 82%, ${0.9 * k})`);
        g.addColorStop(0.35, `hsla(${p.hue}, 100%, 52%, ${0.42 * k})`);
        g.addColorStop(1, `hsla(${p.hue}, 100%, 48%, 0)`);
        context.fillStyle = g;
        context.beginPath();
        context.ellipse(p.x, p.y, radius * 1.4, radius * 3.2, Math.sin(p.life) * 0.3, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    }, { rootMargin: "120px" });
    observer.observe(canvasEl);
    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(loop);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return <canvas className="lb-fire-canvas" ref={ref} aria-hidden="true" />;
}
