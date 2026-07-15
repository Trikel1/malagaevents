// Minimal robots.txt checker for sports source scraping.
//
// - Fetches /robots.txt for a given URL host.
// - Applies rules for the most specific matching user-agent block
//   (our token first, then "*"). If both are absent, treated as allowed.
// - Longest-prefix match on Disallow/Allow (RFC-ish, common convention).
// - Never throws: unknown or unreachable robots.txt is treated as "allowed"
//   with a note; callers should still store this fact for audit.
//
// Pure module. No Deno globals; safe to import from vitest.

export interface RobotsCheck {
  allowed: boolean;
  reason: string;
  fetchedAt: string;
}

export const SPORTS_USER_AGENT = "MalagaEventsSportsBot";

type Rule = { type: "allow" | "disallow"; path: string };

function parseRobots(text: string, ua: string): Rule[] {
  const lines = text.split(/\r?\n/);
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let expectingAgents = true;

  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const field = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (field === "user-agent") {
      if (!expectingAgents) {
        current = null;
        expectingAgents = true;
      }
      if (!current) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
    } else if (field === "disallow" || field === "allow") {
      expectingAgents = false;
      if (!current) continue;
      current.rules.push({ type: field, path: value });
    }
  }

  const uaLower = ua.toLowerCase();
  const specific = groups.find((g) => g.agents.includes(uaLower));
  const wildcard = groups.find((g) => g.agents.includes("*"));
  return (specific ?? wildcard)?.rules ?? [];
}

function matchRule(rule: Rule, urlPath: string): number {
  // Empty Disallow means "no disallow"; empty Allow matches nothing meaningful.
  if (rule.type === "disallow" && rule.path === "") return -1;
  if (rule.path === "") return -1;
  // Google-style wildcard support: * = any chars, $ = end anchor.
  if (rule.path.includes("*") || rule.path.endsWith("$")) {
    const escaped = rule.path
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\\\*/g, ".*")
      .replace(/\\\$$/, "$");
    const re = new RegExp("^" + escaped);
    return re.test(urlPath) ? rule.path.length : -1;
  }
  return urlPath.startsWith(rule.path) ? rule.path.length : -1;
}

export function isAllowedByRobots(
  robotsTxt: string,
  targetUrl: string,
  ua: string = SPORTS_USER_AGENT,
): RobotsCheck {
  const fetchedAt = new Date().toISOString();
  let urlPath: string;
  try {
    const u = new URL(targetUrl);
    urlPath = u.pathname + (u.search || "");
  } catch {
    return { allowed: false, reason: "invalid_url", fetchedAt };
  }

  const rules = parseRobots(robotsTxt, ua);
  if (rules.length === 0) return { allowed: true, reason: "no_rules", fetchedAt };

  let bestAllow = -1;
  let bestDisallow = -1;
  for (const r of rules) {
    const m = matchRule(r, urlPath);
    if (m < 0) continue;
    if (r.type === "allow" && m > bestAllow) bestAllow = m;
    if (r.type === "disallow" && m > bestDisallow) bestDisallow = m;
  }
  if (bestDisallow < 0) return { allowed: true, reason: "no_disallow_match", fetchedAt };
  if (bestAllow >= bestDisallow) {
    return { allowed: true, reason: "allow_overrides_disallow", fetchedAt };
  }
  return { allowed: false, reason: "disallow_match", fetchedAt };
}

/**
 * Fetches robots.txt with strict caps and returns a decision.
 * Errors are swallowed and treated as ALLOWED with a diagnostic reason,
 * matching common conservative practice (robots absent = permitted).
 */
export async function checkRobots(
  targetUrl: string,
  ua: string = SPORTS_USER_AGENT,
): Promise<RobotsCheck> {
  const fetchedAt = new Date().toISOString();
  let robotsUrl: string;
  try {
    const u = new URL(targetUrl);
    robotsUrl = `${u.protocol}//${u.host}/robots.txt`;
  } catch {
    return { allowed: false, reason: "invalid_url", fetchedAt };
  }
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(robotsUrl, {
      headers: { "User-Agent": ua, accept: "text/plain" },
      signal: ctrl.signal,
    }).catch(() => null);
    clearTimeout(timer);
    if (!res || !res.ok) {
      // 404/5xx: treat as allowed but note it for audit.
      try { await res?.body?.cancel(); } catch { /* ignore */ }
      return { allowed: true, reason: "robots_unreachable", fetchedAt };
    }
    const text = await res.text();
    if (text.length > 200_000) {
      return { allowed: true, reason: "robots_too_large_skipped", fetchedAt };
    }
    return isAllowedByRobots(text, targetUrl, ua);
  } catch {
    return { allowed: true, reason: "robots_fetch_error", fetchedAt };
  }
}
