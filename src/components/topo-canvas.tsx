import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  r: number;
  alpha: number;
  vy: number;
  phase: number;
  isMint: boolean;
};

const RIBBON_LINES = 26;
const RIBBON_SEGS = 100;

export function TopoCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    const mouse = { x: -1000, y: -1000 };
    const smoothMouse = { x: -1000, y: -1000 };

    function resize() {
      if (!canvas || !ctx) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function onMouseMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }

    function onMouseLeave() {
      mouse.x = -1000;
      mouse.y = -1000;
    }

    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    resize();

    const stars: Star[] = Array.from({ length: 85 }, () => {
      const bx = Math.random() * width;
      const by = Math.random() * height;
      return {
        x: bx,
        y: by,
        baseX: bx,
        baseY: by,
        r: 0.6 + Math.random() * 1.5,
        alpha: 0.15 + Math.random() * 0.45,
        vy: -(0.08 + Math.random() * 0.2),
        phase: Math.random() * Math.PI * 2,
        isMint: Math.random() > 0.35,
      };
    });

    function drawRibbons(t: number) {
      if (!ctx) return;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";

      for (let i = 0; i < RIBBON_LINES; i++) {
        const norm = i / (RIBBON_LINES - 1) - 0.5;
        const centerGlow = 1 - Math.abs(norm) * 2;

        ctx.beginPath();
        for (let s = 0; s <= RIBBON_SEGS; s++) {
          const u = s / RIBBON_SEGS;
          const bx = width * (0.25 + u * 0.85);
          const by = height * (0.95 - u * 0.88);

          const pinch = Math.sin(u * Math.PI * 2 - t * 0.4) * 0.45 + 0.75;
          const wave =
            Math.sin(u * 4.2 + t * 0.65 + norm * 3.0) * 48 +
            Math.cos(u * 6.5 - t * 0.45 + norm * 4.5) * 20;
          const offset = norm * (height * 0.26) * pinch + wave;

          let px = bx - offset * 0.45;
          let py = by + offset * 0.85;

          if (smoothMouse.x > -500) {
            const dx = px - smoothMouse.x;
            const dy = py - smoothMouse.y;
            const dist = Math.hypot(dx, dy);
            if (dist < 220 && dist > 0.1) {
              const f = Math.pow(1 - dist / 220, 2) * 24;
              px += (dx / dist) * f;
              py += (dy / dist) * f;
            }
          }

          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }

        const alpha = 0.02 + centerGlow * 0.065;
        ctx.strokeStyle = `rgba(110, 231, 183, ${alpha})`;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      ctx.restore();
    }

    let time = 0;
    let rafId = 0;

    function animate() {
      if (!ctx) return;
      time += 0.015;
      ctx.clearRect(0, 0, width, height);

      smoothMouse.x += (mouse.x - smoothMouse.x) * 0.08;
      smoothMouse.y += (mouse.y - smoothMouse.y) * 0.08;

      drawRibbons(time);

      for (const s of stars) {
        s.phase += 0.02;
        s.baseY += s.vy;
        if (s.baseY < -10) {
          s.baseY = height + 10;
          s.y = s.baseY;
        }

        let targetX = s.baseX;
        let targetY = s.baseY;

        if (smoothMouse.x > -500) {
          const dx = s.x - smoothMouse.x;
          const dy = s.y - smoothMouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 180 && dist > 0.1) {
            const push = Math.pow(1 - dist / 180, 2) * 35;
            targetX += (dx / dist) * push;
            targetY += (dy / dist) * push;
          }
        }

        s.x += (targetX - s.x) * 0.08;
        s.y += (targetY - s.y) * 0.08;

        const a = s.alpha * (0.65 + 0.35 * Math.sin(s.phase));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = s.isMint
          ? `rgba(167, 243, 208, ${a})`
          : `rgba(255, 255, 255, ${a * 0.8})`;
        ctx.fill();
      }

      rafId = requestAnimationFrame(animate);
    }

    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
    };
  }, []);

  return <canvas id="bg-canvas" ref={canvasRef} />;
}
