## Problema

En móvil, al abrir el desplegable de localidad/provincia tanto en **Eventos** (`LocationFilter`) como en **Farmacias** (`PharmaciesPage`), el teclado virtual aparece automáticamente porque el input de búsqueda recibe el foco al abrirse el panel. Esto además rompe el scroll porque el teclado reduce el viewport y el panel queda comprimido.

## Causa

1. **Farmacias** (`src/pages/PharmaciesPage.tsx`, línea 206): el `<Input>` tiene `autoFocus` activo siempre, también en móvil.
2. **Eventos** (`src/components/events/LocationFilter.tsx`): el `<Input>` ya usa `autoFocus={!isMobile}` (línea 152), pero el `Sheet`/`Popover` de Radix mueve por defecto el foco al primer elemento enfocable al abrir, que es el input → dispara el teclado igualmente.

## Cambios

### 1. `src/pages/PharmaciesPage.tsx` (componente `LocalityPicker`, ~líneas 185-212)

- Quitar `autoFocus` del `<Input>`.
- Añadir `onOpenAutoFocus={(e) => e.preventDefault()}` al `<PopoverContent>` para que Radix no enfoque el input al abrir.
- En el `<PopoverContent>` añadir `max-h-[80vh] flex flex-col` y mover el `max-h-[60vh]` del `ScrollArea` a `flex-1 min-h-0` para que el scroll funcione correctamente dentro del popover en móvil.

### 2. `src/components/events/LocationFilter.tsx` (~líneas 250-282)

- Añadir `onOpenAutoFocus={(e) => e.preventDefault()}` tanto al `<SheetContent>` (móvil) como al `<PopoverContent>` (desktop). Así, al pulsar el desplegable no se enfoca el buscador y el teclado no aparece. Solo cuando el usuario toque manualmente el campo de búsqueda saldrá el teclado.
- El `ScrollArea` ya tiene `flex-1 min-h-0 overscroll-contain` y el `SheetContent` `h-[85vh] p-0 flex flex-col`, por lo que el scroll funcionará correctamente una vez que el teclado deje de aparecer involuntariamente.

## Resultado esperado

- Al pulsar los desplegables de provincia en Eventos y Farmacias, el panel se abre sin teclado.
- La lista de localidades se puede recorrer con scroll suave (incluyendo cabeceras sticky por zona).
- Si el usuario toca explícitamente "Buscar localidad", entonces sí aparece el teclado para escribir.
