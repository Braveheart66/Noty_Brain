import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, FormEvent } from "react";
import {
  askQuestion,
  createNote,
  deleteNote,
  fetchAskHistory,
  fetchDashboard,
  fetchGraph,
  fetchNotes,
  fetchProfile,
  refreshAccessToken,
  ingestPdf,
  ingestText,
  ingestUrl,
  login,
  register,
  runClusterAnalysis,
  semanticSearch,
  updateNote,
} from "./api/client";
import type {
  AskResponse,
  ClusterPayload,
  DashboardStats,
  GraphPayload,
  Note,
  Profile,
  QueryHistoryEntry,
  SearchResult,
} from "./api/client";
import "./App.css";

const CLUSTER_PALETTE = [
  "#1f7a63",
  "#0f6ba8",
  "#cb5a2f",
  "#a03f75",
  "#2a8f86",
  "#ae4f1f",
  "#3653b8",
  "#6f7b2f",
];

type EdgeViewMode = "all" | "ai" | "manual";
type GraphRenderMode = "3d" | "2d";
type AppTab = "capture" | "explore" | "graph";
type AuthMode = "register" | "login";
type GraphRenderer = ComponentType<any>;

type GraphNode3D = {
  id: string;
  title: string;
  source_type: string;
  tags: string[];
  clusterIndex: number;
  color: string;
  val: number;
  x?: number;
  y?: number;
  z?: number;
};

type GraphLink3D = {
  id: string;
  source: string;
  target: string;
  relationship_type: string;
  is_ai_generated: boolean;
  similarity_score: number | null;
};

type FallbackNode = GraphNode3D & {
  px: number;
  py: number;
  radius: number;
};

type FallbackLink = GraphLink3D & {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
};

function sourceTypeLabel(sourceType: string): string {
  if (sourceType === "manual") {
    return "Manual";
  }
  if (sourceType === "url") {
    return "URL";
  }
  if (sourceType === "pdf") {
    return "PDF";
  }
  return "Unknown";
}

function truncateText(text: string, maxLength = 150): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}

