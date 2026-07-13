
# Sprint Producto Final — Málaga Connect

Antes de tocar código quiero validar el alcance contigo porque el sprint es muy grande (8 fases, 13 rutas × 7 viewports de QA, seeds de catálogo, source discovery). Ejecutarlo entero sin priorizar quema fácilmente 150–200 créditos y arrastra el riesgo de las iteraciones anteriores del dock.

Propongo un orden realista que cabe en ~100 créditos y garantiza un producto demostrable al Ayuntamiento.

## Bloque A — Base visual sólida (prioridad máxima)

**A1. Dock definitivo (Fase 1)**
- Reescribir `BottomNav.tsx` con arquitectura local por link: cada NavLink renderiza su propio fondo activo (`z-0`) y su contenido (`z-10`) dentro de su propio contenedor. Cero pseudo-elementos compartidos, cero indicador global.
- Grid 5 columnas, tap target 56px, safe-area real (`env(safe-area-inset-bottom)`), padding lateral 12px, `max-w-md` centrado.
- Purga en `index.css` de todo lo residual: `.bottom-nav-liquid-indicator`, `::before/::after` heredados, rings sobre activo.
- QA Playwright en 320/360/390 con las 5 tabs activas; screenshots a `/tmp/browser/dock/`.

**A2. Sistema glass refinado (Fase 2)**
- En `index.css` sustituir blobs grandes por un mesh/aurora sutil (2 radial-gradients suaves, baja opacidad, sin animación agresiva).
- Reducir intensidad de `.glass-card`, `.glass-panel`, `.glass-chip` a niveles Apple-like (blur 20–24px, borde 1px `hsl / 0.08`, sombra sutil).
- Sin tocar tokens de color base.

## Bloque B — Landing institucional (Fase 3 + Fase 7)

**B1. Hero corto** en `src/pages/Index.tsx`:
- Título "Málaga Connect" + headline "Qué hacer hoy en Málaga" + subtítulo de 1 línea.
- Buscador.
- Quick actions primera pantalla: Hoy · Infantil · **Farmacias** · Mapa · Este finde · Gratis.

**B2. Reordenar secciones** (sin borrar lógica):
Familiar → Ahora en Málaga → Fiestas/Ferias/Festivales → Ciudad y provincia → Cultura viva → Deportes teaser → **"Una plataforma viva para Málaga"** (6 cards institucionales) → CTA final.

Reducción de párrafos largos, más card, menos texto.

## Bloque C — Filtros y catálogo de recintos (Fase 5, UI solamente)

**C1. Catálogo estático** en `src/lib/venuesCatalog.ts` (nuevo) con los ~25 recintos de Málaga ciudad + provincia agrupados por zona (Ciudad / Costa occidental / Axarquía / Interior). Solo constantes, cero eventos.

**C2. `VenueGroupFilter` / `LocationFilter`** — mejorar UI de agrupación por zona en dropdown, usando el catálogo. No cambio de queries si un venue no existe en DB: se muestra pero se marca "Próximamente".

**C3. Municipios prioritarios** — reemplazar `LOCALITIES` de Index.tsx por la lista completa que diste, agrupada visualmente.

## Bloque D — QA final (Fase 8, acotado)

Playwright en **3 viewports clave** (360, 390, 768) sobre **5 rutas** (`/`, `/events`, `/map`, `/pharmacies`, `/profile`). Chequeo de: `scrollWidth === innerWidth`, dock dentro del viewport, ausencia de errores de consola. Screenshots guardados. `bunx tsgo --noEmit`.

## Fuera de alcance de este sprint (te aviso explícito)

- **Fase 6 (source discovery + seeds candidatas en DB)** — requiere migración y análisis fila-a-fila de `event_sources`. Lo dejo para un sprint siguiente enfocado: es donde más fácil se rompe algo backend y donde el valor visual para el Ayuntamiento es nulo. Si lo quieres dentro, dilo y lo hago **después** del Bloque A+B+C con lo que quede de presupuesto.
- **QA en 7 viewports × 13 rutas** — el coste marginal de pasar de 3×5 a 7×13 es enorme y detecta poco más. Si quieres cobertura total, la ampliamos como fase separada.
- **Fase 4 dock con Farmacias** — descartado (rompe el grid de 5). Farmacias queda accesible desde landing + /map + ruta directa.

## Riesgos que asumo

- El diseño glass "premium" es subjetivo; me comprometo a un resultado sobrio Apple-like, no a acertar tu gusto a la primera. Si no encaja, itero UNA vez sobre tokens sin rehacer estructura.
- No toco `events`, `sports_events`, adapters, RLS, edge functions, auth, ni ingesta.

## ¿Confirmas?

Responde **"adelante"** para ejecutar A→B→C→D en ese orden, o dime qué recortar/añadir. Si quieres meter Fase 6 dentro, dímelo ahora para reordenar.
