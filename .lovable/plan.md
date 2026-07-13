## Objetivo

Cobertura i18n al 100% en los 9 idiomas soportados (ES/EN/DE/FR/IT/PT/RU/ZH/JA/AR) para todo el trabajo hecho hasta ahora, sin romper nada.

## Estado actual detectado

- ES y EN están al día (443 claves).
- DE, FR, IT, PT, RU, ZH, JA, AR: faltan 11 claves de `map.*`.
- Índice de textos aún hardcodeados en español (no cableados a `t()`):
  - `src/pages/Index.tsx`: `DISCOVER_CARDS` (6 tarjetas), `INSTITUTIONAL_CARDS` (6 tarjetas), `QUICK_ACTIONS` (Hoy / Este finde / Infantil / Cerca / Familia / Gratis), placeholder del buscador, títulos de sección ("Descubre por categoría", "Nuestra ciudad", municipios, etc.).
  - Otros archivos con literales sueltos que iré recorriendo con `rg` (VenueFilter, LocationFilter, FilterDrawer, admin panels menores).

## Plan de trabajo

### 1. Auditoría automática
- Script `node`/`python` que recorre `src/**` y lista literales JSX en español no cubiertos por `t()`, agrupados por archivo. Se usa solo como guía interna, no se commitea.

### 2. Nuevas claves canónicas en ES y EN
Añadir en `src/i18n/locales/es.json` y `en.json`, agrupadas por dominio:

```
home.hero.title
home.hero.subtitle
home.search.placeholder
home.quickActions.today | weekend | family | nearby | kids | free
home.discover.title
home.discover.cards.music.{label,copy}
home.discover.cards.theater.{label,copy}
… (festivals, museums, markets, outdoor)
home.institutional.title
home.institutional.cards.agenda.{label,copy}
… (family, pharmacies, map, province, sports)
home.city.title
home.city.zones.* / home.city.municipalities.*
```
(las claves de `events.upcomingHighlights`, `events.play`, `events.pause`, `events.today`, `events.tomorrow`, `common.free` ya existen).

### 3. Cableado en componentes
Sustituir literales por `t('...')` en:
- `src/pages/Index.tsx` (bloque principal).
- Cualquier otro archivo detectado por la auditoría con literales visibles al usuario final. No se toca lógica ni estilos.

Los arrays de tarjetas se convierten en `useMemo` que resuelven `label`/`copy` con `t()` para no romper claves estables.

### 4. Traducción a 8 idiomas restantes
- Rellenar las mismas claves nuevas en DE, FR, IT, PT, RU, ZH, JA, AR.
- Completar también las 11 claves `map.*` que faltan hoy.
- Traducciones de calidad humana, no marcadores tipo `TODO`. Mantengo nombres propios (Málaga, Cervantes, Soho, Echegaray) sin traducir.

### 5. QA
- `tsgo` (typecheck) para asegurar que no queda `t('clave.inexistente')`.
- Script de validación: para cada locale, contar claves y verificar 0 diffs respecto a ES.
- Playwright rápido: abrir `/`, cambiar a EN, FR y AR, screenshot y comprobar visualmente que no aparece español residual ni claves crudas tipo `home.hero.title`.

## Fuera de alcance

- No se toca contenido dinámico proveniente de BD (títulos de eventos, venues, categorías): esos vienen normalizados por los adaptadores.
- No se rediseña el selector de idioma ni la lógica de detección.
- No se traducen las páginas de `/admin` (uso interno).
- No se cambia la fuente ni el layout del hero (el logo ya está revertido).

## Notas técnicas

- Se respeta el patrón `t('clave', 'Fallback en español')` ya usado en el proyecto.
- AR mantiene dirección RTL heredada del sistema; no se añade CSS nuevo.
- Los tests existentes (`src/test/*`) no dependen de textos localizados, así que no requieren cambios.

¿Confirmas y ejecuto?