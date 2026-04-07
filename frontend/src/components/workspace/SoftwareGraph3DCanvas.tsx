import { useEffect, useRef } from "react";

export type GraphRenderMode = "2d" | "3d";
export type GraphVisualPreset = "cinematic" | "clean-minimal" | "dense-network";

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
  relationship_type?: string;
};

type Rgb = [number, number, number];

type SimNode = {
  id: string;
  title: string;
  sourceType: string;
  colorRgb: Rgb;
  val: number;
  baseX: number;
  baseY: number;
  baseZ: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  seed: number;
  dragLocked: boolean;
};

type SimLink = {
  sourceIndex: number;
  targetIndex: number;
  isAi: boolean;
  similarity: number;
  synthetic: boolean;
  seed: number;
};

type ProjectedNode = {
  id: string;
  index: number;
  title: string;
  sourceType: string;
  colorRgb: Rgb;
  screenX: number;
  screenY: number;
  radius: number;
  depth: number;
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
  dragMode: "none" | "scene" | "node";
  dragNodeIndex: number | null;
  dragNodeDepth: number;
};

type SimulationData = {
  nodes: SimNode[];
  links: SimLink[];
};

type PresetTuning = {
  background2DInner: string;
  background2DOuter: string;
  background3DInner: string;
  background3DOuter: string;
  edgeAlpha: number;
  edgeSway: number;
  edgeTubeBoost: number;
  edgeLength: number;
  edgeSpring: number;
  baseSpring: number;
  damping: number;
  maxSpeed: number;
  repulsion: number;
  floatiness: number;
  extraNeighbors: number;
  nodeAlpha2D: number;
  nodeAlpha3D: number;
  glowStrength: number;
  labelThreshold: number;
  orbitSpeed: number;
  spinSpeed: number;
};

type SoftwareGraph3DCanvasProps = {
  width: number;
  height: number;
  nodes: SoftwareGraphNode[];
  links: SoftwareGraphLink[];
  mode: GraphRenderMode;
  preset: GraphVisualPreset;
  selectedNodeId: string | null;
  resetNonce: number;
  reduceMotion: boolean;
  onNodeClick: (nodeId: string) => void;
};

const AI_LINK_RGB: Rgb = [42, 143, 134];
const MANUAL_LINK_RGB: Rgb = [138, 109, 59];
const CAMERA_DISTANCE = 980;

const PRESET_TUNING: Record<GraphVisualPreset, PresetTuning> = {
  cinematic: {
    background2DInner: "rgba(248, 255, 251, 0.95)",
    background2DOuter: "rgba(219, 235, 227, 0.98)",
    background3DInner: "rgba(240, 252, 245, 0.96)",
    background3DOuter: "rgba(203, 224, 214, 0.98)",
    edgeAlpha: 0.42,
    edgeSway: 14,
    edgeTubeBoost: 0.62,
    edgeLength: 118,
    edgeSpring: 0.0058,
    baseSpring: 0.011,
    damping: 0.886,
    maxSpeed: 8.8,
    repulsion: 980,
    floatiness: 0.0012,
    extraNeighbors: 2,
    nodeAlpha2D: 0.9,
    nodeAlpha3D: 0.54,
    glowStrength: 16,
    labelThreshold: 54,
    orbitSpeed: 1.15,
    spinSpeed: 0.00125,
  },
  "clean-minimal": {
    background2DInner: "rgba(252, 255, 253, 0.97)",
    background2DOuter: "rgba(231, 243, 236, 0.98)",
    background3DInner: "rgba(247, 254, 249, 0.97)",
    background3DOuter: "rgba(218, 236, 227, 0.98)",
    edgeAlpha: 0.3,
    edgeSway: 7,
    edgeTubeBoost: 0.32,
    edgeLength: 124,
    edgeSpring: 0.0047,
    baseSpring: 0.012,
    damping: 0.898,
    maxSpeed: 7.4,
    repulsion: 760,
    floatiness: 0.00075,
    extraNeighbors: 1,
    nodeAlpha2D: 0.88,
    nodeAlpha3D: 0.44,
    glowStrength: 11,
    labelThreshold: 38,
    orbitSpeed: 0.95,
    spinSpeed: 0.00085,
  },
  "dense-network": {
    background2DInner: "rgba(244, 253, 248, 0.96)",
    background2DOuter: "rgba(206, 227, 216, 0.98)",
    background3DInner: "rgba(233, 249, 239, 0.96)",
    background3DOuter: "rgba(189, 214, 202, 0.98)",
    edgeAlpha: 0.52,
    edgeSway: 18,
    edgeTubeBoost: 0.84,
    edgeLength: 106,
    edgeSpring: 0.0072,
    baseSpring: 0.0105,
    damping: 0.874,
    maxSpeed: 9.9,
    repulsion: 1180,
    floatiness: 0.0016,
    extraNeighbors: 4,
    nodeAlpha2D: 0.92,
    nodeAlpha3D: 0.62,
    glowStrength: 18,
    labelThreshold: 66,
    orbitSpeed: 1.34,
    spinSpeed: 0.00155,
  },
};

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

