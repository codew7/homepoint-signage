# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Signtv** is a digital signage system for HomePoint showrooms. It consists of a real-time content management platform where an admin panel controls content displayed across multiple TVs/screens.

**Stack:** Vanilla JavaScript/CSS, Firebase (Realtime Database + Storage + Auth), no frameworks.

---

## Architecture

### Two-Part System

**1. Reproductor (`cartelera.html`)**
- Displays content on TVs/screens in kiosk mode
- Listens to Firebase Realtime Database for content changes
- Updates in real-time without page reload
- Shows slideshow with configurable transitions (fade, zoom, slide)
- Requires Firebase Authentication login
- URL parameter `?s=screenName` identifies which screen's content to load
- Falls back to cached content if offline

**2. Admin Panel (`admin.html`)**
- Web interface to manage slides and configuration
- Firebase Authentication required
- Creates/edits/deletes/reorders slides per screen
- Uploads images to Firebase Storage (automatically compressed)
- Real-time preview via iframe
- Manages multiple screens independently

### Modo LED (`led.html`)
- Reproductor aparte para carteles LED alimentados por una consola que hace el split por coordenadas
- Dibuja en un `<canvas>` de 384×512 px: imagen A en (0,0) 256×512 e imagen B en (256,0) 128×256; el resto en negro
- El tamaño CSS del canvas es `384/devicePixelRatio`, para que cada píxel caiga 1:1 en un píxel físico aunque haya escalado de Windows o zoom. No posicionar con px CSS.
- Datos: `stores/{storeId}/screens/{screenId}/led` → `{ pairs: [{title, imageA, imageB, duration, active, createdAt}], updatedAt }`. Rotan con corte seco.
- Admin: vista propia "Pantallas LED", separada de la cartelera por el selector "Cartelera | Pantallas LED" del header (se recuerda en `hp_admin_view` y en `#led`/`#cartelera`). Comparte el selector de pantalla; "Configuración" se oculta porque no aplica. Las imágenes se ajustan (cover centrado) a la medida exacta y se suben en PNG a `stores/{storeId}/slides/led_*_{a|b}.png`
- Edición de pares: doble clic (o el lápiz) carga el par en el lienzo y el botón pasa a "Guardar cambios". El par se identifica por `createdAt` (`ledEditKey`), no por su índice, para sobrevivir reordenamientos de otra sesión. "A/B desde biblioteca" elige una imagen ya subida, solo si mide exacto la zona (ajustar otra requeriría CORS en el bucket)

### Admin: biblioteca de imágenes (vista "Imagenes", `#media`)
- **Compartida entre todos los locales:** lista con `listAll()` las carpetas `stores/{id}/slides/` de todos los locales de `storeList` más `slides/` (legado, etiqueta "Anterior"). Cada imagen muestra en qué local se subió; las subidas nuevas siguen yendo a la carpeta del local activo. Metadatos y URLs con a lo sumo 8 pedidos en paralelo (`mapLimit`); se recarga solo si cambió el local o hubo una subida (`markMediaStale`) o con "Actualizar"
- Uso entre locales: un encargado no puede leer las pantallas de otro local, así que cada local publica `mediaUsage/{storeId}: {paths: {<ruta codificada>: [lugares]}, updatedAt}` al guardar slides o pares (`scheduleUsagePublish`), al abrirse en el admin y al migrar. El local propio (y todos, si es superadmin) se calcula en el momento desde sus pantallas; también se mira `screens/` legado. La ruta sale de la URL con `storagePathFromUrl`; las claves se codifican con `usageKey` (sin `/` ni `.`)
- Una imagen en uso en cualquier local, o en los formularios sin guardar, no se puede eliminar. Si algún local todavía no publicó su índice, borrar queda bloqueado ("sin verificar") hasta que alguien lo abra en el admin. El uso se relee justo antes de borrar
- Selección múltiple (`mediaSel`): arrastrar sobre `#media-area` dibuja un recuadro (también empezando sobre una tarjeta; umbral de 6 px para no confundirlo con un clic, autoscroll cerca del borde). Ctrl/Cmd o Shift suman a la selección; Ctrl+clic alterna, Shift+clic hace un rango; con algo seleccionado un clic simple alterna en vez de abrir el detalle. Ctrl+A, Supr y Esc. Casilla en cada tarjeta para pantallas táctiles. La barra flotante borra en lote (4 en paralelo): relee el uso, omite las que están en uso y deja seleccionadas las que no se borraron
- Limitación: Storage no lee los roles de la base, así que cualquier usuario autenticado podría borrar archivos de otro local desde la consola del navegador. Cerrarlo exige custom claims (Admin SDK / Cloud Functions)
- `?test=1` muestra el patrón de calibración (sin login); `?debug=1` muestra DPR y resolución fuera de la zona LED
- Caché offline en `signtv_led_cache_{storeId}_{screenId}`
- Al abrir (después del login, o enseguida con `?test=1`) muestra un selector de monitor físico con la Window Management API (`getScreenDetails()` + `requestFullscreen({ screen })`, solo Chrome/Edge, requiere permiso y clic del usuario). Sin la API, cae en "Esta pantalla". Última elección en `signtv_led_last_display`; al salir de fullscreen vuelve a preguntar

