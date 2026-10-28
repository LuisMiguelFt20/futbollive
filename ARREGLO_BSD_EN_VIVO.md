# FutbolLive — reparación de BSD para marcadores en vivo

## Qué se corrigió
- El listado compacto `/events/live/` de BSD puede traer el estado en `time.status` (no `status`). Antes el backend filtraba estos partidos como si no estuvieran en vivo.
- La ruta de partidos en vivo ahora reconoce que la fuente `/events/live/` ya contiene únicamente eventos activos; utiliza también el reloj en `time.minute`, el inicio en `time.kickoff_at` y el identificador `event_id` cuando corresponda.
- La variable `FOOTBALL_PRIMARY_DISABLED=true` permite trabajar solo con BSD mientras la cuenta API-Football esté suspendida, sin gastar solicitudes intentando consultar un servicio bloqueado. Se mantienen las otras APIs y las rutas existentes.

## Aplicación en Render
1. Reemplaza el código de tu carpeta `C:\xampp\htdocs\futbollive` por este ZIP, **sin borrar tu carpeta `.git` ni sobrescribir las claves privadas `.env`**.
2. Ejecuta desde la carpeta `futbollive`: `git add .`, `git commit -m "Corrige partidos BSD en vivo"`, `git push origin main`.
3. En Render > futbollive-api > Environment, agrega `FOOTBALL_PRIMARY_DISABLED` = `true` y aplica los cambios. Mantén `BZZOIRO_API_KEY` con el token verdadero.
4. Verifica en `https://futbollive-api.onrender.com/api/health` que `matchProviders.primary` sea `BSD`.
5. Visita `/api/bsd/prueba`, luego `/api/futbol/en-vivo?provider=bsd` y `/api/futbol/dos-dias?provider=bsd`.
6. Vercel seguirá usando la misma URL de Render. No hace falta cambiar `VITE_API_URL`.

**Importante**: solo se muestran partidos realmente proporcionados por BSD; si no hay partidos, el resultado correcto será vacío. Los partidos en vivo que BSD cubra deben aparecer aunque no coincidan con las nueve ligas destacadas, siempre que no se aplique un filtro de liga. BSD puede no disponer de los escudos y cobertura que antes proveía API-Football.

Para volver a API-Football cuando se reactive tu cuenta, cambia `FOOTBALL_PRIMARY_DISABLED` a `false` y aplica el despliegue en Render.
