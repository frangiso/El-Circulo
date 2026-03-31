# El Círculo — Sistema de Gestión Kinesiológica

## Instalación paso a paso

### 1. Subir archivos a GitHub

Subí todos los archivos y carpetas manteniendo la estructura exacta.

### 2. Configurar Firebase

1. Entrá a https://console.firebase.google.com
2. Creá un nuevo proyecto llamado "elcirculo"
3. Activá **Authentication** → Correo electrónico/Contraseña
4. Activá **Firestore Database** → Modo producción
5. En Configuración del proyecto → Agregar app web → copiá los datos

### 3. Pegar la config de Firebase

Abrí el archivo `src/firebase.js` y reemplazá los valores:

```js
const firebaseConfig = {
  apiKey: "TU_API_KEY_REAL",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
}
```

### 4. Reglas de Firestore

En Firebase Console → Firestore → Reglas, pegá esto:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuth() { return request.auth != null; }
    function getUser() { return get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data; }
    function isActive() { return isAuth() && getUser().estado == 'activo'; }
    function isDueno() { return isActive() && getUser().rol == 'dueno'; }
    function isKine() { return isActive() && (getUser().rol == 'kinesiologo' || getUser().rol == 'dueno'); }

    match /usuarios/{uid} {
      allow read: if isActive();
      allow create: if request.auth != null;
      allow update: if isDueno() || request.auth.uid == uid;
    }
    match /pacientes/{id} {
      allow read, write: if isActive();
    }
    match /turnos/{id} {
      allow read, write: if isActive();
    }
    match /caja/{id} {
      allow read, write: if isActive();
    }
    match /logs/{id} {
      allow read: if isKine();
      allow create: if isActive();
    }
    match /obrasSociales/{id} {
      allow read, write: if isActive();
    }
  }
}
```

### 5. Agregar el logo

Copiá el logo del centro (imagen PNG) a la carpeta `public/` con el nombre `logo.png`.

### 6. Crear el primer usuario dueño

1. Desplegá en Vercel y abrí el sistema
2. Registrate con tu email
3. En Firebase Console → Firestore → colección `usuarios` → tu documento → cambiá `rol` a `dueno` y `estado` a `activo`
4. A partir de ahí podés aprobar a los demás usuarios desde el panel

### 7. Desplegar en Vercel

1. Conectá el repo de GitHub en vercel.com
2. Framework: Vite
3. Deploy

---

## Índices de Firestore necesarios

En Firebase Console → Firestore → Índices, creá estos índices compuestos:

| Colección | Campo 1 | Campo 2 | Orden |
|-----------|---------|---------|-------|
| turnos | fecha (Asc) | hora (Asc) | — |
| caja | mes (Asc) | timestamp (Asc) | — |
| logs | timestamp (Desc) | — | — |

Firebase también te va a mostrar links directos para crear los índices cuando aparezcan errores en consola la primera vez que uses la app.

---

## Roles del sistema

| Rol | Acceso |
|-----|--------|
| **Secretaria** | Turnos, Pacientes, Caja |
| **Kinesiológo** | Turnos, Pacientes, Caja, Reportes, Logs |
| **Dueño** | Todo + Usuarios |

---

## Estructura de colecciones Firestore

- `usuarios` — datos de cada usuario con rol y estado
- `pacientes` — ficha completa con plan de sesiones
- `turnos` — cada turno con fecha, hora, kinesiológo y paciente
- `caja` — movimientos de caja por mes
- `logs` — registro de actividad automático
- `obrasSociales` — obras sociales personalizadas

