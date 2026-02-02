
# Plan: Nombres de Eventos Legibles (Sin Caracteres Raros)

## Problema Identificado

Los títulos de eventos pueden mostrar caracteres raros como:
- `&amp;` en lugar de `&`
- `&#39;` o `&apos;` en lugar de `'`
- `&quot;` en lugar de `"`
- `&#x27;` en lugar de `'`

**Causas:**
1. **Backend**: El scraping obtiene textos con entidades HTML que no se decodifican
2. **Frontend**: La función `sanitizeText()` escapa caracteres que React ya escapa automáticamente (doble-escapado)

---

## Solución

### 1. Backend: Decodificar entidades HTML al sincronizar

Añadir función `decodeHtmlEntities()` en `sync-events` que convierta:

| Entidad | Resultado |
|---------|-----------|
| `&amp;` | `&` |
| `&lt;` | `<` |
| `&gt;` | `>` |
| `&quot;` | `"` |
| `&#39;` / `&apos;` | `'` |
| `&#x27;` | `'` |
| `&nbsp;` | ` ` |
| `&#NNN;` | carácter correspondiente |

Aplicar esta decodificación en:
- `cleanTitle()` - para títulos
- Descripciones antes de guardar

### 2. Frontend: Simplificar sanitización

Modificar `sanitizeText()` para:
- **Eliminar** el escapado HTML (React ya lo hace)
- **Añadir** decodificación de entidades HTML residuales
- **Mantener** la eliminación de tags HTML

El flujo correcto será:
```text
Texto con entidades HTML → Decodificar entidades → Eliminar tags → Texto limpio
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/lib/sanitize.ts` | Añadir `decodeHtmlEntities()`, quitar `escapeHtml()` de `sanitizeText()` |
| `supabase/functions/sync-events/index.ts` | Añadir decodificación en `cleanTitle()` |

---

## Implementación Técnica

### Función `decodeHtmlEntities()`

```typescript
function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  
  return text
    // Named entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Numeric entities (decimal)
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    // Numeric entities (hex)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}
```

### Nueva función `sanitizeText()`

```typescript
export function sanitizeText(text: string | null | undefined): string {
  if (!text) return '';
  
  let clean = String(text);
  
  // 1. Decodificar entidades HTML
  clean = decodeHtmlEntities(clean);
  
  // 2. Eliminar tags HTML
  clean = clean.replace(/<[^>]*>/g, '');
  
  // 3. Normalizar espacios
  clean = clean.replace(/\s+/g, ' ').trim();
  
  return clean;
  // NO escapar - React lo hace automáticamente
}
```

---

## Verificación

1. Eventos con `&` en título (ej: "H&T Salón") → Se muestra como "H&T Salón"
2. Eventos con comillas → Se muestran correctamente
3. Eventos con caracteres especiales españoles (ñ, á, é, etc.) → Se mantienen
4. No hay vulnerabilidades XSS (React escapa automáticamente)
