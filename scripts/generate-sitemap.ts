import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://webmarcas.net";

interface Entry { path: string; changefreq?: string; priority?: string; lastmod?: string }

// Static public routes (admin/cliente excluded — auth-only)
const staticEntries: Entry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/registrar", changefreq: "weekly", priority: "0.9" },
  { path: "/registro", changefreq: "monthly", priority: "0.7" },
  { path: "/registro-blockchain", changefreq: "monthly", priority: "0.6" },
  { path: "/verificar-contrato", changefreq: "monthly", priority: "0.5" },
  { path: "/status-pedido", changefreq: "monthly", priority: "0.4" },
  { path: "/blog", changefreq: "weekly", priority: "0.8" },
  { path: "/politica-de-privacidade", changefreq: "yearly", priority: "0.3" },
  { path: "/termos-de-uso", changefreq: "yearly", priority: "0.3" },
];

async function loadBlogEntries(): Promise<Entry[]> {
  // Regex parse (blogPosts.ts uses @/ image imports that tsx can't resolve).
  try {
    const { readFileSync } = await import("fs");
    const src = readFileSync(resolve("src/data/blogPosts.ts"), "utf8");
    const entries: Entry[] = [];
    const re = /slug:\s*["'`]([^"'`]+)["'`][\s\S]*?date:\s*["'`]([^"'`]+)["'`]/g;
    let m;
    while ((m = re.exec(src)) !== null) {
      entries.push({
        path: `/blog/${m[1]}`,
        changefreq: "monthly",
        priority: "0.7",
        lastmod: m[2],
      });
    }
    return entries;
  } catch {
    return [];
  }
}

function toXml(entries: Entry[]) {
  const urls = entries.map((e) => [
    `  <url>`,
    `    <loc>${BASE_URL}${e.path}</loc>`,
    e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
    e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
    e.priority ? `    <priority>${e.priority}</priority>` : null,
    `  </url>`,
  ].filter(Boolean).join("\n"));
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

(async () => {
  const entries = [...staticEntries, ...(await loadBlogEntries())];
  writeFileSync(resolve("public/sitemap.xml"), toXml(entries));
  console.log(`sitemap.xml written (${entries.length} entries)`);
})();