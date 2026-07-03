// The app has ONE canonical notion of "day": the calendar date in APP_TZ
// (default Europe/Oslo). API, clients, and agent all agree on it, so an item's
// day never depends on where the server happens to run. The math below is
// zone-correct for any IANA zone, DST included.
const appTz = (): string => process.env.APP_TZ || "Europe/Oslo";

/** Format an instant as its YYYY-MM-DD calendar day in APP_TZ. */
function toDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: appTz(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** The current calendar day in APP_TZ. */
export function today(): string {
  return toDay(new Date());
}

/** YYYY-MM-DD of the day n days before `day` (pure date math, UTC-safe). */
export function daysBefore(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d - n)).toISOString().slice(0, 10);
}
