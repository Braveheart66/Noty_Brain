import { useMemo } from "react";
import ForceGraph2D from "react-force-graph-2d";

import type { Backlink, GraphPayload, Note } from "../../api/client";

type IntelligencePanelProps = {
  activeNote: Note | null;
  backlinks: Backlink[];
  graph: GraphPayload | null;
  onOpenNote: (noteId: string) => void;
};

export function IntelligencePanel({ activeNote, backlinks, graph, onOpenNote }: IntelligencePanelProps) {
  const miniGraphData = useMemo(() => {
    if (!activeNote || !graph) {
      return { nodes: [], links: [] };
    }

    const center = graph.nodes.find((node) => node.id === activeNote.id);
    if (!center) {
      return { nodes: [], links: [] };
    }

    const neighborIds = new Set<string>([activeNote.id]);
    graph.edges.forEach((edge) => {
      if (edge.source_note_id === activeNote.id) {
        neighborIds.add(edge.target_note_id);
      }
      if (edge.target_note_id === activeNote.id) {
        neighborIds.add(edge.source_note_id);
      }
    });

    const nodes = graph.nodes.filter((node) => neighborIds.has(node.id));
    const links = graph.edges.filter(
      (edge) => neighborIds.has(edge.source_note_id) && neighborIds.has(edge.target_note_id),
    );

    return {
      nodes,
      links: links.map((edge) => ({ source: edge.source_note_id, target: edge.target_note_id, id: edge.id })),
    };
  }, [activeNote, graph]);

  const wordCount = useMemo(() => {
    if (!activeNote?.content) {
      return 0;
    }
    return activeNote.content.trim().split(/\s+/).filter(Boolean).length;
  }, [activeNote]);

  if (!activeNote) {
    return (
      <aside className="intelligence-panel">
        <h3>Note Intelligence</h3>
        <p className="muted">Select a note to inspect metadata, backlinks, and local graph context.</p>
      </aside>
    );
  }

  return (
    <aside className="intelligence-panel">
      <h3>Note Intelligence</h3>

      <div className="intelligence-card">
        <p><strong>{activeNote.icon_emoji || "📝"} {activeNote.title}</strong></p>
        <small>source: {activeNote.source_type}</small>
        <small>embedding: {activeNote.embedding_status ?? "pending"}</small>
        <small>words: {wordCount}</small>
        <small>created: {activeNote.created_at ? new Date(activeNote.created_at).toLocaleString() : "-"}</small>
        <small>updated: {activeNote.updated_at ? new Date(activeNote.updated_at).toLocaleString() : "-"}</small>
        <small>
          tags: {activeNote.tags && activeNote.tags.length > 0 ? activeNote.tags.map((tag) => tag.name).join(", ") : "none"}
        </small>
      </div>

      <div className="intelligence-card">
        <h4>Backlinks</h4>
        {backlinks.length === 0 && <p className="muted">No backlinks yet.</p>}
        {backlinks.map((item) => (
          <button key={item.link_id} type="button" className="backlink-row" onClick={() => onOpenNote(item.note_id)}>
            <span>{item.icon_emoji || "📝"}</span>
            <span>{item.title}</span>
          </button>
        ))}
      </div>

      <div className="intelligence-card mini-graph-card">
        <h4>Mini Graph</h4>
        {miniGraphData.nodes.length === 0 ? (
          <p className="muted">No local graph context available.</p>
        ) : (
          <ForceGraph2D
            graphData={miniGraphData}
            width={240}
            height={220}
            nodeLabel={(node: object) => (node as { title?: string }).title ?? "note"}
            nodeColor={(node: object) => ((node as { id: string }).id === activeNote.id ? "#1f7a63" : "#7aa59a")}
            linkColor={() => "#7fa599"}
            onNodeClick={(node: object) => onOpenNote((node as { id: string }).id)}
            cooldownTicks={80}
            backgroundColor="rgba(0,0,0,0)"
          />
        )}
      </div>
    </aside>
  );
}