### Puntos de venta (multi-local)
- Cada local tiene su árbol `stores/{storeId}/` (screens) y sus imágenes en Storage `stores/{storeId}/slides/`. `storeList/{storeId}: {name}` es el índice liviano para los selectores. IDs `pv1`, `pv2`, `pv3`… (independientes del nombre)
- Permisos en `users/{uid}`: `role` (`superadmin` | `manager` | `player`) y `stores: {pv1: true}`. `profile` (email, lastLogin) lo escribe el propio usuario al ingresar, para que aparezca en "Accesos". El aislamiento lo hacen `database.rules.json` y `storage.rules`; la UI solo oculta
- `store-session.js` es compartido por admin, index y led: `StoreSession.path(storeId, ...)` es el único lugar que arma rutas; `resolve()` lee rol y locales; `pick()` elige (preferido → último recordado en `hp_store_{uid}` → único); `showPicker`/`showGate` son los overlays de los reproductores
- Reproductores: el local sale de la cuenta logueada. `?pv=` solo preselecciona entre los locales que la cuenta ya tiene (lo agregan los enlaces del admin). Cambiar de local recarga la página
- Admin: selector "Local" en el header (se recuerda en `hp_admin_store`; la última pantalla por local en `hp_admin_screen_{storeId}`). Al cambiar de local se sueltan los listeners (`slidesRef`, `ledRef`). El botón "Accesos" (solo superadmin) crea/renombra locales, asigna rol y locales a usuarios y migra el contenido anterior (`screens/`) a `pv1`. No hay historial de cambios (se quitó a pedido del usuario)
- Los overlays de selección de local y de "cuenta sin local" de los reproductores tienen botón "Cerrar sesión"
- El primer superadmin se crea a mano en la consola: `users/{uid}/role = "superadmin"` (la pantalla "sin acceso" muestra el UID)
- `screens/` en la raíz es el legado previo a los locales: solo lectura hasta "Eliminar datos antiguos"

### App de Windows (`led-app/`)
- Electron que empaqueta `../led.html` y `../store-session.js` (los toma del padre al construir; con `npm start` los carga directo). `npm run dist` genera `dist/HomePoint LED Setup x.y.z.exe` (NSIS)
- `preload.js` expone `window.ledApp` (`getDisplays`, `moveToDisplay`): si existe, `led.html` lista los monitores desde Electron y mueve la ventana antes de `requestFullscreen()`, sin la Window Management API. En el navegador ese camino no se usa
- Recuerda la última `?s=` en `settings.json` de userData; acepta `--s=x`, `--test`, `--debug`. Arranca con Windows, bloquea el apagado de pantalla, F5 recarga, Ctrl+Shift+I DevTools, Ctrl+Q sale
- Si `npm run dist` falla con "Cannot create symbolic link" (winCodeSign), descomprimir el .7z de `%LOCALAPPDATA%\electron-builder\Cache\winCodeSign` en `winCodeSign-2.6.0` con `node_modules\7zip-bin\win\x64\7za.exe` e ignorar los errores de los .dylib

### Admin: temas claro y oscuro
- Tokens en `:root` (oscuro) y `:root[data-theme="light"]`. Las transparencias usan `rgba(var(--tint),a)` y la tinta `rgba(var(--ink-rgb),a)`: no escribir `rgba(255,255,255,...)` fijo, porque desaparece en el modo claro
- Un script en `<head>` aplica el tema antes de pintar (`hp_admin_theme` en localStorage; sin elección, sigue al sistema). Selector sol/luna en el header y en el login
- `.led-stage-wrap` redefine los tokens a oscuro: la vista a escala del LED representa la salida física

### Data Flow

```
Admin: Create/Edit Slide
    ↓
Upload image to Firebase Storage → get download URL
    ↓
Save slide metadata to Realtime Database: screens/{screenId}/content/slides
    ↓
Reproductor detects change via listener
    ↓
Reload slides, display in slideshow
```

---

## Firebase Structure

