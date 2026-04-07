import { useEffect, useRef } from "react";

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
  sourceType: string;
  color: string;
  screenX: number;
  screenY: number;
  radius: number;
  depth: number;
};

type SoftwareGraph3DCanvasProps = {
  width: number;
  height: number;
  nodes: SoftwareGraphNode[];
  links: SoftwareGraphLink[];
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

export function SoftwareGraph3DCanvas({
  width,
  height,
  nodes,
  links,
  selectedNodeId,
  resetNonce,
  reduceMotion,
  onNodeClick,
}: SoftwareGraph3DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const projectedNodesRef = useRef<ProjectedNode[]>([]);
  const animationRef = useRef<number | null>(null);
  const sceneStateRef = useRef({
    angleX: 0.36,
    angleY: 0.68,
    zoom: 1,
    dragging: false,
    dragDistance: 0,
    pointerX: 0,
    pointerY: 0,
  });

  useEffect(() => {
    sceneStateRef.current.angleX = 0.36;
    sceneStateRef.current.angleY = 0.68;
    sceneStateRef.current.zoom = 1;
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

    const projectNode = (
      node: SoftwareGraphNode,
      cosX: number,
      sinX: number,
      cosY: number,
      sinY: number,
      centerX: number,
      centerY: number,
      sceneScale: number,
      cameraDistance: number,
      zoom: number,
    ): ProjectedNode => {
      const worldX = (node.x ?? 0) * sceneScale;
      const worldY = (node.y ?? 0) * sceneScale;
      const worldZ = (node.z ?? 0) * sceneScale;

      const xRotY = worldX * cosY - worldZ * sinY;
      const zRotY = worldX * sinY + worldZ * cosY;

      const yRotX = worldY * cosX - zRotY * sinX;
      const zRotX = worldY * sinX + zRotY * cosX;

      const perspective = cameraDistance / (cameraDistance - zRotX);
      const screenX = centerX + xRotY * perspective * zoom;
      const screenY = centerY + yRotX * perspective * zoom;
      const radius = clamp((node.val * 0.76 + 3.2) * perspective, 3.2, 22);

      return {
        id: node.id,
        title: node.title,
        sourceType: node.source_type,
        color: node.color,
        screenX,
        screenY,
        radius,
        depth: zRotX,
      };
    };

    const drawFrame = () => {
      if (disposed) {
        return;
      }

      const scene = sceneStateRef.current;

      if (!scene.dragging && !reduceMotion) {
        scene.angleY += 0.0016;
      }

      const cosX = Math.cos(scene.angleX);
      const sinX = Math.sin(scene.angleX);
      const cosY = Math.cos(scene.angleY);
      const sinY = Math.sin(scene.angleY);

      const centerX = width / 2;
      const centerY = height / 2;
      const sceneScale = Math.max(0.22, Math.min(width, height) / 940);
      const cameraDistance = 980;

      const projectedNodes = nodes.map((node) =>
        projectNode(node, cosX, sinX, cosY, sinY, centerX, centerY, sceneScale, cameraDistance, scene.zoom),
      );

      projectedNodesRef.current = projectedNodes;

      const projectedById = new Map<string, ProjectedNode>();
      projectedNodes.forEach((node) => projectedById.set(node.id, node));

      type ProjectedLink = {
        id: string;
        source: ProjectedNode;
        target: ProjectedNode;
        depth: number;
        isAi: boolean;
        similarity: number;
      };

      const projectedLinks: ProjectedLink[] = links
        .map((link) => {
          const source = projectedById.get(link.source);
          const target = projectedById.get(link.target);
          if (!source || !target) {
            return null;
          }

          return {
            id: link.id,
            source,
            target,
            depth: (source.depth + target.depth) / 2,
            isAi: link.is_ai_generated,
            similarity: typeof link.similarity_score === "number" ? clamp(link.similarity_score, 0, 1) : link.is_ai_generated ? 0.58 : 0.38,
          };
        })
        .filter((item): item is ProjectedLink => Boolean(item));

      projectedLinks.sort((a, b) => a.depth - b.depth);

      ctx.clearRect(0, 0, width, height);

      projectedLinks.forEach((link) => {
        const depthFactor = clamp((link.depth + 520) / 1040, 0.12, 1);
        const alpha = 0.08 + depthFactor * 0.48;
        const rgb = link.isAi ? AI_LINK_RGB : MANUAL_LINK_RGB;
        const widthBoost = link.isAi ? 0.8 : 0.42;

        ctx.strokeStyle = toRgba(rgb, alpha);
        ctx.lineWidth = (0.52 + link.similarity * 1.35 + widthBoost) * depthFactor;
        ctx.beginPath();
        ctx.moveTo(link.source.screenX, link.source.screenY);
        ctx.lineTo(link.target.screenX, link.target.screenY);
        ctx.stroke();
      });

      const nodesToDraw = [...projectedNodes].sort((a, b) => a.depth - b.depth);
      nodesToDraw.forEach((node) => {
        const isSelected = node.id === selectedNodeId;
        const depthFactor = clamp((node.depth + 520) / 1040, 0.25, 1);
        const glowStrength = isSelected ? 30 : 14;

        ctx.shadowBlur = glowStrength;
        ctx.shadowColor = node.color;
        ctx.fillStyle = node.color;
        ctx.beginPath();
        ctx.arc(node.screenX, node.screenY, node.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        if (isSelected) {
          ctx.strokeStyle = "rgba(18, 34, 29, 0.78)";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(node.screenX, node.screenY, node.radius + 3.6, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (isSelected || (depthFactor > 0.65 && node.radius > 4.3)) {
          const title = node.title.length > 25 ? `${node.title.slice(0, 22)}...` : node.title;
          ctx.fillStyle = "rgba(18, 34, 29, 0.84)";
          ctx.font = "500 11px IBM Plex Mono";
          ctx.textAlign = "center";
          ctx.fillText(title, node.screenX, node.screenY - node.radius - 7);
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

      scene.angleY += dx * 0.0056;
      scene.angleX = clamp(scene.angleX + dy * 0.0048, -1.25, 1.25);
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
        onNodeClick(nodeId);
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
      scene.zoom = clamp(scene.zoom - event.deltaY * 0.00085, 0.55, 2.05);
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
  }, [height, links, nodes, onNodeClick, reduceMotion, selectedNodeId, width]);

  return (
    <canvas
      ref={canvasRef}
      className="software-graph-canvas"
      role="img"
      aria-label="Interactive software-rendered 3D knowledge graph"
    />
  );
}
