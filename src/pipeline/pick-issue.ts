import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { applyPick, pickFromIssue, readPicks, type IssueLike } from "./picks";

// Thin adapter for the picks workflow: turns the triggering issue event into
// a data/picks/{day}.json entry and prints {day, url, added} for the closer.
const invokedDirectly = process.argv[1]?.endsWith("pick-issue.ts");
if (invokedDirectly) {
  const eventPath = process.argv[2] ?? process.env.GITHUB_EVENT_PATH;
  if (!eventPath) throw new Error("usage: pick-issue <github-event.json>");
  const issue = JSON.parse(readFileSync(eventPath, "utf8")).issue as IssueLike;
  const { day, ...pick } = pickFromIssue(issue);
  const root = resolve(".");
  const { picks, added } = applyPick(readPicks(root, day), day, pick);
  if (added) {
    mkdirSync(join(root, "data", "picks"), { recursive: true });
    writeFileSync(join(root, "data", "picks", `${day}.json`), `${JSON.stringify(picks, null, 2)}\n`);
  }
  console.log(JSON.stringify({ day, url: pick.url, added }));
}
