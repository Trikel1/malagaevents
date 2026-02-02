
# Plan: Imágenes Inteligentes para Eventos

## Resumen

Implementar un sistema de imágenes que garantice que **todos los eventos muestren imágenes atractivas**, ya sea:
1. La imagen real obtenida de la web fuente (cuando exista)
2. Una imagen genérica de alta calidad basada en la categoría/tipo del evento (cuando no haya imagen)

---

## Estado Actual

| Métrica | Valor |
|---------|-------|
| Eventos futuros con imagen OK | 11 |
| Eventos futuros sin imagen o pendiente | 14 |
| **Cobertura actual** | **44%** |

**Problemas detectados:**
- Muchas URLs de imagen apuntan a servidores del Ayuntamiento (`malaga.eu`) que no son accesibles directamente
- Algunas fuentes no proporcionan imágenes en el scraping
- El sistema de fallback actual muestra solo iconos con gradientes (poco atractivo visualmente)

---

## Solución Propuesta

```text
┌─────────────────────────────────────────────────────────────────┐
│                    FLUJO DE IMAGEN INTELIGENTE                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. ¿Tiene image_url válida?                                   │
│     │                                                           │
│     ├── SÍ → Mostrar imagen de la web fuente                   │
│     │                                                           │
│     └── NO → 2. Determinar categoría/tipo del evento           │
│                  │                                              │
│                  ├── music     → Foto concierto Unsplash        │
│                  ├── theater   → Foto teatro/escenario          │
│                  ├── comedy    → Foto comedia/micrófono         │
│                  ├── festival  → Foto festival/multitud         │
│                  ├── nightlife → Foto discoteca/luces           │
│                  ├── exhibitions → Foto museo/galería           │
│                  ├── kids      → Foto actividad infantil        │
│                  ├── sports    → Foto deportes                  │
│                  ├── workshops → Foto taller/creatividad        │
│                  ├── conferences → Foto conferencia             │
│                  └── other     → Foto evento genérico           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Componentes a Modificar

### 1. Frontend: `EventImage.tsx`

**Mejoras:**
- Añadir imágenes de Unsplash de alta calidad para cada categoría
- Las imágenes de Unsplash son gratuitas y optimizables (soportan parámetros de ancho/calidad)
- Mostrar la imagen de fondo + overlay degradado + icono de categoría superpuesto

**Configuración de fallbacks mejorada:**

| Categoría | Imagen Unsplash | Descripción |
|-----------|-----------------|-------------|
| `music` | Concierto con luces | Escenario, guitarra, multitud |
| `theater` | Teatro/butacas | Escenario clásico, telón rojo |
| `comedy` | Micrófono stand-up | Escenario de comedia |
| `festival` | Festival al aire libre | Multitud, confeti, alegría |
| `nightlife` | Discoteca/club | Luces neón, DJ, pista |
| `exhibitions` | Galería/museo | Cuadros, espacio minimalista |
| `kids` | Actividad infantil | Colores, diversión |
| `sports` | Estadio/deporte | Acción, competición |
| `workshops` | Taller creativo | Manos trabajando, herramientas |
| `conferences` | Conferencia | Ponente, audiencia |
| `other` | Evento genérico Málaga | Ciudad, arquitectura local |

**Estrategia de carga:**
- Las imágenes de Unsplash se cargan con parámetros optimizados: `?w=640&q=80&fit=crop`
- Lazy loading para mejor rendimiento
- Fallback final: gradiente + icono (actual) si Unsplash falla

### 2. Backend: `sync-events/index.ts`

**Mejoras en extracción de imágenes:**
- Mejorar el prompt de extracción para Firecrawl pidiendo explícitamente la imagen principal del evento
- Validar que la URL de imagen es accesible antes de guardarla
- Si la imagen no es válida, marcar como `image_status: 'fallback'` para que el frontend use la genérica

**Mejoras en clasificación:**
- Ampliar la función `determineEventType` para detectar más categorías:
  - `exhibitions`: "exposición", "muestra", "galería", "museo"
  - `kids`: "infantil", "niños", "familia", "taller"
  - `sports`: "carrera", "maratón", "partido", "campeonato"
  - `workshops`: "taller", "curso", "clase", "masterclass"
  - `conferences`: "conferencia", "charla", "ponencia", "congreso"

### 3. Nuevos archivos de assets

**Crear directorio de imágenes de fallback:**
- Opción A: URLs de Unsplash directas (recomendado - sin almacenamiento local)
- Opción B: Subir imágenes a Supabase Storage (más control pero requiere gestión)

---

## Implementación Técnica

### Paso 1: Actualizar `EventImage.tsx`

```typescript
// Nuevas URLs de fallback por categoría
const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  music: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=640&q=80&fit=crop',
  theater: 'https://images.unsplash.com/photo-1503095396549-807759245b35?w=640&q=80&fit=crop',
  comedy: 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=640&q=80&fit=crop',
  // ... etc
};
```

El componente:
1. Intenta cargar la imagen del evento
2. Si falla o no existe → usa imagen de Unsplash para la categoría
3. Si Unsplash falla → usa el fallback actual (gradiente + icono)

### Paso 2: Mejorar clasificación en sync-events

```typescript
function determineEventType(title: string, description: string, category: string): string {
  const text = `${title} ${description}`.toLowerCase();
  
  // Más patrones de detección
  if (/exposici[oó]n|muestra|galer[ií]a|museo|arte/i.test(text)) return 'exhibitions';
  if (/infantil|ni[ñn]os|familia|peque[ñn]os/i.test(text)) return 'kids';
  if (/carrera|marat[oó]n|partido|campeonato|deporte/i.test(text)) return 'sports';
  if (/taller|curso|clase|masterclass/i.test(text)) return 'workshops';
  if (/conferencia|charla|ponencia|congreso/i.test(text)) return 'conferences';
  // ... patrones existentes
}
```

### Paso 3: Validación de imágenes en backend

```typescript
async function validateImageUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
    const contentType = response.headers.get('content-type');
    return response.ok && contentType?.startsWith('image/');
  } catch {
    return false;
  }
}
```

---

## Detalles Técnicos

### Selección de imágenes Unsplash

Criterios:
- Imágenes en formato horizontal (16:9 compatible)
- Alta calidad visual
- Relevantes para Málaga/España cuando sea posible
- Licencia gratuita para uso comercial

### Parámetros de optimización

```
?w=640      → Ancho para cards
&q=80       → Calidad 80%
&fit=crop   → Recortar para ajustar
&auto=format → WebP si el navegador lo soporta
```

### Caché y rendimiento

- Las imágenes de Unsplash tienen CDN global
- El componente usa `loading="lazy"` por defecto
- `srcset` para múltiples resoluciones

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/components/events/EventImage.tsx` | Añadir URLs de fallback, lógica de cascada |
| `supabase/functions/sync-events/index.ts` | Mejorar clasificación, validar imágenes |
| `src/types/index.ts` | Actualizar tipo `Event` si es necesario |

---

## Verificación

1. Eventos con imagen real → Se muestran correctamente
2. Eventos sin imagen, categoría "music" → Foto de concierto
3. Eventos sin imagen, categoría "theater" → Foto de teatro
4. Fallo de Unsplash → Gradiente + icono (fallback actual)
5. Rendimiento → Lazy loading funciona, sin CLS (Cumulative Layout Shift)

---

## Resultado Esperado

| Métrica | Antes | Después |
|---------|-------|---------|
| Eventos con imagen visual atractiva | 44% | **100%** |
| Experiencia de usuario | Iconos genéricos | Imágenes profesionales |
| Tiempo de carga | Similar | Similar (CDN optimizado) |