```
storeList/
└── {storeId}: {name, createdAt}

stores/
└── {storeId}/
    ├── screens/
    │   └── {screenId}/
    │       ├── content/
    │       │   ├── slides/
    │       │   │   ├── 0: {type, title, description, imageUrl, price, duration, active, bgColor, textColor}
    │       │   │   └── ...
    │       │   └── updatedAt: timestamp
    │       ├── led/  (modo LED: pairs[], updatedAt)
    │       └── config/
    │           ├── transitionType, transitionSpeed, defaultDuration
    │           ├── primaryColor, bgColor
    │           └── showClock, showIndicators
    └── migratedAt (solo pv1: cuándo se copió el legado)

users/
└── {uid}: {role, stores: {storeId: true}, profile: {email, lastLogin}}

mediaUsage/
└── {storeId}: {paths: {<ruta Storage codificada>: [lugares]}, updatedAt}  (índice para la biblioteca compartida)

screens/  (legado sin locales, solo lectura)
shared/
└── content/ (for global content across all screens)
```

---

## Key Implementation Details

### Authentication
Both files use Firebase Authentication with email/password. `onAuthStateChanged()` listener controls visibility of login vs. main UI.

### Real-Time Listeners
- `cartelera.html`: Listeners on `screens/{screenId}/content` and `screens/{screenId}/config` auto-detect changes
- `admin.html`: `.on('value')` listeners load and watch for updates to populate UI

### Images
- Stored in Firebase Storage (`storage/ref('slides/{timestamp}_{random}.jpg')`)
- Admin compresses before upload using canvas API
- Only URLs are stored in database (keeps DB size minimal)

### Screen Identification
- URL parameter `?s=screenName` (changed from `?screen=` for brevity)
- Defaults to `'default'` if not specified
- Menu (click clock) allows switching screens on reproductor

### Colors & Styling
- **Default primary:** `#50d753` (green)
- **Default background:** `#000000` (black)
- Both overridable per-screen in config modal
- CSS variables for easy theming

### Offline Support
- Local Storage caches last known slides on reproductor
- If Firebase unavailable, displays cached content
- Status indicator shows connection state

---

## Common Modifications

### Adding a New Field to Slides
1. Update slide object in admin's `addSlide()` function
2. Add form input in admin HTML
3. Include field in `handleContentUpdate()` processing
4. Render field in `renderSlides()` in cartelera

### Changing URL Parameter Name
Update both files where `URLSearchParams.get('s')` is called (currently 1 place in cartelera, 1 in menu).

### Adjusting Slideshow Behavior
- `startSlideshow()` in cartelera controls rotation logic
- `scheduleNext()` handles timing
- `activateSlide()` applies CSS classes for transitions

### Firebase Realtime Database Rules
Las reglas están en `database.rules.json` (y las de Storage en `storage.rules`). Se publican desde la consola o con `firebase deploy --only database,storage`. Cualquier ruta nueva de la base tiene que agregarse ahí: lo que no aparece queda denegado.

---

## Testing Notes

**Login:** Both files require valid Firebase users. Create test accounts in Firebase Console → Authentication.

**Preview:** Admin's iframe preview auto-reloads when screen is switched. Check browser console for auth/CORS issues.

**Multi-Screen:** Create multiple screens via admin panel "Agregar pantalla" button, then use `?s=screenName` URLs to load different content on different TVs.

---

## Important Patterns

- **No pagination/scrolling:** Slideshow is the only navigation on reproductor
- **Drag & drop:** Reorder slides by dragging in admin's slide list
- **Soft delete:** Disable slides with toggle instead of deleting
- **Compression:** Images always compressed client-side before upload (max 1920x1080, quality 0.7-0.85)
- **Validation:** Check Firebase rules allow read/write; verify `FIREBASE_CONFIG` matches project

---

## Files Structure

- `index.html` - Reproductor (~1500 lines, embedded CSS + JS), requests fullscreen on first user interaction. `cartelera.html` was removed in commit 2a27298; older mentions of it in this file refer to `index.html`
- `admin.html` - ~1500 lines, embedded CSS + JS
- `led.html` - Reproductor LED (dos imágenes en posición fija de píxel)
- `store-session.js` - Puntos de venta: rutas por local, roles y overlays de selección (lo cargan los tres HTML)
- `database.rules.json`, `storage.rules` - Reglas de Firebase (aislamiento por local)
- `manifest.json` - PWA manifest with fullscreen display mode
- `GUIA-CONFIGURACION.md` - Setup instructions
- `CLAUDE.md` - This file

---

## Fullscreen Behavior

`cartelera.html` automatically requests fullscreen on first user click/touch. This works with the manifest.json `"display": "fullscreen"` setting. The reproductor then displays without browser chrome, ideal for kiosk mode on TVs.
