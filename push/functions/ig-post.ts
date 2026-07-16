// Scheduled trigger only: the real work runs in ig-post-background, whose
// 15-minute budget fits Meta's per-image server-side fetches (a synchronous
// function's ~10s limit does not).
export default async (): Promise<void> => {
  const res = await fetch("https://sift-push.netlify.app/.netlify/functions/ig-post-background", {
    method: "POST",
  });
  console.log(JSON.stringify({ triggered: res.status }));
};

export const config = { schedule: "*/15 4-6,16-18 * * *" };
