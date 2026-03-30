import { useEffect, useRef } from "react";

type Point = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  z: number;
};

const NODE_COUNT = 22;

export function HomeGraphHero() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    let rafId = 0;
    let disposed = false;
    const points: Point[] = [];

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(320, Math.floor(rect.width * window.devicePixelRatio));
      canvas.height = Math.max(180, Math.floor(rect.height * window.devicePixelRatio));
      context.setTransform(window.devicePixelRatio, 0, 0, window.devicePixelRatio, 0, 0);

      if (points.length === 0) {
        for (let index = 0; index < NODE_COUNT; index += 1) {
          points.push({
            x: Math.random() * rect.width,
            y: Math.random() * rect.height,
            vx: (Math.random() - 0.5) * 0.34,
            vy: (Math.random() - 0.5) * 0.34,
            z: Math.random(),
          });
        }
      }
    };

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      context.clearRect(0, 0, rect.width, rect.height);

      for (let i = 0; i < points.length; i += 1) {
        const node = points[i];
        node.x += node.vx;
        node.y += node.vy;

        if (node.x < 0 || node.x > rect.width) {
          node.vx *= -1;
        }
        if (node.y < 0 || node.y > rect.height) {
          node.vy *= -1;
        }

        for (let j = i + 1; j < points.length; j += 1) {
          const other = points[j];
          const dx = node.x - other.x;
          const dy = node.y - other.y;
          const distance = Math.hypot(dx, dy);

          if (distance > 120) {
            continue;
          }

          const alpha = 1 - distance / 120;
          context.strokeStyle = `rgba(69, 141, 119, ${alpha * 0.34})`;
          context.lineWidth = 1;
          context.beginPath();
          context.moveTo(node.x, node.y);
          context.lineTo(other.x, other.y);
          context.stroke();
        }
      }

      points.forEach((node) => {
        const radius = 2.5 + node.z * 2.8;
        context.fillStyle = `rgba(26, 107, 87, ${0.55 + node.z * 0.4})`;
        context.beginPath();
        context.arc(node.x, node.y, radius, 0, Math.PI * 2);
        context.fill();
      });

      if (!disposed) {
        rafId = window.requestAnimationFrame(draw);
      }
    };

    resize();
    window.addEventListener("resize", resize);
    rafId = window.requestAnimationFrame(draw);

    return () => {
      disposed = true;
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="home-graph-hero" aria-hidden="true" />;
}