function hashString(text: string): number {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function hexToRgb(input: string): Rgb {
  const hex = input.trim().replace("#", "");
  if (hex.length === 3) {
    const r = parseInt(`${hex[0]}${hex[0]}`, 16);
    const g = parseInt(`${hex[1]}${hex[1]}`, 16);
    const b = parseInt(`${hex[2]}${hex[2]}`, 16);
    return [r, g, b];
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return [r, g, b];
  }
  return [84, 96, 106];
}

function rgbaFromRgb(rgb: Rgb, alpha: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
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
      dragMode: "none",
      dragNodeIndex: null,
      dragNodeDepth: 0,
    };
  }

  return {
    angleX: 0.4,
    angleY: 0.74,
    zoom: 1,
    panX: 0,
    panY: 0,
    dragging: false,
    dragDistance: 0,
    pointerX: 0,
    pointerY: 0,
    dragMode: "none",
    dragNodeIndex: null,
    dragNodeDepth: 0,
  };
}

function buildSimulationData(
  nodes: SoftwareGraphNode[],
  links: SoftwareGraphLink[],
  mode: GraphRenderMode,
  preset: GraphVisualPreset,
): SimulationData {
  if (nodes.length === 0) {
    return { nodes: [], links: [] };
  }

  const tuning = PRESET_TUNING[preset];

  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  const rawNodes = nodes.map((node) => {
    const x = typeof node.x === "number" ? node.x : 0;
    const y = typeof node.y === "number" ? node.y : 0;
    const z = mode === "3d" && typeof node.z === "number" ? node.z : 0;
    sumX += x;
    sumY += y;
    sumZ += z;
    return {
      id: node.id,
      title: node.title,
      sourceType: node.source_type,
      colorRgb: hexToRgb(node.color),
      val: node.val,
      x,
      y,
      z,
    };
  });

  const centerX = sumX / rawNodes.length;
  const centerY = sumY / rawNodes.length;
  const centerZ = sumZ / rawNodes.length;

  let maxDistance = 0;
  rawNodes.forEach((node) => {
    const dx = node.x - centerX;
    const dy = node.y - centerY;
    const dz = node.z - centerZ;
    const distance = Math.hypot(dx, dy, dz);
    if (distance > maxDistance) {
      maxDistance = distance;
    }
  });

  const radiusByMode = mode === "3d" ? 290 : 320;
  const presetScale = preset === "dense-network" ? 1.12 : preset === "clean-minimal" ? 0.92 : 1;
  const sceneRadius = radiusByMode * presetScale;
  const scale = maxDistance > 0 ? sceneRadius / maxDistance : 1;

  const simNodes: SimNode[] = rawNodes.map((node) => {
    const baseX = (node.x - centerX) * scale;
    const baseY = (node.y - centerY) * scale;
    const baseZ = (node.z - centerZ) * scale;
    const seed = hashString(node.id) * 0.00017;

    return {
      id: node.id,
      title: node.title,
      sourceType: node.sourceType,
      colorRgb: node.colorRgb,
      val: node.val,
      baseX,
      baseY,
      baseZ,
      x: baseX,
      y: baseY,
      z: baseZ,
      vx: 0,
      vy: 0,
      vz: 0,
      seed,
      dragLocked: false,
    };
  });

  const indexById = new Map<string, number>();
  simNodes.forEach((node, index) => indexById.set(node.id, index));

  const edgeKeySet = new Set<string>();
  const simLinks: SimLink[] = [];

  links.forEach((link) => {
    const sourceIndex = indexById.get(link.source);
    const targetIndex = indexById.get(link.target);
    if (sourceIndex === undefined || targetIndex === undefined || sourceIndex === targetIndex) {
      return;
    }

    const key = sourceIndex < targetIndex ? `${sourceIndex}:${targetIndex}` : `${targetIndex}:${sourceIndex}`;
    if (edgeKeySet.has(key)) {
      return;
    }

    edgeKeySet.add(key);
    const similarity =
      typeof link.similarity_score === "number"
        ? clamp(link.similarity_score, 0, 1)
        : link.is_ai_generated
          ? 0.56
          : 0.36;

    simLinks.push({
      sourceIndex,
      targetIndex,
      isAi: link.is_ai_generated,
      similarity,
      synthetic: false,
      seed: hashString(link.id) * 0.0017,
    });
  });

  if (simNodes.length <= 220 && tuning.extraNeighbors > 0) {
    for (let sourceIndex = 0; sourceIndex < simNodes.length; sourceIndex += 1) {
      const sourceNode = simNodes[sourceIndex];
      const distances: Array<{ targetIndex: number; distance: number }> = [];

      for (let targetIndex = 0; targetIndex < simNodes.length; targetIndex += 1) {
        if (sourceIndex === targetIndex) {
          continue;
        }

        const targetNode = simNodes[targetIndex];
        const dx = sourceNode.baseX - targetNode.baseX;
        const dy = sourceNode.baseY - targetNode.baseY;
        const dz = sourceNode.baseZ - targetNode.baseZ;
        distances.push({ targetIndex, distance: Math.hypot(dx, dy, dz) });
      }

      distances.sort((left, right) => left.distance - right.distance);
      const picks = Math.min(tuning.extraNeighbors, distances.length);

      for (let index = 0; index < picks; index += 1) {
        const targetIndex = distances[index].targetIndex;
        const key = sourceIndex < targetIndex ? `${sourceIndex}:${targetIndex}` : `${targetIndex}:${sourceIndex}`;
        if (edgeKeySet.has(key)) {
          continue;
        }

        edgeKeySet.add(key);
        const similarity = clamp(0.2 + (1 - distances[index].distance / (sceneRadius * 2.4)) * 0.62, 0.1, 0.7);

        simLinks.push({
          sourceIndex,
          targetIndex,
          isAi: sourceNode.sourceType !== "manual" || simNodes[targetIndex].sourceType !== "manual",
          similarity,
          synthetic: true,
          seed: hashString(`${sourceNode.id}-${simNodes[targetIndex].id}`) * 0.0013,
        });
      }
    }
  }

  return { nodes: simNodes, links: simLinks };
}

