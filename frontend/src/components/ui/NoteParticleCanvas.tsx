"use client";

import { useEffect, useRef } from "react";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
};

const MIN_PARTICLES = 80;
const MAX_PARTICLES = 120;
const SPEED_LIMIT = 0.15;
const LINK_DISTANCE = 130;
const MOUSE_RADIUS = 150;
const PARTICLE_COLOR = "rgba(45, 106, 79, 0.4)";
const LINE_COLOR = "rgba(45, 106, 79, 0.15)";
const MOUSE_LINE_COLOR = "rgba(45, 106, 79, 0.5)";

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const particleCountForBounds = (width: number, height: number): number => {
  const estimated = Math.round((width * height) / 14000);
  return clamp(estimated, MIN_PARTICLES, MAX_PARTICLES);
};

const createParticle = (width: number, height: number): Particle => ({
  x: Math.random() * width,
  y: Math.random() * height,
  vx: (Math.random() * 2 - 1) * SPEED_LIMIT,
  vy: (Math.random() * 2 - 1) * SPEED_LIMIT,
  radius: 1.5 + Math.random() * 1.5,
});

export function NoteParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    const host = canvas.parentElement;
    if (!context || !host) {
      return;
    }

    let disposed = false;
    let animationFrame = 0;
    let width = 1;
    let height = 1;
    let particles: Particle[] = [];

    const mouse = {
      x: 0,
      y: 0,
      active: false,
    };

    const initializeParticles = () => {
      const nextCount = particleCountForBounds(width, height);
      particles = Array.from({ length: nextCount }, () => createParticle(width, height));
    };

    const applyCanvasSize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, Math.floor(rect.width));
      height = Math.max(1, Math.floor(rect.height));
      const dpr = clamp(window.devicePixelRatio || 1, 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      initializeParticles();
    };

    const updateParticles = () => {
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

        if (!mouse.active) {
          continue;
        }

        const dx = particle.x - mouse.x;
        const dy = particle.y - mouse.y;
        const distance = Math.hypot(dx, dy);
        if (distance === 0 || distance > MOUSE_RADIUS) {
          continue;
        }

        const influence = ((MOUSE_RADIUS - distance) / MOUSE_RADIUS) * 1.2;
        particle.x += (dx / distance) * influence;
        particle.y += (dy / distance) * influence;
        particle.x = clamp(particle.x, 0, width);
        particle.y = clamp(particle.y, 0, height);
      }
    };

    const drawFrame = () => {
      context.clearRect(0, 0, width, height);

      for (let i = 0; i < particles.length; i += 1) {
        const source = particles[i];
        for (let j = i + 1; j < particles.length; j += 1) {
          const target = particles[j];
          const dx = source.x - target.x;
          const dy = source.y - target.y;
          const distance = Math.hypot(dx, dy);

          if (distance > LINK_DISTANCE) {
            continue;
          }

          const sourceNearMouse = mouse.active && Math.hypot(source.x - mouse.x, source.y - mouse.y) <= MOUSE_RADIUS;
          const targetNearMouse = mouse.active && Math.hypot(target.x - mouse.x, target.y - mouse.y) <= MOUSE_RADIUS;

          context.strokeStyle = sourceNearMouse || targetNearMouse ? MOUSE_LINE_COLOR : LINE_COLOR;
          context.globalAlpha = 1 - distance / LINK_DISTANCE;
          context.lineWidth = 0.7;
          context.beginPath();
          context.moveTo(source.x, source.y);
          context.lineTo(target.x, target.y);
          context.stroke();
        }
      }

      context.globalAlpha = 1;
      context.fillStyle = PARTICLE_COLOR;
      for (const particle of particles) {
        context.beginPath();
        context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        context.fill();
      }
    };

    const tick = () => {
      if (disposed) {
        return;
      }

      updateParticles();
      drawFrame();
      animationFrame = window.requestAnimationFrame(tick);
    };

    const handleMouseMove = (event: MouseEvent) => {
      const rect = host.getBoundingClientRect();
      mouse.x = event.clientX - rect.left;
      mouse.y = event.clientY - rect.top;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            applyCanvasSize();
          })
        : null;

    if (resizeObserver) {
      resizeObserver.observe(host);
    } else {
      window.addEventListener("resize", applyCanvasSize);
    }

    host.addEventListener("mousemove", handleMouseMove);
    host.addEventListener("mouseleave", handleMouseLeave);

    applyCanvasSize();
    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(animationFrame);
      host.removeEventListener("mousemove", handleMouseMove);
      host.removeEventListener("mouseleave", handleMouseLeave);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", applyCanvasSize);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none note-particle-canvas"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        display: "block",
      }}
      aria-hidden="true"
    />
  );
}
