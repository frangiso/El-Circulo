# El Círculo — Sistema de Gestión Kinesiológica

## Instrucciones para poner en marcha el sistema

---

## 1. Crear el proyecto en Firebase

1. Entrá a https://console.firebase.google.com
2. Hacé clic en **"Agregar proyecto"**
3. Nombre: `elcirculo` (o el que quieras)
4. Desactivá Google Analytics si no lo necesitás → Crear proyecto

### Activar Authentication
- En el menú lateral → **Authentication** → **Comenzar**
- En la pestaña **"Sign-in method"** → Habilitá **"Correo electrónico/Contraseña"**

### Activar Firestore
- En el menú lateral → **Firestore Database** → **Crear base de datos**
- Elegí **"Comenzar en modo de producción"**
- Elegí la región más cercana (ej: `us-east1`)

### Copiar las credenciales
- En Firebase → ⚙️ Configuración del proyecto → **"Tus apps"** → Hacé clic en `</>`
- Copiá el objeto `firebaseConfig` que aparece

---

## 2. Configurar el proyecto

1. Abrí el archivo `src/firebase.js`
2. Reemplazá los valores del objeto `firebaseConfig` con los que copiaste de Firebase:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123..."
}
```

---

## 3. Copiar las reglas de Firestore

1. En Firebase → **Firestore Database** → pestaña **"Reglas"**
2. Borrá lo que hay y pegá el contenido del archivo `firestore.rules` de este proyecto
3. Hacé clic en **"Publicar"**

---

## 4. Agregar el logo

1. Copiá la imagen del logo de El Círculo
2. Renombrala como `logo.png`
3. Pegala dentro de la carpeta `public/`

---

## 5. Subir a GitHub y deployar en Vercel

### GitHub
1. Creá un repositorio nuevo en https://github.com (ej: `elcirculo-sistema`)
2. Subí todos los archivos del proyecto (arrastrá la carpeta o usá la interfaz web)

### Vercel
1. Entrá a https://vercel.com
2. **"New Project"** → Importá el repositorio de GitHub
3. Framework: **Vite**
4. Dejá todo por defecto → **Deploy**

---

## 6. Crear el primer usuario (dueño)

1. Una vez deployado, entrá al sistema y registrate con tu email
2. Abrí Firebase → **Firestore Database** → colección `usuarios`
3. Encontrá tu documento (buscá por email)
4. Editá los campos:
   - `rol` → `dueno`
   - `estado` → `activo`
5. Guardá

A partir de ahí ya podés ingresar como dueño y aprobar al resto de los usuarios desde el panel.

---

## Roles del sistema

| Rol | Acceso |
|-----|--------|
| **Dueño** | Todo el sistema + Usuarios + Logs + Reportes |
| **Kinesiológo** | Turnos, Pacientes, Caja, Reportes, Logs |
| **Secretaria** | Turnos, Pacientes, Caja |

---

## Estructura de carpetas

```
src/
  firebase.js          ← credenciales Firebase
  App.jsx              ← rutas y navegación
  index.css            ← estilos globales
  context/
    AuthContext.jsx    ← login, registro, sesión
  utils/
    helpers.js         ← días hábiles, logs, helpers
  pages/
    auth/              ← Login, Register, Pendiente
    dashboard/         ← Dashboard principal
    turnos/            ← Listado + Nuevo turno
    pacientes/         ← Listado + Ficha + Nuevo + Editar
    caja/              ← Control de caja
    reportes/          ← Reportes (dueño/kine)
    usuarios/          ← Gestión de usuarios (dueño)
    logs/              ← Registro de actividad
public/
  logo.png             ← Logo de El Círculo (agregarlo vos)
firestore.rules        ← Reglas de seguridad Firestore
```

---

## Funcionalidades incluidas

- ✅ Login y registro con aprobación de usuarios
- ✅ 3 roles: Dueño, Kinesiológo, Secretaria
- ✅ Gestión de pacientes con ficha completa
- ✅ Plan de sesiones con cálculo automático de 45 días hábiles
- ✅ Alertas de planes vencidos o por vencer
- ✅ Turnos con hora específica y kinesiológo
- ✅ Obras sociales: lista desplegable + posibilidad de agregar nuevas
- ✅ Control de caja: entradas, salidas, transferencias, saldo corriente
- ✅ Resumen por profesional en caja
- ✅ Reportes de sesiones por kinesiológo y secretaria
- ✅ Logs de toda la actividad del sistema
- ✅ Reglas de seguridad Firestore por rol
