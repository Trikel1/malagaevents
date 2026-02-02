
# Plan: Evitar Autofocus en los Dropdowns de Salas y Teatros

## Problema

Cuando se abren los desplegables de **Salas** y **Teatros**, el cursor se posiciona automáticamente en la casilla de búsqueda, lo que en dispositivos móviles provoca que se abra el teclado virtual de forma molesta. El usuario solo quiere buscar si pulsa intencionadamente en el campo de búsqueda.

**Causa técnica:**
- El componente `Command` de la librería `cmdk` tiene autofocus habilitado por defecto
- Cuando el Popover se abre, `CommandInput` recibe el foco automáticamente
- En móviles, cualquier input con foco activa el teclado virtual

## Soluciones posibles

### Opcion A: Usar `shouldFilter={false}` + Input manual (recomendada)

Reemplazar `CommandInput` por un `Input` normal que no reciba foco automático, controlando la búsqueda manualmente.

### Opcion B: Modificar el componente `CommandInput` 

Añadir una prop `autoFocus={false}` al componente global, pero esto afectaría a todos los usos.

### Opcion C: Pasar `shouldFilter={false}` y manejar filtrado manualmente

La librería `cmdk` permite deshabilitar el filtrado automático, pero el autofocus sigue siendo un comportamiento interno.

## Solucion elegida: Input manual sin autofocus

Modificar `VenueGroupDropdown.tsx` para:

1. Reemplazar `CommandInput` por un `Input` estándar con icono de búsqueda
2. El input NO tendrá autofocus
3. Filtrar los venues localmente con el valor del input
4. Solo cuando el usuario pulse en el input, entonces recibirá foco

## Cambios en `VenueGroupDropdown.tsx`

```text
ANTES:
┌──────────────────────────────┐
│ 🔍 Buscar...                 │  ← Autofocus al abrir
├──────────────────────────────┤
│ [x] Todas las salas          │
│ [ ] Paris 15                 │
│ [ ] La Cochera               │
└──────────────────────────────┘

DESPUES:
┌──────────────────────────────┐
│ 🔍 Buscar...                 │  ← Sin autofocus (foco solo si se pulsa)
├──────────────────────────────┤
│ [x] Todas las salas          │
│ [ ] Paris 15                 │
│ [ ] La Cochera               │
└──────────────────────────────┘
```

### Implementacion tecnica

1. Añadir estado para la búsqueda local: `const [searchQuery, setSearchQuery] = useState('')`
2. Reemplazar `CommandInput` por un `Input` con `autoFocus={false}` (o sin la prop, ya que false es el default)
3. Filtrar los venues en el `useMemo` basándose en `searchQuery`
4. Limpiar el search query cuando se cierre el popover

### Codigo clave

```typescript
// Estado para búsqueda
const [searchQuery, setSearchQuery] = useState('');

// Limpiar al cerrar
const handleOpenChange = (open: boolean) => {
  setOpen(open);
  if (!open) setSearchQuery('');
};

// Filtrar venues localmente
const filteredVenues = useMemo(() => {
  if (!searchQuery) return groupVenues;
  const query = searchQuery.toLowerCase();
  return groupVenues.filter(v => 
    v.name.toLowerCase().includes(query)
  );
}, [groupVenues, searchQuery]);

// Input sin autofocus
<div className="flex items-center border-b px-3 py-2">
  <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
  <input
    type="text"
    placeholder={t('common.search', 'Buscar...')}
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
    // NO autoFocus - el usuario debe pulsar para activar
  />
</div>
```

## Archivos a modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/events/VenueGroupDropdown.tsx` | Reemplazar `CommandInput` con Input manual, añadir filtrado local |

## Verificacion

1. Abrir dropdown de Salas → El input NO tiene foco, el teclado NO se abre
2. Abrir dropdown de Teatros → Mismo comportamiento
3. Pulsar en el campo de búsqueda → Ahora sí se activa el foco y el teclado
4. Escribir texto → Los venues se filtran correctamente
5. Cerrar y reabrir → El campo de búsqueda está vacío
