import type { JSONContent } from "@tiptap/react";

export const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

export function plainTextToDoc(text: string): JSONContent {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return EMPTY_DOC;
  }

  const blocks = normalized.split(/\n\n+/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length === 0) {
    return EMPTY_DOC;
  }

  return {
    type: "doc",
    content: blocks.map((block) => ({
      type: "paragraph",
      content: [{ type: "text", text: block }],
    })),
  };
}

export function jsonToPlainText(content: JSONContent | null | undefined): string {
  if (!content || typeof content !== "object") {
    return "";
  }

  const walk = (node: JSONContent): string => {
    if (node.type === "text") {
      return node.text ?? "";
    }

    if (node.type === "backlinkChip") {
      const title = String(node.attrs?.title ?? "").trim();
      return title ? `[[${title}]]` : "";
    }

    const children = Array.isArray(node.content) ? node.content : [];
    const joined = children.map(walk).join("");

    if (node.type === "paragraph" || node.type === "heading" || node.type === "blockquote" || node.type === "codeBlock") {
      return `${joined}\n\n`;
    }

    if (node.type === "bulletList" || node.type === "orderedList") {
      return `${joined}\n`;
    }

    if (node.type === "listItem") {
      return `- ${joined}\n`;
    }

    if (node.type === "horizontalRule") {
      return "---\n\n";
    }

    return joined;
  };

  return walk(content).replace(/\n{3,}/g, "\n\n").trim();
}

export function sanitizeEditorJson(content: unknown): JSONContent {
  if (!content || typeof content !== "object") {
    return EMPTY_DOC;
  }
  const maybe = content as JSONContent;
  if (maybe.type !== "doc") {
    return EMPTY_DOC;
  }
  return maybe;
}
