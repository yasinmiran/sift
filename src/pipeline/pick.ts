import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { applyPick, ensureScheme, pickDay, readPicks } from "./picks";

// Records a hand-found link from the command line (CLI: npm run pick --
// <url> [note...]); the issue-driven picks workflow writes the same file.
const invokedDirectly = process.argv[1]?.endsWith("pick.ts");
if (invokedDirectly) {
  const [urlArg, ...noteParts] = process.argv.slice(2);
  if (!urlArg) {
    console.error("usage: npm run pick -- <url> [note...]");
    process.exit(1);
  }
  const url = ensureScheme(urlArg);
  const note = noteParts.join(" ").trim();
  const addedAt = new Date().toISOString();
  const day = pickDay(addedAt);
  const root = resolve(".");
  const { picks, added } = applyPick(readPicks(root, day), day, {
    url,
    ...(note ? { note } : {}),
    addedAt,
  });
  if (added) {
    mkdirSync(join(root, "data", "picks"), { recursive: true });
    writeFileSync(join(root, "data", "picks", `${day}.json`), `${JSON.stringify(picks, null, 2)}\n`);
  }
  console.log(JSON.stringify({ day, url, added }));
}
