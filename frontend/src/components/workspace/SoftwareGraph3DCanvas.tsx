import { useEffect, useRef } from "react";

type GraphRenderMode = "2d" | "3d";

type SoftwareGraphNode = {
  id: string;
  title: string;
  source_type: string;
  tags: string[];
  color: string;
  val: number;
  x?: number;
  y?: number;
  z?: number;
};

type SoftwareGraphLink = {
  id: string;
  source: string;
  target: string;
  is_ai_generated: boolean;
  similarity_score: number | null;
};

type ProjectedNode = {
  id: string;
  title: string;
  color: string;
  screenX: number;
  screenY: number;
  radius: number;
  depth: number;
};

type NormalizedNode = {
  id: string;
  title: string;
  sourceType: string;
  color: string;
  val: number;
  nx: number;
  ny: number;
  nz: number;
};

type SceneState = {
  angleX: number;
  angleY: number;
  zoom: number;
  panX: number;
  panY: number;
  dragging: boolean;
  dragDistance: number;
  pointerX: number;
  pointerY: number;
};

type SoftwareGraph3DCanvasProps = {
  width: number;
  height: number;
  nodes: SoftwareGraphNode[];
  links: SoftwareGraphLink[];
  mode: GraphRenderMode;
  selectedNodeId: string | null;
  resetNonce: number;
  reduceMotion: boolean;
  onNodeClick: (nodeId: string) => void;
};

const AI_LINK_RGB = [42, 143, 134] as const;
const MANUAL_LINK_RGB = [138, 109, 59] as const;

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function toRgba(rgb: readonly [number, number, number], alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
}

function initialScene(mode: GraphRenderMode): SceneState {
  if (mode === "2d") {
    return {
      angleX: 0,
      angleY: 0,
      zoom: 1,
      panX: 0,
      panY: 0,
      dragging: false,
      dragDistance: 0,
      pointerX: 0,
      pointerY: 0,
    };
  }

  return {
    angleX: 0.38,
    angleY: 0.74,
    zoom: 1,
    panX: 0,
    panY: 0,
    dragging: false,
    dragDistance: 0,
    pointerX: 0,
    pointerY: 0,
  };
}

