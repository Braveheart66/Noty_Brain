import { useEffect, useRef, type ComponentProps } from "react";
import * as THREE from "three";
import { cn } from "../../lib/utils";

type DottedSurfaceProps = Omit<ComponentProps<"div">, "ref">;

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

export function DottedSurface({ className, ...props }: DottedSurfaceProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const computedStyle = getComputedStyle(document.documentElement);
    const accentColor = new THREE.Color(computedStyle.getPropertyValue("--accent").trim() || "#1f7a63");
    const accentStrongColor = new THREE.Color(
      computedStyle.getPropertyValue("--accent-strong").trim() || "#135b4a",
    );
    const aiLinkColor = new THREE.Color(computedStyle.getPropertyValue("--ai-link").trim() || "#2a8f86");
    const lineColor = new THREE.Color(computedStyle.getPropertyValue("--line").trim() || "#b8cec1");
    const bgBottomColor = new THREE.Color(computedStyle.getPropertyValue("--bg-bottom").trim() || "#d9e7df");

    const fogColor = bgBottomColor.clone().multiplyScalar(0.28).lerp(new THREE.Color("#0b1612"), 0.45);
    const particleBaseColor = accentColor
      .clone()
      .lerp(new THREE.Color("#ffffff"), 0.36)
      .lerp(aiLinkColor, 0.14);
    const fallbackRgb = {
      r: Math.round(particleBaseColor.r * 255),
      g: Math.round(particleBaseColor.g * 255),
      b: Math.round(particleBaseColor.b * 255),
    };

    const initFallback2DSurface = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return () => undefined;
      }

      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      canvas.style.pointerEvents = "none";
      container.appendChild(canvas);

      const GRID_X = 36;
      const GRID_Y = 52;
      const MAX_DPR = 2;

      let width = 1;
      let height = 1;
      let count = 0;
      let animationId = 0;

      const syncCanvas = () => {
        const rect = container.getBoundingClientRect();
        width = Math.max(1, Math.floor(rect.width));
        height = Math.max(1, Math.floor(rect.height));
        const dpr = clamp(window.devicePixelRatio || 1, 1, MAX_DPR);

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      };

      const draw = () => {
        ctx.clearRect(0, 0, width, height);

        for (let ix = 0; ix < GRID_X; ix += 1) {
          for (let iy = 0; iy < GRID_Y; iy += 1) {
            const x = (ix / Math.max(1, GRID_X - 1)) * width;
            const z = (iy / Math.max(1, GRID_Y - 1)) * height;
            const wave =
              Math.sin((ix + count) * 0.27) * 10 +
              Math.sin((iy + count) * 0.46) * 12;
            const depth = iy / Math.max(1, GRID_Y - 1);
            const y = z + wave * (0.35 + depth * 0.7);
            const radius = 1.2 + depth * 1.4;
            const alpha = clamp(0.06 + depth * 0.22, 0.06, 0.28);

            ctx.fillStyle = `rgba(${fallbackRgb.r}, ${fallbackRgb.g}, ${fallbackRgb.b}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();

            if (ix < GRID_X - 1) {
              const nextX = ((ix + 1) / Math.max(1, GRID_X - 1)) * width;
              const nextWave =
                Math.sin((ix + 1 + count) * 0.27) * 10 +
                Math.sin((iy + count) * 0.46) * 12;
              const nextY = z + nextWave * (0.35 + depth * 0.7);
              ctx.strokeStyle = `rgba(${fallbackRgb.r}, ${fallbackRgb.g}, ${fallbackRgb.b}, ${0.03 + depth * 0.08})`;
              ctx.lineWidth = 0.6;
              ctx.beginPath();
              ctx.moveTo(x, y);
              ctx.lineTo(nextX, nextY);
              ctx.stroke();
            }
          }
        }

        count += 0.06;

        animationId = requestAnimationFrame(draw);
      };

      const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncCanvas) : null;
      if (observer) {
        observer.observe(container);
      } else {
        window.addEventListener("resize", syncCanvas);
      }

      syncCanvas();
      draw();

      return () => {
        cancelAnimationFrame(animationId);
        if (observer) {
          observer.disconnect();
        } else {
          window.removeEventListener("resize", syncCanvas);
        }
        if (canvas.parentElement === container) {
          container.removeChild(canvas);
        }
      };
    };

    const hasWebGLSupport = () => {
      if (typeof WebGLRenderingContext === "undefined") {
        return false;
      }
      const probeCanvas = document.createElement("canvas");
      return Boolean(
        probeCanvas.getContext("webgl", { alpha: true }) ||
          probeCanvas.getContext("experimental-webgl"),
      );
    };

    if (!hasWebGLSupport()) {
      return initFallback2DSurface();
    }

    const SEPARATION = 128;
    const AMOUNT_X = 36;
    const AMOUNT_Y = 56;
    const WAVE_HEIGHT_X = 34;
    const WAVE_HEIGHT_Y = 30;
    const WAVE_SPEED = 0.031;
    const PARTICLE_SIZE = 5.4;
    const PARTICLE_OPACITY = 0.5;

    const CAMERA_BASE_Y = 44;
    const CAMERA_BASE_Z = 2360;
    const CAMERA_TARGET_Y = 6;
    const CAMERA_TARGET_Z = -3600;

    const palette = [
      particleBaseColor.clone(),
      particleBaseColor.clone().lerp(aiLinkColor, 0.24),
      particleBaseColor.clone().lerp(lineColor, 0.32),
      particleBaseColor.clone().lerp(accentStrongColor, 0.22),
    ];

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(fogColor, 900, 6200);

    const camera = new THREE.PerspectiveCamera(64, 1, 1, 14000);
    camera.position.set(0, CAMERA_BASE_Y, CAMERA_BASE_Z);
    camera.lookAt(0, CAMERA_TARGET_Y, CAMERA_TARGET_Z);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: true,
        powerPreference: "high-performance",
      });
    } catch {
      return initFallback2DSurface();
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(scene.fog.color, 0);
    container.appendChild(renderer.domElement);

    const totalParticles = AMOUNT_X * AMOUNT_Y;
    const positions = new Float32Array(totalParticles * 3);
    const colors = new Float32Array(totalParticles * 3);
    const sizes = new Float32Array(totalParticles);

    let index = 0;
    for (let ix = 0; ix < AMOUNT_X; ix++) {
      for (let iy = 0; iy < AMOUNT_Y; iy++) {
        const x = ix * SEPARATION - (AMOUNT_X * SEPARATION) / 2;
        const z = iy * SEPARATION - (AMOUNT_Y * SEPARATION) / 2;
        positions[index * 3] = x;
        positions[index * 3 + 1] = 0;
        positions[index * 3 + 2] = z;

        const color = palette[(ix * 7 + iy * 13) % palette.length];
        colors[index * 3] = color.r;
        colors[index * 3 + 1] = color.g;
        colors[index * 3 + 2] = color.b;
        sizes[index] = PARTICLE_SIZE + Math.random() * 2.2;

        index += 1;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uOpacity: { value: PARTICLE_OPACITY },
        uPointScale: { value: Math.min(window.devicePixelRatio || 1, 2) },
      },
      vertexShader: /* glsl */ `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        varying float vAlpha;

        uniform float uPointScale;

        void main() {
          vColor = color;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);

          float dist = max(1.0, -mvPosition.z);
          vAlpha = smoothstep(6800.0, 550.0, dist);

          gl_PointSize = size * (760.0 / dist) * uPointScale;
          gl_Position = projectionMatrix * mvPosition;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uOpacity;
        varying vec3 vColor;
        varying float vAlpha;

        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) {
            discard;
          }

          float alpha = smoothstep(0.5, 0.18, d) * uOpacity * vAlpha;
          gl_FragColor = vec4(vColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
    });

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    const positionAttribute = geometry.attributes.position as THREE.BufferAttribute;
    let count = 0;
    let animationId = 0;

    const syncSize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, Math.floor(rect.width));
      const height = Math.max(1, Math.floor(rect.height));
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);

      material.uniforms.uPointScale.value = Math.min(window.devicePixelRatio || 1, 2);
    };

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      const nextPositions = positionAttribute.array as Float32Array;
      let i = 0;
      for (let ix = 0; ix < AMOUNT_X; ix++) {
        for (let iy = 0; iy < AMOUNT_Y; iy++) {
          const p = i * 3;
          nextPositions[p] = ix * SEPARATION - (AMOUNT_X * SEPARATION) / 2;
          nextPositions[p + 2] = iy * SEPARATION - (AMOUNT_Y * SEPARATION) / 2;

          const z = nextPositions[p + 2];
          const depthProgress = clamp(
            (z - CAMERA_TARGET_Z) / (CAMERA_BASE_Z - CAMERA_TARGET_Z),
            0,
            1,
          );
          const distanceAttenuation = 0.34 + depthProgress * 0.82;
          const wave =
            Math.sin((ix + count) * 0.24) * WAVE_HEIGHT_X +
            Math.sin((iy + count) * 0.37) * WAVE_HEIGHT_Y;
          nextPositions[p + 1] = wave * distanceAttenuation;

          i += 1;
        }
      }

      positionAttribute.needsUpdate = true;

      // Subtle camera drift to reinforce "inside the field" presence.
      camera.position.x = Math.sin(count * 0.19) * 18;
      camera.position.y = CAMERA_BASE_Y + Math.sin(count * 0.15) * 4;
      camera.lookAt(0, CAMERA_TARGET_Y + Math.sin(count * 0.06) * 1.8, CAMERA_TARGET_Z);

      renderer.render(scene, camera);
      count += WAVE_SPEED;
    };

    window.addEventListener("resize", syncSize);
    syncSize();
    animate();

    return () => {
      window.removeEventListener("resize", syncSize);
      cancelAnimationFrame(animationId);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("dotted-surface", className)}
      aria-hidden="true"
      {...props}
    />
  );
}
