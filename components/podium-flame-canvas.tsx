"use client";

import { useEffect, useRef } from "react";

type FlameTongue = {
  angle: number;
  height: number;
  width: number;
  phase: number;
  speed: number;
  lean: number;
};

const palettes = {
  gold: { core: "255, 250, 205", body: "255, 197, 46", edge: "255, 112, 20" },
  lime: { core: "245, 255, 214", body: "190, 255, 38", edge: "75, 190, 35" },
  bronze: { core: "255, 239, 197", body: "238, 152, 52", edge: "174, 72, 25" }
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
    const palette = palettes[tone];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const count = jet ? 22 : 17;
    const tongues: FlameTongue[] = Array.from({ length: count }, (_, index) => ({
      angle: (index + 0.5) / count + (Math.random() - 0.5) * 0.025,
      height: 24 + Math.random() * (jet ? 36 : 26),
      width: 5 + Math.random() * 7,
      phase: Math.random() * Math.PI * 2,
      speed: 0.00035 + Math.random() * 0.00028,
      lean: (Math.random() - 0.5) * 10
    }));
    let raf = 0;
    let lastFrame = 0;
    let visible = true;

    function resize() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(1.6, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function tonguePath(
      baseX: number,
      baseY: number,
      tipX: number,
      tipY: number,
      width: number,
      bend: number
    ) {
      if (!ctx) return;
      ctx.beginPath();
      ctx.moveTo(baseX - width, baseY);
      ctx.bezierCurveTo(
        baseX - width * 1.2 + bend,
        baseY - (baseY - tipY) * 0.38,
        tipX - width * 0.35,
        tipY + (baseY - tipY) * 0.2,
        tipX,
        tipY
      );
      ctx.bezierCurveTo(
        tipX + width * 0.45,
        tipY + (baseY - tipY) * 0.22,
        baseX + width * 1.1 + bend,
        baseY - (baseY - tipY) * 0.34,
        baseX + width,
        baseY
      );
      ctx.closePath();
    }

    function draw(time: number) {
      raf = requestAnimationFrame(draw);
      if (!canvas || !ctx) return;
      if (!visible || time - lastFrame < 33) return;
      lastFrame = time;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      const cx = width / 2;
      const cy = height * 0.59;
      const ring = Math.min(width, height) * 0.255;
      const scale = Math.min(width, height) / 160;
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      const glow = ctx.createRadialGradient(cx, cy, ring * 0.2, cx, cy, ring * 1.9);
      glow.addColorStop(0, rgba(palette.core, 0.48));
      glow.addColorStop(0.38, rgba(palette.body, 0.22));
      glow.addColorStop(1, "transparent");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, ring * 1.85, 0, Math.PI * 2);
      ctx.fill();

      for (const tongue of tongues) {
        const wave = reduced ? 0 : Math.sin(time * tongue.speed + tongue.phase);
        const position = tongue.angle * 2 - 1;
        const baseX = cx + position * ring * 1.22;
        const baseY = cy + ring * (0.72 + Math.abs(position) * 0.12);
        const upwardBias = 0.82 + (1 - Math.abs(position)) * 0.38;
        const flameHeight = tongue.height * scale * upwardBias * (0.9 + wave * 0.12);
        const sway = reduced ? 0 : Math.sin(time * tongue.speed * 0.72 + tongue.phase) * 4.2 + tongue.lean;
        const tipX = baseX + sway * scale;
        const tipY = baseY - flameHeight;
        const flameWidth = tongue.width * scale * (0.96 + wave * 0.08);
        const gradient = ctx.createLinearGradient(baseX, baseY, tipX, tipY);
        gradient.addColorStop(0, rgba(palette.core, 0.82));
        gradient.addColorStop(0.34, rgba(palette.body, 0.88));
        gradient.addColorStop(0.78, rgba(palette.edge, 0.54));
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        tonguePath(baseX, baseY, tipX, tipY, flameWidth, sway * 0.34);
        ctx.fill();

        ctx.fillStyle = rgba(palette.core, 0.34);
        tonguePath(baseX, baseY, (baseX + tipX) / 2, tipY + flameHeight * 0.32, flameWidth * 0.38, sway * 0.12);
        ctx.fill();
      }

      if (jet) {
        const wave = reduced ? 0 : Math.sin(time * 0.00042) * 5;
        const gradient = ctx.createLinearGradient(cx, cy - ring * 0.2, cx + wave, cy - ring * 2.2);
        gradient.addColorStop(0, rgba(palette.core, 0.72));
        gradient.addColorStop(0.42, rgba(palette.body, 0.55));
        gradient.addColorStop(1, "transparent");
        ctx.fillStyle = gradient;
        tonguePath(cx, cy - ring * 0.1, cx + wave, cy - ring * 2.05, ring * 0.34, wave * 0.2);
        ctx.fill();
      }

      ctx.restore();
    }

    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    }, { rootMargin: "100px" });
    observer.observe(canvas);
    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(draw);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, [jet, tone]);

  return <canvas className="podium-flame-canvas" ref={ref} aria-hidden="true" />;
}