function stepSimulation(
  data: SimulationData,
  mode: GraphRenderMode,
  tuning: PresetTuning,
  reduceMotion: boolean,
  now: number,
): void {
  const nodes = data.nodes;
  if (nodes.length === 0) {
    return;
  }

  const modeScale = mode === "3d" ? 1 : 0.82;
  const baseSpring = tuning.baseSpring * modeScale;
  const edgeSpring = tuning.edgeSpring * modeScale;
  const edgeLength = tuning.edgeLength * (mode === "3d" ? 1 : 0.86);

  for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
    const node = nodes[nodeIndex];
    if (node.dragLocked) {
      node.vx *= 0.7;
      node.vy *= 0.7;
      node.vz *= 0.7;
      continue;
    }

    node.vx += (node.baseX - node.x) * baseSpring;
    node.vy += (node.baseY - node.y) * baseSpring;
    node.vz += (node.baseZ - node.z) * baseSpring;

    if (mode === "3d" && !reduceMotion) {
      node.vy += Math.sin(now * 0.0016 + node.seed * 2.6) * tuning.floatiness;
      node.vx += Math.cos(now * 0.0013 + node.seed * 1.4) * (tuning.floatiness * 0.5);
    }
  }

  for (let linkIndex = 0; linkIndex < data.links.length; linkIndex += 1) {
    const link = data.links[linkIndex];
    const source = nodes[link.sourceIndex];
    const target = nodes[link.targetIndex];

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const dz = target.z - source.z;
    const distance = Math.max(0.001, Math.hypot(dx, dy, dz));

    const targetLength =
      edgeLength *
      (link.synthetic ? 1.06 : 1) *
      (link.isAi ? 0.93 : 1.04) *
      (0.8 + link.similarity * 0.3);

    const springForce =
      (distance - targetLength) *
      edgeSpring *
      (link.synthetic ? 0.84 : 1.05) *
      (link.isAi ? 1.08 : 0.94);

    const forceX = (dx / distance) * springForce;
    const forceY = (dy / distance) * springForce;
    const forceZ = (dz / distance) * springForce;

    if (!source.dragLocked) {
      source.vx += forceX;
      source.vy += forceY;
      source.vz += forceZ;
    }

    if (!target.dragLocked) {
      target.vx -= forceX;
      target.vy -= forceY;
      target.vz -= forceZ;
    }
  }

  if (nodes.length <= 130) {
    for (let sourceIndex = 0; sourceIndex < nodes.length; sourceIndex += 1) {
      const source = nodes[sourceIndex];
      for (let targetIndex = sourceIndex + 1; targetIndex < nodes.length; targetIndex += 1) {
        const target = nodes[targetIndex];

        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const dz = target.z - source.z;
        const distanceSq = dx * dx + dy * dy + dz * dz + 70;
        const distance = Math.sqrt(distanceSq);

        const repulsionForce = (tuning.repulsion * modeScale) / distanceSq;
        const forceX = (dx / distance) * repulsionForce;
        const forceY = (dy / distance) * repulsionForce;
        const forceZ = (dz / distance) * repulsionForce;

        if (!source.dragLocked) {
          source.vx -= forceX;
          source.vy -= forceY;
          source.vz -= forceZ;
        }

        if (!target.dragLocked) {
          target.vx += forceX;
          target.vy += forceY;
          target.vz += forceZ;
        }
      }
    }
  }

  for (let nodeIndex = 0; nodeIndex < nodes.length; nodeIndex += 1) {
    const node = nodes[nodeIndex];
    if (node.dragLocked) {
      continue;
    }

    node.vx *= tuning.damping;
    node.vy *= tuning.damping;
    node.vz *= tuning.damping;

    const speed = Math.hypot(node.vx, node.vy, node.vz);
    if (speed > tuning.maxSpeed) {
      const scale = tuning.maxSpeed / speed;
      node.vx *= scale;
      node.vy *= scale;
      node.vz *= scale;
    }

    node.x += node.vx;
    node.y += node.vy;
    node.z += node.vz;
  }
}

