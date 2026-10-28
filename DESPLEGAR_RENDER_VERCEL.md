# FUTBOLLIVE - PUBLICAR CON RENDER + VERCEL (2026)

Este ZIP ya trae la conexión remota preparada. Para publicar primero el backend y luego React.

## 0. Seguridad antes de GitHub
- Guarda una copia de tu `backend/.env` y `backend/.runtime` fuera del proyecto.
- No subas claves a GitHub. `.gitignore` ya ignora `.env`, `.env.*` excepto `.env.example`.
- El sitio público podría consumir tus cuotas de APIs; controla el acceso y las consultas.

## 1. Subir el repositorio a GitHub
- Extrae la carpeta `futbollive` (que contiene `backend`, `frontend` y `render.yaml`).
- Crea un repositorio VACÍO en GitHub, por ejemplo `futbollive`.
- En CMD dentro de `C:\xampp\htdocs\futbollive`:

```bat
git init
git add .
git status
git commit -m "Prepara FutbolLive para Render y Vercel"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/futbollive.git
git push -u origin main
```

Revisa `git status` antes del commit: `backend/.env` JAMÁS debe aparecer.

## 2. Render: backend (primero)
- https://dashboard.render.com/ > New > Web Service > conecta GitHub y selecciona `futbollive`.
- Root Directory: `backend` (MUY IMPORTANTE).
- Language: Node; Build Command: `npm install`; Start Command: `npm start`; Instance Type: **Free**.
- En Environment crea: `FOOTBALL_API_KEY`, `BZZOIRO_API_KEY`, `FOOTBALL_DATA_TOKEN`, `YOUTUBE_API_KEY`. Copia los valores privados SOLO allí.
- Otras variables: `NODE_ENV=production`, `FOOTBALL_DAILY_BUDGET=50`, `YOUTUBE_DAILY_SEARCH_BUDGET=5`, `NEWS_PUBLIC_ENABLED=false`.
- No pongas `PORT=3001` en Render: Render proporciona su propio PORT.
- Publica y copia tu URL real `https://NOMBRE.onrender.com`.
- Prueba `https://NOMBRE.onrender.com/api/health`.  `configured:true` solo comprueba presencia de la clave, no garantiza respuestas correctas.
- También puedes desplegar con Blueprint usando `render.yaml` (desde raíz del repo) y rellenar los secretos solicitados, pero es más simple Web Service manual.

## 3. Vercel: frontend (después)
- https://vercel.com/new > Import Git Repository > selecciona `futbollive`.
- Root Directory: `frontend` (MUY IMPORTANTE).
- Framework Preset: **Vite**; Build Command `npm run build`; Output Directory `dist`.
- Settings > Environment Variables > Agrega exactamente `VITE_API_URL` = `https://NOMBRE.onrender.com` (sin `/api` al final).
- Selecciona Production; si aplica, también Preview.
- Pulsa Deploy. La dirección pública será como `https://futbollive-....vercel.app`, según disponibilidad.
- Si configuraste VITE_API_URL después del primer despliegue, pulsa Redeploy para reconstruir el frontend.
- Prueba Inicio, Partidos, Clasificación, Videos.

## 4. Cuando aparece vacío o `Failed to fetch`
- Prueba primero la dirección de Render `/api/health`.
- Comprueba el valor de `VITE_API_URL` en Vercel: debe tener `https://`, no llevar `/api`, y la URL debe ser la REAL del backend.
- En Vercel haz **Redeploy** tras cambiar variables (se insertan durante build).
- Si Render Free estaba inactivo, la primera petición puede tardar alrededor de un minuto.
- Si hay error CORS, comprueba que el backend arranque y que uses esta versión (`app.use(cors())`).
- Si el límite gratuito de API-Football o YouTube se agotó, la app no puede inventar resultados.
- Si hay 404 en una ruta de React al actualizar, se incluye `frontend/vercel.json` para fallback SPA.

## 5. Importante: planes gratuitos y NewsAPI
- Render Free duerme tras 15 min sin tráfico y su filesystem es EFÍMERO: `backend/.runtime` (caché / contador local) se pierde al reiniciar, redeplegar o dormir. El estado del proveedor no se reinicia. Para más fiabilidad, usar base de datos persistente.
- NewsAPI **Developer gratuito SOLO permite entornos de desarrollo** y no autoriza un sitio público de producción. Esta versión bloquea ese endpoint en NODE_ENV=production salvo `NEWS_PUBLIC_ENABLED=true` (solo si cuentas con licencia válida). No subas la clave de NewsAPI a Render mientras uses Developer.
- La página pública no garantiza disponibilidad 24/7 ni marcadores instantáneos en planes gratuitos.
- Guardar claves en Render, nunca como variables `VITE_`, pues esas se compilan para el navegador.

## 6. Desarrollo local intacto
En localhost puedes seguir usando 2 terminales:
Backend: `cd /d C:\xampp\htdocs\futbollive\backend` y `npm start`.
Frontend: `cd /d C:\xampp\htdocs\futbollive\frontend` y `npm run dev`.
En local, al no definir `VITE_API_URL`, se conserva el proxy de Vite hacia `localhost:3001`.
