

# Plan: Hotfix iPhone + Favoritos + Modo Deportes completo + Recintos

## A) Detalle de Evento -- iPhone sin "..." (WRAP obligatorio)

**Archivo:** `src/pages/EventDetailPage.tsx` (lineas 219-227)

El problema es que `line-clamp-2` sigue usando `-webkit-line-clamp` que en iOS Safari puede seguir truncando. La solucion es eliminar `line-clamp-2` completamente y usar estilos de wrap puro.

**Cambios:**
- Linea 225: `<p className="text-sm font-medium line-clamp-2">` cambia a `<p className="text-sm font-medium break-words" style={{ overflowWrap: 'anywhere' }}>`
- Linea 226: `<p className="text-xs text-muted-foreground line-clamp-2">` cambia a `<p className="text-xs text-muted-foreground break-words" style={{ overflowWrap: 'anywhere' }}>`
- Quitar `min-w-0` del div padre (linea 224) -- aunque se puede dejar por seguridad
- Asegurar que el contenedor padre no tiene `overflow: hidden` que corte

---

## B) Mis Favoritos -- Solo favoritos marcados

**Situacion actual:** En `EventsPage.tsx` ya existe un filtro `onlyFavorites` en `FilterDrawer` que usa `useFavoriteEvents()`. Esto funciona correctamente: cuando se activa, muestra solo favoritos del usuario.

**Revision necesaria:** Verificar que `useFavoriteEvents` (lineas 27-53 de `useFavorites.ts`) solo devuelve eventos que el usuario ha marcado. El codigo actual hace `select` de la tabla `favorites` filtrado por `user_id` y hace join con `events`. Esto es correcto.

**Cambios necesarios:** Ninguno funcional. El sistema ya filtra correctamente. Solo hay que asegurar que:
- Si la lista esta vacia, se muestre estado vacio elegante (ya existe via `EmptyState`)
- Si un evento referenciado ya no existe, el `.filter(Boolean)` en linea 49 ya lo descarta

**Conclusion:** B ya funciona correctamente. No requiere cambios de codigo.

---

## C) Modo Deportes -- Switch global con tema diferenciado

**Objetivo:** Cuando se activa "Deportes" en Inicio, la app entra en un modo visual diferente. El BottomNav cambia (oculta Farmacias, muestra Recintos).

### C1) Estado global `appMode`

**Nuevo archivo:** `src/contexts/AppModeContext.tsx`

```typescript
// Contexto con estado 'eventos' | 'deportes'
// Persistido en localStorage
// Provider envuelve toda la app
```

### C2) Tema deportivo via CSS

**Archivo:** `src/index.css`

Anadir clase `.sports-mode` con variables CSS diferenciadas:
- Primary: verde deportivo (142 71% 45% aprox)
- Secondary: azul oscuro (220 60% 35%)
- Accent: amarillo/dorado (45 90% 50%)
- Header gradient: tonos verdes/azules en vez de slate/blue/indigo

### C3) Aplicar tema en root

**Archivo:** `src/App.tsx`
- Importar `AppModeProvider` y envolver la app
- Anadir `data-mode` attribute al root basado en `appMode`

**Archivo:** `src/pages/Index.tsx`
- Usar `useAppMode()` en vez de estado local `mode`
- El switch ya existente (`[Eventos] [Deportes]`) actualizara el contexto global

### C4) BottomNav adaptativo

**Archivo:** `src/components/layout/BottomNav.tsx`
- Importar `useAppMode()`
- Cuando `appMode === 'deportes'`:
  - Ocultar tab "Farmacias"
  - Mostrar tab "Recintos" (icono `Building2` o `MapPin`)
  - Ruta: `/recintos` (nueva) o renderizar inline

---

## D) Filtros rapidos en Deportes (Hoy / Este finde / Proximos)

**Archivo:** `src/components/sports/SportsContent.tsx`

Anadir segmented control antes de los chips de deporte:

```
[Hoy] [Este finde] [Proximos 14d]
```

**Logica de filtrado** (Europe/Madrid timezone):
- Hoy: `isToday(date)` con timezone
- Este finde: viernes-domingo logica ya existente
- Proximos: proximos 14 dias desde hoy

**Cambios:**
- Anadir estado `timeFilter: 'today' | 'weekend' | 'upcoming'` (default: 'upcoming')
- Filtrar `MOCK_SPORT_EVENTS` segun el filtro seleccionado
- Estados vacios controlados

---

## E) Scroll fluido iOS en toda la app

**Archivo:** `src/index.css`

Ya existe la base (lineas 124-149). Ampliar:

```css
/* Aplicar a todos los scroll containers */
.overflow-y-auto, .overflow-x-auto, [class*="scroll"] {
  -webkit-overflow-scrolling: touch;
}
```

