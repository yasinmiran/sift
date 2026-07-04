import { marked } from "marked";
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

/** Render digest markdown to HTML with raw-html neutralized. */
export const renderMarkdown = (md: string): string => marked.parse(md) as string;
