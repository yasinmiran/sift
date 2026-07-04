import { existsSync, readdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { daysBefore, today } from "../day";

// The browsable archive is a rolling month; git history keeps everything.
const MAX_AGE_DAYS = 31;
const DATED = /^(\d{4}-\d{2}-\d{2})\.(md|json)$/;

export function cleanup(
  rootDir: string,
  todayDay: string,
  maxAgeDays = MAX_AGE_DAYS,
): { removed: string[] } {
  const cutoff = daysBefore(todayDay, maxAgeDays);
  const removed: string[] = [];
  for (const dir of ["digests", join("data", "items")]) {
    const abs = join(rootDir, dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs)) {
      const dated = DATED.exec(name);
      if (!dated || dated[1]! >= cutoff) continue;
      rmSync(join(abs, name));
      removed.push(join(dir, name));
    }
  }
  return { removed };
}

const invokedDirectly = process.argv[1]?.endsWith("cleanup.ts");
if (invokedDirectly) {
  console.log(JSON.stringify(cleanup(resolve("."), today())));
}
