# Plan: Soporte completo de árabe (RTL) en MalagaEvents

## Archivos

1. **`src/i18n/locales/ar.json`** (nuevo) — Espejo de `es.json` con todas las keys traducidas a árabe estándar moderno (common, nav, home con `kicker`/`heroTitle`/`heroSubtitle`, events, eventDetail con `date`/`time`/`place`/`price`, tickets, profile, categories, errors, map, sports, submitEvent, pharmacies, theme, onboarding, calendar).

2. **`src/i18n/index.ts`**
   - Importar `ar` y añadirlo a `resources`.
   - Extender cada entrada de `languages` con `dir: 'ltr' | 'rtl'`.
   - Insertar `{ code: 'ar', name: 'العربية', flag: 'AR', dir: 'rtl' }` antes de `ja`.
   - Añadir helper `applyHtmlLangDir(lng)` que setea `document.documentElement.lang` y `dir`. Llamarlo al iniciar y suscribirse a `i18n.on('languageChanged', ...)`.

3. **`src/components/common/LanguageSelector.tsx`**
   - Componente `LangBadge` que renderiza emoji bandera o, si `flag` no es pictográfico (caso `AR`), un badge textual `bg-muted text-foreground`.
   - `aria-label` y `min-h-[36px]` en el trigger compact para tap target y a11y.
   - `dir={lang.dir}` en cada item del dropdown para que el nombre árabe se renderice correctamente.

## Garantías

- 9 idiomas previos intactos. Persistencia `localStorage` sin cambios.
- Fallback `es` ya configurado.
- Sin tocar App.tsx, providers, hooks, rutas, Supabase, edge functions, tipos de dominio, EventCard, BottomNav, dark mode, modo deportes.
- No se hace refactor RTL masivo de clases `ml-*`/`mr-*` para evitar regresiones; el soporte mediante `dir="rtl"` global es funcional y presentable.
