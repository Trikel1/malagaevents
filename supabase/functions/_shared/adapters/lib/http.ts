// Shared safe-fetch helper for cultural ingestion adapters.
//
// Guarantees:
// - Hard timeout via AbortController (default 20s).
// - Byte-size ceiling read incrementally so a hostile server cannot exhaust
//   memory (default 5 MB). Aborts as soon as the ceiling is exceeded.
// - Bounded retries with exponential backoff for transient failures.
// - Native fetch redirect following (browser default = max 20 hops); we clamp
//   further to `maxRedirects` (default 5) by using `redirect: "manual"` and
//   re-issuing the request ourselves, so a redirect loop can never hang.
// - No third-party dependencies. Runs in Deno (edge functions) AND Node
//   (vitest) — both expose a WHATWG fetch, AbortController and TextDecoder.
//
// This module is intentionally free of Deno-specific globals so it can be
// unit-tested from vitest without any polyfill.

export const DEFAULT_USER_AGENT =
  "MalagaEventsBot/1.0 (+https://malagaevents.lovable.app)";

export interface SafeFetchOptions {
  /** Milliseconds before the request is aborted. */
  timeoutMs?: number;
  /** Retries on network error / 5xx / timeout. */
  retries?: number;
  /** Max bytes to read from the body. Aborts if exceeded. */
  maxBytes?: number;
  /** Max redirect hops we will follow ourselves. */
  maxRedirects?: number;
  /** Value of the `Accept` header. */
  accept?: string;
  /** Extra headers merged on top of defaults. */
  headers?: Record<string, string>;
  /** Force HTTP method (default GET). */
  method?: string;
  /** Request body (rare in ingestion, but supported). */
  body?: BodyInit | null;
}

export interface SafeFetchResult {
  status: number;
  finalUrl: string;
  body: string;
  bytes: number;
  headers: Headers;
  redirects: number;
}

export class SafeFetchError extends Error {
  readonly code:
    | "timeout"
    | "too_large"
    | "too_many_redirects"
    | "bad_redirect"
    | "http_error"
    | "network_error";
  readonly status?: number;
  constructor(
    code: SafeFetchError["code"],
    message: string,
    status?: number,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = "SafeFetchError";
  }
}

const DEFAULTS = {
  timeoutMs: 20000,
  retries: 2,
  maxBytes: 5 * 1024 * 1024,
  maxRedirects: 5,
};

function shouldRetry(status: number | undefined, code?: string): boolean {
  if (code === "network_error" || code === "timeout") return true;
  if (status && status >= 500 && status < 600) return true;
  if (status === 429) return true;
  return false;
}

async function readCapped(
  res: Response,
  maxBytes: number,
): Promise<{ body: string; bytes: number }> {
  // Try the fast path when we already know the size is safe.
  const cl = Number(res.headers.get("content-length") ?? "");
  if (Number.isFinite(cl) && cl > 0 && cl > maxBytes) {
    // Discard the body to free the connection before throwing.
    try {
      await res.body?.cancel();
    } catch {
      /* ignore */
    }
    throw new SafeFetchError(
      "too_large",
      `response body ${cl}B exceeds cap ${maxBytes}B`,
    );
  }

  if (!res.body) {
    const text = await res.text();
    if (text.length > maxBytes) {
      throw new SafeFetchError("too_large", "response body exceeds cap");
    }
    return { body: text, bytes: text.length };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let total = 0;
  let out = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      throw new SafeFetchError(
        "too_large",
        `response body exceeded ${maxBytes}B cap`,
      );
    }
    out += decoder.decode(value, { stream: true });
  }
  out += decoder.decode();
  return { body: out, bytes: total };
}

/**
 * Fetch a resource with strict safety caps. Follows redirects manually so
 * the redirect budget is enforced regardless of platform defaults.
 */
export async function safeFetch(
  url: string,
  opts: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULTS.timeoutMs;
  const retries = opts.retries ?? DEFAULTS.retries;
  const maxBytes = opts.maxBytes ?? DEFAULTS.maxBytes;
  const maxRedirects = opts.maxRedirects ?? DEFAULTS.maxRedirects;
  const method = opts.method ?? "GET";

  const baseHeaders: Record<string, string> = {
    "User-Agent": DEFAULT_USER_AGENT,
    ...(opts.accept ? { Accept: opts.accept } : {}),
    ...(opts.headers ?? {}),
  };

  let attempt = 0;
  let lastErr: unknown = null;

  while (attempt <= retries) {
    let currentUrl = url;
    let redirects = 0;
    const ctrl = new AbortController();
    const timer = setTimeout(
      () => ctrl.abort(new SafeFetchError("timeout", "request timed out")),
      timeoutMs,
    );

    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await fetch(currentUrl, {
          method,
          body: opts.body ?? undefined,
          headers: baseHeaders,
          redirect: "manual",
          signal: ctrl.signal,
        });

        // Manual redirect handling: 3xx with a Location header.
        if (res.status >= 300 && res.status < 400) {
          const loc = res.headers.get("location");
          try {
            await res.body?.cancel();
          } catch {
            /* ignore */
          }
          if (!loc) {
            throw new SafeFetchError(
              "bad_redirect",
              `redirect ${res.status} without Location`,
              res.status,
            );
          }
          redirects++;
          if (redirects > maxRedirects) {
            throw new SafeFetchError(
              "too_many_redirects",
              `exceeded ${maxRedirects} redirects`,
            );
          }
          currentUrl = new URL(loc, currentUrl).toString();
          continue;
        }

        if (!res.ok) {
          try {
            await res.body?.cancel();
          } catch {
            /* ignore */
          }
          throw new SafeFetchError(
            "http_error",
            `http_${res.status}`,
            res.status,
          );
        }

        const { body, bytes } = await readCapped(res, maxBytes);
        clearTimeout(timer);
        return {
          status: res.status,
          finalUrl: currentUrl,
          body,
          bytes,
          headers: res.headers,
          redirects,
        };
      }
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      const isSafe = err instanceof SafeFetchError;
      const code = isSafe ? err.code : "network_error";
      const status = isSafe ? err.status : undefined;

      // Non-retryable safety errors: don't burn retries.
      if (
        isSafe &&
        (code === "too_large" ||
          code === "too_many_redirects" ||
          code === "bad_redirect")
      ) {
        throw err;
      }

      if (!shouldRetry(status, code)) {
        throw err instanceof Error
          ? err
          : new SafeFetchError("network_error", String(err));
      }

      attempt++;
      if (attempt > retries) break;
      await new Promise((r) => setTimeout(r, 400 * Math.pow(2, attempt)));
    }
  }

  if (lastErr instanceof Error) throw lastErr;
  throw new SafeFetchError("network_error", "fetch failed after retries");
}
