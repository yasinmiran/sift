// The digest file format shared by the writer contract (AGENTS.md), the
// verifier and the site renderer: a minimal ---key: "value"--- block, then
// markdown. Parsed with a regex on purpose; a YAML dependency would accept
// more than the contract allows.
const FRONT = /^---\n([\s\S]*?)\n---\n?/;

export interface DigestFile {
  meta: Record<string, string> | null;
  body: string;
}

/** Split a digest file into frontmatter and body; meta is null when the block is missing. */
export function parseFrontmatter(raw: string): DigestFile {
  const front = FRONT.exec(raw);
  if (!front) return { meta: null, body: raw };
  const meta: Record<string, string> = {};
  for (const line of front[1]!.split("\n")) {
    const kv = /^(\w+):\s*"?(.*?)"?\s*$/.exec(line);
    if (kv) meta[kv[1]!] = kv[2]!;
  }
  return { meta, body: raw.slice(front[0].length) };
}