function projectNode(
  node: SimNode,
  index: number,
  scene: SceneState,
  mode: GraphRenderMode,
  width: number,
  height: number,
): ProjectedNode {
  const centerX = width / 2 + scene.panX;
  const centerY = height / 2 + scene.panY;

  let rotatedX = node.x;
  let rotatedY = node.y;
  let rotatedZ = node.z;

  if (mode === "3d") {
    const cosX = Math.cos(scene.angleX);
    const sinX = Math.sin(scene.angleX);
    const cosY = Math.cos(scene.angleY);
    const sinY = Math.sin(scene.angleY);

    const xRotY = node.x * cosY - node.z * sinY;
    const zRotY = node.x * sinY + node.z * cosY;

    rotatedX = xRotY;
    rotatedY = node.y * cosX - zRotY * sinX;
    rotatedZ = node.y * sinX + zRotY * cosX;
  } else {
    rotatedZ = 0;
  }

  const perspective =
    mode === "3d"
      ? clamp((CAMERA_DISTANCE / (CAMERA_DISTANCE - rotatedZ)) * scene.zoom, 0.35, 3.4)
      : scene.zoom;

  const radiusBase = node.val * 0.82 + 3.2;
  const radius =
    mode === "3d"
      ? clamp(radiusBase * perspective * 0.9, 3.2, 23)
      : clamp(radiusBase * Math.sqrt(scene.zoom) * 0.9, 3.2, 18);

  return {
    id: node.id,
    index,
    title: node.title,
    sourceType: node.sourceType,
    colorRgb: node.colorRgb,
    screenX: centerX + rotatedX * perspective,
    screenY: centerY + rotatedY * perspective,
    radius,
    depth: rotatedZ,
  };
}

function pickNodeAt(projectedNodes: ProjectedNode[], x: number, y: number): ProjectedNode | null {
  const sorted = [...projectedNodes].sort((left, right) => right.depth - left.depth);
  for (let index = 0; index < sorted.length; index += 1) {
    const node = sorted[index];
    const dx = x - node.screenX;
    const dy = y - node.screenY;
    if (Math.hypot(dx, dy) <= node.radius + 6) {
      return node;
    }
  }
  return null;
}

