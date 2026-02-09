

# Plan: Internacionalizar la seccion Deportes + Recintos (i18n)

## Diagnostico

Tras revisar todo el codigo, **las secciones A-G del prompt ya estan implementadas correctamente**:

- **A) Scroll iOS**: CSS global con `-webkit-overflow-scrolling: touch` ya aplicado
- **B) Detalle sin "..."**: `break-words` + `overflowWrap: 'anywhere'` ya en EventDetailPage
- **C) Inicio 2 columnas**: Grid `grid-cols-2` con cards `dense` ya funciona
- **D) Eventos listado denso**: Grid 2 columnas con `dense` ya implementado
- **E) Calendario lista**: Filtra por `selectedDate` con empty state correcto
- **F) Favoritos**: `useFavoriteEvents` filtra correctamente por usuario
- **G) Switch Eventos/Deportes**: `AppModeContext` global, tema CSS, BottomNav adaptativo, SportsContent con filtros, VenuesPage -- todo implementado

**El unico gap real es la seccion H: i18n.** Hay strings hardcodeadas en espanol en los componentes de Deportes y Recintos que no usan el sistema de traduccion.

---

## Cambios necesarios

### 1) Anadir claves i18n a los 9 ficheros de idioma

Anadir las siguientes claves a **todos** los locale files (`es.json`, `en.json`, `de.json`, `fr.json`, `it.json`, `pt.json`, `ja.json`, `zh.json`, `ru.json`):

```json
"nav": {
  "venues": "Recintos"
},
"sports": {
  "title": "Deportes",
  "events": "Eventos",
  "today": "Hoy",
  "thisWeekend": "Este finde",
  "upcoming": "Proximos 14d",
  "all": "Todos",
  "noEvents": "No hay eventos deportivos para este filtro",
  "futbol": "Futbol",
  "baloncesto": "Baloncesto",
  "futsal": "Futsal",
  "balonmano": "Balonmano",
  "atletismo": "Atletismo",
  "motor": "Motor",
  "tenis": "Tenis",
  "otros": "Otros",
  "tickets": "Entradas",
  "info": "Info",
  "viewOnMap": "Ver en mapa",
  "searchVenues": "Buscar recintos...",
  "allSports": "Todos",
  "venuesTitle": "Recintos deportivos",
  "noVenues": "No se encontraron recintos"
}
```

Cada idioma tendra su traduccion correspondiente.

### 2) Actualizar componentes para usar `t()`

**Archivos a modificar:**

| Archivo | Strings hardcodeadas a reemplazar |
|---------|----------------------------------|
| `src/components/layout/BottomNav.tsx` | `'Recintos'` en linea 21 |
| `src/components/sports/SportsContent.tsx` | Labels de filtros (`'Hoy'`, `'Este finde'`, `'Proximos 14d'`), `'Todos'`, texto empty state |
| `src/components/sports/SportEventCard.tsx` | `'Entradas'`, `'Info'` |
| `src/pages/VenuesPage.tsx` | `'Recintos deportivos'`, `'Buscar recintos...'`, `'Todos'`, `'Ver en mapa'`, `'No se encontraron recintos'` |
| `src/pages/Index.tsx` | `'Eventos'`, `'Deportes'` en el segmented control |

**Cambio tipo (ejemplo BottomNav):**
```typescript
// Antes:
base.push({ to: '/venues', icon: Building2, label: 'Recintos' });
// Despues:
base.push({ to: '/venues', icon: Building2, label: t('nav.venues') });
```

---

## Archivos tocados

- `src/i18n/locales/es.json` -- nuevas claves sports/nav.venues
- `src/i18n/locales/en.json` -- idem (ingles)
- `src/i18n/locales/de.json` -- idem (aleman)
- `src/i18n/locales/fr.json` -- idem (frances)
- `src/i18n/locales/it.json` -- idem (italiano)
- `src/i18n/locales/pt.json` -- idem (portugues)
- `src/i18n/locales/ja.json` -- idem (japones)
- `src/i18n/locales/zh.json` -- idem (chino)
- `src/i18n/locales/ru.json` -- idem (ruso)
- `src/components/layout/BottomNav.tsx` -- usar t()
- `src/components/sports/SportsContent.tsx` -- usar t()
- `src/components/sports/SportEventCard.tsx` -- usar t()
- `src/pages/VenuesPage.tsx` -- usar t()
- `src/pages/Index.tsx` -- usar t() para labels del switch

## Confirmaciones

- **NO se modifica el header/filtros/desplegables/buscar de la seccion Eventos culturales.**
- Todo lo demas (A-G) ya esta implementado y funcionando.
- Este cambio solo anade traduccion a strings que estaban hardcodeadas en espanol.
