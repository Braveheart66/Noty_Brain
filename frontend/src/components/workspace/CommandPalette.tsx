import { useEffect, useMemo, useState } from "react";

import type { Note, Template } from "../../api/client";

type CommandPaletteProps = {
  open: boolean;
  notes: Note[];
  templates: Template[];
  onClose: () => void;
  onOpenNote: (noteId: string) => void;
  onAction: (actionId: string) => void;
};

type PaletteItem = {
  id: string;
  label: string;
  kind: "note" | "action" | "template";
};

const ACTION_ITEMS: PaletteItem[] = [
  { id: "action:new-note", label: "New Note", kind: "action" },
  { id: "action:go-graph", label: "Go to Graph", kind: "action" },
  { id: "action:go-explore", label: "Go to Explore", kind: "action" },
  { id: "action:import-url", label: "Import URL", kind: "action" },
  { id: "action:ask-ai", label: "Ask AI", kind: "action" },
];

export function CommandPalette({ open, notes, templates, onClose, onOpenNote, onAction }: CommandPaletteProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      setQuery("");
    }
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const noteItems = notes.map((note) => ({ id: `note:${note.id}`, label: `${note.icon_emoji || "📝"} ${note.title}`, kind: "note" as const }));
    const templateItems = templates.map((template) => ({
      id: `template:${template.id}`,
      label: `${template.icon_emoji || "📝"} Template: ${template.name}`,
      kind: "template" as const,
    }));

    return [...ACTION_ITEMS, ...templateItems, ...noteItems];
  }, [notes, templates]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return items.slice(0, 14);
    }
    return items.filter((item) => item.label.toLowerCase().includes(q)).slice(0, 14);
  }, [items, query]);

  if (!open) {
    return null;
  }

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette-shell" onClick={(event) => event.stopPropagation()}>
        <input
          autoFocus
          className="palette-input"
          placeholder="Search notes, actions, templates..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              onClose();
              return;
            }

            if (event.key === "Enter") {
              const first = filtered[0];
              if (!first) {
                return;
              }
              if (first.kind === "note") {
                onOpenNote(first.id.replace("note:", ""));
              } else {
                onAction(first.id.startsWith("action:") ? first.id.replace("action:", "") : first.id);
              }
              onClose();
            }
          }}
        />

        <div className="palette-results">
          {filtered.length === 0 && <p className="muted">No matching commands.</p>}
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className="palette-item"
              onClick={() => {
                if (item.kind === "note") {
                  onOpenNote(item.id.replace("note:", ""));
                } else {
                  onAction(item.id.startsWith("action:") ? item.id.replace("action:", "") : item.id);
                }
                onClose();
              }}
            >
              <span>{item.label}</span>
              <small>{item.kind}</small>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
