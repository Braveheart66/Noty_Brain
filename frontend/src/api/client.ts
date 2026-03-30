const configuredApiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api";
const normalizedApiBase = configuredApiBase.trim().replace(/\/+$/, "");
const API_BASE_URL = /\/api$/i.test(normalizedApiBase)
  ? normalizedApiBase
  : `${normalizedApiBase}/api`;

export type LoginResponse = {
  access: string;
  refresh: string;
};

export type Note = {
  id: string;
  icon_emoji: string;
  title: string;
  content_json?: Record<string, unknown>;
  content: string;
  source_type: "manual" | "url" | "pdf";
  source_ref?: string;
  embedding_status?: "pending" | "done" | "failed";
  failed_embedding?: boolean;
  created_at?: string;
  updated_at: string;
  tags?: Array<{ id: string; name: string; color: string }>;
};

export type Backlink = {
  link_id: string;
  relationship_type: string;
  is_ai_generated: boolean;
  note_id: string;
  icon_emoji: string;
  title: string;
  source_type: "manual" | "url" | "pdf";
  updated_at: string;
};

export type Template = {
  id: string;
  name: string;
  icon_emoji: string;
  content_json: Record<string, unknown>;
  content_text: string;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar_url: string;
  date_joined: string;
};

export type SearchResult = {
  note_id: string;
  title: string;
  excerpt: string;
  similarity_score: number;
  source_type: "manual" | "url" | "pdf";
};

export type SearchResponse = {
  query: string;
  results: SearchResult[];
  answer?: string;
  source_notes?: Array<{ id: string; title: string; similarity_score: number }>;
  confidence?: number;
};

export type AskResponse = {
  answer: string;
  source_notes: Array<{ id: string; title: string; similarity_score: number }>;
  confidence: number;
};

export type QueryHistoryEntry = {
  id: string;
  question: string;
  answer: string;
  source_note_ids: string[];
  avg_similarity: number;
  created_at: string;
};

export type DashboardStats = {
  total_notes: number;
  notes_added_this_week: number;
  questions_count: number;
  most_connected_notes: Array<{ id: string; title: string; link_count: number }>;
  orphan_notes: Array<{ id: string; title: string }>;
  knowledge_growth: Array<{ day: string; count: number }>;
  recent_queries: Array<{ question: string; answer: string; created_at: string }>;
};

export type GraphPayload = {
  nodes: Array<{ id: string; title: string; source_type: string; tags: string[] }>;
  edges: Array<{
    id: string;
    source_note_id: string;
    target_note_id: string;
    relationship_type: string;
    is_ai_generated: boolean;
    similarity_score: number | null;
  }>;
};

export type ClusterPayload = {
  note_count: number;
  suggested_k: number;
  clusters: Array<{
    label: string;
    size: number;
    notes: Array<{ id: string; title: string }>;
  }>;
};

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const responseType = response.headers.get("content-type") ?? "";
  if (responseType.includes("application/json")) {
    return response.json() as Promise<T>;
  }

  return (await response.text()) as T;
}

export function register(payload: {
  email: string;
  password: string;
  display_name: string;
}) {
  return request<{ id: string; email: string }>("/auth/register/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload: { email: string; password: string }) {
  return request<LoginResponse>("/auth/token/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function refreshAccessToken(payload: { refresh: string }) {
  return request<{ access: string }>("/auth/token/refresh/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchNotes(accessToken: string) {
  return request<Note[]>("/notes/", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function fetchProfile(accessToken: string) {
  return request<Profile>("/auth/profile/", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function createNote(
  accessToken: string,
  payload: { title: string; content: string; content_json?: Record<string, unknown>; icon_emoji?: string },
) {
  return request<Note>("/notes/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      ...payload,
      source_type: "manual",
    }),
  });
}

export function updateNote(
  accessToken: string,
  noteId: string,
  payload: { title?: string; content?: string; content_json?: Record<string, unknown>; icon_emoji?: string },
) {
  return request<Note>(`/notes/${noteId}/`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function deleteNote(accessToken: string, noteId: string) {
  return request<void>(`/notes/${noteId}/`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function addManualLink(
  accessToken: string,
  noteId: string,
  payload: { target_note: string; relationship_type?: string },
) {
  return request<{ id: string }>(`/notes/${noteId}/links/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function fetchBacklinks(accessToken: string, noteId: string) {
  return request<Backlink[]>(`/notes/${noteId}/backlinks/`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function fetchTemplates(accessToken: string) {
  return request<Template[]>("/notes/templates/", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function createTemplate(
  accessToken: string,
  payload: {
    name: string;
    icon_emoji: string;
    content_json: Record<string, unknown>;
    content_text: string;
  },
) {
  return request<Template>("/notes/templates/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function ingestUrl(
  accessToken: string,
  payload: { url: string; title?: string },
) {
  return request<Note>("/notes/ingest/url/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function ingestText(
  accessToken: string,
  payload: { content: string; title?: string },
) {
  return request<Note>("/notes/ingest/text/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function ingestPdf(accessToken: string, file: File, title?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (title) {
    formData.append("title", title);
  }

  return request<Note>("/notes/ingest/pdf/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
}

export function semanticSearch(
  accessToken: string,
  payload: {
    query: string;
    include_answer?: boolean;
    response_length?: "short" | "medium" | "long";
  },
) {
  return request<SearchResponse>("/search/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function askQuestion(accessToken: string, payload: { question: string }) {
  return request<AskResponse>("/ask/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export function fetchAskHistory(accessToken: string) {
  return request<QueryHistoryEntry[]>("/ask/history/", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function fetchGraph(accessToken: string) {
  return request<GraphPayload>("/graph/", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function fetchDashboard(accessToken: string) {
  return request<DashboardStats>("/analytics/dashboard/", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export function runClusterAnalysis(accessToken: string) {
  return request<ClusterPayload>("/analytics/clusters/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({}),
  });
}
