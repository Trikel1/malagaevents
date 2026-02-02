
## Objetivo
Que al abrir los desplegables **Salas** y **Teatros** en iPhone **NO aparezca el teclado** ni se ponga el cursor en “Buscar…”. El teclado solo debe salir cuando el usuario toque el campo de búsqueda de forma intencionada.

---

## Diagnóstico (por qué sigue pasando)
Aunque ya no usamos `autoFocus` en el `<input>`, **Radix Popover** (el componente base de `PopoverContent`) hace un **auto-enfoque (auto-focus)** por accesibilidad al abrirse: intenta enfocar el primer elemento “enfocable” dentro del popover.  
En nuestro caso, el primer elemento enfocable es el **input de búsqueda**, y en iOS eso dispara el teclado.

Esto ocurre aquí:
- `src/components/events/VenueGroupDropdown.tsx` → `<PopoverContent ...>` contiene un `<input>` como primer elemento enfocable.

---

## Enfoque de solución
### Solución principal
Bloquear el auto-focus del Popover cuando se abre, usando:
- `onOpenAutoFocus={(e) => e.preventDefault()}`

### Mejora recomendada (para no empeorar desktop)
En escritorio puede ser útil que el input reciba foco automáticamente (para escribir sin hacer click).  
Así que lo haremos **solo en móvil** (iPhone/Android), usando el hook existente:
- `useIsMobile()` desde `src/hooks/use-mobile.tsx`

---

## Cambios concretos

### 1) VenueGroupDropdown: impedir auto-focus en móvil
**Archivo:** `src/components/events/VenueGroupDropdown.tsx`

**Cambios:**
1. Importar `useIsMobile`:
   - `import { useIsMobile } from '@/hooks/use-mobile';`
2. Crear `const isMobile = useIsMobile();`
3. En el `<PopoverContent ...>` de cada dropdown (Salas/Teatros) añadir:
   - `onOpenAutoFocus={(e) => { if (isMobile) e.preventDefault(); }}`
4. (Opcional, por robustez iOS) añadir también:
   - `onTouchStart={(e) => e.stopPropagation()}` en el `PopoverTrigger` Button y en el `PopoverContent`  
   Esto ayuda en casos donde iOS maneja eventos táctiles distinto a `pointerdown`.

**Resultado esperado:**
- Abrir Salas/Teatros en iPhone: el foco se queda en el botón (o donde estaba), y el input no se enfoca → **no teclado**
- Tocar el input: entonces sí toma foco → **aparece teclado**

---

### 2) (Opcional pero coherente) Aplicar lo mismo a Localidades
Ahora mismo `LocationFilter` tiene un `<Input>` dentro de un `PopoverContent` y podría provocar el mismo comportamiento (teclado al abrir).

**Archivo:** `src/components/events/LocationFilter.tsx`

**Cambios:**
- Añadir `onOpenAutoFocus` con `preventDefault()` en móvil, igual que en VenueGroupDropdown.

Esto evita que el teclado “salte” también al abrir “Localidades”.

---

## Criterios de validación (pruebas)
1. En iPhone, ir a `/events`.
2. Tocar **Salas** → el popover se abre y **NO** aparece el teclado.
3. Tocar **Teatros** → el popover se abre y **NO** aparece el teclado.
4. Tocar dentro del input “Buscar…” → ahora sí aparece el teclado y permite escribir.
5. Escribir en “Buscar…” → el filtrado funciona como antes.
6. En escritorio:
   - Confirmar que abrir popover sigue funcionando correctamente (y decidir si queremos mantener autofocus en desktop o no; con la solución “solo móvil” se mantiene el comportamiento actual en desktop).

---

## Archivos a tocar
- `src/components/events/VenueGroupDropdown.tsx` (obligatorio)
- `src/components/events/LocationFilter.tsx` (opcional, recomendado por consistencia)

---

## Riesgos / Consideraciones
- Al desactivar el auto-focus en móvil, perdemos un poco de accesibilidad “automática” del foco, pero ganamos usabilidad real en iOS (evitar teclado no deseado).
- Hacerlo solo en móvil minimiza impacto en usuarios de escritorio.
