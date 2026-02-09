
# Plan: Mejoras UI/UX - Densidad, Detalle, Calendario y Switch Deportes

## 1) Detalle de Evento -- Localizacion sin "..."

**Archivo:** `src/pages/EventDetailPage.tsx`

**Problema:** En la tarjeta de venue (lineas 213-220), el nombre usa `truncate` que corta textos largos como "Teatro del Soho CaixaBank".

**Solucion:** Quitar `truncate` del venue name y del address, permitir wrap en 2 lineas con `line-clamp-2`. Reducir font-size si es largo no es necesario si permitimos wrap.

**Cambios concretos:**
- Linea 217: cambiar `<p className="text-sm font-medium truncate">` a `<p className="text-sm font-medium line-clamp-2">`
- Linea 218: cambiar `<p className="text-xs text-muted-foreground truncate">` a `<p className="text-xs text-muted-foreground line-clamp-2">`
- Quitar `min-w-0` del div padre si ya no hace falta (se puede mantener por seguridad)

---

## 2) Inicio -- "Hoy" y "Este fin de semana" en grid 2 columnas

**Archivo:** `src/pages/Index.tsx`

**Problema:** Actualmente los eventos se muestran en scroll horizontal con tarjetas de 280px. Se quiere un grid de 2 columnas mas denso.

**Solucion:** Cambiar el layout de scroll horizontal a un grid responsive de 2 columnas. Usar `EventCard` con prop `compact` para tarjetas mas densas.

**Cambios concretos (seccion "Today Events", lineas 139-158):**
- Reemplazar `<div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">` por `<div className="grid grid-cols-2 gap-3">`
- Quitar los wrappers `<div className="min-w-[280px] max-w-[280px]">`
- Pasar `compact` a `EventCard` para tarjetas mas pequenas
- Mismos cambios para la seccion "Weekend Events" (lineas ~175-200)
- En los skeletons, hacer lo mismo: grid 2 columnas

**Nuevo componente `EventCardCompact`:** No es necesario un componente nuevo. Se creara una variante dentro de `EventCard` o se usara directamente el prop `compact` existente. Sin embargo, el `compact` actual es un layout horizontal (flex-row). Necesitamos un layout vertical pero mas pequeno.

Se ajustara `EventCard` para que cuando no sea `compact`, pero este en el grid de inicio, use menos padding:
- Alternativa mejor: crear una nueva prop `dense` en `EventCard` que reduzca padding, titulo a 1 linea, y quite tags.

**Cambios en `EventCard.tsx`:**
- Anadir prop `dense?: boolean`
- Cuando `dense`:
  - Imagen mas pequena (aspect ratio mas corto)
  - Titulo `line-clamp-1` en vez de `line-clamp-2`
  - Quitar tags
  - Menos padding (`p-2` en vez de `p-3`)
  - Quitar badge de categoria
  - Fecha + venue en formato compacto (una linea)

---

## 3) Eventos -- Listado denso 2 columnas

**Archivo:** `src/pages/EventsPage.tsx`

**Problema:** Actualmente muestra tarjetas apiladas verticalmente (1 por linea, `space-y-4`).

**Solucion:** Cambiar a grid de 2 columnas, usando `EventCard` con prop `dense`.

**Cambios concretos (lineas 248-258):**
- Reemplazar `<div className="space-y-4">` por `<div className="grid grid-cols-2 gap-3">`
- Pasar `dense` a cada `EventCard`

---

## 4) Calendario -- Vista lista respeta dia seleccionado

**Archivo:** `src/pages/CalendarPage.tsx`

**Problema:** Al cambiar a vista lista (lineas 362-391), se muestran `uniqueEventsForList` que son TODOS los eventos del mes, ignorando `selectedDate`.

**Solucion:** Cuando se cambia a vista lista, filtrar `filteredOccurrences` por `selectedDate` si hay uno seleccionado.

**Cambios concretos:**
- Modificar el bloque de vista lista (linea 362+) para usar `selectedDayOccurrences` en vez de `filteredOccurrences` cuando `selectedDate` no es null
- Mostrar el dia seleccionado como titulo en la vista lista
- Si no hay eventos ese dia, mostrar empty state con mensaje claro

**Codigo:**
```typescript
// En la vista lista:
const listOccurrences = selectedDate ? selectedDayOccurrences : filteredOccurrences;
```

Y en el JSX de la vista lista, mostrar:
```
{selectedDate && (
  <h3 className="font-semibold capitalize">
    {format(selectedDate, "EEEE d 'de' MMMM", { locale })}
  </h3>
)}
```

---

## 5) Inicio -- Switch Eventos / Deportes

