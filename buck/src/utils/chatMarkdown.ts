/**
 * Tiny Markdown subset for AI chat replies: paragraphs, "- " / "* " / "1. "
 * lists and **bold**. Output is plain data rendered as React text nodes, so
 * model output can never inject HTML. Unclosed "**" (mid-stream) stays text.
 */

export type InlineSpan = { text: string; bold: boolean };

export type ChatBlock =
  | { kind: "paragraph"; spans: InlineSpan[] }
  | { kind: "list"; ordered: boolean; items: InlineSpan[][] };

export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > last) spans.push({ text: text.slice(last, match.index), bold: false });
    spans.push({ text: match[1], bold: true });
    last = match.index + match[0].length;
  }
  if (last < text.length) spans.push({ text: text.slice(last), bold: false });
  return spans;
}

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

export function parseChatMarkdown(source: string): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      blocks.push({ kind: "paragraph", spans: parseInline(paragraph.join(" ")) });
      paragraph = [];
    }
  };

  for (const rawLine of source.split(/\r?\n/)) {
    // Headings are outside the subset; keep their text as a paragraph line.
    const line = rawLine.replace(/^\s*#{1,6}\s+/, "");
    const bullet = BULLET.exec(line);
    const numbered = bullet ? null : NUMBERED.exec(line);

    if (bullet || numbered) {
      flushParagraph();
      const ordered = Boolean(numbered);
      const item = parseInline((bullet ?? numbered)![1]);
      const previous = blocks[blocks.length - 1];
      if (previous?.kind === "list" && previous.ordered === ordered) {
        previous.items.push(item);
      } else {
        blocks.push({ kind: "list", ordered, items: [item] });
      }
    } else if (!line.trim()) {
      flushParagraph();
    } else {
      paragraph.push(line.trim());
    }
  }

  flushParagraph();
  return blocks;
}
