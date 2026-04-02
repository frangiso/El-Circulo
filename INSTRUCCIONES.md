# El Círculo v3 — Instrucciones

## 1. Subir a GitHub
Subí todos los archivos manteniendo la estructura de carpetas.

## 2. Firebase ya configurado
`src/firebase.js` ya tiene los datos de tu proyecto. No lo toques.

## 3. Reglas de Firestore
Firebase Console → Firestore → Reglas → pegá el contenido de `firestore.rules` → Publicar.

## 4. Índices de Firestore
La primera vez que uses el sistema aparecerán links en la consola del navegador para crear índices automáticamente. Hacé clic y Firebase los crea en ~1 minuto.

Índices requeridos:
- pacientes: archivado (Asc) + apellido (Asc)
- turnos: fecha (Asc) + hora (Asc)
- logs: ts (Desc)

## 5. Logo
Copiá `logo.png` a la carpeta `public/`.

## 6. Vercel
Conectá el repo en vercel.com → Framework: Vite → Deploy.

## 7. Primer usuario dueño
1. Registrate en el sistema
2. Firebase Console → Firestore → usuarios → tu documento
3. Cambiá `rol` a `dueno` y `estado` a `activo`

---

## Optimizaciones de lectura

| Panel | Comportamiento | Lecturas |
|-------|---------------|----------|
| Dashboard | Carga automática | ~3 lecturas al abrir |
| Turnos | **Vacío hasta buscar** | 0 hasta que eligen fecha |
| Pacientes | **Vacío hasta buscar** | 0 hasta que escriben |
| Pacientes archivados | Solo al hacer clic en la solapa | 1 lectura bajo demanda |
| Caja | 1 doc por mes completo | 1 lectura por mes |
| Reportes | Solo turnos del mes | 1 lectura por mes |
| Logs | 100 docs, solo al abrir | 1 lectura bajo demanda |
| Usuarios | Caché de sesión | 1 lectura por sesión |

**Estimación:** ~2.000-5.000 lecturas/día con uso normal. Muy por debajo del límite de 50.000 del plan Spark gratuito.

## Limpieza automática (silenciosa)
Al iniciar sesión cada usuario:
1. Archiva en batch los pacientes con plan vencido
2. Borra automáticamente los archivados hace +12 meses

Los profesionales no lo notan. Todo corre en background.
