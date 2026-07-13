// Shared CSV parser for cultural ingestion adapters.
//
// Tolerates:
// - UTF-8 BOM
// - Quoted fields (") with embedded newlines and doubled quotes ""
// - Auto-detects `;` vs `,` separator from the header line
// - CRLF and LF line endings
//
// Returns an array of records keyed by header name. No third-party deps.

export type CsvRow = Record<string, string>;

export interface CsvParseOptions {
  /** Force a separator instead of auto-detecting. */
  separator?: "," | ";" | "\t";
  /** Max rows to parse (safety guard for adapters). */
  maxRows?: number;
}

function stripBOM(input: string): string {
  return input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
}

function detectSeparator(headerLine: string): "," | ";" | "\t" {
  const semis = (headerLine.match(/;/g) ?? []).length;
  const commas = (headerLine.match(/,/g) ?? []).length;
  const tabs = (headerLine.match(/\t/g) ?? []).length;
  if (tabs > semis && tabs > commas) return "\t";
  if (semis >= commas) return ";";
  return ",";
}

/**
 * Robust CSV tokenizer — handles quoted fields with embedded separators
 * and newlines, and doubled quotes as a literal quote.
 */
function tokenize(text: string, sep: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === sep) {
      row.push(field);
      field = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      // Handle CRLF as single newline
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += ch;
  }
  // Flush trailing field
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parseCsv(text: string, options: CsvParseOptions = {}): CsvRow[] {
  const cleaned = stripBOM(text);
  const firstNewline = cleaned.search(/\r?\n/);
  const headerLine = firstNewline === -1 ? cleaned : cleaned.slice(0, firstNewline);
  const sep = options.separator ?? detectSeparator(headerLine);

  const tokens = tokenize(cleaned, sep);
  if (tokens.length === 0) return [];

  const header = tokens[0].map((h) => h.trim());
  const rowsRaw = tokens.slice(1);
  const max = options.maxRows ?? rowsRaw.length;

  const out: CsvRow[] = [];
  for (let i = 0; i < rowsRaw.length && out.length < max; i++) {
    const cells = rowsRaw[i];
    // Skip trailing empty lines
    if (cells.length === 1 && cells[0].trim() === "") continue;
    const rec: CsvRow = {};
    for (let c = 0; c < header.length; c++) {
      rec[header[c]] = (cells[c] ?? "").trim();
    }
    out.push(rec);
  }
  return out;
}

/**
 * Fetch a CSV file with timeout + retry + light backoff.
 * Returns the parsed rows plus response headers relevant to caching.
 */
export async function fetchCsv(
  url: string,
  init: RequestInit = {},
  opts: { timeoutMs?: number; retries?: number; maxRows?: number } = {},
): Promise<{ rows: CsvRow[]; etag: string | null; lastModified: string | null }> {
  const timeoutMs = opts.timeoutMs ?? 20000;
  const retries = opts.retries ?? 2;
  let attempt = 0;
  let lastErr: unknown = null;
  while (attempt <= retries) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        ...init,
        signal: ctrl.signal,
        headers: {
          "User-Agent": "MalagaEventsBot/1.0 (+https://malagaevents.lovable.app)",
          Accept: "text/csv,text/plain;q=0.9,*/*;q=0.5",
          ...(init.headers ?? {}),
        },
      });
      clearTimeout(t);
      if (!res.ok) throw new Error(`http_${res.status}`);
      const body = await res.text();
      const rows = parseCsv(body, { maxRows: opts.maxRows });
      return {
        rows,
        etag: res.headers.get("etag"),
        lastModified: res.headers.get("last-modified"),
      };
    } catch (err) {
      clearTimeout(t);
      lastErr = err;
      attempt++;
      if (attempt > retries) break;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("csv_fetch_failed");
}
