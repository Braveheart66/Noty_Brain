import type { JSONContent } from "@tiptap/react";

export const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

const MAX_EDITOR_PARAGRAPH_LENGTH = 1600;

function splitLargeParagraph(block: string): string[] {
  if (block.length <= MAX_EDITOR_PARAGRAPH_LENGTH) {
    return [block];
  }

  const chunks: string[] = [];
  const words = block.split(/\s+/).filter(Boolean);
  let current = "";

  for (const word of words) {
    const next = current.length === 0 ? word : `${current} ${word}`;
    if (next.length <= MAX_EDITOR_PARAGRAPH_LENGTH) {
      current = next;
      continue;
    }

    if (current.length > 0) {
      chunks.push(current);
      current = word;
    } else {
      chunks.push(word.slice(0, MAX_EDITOR_PARAGRAPH_LENGTH));
      current = word.slice(MAX_EDITOR_PARAGRAPH_LENGTH);
    }
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

export function plainTextToDoc(text: string): JSONContent {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return EMPTY_DOC;
  }

  const blocks = normalized
    .split(/\n\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block) =>
      block
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .flatMap(splitLargeParagraph),
    );

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