**Archivos nuevos:**
- `src/types/sports.ts` -- tipo `SportEvent` y datos mock
- `src/components/sports/SportEventCard.tsx` -- tarjeta de deporte
- `src/components/sports/SportsContent.tsx` -- contenido de la seccion Deportes

**Archivo modificado:** `src/pages/Index.tsx`

### 5a) Tipo SportEvent (`src/types/sports.ts`)

```typescript
export interface SportEvent {
  id: string;
  sport: string;
  title: string;
  teams?: string;
  competition: string;
  start_at: string;
  venue: string;
  city: string;
  ticketsUrl?: string;
  imageUrl?: string;
}

export const SPORT_CATEGORIES = [
  'futbol', 'baloncesto', 'futsal', 'balonmano', 
  'atletismo', 'motor', 'tenis', 'otros'
] as const;

export const MOCK_SPORT_EVENTS: SportEvent[] = [
  {
    id: 'sp1',
    sport: 'futbol',
    title: 'Malaga CF vs Cadiz CF',
    teams: 'Malaga CF - Cadiz CF',
    competition: 'LaLiga Hypermotion',
    start_at: '2026-02-14T18:30:00',
    venue: 'Estadio La Rosaleda',
    city: 'Malaga',
    ticketsUrl: 'https://malagacf.com/entradas',
  },
  // ... 8-10 mas (baloncesto, futsal, balonmano, etc.)
];
```

### 5b) SportEventCard (`src/components/sports/SportEventCard.tsx`)

Tarjeta compacta con:
- Icono del deporte + nombre de competicion (badge)
- Titulo/equipos (bold)
- Hora + Recinto en una linea
- Boton "Entradas" o "Info"

### 5c) SportsContent (`src/components/sports/SportsContent.tsx`)

Seccion con:
- Chips de deportes para filtrar
- "Hoy" (deportes mock filtrados)
- "Este finde" (deportes mock filtrados)
- Tarjetas en grid de 2 columnas (consistente con eventos)

### 5d) Modificaciones en Index.tsx

- Quitar el titulo "Malaga Events" y reemplazar por un segmented control:
  ```
  [Eventos] [Deportes]
  ```
- Anadir estado `const [mode, setMode] = useState<'events' | 'sports'>('events');`
- Renderizar condicionalmente: si `mode === 'events'` mostrar todo lo actual, si `mode === 'sports'` mostrar `<SportsContent />`
- El header (gradiente, search, theme/language) se mantiene igual en ambos modos
- El segmented control se coloca donde estaba el titulo "Malaga Events"

---

## Resumen de archivos

| Archivo | Cambios |
|---------|---------|
| `src/pages/EventDetailPage.tsx` | Quitar truncate en venue name/address |
| `src/components/events/EventCard.tsx` | Anadir prop `dense` para tarjetas compactas |
| `src/pages/Index.tsx` | Grid 2 col + switch Eventos/Deportes |
| `src/pages/EventsPage.tsx` | Grid 2 col con `dense` |
| `src/pages/CalendarPage.tsx` | Vista lista filtra por dia seleccionado |
| `src/types/sports.ts` | **NUEVO** - tipos y mock data deportes |
| `src/components/sports/SportEventCard.tsx` | **NUEVO** - tarjeta de deporte |
| `src/components/sports/SportsContent.tsx` | **NUEVO** - contenido seccion deportes |

---

## Seccion tecnica: prop `dense` en EventCard

```typescript
interface EventCardProps {
  event: Event;
  isFavorite?: boolean;
  onToggleFavorite?: (eventId: string) => void;
  compact?: boolean;
  dense?: boolean;  // NUEVO
}
```

Cuando `dense === true`:
- Imagen con aspect-ratio mas corto (3:2 en vez de 16:9)
- CardContent con `p-2`
- Titulo: `text-sm font-semibold line-clamp-1`
- Sin badge de categoria
- Fecha y venue en una sola linea: `"Lun 10 Feb · 20:00 · Teatro Cervantes"`
- Sin tags
- Sin boton de favorito (para ahorrar espacio, o version mini)

---

## Checklist de validacion

- [ ] Detalle: venue name completo sin "..." (probar "Teatro del Soho CaixaBank")
- [ ] Inicio: Hoy y Este finde muestran 2 columnas
- [ ] Eventos: listado en 2 columnas densas
- [ ] Calendario: cambiar a lista mantiene el dia seleccionado
- [ ] Calendario: dia sin eventos en lista muestra empty state
- [ ] Switch Eventos/Deportes funciona sin glitches
- [ ] Deportes muestra datos mock con chips de filtro
- [ ] Alternar 20 veces entre Eventos/Deportes sin problemas
