import { beforeEach, describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSite } from "../src/site";

let root: string;
let out: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sift-site-"));
  out = join(root, "site");
  mkdirSync(join(root, "digests"), { recursive: true });
});

const digest = (day: string, body: string) =>
  writeFileSync(
    join(root, "digests", `${day}.md`),
    `---\ntitle: "The day's tech, sifted: ${day}"\ndescription: "top story of ${day}"\ndate: "${day}"\n---\n\n${body}\n`,
  );

describe("buildSite", () => {
  it("renders an index newest-first and a page per digest", () => {
    digest("2026-07-03", "## Section\n\n- [story](https://example.com/a) why it matters");
    digest("2026-07-04", "## Later\n\ncontent");
    const { pages } = buildSite(root, out);
    expect(pages).toBe(3);
    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index.indexOf("2026-07-04")).toBeLessThan(index.indexOf("2026-07-03"));
    expect(index).toContain('href="2026-07-04.html"');
    expect(index).toContain("top story of 2026-07-03");
    const day = readFileSync(join(out, "2026-07-03.html"), "utf8");
    expect(day).toContain("<h2>Section</h2>");
    expect(day).toContain('href="https://example.com/a"');
    expect(day).toContain("The day&#39;s tech, sifted: 2026-07-03");
  });

  it("escapes raw html instead of rendering it", () => {
    digest("2026-07-04", "hello <script>alert(1)</script> world");
    buildSite(root, out);
    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).not.toContain("<script>alert");
    expect(day).toContain("&lt;script&gt;");
  });

  it("renders an empty state when there are no digests", () => {
    const { pages } = buildSite(root, out);
    expect(pages).toBe(1);
    expect(readFileSync(join(out, "index.html"), "utf8")).toContain("nothing sifted yet");
  });

  it("emits seo head tags, sitemap, robots and copies public assets", () => {
    digest("2026-07-03", "body");
    digest("2026-07-04", "body");
    mkdirSync(join(root, "public", "favicons"), { recursive: true });
    writeFileSync(join(root, "public", "favicons", "favicon.svg"), "<svg/>");
    buildSite(root, out);

    const index = readFileSync(join(out, "index.html"), "utf8");
    expect(index).toContain('<link rel="canonical" href="https://sift.yasint.dev/">');
    expect(index).toContain('<meta property="og:type" content="website">');
    expect(index).toContain('<meta name="description"');
    expect(index).toContain('href="favicons/favicon.svg"');

    const day = readFileSync(join(out, "2026-07-04.html"), "utf8");
    expect(day).toContain('<link rel="canonical" href="https://sift.yasint.dev/2026-07-04.html">');
    expect(day).toContain('<meta property="og:type" content="article">');
    expect(day).toContain('content="top story of 2026-07-04"');

    expect(readFileSync(join(out, "favicons", "favicon.svg"), "utf8")).toBe("<svg/>");

    const map = readFileSync(join(out, "sitemap.xml"), "utf8");
    expect(map).toContain("<loc>https://sift.yasint.dev/</loc>");
    expect(map).toContain("<loc>https://sift.yasint.dev/2026-07-03.html</loc>");
    expect(readFileSync(join(out, "robots.txt"), "utf8")).toContain(
      "Sitemap: https://sift.yasint.dev/sitemap.xml",
    );
  });
});
