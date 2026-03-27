import type { ReactNode } from "react";

export type RichTextInlineToken =
  | { type: "text"; value: string }
  | { type: "strong"; value: string }
  | { type: "code"; value: string };

export type RichTextBlock =
  | { type: "heading"; level: 1 | 2 | 3; tokens: RichTextInlineToken[] }
  | { type: "paragraph"; tokens: RichTextInlineToken[] }
  | { type: "quote"; tokens: RichTextInlineToken[] }
  | { type: "list"; items: RichTextInlineToken[][] };

export type TextEditResult = {
  nextText: string;
  nextSelectionStart: number;
  nextSelectionEnd: number;
};

const tokenizeInline = (text: string): RichTextInlineToken[] => {
  const tokens: RichTextInlineToken[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const strongStart = text.indexOf("**", cursor);
    const codeStart = text.indexOf("`", cursor);

    let nextSpecial = -1;
    let specialType: "strong" | "code" | null = null;

    if (strongStart !== -1 && (codeStart === -1 || strongStart <= codeStart)) {
      nextSpecial = strongStart;
      specialType = "strong";
    } else if (codeStart !== -1) {
      nextSpecial = codeStart;
      specialType = "code";
    }

    if (nextSpecial === -1 || specialType === null) {
      tokens.push({ type: "text", value: text.slice(cursor) });
      break;
    }

    if (nextSpecial > cursor) {
      tokens.push({ type: "text", value: text.slice(cursor, nextSpecial) });
    }

    if (specialType === "strong") {
      const strongEnd = text.indexOf("**", nextSpecial + 2);
      if (strongEnd === -1) {
        tokens.push({ type: "text", value: text.slice(nextSpecial) });
        break;
      }

      tokens.push({ type: "strong", value: text.slice(nextSpecial + 2, strongEnd) });
      cursor = strongEnd + 2;
      continue;
    }

    const codeEnd = text.indexOf("`", nextSpecial + 1);
    if (codeEnd === -1) {
      tokens.push({ type: "text", value: text.slice(nextSpecial) });
      break;
    }

    tokens.push({ type: "code", value: text.slice(nextSpecial + 1, codeEnd) });
    cursor = codeEnd + 1;
  }

  return tokens.filter((token) => token.value.length > 0);
};

export const parseMaintenanceRichText = (input: string): RichTextBlock[] => {
  const lines = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const blocks: RichTextBlock[] = [];
  let lineIndex = 0;

  while (lineIndex < lines.length) {
    const line = lines[lineIndex] ?? "";
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      lineIndex += 1;
      continue;
    }

    if (trimmedLine.startsWith("- ")) {
      const items: RichTextInlineToken[][] = [];
      while (lineIndex < lines.length) {
        const listLine = (lines[lineIndex] ?? "").trim();
        if (!listLine.startsWith("- ")) {
          break;
        }

        items.push(tokenizeInline(listLine.slice(2).trim()));
        lineIndex += 1;
      }
      blocks.push({ type: "list", items });
      continue;
    }

    if (trimmedLine.startsWith("> ")) {
      blocks.push({
        type: "quote",
        tokens: tokenizeInline(trimmedLine.slice(2).trim()),
      });
      lineIndex += 1;
      continue;
    }

    if (trimmedLine.startsWith("### ")) {
      blocks.push({
        type: "heading",
        level: 3,
        tokens: tokenizeInline(trimmedLine.slice(4).trim()),
      });
      lineIndex += 1;
      continue;
    }

    if (trimmedLine.startsWith("## ")) {
      blocks.push({
        type: "heading",
        level: 2,
        tokens: tokenizeInline(trimmedLine.slice(3).trim()),
      });
      lineIndex += 1;
      continue;
    }

    if (trimmedLine.startsWith("# ")) {
      blocks.push({
        type: "heading",
        level: 1,
        tokens: tokenizeInline(trimmedLine.slice(2).trim()),
      });
      lineIndex += 1;
      continue;
    }

    const paragraphLines: string[] = [];
    while (lineIndex < lines.length) {
      const paragraphLine = lines[lineIndex] ?? "";
      const paragraphTrimmed = paragraphLine.trim();
      if (
        !paragraphTrimmed ||
        paragraphTrimmed.startsWith("# ") ||
        paragraphTrimmed.startsWith("## ") ||
        paragraphTrimmed.startsWith("### ") ||
        paragraphTrimmed.startsWith("- ") ||
        paragraphTrimmed.startsWith("> ")
      ) {
        break;
      }

      paragraphLines.push(paragraphTrimmed);
      lineIndex += 1;
    }

    blocks.push({
      type: "paragraph",
      tokens: tokenizeInline(paragraphLines.join(" ")),
    });
  }

  return blocks;
};

export const renderRichTextTokens = (
  tokens: RichTextInlineToken[],
  keyPrefix: string,
): ReactNode[] =>
  tokens.map((token, index) => {
    const key = `${keyPrefix}-${index}`;
    if (token.type === "strong") {
      return <strong key={key}>{token.value}</strong>;
    }

    if (token.type === "code") {
      return (
        <code className="rich-text-code" key={key}>
          {token.value}
        </code>
      );
    }

    return <span key={key}>{token.value}</span>;
  });

export const applyWrapEdit = (
  text: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
  suffix: string,
): TextEditResult => {
  const selectedText = text.slice(selectionStart, selectionEnd);
  const nextText =
    text.slice(0, selectionStart) + prefix + selectedText + suffix + text.slice(selectionEnd);

  return {
    nextText,
    nextSelectionStart: selectionStart + prefix.length,
    nextSelectionEnd: selectionEnd + prefix.length,
  };
};

const findLineStart = (text: string, index: number) => {
  const nextIndex = Math.max(0, Math.min(index, text.length));
  const lineBreakIndex = text.lastIndexOf("\n", nextIndex - 1);
  return lineBreakIndex === -1 ? 0 : lineBreakIndex + 1;
};

const findLineEnd = (text: string, index: number) => {
  const nextIndex = Math.max(0, Math.min(index, text.length));
  const lineBreakIndex = text.indexOf("\n", nextIndex);
  return lineBreakIndex === -1 ? text.length : lineBreakIndex;
};

export const applyLinePrefixEdit = (
  text: string,
  selectionStart: number,
  selectionEnd: number,
  prefix: string,
): TextEditResult => {
  const blockStart = findLineStart(text, selectionStart);
  const blockEnd = findLineEnd(text, selectionEnd);
  const blockText = text.slice(blockStart, blockEnd);
  const lines = blockText.split("\n");
  const prefixedBlock = lines.map((line) => `${prefix}${line}`).join("\n");
  const nextText = text.slice(0, blockStart) + prefixedBlock + text.slice(blockEnd);
  const addedLength = prefix.length * lines.length;

  return {
    nextText,
    nextSelectionStart: selectionStart + prefix.length,
    nextSelectionEnd: selectionEnd + addedLength,
  };
};
