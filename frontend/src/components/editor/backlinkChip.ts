import { Node, mergeAttributes } from "@tiptap/core";

export const BacklinkChip = Node.create({
  name: "backlinkChip",
  group: "inline",
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      noteId: {
        default: "",
      },
      title: {
        default: "",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "span[data-backlink-note-id]",
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-backlink-note-id": HTMLAttributes.noteId,
        class: "editor-backlink-chip",
      }),
      `[[${HTMLAttributes.title ?? "note"}]]`,
    ];
  },
});
