import { useEffect, useMemo, useState } from "react";

import type { Note } from "../../api/client";

type SidebarActionHandlers = {
  onSelectNote: (noteId: string) => void;
  onCreateNote: () => void;
  onRenameNote: (noteId: string) => void;
  onDeleteNote: (noteId: string) => void;
  onDuplicateNote: (noteId: string) => void;
  onUpdateEmoji: (noteId: string, emoji: string) => void;
};

type WorkspaceSidebarProps = SidebarActionHandlers & {
  notes: Note[];
  activeNoteId: string | null;
};

type ContextMenuState = {
  noteId: string;
  x: number;
  y: number;
} | null;

function relativeTime(value: string | undefined): string {
  if (!value) {
    return "-";
  }

  const deltaMs = Date.now() - new Date(value).getTime();
  const deltaMinutes = Math.round(deltaMs / 60000);
  if (deltaMinutes < 1) {
    return "now";
  }
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m`;
  }
  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 24) {
    return `${deltaHours}h`;
  }
  const deltaDays = Math.round(deltaHours / 24);
  return `${deltaDays}d`;
}

export function WorkspaceSidebar({
  notes,
  activeNoteId,
  onSelectNote,
  onCreateNote,
  onRenameNote,
  onDeleteNote,
  onDuplicateNote,
  onUpdateEmoji,
}: WorkspaceSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState("");
  const [menu, setMenu] = useState<ContextMenuState>(null);

  useEffect(() => {
    const closeMenu = () => setMenu(null);
    window.addEventListener("click", closeMenu);
    return () => window.removeEventListener("click", closeMenu);
  }, []);

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) {
      return notes;
    }
    return notes.filter((note) => note.title.toLowerCase().includes(query));
  }, [filter, notes]);

  return (
    <aside className={collapsed ? "workspace-sidebar collapsed" : "workspace-sidebar"}>
      <div className="workspace-sidebar-top">
        <button type="button" className="button-neutral sidebar-toggle" onClick={() => setCollapsed((current) => !current)}>
          {collapsed ? "»" : "«"}
        </button>
        {!collapsed && (
          <>
            <input
              placeholder="Search notes"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
            />
            <button type="button" onClick={onCreateNote}>+ New Note</button>
          </>
        )}
      </div>

      {!collapsed && (
        <div className="workspace-note-list">
          {filtered.map((note) => (
            <button
              key={note.id}
              type="button"
              className={note.id === activeNoteId ? "workspace-note-item active" : "workspace-note-item"}
              onClick={() => onSelectNote(note.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                setMenu({ noteId: note.id, x: event.clientX, y: event.clientY });
              }}
            >
              <span
                className="workspace-note-emoji"
                onClick={(event) => {
                  event.stopPropagation();
                  const nextEmoji = window.prompt("Emoji", note.icon_emoji || "📝");
                  if (nextEmoji && nextEmoji.trim()) {
                    onUpdateEmoji(note.id, nextEmoji.trim());
                  }
                }}
              >
                {note.icon_emoji || "📝"}
              </span>
              <span className="workspace-note-text">
                <strong>{note.title}</strong>
                <small>{relativeTime(note.updated_at)}</small>
              </span>
            </button>
          ))}
        </div>
      )}

      {menu && (
        <div className="workspace-context-menu" style={{ left: menu.x, top: menu.y }}>
          <button type="button" onClick={() => onRenameNote(menu.noteId)}>Rename</button>
          <button type="button" onClick={() => onDuplicateNote(menu.noteId)}>Duplicate</button>
          <button type="button" className="danger" onClick={() => onDeleteNote(menu.noteId)}>Delete</button>
        </div>
      )}
    </aside>
  );
}
