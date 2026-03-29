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

function browserSupportsWebGL(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    return Boolean(gl);
  } catch {
    return false;
  }
}

function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authMode, setAuthMode] = useState<AuthMode>("register");
  const [token, setToken] = useState("");

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
  const [graphMode, setGraphMode] = useState<GraphRenderMode>(
    browserSupportsWebGL() ? "3d" : "2d",
  );
  const [forceGraph2D, setForceGraph2D] = useState<GraphRenderer | null>(null);
  const [forceGraph3D, setForceGraph3D] = useState<GraphRenderer | null>(null);
  const [graphLibError, setGraphLibError] = useState<string | null>(null);
  const [nodeSearch, setNodeSearch] = useState("");
  const [activeCluster, setActiveCluster] = useState<number | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const graphRef = useRef<any>(undefined);
  const graphStageRef = useRef<HTMLDivElement | null>(null);
  const [graphViewport, setGraphViewport] = useState({ width: 960, height: 560 });

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

    const visibleEdges = currentGraph.edges.filter((edge) => {
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

    const degreeByNode = new Map<string, number>();
    visibleNodes.forEach((node) => degreeByNode.set(node.id, 0));
    visibleEdges.forEach((edge) => {
      degreeByNode.set(edge.source_note_id, (degreeByNode.get(edge.source_note_id) ?? 0) + 1);
      degreeByNode.set(edge.target_note_id, (degreeByNode.get(edge.target_note_id) ?? 0) + 1);
    });

    const nodes: GraphNode3D[] = visibleNodes.map((node) => {
      const clusterIndex = clusterIndexByNoteId.get(node.id) ?? -1;
      const degree = degreeByNode.get(node.id) ?? 0;
      return {
        ...node,
        clusterIndex,
        color: clusterIndex >= 0 ? CLUSTER_PALETTE[clusterIndex % CLUSTER_PALETTE.length] : "#54606a",
        val: Math.max(3.8, 3 + degree * 1.2),
      };
    });

    const links: GraphLink3D[] = visibleEdges.map((edge) => ({
      id: edge.id,
      source: edge.source_note_id,
      target: edge.target_note_id,
      relationship_type: edge.relationship_type,
      is_ai_generated: edge.is_ai_generated,
      similarity_score: edge.similarity_score,
    }));

    return { nodes, links };
  }, [activeCluster, clusterIndexByNoteId, edgeView, graph, nodeSearch]);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) {
      return null;
    }
    return graphSceneData.nodes.find((node) => node.id === selectedNodeId) ?? null;
  }, [graphSceneData.nodes, selectedNodeId]);

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
    const outerRadius = clusterCount > 1 ? Math.min(width, height) * 0.3 : 0;
    const positionedNodes = new Map<string, FallbackNode>();

    clustersOrdered.forEach(([, clusterNodes], clusterIndex) => {
      const angle = clusterCount === 1 ? 0 : (Math.PI * 2 * clusterIndex) / clusterCount;
      const clusterCenterX = centerX + Math.cos(angle) * outerRadius;
      const clusterCenterY = centerY + Math.sin(angle) * outerRadius;
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
      await loadWorkspace(token);
      setStatus("Workspace refreshed.");
    } catch (error) {
      setStatus(`Refresh failed: ${(error as Error).message}`);
    }
  };

  const handleSignOut = () => {
    setToken("");
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
      const created = await createNote(token, { title: noteTitle, content: noteBody });
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
      const created = await ingestUrl(token, { url: urlToIngest, title: urlTitle || undefined });
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
      const created = await ingestText(token, {
        content: textToIngest,
        title: textTitle || undefined,
      });
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
      const created = await ingestPdf(token, pdfFile, pdfTitle || undefined);
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
      const response = await semanticSearch(token, {
        query: searchQuery,
        include_answer: true,
        response_length: searchResponseLength,
      });
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
      const response = await askQuestion(token, { question });
      setAskResult(response);
      const updatedHistory = await fetchAskHistory(token);
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
      const [loadedDashboard, loadedGraph] = await Promise.all([
        fetchDashboard(token),
        fetchGraph(token),
      ]);
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
      const response = await runClusterAnalysis(token);
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
      const [loadedDashboard, loadedGraph] = await Promise.all([
        fetchDashboard(token),
        fetchGraph(token),
      ]);
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
      const updated = await updateNote(token, noteId, {
        title: nextTitle,
        content: nextContent,
      });
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
      await deleteNote(token, noteId);
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
          <input
            placeholder="Filter nodes by title, tag, or source"
            value={nodeSearch}
            onChange={(event) => setNodeSearch(event.target.value)}
            disabled={!isAuthenticated}
          />
          <div className="graph-toolbar-right">
            <div className="segmented" role="tablist" aria-label="Edge filter">
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
