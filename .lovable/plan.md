
# Plan: Imágenes Inteligentes para Danza y Festivales Específicos

## Problema

Cuando un evento es de **danza** pero contiene la palabra "festival" en el título (ej: "Festival de Danza"), el sistema lo clasifica como `festival` y muestra una imagen de multitud/fiesta que no tiene sentido.

**Causa técnica:**
```typescript
// Línea 230 - Se evalúa ANTES que danza
if (cat.includes('festival')) return 'festival';

// Línea 226 - Danza está aquí, pero nunca se alcanza si hay "festival"
if (cat.includes('danza')) return 'theater';
```

## Solución

### 1. Añadir nueva categoría `dance` con imagen específica

Crear una categoría dedicada para danza con una imagen apropiada de ballet/danza contemporánea.

### 2. Mejorar la lógica de detección (orden de prioridad)

Reordenar las comprobaciones para que categorías más específicas (danza, música) se evalúen **antes** que "festival":

```text
ANTES:                          DESPUÉS:
1. music                        1. dance (NUEVO - más específico)
2. theater (incluye danza)      2. music  
3. comedy                       3. theater (sin danza)
4. festival  ← atrapa todo      4. comedy
5. ...                          5. festival ← ahora es fallback
```

## Cambios en `EventImage.tsx`

### Nuevo tipo y configuración para `dance`

```typescript
// Añadir 'dance' al tipo EventType
export type EventType = 'music' | 'theater' | 'dance' | 'comedy' | ...

// Nueva imagen de danza (bailarines, ballet, danza contemporánea)
const CATEGORY_FALLBACK_IMAGES = {
  dance: 'https://images.unsplash.com/photo-1508700929628-666bc8bd84ea?w=640&q=80&fit=crop&auto=format',
  // ... resto igual
};

// Nueva configuración visual para dance
const CATEGORY_FALLBACKS = {
  dance: {
    icon: Theater, // o un icono personalizado
    gradient: 'from-pink-500/30 via-purple-500/20 to-violet-500/30',
    label: 'Danza',
  },
  // ... resto igual
};
```

### Nueva lógica de detección (orden corregido)

```typescript
const getEventTypeFromCategory = (category?: string): EventType => {
  if (!category) return 'other';
  const cat = category.toLowerCase();
  
  // 1. DANZA primero (más específico que festival)
  if (cat.includes('danza') || cat.includes('ballet') || cat.includes('baile') || cat.includes('dance')) {
    return 'dance';
  }
  
  // 2. Música
  if (cat.includes('music') || cat.includes('concierto') || ...) return 'music';
  
  // 3. Teatro (sin danza, ya capturada arriba)
  if (cat.includes('theater') || cat.includes('teatro') || cat.includes('circo')) return 'theater';
  
  // 4. Comedia
  if (cat.includes('comedy') || ...) return 'comedy';
  
  // 5. Festival (ahora es fallback para festivales genéricos)
  if (cat.includes('festival')) return 'festival';
  
  // ... resto igual
};
```

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/events/EventImage.tsx` | Añadir categoría `dance`, reordenar detección |

## Imágenes propuestas para Danza

| Opción | URL Unsplash | Descripción |
|--------|--------------|-------------|
| A (Ballet) | photo-1508700929628-666bc8bd84ea | Bailarina de ballet elegante |
| B (Contemporánea) | photo-1547153760-18fc86324498 | Danza contemporánea, movimiento |
| C (Flamenco) | photo-1604251405925-aedc6c0c02b0 | Bailaora flamenca (más local a Málaga) |

## Resultado

| Evento | Antes | Después |
|--------|-------|---------|
| "Festival de Danza" | 🏊 Piscina/multitud | 💃 Bailarines/danza |
| "Gala de Ballet" | ❓ Genérico | 🩰 Ballet |
| "Festival de Rock" | 🎸 Festival (correcto) | 🎸 Festival (sin cambio) |

## Verificación

1. "Festival de Danza" → Imagen de danza
2. "Ballet clásico" → Imagen de danza
3. "Festival de Música" → Imagen de festival (multitud)
4. "Obra de Teatro" → Imagen de teatro
