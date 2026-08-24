# Changelog - Ritmo

## Descripción del Proyecto

Ritmo es una aplicación web de gestión académica diseñada para ayudar a estudiantes a organizar sus tareas, seguimiento de progreso y planificación semestral. La aplicación permite:

- Gestión de tareas con seguimiento de progreso
- Vista de tabla semanal para planificación
- Vista de tareas pendientes para hoy
- Persistencia de datos en localStorage y Supabase
- Soporte offline mediante Service Worker
- Interfaz responsive (desktop y móvil)

---

## Cambios Implementados

### [2025-01-27] - Optimización de Persistencia y Rendimiento

#### Problemas Resueltos
- **Persistencia**: Las tareas a veces desaparecían entre sesiones
- **Rendimiento UI**: Interacciones con botones +/- y checkboxes tenían ~5 segundos de retraso
- **Jank visual**: Bajos FPS al abrir detalles de tarea y usar controles interactivos

#### Cambios en `js/state.js`
- **`saveState()` refactorizado**:
  - Guardado inmediato en localStorage (síncrono)
  - Guardado asíncrono en Supabase con reintentos y backoff exponencial
  - Nuevas funciones auxiliares: `saveToLocal()` y `saveToCloudWithRetry()`
- Mejora en confiabilidad de persistencia de datos

#### Cambios en `js/ui.js`
- **Sistema de notificaciones**:
  - `showToast()` - Notificaciones generales
  - `showSavingIndicator()` - Indicador visual de guardado
  - `showSavedIndicator()` - Confirmación de guardado completado

#### Cambios en `css/components.css`
- Estilos para el nuevo sistema de notificaciones (toast)
- Posicionamiento, animaciones y transiciones

#### Cambios en `js/modals.js`
- **Event listeners optimizados**:
  - `quickLogPlus`: Actualización UI inmediata + guardado asíncrono con debounce
  - `quickLogMinus`: Actualización UI inmediata + guardado asíncrono con debounce
  - `logSaveBtn`: Actualización UI inmediata + indicadores visuales
  - Subtask toggle: Actualización UI inmediata + guardado en background
  - `newSubtaskInput`: Actualización UI inmediata + guardado en background
- Variable `debounceTimer` para debounce de cambios rápidos

#### Cambios en `js/views/taskGridView.js`
- **Renderizado incremental**:
  - `renderTaskGrid()`: Actualiza solo tarjetas que cambiaron en lugar de reconstruir todo el DOM
  - Botón de toggle: Actualización UI inmediata + guardado en background

#### Cambios en `js/views/todayView.js`
- **Renderizado incremental**:
  - Nueva función `generateTodayContent()`: Genera solo contenido interno
  - `renderTodayView()`: Wrapper `.today-container` creado una sola vez, renders posteriores solo actualizan contenido
  - Elimina reconstrucción completa del DOM

#### Cambios en `js/views/tableView.js`
- **Renderizado incremental**:
  - Nueva función `generateTableContent()`: Genera solo contenido interno
  - `renderTableView()`: Wrapper `.table-container` creado una sola vez, renders posteriores solo actualizan contenido
  - Elimina reconstrucción completa del DOM

#### Cambios en `service-worker.js`
- **Corrección de errores de caché**:
  - CACHE_VERSION actualizada de `v1` a `v2`
  - Lista ASSETS corregida:
    - Eliminados archivos inexistentes: `styles.css`, `icon-192.svg`, `icon-512.svg`, `semesterPanel.js`
    - Agregados archivos correctos: CSS completos, manifest.json
  - Soluciona error "Failed to execute 'addAll' on 'Cache': Request failed"

---

## Plan de Optimización de Fluidez Visual (En Progreso)

### Fase 1: Renderizado Incremental ✅ COMPLETADO
- **Archivos**: `js/views/todayView.js`, `js/views/tableView.js`
- **Objetivo**: Eliminar reconstrucción de DOM completo en vistas
- **Estado**: Implementado y probado

### Fase 2: Reducir Animaciones Simultáneas (Pendiente)
- **Archivos**: `css/modals.css`
- **Objetivo**: Eliminar animaciones escalonadas que compiten por el hilo principal
- **Cambios planeados**:
  - Eliminar `animation-delay` escalonados en `.stat-box`, `.history-row`, `.subtask-item`
  - Simplificar transición del modal

### Fase 3: Optimizar Animaciones CSS (Pendiente)
- **Archivos**: `css/components.css`, `css/modals.css`, `css/base.css`
- **Objetivo**: Cambiar propiedades que causan layout/paint costosos a GPU-accelerated
- **Cambios planeados**:
  - `transition: width` → `transform: scaleX()` en `.ruler-fill`
  - Condicionar `backdrop-filter` solo a desktop
  - Simplificar `phasePulse` usando solo opacity/transform
  - Reemplazar `transition: all` con propiedades específicas

---

## Notas de Instalación

### Requisitos
- Navegador moderno con soporte para ES6 modules
- Conexión a internet para Supabase (opcional, fallback a localStorage)

### Configuración de Service Worker
El Service Worker se registra automáticamente al cargar la aplicación. Para forzar actualización del caché:
1. Hard refresh: Ctrl+Shift+R (Windows/Linux) o Cmd+Shift+R (Mac)
2. O unregister en DevTools → Application → Service Workers

---

## Estructura del Proyecto

```
ritmo-app/
├── index.html              # HTML principal
├── service-worker.js       # Service Worker para offline
├── manifest.json          # Manifest PWA
├── css/
│   ├── base.css           # Variables globales y reset
│   ├── layout.css          # Layout principal
│   ├── components.css      # Componentes UI
│   ├── views.css          # Estilos de vistas
│   ├── forms.css          # Formularios
│   ├── modals.css         # Modales
│   └── responsive.css     # Media queries
├── js/
│   ├── main.js            # Entry point
│   ├── state.js           # Gestión de estado y persistencia
│   ├── ui.js              # Interacciones UI generales
│   ├── modals.js          # Modales
│   ├── dateUtils.js       # Utilidades de fecha
│   ├── taskStats.js       # Cálculos de estadísticas de tareas
│   ├── semesterUtils.js   # Utilidades de semestre
│   ├── components/
│   │   ├── progressBar.js # Barra de progreso
│   │   ├── heatmap.js     # Heatmap de actividad
│   │   └── taskCard.js    # Tarjeta de tarea
│   └── views/
│       ├── todayView.js   # Vista de hoy
│       ├── tableView.js   # Vista de tabla
│       └── taskGridView.js # Vista de grid de tareas
└── CHANGELOG.md           # Este archivo
```

---

## Próximos Pasos

- Completar Fase 2 y Fase 3 de optimización de fluidez visual
- Generar perfil de Performance en Chrome DevTools para validar mejoras
- Considerar implementación de event delegation para reducir listeners duplicados
