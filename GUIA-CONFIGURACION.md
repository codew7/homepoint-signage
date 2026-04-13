# HomePoint - Cartelera Digital
## Guía de Configuración y Uso

---

## 1. Configuración de Firebase

### Paso 1: Crear proyecto en Firebase
1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Clic en **"Agregar proyecto"**
3. Nombre: `homepoint-signage` (o el que prefieras)
4. Desactiva Google Analytics (no es necesario)
5. Clic en **"Crear proyecto"**

### Paso 2: Activar Realtime Database
1. En el menú lateral, ve a **Build → Realtime Database**
2. Clic en **"Crear base de datos"**
3. Selecciona la ubicación más cercana (ej: `us-central1`)
4. Selecciona **"Iniciar en modo de prueba"** (después ajustaremos reglas)
5. Clic en **"Habilitar"**

### Paso 3: Activar Firebase Storage (para imágenes)
1. Ve a **Build → Storage**
2. Clic en **"Comenzar"**
3. Selecciona **modo de prueba**
4. Selecciona la ubicación
5. Clic en **"Listo"**

### Paso 4: Obtener credenciales
1. En la página principal del proyecto, clic en el ícono **</>** (Web)
2. Registra la app con nombre: `homepoint-signage`
3. Copia el objeto `firebaseConfig` que aparece

### Paso 5: Configurar los archivos
Abre `cartelera.html` y `admin.html`, busca la sección `FIREBASE_CONFIG` y reemplaza con tus datos:

```javascript
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD...",
  authDomain: "homepoint-signage.firebaseapp.com",
  databaseURL: "https://homepoint-signage-default-rtdb.firebaseio.com",
  projectId: "homepoint-signage",
  storageBucket: "homepoint-signage.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

### Paso 6: Reglas de seguridad (Realtime Database)
En Firebase Console → Realtime Database → Reglas, pega:

```json
{
  "rules": {
    "screens": {
      ".read": true,
      ".write": true
    },
    "shared": {
      ".read": true,
      ".write": true
    },
    "screenStatus": {
      ".read": true,
      ".write": true
    },
    "history": {
      ".read": true,
      ".write": true
    }
  }
}
```

> **Nota de seguridad:** En producción, limita `.write` solo a IPs autorizadas o usa Firebase Auth.

---

## 2. Despliegue

### Opción A: Firebase Hosting (recomendado)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Selecciona tu proyecto
# Directorio público: . (punto)
# Single-page app: No
firebase deploy
```

### Opción B: Cualquier servidor web
Simplemente copia `cartelera.html` y `admin.html` a tu servidor web (Apache, Nginx, etc.).

### Opción C: GitHub Pages
1. Sube los archivos a un repositorio de GitHub
2. Activa GitHub Pages en Settings → Pages
3. Usa la URL generada

---

## 3. Uso del Panel Administrativo

### Acceso
1. Abre `admin.html` en el navegador
2. Ingresa la contraseña: `homepoint2024` (cámbiala en el código)
3. Verás el panel de administración

### Agregar contenido
1. Selecciona el **tipo de slide**: Imagen, Texto, o Promoción
2. Sube una imagen (arrastrar o clic) o pega una URL
3. Agrega título, descripción y precio/etiqueta
4. Configura la duración en segundos
5. Clic en **"Agregar Slide"**

### Gestionar slides
- **Reordenar:** Usa las flechas ↑↓ o arrastra y suelta
- **Editar:** Clic en el ícono de lápiz ✎
- **Activar/Desactivar:** Clic en el punto ● para ocultar sin eliminar
- **Eliminar:** Clic en la X (pide confirmación)

### Configuración global
1. Clic en **"Configuración"** en el header
2. Ajusta:
   - Tipo de transición (fade, zoom, slide)
   - Velocidad de transición
   - Duración por defecto
   - Colores de la marca
   - Mostrar/ocultar reloj e indicadores

### Múltiples pantallas
1. Clic en **"+ Pantalla"** para crear una nueva
2. Selecciona la pantalla destino en el dropdown
3. Cada pantalla tiene su propio contenido independiente

---

## 4. Configuración de Pantallas (Reproductores)

### URL del reproductor
```
https://tu-dominio.com/cartelera.html?screen=NOMBRE_PANTALLA
```

Ejemplos:
- `cartelera.html?screen=default` → Pantalla principal
- `cartelera.html?screen=entrada` → Pantalla de entrada
- `cartelera.html?screen=ofertas` → Pantalla de ofertas

### Modo Kiosk en Chrome
Para que la pantalla funcione sin barra de herramientas:

**Windows:**
```
chrome.exe --kiosk --noerrdialogs --disable-infobars "https://tu-dominio.com/cartelera.html?screen=default"
```

**Linux:**
```
chromium-browser --kiosk --noerrdialogs --disable-infobars "https://tu-dominio.com/cartelera.html?screen=default"
```

**macOS:**
```
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --kiosk "https://tu-dominio.com/cartelera.html?screen=default"
```

### Auto-inicio en Windows
1. Crea un acceso directo con la línea de comando kiosk
2. Colócalo en: `C:\Users\<usuario>\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`

### Depuración
Presiona **Shift+D** en cualquier pantalla para ver información de estado.

---

## 5. Estructura de datos en Firebase

```
├── screens/
│   ├── default/
│   │   ├── content/
│   │   │   ├── slides/
│   │   │   │   ├── 0: { type, title, description, imageUrl, price, duration, active, bgColor, textColor }
│   │   │   │   └── ...
│   │   │   └── updatedAt: timestamp
│   │   └── config/
│   │       ├── transitionType: "fade"
│   │       ├── transitionSpeed: 1
│   │       ├── defaultDuration: 8
│   │       ├── primaryColor: "#e94560"
│   │       └── ...
│   └── entrada/
│       └── ...
├── screenStatus/
│   ├── default/
│   │   ├── online: true
│   │   ├── lastSeen: timestamp
│   │   ├── currentSlide: 0
│   │   └── ...
│   └── ...
├── shared/
│   └── content/ (contenido compartido para todas las pantallas)
└── history/
    └── -Nxx.../
        ├── message: "Slide agregado: Oferta TV"
        ├── screen: "default"
        └── timestamp: 1234567890
```

---

## 6. Cambiar contraseña del admin

En `admin.html`, busca esta línea y cambia el valor:

```javascript
var ADMIN_PASSWORD_PLAIN = 'homepoint2024'; // Cambiar en producción
```

---

## 7. Resolución de problemas

| Problema | Solución |
|----------|----------|
| Pantalla dice "Esperando contenido" | Verifica la config de Firebase y que haya slides activos |
| No se conecta a Firebase | Revisa las credenciales y que el proyecto esté activo |
| Imágenes no cargan | Verifica las URLs o que el storage de Firebase esté configurado |
| Cambios no se reflejan | Revisa la consola del navegador (F12) para errores |
| Pantalla aparece "Offline" | Verifica la conexión a internet del dispositivo |

---

## 8. Recomendaciones

- **Imágenes:** Usa resolución 1920x1080 para pantallas Full HD
- **Textos:** Mantén títulos cortos y legibles (máximo 5-6 palabras)
- **Duración:** 8-15 segundos por slide es ideal
- **Transiciones:** "Fade" es la más elegante para la mayoría de contenidos
- **Red:** Usa conexión cableada (Ethernet) en las pantallas para mayor estabilidad
