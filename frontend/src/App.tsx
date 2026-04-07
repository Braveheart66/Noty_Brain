import { Component, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, FormEvent, ReactNode } from "react";
import type { JSONContent } from "@tiptap/react";
import {
  addManualLink,
  createNote,
  createTemplate,
  deleteNote,
  fetchBacklinks,
  fetchDashboard,
  fetchGraph,
  fetchNotes,
  fetchProfile,
  fetchTemplates,
  ingestPdf,
  ingestText,
  ingestUrl,
  refreshAccessToken,
  login,
  register,
  runClusterAnalysis,
  semanticSearch,
  updateNote,
} from "./api/client";
import type {
  Backlink,
  ClusterPayload,
  DashboardStats,
  GraphPayload,
  Note,
  Profile,
  SearchResult,
  Template,
} from "./api/client";
import { BlockEditor } from "./components/editor/BlockEditor";
import { EMPTY_DOC, jsonToPlainText, plainTextToDoc, sanitizeEditorJson } from "./components/editor/richText";
import { CommandPalette } from "./components/workspace/CommandPalette";
import { TemplatePickerModal } from "./components/workspace/TemplatePickerModal";
import { AnimatedNavFramer } from "./components/ui/navigation-menu";
import { NoteParticleCanvas } from "./components/ui/NoteParticleCanvas.tsx";
import { TiltCard } from "./components/ui/tilt-card";
import { FeatureSection } from "./components/ui/feature-section";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { MockCaptureUI } from "./components/ui/mock-capture-ui";
import { MockExploreUI } from "./components/ui/mock-explore-ui";
import { MockGraphUI } from "./components/ui/mock-graph-ui";
import { motion } from "framer-motion";
import "./App.css";
import "./home-redesign-fixes.css";

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
type WorkspacePage = "home" | "capture" | "explore" | "graph";
type AuthMode = "register" | "login";
type GraphRenderer = ComponentType<any>;
type BrowseSource = "all" | "notes" | "imports";

type LoginFormState = {
  email: string;
  password: string;
};

type RegisterFormState = {
  displayName: string;
  email: string;
  password: string;
};

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

type DraftTemplatePayload = {
  title: string;
  icon: string;
  json: JSONContent;
  text: string;
};

type HomeChipIconProps = {
  className?: string;
};

type GraphRendererBoundaryProps = {
  children: ReactNode;
  resetKey: string;
  fallback: ReactNode;
  onError: (error: Error) => void;
};

type GraphRendererBoundaryState = {
  hasError: boolean;
};

class GraphRendererBoundary extends Component<GraphRendererBoundaryProps, GraphRendererBoundaryState> {
  state: GraphRendererBoundaryState = { hasError: false };

  static getDerivedStateFromError(): GraphRendererBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {
    this.props.onError(error);
  }

  componentDidUpdate(prevProps: GraphRendererBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

function BrainIcon({ className }: HomeChipIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9.8 4.5a3.2 3.2 0 0 0-6.1 1.3v.7a3.2 3.2 0 0 0 .8 2.1 3.2 3.2 0 0 0-.8 2.1v.8a3.2 3.2 0 0 0 3.2 3.2" />
      <path d="M14.2 4.5a3.2 3.2 0 0 1 6.1 1.3v.7a3.2 3.2 0 0 1-.8 2.1 3.2 3.2 0 0 1 .8 2.1v.8a3.2 3.2 0 0 1-3.2 3.2" />
      <path d="M9.8 4.5A3.2 3.2 0 0 1 12 3.7a3.2 3.2 0 0 1 2.2.8" />
      <path d="M12 7.2v9.1" />
      <path d="M8.8 10.1c1.1 0 2 .9 2 2" />
      <path d="M15.2 10.1c-1.1 0-2 .9-2 2" />
      <path d="M12 16.3c-1.1 0-2 .9-2 2" />
      <path d="M12 16.3c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function NetworkIcon({ className }: HomeChipIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="5" cy="12" r="2.4" />
      <circle cx="12" cy="5" r="2.4" />
      <circle cx="19" cy="12" r="2.4" />
      <circle cx="12" cy="19" r="2.4" />
      <path d="m7.3 10.8 3-4.1" />
      <path d="m13.7 6.7 3 4.1" />
      <path d="m7.3 13.2 3 4.1" />
      <path d="m13.7 17.3 3-4.1" />
    </svg>
  );
}

function ZapIcon({ className }: HomeChipIconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M13.5 2.8 5.7 13.2h5.1l-.3 8 7.8-10.4h-5.1z" />
    </svg>
  );
}

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

function sourceBadgeLabel(sourceType: string): string {
  if (sourceType === "manual") {
    return "Notes";
  }
  return "Imports";
}

function extractApiErrorMessage(rawMessage: string): string {
  if (!rawMessage) {
    return "Unexpected error.";
  }

  try {
    const parsed = JSON.parse(rawMessage) as
      | string
      | {
          detail?: string;
          non_field_errors?: string[];
          [key: string]: unknown;
        };

    if (typeof parsed === "string") {
      return parsed;
    }

    if (typeof parsed.detail === "string" && parsed.detail.trim().length > 0) {
      return parsed.detail;
    }

    if (Array.isArray(parsed.non_field_errors) && parsed.non_field_errors.length > 0) {
      return parsed.non_field_errors.join(" ");
    }

    for (const [field, value] of Object.entries(parsed)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === "string") {
        return `${field}: ${(value as string[]).join(" ")}`;
      }
      if (typeof value === "string" && value.trim().length > 0) {
        return `${field}: ${value}`;
      }
    }
  } catch {
    return rawMessage;
  }

  return rawMessage;
}