**Archivos adicionales** (donde haya scroll containers):
- `src/pages/CalendarPage.tsx`: verificar que la lista usa `ios-scroll`
- `src/pages/EventsPage.tsx`: el grid principal ya tiene scroll del body
- Popovers: ya tienen `ScrollArea` de Radix que maneja esto

No se necesitan cambios grandes; la base CSS ya existe.

---

## F) Tema Deportes -- Colores diferenciados

**Archivo:** `src/index.css`

```css
/* Sports mode theme override */
[data-mode="deportes"] {
  --primary: 142 71% 45%;        /* Verde deportivo */
  --primary-foreground: 0 0% 100%;
  --secondary: 220 60% 35%;      /* Azul oscuro */
  --ring: 142 71% 45%;
}

[data-mode="deportes"].dark {
  --primary: 142 65% 50%;
  --primary-foreground: 220 25% 10%;
  --secondary: 220 50% 45%;
  --ring: 142 65% 50%;
}
```

**Archivo:** `src/pages/Index.tsx`
- Cambiar gradiente del header cuando en modo deportes:
  - Eventos: `from-slate-900 via-blue-900 to-indigo-800` (actual)
  - Deportes: `from-emerald-900 via-green-800 to-teal-700`

---

## G) Nueva seccion "Recintos" (MVP)

### G1) Datos mock de recintos

**Nuevo archivo:** `src/types/venues-sports.ts`

```typescript
export interface SportVenue {
  id: string;
  name: string;
  sport: string[];   // deportes que alberga
  city: string;
  address?: string;
  lat?: number;
  lng?: number;
  mapUrl?: string;
}

export const MOCK_SPORT_VENUES: SportVenue[] = [
  { id: 'v1', name: 'Estadio La Rosaleda', sport: ['futbol'], city: 'Malaga', address: 'Paseo de Martiricos, s/n', lat: 36.7304, lng: -4.4312 },
  { id: 'v2', name: 'Palacio de Deportes Martin Carpena', sport: ['baloncesto', 'balonmano'], city: 'Malaga', address: 'Avda. Jose Ortega y Gasset, 143' },
  { id: 'v3', name: 'Pabellon Universitario', sport: ['futsal', 'baloncesto'], city: 'Malaga' },
  { id: 'v4', name: 'Ciudad de Malaga', sport: ['balonmano'], city: 'Malaga' },
  { id: 'v5', name: 'Estadio El Mauli', sport: ['futbol'], city: 'Antequera' },
  { id: 'v6', name: 'Club de Tenis Puente Romano', sport: ['tenis'], city: 'Marbella' },
  // ... mas recintos
];
```

### G2) Pagina/componente de Recintos

**Nuevo archivo:** `src/pages/VenuesPage.tsx`

- Listado simple de cards con: nombre, ciudad, deportes (badges), boton "Ver en mapa"
- Filtro basico por deporte (chips)
- Buscador interno simple (input sin autofocus en movil)
- Solo visible cuando `appMode === 'deportes'`

### G3) Ruta nueva

**Archivo:** `src/App.tsx`
- Anadir ruta `/venues` dentro de `MainLayout`
- Importar `VenuesPage`

---

## Resumen de archivos

| Archivo | Cambios |
|---------|---------|
| `src/pages/EventDetailPage.tsx` | Quitar line-clamp, usar break-words + overflowWrap |
| `src/index.css` | Tema deportes CSS vars + scroll utilities |
| `src/contexts/AppModeContext.tsx` | **NUEVO** - contexto global appMode |
| `src/App.tsx` | Envolver con AppModeProvider, anadir ruta /venues |
| `src/pages/Index.tsx` | Usar contexto global para switch, gradiente condicional |
| `src/components/layout/BottomNav.tsx` | Tabs adaptativas segun appMode |
| `src/components/layout/MainLayout.tsx` | Aplicar data-mode attribute |
| `src/components/sports/SportsContent.tsx` | Filtros rapidos Hoy/Finde/Proximos |
| `src/types/venues-sports.ts` | **NUEVO** - tipos y mock de recintos |
| `src/pages/VenuesPage.tsx` | **NUEVO** - listado de recintos deportivos |

---

## Checklist de validacion

- [ ] iPhone Safari: venue/localizacion completa con wrap, sin "..."
- [ ] Favoritos: solo muestra favoritos del usuario, empty state correcto
- [ ] Switch Deportes: cambia tema (colores verdes/deportivos)
- [ ] BottomNav en Deportes: Farmacias oculta, Recintos visible
- [ ] Filtros deportes: Hoy / Este finde / Proximos funcionan
- [ ] Scroll fluido iOS en listas y popovers
- [ ] Volver a Eventos: tema original, Farmacias vuelve
- [ ] Buscar no se activa al abrir desplegables (no regresion)

