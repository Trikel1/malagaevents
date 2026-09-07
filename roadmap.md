# Roadmap — Fase 1 (Málaga Connect)

Estados: [ ] pendiente · [~] en curso · [x] hecho
Etiquetas de entrega: preparado / probado / activo en producción

## 1. Hora de Estepona y desfases
- [ ] Localizar el evento y sus ocurrencias (solo lectura) y contrastar con la fuente oficial
- [ ] Identificar la causa real (valor guardado / extractor / zona horaria / presentación)
- [ ] Migración condicionada por id + valor anterior esperado
- [ ] Prueba del extractor concreto con el caso que produjo el desfase
- [ ] Lista de candidatos a desfase (sin clasificarlos como erróneos sin fuente)

## 2. Dependencias y seguridad
- [ ] Versiones instaladas reales (React Router, Supabase/ws, Recharts/lodash)
- [ ] Aplicabilidad y riesgo por aviso; actualizaciones selectivas
- [ ] Documentar lo que exige versión mayor (riesgo + alcance)

## 3. Mapa
- [ ] Servicio de baldosas: política de uso, caché y límites
- [ ] Recorridos: ficha→mapa, filtros, cierre de tarjeta, geolocalización denegada, atribución
- [ ] Uso real de Leaflet, react-leaflet, MapLibre y Google Maps (cargadores incluidos)

## 4. Fuentes
- [ ] Inventario con todas las fuentes conocidas
- [ ] Cifras finales: inventariadas / comprobadas / bloqueadas / pendientes

## 5. Entradas e inscripciones
- [ ] Destinos y dominio visible

## 6. Miniaturas
- [ ] 2 imágenes de muestra aplicadas en tarjetas reales (móvil)
- [ ] Revisar imágenes deportivas existentes
- [ ] Resolución de cartel en ingestión/proceso controlado, con procedencia guardada
- [ ] Componente compartido: imagen protagonista, cartel completo, etiqueta discreta
- [ ] Rendimiento: dimensiones reservadas, carga diferida, prioridad

## 7. Pruebas
- [ ] Cobertura real de navegador frente a pruebas de componentes

## 8. Cierre
- [ ] Capturas antes/después móvil y escritorio, en español
- [ ] Tipos, pruebas y compilación
- [ ] Resumen de 8 puntos + fase 2 preparada