function hashString(text: string): number {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function linkEndpointId(endpoint: unknown): string {
  if (typeof endpoint === "string") {
    return endpoint;
  }
  if (endpoint && typeof endpoint === "object" && "id" in endpoint) {
    return String((endpoint as { id: string }).id);
  }
  return "";
}

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [token, setToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");

  const [status, setStatus] = useState("Ready");
  const [profile, setProfile] = useState<Profile | null>(null);

  const [noteTitle, setNoteTitle] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [noteActionPendingId, setNoteActionPendingId] = useState<string | null>(null);

  const [urlToIngest, setUrlToIngest] = useState("");
  const [urlTitle, setUrlTitle] = useState("");
  const [textToIngest, setTextToIngest] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [pdfTitle, setPdfTitle] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchAnswer, setSearchAnswer] = useState<string | null>(null);
  const [searchConfidence, setSearchConfidence] = useState<number | null>(null);
  const [searchSources, setSearchSources] = useState<Array<{ id: string; title: string; similarity_score: number }>>([]);
  const [searchResponseLength, setSearchResponseLength] = useState<"short" | "medium" | "long">("medium");

  const [question, setQuestion] = useState("");
  const [askResult, setAskResult] = useState<AskResponse | null>(null);
  const [history, setHistory] = useState<QueryHistoryEntry[]>([]);

  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [clusters, setClusters] = useState<ClusterPayload | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>("capture");
  const [edgeView, setEdgeView] = useState<EdgeViewMode>("all");
  const [graphMode, setGraphMode] = useState<GraphRenderMode>("2d");
  const [forceGraph2D, setForceGraph2D] = useState<GraphRenderer | null>(null);
  const [forceGraph3D, setForceGraph3D] = useState<GraphRenderer | null>(null);
  const [graphLibError, setGraphLibError] = useState<string | null>(null);
  const [nodeSearch, setNodeSearch] = useState("");
  const [focusNodeId, setFocusNodeId] = useState("");
  const [activeCluster, setActiveCluster] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const graphRef = useRef<any>(undefined);
  const graphStageRef = useRef<HTMLDivElement | null>(null);
  const [graphViewport, setGraphViewport] = useState({ width: 960, height: 560 });

  useEffect(() => {
    const storedAccessToken = window.localStorage.getItem("noty_access_token");
    const storedRefreshToken = window.localStorage.getItem("noty_refresh_token");
    if (storedAccessToken) {
      setToken(storedAccessToken);
    }
    if (storedRefreshToken) {
      setRefreshToken(storedRefreshToken);
    }
  }, []);

  useEffect(() => {
    if (token) {
      window.localStorage.setItem("noty_access_token", token);
    } else {
      window.localStorage.removeItem("noty_access_token");
    }

    if (refreshToken) {
      window.localStorage.setItem("noty_refresh_token", refreshToken);
    } else {
      window.localStorage.removeItem("noty_refresh_token");
    }
  }, [refreshToken, token]);

  useEffect(() => {
    let disposed = false;

    const loadGraphLibraries = async () => {
      let threeError: string | null = null;
      let twoError: string | null = null;

      try {
        const { default: ForceGraph3DModule } = await import("react-force-graph-3d");
        if (!disposed) {
          setForceGraph3D(() => ForceGraph3DModule as GraphRenderer);
        }
      } catch (error) {
        threeError = error instanceof Error ? error.message : "unknown 3D error";
      }

      try {
        const { default: ForceGraph2DModule } = await import("react-force-graph-2d");
        if (!disposed) {
          setForceGraph2D(() => ForceGraph2DModule as GraphRenderer);
        }
      } catch (error) {
        twoError = error instanceof Error ? error.message : "unknown 2D error";
      }

      if (!disposed && threeError && twoError) {
        setGraphLibError(
          `Graph renderers failed to load (3D: ${threeError}; 2D: ${twoError}). Showing lightweight fallback graph.`,
        );
      }
    };

    loadGraphLibraries();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const stage = graphStageRef.current;
    if (!stage) {
      return;
    }

    const updateViewport = () => {
      const rect = stage.getBoundingClientRect();
      const width = Math.max(320, Math.floor(rect.width));
      const height = Math.max(320, Math.floor(rect.height));
      setGraphViewport((current) => {
        if (current.width === width && current.height === height) {
          return current;
        }
        return { width, height };
      });
    };

    updateViewport();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateViewport);
      return () => window.removeEventListener("resize", updateViewport);
    }

    const observer = new ResizeObserver(() => updateViewport());
    observer.observe(stage);

    return () => observer.disconnect();
  }, []);

  const isAuthenticated = useMemo(() => token.length > 0, [token]);

  const isTokenInvalidError = (error: unknown): boolean => {
    const message = error instanceof Error ? error.message : "";
    if (!message) {
      return false;
    }

    if (message.includes("token_not_valid") || message.includes("Given token not valid")) {
      return true;
    }

    try {
      const parsed = JSON.parse(message) as { code?: string; detail?: string };
      return parsed.code === "token_not_valid" || (parsed.detail ?? "").includes("not valid");
    } catch {
      return false;
    }
  };

  const runWithAccessToken = async <T,>(operation: (accessToken: string) => Promise<T>): Promise<T> => {
    try {
      return await operation(token);
    } catch (error) {
      if (!isTokenInvalidError(error) || !refreshToken) {
        throw error;
      }

      try {
        const refreshed = await refreshAccessToken({ refresh: refreshToken });
        setToken(refreshed.access);
        setStatus("Session refreshed. Retrying request...");
        return operation(refreshed.access);
      } catch (refreshError) {
        setToken("");
        setRefreshToken("");
        setStatus("Session expired. Please sign in again.");
        throw refreshError;
      }
    }
  };

  const clusterIndexByNoteId = useMemo(() => {
    const noteToCluster = new Map<string, number>();
    if (!clusters) {
      return noteToCluster;
    }
    clusters.clusters.forEach((cluster, clusterIndex) => {
      cluster.notes.forEach((note) => {
        noteToCluster.set(note.id, clusterIndex);
      });
    });
    return noteToCluster;
  }, [clusters]);

  const graphSceneData = useMemo(() => {
    const defaultGraph = { nodes: [], edges: [] };
    const currentGraph = graph ?? defaultGraph;
    const normalizedSearch = nodeSearch.trim().toLowerCase();

    const visibleNodes = currentGraph.nodes.filter((node) => {
      if (activeCluster !== null && clusterIndexByNoteId.get(node.id) !== activeCluster) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = `${node.title} ${node.tags.join(" ")} ${node.source_type}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });

    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));

    const visibleEdgesAll = currentGraph.edges.filter((edge) => {
      if (!visibleNodeIds.has(edge.source_note_id) || !visibleNodeIds.has(edge.target_note_id)) {
        return false;
      }

      if (edgeView === "ai") {
        return edge.is_ai_generated;
      }
      if (edgeView === "manual") {
        return !edge.is_ai_generated;
      }
      return true;
    });

    let finalVisibleNodes = visibleNodes;
    let finalVisibleEdges = visibleEdgesAll;
    if (focusNodeId && visibleNodeIds.has(focusNodeId)) {
      const neighborIds = new Set<string>([focusNodeId]);
      visibleEdgesAll.forEach((edge) => {
        if (edge.source_note_id === focusNodeId) {
          neighborIds.add(edge.target_note_id);
        }
        if (edge.target_note_id === focusNodeId) {
          neighborIds.add(edge.source_note_id);
        }
      });

      finalVisibleNodes = visibleNodes.filter((node) => neighborIds.has(node.id));
      finalVisibleEdges = visibleEdgesAll.filter(
        (edge) => neighborIds.has(edge.source_note_id) && neighborIds.has(edge.target_note_id),
      );
    }

    const degreeByNode = new Map<string, number>();
    finalVisibleNodes.forEach((node) => degreeByNode.set(node.id, 0));
    finalVisibleEdges.forEach((edge) => {
      degreeByNode.set(edge.source_note_id, (degreeByNode.get(edge.source_note_id) ?? 0) + 1);
      degreeByNode.set(edge.target_note_id, (degreeByNode.get(edge.target_note_id) ?? 0) + 1);
    });

    const nodesRaw: GraphNode3D[] = finalVisibleNodes.map((node) => {
      const clusterIndex = clusterIndexByNoteId.get(node.id) ?? -1;
      const degree = degreeByNode.get(node.id) ?? 0;
      return {
        ...node,
        clusterIndex,
        color: clusterIndex >= 0 ? CLUSTER_PALETTE[clusterIndex % CLUSTER_PALETTE.length] : "#54606a",
        val: Math.max(3.8, 3 + degree * 1.2),
      };
    });

    const uniqueClusters = [...new Set(nodesRaw.map((node) => node.clusterIndex).filter((value) => value >= 0))].sort(
      (a, b) => a - b,
    );
    const clusterCount = uniqueClusters.length;
    const clusterSizeById = new Map<number, number>();
    nodesRaw.forEach((node) => {
      if (node.clusterIndex >= 0) {
        clusterSizeById.set(node.clusterIndex, (clusterSizeById.get(node.clusterIndex) ?? 0) + 1);
      }
    });

    const clusterPairKey = (first: number, second: number): string =>
      first < second ? `${first}:${second}` : `${second}:${first}`;

    const clusterPairWeights = new Map<string, number>();
    const clusterConnectivity = new Map<number, number>();
    finalVisibleEdges.forEach((edge) => {
      const sourceCluster = clusterIndexByNoteId.get(edge.source_note_id);
      const targetCluster = clusterIndexByNoteId.get(edge.target_note_id);

      if (
        sourceCluster === undefined ||
        targetCluster === undefined ||
        sourceCluster < 0 ||
        targetCluster < 0 ||
        sourceCluster === targetCluster
      ) {
        return;
      }

      const edgeWeight = Math.max(0.12, edge.similarity_score ?? (edge.is_ai_generated ? 0.62 : 0.38));
      const key = clusterPairKey(sourceCluster, targetCluster);
      clusterPairWeights.set(key, (clusterPairWeights.get(key) ?? 0) + edgeWeight);
      clusterConnectivity.set(sourceCluster, (clusterConnectivity.get(sourceCluster) ?? 0) + edgeWeight);
      clusterConnectivity.set(targetCluster, (clusterConnectivity.get(targetCluster) ?? 0) + edgeWeight);
    });

    const connectivityValues = uniqueClusters.map((clusterId) => clusterConnectivity.get(clusterId) ?? 0);
    const pairWeightValues = [...clusterPairWeights.values()];
    const maxConnectivity = connectivityValues.length > 0 ? Math.max(...connectivityValues, 1) : 1;
    const maxPairWeight = pairWeightValues.length > 0 ? Math.max(...pairWeightValues, 1) : 1;

    const clusterCenterById = new Map<number, { x: number; y: number; z: number }>();
    if (clusterCount === 1) {
      clusterCenterById.set(uniqueClusters[0], { x: 0, y: 0, z: 0 });
    } else if (clusterCount > 1) {
      const goldenAngle = Math.PI * (3 - Math.sqrt(5));
      const baseSpread = 230 + clusterCount * 44;
      const states = uniqueClusters.map((clusterId, index) => {
        const seed = hashString(`cluster-${clusterId}`);
        const connectivity = clusterConnectivity.get(clusterId) ?? 0;
        const isolation = 1 - Math.min(1, connectivity / maxConnectivity);
        const radiusScale = 0.84 + (seed % 41) / 100;
        const radius = baseSpread * radiusScale * (1 + isolation * 0.92);
        const angle = index * goldenAngle + ((seed % 180) * Math.PI) / 900;

        return {
          clusterId,
          isolation,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          z: ((seed % 170) - 85) * (0.72 + isolation * 0.3),
          vx: 0,
          vy: 0,
          vz: 0,
        };
      });

      const iterations = Math.min(240, 140 + clusterCount * 10);
      for (let step = 0; step < iterations; step += 1) {
        states.forEach((state, stateIndex) => {
          let fx = 0;
          let fy = 0;
          let fz = 0;

          states.forEach((other, otherIndex) => {
            if (stateIndex === otherIndex) {
              return;
            }

            const dx = state.x - other.x;
            const dy = state.y - other.y;
            const dz = state.z - other.z;
            const distance = Math.max(22, Math.hypot(dx, dy, dz));

            const repulsion = (11200 * (1 + state.isolation + other.isolation)) / (distance * distance);
            fx += (dx / distance) * repulsion;
            fy += (dy / distance) * repulsion;
            fz += (dz / distance) * repulsion;

            const pairWeight = clusterPairWeights.get(clusterPairKey(state.clusterId, other.clusterId)) ?? 0;
            if (pairWeight > 0) {
              const normalizedWeight = pairWeight / maxPairWeight;
              const targetDistance = 190 + (1 - normalizedWeight) * 260;
              const springStrength = 0.01 + normalizedWeight * 0.028;
              const springForce = (distance - targetDistance) * springStrength;

              fx -= (dx / distance) * springForce;
              fy -= (dy / distance) * springForce;
              fz -= (dz / distance) * springForce;
            }
          });

          const originDistance = Math.max(70, Math.hypot(state.x, state.y, state.z));
          const radialPush = 0.95 + state.isolation * 1.45;
          fx += (state.x / originDistance) * radialPush;
          fy += (state.y / originDistance) * radialPush;
          fz += (state.z / originDistance) * radialPush * 0.9;

          state.vx = (state.vx + fx) * 0.72;
          state.vy = (state.vy + fy) * 0.72;
          state.vz = (state.vz + fz) * 0.72;

          state.x += state.vx;
          state.y += state.vy;
          state.z += state.vz;
        });
      }

      states.forEach((state) => {
        const sizeScale = Math.max(1, Math.sqrt(clusterSizeById.get(state.clusterId) ?? 1) * 0.2);
        const separationScale = 1 + state.isolation * 0.55;
        clusterCenterById.set(state.clusterId, {
          x: state.x * sizeScale * separationScale,
          y: state.y * sizeScale * separationScale,
          z: state.z * sizeScale * separationScale,
        });
      });
    }

    const clusterNodeOrder = new Map<string, number>();
    if (clusterCount > 0) {
      const clusterBuckets = new Map<number, GraphNode3D[]>();
      nodesRaw.forEach((node) => {
        if (node.clusterIndex < 0) {
          return;
        }
        const bucket = clusterBuckets.get(node.clusterIndex) ?? [];
        bucket.push(node);
        clusterBuckets.set(node.clusterIndex, bucket);
      });

      clusterBuckets.forEach((clusterNodes) => {
        const sorted = [...clusterNodes].sort((left, right) => hashString(left.id) - hashString(right.id));
        sorted.forEach((node, index) => {
          clusterNodeOrder.set(node.id, index);
        });
      });
    }

    const nodes: GraphNode3D[] = nodesRaw.map((node) => {
      if (node.clusterIndex < 0 || clusterCount === 0) {
        return node;
      }

      const center = clusterCenterById.get(node.clusterIndex) ?? { x: 0, y: 0, z: 0 };
      const nodeHash = hashString(node.id);
      const clusterSeed = hashString(`cluster-seed-${node.clusterIndex}`);
      const localRank = clusterNodeOrder.get(node.id) ?? 0;
      const spiralAngle = localRank * 2.399963229728653 + ((clusterSeed % 360) * Math.PI) / 180;
      const radialBand = 18 + Math.sqrt(localRank + 1) * 13 + (nodeHash % 11);
      const squash = 0.68 + ((clusterSeed >> 3) % 22) / 100;
      const jitter = ((nodeHash % 17) - 8) * 1.35;

      const localX = Math.cos(spiralAngle) * radialBand;
      const localY = Math.sin(spiralAngle) * radialBand * squash;
      const localZ = ((localRank % 6) - 2.5) * 11 + Math.sin(spiralAngle * 0.63) * 9 + jitter;

      return {
        ...node,
        x: center.x + localX,
        y: center.y + localY,
        z: center.z + localZ,
      };
    });

    const links: GraphLink3D[] = finalVisibleEdges.map((edge) => ({
      id: edge.id,
      source: edge.source_note_id,
      target: edge.target_note_id,
      relationship_type: edge.relationship_type,
      is_ai_generated: edge.is_ai_generated,
      similarity_score: edge.similarity_score,
    }));

    return { nodes, links };
  }, [activeCluster, clusterIndexByNoteId, edgeView, focusNodeId, graph, nodeSearch]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) {
      return null;
    }
    return graphSceneData.nodes.find((node) => node.id === selectedNodeId) ?? null;
  }, [graphSceneData.nodes, selectedNodeId]);

  const graphNodeOptions = useMemo(() => {
    const source = graph?.nodes ?? [];
    return [...source]
      .sort((left, right) => left.title.localeCompare(right.title))
      .map((node) => ({ id: node.id, title: node.title }));
  }, [graph]);

  useEffect(() => {
    if (!focusNodeId) {
      return;
    }
    const stillExists = (graph?.nodes ?? []).some((node) => node.id === focusNodeId);
    if (!stillExists) {
      setFocusNodeId("");
    }
  }, [focusNodeId, graph]);

  const nodeClusterById = useMemo(() => {
    const mapping = new Map<string, number>();
    graphSceneData.nodes.forEach((node) => mapping.set(node.id, node.clusterIndex));
    return mapping;
  }, [graphSceneData.nodes]);

  const graphLinkDistance = (linkObject: object): number => {
    const link = linkObject as GraphLink3D & { source: unknown; target: unknown };
    const sourceId = linkEndpointId(link.source);
    const targetId = linkEndpointId(link.target);
    const sourceCluster = nodeClusterById.get(sourceId);
    const targetCluster = nodeClusterById.get(targetId);
    const crossesCluster =
      sourceCluster !== undefined && targetCluster !== undefined && sourceCluster !== targetCluster;

    if (crossesCluster) {
      const similarity =
        typeof link.similarity_score === "number"
          ? Math.max(0, Math.min(1, link.similarity_score))
          : link.is_ai_generated
            ? 0.55
            : 0.35;
      return 430 - similarity * 170;
    }
    return link.is_ai_generated ? 84 : 118;
  };

  const graphLinkStrength = (linkObject: object): number => {
    const link = linkObject as GraphLink3D & { source: unknown; target: unknown };
    const sourceId = linkEndpointId(link.source);
    const targetId = linkEndpointId(link.target);
    const sourceCluster = nodeClusterById.get(sourceId);
    const targetCluster = nodeClusterById.get(targetId);
    const crossesCluster =
      sourceCluster !== undefined && targetCluster !== undefined && sourceCluster !== targetCluster;

    if (crossesCluster) {
      const similarity =
        typeof link.similarity_score === "number"
          ? Math.max(0, Math.min(1, link.similarity_score))
          : link.is_ai_generated
            ? 0.55
            : 0.35;
      return 0.004 + similarity * 0.022;
    }
    return link.is_ai_generated ? 0.06 : 0.11;
  };

  const fallbackLayout = useMemo(() => {
    const width = 980;
    const height = 560;

    if (graphSceneData.nodes.length === 0) {
      return { width, height, nodes: [] as FallbackNode[], links: [] as FallbackLink[] };
    }

    const buckets = new Map<number, GraphNode3D[]>();
    graphSceneData.nodes.forEach((node) => {
      const key = node.clusterIndex;
      const current = buckets.get(key) ?? [];
      current.push(node);
      buckets.set(key, current);
    });

    const clustersOrdered = [...buckets.entries()].sort((a, b) => a[0] - b[0]);
    const clusterCount = clustersOrdered.length;
    const centerX = width / 2;
    const centerY = height / 2;
    const outerRadius = clusterCount > 1 ? Math.min(width, height) * 0.36 : 0;
    const positionedNodes = new Map<string, FallbackNode>();

    clustersOrdered.forEach(([clusterId, clusterNodes], clusterIndex) => {
      const clusterSeed = hashString(`fallback-cluster-${clusterId}`);
      const angle =
        clusterCount === 1
          ? 0
          : (Math.PI * 2 * clusterIndex) / clusterCount + ((clusterSeed % 65) * Math.PI) / 300;
      const radiusScale = 0.82 + (clusterSeed % 37) / 100;
      const clusterCenterX = centerX + Math.cos(angle) * outerRadius * radiusScale;
      const clusterCenterY = centerY + Math.sin(angle) * outerRadius * radiusScale;
      const innerRadius = clusterNodes.length > 1 ? Math.max(36, Math.min(120, 20 + clusterNodes.length * 7)) : 0;

      clusterNodes.forEach((node, nodeIndex) => {
        const localAngle = clusterNodes.length === 1 ? 0 : (Math.PI * 2 * nodeIndex) / clusterNodes.length;
        const ringMultiplier = Math.floor(nodeIndex / 14) * 0.4 + 1;
        const nodeRadius = innerRadius * ringMultiplier;
        const px = clusterCenterX + Math.cos(localAngle) * nodeRadius;
        const py = clusterCenterY + Math.sin(localAngle) * nodeRadius;

        positionedNodes.set(node.id, {
          ...node,
          px,
          py,
          radius: Math.max(7, Math.min(19, node.val * 1.5)),
        });
      });
    });

    const links = graphSceneData.links
      .map((link) => {
        const sourceNode = positionedNodes.get(link.source);
        const targetNode = positionedNodes.get(link.target);
        if (!sourceNode || !targetNode) {
          return null;
        }
        return {
          ...link,
          sx: sourceNode.px,
          sy: sourceNode.py,
          tx: targetNode.px,
          ty: targetNode.py,
        };
      })
      .filter((item): item is FallbackLink => Boolean(item));

    return {
      width,
      height,
      nodes: [...positionedNodes.values()],
      links,
    };
  }, [graphSceneData]);

  const maxClusterSize = useMemo(() => {
    if (!clusters || clusters.clusters.length === 0) {
      return 1;
    }
    return Math.max(...clusters.clusters.map((cluster) => cluster.size));
  }, [clusters]);

  const loadWorkspace = async (accessToken: string) => {
    const [loadedNotes, loadedHistory, loadedDashboard, loadedGraph, loadedProfile] = await Promise.all([
      fetchNotes(accessToken),
      fetchAskHistory(accessToken),
      fetchDashboard(accessToken),
      fetchGraph(accessToken),
      fetchProfile(accessToken),
    ]);

    setNotes(loadedNotes);
    setHistory(loadedHistory);
    setDashboard(loadedDashboard);
    setGraph(loadedGraph);
    setProfile(loadedProfile);
  };

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await register({ email, password, display_name: displayName });
      setStatus("Registration successful. You can sign in now.");
    } catch (error) {
      setStatus(`Registration failed: ${(error as Error).message}`);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const data = await login({ email, password });
      setToken(data.access);
      setRefreshToken(data.refresh);
      await loadWorkspace(data.access);
      setStatus("Signed in and loaded workspace.");
    } catch (error) {
      setStatus(`Login failed: ${(error as Error).message}`);
    }
  };

  const handleRefreshWorkspace = async () => {
    if (!isAuthenticated) {
      return;
    }

    try {
      await runWithAccessToken((activeToken) => loadWorkspace(activeToken));
      setStatus("Workspace refreshed.");
    } catch (error) {
      setStatus(`Refresh failed: ${(error as Error).message}`);
    }
  };

  const handleSignOut = () => {
    setToken("");
    setRefreshToken("");
    setProfile(null);
    setAskResult(null);
    setSearchAnswer(null);
    setSearchResults([]);
    setSearchSources([]);
    setHistory([]);
    setDashboard(null);
    setGraph(null);
    setClusters(null);
    setNotes([]);
    setAuthMode("login");
    setStatus("Signed out.");
  };

  const handleCreateNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthenticated) {
      setStatus("Sign in first to create notes.");
      return;
    }

    try {
      const created = await runWithAccessToken((activeToken) =>
        createNote(activeToken, { title: noteTitle, content: noteBody }),
      );
      setNotes((current) => [created, ...current]);
      setNoteTitle("");
      setNoteBody("");
      setStatus("Note created.");
    } catch (error) {
      setStatus(`Could not create note: ${(error as Error).message}`);
    }
  };

  const handleIngestUrl = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthenticated) {
      setStatus("Sign in first to import from URL.");
      return;
    }

    try {
      const created = await runWithAccessToken((activeToken) =>
        ingestUrl(activeToken, { url: urlToIngest, title: urlTitle || undefined }),
      );
      setNotes((current) => [created, ...current]);
      setUrlToIngest("");
      setUrlTitle("");
      setStatus("URL imported as a note.");
    } catch (error) {
      setStatus(`URL import failed: ${(error as Error).message}`);
    }
  };

  const handleIngestText = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthenticated) {
      setStatus("Sign in first to import text.");
      return;
    }

    try {
      const created = await runWithAccessToken((activeToken) =>
        ingestText(activeToken, {
          content: textToIngest,
          title: textTitle || undefined,
        }),
      );
      setNotes((current) => [created, ...current]);
      setTextToIngest("");
      setTextTitle("");
      setStatus("Text imported as a note.");
    } catch (error) {
      setStatus(`Text import failed: ${(error as Error).message}`);
    }
  };

  const handleIngestPdf = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthenticated) {
      setStatus("Sign in first to import a PDF.");
      return;
    }
    if (!pdfFile) {
      setStatus("Choose a PDF file first.");
      return;
    }

    try {
      const created = await runWithAccessToken((activeToken) =>
        ingestPdf(activeToken, pdfFile, pdfTitle || undefined),
      );
      setNotes((current) => [created, ...current]);
      setPdfFile(null);
      setPdfTitle("");
      setStatus("PDF imported as a note.");
    } catch (error) {
      setStatus(`PDF import failed: ${(error as Error).message}`);
    }
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthenticated) {
      setStatus("Sign in first to run semantic search.");
      return;
    }

    try {
      const response = await runWithAccessToken((activeToken) =>
        semanticSearch(activeToken, {
          query: searchQuery,
          include_answer: true,
          response_length: searchResponseLength,
        }),
      );
      setSearchResults(response.results);
      setSearchAnswer(response.answer ?? null);
      setSearchConfidence(typeof response.confidence === "number" ? response.confidence : null);
      setSearchSources(response.source_notes ?? []);
      setStatus(`Search returned ${response.results.length} results.`);
    } catch (error) {
      setStatus(`Search failed: ${(error as Error).message}`);
    }
  };

  const handleAsk = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthenticated) {
      setStatus("Sign in first to ask questions.");
      return;
    }

    try {
      const response = await runWithAccessToken((activeToken) =>
        askQuestion(activeToken, { question }),
      );
      setAskResult(response);
      const updatedHistory = await runWithAccessToken((activeToken) =>
        fetchAskHistory(activeToken),
      );
      setHistory(updatedHistory);
      setStatus("Q&A response generated.");
    } catch (error) {
      setStatus(`Ask failed: ${(error as Error).message}`);
    }
  };

  const handleLoadInsights = async () => {
    if (!isAuthenticated) {
      setStatus("Sign in first to load analytics and graph.");
      return;
    }

    try {
      const [loadedDashboard, loadedGraph] = await runWithAccessToken((activeToken) =>
        Promise.all([fetchDashboard(activeToken), fetchGraph(activeToken)]),
      );
      setDashboard(loadedDashboard);
      setGraph(loadedGraph);
      setStatus("Insights loaded.");
    } catch (error) {
      setStatus(`Could not load insights: ${(error as Error).message}`);
    }
  };

  const handleRunClusters = async () => {
    if (!isAuthenticated) {
      setStatus("Sign in first to run cluster analysis.");
      return;
    }

    try {
      const response = await runWithAccessToken((activeToken) => runClusterAnalysis(activeToken));
      setClusters(response);
      setActiveCluster(null);
      setStatus(`Cluster analysis found ${response.clusters.length} clusters.`);
    } catch (error) {
      setStatus(`Cluster analysis failed: ${(error as Error).message}`);
    }
  };

  const refreshInsightsAfterMutation = async () => {
    if (!isAuthenticated) {
      return;
    }
    try {
      const [loadedDashboard, loadedGraph] = await runWithAccessToken((activeToken) =>
        Promise.all([fetchDashboard(activeToken), fetchGraph(activeToken)]),
      );
      setDashboard(loadedDashboard);
      setGraph(loadedGraph);
    } catch {
      // Ignore insight refresh failures after note mutations to keep edit/delete responsive.
    }
  };

  const startEditingNote = (note: Note) => {
    setEditingNoteId(note.id);
    setEditTitle(note.title);
    setEditContent(note.content);
  };

  const cancelEditingNote = () => {
    setEditingNoteId(null);
    setEditTitle("");
    setEditContent("");
  };

  const handleSaveEditedNote = async (noteId: string) => {
    if (!isAuthenticated) {
      setStatus("Sign in first to edit notes.");
      return;
    }

    const nextTitle = editTitle.trim();
    const nextContent = editContent.trim();
    if (!nextTitle || !nextContent) {
      setStatus("Title and content are required.");
      return;
    }

    try {
      setNoteActionPendingId(noteId);
      const updated = await runWithAccessToken((activeToken) =>
        updateNote(activeToken, noteId, {
          title: nextTitle,
          content: nextContent,
        }),
      );
      setNotes((current) => current.map((note) => (note.id === noteId ? updated : note)));
      setClusters(null);
      cancelEditingNote();
      setStatus("Note updated.");
      await refreshInsightsAfterMutation();
    } catch (error) {
      setStatus(`Could not update note: ${(error as Error).message}`);
    } finally {
      setNoteActionPendingId(null);
    }
  };

  const handleDeleteNote = async (noteId: string, noteTitleText: string) => {
    if (!isAuthenticated) {
      setStatus("Sign in first to delete notes.");
      return;
    }

    const shouldDelete = window.confirm(`Delete note \"${noteTitleText}\"?`);
    if (!shouldDelete) {
      return;
    }

    try {
      setNoteActionPendingId(noteId);
      await runWithAccessToken((activeToken) => deleteNote(activeToken, noteId));
      setNotes((current) => current.filter((note) => note.id !== noteId));
      setClusters(null);
      if (editingNoteId === noteId) {
        cancelEditingNote();
      }
      setStatus("Note deleted.");
      await refreshInsightsAfterMutation();
    } catch (error) {
      setStatus(`Could not delete note: ${(error as Error).message}`);
    } finally {
      setNoteActionPendingId(null);
    }
  };

  const handleNodeClick = (nodeObject: object) => {
    const node = nodeObject as GraphNode3D;
    setSelectedNodeId(node.id);

    if (effectiveGraphMode !== "3d") {
      return;
    }

    const x = node.x ?? 0;
    const y = node.y ?? 0;
    const z = node.z ?? 0;
    const distance = 85;
    const norm = Math.hypot(x, y, z) || 1;
    const ratio = 1 + distance / norm;

    graphRef.current?.cameraPosition(
      { x: x * ratio, y: y * ratio, z: z * ratio },
      { x, y, z },
      950,
    );
  };

  const ForceGraph3DComponent = forceGraph3D;
  const ForceGraph2DComponent = forceGraph2D;
  const has3DRenderer = Boolean(ForceGraph3DComponent);
  const has2DRenderer = Boolean(ForceGraph2DComponent);
  const effectiveGraphMode: GraphRenderMode =
    graphMode === "3d" && !has3DRenderer && has2DRenderer
      ? "2d"
      : graphMode === "2d" && !has2DRenderer && has3DRenderer
        ? "3d"
        : graphMode;

  useEffect(() => {
    if (graphMode === "3d" && !has3DRenderer && has2DRenderer) {
      setGraphMode("2d");
      setStatus("3D renderer unavailable on this device, switched to 2D.");
    }
  }, [graphMode, has2DRenderer, has3DRenderer]);

  useEffect(() => {
    if (graphSceneData.nodes.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      const graphApi = graphRef.current;
      if (!graphApi) {
        return;
      }

      graphApi.d3ReheatSimulation?.();
      graphApi.zoomToFit?.(780, 60);

      if (effectiveGraphMode === "3d") {
        graphApi.cameraPosition?.({ x: 0, y: 0, z: 260 });
      }
    }, 220);

    return () => window.clearTimeout(timer);
  }, [effectiveGraphMode, graphSceneData.nodes.length, graphSceneData.links.length, graphViewport.width, graphViewport.height]);

  const handleToggleGraphMode = (mode: GraphRenderMode) => {
    if (mode === "3d" && !has3DRenderer) {
      setStatus("3D renderer is not available in this browser. Use 2D mode.");
      return;
    }
    if (mode === "2d" && !has2DRenderer) {
      setStatus("2D renderer is still loading. Please wait a moment.");
      return;
    }

    setGraphMode(mode);
    setStatus(mode === "3d" ? "Graph mode set to 3D." : "Graph mode set to 2D.");
  };

  const handleCenterGraph = () => {
    const graphApi = graphRef.current;
    if (!graphApi) {
      return;
    }

    graphApi.d3ReheatSimulation?.();
    graphApi.zoomToFit?.(780, 60);
    if (effectiveGraphMode === "3d") {
      graphApi.cameraPosition?.({ x: 0, y: 0, z: 260 });
    }
    setStatus("Graph recentered in view.");
  };

  return (
    <div className="shell">
      <header className="hero">
        <p className="eyebrow">AI-Powered Second Brain</p>
        <h1>Noty Brain</h1>
        <p className="subtitle">
          End-to-end workspace with auth, notes, ingestion, semantic search, grounded Q&A, graph, and analytics.
        </p>
      </header>

      {!isAuthenticated ? (
        <section className="card auth-panel">
          <div className="auth-header">
            <h2>{authMode === "register" ? "Create Account" : "Sign In"}</h2>
            <div className="segmented auth-segment" role="tablist" aria-label="Authentication mode">
              <button
                type="button"
                className={authMode === "register" ? "active" : ""}
                onClick={() => setAuthMode("register")}
              >
                Create
              </button>
              <button
                type="button"
                className={authMode === "login" ? "active" : ""}
                onClick={() => setAuthMode("login")}
              >
                Sign In
              </button>
            </div>
          </div>

          {authMode === "register" ? (
            <form onSubmit={handleRegister}>
              <input
                placeholder="Display name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
              />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button type="submit">Register</button>
              <p className="auth-switch-line">
                Already have an account?{" "}
                <button type="button" className="text-link" onClick={() => setAuthMode("login")}>
                  Sign in instead
                </button>
              </p>
            </form>
          ) : (
            <>
              <form onSubmit={handleLogin}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
                <button type="submit">Get Access Token</button>
                <p className="auth-switch-line">
                  New here?{" "}
                  <button type="button" className="text-link" onClick={() => setAuthMode("register")}>
                    Create account
                  </button>
                </p>
              </form>
            </>
          )}
        </section>
      ) : (
        <section className="card profile-panel">
          <div className="profile-topbar">
            <div className="segmented" role="tablist" aria-label="Signed in panel">
              <button type="button" className="active">
                Profile
              </button>
            </div>
            <div className="profile-actions">
              <button type="button" className="button-neutral" onClick={handleRefreshWorkspace}>
                Refresh Workspace
              </button>
              <button type="button" className="button-danger" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>
          </div>

          <div className="profile-grid">
            <article className="profile-card">
              <h3>Account</h3>
              <p>
                Username: <strong>{profile?.username ?? email.split("@")[0] ?? "-"}</strong>
              </p>
              <p>
                Email: <strong>{profile?.email || email || "-"}</strong>
              </p>
              <p>
                Display name: <strong>{profile?.display_name || "-"}</strong>
              </p>
              <p>
                Member since:{" "}
                <strong>
                  {profile?.date_joined ? new Date(profile.date_joined).toLocaleDateString() : "-"}
                </strong>
              </p>
            </article>
          </div>
        </section>
      )}

      <nav className="tabbar" aria-label="Workspace sections">
        <button
          type="button"
          className={activeTab === "capture" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("capture")}
        >
          <span>Capture</span>
          <small>Write and ingest notes</small>
        </button>
        <button
          type="button"
          className={activeTab === "explore" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("explore")}
        >
          <span>Explore</span>
          <small>Search, ask, and browse notes</small>
        </button>
        <button
          type="button"
          className={activeTab === "graph" ? "tab-button active" : "tab-button"}
          onClick={() => setActiveTab("graph")}
        >
          <span>Graph Lab</span>
          <small>Nodes, links, and clusters</small>
        </button>
      </nav>

      {activeTab === "capture" && (
        <>
          <section className="card">
            <h2>Create Manual Note</h2>
            <form onSubmit={handleCreateNote}>
              <input
                placeholder="Note title"
                value={noteTitle}
                onChange={(event) => setNoteTitle(event.target.value)}
                required
              />
              <textarea
                placeholder="Write markdown or plain text"
                rows={5}
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
                required
              />
              <button type="submit" disabled={!isAuthenticated}>
                Save Note
              </button>
            </form>
          </section>

          <section className="grid three">
            <article className="card">
              <h2>Import URL</h2>
              <form onSubmit={handleIngestUrl}>
                <input
                  type="url"
                  placeholder="https://example.com/article"
                  value={urlToIngest}
                  onChange={(event) => setUrlToIngest(event.target.value)}
                  required
                />
                <input
                  placeholder="Optional title override"
                  value={urlTitle}
                  onChange={(event) => setUrlTitle(event.target.value)}
                />
                <button type="submit" disabled={!isAuthenticated}>
                  Import URL
                </button>
              </form>
            </article>

            <article className="card">
              <h2>Import Pasted Text</h2>
              <form onSubmit={handleIngestText}>
                <input
                  placeholder="Optional title"
                  value={textTitle}
                  onChange={(event) => setTextTitle(event.target.value)}
                />
                <textarea
                  placeholder="Paste raw text"
                  rows={4}
                  value={textToIngest}
                  onChange={(event) => setTextToIngest(event.target.value)}
                  required
                />
                <button type="submit" disabled={!isAuthenticated}>
                  Import Text
                </button>
              </form>
            </article>

            <article className="card">
              <h2>Import PDF</h2>
              <form onSubmit={handleIngestPdf}>
                <input
                  placeholder="Optional title"
                  value={pdfTitle}
                  onChange={(event) => setPdfTitle(event.target.value)}
                />
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
                  required
                />
                <button type="submit" disabled={!isAuthenticated}>
                  Import PDF
                </button>
              </form>
            </article>
          </section>
        </>
      )}

      {activeTab === "explore" && (
        <>
          <section className="grid two explore-grid">
            <article className="card">
              <h2>Semantic Search</h2>
              <form onSubmit={handleSearch}>
                <input
                  placeholder="Search by meaning"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  required
                />
                <div className="search-controls-row">
                  <label className="search-control-field">
                    <span>Answer length</span>
                    <select
                      value={searchResponseLength}
                      onChange={(event) =>
                        setSearchResponseLength(event.target.value as "short" | "medium" | "long")
                      }
                    >
                      <option value="short">Short</option>
                      <option value="medium">Medium</option>
                      <option value="long">Long</option>
                    </select>
                  </label>
                </div>
                <button type="submit" disabled={!isAuthenticated}>
                  Search
                </button>
              </form>

              {searchAnswer && (
                <div className="answer-box">
                  <p>{searchAnswer}</p>
                  <small>
                    confidence: {searchConfidence ?? 0}
                    {searchSources.length > 0
                      ? ` | sources: ${searchSources.map((note) => note.title).join(", ")}`
                      : ""}
                  </small>
                </div>
              )}

              <div className="list compact">
                {searchResults.length === 0 && <p className="muted">No search results yet.</p>}
                {searchResults.map((result) => (
                  <article key={result.note_id} className="item">
                    <h3>{result.title}</h3>
                    <p>{result.excerpt}</p>
                    <small>score: {result.similarity_score}</small>
                  </article>
                ))}
              </div>
            </article>

            <article className="card">
              <h2>Ask Your Notes</h2>
              <form onSubmit={handleAsk}>
                <input
                  placeholder="What do I know about...?"
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  required
                />
                <button type="submit" disabled={!isAuthenticated}>
                  Ask
                </button>
              </form>

              {askResult && (
                <div className="answer-box">
                  <p>{askResult.answer}</p>
                  <small>confidence: {askResult.confidence}</small>
                </div>
              )}

              <div className="list compact">
                <h3>Recent Q&A</h3>
                {history.length === 0 && <p className="muted">No history yet.</p>}
                {history.slice(0, 5).map((entry) => (
                  <article key={entry.id} className="item">
                    <h4>{entry.question}</h4>
                    <p>{entry.answer}</p>
                  </article>
                ))}
              </div>
            </article>
          </section>

          <section className="card">
            <h2>All Notes</h2>
            <div className="list notes-scroll">
              {notes.length === 0 && <p className="muted">No notes yet.</p>}
              {notes.map((note) => (
                <article key={note.id} className="item">
                  {editingNoteId === note.id ? (
                    <div className="note-edit-wrap">
                      <input
                        value={editTitle}
                        onChange={(event) => setEditTitle(event.target.value)}
                        placeholder="Note title"
                        disabled={noteActionPendingId === note.id}
                      />
                      <textarea
                        rows={6}
                        value={editContent}
                        onChange={(event) => setEditContent(event.target.value)}
                        placeholder="Note content"
                        disabled={noteActionPendingId === note.id}
                      />
                      <div className="note-actions">
                        <button
                          type="button"
                          onClick={() => handleSaveEditedNote(note.id)}
                          disabled={noteActionPendingId === note.id}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="button-neutral"
                          onClick={cancelEditingNote}
                          disabled={noteActionPendingId === note.id}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <h3>{note.title}</h3>
                      <p>{note.content.slice(0, 240)}</p>
                      <small>
                        source: {note.source_type} | updated: {new Date(note.updated_at).toLocaleString()}
                      </small>
                      <div className="note-actions">
                        <button
                          type="button"
                          className="button-neutral"
                          onClick={() => startEditingNote(note)}
                          disabled={noteActionPendingId === note.id}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="button-danger"
                          onClick={() => handleDeleteNote(note.id, note.title)}
                          disabled={noteActionPendingId === note.id}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </article>
              ))}
            </div>
          </section>
        </>
      )}

      {activeTab === "graph" && (
        <section className="card">
        <div className="row between">
          <h2>Graph and Analytics</h2>
          <div className="row">
            <button onClick={handleLoadInsights} disabled={!isAuthenticated}>
              Load Insights
            </button>
            <button onClick={handleRunClusters} disabled={!isAuthenticated}>
              Discover Connections
            </button>
          </div>
        </div>

        <div className="grid three">
          <article className="metric">
            <h3>Total Notes</h3>
            <p>{dashboard?.total_notes ?? 0}</p>
          </article>
          <article className="metric">
            <h3>This Week</h3>
            <p>{dashboard?.notes_added_this_week ?? 0}</p>
          </article>
          <article className="metric">
            <h3>Questions Asked</h3>
            <p>{dashboard?.questions_count ?? 0}</p>
          </article>
        </div>

        <div className="grid two">
          <article className="card inset">
            <h3>Graph Summary</h3>
            <p>Nodes: {graph?.nodes.length ?? 0}</p>
            <p>Edges: {graph?.edges.length ?? 0}</p>
          </article>

          <article className="card inset">
            <h3>Cluster Summary</h3>
            <p>Suggested k: {clusters?.suggested_k ?? 0}</p>
            <p>Clusters: {clusters?.clusters.length ?? 0}</p>
          </article>
        </div>

        <div className="graph-toolbar">
          <div className="graph-toolbar-top">
            <input
              placeholder="Filter nodes by title, tag, or source"
              value={nodeSearch}
              onChange={(event) => setNodeSearch(event.target.value)}
              disabled={!isAuthenticated}
            />
            <label className="graph-node-picker">
              <span>Pick node</span>
              <select
                value={focusNodeId}
                onChange={(event) => setFocusNodeId(event.target.value)}
                disabled={!isAuthenticated || graphNodeOptions.length === 0}
              >
                <option value="">All nodes</option>
                {graphNodeOptions.map((node) => (
                  <option key={node.id} value={node.id}>
                    {node.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="graph-toolbar-bottom">
            <div className="segmented graph-edge-tabs" role="tablist" aria-label="Edge filter">
              <button
                type="button"
                className={edgeView === "all" ? "active" : ""}
                onClick={() => setEdgeView("all")}
              >
                All Edges
              </button>
              <button
                type="button"
                className={edgeView === "ai" ? "active" : ""}
                onClick={() => setEdgeView("ai")}
              >
                AI Links
              </button>
              <button
                type="button"
                className={edgeView === "manual" ? "active" : ""}
                onClick={() => setEdgeView("manual")}
              >
                Manual Links
              </button>
            </div>

            <div className="graph-toolbar-right">
              <div className="segmented" role="tablist" aria-label="Graph render mode">
                <button
                  type="button"
                  className={effectiveGraphMode === "3d" ? "active" : ""}
                  onClick={() => handleToggleGraphMode("3d")}
                  disabled={!has3DRenderer}
                  title={has3DRenderer ? "Switch to 3D graph" : "3D renderer unavailable"}
                >
                  3D
                </button>
                <button
                  type="button"
                  className={effectiveGraphMode === "2d" ? "active" : ""}
                  onClick={() => handleToggleGraphMode("2d")}
                  disabled={!has2DRenderer}
                  title={has2DRenderer ? "Switch to 2D graph" : "2D renderer loading"}
                >
                  2D
                </button>
              </div>
              <button
                type="button"
                className="button-neutral"
                onClick={handleCenterGraph}
                disabled={graphSceneData.nodes.length === 0}
                title="Center graph in the canvas"
              >
                Center Graph
              </button>
            </div>
          </div>
        </div>
        <p className="muted graph-toggle-help">
          Toggle graph mode: click <strong>3D</strong> for orbit/zoom view or <strong>2D</strong> for planar view. Use <strong>Center Graph</strong> anytime to recenter nodes inside the canvas.
        </p>

        {clusters && clusters.clusters.length > 0 && (
          <div className="cluster-strip">
            <button
              type="button"
              className={activeCluster === null ? "cluster-pill active" : "cluster-pill"}
              onClick={() => setActiveCluster(null)}
            >
              All Clusters
            </button>
            {clusters.clusters.map((cluster, index) => (
              <button
                type="button"
                key={`${cluster.label}-${index}`}
                className={activeCluster === index ? "cluster-pill active" : "cluster-pill"}
                onClick={() => setActiveCluster(index)}
              >
                {cluster.label} ({cluster.size})
              </button>
            ))}
          </div>
        )}

        <div className="graph-grid">
          <article className="card inset graph-canvas-card">
            <h3>3D Knowledge Graph</h3>
            <p className="muted">
              Rotate and zoom to inspect note neighborhoods. Click a node to focus camera and inspect
              linked details.
            </p>
            <div className="graph-stage" ref={graphStageRef}>
              {graphSceneData.nodes.length === 0 ? (
                <p className="muted graph-empty">
                  No graph nodes to render. Load insights, create notes, and run cluster analysis first.
                </p>
              ) : (
                <>
                  {graphLibError ? (
                    <div className="fallback-wrap">
                      <p className="muted graph-empty">{graphLibError}</p>
                      <svg
                        className="fallback-graph-svg"
                        viewBox={`0 0 ${fallbackLayout.width} ${fallbackLayout.height}`}
                        role="img"
                        aria-label="Fallback knowledge graph"
                      >
                        {fallbackLayout.links.map((link) => (
                          <line
                            key={`f-link-${link.id}`}
                            x1={link.sx}
                            y1={link.sy}
                            x2={link.tx}
                            y2={link.ty}
                            stroke={link.is_ai_generated ? "#2a8f86" : "#8a6d3b"}
                            strokeWidth={link.is_ai_generated ? 2 : 1.2}
                            strokeOpacity={0.58}
                          />
                        ))}
                        {fallbackLayout.nodes.map((node) => (
                          <g
                            key={`f-node-${node.id}`}
                            className="fallback-node"
                            onClick={() => setSelectedNodeId(node.id)}
                          >
                            <circle cx={node.px} cy={node.py} r={node.radius} fill={node.color} />
                            <text x={node.px} y={node.py - node.radius - 5} textAnchor="middle">
                              {truncateText(node.title, 24)}
                            </text>
                          </g>
                        ))}
                      </svg>
                    </div>
                  ) : !ForceGraph3DComponent && !ForceGraph2DComponent ? (
                    <p className="muted graph-empty">Loading graph renderer...</p>
                  ) : effectiveGraphMode === "3d" && ForceGraph3DComponent ? (
                    <ForceGraph3DComponent
                      ref={graphRef}
                      graphData={graphSceneData}
                      width={graphViewport.width}
                      height={graphViewport.height}
                      linkDistance={graphLinkDistance}
                      linkStrength={graphLinkStrength}
                      d3AlphaDecay={0.04}
                      d3VelocityDecay={0.36}
                      nodeLabel={(node: object) => {
                        const item = node as GraphNode3D;
                        return `${item.title}\nSource: ${sourceTypeLabel(item.source_type)}\nTags: ${item.tags.join(", ") || "none"}`;
                      }}
                      nodeColor={(node: object) => (node as GraphNode3D).color}
                      nodeVal={(node: object) => (node as GraphNode3D).val}
                      linkColor={(link: object) => ((link as GraphLink3D).is_ai_generated ? "#2a8f86" : "#8a6d3b")}
                      linkWidth={(link: object) => ((link as GraphLink3D).is_ai_generated ? 1.6 : 0.9)}
                      linkDirectionalParticles={(link: object) => ((link as GraphLink3D).is_ai_generated ? 2 : 0)}
                      linkDirectionalParticleWidth={1.4}
                      linkDirectionalParticleSpeed={0.008}
                      showNavInfo={false}
                      onNodeClick={handleNodeClick}
                      backgroundColor="rgba(0,0,0,0)"
                    />
                  ) : ForceGraph2DComponent ? (
                    <ForceGraph2DComponent
                      ref={graphRef}
                      graphData={graphSceneData}
                      width={graphViewport.width}
                      height={graphViewport.height}
                      linkDistance={graphLinkDistance}
                      linkStrength={graphLinkStrength}
                      d3AlphaDecay={0.04}
                      nodeLabel={(node: object) => {
                        const item = node as GraphNode3D;
                        return `${item.title}\nSource: ${sourceTypeLabel(item.source_type)}\nTags: ${item.tags.join(", ") || "none"}`;
                      }}
                      nodeVal={(node: object) => (node as GraphNode3D).val}
                      nodeColor={(node: object) => (node as GraphNode3D).color}
                      linkColor={(link: object) => ((link as GraphLink3D).is_ai_generated ? "#2a8f86" : "#8a6d3b")}
                      linkWidth={(link: object) => ((link as GraphLink3D).is_ai_generated ? 2 : 1)}
                      onNodeClick={handleNodeClick}
                      cooldownTicks={120}
                      d3VelocityDecay={0.28}
                      backgroundColor="rgba(0,0,0,0)"
                    />
                  ) : (
                    <p className="muted graph-empty">Loading graph renderer...</p>
                  )}
                </>
              )}
            </div>
          </article>

          <aside className="card inset graph-sidepanel">
            <h3>Selection Inspector</h3>
            {selectedNode ? (
              <div className="node-detail">
                <p className="node-title">{selectedNode.title}</p>
                <p>
                  Source: <strong>{sourceTypeLabel(selectedNode.source_type)}</strong>
                </p>
                <p>
                  Cluster: <strong>{selectedNode.clusterIndex >= 0 ? selectedNode.clusterIndex + 1 : "Unassigned"}</strong>
                </p>
                <p>
                  Tags: <strong>{selectedNode.tags.join(", ") || "none"}</strong>
                </p>
                <p>
                  Degree weight: <strong>{selectedNode.val.toFixed(1)}</strong>
                </p>
              </div>
            ) : (
              <p className="muted">Click a node in the 3D graph to inspect its details.</p>
            )}

            <h3>Cluster Distribution</h3>
            {!clusters || clusters.clusters.length === 0 ? (
              <p className="muted">Run Discover Connections to generate cluster distribution.</p>
            ) : (
              <div className="cluster-bars">
                {clusters.clusters.map((cluster, index) => {
                  const widthPercent = (cluster.size / maxClusterSize) * 100;
                  return (
                    <article key={`${cluster.label}-bar-${index}`} className="cluster-bar-row">
                      <div className="cluster-bar-head">
                        <span>{truncateText(cluster.label, 38)}</span>
                        <span>{cluster.size}</span>
                      </div>
                      <div className="cluster-bar-track">
                        <span
                          className="cluster-bar-fill"
                          style={{
                            width: `${Math.max(10, widthPercent)}%`,
                            background: CLUSTER_PALETTE[index % CLUSTER_PALETTE.length],
                          }}
                        />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </aside>
        </div>
      </section>
      )}

      <footer className="status">Status: {status}</footer>
    </div>
  );
}

export default App;