function unprojectForDrag(
  x: number,
  y: number,
  depth: number,
  scene: SceneState,
  mode: GraphRenderMode,
  width: number,
  height: number,
): { x: number; y: number; z: number } {
  const centerX = width / 2 + scene.panX;
  const centerY = height / 2 + scene.panY;

  if (mode === "2d") {
    const worldX = (x - centerX) / Math.max(0.001, scene.zoom);
    const worldY = (y - centerY) / Math.max(0.001, scene.zoom);
    return { x: worldX, y: worldY, z: 0 };
  }

  const cosX = Math.cos(scene.angleX);
  const sinX = Math.sin(scene.angleX);
  const cosY = Math.cos(scene.angleY);
  const sinY = Math.sin(scene.angleY);

  const perspective = clamp((CAMERA_DISTANCE / (CAMERA_DISTANCE - depth)) * scene.zoom, 0.35, 3.4);
  const rotatedX = (x - centerX) / perspective;
  const rotatedY = (y - centerY) / perspective;
  const rotatedZ = depth;

  const worldY = rotatedY * cosX + rotatedZ * sinX;
  const zRotY = -rotatedY * sinX + rotatedZ * cosX;

  const worldX = rotatedX * cosY + zRotY * sinY;
  const worldZ = -rotatedX * sinY + zRotY * cosY;

  return { x: worldX, y: worldY, z: worldZ };
}

function sourceAccentRgb(sourceType: string, fallback: Rgb): Rgb {
  if (sourceType === "manual") {
    return [244, 250, 248];
  }
  if (sourceType === "url") {
    return [96, 174, 164];
  }
  if (sourceType === "pdf") {
    return [207, 128, 75];
  }
  if (sourceType === "text") {
    return [104, 142, 210];
  }
  return fallback;
}

function traceQuadratic(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  cx: number,
  cy: number,
  tx: number,
  ty: number,
): void {
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(cx, cy, tx, ty);
}

