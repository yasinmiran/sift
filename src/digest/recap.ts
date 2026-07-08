import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { today } from "../day";
import { parseFrontmatter } from "./frontmatter";

export interface Recap {
  day: string;
  description: string;
  lead: string;
}

// The bounded yesterday-context for continuity callbacks: the latest earlier
// day's description and lead paragraph, deliberately nothing else, so the
// digest routine cannot over-read and confabulate (CLI: npm run recap -- day).
export function recap(rootDir: string, day: string): Recap | null {
  const dir = join(rootDir, "digests");
  if (!existsSync(dir)) return null;
  const prev = readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f) && f.slice(0, 10) < day)
    .sort()
    .at(-1);
  if (!prev) return null;
  const { meta, body } = parseFrontmatter(readFileSync(join(dir, prev), "utf8"));
  const lead = body.trim().split(/\n\s*\n/)[0]?.trim() ?? "";
  return { day: prev.slice(0, 10), description: meta?.description ?? "", lead };
}

const invokedDirectly = process.argv[1]?.endsWith("recap.ts");
if (invokedDirectly) {
  console.log(JSON.stringify(recap(resolve("."), process.argv[2] ?? today()), null, 2));
}
