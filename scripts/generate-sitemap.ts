// Runs before `vite dev` and `vite build`; writes public/sitemap.xml.
import { writeFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const BASE_URL = "https://malagaevents.lovable.app";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/events", changefreq: "daily", priority: "0.9" },
  { path: "/calendar", changefreq: "daily", priority: "0.8" },
  { path: "/pharmacies", changefreq: "daily", priority: "0.8" },
  { path: "/venues", changefreq: "weekly", priority: "0.7" },
  { path: "/map", changefreq: "weekly", priority: "0.7" },
  { path: "/submit-event", changefreq: "monthly", priority: "0.4" },
];

async function fetchEventEntries(): Promise<SitemapEntry[]> {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    console.warn("Supabase env vars missing; skipping dynamic event entries.");
    return [];
  }
  const supabase = createClient(url, key);
  const entries: SitemapEntry[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("events")
      .select("id, updated_at")
      .eq("status", "published")
      .range(from, from + pageSize - 1);
    if (error) {
      console.warn("Failed to fetch events for sitemap:", error.message);
      break;
    }
    if (!data || data.length === 0) break;
    for (const row of data) {
      entries.push({
        path: `/events/${row.id}`,
        lastmod: row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : undefined,
        changefreq: "weekly",
        priority: "0.6",
      });
    }
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return entries;
}

function generateSitemap(entries: SitemapEntry[]) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

(async () => {
  const dynamic = await fetchEventEntries();
  const all = [...staticEntries, ...dynamic];
  writeFileSync(resolve("public/sitemap.xml"), generateSitemap(all));
  console.log(`sitemap.xml written (${all.length} entries)`);
})();