export function SoftwareGraph3DCanvas({
  width,
  height,
  nodes,
  links,
  mode,
  preset,
  selectedNodeId,
  resetNonce,
  reduceMotion,
  onNodeClick,
}: SoftwareGraph3DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const projectedNodesRef = useRef<ProjectedNode[]>([]);
  const simulationRef = useRef<SimulationData>({ nodes: [], links: [] });
  const sceneStateRef = useRef<SceneState>(initialScene(mode));
  const animationRef = useRef<number | null>(null);

  const modeRef = useRef<GraphRenderMode>(mode);
  const presetRef = useRef<GraphVisualPreset>(preset);
  const reduceMotionRef = useRef(reduceMotion);
  const selectedNodeRef = useRef<string | null>(selectedNodeId);
  const onNodeClickRef = useRef(onNodeClick);

  useEffect(() => {
    modeRef.current = mode;
    sceneStateRef.current = initialScene(mode);
  }, [mode]);

  useEffect(() => {
    presetRef.current = preset;
  }, [preset]);

  useEffect(() => {
    reduceMotionRef.current = reduceMotion;
  }, [reduceMotion]);

  useEffect(() => {
    selectedNodeRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    onNodeClickRef.current = onNodeClick;
  }, [onNodeClick]);

  useEffect(() => {
    simulationRef.current = buildSimulationData(nodes, links, mode, preset);
  }, [links, mode, nodes, preset]);

  useEffect(() => {
    const scene = initialScene(modeRef.current);
    sceneStateRef.current = scene;
    simulationRef.current.nodes.forEach((node) => {
      node.x = node.baseX;
      node.y = node.baseY;
      node.z = node.baseZ;
      node.vx = 0;
      node.vy = 0;
      node.vz = 0;
      node.dragLocked = false;
    });
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

      const now = performance.now();
      const activeMode = modeRef.current;
      const activePreset = presetRef.current;
      const tuning = PRESET_TUNING[activePreset];
      const scene = sceneStateRef.current;
      const simulation = simulationRef.current;

      if (!scene.dragging && activeMode === "3d" && !reduceMotionRef.current) {
        scene.angleY += tuning.spinSpeed;
      }

      stepSimulation(simulation, activeMode, tuning, reduceMotionRef.current, now);

      const backgroundGradient = ctx.createRadialGradient(
        width * 0.32,
        height * 0.2,
        24,
        width * 0.5,
        height * 0.62,
        Math.max(width, height),
      );
      backgroundGradient.addColorStop(
        0,
        activeMode === "3d" ? tuning.background3DInner : tuning.background2DInner,
      );
      backgroundGradient.addColorStop(
        1,
        activeMode === "3d" ? tuning.background3DOuter : tuning.background2DOuter,
      );
      ctx.fillStyle = backgroundGradient;
      ctx.fillRect(0, 0, width, height);

      if (activeMode === "2d" && activePreset !== "cinematic") {
        ctx.strokeStyle = "rgba(18, 34, 29, 0.05)";
        ctx.lineWidth = 1;
        for (let x = 24; x < width; x += 48) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, height);
          ctx.stroke();
        }
        for (let y = 24; y < height; y += 48) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(width, y);
          ctx.stroke();
        }
      }

      const projectedNodes = simulation.nodes.map((node, index) =>
        projectNode(node, index, scene, activeMode, width, height),
      );
      projectedNodesRef.current = projectedNodes;

      const projectedByIndex = new Map<number, ProjectedNode>();
      projectedNodes.forEach((node) => projectedByIndex.set(node.index, node));

      const projectedLinks = simulation.links
        .map((link) => {
          const source = projectedByIndex.get(link.sourceIndex);
          const target = projectedByIndex.get(link.targetIndex);
          if (!source || !target) {
            return null;
          }
          return {
            source,
            target,
            depth: (source.depth + target.depth) / 2,
            isAi: link.isAi,
            similarity: link.similarity,
            synthetic: link.synthetic,
            seed: link.seed,
          };
        })
        .filter(
          (
            item,
          ): item is {
            source: ProjectedNode;
            target: ProjectedNode;
            depth: number;
            isAi: boolean;
            similarity: number;
            synthetic: boolean;
            seed: number;
          } => Boolean(item),
        )
        .sort((left, right) => left.depth - right.depth);

      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      for (let edgeIndex = 0; edgeIndex < projectedLinks.length; edgeIndex += 1) {
        const link = projectedLinks[edgeIndex];
        const depthFactor = activeMode === "3d" ? clamp((link.depth + 560) / 1120, 0.14, 1) : 1;

        const rgb = link.isAi ? AI_LINK_RGB : MANUAL_LINK_RGB;
        const alpha = tuning.edgeAlpha * depthFactor * (link.synthetic ? 0.8 : 1);

        const dx = link.target.screenX - link.source.screenX;
        const dy = link.target.screenY - link.source.screenY;
        const distance = Math.max(0.001, Math.hypot(dx, dy));
        const normalX = -dy / distance;
        const normalY = dx / distance;

        const swayBase =
          tuning.edgeSway *
          (link.synthetic ? 0.7 : 1) *
          (activePreset === "clean-minimal" ? 0.64 : 1) *
          (0.5 + link.similarity * 0.68);

        const sway = Math.sin(now * (activeMode === "3d" ? 0.0012 : 0.0019) + link.seed) * swayBase;

        const controlX = (link.source.screenX + link.target.screenX) / 2 + normalX * sway;
        const controlY = (link.source.screenY + link.target.screenY) / 2 + normalY * sway;

        if (activeMode === "3d") {
          const tubeWidth =
            (0.95 + link.similarity * 1.62 + tuning.edgeTubeBoost + (link.isAi ? 0.4 : 0.16)) *
            depthFactor *
            (link.synthetic ? 0.82 : 1);

          ctx.strokeStyle = "rgba(9, 25, 20, 0.28)";
          ctx.lineWidth = tubeWidth * 2.2;
          traceQuadratic(ctx, link.source.screenX, link.source.screenY, controlX, controlY, link.target.screenX, link.target.screenY);
          ctx.stroke();

          ctx.strokeStyle = rgbaFromRgb(rgb, alpha);
          ctx.lineWidth = tubeWidth * 1.26;
          traceQuadratic(ctx, link.source.screenX, link.source.screenY, controlX, controlY, link.target.screenX, link.target.screenY);
          ctx.stroke();

          ctx.strokeStyle = "rgba(255, 255, 255, 0.23)";
          ctx.lineWidth = Math.max(0.38, tubeWidth * 0.36);
          traceQuadratic(ctx, link.source.screenX, link.source.screenY, controlX, controlY, link.target.screenX, link.target.screenY);
          ctx.stroke();
        } else {
          const stringWidth =
            (0.72 + link.similarity * 1.2 + (link.isAi ? 0.26 : 0.12)) *
            (link.synthetic ? 0.84 : 1) *
            (activePreset === "clean-minimal" ? 0.86 : 1);

          if (activePreset === "clean-minimal" && link.synthetic) {
            ctx.setLineDash([3, 3]);
          } else {
            ctx.setLineDash([]);
          }

          ctx.strokeStyle = rgbaFromRgb(rgb, alpha * (activePreset === "clean-minimal" ? 0.72 : 0.9));
          ctx.lineWidth = stringWidth;
          traceQuadratic(ctx, link.source.screenX, link.source.screenY, controlX, controlY, link.target.screenX, link.target.screenY);
          ctx.stroke();

          ctx.setLineDash([]);
          ctx.strokeStyle = "rgba(255, 255, 255, 0.14)";
          ctx.lineWidth = Math.max(0.34, stringWidth * 0.42);
          traceQuadratic(ctx, link.source.screenX, link.source.screenY, controlX, controlY, link.target.screenX, link.target.screenY);
          ctx.stroke();
        }
      }

      const selectedId = selectedNodeRef.current;
      const nodesToDraw = [...projectedNodes].sort((left, right) => left.depth - right.depth);
      const showAmbientLabels = nodesToDraw.length <= tuning.labelThreshold;

      for (let nodeIndex = 0; nodeIndex < nodesToDraw.length; nodeIndex += 1) {
        const node = nodesToDraw[nodeIndex];
        const simNode = simulation.nodes[node.index];
        const isSelected = node.id === selectedId;

        const depthFactor = activeMode === "3d" ? clamp((node.depth + 560) / 1120, 0.2, 1) : 1;
        const nodeAlpha = activeMode === "3d" ? clamp(tuning.nodeAlpha3D * depthFactor, 0.2, 0.88) : tuning.nodeAlpha2D;
        const glowStrength = (isSelected ? tuning.glowStrength * 1.55 : tuning.glowStrength) * depthFactor;

        ctx.shadowBlur = glowStrength;
        ctx.shadowColor = rgbaFromRgb(node.colorRgb, activeMode === "3d" ? 0.58 : 0.42);
        ctx.fillStyle = rgbaFromRgb(node.colorRgb, nodeAlpha);
        ctx.beginPath();
        ctx.arc(node.screenX, node.screenY, node.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.fillStyle = "rgba(255, 255, 255, 0.24)";
        ctx.beginPath();
        ctx.arc(
          node.screenX - node.radius * 0.3,
          node.screenY - node.radius * 0.32,
          Math.max(1.2, node.radius * 0.34),
          0,
          Math.PI * 2,
        );
        ctx.fill();

        const accentRgb = sourceAccentRgb(node.sourceType, node.colorRgb);
        const orbitAngle = now * 0.0016 * tuning.orbitSpeed + simNode.seed;
        const orbitRadius = node.radius * (activeMode === "3d" ? 0.68 : 0.56);
        const orbitX = node.screenX + Math.cos(orbitAngle) * orbitRadius;
        const orbitY = node.screenY + Math.sin(orbitAngle) * orbitRadius;

        ctx.fillStyle = rgbaFromRgb(accentRgb, activeMode === "3d" ? 0.88 * depthFactor : 0.85);
        ctx.beginPath();
        ctx.arc(orbitX, orbitY, Math.max(1.1, node.radius * 0.16), 0, Math.PI * 2);
        ctx.fill();

        if (node.sourceType !== "manual") {
          ctx.strokeStyle = rgbaFromRgb(accentRgb, activeMode === "3d" ? 0.44 : 0.36);
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.arc(node.screenX, node.screenY, node.radius + 2.2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }

        if (isSelected) {
          ctx.strokeStyle = "rgba(18, 34, 29, 0.82)";
          ctx.lineWidth = 2.2;
          ctx.beginPath();
          ctx.arc(node.screenX, node.screenY, node.radius + 3.6, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (isSelected || (showAmbientLabels && depthFactor > 0.78 && node.radius > 4.8)) {
          const title = node.title.length > 26 ? `${node.title.slice(0, 23)}...` : node.title;
          ctx.font = isSelected ? "600 11px IBM Plex Mono" : "500 10px IBM Plex Mono";
          const textWidth = ctx.measureText(title).width;
          const badgeWidth = textWidth + 10;
          const badgeHeight = isSelected ? 18 : 16;
          const badgeX = node.screenX - badgeWidth / 2;
          const badgeY = node.screenY - node.radius - badgeHeight - 6;

          drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 8);
          ctx.fillStyle = activeMode === "3d" ? "rgba(243, 250, 246, 0.76)" : "rgba(247, 252, 248, 0.86)";
          ctx.fill();
          ctx.strokeStyle = "rgba(18, 34, 29, 0.21)";
          ctx.lineWidth = 0.8;
          ctx.stroke();

          ctx.fillStyle = "rgba(18, 34, 29, 0.87)";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(title, node.screenX, badgeY + badgeHeight / 2 + 0.5);
        }
      }

      animationRef.current = requestAnimationFrame(drawFrame);
    };

    const toCanvasPoint = (event: PointerEvent): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const handlePointerDown = (event: PointerEvent) => {
      const scene = sceneStateRef.current;
      scene.dragging = true;
      scene.dragDistance = 0;
      scene.pointerX = event.clientX;
      scene.pointerY = event.clientY;

      const point = toCanvasPoint(event);
      const pickedNode = pickNodeAt(projectedNodesRef.current, point.x, point.y);

      if (pickedNode) {
        scene.dragMode = "node";
        scene.dragNodeIndex = pickedNode.index;
        scene.dragNodeDepth = pickedNode.depth;

        const node = simulationRef.current.nodes[pickedNode.index];
        if (node) {
          node.dragLocked = true;
          node.vx = 0;
          node.vy = 0;
          node.vz = 0;
        }

        canvas.style.cursor = "grabbing";
      } else {
        scene.dragMode = "scene";
        canvas.style.cursor = modeRef.current === "2d" ? "move" : "grabbing";
      }

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

      if (scene.dragMode === "node" && scene.dragNodeIndex !== null) {
        const draggedNode = simulationRef.current.nodes[scene.dragNodeIndex];
        if (!draggedNode) {
          return;
        }

        const point = toCanvasPoint(event);
        const world = unprojectForDrag(
          point.x,
          point.y,
          scene.dragNodeDepth,
          scene,
          modeRef.current,
          width,
          height,
        );

        const previousX = draggedNode.x;
        const previousY = draggedNode.y;
        const previousZ = draggedNode.z;

        draggedNode.x = world.x;
        draggedNode.y = world.y;
        draggedNode.z = world.z;

        draggedNode.vx = (draggedNode.x - previousX) * 0.54 + dx * 0.015;
        draggedNode.vy = (draggedNode.y - previousY) * 0.54 + dy * 0.015;
        draggedNode.vz = (draggedNode.z - previousZ) * 0.54;
        return;
      }

      if (scene.dragMode === "scene") {
        if (modeRef.current === "3d") {
          scene.angleY += dx * 0.0052;
          scene.angleX = clamp(scene.angleX + dy * 0.0044, -1.2, 1.2);
        } else {
          scene.panX += dx;
          scene.panY += dy;
        }
      }
    };

    const releaseDraggedNode = () => {
      const scene = sceneStateRef.current;
      if (scene.dragNodeIndex === null) {
        return;
      }

      const node = simulationRef.current.nodes[scene.dragNodeIndex];
      if (node) {
        node.dragLocked = false;
      }
    };

    const handlePointerUp = (event: PointerEvent) => {
      const scene = sceneStateRef.current;
      const wasDragging = scene.dragging;
      const dragDistance = scene.dragDistance;

      releaseDraggedNode();

      scene.dragging = false;
      scene.dragMode = "none";
      scene.dragNodeIndex = null;
      canvas.style.cursor = "grab";

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }

      if (!wasDragging || dragDistance > 7) {
        return;
      }

      const point = toCanvasPoint(event);
      const pickedNode = pickNodeAt(projectedNodesRef.current, point.x, point.y);
      if (pickedNode) {
        onNodeClickRef.current(pickedNode.id);
      }
    };

    const handlePointerCancel = (event: PointerEvent) => {
      releaseDraggedNode();

      const scene = sceneStateRef.current;
      scene.dragging = false;
      scene.dragMode = "none";
      scene.dragNodeIndex = null;
      canvas.style.cursor = "grab";

      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const scene = sceneStateRef.current;
      const zoomMin = modeRef.current === "3d" ? 0.56 : 0.42;
      const zoomMax = modeRef.current === "3d" ? 2.25 : 2.5;
      scene.zoom = clamp(scene.zoom - event.deltaY * 0.0009, zoomMin, zoomMax);
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
      aria-label="Interactive software-rendered knowledge graph"
    />
  );
}
