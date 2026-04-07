import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  opacity: number;
};

const CONNECTION_DISTANCE = 140;
const BASE_SPEED = 0.22;
const MAX_DPR = 2;

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const particleCountForBounds = (width: number, height: number): number => {
  const densityTarget = Math.round((width * height) / 30000);
  return clamp(densityTarget, 18, 44);
};

const createParticle = (width: number, height: number): Particle => ({
  x: Math.random() * width,
  y: Math.random() * height,
  vx: (Math.random() - 0.5) * BASE_SPEED * 2,
  vy: (Math.random() - 0.5) * BASE_SPEED * 2,
  radius: 1.2 + Math.random() * 2.2,
  opacity: 0.2 + Math.random() * 0.45,
});

export function renderCanvas(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  width: number,
  height: number,
  accentColor: string
) {
  const connectionDistanceSq = CONNECTION_DISTANCE * CONNECTION_DISTANCE;

  ctx.clearRect(0, 0, width, height);

  for (const particle of particles) {
    particle.x += particle.vx;
    particle.y += particle.vy;

    if (particle.x <= 0 || particle.x >= width) {
      particle.vx *= -1;
      particle.x = clamp(particle.x, 0, width);
    }
    if (particle.y <= 0 || particle.y >= height) {
      particle.vy *= -1;
      particle.y = clamp(particle.y, 0, height);
    }
  }

  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 0.8;
  for (let i = 0; i < particles.length; i += 1) {
    const source = particles[i];
    for (let j = i + 1; j < particles.length; j += 1) {
      const target = particles[j];
      const dx = source.x - target.x;
      const dy = source.y - target.y;
      const distanceSq = dx * dx + dy * dy;

      if (distanceSq >= connectionDistanceSq) {
        continue;
      }

      ctx.globalAlpha = (1 - distanceSq / connectionDistanceSq) * 0.18;
      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.stroke();
    }
  }

  ctx.fillStyle = accentColor;
  for (const particle of particles) {
    ctx.globalAlpha = particle.opacity;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
}

export function ParticleCanvas({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let rafId = 0;
    let disposed = false;
    let width = 0;
    let height = 0;
    let reducedMotion = false;
    const particles: Particle[] = [];

    const accentColor =
      getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#1f7a63";

    const syncParticleCount = () => {
      const targetCount = particleCountForBounds(width, height);
      while (particles.length < targetCount) {
        particles.push(createParticle(width, height));
      }
      if (particles.length > targetCount) {
        particles.length = targetCount;
      }

      for (const particle of particles) {
        particle.x = clamp(particle.x, 0, width);
        particle.y = clamp(particle.y, 0, height);
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));

      const dpr = clamp(window.devicePixelRatio || 1, 1, MAX_DPR);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      syncParticleCount();
    };

    const draw = () => {
      if (disposed || width === 0 || height === 0) {
        return;
      }

      renderCanvas(ctx, particles, width, height, accentColor);

      if (!reducedMotion) {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    const motionMedia = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncMotionMode = () => {
      reducedMotion = motionMedia.matches;
      window.cancelAnimationFrame(rafId);
      rafId = 0;

      if (reducedMotion) {
        draw();
      } else {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(rafId);
        rafId = 0;
        return;
      }

      if (!reducedMotion && rafId === 0) {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    const observer = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => resize())
      : null;

    resize();
    if (observer) {
      observer.observe(canvas);
    } else {
      window.addEventListener("resize", resize);
    }

    motionMedia.addEventListener("change", syncMotionMode);
    document.addEventListener("visibilitychange", handleVisibility);
    syncMotionMode();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      document.removeEventListener("visibilitychange", handleVisibility);
      motionMedia.removeEventListener("change", syncMotionMode);
      if (observer) {
        observer.disconnect();
      } else {
        window.removeEventListener("resize", resize);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
      }}
    />
  );
}
