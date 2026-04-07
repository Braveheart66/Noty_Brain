import { useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

import { BacklinkChip } from "./backlinkChip";
import { EMPTY_DOC, jsonToPlainText, sanitizeEditorJson } from "./richText";

type NoteOption = {
  id: string;
  title: string;
  icon_emoji?: string;
};

type SlashItem = {
  label: string;
  keywords: string;
  run: () => void;
};

type BlockEditorProps = {
  initialContent?: JSONContent;
  placeholder?: string;
  availableNotes: NoteOption[];
  onUpdate: (payload: { json: JSONContent; text: string }) => void;
  onBacklinkSelect?: (targetNoteId: string) => void | Promise<void>;
};

export function BlockEditor({
  initialContent,
  placeholder = "Write, connect, and build knowledge...",
  availableNotes,
  onUpdate,
  onBacklinkSelect,
}: BlockEditorProps) {
  const [slashQuery, setSlashQuery] = useState("");
  const [backlinkQuery, setBacklinkQuery] = useState("");
  const onUpdateRef = useRef(onUpdate);
  const onBacklinkSelectRef = useRef(onBacklinkSelect);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    onBacklinkSelectRef.current = onBacklinkSelect;
  }, [onBacklinkSelect]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      BacklinkChip,
    ],
    content: sanitizeEditorJson(initialContent ?? EMPTY_DOC),
    editorProps: {
      attributes: {
        class: "editor-surface",
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      const json = activeEditor.getJSON();
      onUpdateRef.current({
        json,
        text: jsonToPlainText(json),
      });

      const cursorFrom = activeEditor.state.selection.from;
      const beforeText = activeEditor.state.doc.textBetween(Math.max(0, cursorFrom - 140), cursorFrom, "\n", "");

      const slashMatch = beforeText.match(/(?:^|\s)\/([a-z0-9 -]*)$/i);
      setSlashQuery(slashMatch ? slashMatch[1].toLowerCase() : "");

      const backlinkMatch = beforeText.match(/\[\[([^\]]*)$/);
      setBacklinkQuery(backlinkMatch ? backlinkMatch[1].toLowerCase() : "");
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    const next = sanitizeEditorJson(initialContent ?? EMPTY_DOC);
    const current = editor.getJSON();
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, initialContent]);

  const slashItems = useMemo<SlashItem[]>(() => {
    if (!editor) {
      return [];
    }

    return [
      {
        label: "Heading 1",
        keywords: "h1 heading title",
        run: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        label: "Heading 2",
        keywords: "h2 heading section",
        run: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        label: "Heading 3",
        keywords: "h3 heading sub",
        run: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      },
      {
        label: "Bullet list",
        keywords: "list bullet unordered",
        run: () => editor.chain().focus().toggleBulletList().run(),
      },
      {
        label: "Numbered list",
        keywords: "list ordered numbered",
        run: () => editor.chain().focus().toggleOrderedList().run(),
      },
      {
        label: "Code block",
        keywords: "code snippet block",
        run: () => editor.chain().focus().toggleCodeBlock().run(),
      },
      {
        label: "Divider",
        keywords: "divider horizontal rule line",
        run: () => editor.chain().focus().setHorizontalRule().run(),
      },
      {
        label: "Callout",
        keywords: "callout quote highlight",
        run: () => editor.chain().focus().toggleBlockquote().insertContent("Callout: ").run(),
      },
    ];
  }, [editor]);

  const visibleSlashItems = useMemo(() => {
    if (!slashQuery) {
      return [];
    }
    return slashItems
      .filter((item) => `${item.label} ${item.keywords}`.toLowerCase().includes(slashQuery))
      .slice(0, 8);
  }, [slashItems, slashQuery]);

  const visibleBacklinks = useMemo(() => {
    if (!backlinkQuery) {
      return [];
    }
    return availableNotes
      .filter((note) => note.title.toLowerCase().includes(backlinkQuery))
      .slice(0, 8);
  }, [availableNotes, backlinkQuery]);

  const applySlash = (item: SlashItem) => {
    item.run();
    setSlashQuery("");
  };

  const applyBacklink = async (note: NoteOption) => {
    if (!editor) {
      return;
    }

    const cursorFrom = editor.state.selection.from;
    const beforeText = editor.state.doc.textBetween(Math.max(0, cursorFrom - 140), cursorFrom, "\n", "");
    const backlinkMatch = beforeText.match(/\[\[[^\]]*$/);

    if (backlinkMatch) {
      editor.chain().focus().deleteRange({ from: cursorFrom - backlinkMatch[0].length, to: cursorFrom }).run();
    }

    editor
      .chain()
      .focus()
      .insertContent({
        type: "backlinkChip",
        attrs: {
          noteId: note.id,
          title: note.title,
        },
      })
      .insertContent(" ")
      .run();

    setBacklinkQuery("");

    const backlinkSelectHandler = onBacklinkSelectRef.current;
    if (backlinkSelectHandler) {
      await backlinkSelectHandler(note.id);
    }
  };

  return (
    <div className="block-editor-shell">
      <EditorContent editor={editor} />

      {visibleSlashItems.length > 0 && (
        <div className="editor-menu slash-menu">
          {visibleSlashItems.map((item) => (
            <button key={item.label} type="button" className="editor-menu-item" onClick={() => applySlash(item)}>
              {item.label}
            </button>
          ))}
        </div>
      )}

      {visibleBacklinks.length > 0 && (
        <div className="editor-menu backlink-menu">
          {visibleBacklinks.map((note) => (
            <button key={note.id} type="button" className="editor-menu-item" onClick={() => void applyBacklink(note)}>
              <span>{note.icon_emoji ?? "📝"}</span>
              <span>{note.title}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
