import { useEffect, useRef } from "react";
import * as THREE from "three";

type DottedSurfaceProps = {
  className?: string;
};

export function DottedSurface({ className = "" }: DottedSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    /* ── Tuning knobs ─────────────────────────────────────── */
    const SEPARATION = 120;
    const AMOUNT_X = 50;
    const AMOUNT_Y = 50;
    const WAVE_HEIGHT = 55;
    const WAVE_SPEED = 0.05;
    const PARTICLE_SIZE = 14;
    const PARTICLE_OPACITY = 0.7;

    /* ── Color palette (Noty Brain greens + accents) ──────── */
    const PALETTE = [
      new THREE.Color("#1f7a63"), // accent
      new THREE.Color("#2a8f86"), // ai-link teal
      new THREE.Color("#135b4a"), // accent-strong
      new THREE.Color("#0f6ba8"), // blue accent
      new THREE.Color("#54806e"), // muted green
    ];

    /* ── Scene ────────────────────────────────────────────── */
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      55,
      container.clientWidth / container.clientHeight,
      1,
      12000
    );
    camera.position.set(0, 420, 1400);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    /* ── Particles ────────────────────────────────────────── */
    const totalParticles = AMOUNT_X * AMOUNT_Y;
    const positions = new Float32Array(totalParticles * 3);
    const colors = new Float32Array(totalParticles * 3);
    const sizes = new Float32Array(totalParticles);

    let idx = 0;
    for (let ix = 0; ix < AMOUNT_X; ix++) {
      for (let iy = 0; iy < AMOUNT_Y; iy++) {
        const x = ix * SEPARATION - (AMOUNT_X * SEPARATION) / 2;
        const z = iy * SEPARATION - (AMOUNT_Y * SEPARATION) / 2;

        positions[idx * 3] = x;
        positions[idx * 3 + 1] = 0;
        positions[idx * 3 + 2] = z;

        // Pick a palette colour based on spatial hash for organic variation
        const hash = ((ix * 7 + iy * 13) % PALETTE.length + PALETTE.length) % PALETTE.length;
        const color = PALETTE[hash];
        colors[idx * 3] = color.r;
        colors[idx * 3 + 1] = color.g;
        colors[idx * 3 + 2] = color.b;

        sizes[idx] = PARTICLE_SIZE + Math.random() * 2;
        idx++;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    /* ── Custom shader for per-particle sizing ───────────── */
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: PARTICLE_OPACITY },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

          // Fade particles that are further from the camera
          float dist = -mvPosition.z;
          vAlpha = smoothstep(8000.0, 1200.0, dist);

          gl_PointSize = size * (800.0 / -mvPosition.z) * ${Math.min(window.devicePixelRatio, 2).toFixed(1)};
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          // Soft circle
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float alpha = smoothstep(0.5, 0.22, d) * uOpacity * vAlpha;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    /* ── Animation ────────────────────────────────────────── */
    let count = 0;
    let animationId: number;
    const posAttr = geometry.attributes.position as THREE.BufferAttribute;

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      let i = 0;
      for (let ix = 0; ix < AMOUNT_X; ix++) {
        for (let iy = 0; iy < AMOUNT_Y; iy++) {
          const yPos =
            Math.sin((ix + count) * 0.3) * WAVE_HEIGHT +
            Math.sin((iy + count) * 0.5) * WAVE_HEIGHT * 0.6;
          posAttr.array[i * 3 + 1] = yPos;
          i++;
        }
      }
      posAttr.needsUpdate = true;

      // Gentle camera orbit for depth
      const time = count * 0.12;
      camera.position.x = Math.sin(time * 0.04) * 180;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
      count += WAVE_SPEED;
    };

    /* ── Resize ───────────────────────────────────────────── */
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    animate();

    /* ── Cleanup ──────────────────────────────────────────── */
    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (container && renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`dotted-surface ${className}`}
      aria-hidden="true"
    />
  );
}