function buildNormalizedGraph(
  nodes: SoftwareGraphNode[],
  links: SoftwareGraphLink[],
  mode: GraphRenderMode,
): { nodes: NormalizedNode[]; links: SoftwareGraphLink[] } {
  if (nodes.length === 0) {
    return { nodes: [], links };
  }

  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  const sourceNodes = nodes.map((node) => {
    const x = typeof node.x === "number" ? node.x : 0;
    const y = typeof node.y === "number" ? node.y : 0;
    const z = mode === "2d" ? 0 : typeof node.z === "number" ? node.z : 0;
    sumX += x;
    sumY += y;
    sumZ += z;
    return {
      id: node.id,
      title: node.title,
      sourceType: node.source_type,
      color: node.color,
      val: node.val,
      x,
      y,
      z,
    };
  });

  const centerX = sumX / sourceNodes.length;
  const centerY = sumY / sourceNodes.length;
  const centerZ = sumZ / sourceNodes.length;

  let maxDistance = 0;
  sourceNodes.forEach((node) => {
    const dx = node.x - centerX;
    const dy = node.y - centerY;
    const dz = node.z - centerZ;
    const distance = Math.hypot(dx, dy, dz);
    if (distance > maxDistance) {
      maxDistance = distance;
    }
  });

  const targetRadius = mode === "3d" ? 290 : 320;
  const scale = maxDistance > 0 ? targetRadius / maxDistance : 1;

  return {
    nodes: sourceNodes.map((node) => ({
      id: node.id,
      title: node.title,
      sourceType: node.sourceType,
      color: node.color,
      val: node.val,
      nx: (node.x - centerX) * scale,
      ny: (node.y - centerY) * scale,
      nz: (node.z - centerZ) * scale,
    })),
    links,
  };
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function SoftwareGraph3DCanvas({
  width,
  height,
  nodes,
  links,
  mode,
  selectedNodeId,
  resetNonce,
  reduceMotion,
  onNodeClick,
}: SoftwareGraph3DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const projectedNodesRef = useRef<ProjectedNode[]>([]);
  const animationRef = useRef<number | null>(null);
  const sceneStateRef = useRef<SceneState>(initialScene(mode));
  const dataRef = useRef<{ nodes: NormalizedNode[]; links: SoftwareGraphLink[] }>({ nodes: [], links: [] });
  const selectedNodeRef = useRef<string | null>(selectedNodeId);
  const modeRef = useRef<GraphRenderMode>(mode);
  const reduceMotionRef = useRef(reduceMotion);
  const onNodeClickRef = useRef(onNodeClick);

  useEffect(() => {
    dataRef.current = buildNormalizedGraph(nodes, links, mode);
  }, [links, mode, nodes]);

  useEffect(() => {
    selectedNodeRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    modeRef.current = mode;
    sceneStateRef.current = initialScene(mode);
  }, [mode]);

  useEffect(() => {
    reduceMotionRef.current = reduceMotion;
  }, [reduceMotion]);

  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  useEffect(() => {
    sceneStateRef.current = initialScene(modeRef.current);
  }, [resetNonce]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || width <= 0 || height <= 0) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    let disposed = false;

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawFrame = () => {
      if (disposed) {
        return;
      }

      const scene = sceneStateRef.current;
      const activeMode = modeRef.current;
      const sceneData = dataRef.current;

      if (!scene.dragging && activeMode === "3d" && !reduceMotionRef.current) {
        scene.angleY += 0.00135;
      }

      const backgroundGradient = ctx.createRadialGradient(
        width * 0.32,
        height * 0.18,
        30,
        width * 0.52,
        height * 0.58,
        Math.max(width, height),
      );
      backgroundGradient.addColorStop(0, "rgba(250, 255, 251, 0.96)");
      backgroundGradient.addColorStop(0.6, "rgba(233, 244, 237, 0.96)");
      backgroundGradient.addColorStop(1, "rgba(218, 233, 224, 0.98)");
      ctx.fillStyle = backgroundGradient;
      ctx.fillRect(0, 0, width, height);

      const centerGlow = ctx.createRadialGradient(
        width * 0.5,
        height * 0.55,
        0,
        width * 0.5,
        height * 0.55,
        Math.max(width, height) * 0.45,
      );
      centerGlow.addColorStop(0, "rgba(255, 255, 255, 0.38)");
      centerGlow.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = centerGlow;
      ctx.fillRect(0, 0, width, height);

      const cosX = Math.cos(scene.angleX);
      const sinX = Math.sin(scene.angleX);
      const cosY = Math.cos(scene.angleY);
      const sinY = Math.sin(scene.angleY);

      const centerX = width / 2 + scene.panX;
      const centerY = height / 2 + scene.panY;
      const cameraDistance = 980;

      const projectedNodes = sceneData.nodes.map((node) => {
        let rotatedX = node.nx;
        let rotatedY = node.ny;
        let rotatedZ = node.nz;

        if (activeMode === "3d") {
          const xRotY = node.nx * cosY - node.nz * sinY;
          const zRotY = node.nx * sinY + node.nz * cosY;
          rotatedX = xRotY;
          rotatedY = node.ny * cosX - zRotY * sinX;
          rotatedZ = node.ny * sinX + zRotY * cosX;
        } else {
          rotatedZ = 0;
        }

        const perspective =
          activeMode === "3d"
            ? clamp((cameraDistance / (cameraDistance - rotatedZ)) * scene.zoom, 0.35, 3.2)
            : scene.zoom;

        const radiusBase = node.val * 0.8 + 3.4;
        const radius =
          activeMode === "3d"
            ? clamp(radiusBase * perspective * 0.9, 3.4, 22)
            : clamp(radiusBase * 0.86, 3.4, 15.5);

        return {
          id: node.id,
          title: node.title,
          color: node.color,
          screenX: centerX + rotatedX * perspective,
          screenY: centerY + rotatedY * perspective,
          radius,
          depth: rotatedZ,
        };
      });

      projectedNodesRef.current = projectedNodes;

      const projectedById = new Map<string, ProjectedNode>();
      projectedNodes.forEach((node) => projectedById.set(node.id, node));

      type ProjectedLink = {
        source: ProjectedNode;
        target: ProjectedNode;
        depth: number;
        isAi: boolean;
        similarity: number;
      };

      const projectedLinks: ProjectedLink[] = sceneData.links
        .map((link) => {
          const source = projectedById.get(link.source);
          const target = projectedById.get(link.target);
          if (!source || !target) {
            return null;
          }

          return {
            source,
            target,
            depth: (source.depth + target.depth) / 2,
            isAi: link.is_ai_generated,
            similarity: typeof link.similarity_score === "number" ? clamp(link.similarity_score, 0, 1) : link.is_ai_generated ? 0.58 : 0.38,
          };
        })
        .filter((item): item is ProjectedLink => Boolean(item));

      projectedLinks.sort((a, b) => a.depth - b.depth);

      projectedLinks.forEach((link) => {
        const depthFactor = activeMode === "3d" ? clamp((link.depth + 420) / 840, 0.16, 1) : 0.92;
        const alpha = (link.isAi ? 0.36 : 0.28) * depthFactor;
        const rgb = link.isAi ? AI_LINK_RGB : MANUAL_LINK_RGB;
        const widthBoost = link.isAi ? 0.88 : 0.52;

        ctx.strokeStyle = toRgba(rgb, alpha);
        ctx.lineWidth = (0.58 + link.similarity * 1.18 + widthBoost) * depthFactor;
        ctx.beginPath();
        ctx.moveTo(link.source.screenX, link.source.screenY);
        ctx.lineTo(link.target.screenX, link.target.screenY);
        ctx.stroke();

        if (activeMode === "3d" && depthFactor > 0.7) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
          ctx.lineWidth = Math.max(0.3, ctx.lineWidth * 0.45);
          ctx.beginPath();
          ctx.moveTo(link.source.screenX, link.source.screenY);
          ctx.lineTo(link.target.screenX, link.target.screenY);
          ctx.stroke();
        }
      });

      const nodesToDraw = [...projectedNodes].sort((a, b) => a.depth - b.depth);
      const selectedNodeIdValue = selectedNodeRef.current;
      const showAmbientLabels = nodesToDraw.length <= 68;

      nodesToDraw.forEach((node) => {
        const isSelected = node.id === selectedNodeIdValue;
        const depthFactor = activeMode === "3d" ? clamp((node.depth + 420) / 840, 0.26, 1) : 1;
        const glowStrength = isSelected ? 28 : 9 + depthFactor * 8;

        ctx.shadowBlur = glowStrength;
        ctx.shadowColor = node.color;
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.screenX, node.screenY, node.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = "rgba(255, 255, 255, 0.24)";
        ctx.beginPath();
        ctx.arc(
          node.screenX - node.radius * 0.3,
          node.screenY - node.radius * 0.32,
          Math.max(1.2, node.radius * 0.35),
          0,
          Math.PI * 2,
        );
        ctx.fill();

        if (isSelected) {
          ctx.strokeStyle = "rgba(18, 34, 29, 0.78)";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(node.screenX, node.screenY, node.radius + 3.6, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (isSelected || (showAmbientLabels && depthFactor > 0.8 && node.radius > 4.8)) {
          const title = node.title.length > 25 ? `${node.title.slice(0, 22)}...` : node.title;

          ctx.font = isSelected ? "600 11px IBM Plex Mono" : "500 10px IBM Plex Mono";
          const textWidth = ctx.measureText(title).width;
          const badgeWidth = textWidth + 10;
          const badgeHeight = isSelected ? 18 : 16;
          const badgeX = node.screenX - badgeWidth / 2;
          const badgeY = node.screenY - node.radius - badgeHeight - 6;

          drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 8);
          ctx.fillStyle = "rgba(247, 252, 248, 0.82)";
          ctx.fill();
          ctx.strokeStyle = "rgba(18, 34, 29, 0.2)";
          ctx.lineWidth = 0.8;
          ctx.stroke();

          ctx.fillStyle = "rgba(18, 34, 29, 0.86)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(title, node.screenX, badgeY + badgeHeight / 2 + 0.5);
        }
      });

      animationRef.current = requestAnimationFrame(drawFrame);
    };

    const hitTest = (clientX: number, clientY: number): string | null => {
      const rect = canvas.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      const nodesByDepth = [...projectedNodesRef.current].sort((a, b) => b.depth - a.depth);

      for (const node of nodesByDepth) {
        const dx = x - node.screenX;
        const dy = y - node.screenY;
        const distance = Math.hypot(dx, dy);
        if (distance <= node.radius + 6) {
          return node.id;
        }
      }

      return null;
    };

    const handlePointerDown = (event: PointerEvent) => {
      sceneStateRef.current.dragging = true;
      sceneStateRef.current.dragDistance = 0;
      sceneStateRef.current.pointerX = event.clientX;
      sceneStateRef.current.pointerY = event.clientY;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: PointerEvent) => {
      const scene = sceneStateRef.current;
      if (!scene.dragging) {
        return;
      }

      const dx = event.clientX - scene.pointerX;
      const dy = event.clientY - scene.pointerY;

      scene.pointerX = event.clientX;
      scene.pointerY = event.clientY;
      scene.dragDistance += Math.abs(dx) + Math.abs(dy);

      if (modeRef.current === "3d") {
        scene.angleY += dx * 0.0054;
        scene.angleX = clamp(scene.angleX + dy * 0.0046, -1.25, 1.25);
      } else {
        scene.panX += dx;
        scene.panY += dy;
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      const scene = sceneStateRef.current;
      const wasDragging = scene.dragging;
      scene.dragging = false;
      canvas.style.cursor = "grab";

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      if (!wasDragging || scene.dragDistance > 7) {
        return;
      }

      const nodeId = hitTest(event.clientX, event.clientY);
      if (nodeId) {
        onNodeClickRef.current(nodeId);
      }
    };

    const handlePointerCancel = (event: PointerEvent) => {
      sceneStateRef.current.dragging = false;
      canvas.style.cursor = "grab";
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const scene = sceneStateRef.current;
      const zoomMin = modeRef.current === "3d" ? 0.58 : 0.42;
      const zoomMax = modeRef.current === "3d" ? 2.1 : 2.35;
      scene.zoom = clamp(scene.zoom - event.deltaY * 0.00085, zoomMin, zoomMax);
    };

    resizeCanvas();
    drawFrame();
    canvas.style.cursor = "grab";

    canvas.addEventListener("pointerdown", handlePointerDown);
    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerup", handlePointerUp);
    canvas.addEventListener("pointercancel", handlePointerCancel);
    canvas.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      disposed = true;
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerCancel);
      canvas.removeEventListener("wheel", handleWheel);

      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [height, width]);

  return (
    <canvas
      ref={canvasRef}
      className="software-graph-canvas"
      role="img"
      aria-label="Interactive software-rendered 3D knowledge graph"
    />
  );
}
