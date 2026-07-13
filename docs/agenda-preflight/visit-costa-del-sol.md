# Preflight — Visit Costa del Sol

**Fecha**: 2026-07-13
**Fuente**: `src-visit-costa-del-sol`
**URL base**: https://www.visitacostadelsol.com/agenda
**Sitemap**: https://www.visitacostadelsol.com/base/sitemap/?site=art&idi=es
**Adapter**: `visit-costa-del-sol` (sitemap XML + Firecrawl `waitFor:3000` + parser markdown)

## Estado tras Bloque 4
- `adapter_key`: `visit-costa-del-sol` (antes `pending`).
- `enabled`: **false**.
- `robots_ok`: **false** (pendiente firma humana).
- Escrituras: **bloqueadas** por `write-auth.ts`.

## Preflight legal
- `https://www.visitacostadelsol.com/robots.txt` → **HTTP 200**. Contiene sólo `User-agent: *` + `Sitemap: /sitemap/sitemap_es.xml`. **Cero reglas `Disallow`**: allow-all.
- Aviso legal: reutilización con atribución permitida.

## Preflight técnico
- Acceso HTML directo desde el sandbox: primer intento 200, siguientes **HTTP 202 con `content-length: 0`** (CloudFront + fingerprint anti-bot). **Requiere Firecrawl** con `waitFor:3000` para forzar render del componente JS.
- **Formato canónico detectado**:
  - **Sitemap XML** listando `/agenda/<slug>-p<numericId>` — 34 eventos activos en la comprobación.
  - **Página de detalle** (via Firecrawl): título en `# H1`, localidad en `[<Municipio>](…#enlaceMapa)`, fecha en línea `- <DD MMM YYYY>` (mono o `- <DD MMM YYYY> - <DD MMM YYYY>` para rangos), imagen `arc_<n>_g.jpg`, web externa opcional (venta de entradas).
- Sin JSON-LD `Event` en el detalle (ausente por diseño del CMS ASP.NET); el parser markdown cubre todo lo necesario.

## Dry-run real
Ejecutado 2026-07-13 con `scripts/dry-run-junta-visit.ts` (`limit=3`, Firecrawl live):

- `sitemap itemsFound`: 34.
- `canonicalCount`: 3 con `externalId` prefijado `vcs-<n>`.
- `count(*) FROM events` antes = **1430**, después = **1430**. **Cero escrituras.**
- Muestra:
  - `vcs-109423` — Ritmo a Caballo — Torremolinos.
  - `vcs-109450` — Mototurismo Gaucín — Gaucín.
  - `vcs-109638` — Museos de Belenes.

## Idempotencia
Test unitario "two identical passes yield identical externalId + dedupe_key" con fixture markdown local: `dedupe_key` estable byte a byte.

## Bloqueos y notas
- No expone JSON-LD Event → parser markdown documentado en `lib/junta-visit.ts` (regex versionadas + fixtures).
- `locality` a veces aparece duplicada (`"Torremolinos, Torremolinos"`) — se mantiene tal cual (adapter no inventa datos); la deduplicación aguas abajo se apoya en `municipality_aliases`.

## Próximo paso para activar
1. Firma humana `terms_reviewed_at`.
2. `write_confirmed_at` + `write_confirmed_by`.
3. `robots_ok=true`, `enabled=true`.
4. `schedule_cron` recomendado: 1x/día (sitemap y `waitFor` consumen créditos Firecrawl).
