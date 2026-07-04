const RETRY_DELAY_MS = 300;

/** One retry after a short pause: enough for the transient network blips and
 *  5xx hiccups the live runs actually hit, without turning into a backoff loop. */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return fn();
  }
}
