import { useMemo } from "react";

import type { Backlink, GraphPayload, Note } from "../../api/client";

type IntelligencePanelProps = {
  activeNote: Note | null;
  backlinks: Backlink[];
  graph: GraphPayload | null;
  onOpenNote: (noteId: string) => void;
};

export function IntelligencePanel({ activeNote, backlinks, graph, onOpenNote }: IntelligencePanelProps) {
  const visibleBacklinks = useMemo(() => backlinks.slice(0, 40), [backlinks]);

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

  const miniGraphLayout = useMemo(() => {
    const width = 240;
    const height = 180;

    if (!activeNote || miniGraphData.nodes.length === 0) {
      return {
        width,
        height,
        nodes: [] as Array<{ id: string; title: string; x: number; y: number; isCenter: boolean }>,
        links: [] as Array<{ id: string; sx: number; sy: number; tx: number; ty: number }>,
      };
    }

    const centerX = width / 2;
    const centerY = height / 2;
    const centerId = activeNote.id;

    const centerNode = miniGraphData.nodes.find((node) => node.id === centerId);
    const neighbors = miniGraphData.nodes.filter((node) => node.id !== centerId);

    const positionedNodes = new Map<string, { id: string; title: string; x: number; y: number; isCenter: boolean }>();

    if (centerNode) {
      positionedNodes.set(centerNode.id, {
        id: centerNode.id,
        title: centerNode.title,
        x: centerX,
        y: centerY,
        isCenter: true,
      });
    }

    const radius = Math.min(72, 34 + neighbors.length * 4);
    neighbors.forEach((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, neighbors.length);
      positionedNodes.set(node.id, {
        id: node.id,
        title: node.title,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius,
        isCenter: false,
      });
    });

    const links = miniGraphData.links
      .map((link) => {
        const sourceId = typeof link.source === "string" ? link.source : String(link.source);
        const targetId = typeof link.target === "string" ? link.target : String(link.target);
        const source = positionedNodes.get(sourceId);
        const target = positionedNodes.get(targetId);
        if (!source || !target) {
          return null;
        }
        return {
          id: link.id,
          sx: source.x,
          sy: source.y,
          tx: target.x,
          ty: target.y,
        };
      })
      .filter((item): item is { id: string; sx: number; sy: number; tx: number; ty: number } => Boolean(item));

    return {
      width,
      height,
      nodes: [...positionedNodes.values()],
      links,
    };
  }, [activeNote, miniGraphData]);

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
        {backlinks.length > 0 && (
          <div className="backlinks-scroll-wrap">
            <div className="backlinks-scroll" role="list" aria-label="Backlinks">
              {visibleBacklinks.map((item) => (
                <button key={item.link_id} type="button" className="backlink-row" onClick={() => onOpenNote(item.note_id)}>
                  <span>{item.icon_emoji || "📝"}</span>
                  <span>{item.title}</span>
                </button>
              ))}
            </div>
          </div>
        )}
        {backlinks.length > visibleBacklinks.length && (
          <small className="muted">Showing {visibleBacklinks.length} of {backlinks.length} backlinks.</small>
        )}
      </div>

      <div className="intelligence-card mini-graph-card">
        <h4>Mini Graph</h4>
        {miniGraphLayout.nodes.length === 0 ? (
          <p className="muted">No local graph context available.</p>
        ) : (
          <svg
            width={miniGraphLayout.width}
            height={miniGraphLayout.height}
            viewBox={`0 0 ${miniGraphLayout.width} ${miniGraphLayout.height}`}
            role="img"
            aria-label="Mini graph context"
          >
            {miniGraphLayout.links.map((link) => (
              <line
                key={link.id}
                x1={link.sx}
                y1={link.sy}
                x2={link.tx}
                y2={link.ty}
                stroke="#7fa599"
                strokeWidth="1.4"
                strokeOpacity="0.72"
              />
            ))}
            {miniGraphLayout.nodes.map((node) => (
              <g key={node.id} onClick={() => onOpenNote(node.id)} style={{ cursor: "pointer" }}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={node.isCenter ? 7 : 5}
                  fill={node.isCenter ? "#1f7a63" : "#7aa59a"}
                />
              </g>
            ))}
          </svg>
        )}
      </div>
    </aside>
  );
}
