// One JSON line per event: the pipeline runs headless in a GitHub Action,
// so structured stdout/stderr is the whole observability story.
export const info = (msg: string, fields: Record<string, unknown>): void =>
  console.log(JSON.stringify({ level: "info", msg, ...fields }));

export const warn = (msg: string, fields: Record<string, unknown>): void =>
  console.error(JSON.stringify({ level: "warn", msg, ...fields }));
