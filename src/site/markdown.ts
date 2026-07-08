import { marked, type TokenizerAndRendererExtension, type Tokens } from "marked";
import { escapeHtml } from "./html";

// Digest markdown is agent-authored but quotes feed-derived text; raw html
// passes through as escaped text, never as markup.
marked.use({
  renderer: {
    html(token: unknown): string {
      const t = token as { text?: string; raw?: string } | string;
      return escapeHtml(typeof t === "string" ? t : (t.text ?? t.raw ?? ""));
    },
  },
});

// Pen marks, the digest's hand-drawn emphasis: ==text== scribble-underlines,
// ((text)) circles. Inline extensions, so link urls tokenize first and a
// base64 == inside them is never touched.
const pen = (name: string, hint: string, pattern: RegExp, cls: string): TokenizerAndRendererExtension => ({
  name,
  level: "inline",
  start(src: string) {
    const i = src.indexOf(hint);
    return i < 0 ? undefined : i;
  },
  tokenizer(src: string) {
    const m = pattern.exec(src);
    if (!m) return undefined;
    return { type: name, raw: m[0], tokens: this.lexer.inlineTokens(m[1]!) };
  },
  renderer(token: Tokens.Generic) {
    return `<mark class="pen ${cls}">${this.parser.parseInline(token.tokens!)}</mark>`;
  },
});

marked.use({
  extensions: [
    pen("penU", "==", /^==([^=\n]+?)==/, "pen-u"),
    pen("penO", "((", /^\(\(([^()\n]+?)\)\)/, "pen-o"),
  ],
});

/** Render digest markdown to HTML with raw-html neutralized. */
export const renderMarkdown = (md: string): string => marked.parse(md) as string;