function humanizeLoginError(rawMessage: string): string {
  const message = extractApiErrorMessage(rawMessage);
  if (/no active account found|invalid credentials/i.test(message)) {
    return "Incorrect email or password.";
  }
  return message;
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

function resolveWorkspacePage(path: string): WorkspacePage {
  if (path === "/" || path.startsWith("/home")) {
    return "home";
  }
  if (path.startsWith("/explore")) {
    return "explore";
  }
  if (path.startsWith("/graph")) {
    return "graph";
  }
  return "capture";
}

function detectWebGLSupport(): { supported: boolean; reason: string | null } {
  if (typeof window === "undefined") {
    return { supported: false, reason: "WebGL is unavailable in the current runtime." };
  }

  const canvas = window.document.createElement("canvas");
  const context =
    canvas.getContext("webgl2") ??
    canvas.getContext("webgl") ??
    canvas.getContext("experimental-webgl");

  if (!context) {
    return {
      supported: false,
      reason: "WebGL is disabled in this browser or blocked by the current device policy.",
    };
  }

  return { supported: true, reason: null };
}

function App() {
  const [loginForm, setLoginForm] = useState<LoginFormState>({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState<RegisterFormState>({ displayName: "", email: "", password: "" });
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [token, setToken] = useState("");
  const [refreshToken, setRefreshToken] = useState("");
  const [authBootstrapping, setAuthBootstrapping] = useState(true);
  const [sessionHydrated, setSessionHydrated] = useState(false);

  const [status, setStatus] = useState("Ready");
  const [profile, setProfile] = useState<Profile | null>(null);

  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [editorTitle, setEditorTitle] = useState("Untitled Note");
  const [editorIcon, setEditorIcon] = useState("📝");
  const [editorJson, setEditorJson] = useState<JSONContent>(EMPTY_DOC);
  const [editorText, setEditorText] = useState("");
  const [editorDirty, setEditorDirty] = useState(false);
  const [isDraftMode, setIsDraftMode] = useState(false);
  const [pendingTemplateDraft, setPendingTemplateDraft] = useState<DraftTemplatePayload | null>(null);
  const [backlinks, setBacklinks] = useState<Backlink[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [templateNameDraft, setTemplateNameDraft] = useState("");
  const [noteActionPendingId, setNoteActionPendingId] = useState<string | null>(null);
  const [urlImportTitle, setUrlImportTitle] = useState("");
  const [urlImportValue, setUrlImportValue] = useState("");
  const [textImportTitle, setTextImportTitle] = useState("");
  const [textImportValue, setTextImportValue] = useState("");
  const [pdfImportTitle, setPdfImportTitle] = useState("");
  const [pdfImportFile, setPdfImportFile] = useState<File | null>(null);
  const [captureImportPending, setCaptureImportPending] = useState<"url" | "text" | "pdf" | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchAnswer, setSearchAnswer] = useState<string | null>(null);
  const [searchConfidence, setSearchConfidence] = useState<number | null>(null);
  const [searchSources, setSearchSources] = useState<Array<{ id: string; title: string; similarity_score: number }>>([]);
  const [searchResponseLength, setSearchResponseLength] = useState<"short" | "medium" | "long">("medium");
  const [browseQuery, setBrowseQuery] = useState("");
  const [browseSource, setBrowseSource] = useState<BrowseSource>("all");
  const [browseFromDate, setBrowseFromDate] = useState("");
  const [browseToDate, setBrowseToDate] = useState("");
  const [browseSort, setBrowseSort] = useState<"updated_desc" | "updated_asc">("updated_desc");
  const [browseFilterOpen, setBrowseFilterOpen] = useState(false);

  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [graph, setGraph] = useState<GraphPayload | null>(null);
  const [clusters, setClusters] = useState<ClusterPayload | null>(null);
  const [edgeView, setEdgeView] = useState<EdgeViewMode>("all");
  const [graphMode, setGraphMode] = useState<GraphRenderMode>("2d");
  const [forceGraph2D, setForceGraph2D] = useState<GraphRenderer | null>(null);
  const [forceGraph3D, setForceGraph3D] = useState<GraphRenderer | null>(null);
  const [isLoading3DRenderer, setIsLoading3DRenderer] = useState(false);
  const [graph3DRetryNonce, setGraph3DRetryNonce] = useState(0);
  const [graphLibError, setGraphLibError] = useState<string | null>(null);
  const [graph3DError, setGraph3DError] = useState<string | null>(null);
  const [nodeSearch, setNodeSearch] = useState("");
  const [focusNodeId, setFocusNodeId] = useState("");
  const [activeCluster, setActiveCluster] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [routePath, setRoutePath] = useState(() => window.location.pathname || "/login");

  const graphRef = useRef<any>(undefined);
  const graphStageRef = useRef<HTMLDivElement | null>(null);
  const signInWaveCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfInputRef = useRef<HTMLInputElement | null>(null);
  const [graphViewport, setGraphViewport] = useState({ width: 0, height: 0 });
  const webglSupport = useMemo(() => detectWebGLSupport(), []);
  const isWebGLSupported = webglSupport.supported;

  useEffect(() => {
    const storedAccessToken = window.localStorage.getItem("noty_access_token");
    const storedRefreshToken = window.localStorage.getItem("noty_refresh_token");
    if (storedAccessToken) {
      setToken(storedAccessToken);
      if (storedRefreshToken) {
        setRefreshToken(storedRefreshToken);
      }
      return;
    }
    setAuthBootstrapping(false);
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

      if (!disposed) {
        setIsLoading3DRenderer(true);
      }
      try {
        const { default: ForceGraph3DModule } = await import("react-force-graph-3d");
        if (!disposed) {
          setForceGraph3D(() => ForceGraph3DModule as GraphRenderer);
          setGraph3DError(null);
        }
      } catch (error) {
        threeError = error instanceof Error ? error.message : "unknown 3D error";
        if (!disposed) {
          setGraph3DError(`3D renderer failed to load: ${threeError}`);
        }
      } finally {
        if (!disposed) {
          setIsLoading3DRenderer(false);
        }
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
      } else if (!disposed) {
        setGraphLibError(null);
      }
    };

    loadGraphLibraries();
    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    const isGraphRoute = resolveWorkspacePage(routePath) === "graph";
    if (!isGraphRoute) {
      setGraphViewport((current) => {
        if (current.width === 0 && current.height === 0) {
          return current;
        }
        return { width: 0, height: 0 };
      });
      return;
    }

    const stage = graphStageRef.current;
    if (!stage) {
      return;
    }

    const updateViewport = () => {
      const rect = stage.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      if (width <= 0 || height <= 0) {
        return;
      }
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
  }, [routePath]);

  const isAuthenticated = useMemo(() => token.length > 0, [token]);

  const workspacePage = useMemo(() => resolveWorkspacePage(routePath), [routePath]);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [isAuthenticated, workspacePage]);

  useEffect(() => {
    if (isAuthenticated) {
      return;
    }

    const canvas = signInWaveCanvasRef.current;
    if (!canvas) {
      return;
    }

    const parent = canvas.parentElement;
    const ctx = canvas.getContext("2d");
    if (!parent || !ctx) {
      return;
    }

    const AMOUNT_X = 48;
    const AMOUNT_Y = 44;
    const GRID_HALF_X = 3000;
    const FAR_Z = 35;
    const NEAR_Z = 2100;
    const FOV = 320;
    const CAM_Y = 355;
    const CAM_Z = -80;
    const WAVE_VERTICAL_ANCHOR = 0.68;

    const clamp = (value: number, min: number, max: number) => {
      if (value < min) return min;
      if (value > max) return max;
      return value;
    };

    let count = 0;
    let animationId = 0;
    let viewWidth = 1;
    let viewHeight = 1;

    const resize = () => {
      viewWidth = Math.max(1, parent.offsetWidth);
      viewHeight = Math.max(1, parent.offsetHeight);
      const dpr = window.devicePixelRatio || 1;

      canvas.width = Math.max(1, Math.floor(viewWidth * dpr));
      canvas.height = Math.max(1, Math.floor(viewHeight * dpr));
      canvas.style.width = `${viewWidth}px`;
      canvas.style.height = `${viewHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = () => {
      const W = viewWidth;
      const H = viewHeight;
      ctx.clearRect(0, 0, W, H);

      for (let iy = 0; iy < AMOUNT_Y; iy += 1) {
        const zFrac = iy / Math.max(1, AMOUNT_Y - 1);
        const z3 = FAR_Z + (NEAR_Z - FAR_Z) * zFrac;

        for (let ix = 0; ix < AMOUNT_X; ix += 1) {
          const xFrac = ix / Math.max(1, AMOUNT_X - 1);
          const x3 = -GRID_HALF_X + GRID_HALF_X * 2 * xFrac;

          // Derived from the original DottedSurface wave behavior.
          const baseWaveY =
            Math.sin((ix + count) * 0.3) * 50 +
            Math.sin((iy + count) * 0.5) * 50;
          const nearWeight = Math.pow(1 - zFrac, 1.12);
          const y3 = baseWaveY * (0.34 + nearWeight * 0.72);
          const dz = z3 - CAM_Z;
          if (dz <= 0) {
            continue;
          }

          const scale = FOV / dz;
          const sx = W / 2 + x3 * scale;
          const sy = H * WAVE_VERTICAL_ANCHOR + (y3 - CAM_Y) * scale * -1;
          if (sy < 0) {
            continue;
          }

          const r = 1.2 + (1 - zFrac) * 3.8;
          const depthFade = 0.2 + (1 - zFrac) * 0.8;
          const horizonFade = clamp((sy - H * 0.18) / (H * 0.9), 0, 1);
          const alpha = depthFade * Math.min(1, horizonFade * 2.2);
          if (alpha < 0.001) {
            continue;
          }

          const renderAlpha = Math.min(0.92, alpha * 2.45);
          ctx.fillStyle = `rgba(12, 68, 43, ${renderAlpha})`;
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      count += 0.14;
      animationId = requestAnimationFrame(draw);
    };

    resize();
    draw();
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, [authBootstrapping, isAuthenticated, routePath]);

  const navigateTo = (nextPath: string) => {
    if (routePath === nextPath) {
      return;
    }
    window.history.pushState({}, "", nextPath);
    setRoutePath(nextPath);
  };

  useEffect(() => {
    const handlePopState = () => {
      setRoutePath(window.location.pathname || "/login");
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    if (authBootstrapping) {
      return;
    }

    if (!isAuthenticated && routePath !== "/login") {
      navigateTo("/login");
      return;
    }
    if (isAuthenticated && routePath === "/login") {
      navigateTo("/");
    }
  }, [authBootstrapping, isAuthenticated, routePath]);

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
        window.localStorage.removeItem("noty_access_token");
        window.localStorage.removeItem("noty_refresh_token");
        setToken("");
        setRefreshToken("");
        setAuthBootstrapping(false);
        setSessionHydrated(false);
        navigateTo("/login");
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
    const normalizedGraphNodes = currentGraph.nodes.filter(
      (node): node is GraphPayload["nodes"][number] => typeof node.id === "string" && node.id.trim().length > 0,
    );
    const normalizedGraphEdges = currentGraph.edges.filter((edge) => {
      const sourceId = typeof edge.source_note_id === "string" ? edge.source_note_id.trim() : "";
      const targetId = typeof edge.target_note_id === "string" ? edge.target_note_id.trim() : "";
      return sourceId.length > 0 && targetId.length > 0 && sourceId !== targetId;
    });

    const visibleNodes = normalizedGraphNodes.filter((node) => {
      if (activeCluster !== null && clusterIndexByNoteId.get(node.id) !== activeCluster) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const tags = Array.isArray(node.tags) ? node.tags : [];
      const haystack = `${node.title} ${tags.join(" ")} ${node.source_type}`.toLowerCase();
      return haystack.includes(normalizedSearch);
    });

    const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));

    const visibleEdgesAll = normalizedGraphEdges.filter((edge) => {
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
        tags: Array.isArray(node.tags) ? node.tags : [],
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
      source: edge.source_note_id.trim(),
      target: edge.target_note_id.trim(),
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

      if (graphMode === "2d") {
        return 210 - similarity * 90;
      }
      return 430 - similarity * 170;
    }

    if (graphMode === "2d") {
      return link.is_ai_generated ? 74 : 96;
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

      if (graphMode === "2d") {
        return 0.015 + similarity * 0.045;
      }
      return 0.004 + similarity * 0.022;
    }

    if (graphMode === "2d") {
      return link.is_ai_generated ? 0.13 : 0.17;
    }

    return link.is_ai_generated ? 0.06 : 0.11;
  };

  const graphSceneData2D = useMemo(() => {
    const nodes: GraphNode3D[] = graphSceneData.nodes.map((node) => ({
      ...node,
      x: typeof node.x === "number" ? node.x * 0.45 : undefined,
      y: typeof node.y === "number" ? node.y * 0.45 : undefined,
      z: undefined,
    }));

    return {
      nodes,
      links: graphSceneData.links,
    };
  }, [graphSceneData]);

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

  const filteredBrowseNotes = useMemo(() => {
    const query = browseQuery.trim().toLowerCase();
    const withFilters = notes.filter((note) => {
      if (browseSource === "notes" && note.source_type !== "manual") {
        return false;
      }

      if (browseSource === "imports" && note.source_type === "manual") {
        return false;
      }

      if (browseFromDate) {
        const start = new Date(`${browseFromDate}T00:00:00`).getTime();
        if (new Date(note.updated_at).getTime() < start) {
          return false;
        }
      }

      if (browseToDate) {
        const end = new Date(`${browseToDate}T23:59:59`).getTime();
        if (new Date(note.updated_at).getTime() > end) {
          return false;
        }
      }

      if (!query) {
        return true;
      }

      const haystack = `${note.title} ${note.content} ${note.source_type}`.toLowerCase();
      return haystack.includes(query);
    });

    const sorted = [...withFilters];
    sorted.sort((left, right) => {
      if (browseSort === "updated_asc") {
        return new Date(left.updated_at).getTime() - new Date(right.updated_at).getTime();
      }
      return new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime();
    });

    return sorted;
  }, [browseFromDate, browseQuery, browseSort, browseSource, browseToDate, notes]);

  const loadWorkspace = async (accessToken: string) => {
    const [loadedNotes, loadedDashboard, loadedGraph, loadedProfile, loadedTemplates] = await Promise.all([
      fetchNotes(accessToken),
      fetchDashboard(accessToken),
      fetchGraph(accessToken),
      fetchProfile(accessToken),
      fetchTemplates(accessToken),
    ]);

    setNotes(loadedNotes);
    setDashboard(loadedDashboard);
    setGraph(loadedGraph);
    setProfile(loadedProfile);
    setTemplates(loadedTemplates);
  };

  useEffect(() => {
    if (!token) {
      setAuthBootstrapping(false);
      setSessionHydrated(false);
      return;
    }

    if (sessionHydrated) {
      setAuthBootstrapping(false);
      return;
    }

    let cancelled = false;

    const validateSessionAndLoad = async () => {
      try {
        await fetchProfile(token);
        await loadWorkspace(token);
        if (!cancelled) {
          setSessionHydrated(true);
          setStatus("Session restored.");
          if (routePath === "/login") {
            navigateTo("/");
          }
        }
      } catch {
        if (!cancelled) {
          window.localStorage.removeItem("noty_access_token");
          window.localStorage.removeItem("noty_refresh_token");
          setToken("");
          setRefreshToken("");
          setProfile(null);
          setStatus("Session expired. Please sign in again.");
          navigateTo("/login");
        }
      } finally {
        if (!cancelled) {
          setAuthBootstrapping(false);
        }
      }
    };

    void validateSessionAndLoad();

    return () => {
      cancelled = true;
    };
  }, [sessionHydrated, token]);

  useEffect(() => {
    if (workspacePage !== "capture") {
      setShowTemplatePicker(false);
      setShowCommandPalette(false);
      setTemplateNameDraft("");
      setBacklinks([]);
      setActiveNoteId(null);
      setEditorDirty(false);
      setIsDraftMode(false);
    }

    if (workspacePage !== "explore") {
      setSearchQuery("");
      setSearchResults([]);
      setSearchAnswer(null);
      setSearchConfidence(null);
      setSearchSources([]);
      setBrowseQuery("");
      setBrowseSource("all");
      setBrowseFromDate("");
      setBrowseToDate("");
      setBrowseSort("updated_desc");
      setBrowseFilterOpen(false);
    }

    if (workspacePage !== "graph") {
      setSelectedNodeId(null);
      setNodeSearch("");
      setFocusNodeId("");
      setActiveCluster(null);
    }
  }, [workspacePage]);

  const activeNote = useMemo(() => {
    if (!activeNoteId) {
      return null;
    }
    return notes.find((note) => note.id === activeNoteId) ?? null;
  }, [activeNoteId, notes]);

  const hydrateEditorFromNote = (note: Note) => {
    setEditorTitle(note.title);
    setEditorIcon(note.icon_emoji || "📝");
    const sanitizedJson = sanitizeEditorJson(note.content_json);
    const hasUsableJson = Array.isArray(sanitizedJson.content) && sanitizedJson.content.length > 0;
    const nextJson = hasUsableJson ? sanitizedJson : plainTextToDoc(note.content);
    setEditorJson(nextJson);
    setEditorText(note.content || jsonToPlainText(nextJson));
    setEditorDirty(false);
    setIsDraftMode(false);
  };

  useEffect(() => {
    if (workspacePage !== "capture") {
      return;
    }

    if (notes.length === 0) {
      setActiveNoteId(null);
      setBacklinks([]);
      return;
    }

    if (activeNoteId && !notes.some((note) => note.id === activeNoteId)) {
      setActiveNoteId(null);
    }
  }, [activeNoteId, isDraftMode, notes, workspacePage]);

  useEffect(() => {
    if (workspacePage !== "capture" || activeNoteId || isDraftMode) {
      return;
    }

    setEditorTitle("Untitled Note");
    setEditorIcon("📝");
    setEditorJson(EMPTY_DOC);
    setEditorText("");
    setEditorDirty(false);
  }, [activeNoteId, isDraftMode, workspacePage]);

  useEffect(() => {
    if (!activeNote) {
      return;
    }

    hydrateEditorFromNote(activeNote);
  }, [activeNote]);

  useEffect(() => {
    if (!pendingTemplateDraft || workspacePage !== "capture") {
      return;
    }

    const timer = window.setTimeout(() => {
      setActiveNoteId(null);
      setEditorTitle(pendingTemplateDraft.title);
      setEditorIcon(pendingTemplateDraft.icon);
      setEditorJson(pendingTemplateDraft.json);
      setEditorText(pendingTemplateDraft.text);
      setEditorDirty(true);
      setShowTemplatePicker(false);
      setPendingTemplateDraft(null);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pendingTemplateDraft, workspacePage]);

  useEffect(() => {
    if (!isAuthenticated || !activeNoteId) {
      setBacklinks([]);
      return;
    }

    let cancelled = false;
    runWithAccessToken((activeToken) => fetchBacklinks(activeToken, activeNoteId))
      .then((result) => {
        if (!cancelled) {
          setBacklinks(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBacklinks([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeNoteId, isAuthenticated]);

  const handleRegister = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await register({
        email: registerForm.email,
        password: registerForm.password,
        display_name: registerForm.displayName,
      });
      setRegisterForm((current) => ({ ...current, password: "" }));
      setStatus("Registration successful. You can sign in now.");
      setAuthMode("login");
    } catch (error) {
      const message = error instanceof Error ? extractApiErrorMessage(error.message) : "Could not register.";
      setStatus(`Registration failed: ${message}`);
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const data = await login({ email: loginForm.email, password: loginForm.password });
      setSessionHydrated(false);
      setAuthBootstrapping(true);
      setToken(data.access);
      setRefreshToken(data.refresh);
      setStatus("Signed in. Restoring your workspace...");
    } catch (error) {
      const message = error instanceof Error ? humanizeLoginError(error.message) : "Could not sign in.";
      setLoginForm((current) => ({ ...current, password: "" }));
      setStatus(`Login failed: ${message}`);
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
    window.localStorage.removeItem("noty_access_token");
    window.localStorage.removeItem("noty_refresh_token");
    setToken("");
    setRefreshToken("");
    setAuthBootstrapping(false);
    setSessionHydrated(false);
    setProfile(null);
    setSearchAnswer(null);
    setSearchResults([]);
    setSearchSources([]);
    setDashboard(null);
    setGraph(null);
    setClusters(null);
    setNotes([]);
    setBacklinks([]);
    setTemplates([]);
    setAuthMode("login");
    setLoginForm({ email: "", password: "" });
    setRegisterForm({ displayName: "", email: "", password: "" });
    setStatus("Signed out.");
    navigateTo("/login");
  };

  const startDraftWithTemplate = (templateId: string | "blank") => {
    if (templateId === "blank") {
      setIsDraftMode(true);
      setPendingTemplateDraft({
        title: "Untitled Note",
        icon: "📝",
        json: sanitizeEditorJson(EMPTY_DOC),
        text: "",
      });
      setShowTemplatePicker(false);
      return;
    }

    const selectedTemplate = templates.find((template) => template.id === templateId);
    if (!selectedTemplate) {
      return;
    }

    const templateJson = sanitizeEditorJson(selectedTemplate.content_json);
    setIsDraftMode(true);
    setPendingTemplateDraft({
      title: selectedTemplate.name,
      icon: selectedTemplate.icon_emoji || "📝",
      json: templateJson,
      text: selectedTemplate.content_text || jsonToPlainText(templateJson),
    });
    setShowTemplatePicker(false);
  };

  const handleSaveActiveNote = async () => {
    if (!isAuthenticated) {
      setStatus("Sign in first to save notes.");
      return;
    }

    const nextTitle = editorTitle.trim() || "Untitled Note";
    const nextText = editorText.trim();

    try {
      if (activeNoteId) {
        setNoteActionPendingId(activeNoteId);
        const updated = await runWithAccessToken((activeToken) =>
          updateNote(activeToken, activeNoteId, {
            title: nextTitle,
            content: nextText,
            content_json: editorJson,
            icon_emoji: editorIcon,
          }),
        );
        setNotes((current) => current.map((note) => (note.id === activeNoteId ? updated : note)));
        setStatus("Note updated.");
      } else {
        const created = await runWithAccessToken((activeToken) =>
          createNote(activeToken, {
            title: nextTitle,
            content: nextText,
            content_json: editorJson,
            icon_emoji: editorIcon,
          }),
        );
        setNotes((current) => [created, ...current]);
        setActiveNoteId(created.id);
        setIsDraftMode(false);
        setStatus("Note created.");
      }

      setEditorDirty(false);
      setClusters(null);
      await refreshInsightsAfterMutation();
    } catch (error) {
      setStatus(`Could not save note: ${(error as Error).message}`);
    } finally {
      setNoteActionPendingId(null);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || !activeNoteId || !editorDirty) {
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const updated = await runWithAccessToken((activeToken) =>
          updateNote(activeToken, activeNoteId, {
            title: editorTitle.trim() || "Untitled Note",
            content: editorText.trim(),
            content_json: editorJson,
            icon_emoji: editorIcon,
          }),
        );
        setNotes((current) => current.map((note) => (note.id === activeNoteId ? updated : note)));
        setEditorDirty(false);
      } catch {
        // Keep silent for autosave errors and let manual save provide explicit status.
      }
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [activeNoteId, editorDirty, editorIcon, editorJson, editorText, editorTitle, isAuthenticated]);

  const handleRenameNote = async (noteId: string) => {
    const current = notes.find((item) => item.id === noteId);
    if (!current) {
      return;
    }
    const nextTitle = window.prompt("Rename note", current.title)?.trim();
    if (!nextTitle) {
      return;
    }
    try {
      const updated = await runWithAccessToken((activeToken) => updateNote(activeToken, noteId, { title: nextTitle }));
      setNotes((prev) => prev.map((note) => (note.id === noteId ? updated : note)));
    } catch (error) {
      setStatus(`Rename failed: ${(error as Error).message}`);
    }
  };

  const handleDuplicateNote = async (noteId: string) => {
    const source = notes.find((note) => note.id === noteId);
    if (!source) {
      return;
    }

    try {
      const created = await runWithAccessToken((activeToken) =>
        createNote(activeToken, {
          title: `${source.title} Copy`,
          content: source.content,
          content_json: sanitizeEditorJson(source.content_json),
          icon_emoji: source.icon_emoji,
        }),
      );
      setNotes((current) => [created, ...current]);
      setActiveNoteId(created.id);
      setStatus("Note duplicated.");
    } catch (error) {
      setStatus(`Duplicate failed: ${(error as Error).message}`);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const note = notes.find((item) => item.id === noteId);
    if (!note) {
      return;
    }
    const shouldDelete = window.confirm(`Delete note \"${note.title}\"?`);
    if (!shouldDelete) {
      return;
    }

    try {
      setNoteActionPendingId(noteId);
      await runWithAccessToken((activeToken) => deleteNote(activeToken, noteId));
      setNotes((current) => current.filter((item) => item.id !== noteId));
      if (activeNoteId === noteId) {
        setActiveNoteId(null);
      }
      setStatus("Note deleted.");
      await refreshInsightsAfterMutation();
    } catch (error) {
      setStatus(`Could not delete note: ${(error as Error).message}`);
    } finally {
      setNoteActionPendingId(null);
    }
  };

  const handleUpdateEmoji = async (noteId: string, emoji: string) => {
    try {
      const updated = await runWithAccessToken((activeToken) => updateNote(activeToken, noteId, { icon_emoji: emoji }));
      setNotes((current) => current.map((note) => (note.id === noteId ? updated : note)));
      if (activeNoteId === noteId) {
        setEditorIcon(updated.icon_emoji || emoji);
      }
    } catch (error) {
      setStatus(`Emoji update failed: ${(error as Error).message}`);
    }
  };

  const handleInsertBacklink = async (targetNoteId: string) => {
    if (!activeNoteId || targetNoteId === activeNoteId) {
      return;
    }
    try {
      await runWithAccessToken((activeToken) =>
        addManualLink(activeToken, activeNoteId, {
          target_note: targetNoteId,
          relationship_type: "references",
        }),
      );
      await refreshInsightsAfterMutation();
      const refreshedBacklinks = await runWithAccessToken((activeToken) => fetchBacklinks(activeToken, activeNoteId));
      setBacklinks(refreshedBacklinks);
      setStatus("Backlink connected.");
    } catch (error) {
      setStatus(`Backlink failed: ${(error as Error).message}`);
    }
  };

  const handleSaveTemplate = async () => {
    const name = templateNameDraft.trim();
    if (!name) {
      setStatus("Template name is required.");
      return;
    }
    try {
      const created = await runWithAccessToken((activeToken) =>
        createTemplate(activeToken, {
          name,
          icon_emoji: editorIcon || "📝",
          content_json: editorJson,
          content_text: editorText,
        }),
      );
      setTemplates((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
      setTemplateNameDraft("");
      setStatus("Template saved.");
    } catch (error) {
      setStatus(`Template save failed: ${(error as Error).message}`);
    }
  };

  const openNoteForEditing = async (noteId: string) => {
    setIsDraftMode(false);

    const existingNote = notes.find((note) => note.id === noteId);
    if (existingNote) {
      setActiveNoteId(existingNote.id);
      hydrateEditorFromNote(existingNote);
      navigateTo("/capture");
      return;
    }

    setActiveNoteId(noteId);
    navigateTo("/capture");

    if (!isAuthenticated) {
      return;
    }

    try {
      const loadedNotes = await runWithAccessToken((activeToken) => fetchNotes(activeToken));
      setNotes(loadedNotes);
      const loadedNote = loadedNotes.find((note) => note.id === noteId);
      if (!loadedNote) {
        setStatus("Selected note was not found in your workspace.");
        return;
      }
      setActiveNoteId(loadedNote.id);
      hydrateEditorFromNote(loadedNote);
    } catch (error) {
      setStatus(`Could not open note: ${(error as Error).message}`);
    }
  };

  const openImportedNoteInEditor = (imported: Note) => {
    setNotes((current) => [imported, ...current.filter((note) => note.id !== imported.id)]);
    setActiveNoteId(imported.id);
    hydrateEditorFromNote(imported);
    navigateTo("/capture");
  };

  const handleImportFromUrl = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthenticated) {
      setStatus("Sign in first to import from URL.");
      return;
    }

    const nextUrl = urlImportValue.trim();
    if (!nextUrl) {
      setStatus("Enter a URL to import.");
      return;
    }

    try {
      setCaptureImportPending("url");
      const imported = await runWithAccessToken((activeToken) =>
        ingestUrl(activeToken, {
          url: nextUrl,
          title: urlImportTitle.trim() || undefined,
        }),
      );
      openImportedNoteInEditor(imported);
      setUrlImportValue("");
      setUrlImportTitle("");
      setStatus(`URL imported: ${imported.title}`);
      await refreshInsightsAfterMutation();
    } catch (error) {
      setStatus(`URL import failed: ${(error as Error).message}`);
    } finally {
      setCaptureImportPending(null);
    }
  };

  const handleImportFromText = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthenticated) {
      setStatus("Sign in first to import text.");
      return;
    }

    const nextText = textImportValue.trim();
    if (!nextText) {
      setStatus("Paste text to import.");
      return;
    }

    try {
      setCaptureImportPending("text");
      const imported = await runWithAccessToken((activeToken) =>
        ingestText(activeToken, {
          content: nextText,
          title: textImportTitle.trim() || undefined,
        }),
      );
      openImportedNoteInEditor(imported);
      setTextImportValue("");
      setTextImportTitle("");
      setStatus(`Text imported: ${imported.title}`);
      await refreshInsightsAfterMutation();
    } catch (error) {
      setStatus(`Text import failed: ${(error as Error).message}`);
    } finally {
      setCaptureImportPending(null);
    }
  };

  const handleImportFromPdf = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isAuthenticated) {
      setStatus("Sign in first to upload PDF files.");
      return;
    }

    if (!pdfImportFile) {
      setStatus("Choose a PDF file to upload.");
      return;
    }

    try {
      setCaptureImportPending("pdf");
      const imported = await runWithAccessToken((activeToken) =>
        ingestPdf(activeToken, pdfImportFile, pdfImportTitle.trim() || undefined),
      );
      openImportedNoteInEditor(imported);
      setPdfImportTitle("");
      setPdfImportFile(null);
      if (pdfInputRef.current) {
        pdfInputRef.current.value = "";
      }
      setStatus(`PDF imported: ${imported.title}`);
      await refreshInsightsAfterMutation();
    } catch (error) {
      setStatus(`PDF import failed: ${(error as Error).message}`);
    } finally {
      setCaptureImportPending(null);
    }
  };

  const handleCommandAction = (actionId: string) => {
    if (actionId.startsWith("template:")) {
      const templateId = actionId.replace("template:", "");
      startDraftWithTemplate(templateId);
      navigateTo("/capture");
      return;
    }

    if (actionId === "new-note") {
      setShowTemplatePicker(true);
      navigateTo("/capture");
      return;
    }
    if (actionId === "go-graph") {
      navigateTo("/graph");
      return;
    }
    if (actionId === "go-explore") {
      navigateTo("/explore");
      return;
    }
    if (actionId === "import-url") {
      navigateTo("/capture");
      setStatus("Capture now supports URL scraping, text import, and PDF upload.");
      return;
    }
    if (actionId === "ask-ai") {
      navigateTo("/explore");
      setStatus("Use Semantic Search to ask the model over your notes.");
    }
  };

  useEffect(() => {
    const onKeyboard = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setShowCommandPalette((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyboard);
    return () => window.removeEventListener("keydown", onKeyboard);
  }, []);

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

  const handleGraph3DRuntimeError = (error: Error) => {
    const reason = error.message?.trim() || "WebGL context could not be created for 3D graph.";
    setGraph3DError(reason);
    setStatus("3D view failed to initialize. Click 3D View to retry or switch to 2D.");
  };

  const ForceGraph3DComponent = forceGraph3D;
  const ForceGraph2DComponent = forceGraph2D;
  const has3DRenderer = Boolean(ForceGraph3DComponent);
  const has2DRenderer = Boolean(ForceGraph2DComponent);
  const effectiveGraphMode: GraphRenderMode = graphMode;

  const resetSemanticOutput = () => {
    setSearchResults([]);
    setSearchAnswer(null);
    setSearchConfidence(null);
    setSearchSources([]);
  };

  useEffect(() => {
    if (graphViewport.width === 0 || graphViewport.height === 0 || graphSceneData.nodes.length === 0) {
      return;
    }

    const alignGraphView = () => {
      const graphApi = graphRef.current;
      if (!graphApi) {
        return;
      }

      graphApi.d3ReheatSimulation?.();
      graphApi.zoomToFit?.(800, 80);

      if (effectiveGraphMode === "3d") {
        graphApi.cameraPosition?.(
          { x: 0, y: 0, z: 300 },
          { x: 0, y: 0, z: 0 },
          800,
        );
      } else {
        graphApi.centerAt?.(0, 0, 800);
        graphApi.zoom?.(1.08, 800);
      }
    };

    const firstTimer = window.setTimeout(alignGraphView, 300);
    const secondTimer = window.setTimeout(alignGraphView, 950);

    return () => {
      window.clearTimeout(firstTimer);
      window.clearTimeout(secondTimer);
    };
  }, [effectiveGraphMode, graphSceneData, graphViewport]);

  useEffect(() => {
    if (graphViewport.width === 0 || graphViewport.height === 0) {
      return;
    }

    const renderer = graphRef.current?.renderer?.();
    renderer?.setPixelRatio?.(window.devicePixelRatio || 1);
  }, [effectiveGraphMode, graphViewport.height, graphViewport.width]);

  const handleToggleGraphMode = (mode: GraphRenderMode) => {
    if (mode === "3d") {
      const webglWarning = !isWebGLSupported ? webglSupport.reason : null;

      if (!has3DRenderer && isLoading3DRenderer) {
        setStatus("3D renderer is still loading. Please wait a moment.");
        return;
      }

      if (!has3DRenderer) {
        setStatus("Loading 3D renderer...");
        setIsLoading3DRenderer(true);
        void import("react-force-graph-3d")
          .then(({ default: ForceGraph3DModule }) => {
            setForceGraph3D(() => ForceGraph3DModule as GraphRenderer);
            setGraph3DError(null);
            setGraphMode("3d");
            setStatus("Graph mode set to 3D.");
          })
          .catch((error) => {
            const reason = error instanceof Error ? error.message : "unknown 3D error";
            setGraph3DError(`3D renderer failed to load: ${reason}`);
            setStatus("Could not load 3D renderer on this session. Try refreshing once.");
          })
          .finally(() => {
            setIsLoading3DRenderer(false);
          });
        return;
      }

      const isRetrying = Boolean(graph3DError);
      if (isRetrying) {
        setGraph3DError(null);
        setGraph3DRetryNonce((current) => current + 1);
      }

      setGraphMode("3d");
      if (webglWarning) {
        setStatus(`Trying 3D view. ${webglWarning}`);
      } else {
        setStatus(isRetrying ? "Retrying 3D view..." : "Graph mode set to 3D.");
      }
      return;
    }

    if (mode === "2d" && !has2DRenderer) {
      setStatus("2D renderer is still loading. Please wait a moment.");
      return;
    }

    setGraphMode(mode);
    setGraph3DError(null);
    setStatus("Graph mode set to 2D.");
  };

  const handleCenterGraph = () => {
    const graphApi = graphRef.current;
    if (!graphApi) {
      return;
    }

    graphApi.d3ReheatSimulation?.();
    graphApi.zoomToFit?.(800, 80);
    if (effectiveGraphMode === "3d") {
      graphApi.cameraPosition?.(
        { x: 0, y: 0, z: 300 },
        { x: 0, y: 0, z: 0 },
        800,
      );
    } else {
      graphApi.centerAt?.(0, 0, 700);
      graphApi.zoom?.(1.12, 700);
    }
    setStatus("Graph recentered in view.");
  };

  const inViewViewport = { once: true, amount: 0.2 } as const;
  const inViewTransition = { duration: 0.5, ease: "easeOut" } as const;

  const captureInputCards = [
    {
      icon: "🧱",
      title: "Block Editor",
      body: "Write structured notes with slash commands, headers, bullets, toggles and code blocks.",
    },
    {
      icon: "📚",
      title: "Templates",
      body: "Start from pre-built templates for meetings, research, daily logs and more.",
    },
    {
      icon: "⚡",
      title: "Quick Capture",
      body: "Dump raw thoughts instantly. Organize later.",
    },
  ];

  const graphHowItWorks = [
    {
      step: "1",
      title: "Capture notes",
      body: "Every note you write becomes a node in your graph.",
    },
    {
      step: "2",
      title: "AI finds links",
      body: "Semantic relationships between notes are detected automatically.",
    },
    {
      step: "3",
      title: "Explore spatially",
      body: "Navigate your knowledge visually to find unexpected connections.",
    },
  ];

  const homeFeatureChips = [
    { icon: BrainIcon, label: "AI-Powered Retrieval" },
    { icon: NetworkIcon, label: "Knowledge Graph" },
    { icon: ZapIcon, label: "Instant Capture" },
  ];

  if (authBootstrapping) {
    return (
      <div className="shell login-shell loading-shell">
        <div className="card loading-card">
          <h2>Restoring session...</h2>
          <p className="muted">Verifying your account and loading workspace data.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        className="shell login-shell"
        style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}
      >
        <canvas
          ref={signInWaveCanvasRef}
          className="absolute inset-0 w-full h-full z-0 pointer-events-none"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0, pointerEvents: "none" }}
          aria-hidden="true"
        />
        <div className="signin-surface-overlay z-[5]" aria-hidden="true" />

        <section className="login-stage relative z-10">
          <article className="login-intro">
            <p className="eyebrow">AI-Powered Second Brain</p>
            <h1>Noty Brain</h1>
            <p className="subtitle">
              Capture ideas, ask grounded AI questions, and explore your knowledge graph in one premium workspace.
            </p>
          </article>

          <article className="card auth-panel login-panel">
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
                <label className="floating-field">
                  <input
                    placeholder=" "
                    value={registerForm.displayName}
                    onChange={(event) =>
                      setRegisterForm((current) => ({
                        ...current,
                        displayName: event.target.value,
                      }))
                    }
                  />
                  <span>Display name</span>
                </label>
                <label className="floating-field">
                  <input
                    type="email"
                    placeholder=" "
                    value={registerForm.email}
                    onChange={(event) =>
                      setRegisterForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                  />
                  <span>Email</span>
                </label>
                <label className="floating-field">
                  <input
                    type="password"
                    placeholder=" "
                    value={registerForm.password}
                    onChange={(event) =>
                      setRegisterForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    required
                  />
                  <span>Password</span>
                </label>
                <button type="submit">Create Account</button>
                <p className="auth-switch-line">
                  Already have an account?{" "}
                  <button type="button" className="text-link" onClick={() => setAuthMode("login")}>
                    Sign in instead
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleLogin}>
                <label className="floating-field">
                  <input
                    type="email"
                    placeholder=" "
                    value={loginForm.email}
                    onChange={(event) =>
                      setLoginForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                  />
                  <span>Email</span>
                </label>
                <label className="floating-field">
                  <input
                    type="password"
                    placeholder=" "
                    value={loginForm.password}
                    onChange={(event) =>
                      setLoginForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }))
                    }
                    required
                  />
                  <span>Password</span>
                </label>
                <button type="submit">Sign In</button>
                <p className="auth-switch-line">
                  New here?{" "}
                  <button type="button" className="text-link" onClick={() => setAuthMode("register")}>
                    Create account
                  </button>
                </p>
              </form>
            )}
          </article>

          <div className="status" role="status" aria-live="polite">
            Status: {status}
          </div>
        </section>
      </div>
    );
  }

  /* ──────────────────── HOME PAGE ──────────────────── */
  if (workspacePage === "home") {
    const recentNotes = notes.slice(0, 6);

    return (
      <div className="shell workspace-shell single-page-scroll">
        <AnimatedNavFramer onNavigate={navigateTo} currentPage={workspacePage} />

        {/* ═══ SECTION 1 — HERO ═══ */}
        <section className="hero-v2 relative overflow-hidden">
          <NoteParticleCanvas />
          <div className="hero-v2-overlay" aria-hidden="true" />

          <div className="hero-v2-foreground">
            <motion.div
              className="hero-v2-content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            >
              <motion.div
                className="ping-badge-wrap"
                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.12, duration: 0.38, ease: "easeOut" }}
              >
                <span className="ping-badge-dot-shell" aria-hidden="true">
                  <motion.span
                    className="ping-badge-dot-pulse"
                    animate={{ scale: [1, 2.05], opacity: [0.55, 0] }}
                    transition={{ duration: 1.7, repeat: Infinity, ease: "easeOut" }}
                  />
                  <span className="ping-badge-dot-core" />
                </span>
                <span className="ping-badge-text">Now with AI Graph Lab</span>
              </motion.div>

              <motion.h1
                className="hero-v2-headline"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.18, duration: 0.52, ease: "easeOut" }}
              >
                Your AI-Powered Second Brain
              </motion.h1>

              <motion.p
                className="hero-v2-sub"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24, duration: 0.52, ease: "easeOut" }}
              >
                Capture ideas, retrieve context-aware answers, and inspect your
                knowledge graph — with high signal and low friction.
              </motion.p>

              <motion.div
                className="hero-v2-ctas"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.45, ease: "easeOut" }}
              >
                <button type="button" onClick={() => navigateTo("/capture")}>
                  Start Capturing
                </button>
                <button
                  type="button"
                  className="button-neutral"
                  onClick={() => navigateTo("/explore")}
                >
                  Explore Your Notes
                </button>
              </motion.div>
            </motion.div>
          </div>
        </section>

        <section className="home-feature-chip-row">
          <div className="home-feature-chip-row-inner">
            {homeFeatureChips.map((chip, index) => {
              const Icon = chip.icon;
              return (
                <motion.article
                  key={chip.label}
                  className="home-feature-chip"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, ease: "easeOut", delay: index * 0.1 }}
                >
                  <Icon className="home-feature-chip-icon" />
                  <span>{chip.label}</span>
                </motion.article>
              );
            })}
          </div>
        </section>

        {/* ═══ SECTION 2 — CAPTURE ═══ */}
        <FeatureSection
          label="Capture"
          heading="Think freely. Structure later."
          body="Noty Brain's block editor lets you capture thoughts, meeting notes, and ideas with slash commands, templates, and rich formatting — all saved instantly."
          cta="Open Capture →"
          ctaHref="/capture"
          onNavigate={navigateTo}
        >
          <TiltCard className="tilt-card-shell">
            <MockCaptureUI />
          </TiltCard>
        </FeatureSection>

        {/* ═══ SECTION 3 — EXPLORE ═══ */}
        <FeatureSection
          label="Explore"
          heading="Ask your notes anything."
          body="Semantic search powered by AI retrieves the most relevant context from your knowledge base. Ask questions in plain language and get precise, sourced answers."
          cta="Open Explore →"
          ctaHref="/explore"
          reverse
          onNavigate={navigateTo}
        >
          <TiltCard className="tilt-card-shell">
            <MockExploreUI />
          </TiltCard>
        </FeatureSection>

        {/* ═══ SECTION 4 — GRAPH LAB ═══ */}
        <FeatureSection
          label="Graph Lab"
          heading="See how your ideas connect."
          body="The knowledge graph visualizes relationships between your notes automatically. Switch between 2D and 3D views to explore clusters, find gaps, and think spatially about your knowledge."
          cta="Open Graph Lab →"
          ctaHref="/graph"
          onNavigate={navigateTo}
        >
          <TiltCard className="tilt-card-shell">
            <MockGraphUI />
          </TiltCard>
        </FeatureSection>

        {/* ═══ SECTION 5 — WELCOME BACK STRIP ═══ */}
        <section className="welcome-strip">
          <div className="welcome-strip-inner">
            <h2 className="welcome-strip-heading">
              Welcome back to Noty Brain
            </h2>
            <p className="welcome-strip-sub">
              {profile?.display_name
                ? `Good to see you, ${profile.display_name}.`
                : "Jump right back into your workspace."}{" "}
              You have <strong>{notes.length}</strong> notes and{" "}
              <strong>{graph?.edges.length ?? 0}</strong> connections.
            </p>

            <div className="welcome-strip-actions">
              <button type="button" className="button-neutral" onClick={handleRefreshWorkspace}>
                Refresh State
              </button>
              <button type="button" className="button-danger" onClick={handleSignOut}>
                Sign Out
              </button>
            </div>

            {recentNotes.length > 0 && (
              <div className="welcome-recent-grid">
                {recentNotes.map((note) => (
                  <TiltCard key={note.id} className="welcome-note-card-tilt">
                    <button
                      type="button"
                      className="welcome-note-card"
                      onClick={() => {
                        void openNoteForEditing(note.id);
                      }}
                    >
                      <span className="welcome-note-emoji">
                        {note.icon_emoji || "📝"}
                      </span>
                      <strong className="welcome-note-title">
                        {note.title}
                      </strong>
                      <small className="welcome-note-date">
                        {new Date(note.updated_at).toLocaleDateString()}
                      </small>
                    </button>
                  </TiltCard>
                ))}
              </div>
            )}
          </div>
        </section>

        <TemplatePickerModal
          open={showTemplatePicker}
          templates={templates}
          onClose={() => setShowTemplatePicker(false)}
          onSelectTemplate={startDraftWithTemplate}
        />

        <CommandPalette
          open={showCommandPalette}
          notes={notes}
          templates={templates}
          onClose={() => setShowCommandPalette(false)}
          onOpenNote={(noteId) => {
            void openNoteForEditing(noteId);
          }}
          onAction={handleCommandAction}
        />

        <footer className="status">Status: {status}</footer>
      </div>
    );
  }

  /* ──────────────────── WORKSPACE PAGES (Capture / Explore / Graph) ──────────────────── */
  return (
    <div className="shell workspace-shell workspace-page-shell">
      <AnimatedNavFramer onNavigate={navigateTo} currentPage={workspacePage} />

      <div className="workspace-page-body">
        {/* ── CAPTURE PAGE ── */}
        {workspacePage === "capture" && (
          <div className="workspace-flow-page capture-flow-page">
            <motion.section
              className="workspace-flow-section flow-hero-section"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewViewport}
              transition={inViewTransition}
            >
              <div className="flow-inner flow-hero-inner">
                <h1 className="flow-heading">Capture Your Thoughts</h1>
                <p className="flow-subheading">
                  Your block editor. Slash commands, templates, and rich formatting — all saved instantly to your
                  second brain.
                </p>
                <div className="flow-heading-underline-shell">
                  <motion.div layoutId="flow-heading-underline" className="flow-heading-underline" />
                </div>
              </div>
            </motion.section>

            <motion.section
              className="workspace-flow-section"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewViewport}
              transition={inViewTransition}
            >
              <div className="flow-inner capture-import-inner">
                <p className="flow-section-label">Import Sources</p>
                <h2>Bring in notes from URL, text, and PDF.</h2>
                <p className="muted">
                  Scrape web pages, paste raw text, or upload PDF files and continue editing immediately in the block
                  editor.
                </p>

                <div className="capture-ingest-grid">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={inViewViewport}
                    transition={inViewTransition}
                  >
                    <TiltCard className="ingest-card ingest-url-card">
                      <article className="ingest-card-inner">
                        <h3>Web Scrape URL</h3>
                        <p className="muted">Extract article/page content into an editable note.</p>
                        <form className="ingest-form" onSubmit={handleImportFromUrl}>
                          <input
                            type="url"
                            placeholder="https://example.com/article"
                            value={urlImportValue}
                            onChange={(event) => setUrlImportValue(event.target.value)}
                            required
                          />
                          <input
                            placeholder="Optional note title"
                            value={urlImportTitle}
                            onChange={(event) => setUrlImportTitle(event.target.value)}
                          />
                          <button type="submit" disabled={!isAuthenticated || captureImportPending !== null}>
                            {captureImportPending === "url" ? "Importing..." : "Import URL"}
                          </button>
                        </form>
                      </article>
                    </TiltCard>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={inViewViewport}
                    transition={{ ...inViewTransition, delay: 0.08 }}
                  >
                    <TiltCard className="ingest-card ingest-text-card">
                      <article className="ingest-card-inner">
                        <h3>Paste Raw Text</h3>
                        <p className="muted">Turn copied content into a structured note instantly.</p>
                        <form className="ingest-form" onSubmit={handleImportFromText}>
                          <input
                            placeholder="Optional note title"
                            value={textImportTitle}
                            onChange={(event) => setTextImportTitle(event.target.value)}
                          />
                          <textarea
                            placeholder="Paste text content to import"
                            value={textImportValue}
                            onChange={(event) => setTextImportValue(event.target.value)}
                            rows={6}
                            required
                          />
                          <button type="submit" disabled={!isAuthenticated || captureImportPending !== null}>
                            {captureImportPending === "text" ? "Importing..." : "Import Text"}
                          </button>
                        </form>
                      </article>
                    </TiltCard>
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={inViewViewport}
                    transition={{ ...inViewTransition, delay: 0.16 }}
                  >
                    <TiltCard className="ingest-card ingest-pdf-card">
                      <article className="ingest-card-inner">
                        <h3>Upload PDF</h3>
                        <p className="muted">Import document content from PDF files.</p>
                        <form className="ingest-form" onSubmit={handleImportFromPdf}>
                          <input
                            placeholder="Optional note title"
                            value={pdfImportTitle}
                            onChange={(event) => setPdfImportTitle(event.target.value)}
                          />

                          <label className="ingest-file-picker">
                            <span>{pdfImportFile ? pdfImportFile.name : "Choose PDF file"}</span>
                            <input
                              ref={pdfInputRef}
                              type="file"
                              accept=".pdf,application/pdf"
                              onChange={(event) => setPdfImportFile(event.target.files?.[0] ?? null)}
                              required
                            />
                          </label>

                          <button type="submit" disabled={!isAuthenticated || captureImportPending !== null}>
                            {captureImportPending === "pdf" ? "Uploading..." : "Upload PDF"}
                          </button>
                        </form>
                      </article>
                    </TiltCard>
                  </motion.div>
                </div>
              </div>
            </motion.section>

            <motion.section
              className="workspace-flow-section"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewViewport}
              transition={inViewTransition}
            >
              <div className="flow-inner">
                <div className="capture-method-grid">
                  {captureInputCards.map((card, index) => (
                    <motion.div
                      key={card.title}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={inViewViewport}
                      transition={{ ...inViewTransition, delay: index * 0.08 }}
                    >
                      <TiltCard className="capture-method-card">
                        <article>
                          <span className="capture-method-icon" aria-hidden="true">{card.icon}</span>
                          <h3>{card.title}</h3>
                          <p>{card.body}</p>
                        </article>
                      </TiltCard>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.section>

            <motion.section
              className="workspace-flow-section"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewViewport}
              transition={inViewTransition}
            >
              <div className="flow-inner">
                <article className="capture-editor-focus card">
                  <div className="row between capture-editor-header-row">
                    <h2>The Block Editor</h2>
                    <div className="row capture-editor-action-row">
                      <button type="button" className="button-neutral" onClick={() => startDraftWithTemplate("blank")}>
                        New Draft
                      </button>
                      <button type="button" className="button-neutral" onClick={() => setShowTemplatePicker(true)}>
                        Templates
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveActiveNote}
                        disabled={Boolean(noteActionPendingId && activeNoteId === noteActionPendingId)}
                      >
                        Save Note
                      </button>
                    </div>
                  </div>

                  {activeNote && (
                    <div className="row capture-editor-note-actions">
                      <button type="button" className="button-neutral" onClick={() => handleRenameNote(activeNote.id)}>
                        Rename
                      </button>
                      <button type="button" className="button-neutral" onClick={() => handleDuplicateNote(activeNote.id)}>
                        Duplicate
                      </button>
                      <button type="button" className="button-danger" onClick={() => handleDeleteNote(activeNote.id)}>
                        Delete
                      </button>
                    </div>
                  )}

                  <div className="row capture-editor-title-row">
                    <input
                      className="note-emoji-input"
                      value={editorIcon}
                      onChange={(event) => setEditorIcon(event.target.value || "📝")}
                      onBlur={() => {
                        if (activeNoteId) {
                          void handleUpdateEmoji(activeNoteId, editorIcon || "📝");
                        }
                      }}
                      maxLength={4}
                    />
                    <input
                      placeholder="Note title"
                      value={editorTitle}
                      onChange={(event) => {
                        setEditorTitle(event.target.value);
                        setEditorDirty(true);
                      }}
                    />
                  </div>

                  <div className="capture-editor-stage">
                    <BlockEditor
                      key={activeNote?.id ?? "new"}
                      initialContent={editorJson}
                      availableNotes={notes}
                      onUpdate={({ json, text }) => {
                        setEditorJson(json);
                        setEditorText(text);
                        setEditorDirty(true);
                      }}
                      onBacklinkSelect={handleInsertBacklink}
                    />
                  </div>

                  <div className="row template-save-row">
                    <input
                      placeholder="Save current note as template"
                      value={templateNameDraft}
                      onChange={(event) => setTemplateNameDraft(event.target.value)}
                    />
                    <button type="button" className="button-neutral" onClick={handleSaveTemplate}>
                      Save Template
                    </button>
                  </div>

                  <div className="capture-backlinks-panel">
                    <p className="capture-backlinks-label">Backlinks</p>
                    {backlinks.length === 0 ? (
                      <p className="muted">No backlinks connected to this note yet.</p>
                    ) : (
                      <div className="capture-backlinks-list">
                        {backlinks.slice(0, 8).map((item) => (
                          <span key={item.link_id} className="capture-backlink-chip">
                            {item.icon_emoji || "📝"} {item.title}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </article>
              </div>
            </motion.section>

            <motion.section
              className="workspace-flow-strip"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewViewport}
              transition={inViewTransition}
            >
              <div className="flow-inner flow-strip-inner">
                <h2>Every great idea starts as a note.</h2>
                <p>Noty Brain stores, connects, and resurfaces your knowledge when you need it most.</p>
              </div>
            </motion.section>
          </div>
        )}

        {/* ── EXPLORE PAGE ── */}
        {workspacePage === "explore" && (
          <div className="workspace-flow-page explore-flow-page">
            <motion.section
              className="workspace-flow-section flow-hero-section"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewViewport}
              transition={inViewTransition}
            >
              <div className="flow-inner flow-hero-inner">
                <h1 className="flow-heading">Explore Your Knowledge</h1>
                <p className="flow-subheading">
                  Search semantically, ask your notes questions, and browse your entire knowledge base — all in one
                  place.
                </p>
                <div className="explore-typewriter-shell" aria-hidden="true">
                  <span className="explore-typewriter-icon">⌕</span>
                  <motion.span
                    className="explore-typewriter-text"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={inViewViewport}
                    transition={inViewTransition}
                  >
                    <motion.span
                      className="explore-typewriter-line"
                      initial={{ width: 0 }}
                      whileInView={{ width: "100%" }}
                      viewport={inViewViewport}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                    >
                      Search "meeting notes about Q2 roadmap"
                    </motion.span>
                  </motion.span>
                </div>
              </div>
            </motion.section>

            <motion.section
              className="workspace-flow-section"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewViewport}
              transition={inViewTransition}
            >
              <div className="flow-inner explore-semantic-inner">
                <p className="flow-section-label">AI-Powered Retrieval</p>
                <h2>Ask your notes anything.</h2>
                <p className="muted">
                  Noty Brain uses semantic search to find the most relevant context in your knowledge base and generate
                  a grounded answer.
                </p>

                <form onSubmit={handleSearch} className="semantic-search-form">
                  <div className="semantic-search-input-row">
                    <input
                      placeholder="Ask in natural language"
                      value={searchQuery}
                      onChange={(event) => {
                        setSearchQuery(event.target.value);
                        resetSemanticOutput();
                      }}
                      required
                    />
                    <button type="submit" disabled={!isAuthenticated}>
                      Generate
                    </button>
                  </div>

                  <div className="answer-length-toggle" role="group" aria-label="Answer length">
                    <button
                      type="button"
                      className={searchResponseLength === "short" ? "active" : ""}
                      onClick={() => {
                        if (searchResponseLength !== "short") {
                          setSearchResponseLength("short");
                          resetSemanticOutput();
                        }
                      }}
                    >
                      Short
                    </button>
                    <button
                      type="button"
                      className={searchResponseLength === "medium" ? "active" : ""}
                      onClick={() => {
                        if (searchResponseLength !== "medium") {
                          setSearchResponseLength("medium");
                          resetSemanticOutput();
                        }
                      }}
                    >
                      Medium
                    </button>
                    <button
                      type="button"
                      className={searchResponseLength === "long" ? "active" : ""}
                      onClick={() => {
                        if (searchResponseLength !== "long") {
                          setSearchResponseLength("long");
                          resetSemanticOutput();
                        }
                      }}
                    >
                      Long
                    </button>
                  </div>
                </form>

                {searchSources.length > 0 && (
                  <div className="sources-used-row">
                    <span className="sources-used-label">Sources used:</span>
                    <div className="sources-chip-wrap">
                      {searchSources.map((source) => (
                        <span key={source.id} className="source-chip">{source.title}</span>
                      ))}
                    </div>
                  </div>
                )}

                {searchAnswer && (
                  <motion.div
                    className="answer-box"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={inViewViewport}
                    transition={inViewTransition}
                  >
                    <p>{searchAnswer}</p>
                    <small>confidence: {searchConfidence ?? 0}</small>
                  </motion.div>
                )}

                <div className="semantic-result-list">
                  {searchResults.length === 0 && <p className="muted">No semantic matches yet.</p>}
                  {searchResults.map((result, index) => (
                    <motion.article
                      key={result.note_id}
                      className="semantic-result-card"
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={inViewViewport}
                      transition={{ ...inViewTransition, delay: index * 0.08 }}
                    >
                      <h3>{result.title}</h3>
                      <p>{result.excerpt}</p>
                      <small>score: {result.similarity_score}</small>
                      <button
                        type="button"
                        className="button-neutral"
                        onClick={() => {
                          void openNoteForEditing(result.note_id);
                        }}
                      >
                        Open Note
                      </button>
                    </motion.article>
                  ))}
                </div>
              </div>
            </motion.section>

            <motion.section
              className="workspace-flow-section flow-divider-section"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut" }}
            >
              <div className="flow-inner">
                <div className="flow-divider-line"><span>or browse manually</span></div>
              </div>
            </motion.section>

            <motion.section
              className="workspace-flow-section"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: "easeOut", delay: 0.05 }}
            >
              <div className="flow-inner explore-browse-inner">
                <p className="flow-section-label">Browse Notes</p>
                <h2>Your entire knowledge base.</h2>
                <p className="muted">Filter, sort, and search through all your captured notes.</p>

                <div className="browse-filter-bar">
                  <input
                    className="browse-filter-search"
                    placeholder="Search title/content/source"
                    value={browseQuery}
                    onChange={(event) => setBrowseQuery(event.target.value)}
                  />

                  <Popover open={browseFilterOpen} onOpenChange={setBrowseFilterOpen}>
                    <PopoverTrigger asChild>
                      <button type="button" className="button-neutral filter-sort-trigger">Filter</button>
                    </PopoverTrigger>
                    <PopoverContent className="browse-filter-popover" align="end">
                      <div className="browse-filter-panel-section">
                        <label>
                          <span>Source</span>
                          <select value={browseSource} onChange={(event) => setBrowseSource(event.target.value as BrowseSource)}>
                            <option value="all">All Sources</option>
                            <option value="notes">Notes</option>
                            <option value="imports">Imports</option>
                          </select>
                        </label>
                      </div>

                      <div className="browse-filter-panel-section">
                        <p className="browse-filter-label">Date Range</p>
                        <div className="browse-date-row">
                          <label>
                            <span>From</span>
                            <input type="date" value={browseFromDate} onChange={(event) => setBrowseFromDate(event.target.value)} />
                          </label>
                          <label>
                            <span>To</span>
                            <input type="date" value={browseToDate} onChange={(event) => setBrowseToDate(event.target.value)} />
                          </label>
                        </div>
                      </div>

                      <div className="browse-filter-panel-section">
                        <p className="browse-filter-label">Sort</p>
                        <div className="browse-sort-toggle" role="group" aria-label="Sort order">
                          <button
                            type="button"
                            className={browseSort === "updated_desc" ? "active" : ""}
                            onClick={() => setBrowseSort("updated_desc")}
                          >
                            Newest First
                          </button>
                          <button
                            type="button"
                            className={browseSort === "updated_asc" ? "active" : ""}
                            onClick={() => setBrowseSort("updated_asc")}
                          >
                            Oldest First
                          </button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <p className="muted">Showing {filteredBrowseNotes.length} of {notes.length} notes.</p>

                <div className="browse-notes-grid">
                  {filteredBrowseNotes.length === 0 && <p className="muted">No notes match current filters.</p>}
                  {filteredBrowseNotes.map((note, index) => (
                    <motion.div
                      key={note.id}
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={inViewViewport}
                      transition={{ ...inViewTransition, delay: index * 0.08 }}
                    >
                      <TiltCard className="browse-note-card-tilt" maxRotation={6}>
                        <article className="browse-note-card">
                          <h3>{note.title}</h3>
                          <p>{truncateText(note.content, 200)}</p>
                          <div className="browse-note-meta-row">
                            <span className="note-date-badge">{new Date(note.updated_at).toLocaleDateString()}</span>
                            <span className="note-source-badge">{sourceBadgeLabel(note.source_type)}</span>
                          </div>
                          <button
                            type="button"
                            className="button-neutral"
                            onClick={() => {
                              void openNoteForEditing(note.id);
                            }}
                          >
                            Open Note
                          </button>
                        </article>
                      </TiltCard>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.section>

            <motion.section
              className="workspace-flow-strip"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewViewport}
              transition={inViewTransition}
            >
              <div className="flow-inner flow-strip-inner">
                <h2>The more you capture, the smarter your second brain gets.</h2>
              </div>
            </motion.section>
          </div>
        )}

        {/* ── GRAPH PAGE ── */}
        {workspacePage === "graph" && (
          <div className="workspace-flow-page graph-flow-page">
            <motion.section
              className="workspace-flow-section flow-hero-section"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewViewport}
              transition={inViewTransition}
            >
              <div className="flow-inner flow-hero-inner">
                <h1 className="flow-heading">Your Knowledge Graph</h1>
                <p className="flow-subheading">
                  See how your notes connect. Discover clusters, trace relationships, and think spatially about your
                  ideas.
                </p>
              </div>
            </motion.section>

            <motion.section
              className="workspace-flow-section graph-tabs-section"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewViewport}
              transition={inViewTransition}
            >
              <div className="flow-inner">
                <div className="graph-view-tabs" role="tablist" aria-label="Graph view tabs">
                  <button
                    type="button"
                    className={effectiveGraphMode === "2d" ? "graph-view-tab-button active" : "graph-view-tab-button"}
                    onClick={() => handleToggleGraphMode("2d")}
                    disabled={!has2DRenderer}
                  >
                    {effectiveGraphMode === "2d" && <motion.span layoutId="graph-view-underline" className="graph-view-underline" />}
                    <span className={effectiveGraphMode === "2d" ? "graph-view-tab-label active-label" : "graph-view-tab-label"}>
                      2D View
                    </span>
                  </button>
                  <button
                    type="button"
                    className={effectiveGraphMode === "3d" ? "graph-view-tab-button active" : "graph-view-tab-button"}
                    onClick={() => handleToggleGraphMode("3d")}
                    disabled={isLoading3DRenderer}
                  >
                    {effectiveGraphMode === "3d" && <motion.span layoutId="graph-view-underline" className="graph-view-underline" />}
                    <span className={effectiveGraphMode === "3d" ? "graph-view-tab-label active-label" : "graph-view-tab-label"}>
                      3D View
                    </span>
                  </button>
                </div>
                {!isWebGLSupported && (
                  <p className="muted graph-webgl-hint">WebGL may be blocked on this device. You can still try 3D view.</p>
                )}
              </div>
            </motion.section>

            <motion.section
              className="workspace-flow-section"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewViewport}
              transition={inViewTransition}
            >
              <div className="flow-inner graph-canvas-inner">
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
                      <button type="button" className={edgeView === "all" ? "active" : ""} onClick={() => setEdgeView("all")}>All Edges</button>
                      <button type="button" className={edgeView === "ai" ? "active" : ""} onClick={() => setEdgeView("ai")}>AI Links</button>
                      <button type="button" className={edgeView === "manual" ? "active" : ""} onClick={() => setEdgeView("manual")}>Manual Links</button>
                    </div>

                    <div className="graph-toolbar-right">
                      <button type="button" className="button-neutral" onClick={handleLoadInsights} disabled={!isAuthenticated}>
                        Load Insights
                      </button>
                      <button type="button" className="button-neutral" onClick={handleRunClusters} disabled={!isAuthenticated}>
                        Discover Connections
                      </button>
                      <button
                        type="button"
                        className="button-neutral"
                        onClick={handleCenterGraph}
                        disabled={graphSceneData.nodes.length === 0}
                      >
                        Center Graph
                      </button>
                    </div>
                  </div>
                </div>

                <div
                  className="relative w-full overflow-hidden graph-render-shell"
                  style={{ height: "520px", maxWidth: "100%" }}
                  ref={graphStageRef}
                >
                  <div className="relative w-full overflow-hidden graph-stage-frame" style={{ height: "100%", maxWidth: "100%" }}>
                    {graphSceneData.nodes.length === 0 ? (
                      <p className="muted graph-empty">No graph nodes to render. Load insights and create notes first.</p>
                    ) : graphViewport.width === 0 || graphViewport.height === 0 ? (
                      <p className="muted graph-empty">Preparing graph viewport...</p>
                    ) : graphLibError ? (
                      <div className="fallback-wrap">
                        <p className="muted graph-empty">{graphLibError}</p>
                        <svg
                          className="fallback-graph-svg"
                          width="100%"
                          height="100%"
                          viewBox={`0 0 ${fallbackLayout.width} ${fallbackLayout.height}`}
                          preserveAspectRatio="xMidYMid meet"
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
                            <g key={`f-node-${node.id}`} className="fallback-node" onClick={() => setSelectedNodeId(node.id)}>
                              <circle cx={node.px} cy={node.py} r={node.radius} fill={node.color} />
                              <text x={node.px} y={node.py - node.radius - 5} textAnchor="middle">
                                {truncateText(node.title, 24)}
                              </text>
                            </g>
                          ))}
                        </svg>
                      </div>
                    ) : effectiveGraphMode === "3d" && ForceGraph3DComponent ? (
                      <GraphRendererBoundary
                        resetKey={`3d-${graph3DRetryNonce}`}
                        onError={handleGraph3DRuntimeError}
                        fallback={<p className="muted graph-empty">3D view failed to initialize. Click 3D View to retry.</p>}
                      >
                        <ForceGraph3DComponent
                          ref={graphRef}
                          className="graph-renderer-element"
                          graphData={graphSceneData}
                          width={graphViewport.width}
                          height={graphViewport.height}
                          style={{ width: "100%", height: "100%", maxWidth: "100%", display: "block" }}
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
                          rendererConfig={{
                            antialias: false,
                            alpha: true,
                            depth: true,
                            stencil: false,
                            failIfMajorPerformanceCaveat: false,
                            powerPreference: "low-power",
                            precision: "mediump",
                          }}
                          onNodeClick={handleNodeClick}
                          backgroundColor="rgba(0,0,0,0)"
                        />
                      </GraphRendererBoundary>
                    ) : effectiveGraphMode === "2d" && ForceGraph2DComponent ? (
                      <ForceGraph2DComponent
                        ref={graphRef}
                        className="graph-renderer-element"
                        graphData={graphSceneData2D}
                        width={graphViewport.width}
                        height={graphViewport.height}
                        style={{ width: "100%", height: "100%", maxWidth: "100%", display: "block" }}
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
                  </div>
                </div>

                {selectedNode && (
                  <p className="muted graph-selected-note">
                    Selected node: <strong>{selectedNode.title}</strong>
                  </p>
                )}
              </div>
            </motion.section>

            <motion.section
              className="workspace-flow-section"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewViewport}
              transition={inViewTransition}
            >
              <div className="flow-inner">
                <div className="graph-stats-grid">
                  <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={inViewViewport} transition={inViewTransition}>
                    <TiltCard className="graph-stat-card" maxRotation={6}>
                      <article>
                        <p className="graph-stat-value">{dashboard?.total_notes ?? notes.length}</p>
                        <p className="graph-stat-label">Total Notes</p>
                      </article>
                    </TiltCard>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={inViewViewport} transition={{ ...inViewTransition, delay: 0.08 }}>
                    <TiltCard className="graph-stat-card" maxRotation={6}>
                      <article>
                        <p className="graph-stat-value">{graph?.edges.length ?? 0}</p>
                        <p className="graph-stat-label">Connections</p>
                      </article>
                    </TiltCard>
                  </motion.div>
                  <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={inViewViewport} transition={{ ...inViewTransition, delay: 0.16 }}>
                    <TiltCard className="graph-stat-card" maxRotation={6}>
                      <article>
                        <p className="graph-stat-value">{clusters?.clusters.length ?? 0}</p>
                        <p className="graph-stat-label">Clusters</p>
                      </article>
                    </TiltCard>
                  </motion.div>
                </div>
              </div>
            </motion.section>

            <motion.section
              className="workspace-flow-section"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewViewport}
              transition={inViewTransition}
            >
              <div className="flow-inner">
                <div className="graph-steps-grid">
                  {graphHowItWorks.map((step, index) => (
                    <motion.article
                      key={step.step}
                      className="graph-step-card"
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={inViewViewport}
                      transition={{ ...inViewTransition, delay: index * 0.15 }}
                    >
                      <span className="graph-step-badge">{step.step}</span>
                      <h3>{step.title}</h3>
                      <p>{step.body}</p>
                    </motion.article>
                  ))}
                </div>
              </div>
            </motion.section>

            <motion.section
              className="workspace-flow-strip"
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={inViewViewport}
              transition={inViewTransition}
            >
              <div className="flow-inner flow-strip-inner">
                <h2>Your knowledge is more connected than you think.</h2>
              </div>
            </motion.section>
          </div>
        )}
      </div>

      <TemplatePickerModal
        open={showTemplatePicker}
        templates={templates}
        onClose={() => setShowTemplatePicker(false)}
        onSelectTemplate={startDraftWithTemplate}
      />

      <CommandPalette
        open={showCommandPalette}
        notes={notes}
        templates={templates}
        onClose={() => setShowCommandPalette(false)}
        onOpenNote={(noteId) => {
          void openNoteForEditing(noteId);
        }}
        onAction={handleCommandAction}
      />

      <footer className="status">Status: {status}</footer>
    </div>
  );
}

export default App;
