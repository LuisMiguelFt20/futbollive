# FutbolLive — listo para Render + Vercel

**Despliegue público:** consulta primero [`DESPLEGAR_RENDER_VERCEL.md`](DESPLEGAR_RENDER_VERCEL.md), con los pasos precisos para GitHub, Render y Vercel.

**Seguridad:** nunca subir `backend/.env` real a GitHub. La aplicación publicada limita NewsAPI Developer por sus condiciones de licencia.

---

# FutbolLive — edición visual aprobada · 2 días · 5 APIs

## ✅ Interfaz rediseñada según tu maqueta

Esta entrega contiene el **proyecto completo** (frontend React + Vite y backend Node + Express), no solamente una imagen.

- Encabezado grande con **Inicio, Partidos, Clasificación, Equipos, Noticias y Videos**. Sin buscador superior ni avatar «FL».
- Logotipo FutbolLive con tamaño corregido, modo oscuro/claro, y menú móvil funcional.
- Hero ilustrado con jugador y balón obtenido de la **maqueta aprobada** (arte recortado, no una captura superpuesta con texto), además del titular y botón «Explorar ligas».
- Nueve tarjetas de ligas en colores y **banderas locales SVG** en cada tarjeta, menú lateral y listado.
- Escudos de ligas desde el CDN de API-Sports cuando están disponibles; si faltan, aparece un distintivo visual en lugar de un cuadro roto.
- Portada en tres paneles: **Partidos en vivo**, **Últimas noticias**, **Ligas**. Los resultados y noticias proceden de tus APIs reales: **no hay marcadores ficticios tomados de la maqueta**.
- Vistas interiores preservadas: partidos de hoy y mañana, tabla de posiciones, equipos, noticias, resúmenes y ligas individuales.
- **Cinco APIs existentes intactas:** API-Football, BSD (respaldo automático), football-data.org (tablas), NewsAPI (noticias) y YouTube Data API (resúmenes).
- Se evita buscar videos de YouTube en Inicio para no consumir su cuota por abrir la portada.

## Instalar / actualizar en Windows

1. **Cierra las dos terminales** de FutbolLive con `Ctrl + C`.
2. **Guarda una copia de `C:\xampp\htdocs\futbollive\backend\.env` y `backend\.runtime`**, si existe, antes de reemplazar archivos. No están incluidos en este ZIP porque contienen claves y datos locales.
3. Extrae `futbollive` del ZIP en `C:\xampp\htdocs\`. Mantén tus claves al restaurar el `.env` anterior.
4. Si es una instalación nueva, ejecuta `instalar-futbollive.bat`, luego introduce las claves privadas en `backend\.env`.
5. Ejecuta `iniciar-futbollive.bat` o usa dos terminales CMD:

   Backend:
   ```bat
   cd /d C:\xampp\htdocs\futbollive\backend
   npm install
   npm start
   ```

   Frontend:
   ```bat
   cd /d C:\xampp\htdocs\futbollive\frontend
   npm install
   npm run dev
   ```

6. Visita `http://localhost:5173/` y actualiza con `Ctrl + F5` si ves la interfaz anterior.
7. Comprueba `http://localhost:3001/api/health` y `http://localhost:3001/api/bsd/prueba`.

### Variables que debe contener `backend/.env`

```dotenv
PORT=3001
FOOTBALL_API_KEY=TU_CLAVE_REAL
BZZOIRO_API_KEY=TU_CLAVE_REAL
NEWS_API_KEY=TU_CLAVE_REAL
YOUTUBE_API_KEY=TU_CLAVE_REAL
FOOTBALL_DATA_TOKEN=TU_TOKEN_REAL
FOOTBALL_DAILY_BUDGET=75
YOUTUBE_DAILY_SEARCH_BUDGET=35
```

**No compartas tus claves ni subas `.env` a GitHub.**

**Los partidos en vivo pueden aparecer vacíos si no hay encuentros reales o si la cuota/cobertura del proveedor es limitada.** El panel de Inicio usa los partidos de la ventana de dos días que el backend tiene en caché; para consultar el endpoint específico de encuentros en vivo, abre la pestaña *Partidos*. La imagen aprobada es una **referencia estética**, no datos de resultados reales.

---

# FutbolLive — 2 días + 5 APIs y respaldo automático de partidos

## NUEVO: BSD como respaldo de API-Football

La página conserva **hoy y mañana** y las cuatro integraciones anteriores. Esta versión añade
**Bzzoiro Sports Data (BSD)** exclusivamente como segundo proveedor de partidos:

1. El servidor consulta normalmente **API-Football**.
2. Si no hay clave de API-Football, se agota el presupuesto local, la cuota oficial o el proveedor falla,
   el servidor consulta **BSD automáticamente**. También intenta BSD si solo existe una copia antigua
   de API-Football en caché.
3. BSD consulta `GET /api/v2/events/` y `GET /api/v2/events/live/`, con cabecera
   `Authorization: Token CLAVE`, y devuelve datos normalizados para React.
4. Si API-Football responde correctamente con **cero partidos**, NO se considera un error ni se fuerza el respaldo.
5. La respuesta JSON indica `source: api-football`, `bsd` o `mixed`. Las tablas siguen procediendo
   de football-data.org; noticias de NewsAPI y videos de YouTube.

**No se requiere contratar WebSockets**; se utiliza solamente la API REST gratuita de BSD.
La cobertura, frescura y escudos pueden variar entre proveedores. Los identificadores de equipos y
ligas de BSD nunca se envían como identificadores de API-Football. Si una competición no se puede
identificar sin ambigüedades en BSD, no se adjudica incorrectamente a otra liga.

### Instalación / actualización

1. Respaldar `backend/.env` y **la carpeta** `backend/.runtime` antes de reemplazar archivos.
2. Extraer el ZIP en `C:\xampp\htdocs\`, conservando el nombre de carpeta `futbollive`.
3. En `backend/.env` agregar **solo** `BZZOIRO_API_KEY=TU_TOKEN_PRIVADO` (el token de BSD; no tu contraseña).
   Mantener las claves previas de API-Football, NewsAPI, YouTube y football-data.org.
4. Ejecutar `instalar-futbollive.bat` la primera vez que instales dependencias; si ya están, no es necesario.
5. Ejecutar `iniciar-futbollive.bat` o `npm start` en backend y `npm run dev` en frontend.
6. Abrir http://localhost:3001/api/health y comprobar `configured.bsd: true`.
7. **Probar la clave sin gastar API-Football:** http://localhost:3001/api/bsd/prueba
8. **Probar el proveedor BSD manualmente:** http://localhost:3001/api/futbol/dos-dias?provider=bsd
9. **Probar el failover normal:** http://localhost:3001/api/futbol/dos-dias
10. Frontend: http://localhost:5173/

Para probar BSD no necesitas agotar artificialmente API-Football. El cambio automático de proveedor
solo se activa bajo las condiciones indicadas. El presupuesto `FOOTBALL_DAILY_BUDGET=75` no se cambia
ni se reinicia artificialmente. El backend conserva la sincronización de cuota de API-Sports.

**Seguridad:** nunca compartir el token de BSD, no pegarlo en React y no subir `.env` a GitHub.

---

# FutbolLive — edición 2 días + 4 APIs + resúmenes por partido

**Proyecto completo** desarrollado en React + Vite (frontend) y Node.js + Express (backend).
Interfaz en español, oscura y adaptable, con resultados reales de los proveedores cuando tengas acceso.

## Novedades de esta edición

- **Calendario dinámico: HOY y MAÑANA únicamente**, según la zona horaria de Perú. No hay fechas antiguas ni siete días por consultar. El calendario avanza al cambiar de fecha.
- Partidos pendientes, en vivo y finalizados con marcadores, escudos, ligas y horarios; filtros por competición y favoritos locales.
- **Clasificación actualizada de temporada completa**, no limitada a dos días: football-data.org para Premier League (PL), LaLiga (PD), Bundesliga (BL1), Serie A (SA) y Ligue 1 (FL1). Escudos, PJ, G, E, P, DG, puntos, selección de temporadas cuando el proveedor lo admite.
- **API-Football se mantiene** para fixtures, resultados y partidos en directo; para ligas no cubiertas por football-data.org las tablas siguen dependiendo de las restricciones de API-Football.
- NewsAPI para titulares con imágenes por competición. **Importante:** el plan gratuito Developer retrasa alrededor de 24 horas, por lo que las noticias muestran **los últimos dos días disponibles** (desde hace 72 hasta hace 24 horas), no se presentan como noticias de hoy.
- **YouTube Data API v3 — resúmenes de partidos reales:** consulta los encuentros finalizados de hoy y mañana por API-Football, busca videos por ambos equipos, valida que el título contenga sus nombres y un término de resumen/highlights/goles, y verifica que el video se haya publicado después del encuentro y dentro de estas dos fechas. Si no existe un resumen coincidente, muestra un aviso; nunca sustituye por un video de otro partido.
- **Por liga:** al elegir Premier League, Bundesliga, LaLiga, etc., solo se aceptan resúmenes correspondientes a sus partidos finalizados.
- **Cuota YouTube:** busca a lo sumo cinco partidos por lote al entrar a Videos (más partidos solo al pulsar «Siguientes 5 encuentros»), guarda las búsquedas en caché y usa un presupuesto preventivo de 35 búsquedas/día configurables (`YOUTUBE_DAILY_SEARCH_BUDGET=35`). YouTube tiene un límite predeterminado de 100 llamadas a `search.list` por día. Entrar a Inicio o Resumen no consume búsquedas YouTube para videos; haz clic en Videos para buscar.
- **Limitación real:** YouTube no garantiza que exista un resumen de cada partido, que un canal lo suba el mismo día o que sus títulos sigan un formato estándar. Solo se mostrarán coincidencias verificables de título y fecha, aunque esto puede omitir algunos videos correctos.
- React actualiza las pantallas de partidos cada 60 segundos, pero **API-Football no consulta cada minuto de manera ilimitada**: usa caché, límite diario preventivo de 75, y política de consulta de en vivo según datos ya guardados.
- Ligas individuales: pestañas Resumen, Resultados, En vivo, Partidos, Clasificación, Noticias y Videos.
- Interfaz sin anuncios de apuestas. Datos ficticios solo como **demostración explícita** si falta alguna credencial.

## 1. Instalación en Windows

Requisitos: Node.js 20 o superior, acceso a Internet para `npm install`, VS Code opcional.
No necesitas iniciar Apache, XAMPP ni MySQL, aunque puedes guardar el proyecto bajo `C:\xampp\htdocs`.

**IMPORTANTE SI YA TIENES FUTBOLLIVE INSTALADO:** antes de sustituir la carpeta, copia a un sitio seguro los archivos `backend\.env` (las claves) y `backend\.runtime\state.json` (el contador de solicitudes y la caché), si existe. **No borres la carpeta `.runtime` para intentar reiniciar artificialmente la cuota**. Recomendamos renombrar la carpeta anterior a `futbollive-anterior`, extraer esta nueva con el nombre `futbollive` y restaurar ambos archivos al nuevo `backend`.

A. Descomprime `FutbolLive_Completo_2_Dias_4_APIs.zip` en `C:\xampp\htdocs`. Debe quedar:

```
C:\xampp\htdocs\futbollive\backend
C:\xampp\htdocs\futbollive\frontend
C:\xampp\htdocs\futbollive\instalar-futbollive.bat
C:\xampp\htdocs\futbollive\iniciar-futbollive.bat
```

B. Haz doble clic en `instalar-futbollive.bat` (instala dependencias). Si tienes las dependencias de una instalación anterior, puedes ejecutar `npm install` nuevamente; no se borra el proyecto.

C. Abre `backend\.env` y pega tus **cuatro claves reales**:

```dotenv
PORT=3001
FOOTBALL_API_KEY=TU_CLAVE_API_SPORTS
NEWS_API_KEY=TU_CLAVE_NEWSAPI
YOUTUBE_API_KEY=TU_CLAVE_YOUTUBE
FOOTBALL_DATA_TOKEN=TU_TOKEN_FOOTBALL_DATA
FOOTBALL_DAILY_BUDGET=75
YOUTUBE_DAILY_SEARCH_BUDGET=35
```

No compartas el `.env` ni lo subas a GitHub. El ZIP contiene únicamente `.env.example` **sin claves**; en una actualización conviene conservar tu `.env` existente.

D. Haz doble clic en `iniciar-futbollive.bat` y mantén abiertas las dos terminales.
Abre **http://localhost:5173/**.

### Alternativa: dos terminales CMD

**CMD 1 — backend:**

```bat
cd /d C:\xampp\htdocs\futbollive\backend
npm install
npm start
```

**CMD 2 — frontend:**

```bat
cd /d C:\xampp\htdocs\futbollive\frontend
npm install
npm run dev
```

Si ya instalaste las dependencias, omite `npm install`.

## 2. Comprobar las cuatro APIs

- `http://localhost:3001/api/health` — debe mostrar `configured.football`, `configured.news`, `configured.youtube`, `configured.footballData`; **true significa token leído, no conexión externa verificada**.
- `http://localhost:3001/api/futbol/dos-dias` — partidos de HOY y MAÑANA, hora Perú.
- `http://localhost:3001/api/futbol/semana` — misma ruta anterior conservada para compatibilidad; ahora **2 días**.
- `http://localhost:3001/api/futbol/partidos` — partidos de hoy (solo hoy o mañana con el parámetro `date`).
- `http://localhost:3001/api/futbol/en-vivo` — partidos que están en vivo si hay cobertura.
- `http://localhost:3001/api/futbol/clasificacion?league=39` — tabla **actual de Premier League** desde football-data.org.
- `http://localhost:3001/api/futbol/clasificacion?league=140` — LaLiga desde football-data.org.
- `http://localhost:3001/api/futbol/clasificacion?league=78` — Bundesliga desde football-data.org.
- `http://localhost:3001/api/futbol/clasificacion?league=135` — Serie A desde football-data.org.
- `http://localhost:3001/api/futbol/clasificacion?league=61` — Ligue 1 desde football-data.org.
- `http://localhost:3001/api/football-data/estado` — estado de configuración y códigos admitidos.
- `http://localhost:3001/api/noticias?league=39` — titulares de Premier League de los 2 últimos días disponibles.
- `http://localhost:3001/api/videos?league=39` — videos relacionados con Premier League del intervalo hoy-mañana.

Para una liga o temporada fuera de la cobertura de tu plan, aparecerá un mensaje informativo y no inventaremos la tabla. El escudo proviene de football-data.org y puede ser SVG.

## 3. Cuotas y resultados en vivo

API-Football Free: 100 solicitudes al día del proveedor. FutbolLive pone un límite interno de seguridad de 75 solicitudes diarias. El contador interno se conserva en `.runtime/state.json`, también al reiniciar Node.js. No confundas el contador local con el contador de solicitudes que muestra el sitio de API-Sports. En caso de límite, puede presentar datos cacheados con aviso o mensajes de error.

football-data.org: plan gratuito ~10 llamadas/minuto, aquí se mantienen las tablas en caché 45 minutos y se limita preventivamente a 8/minuto por proceso. Las tablas corresponden a la temporada, **no a hoy y mañana**.

NewsAPI Developer: gratuita para pruebas, noticias con ~24 horas de retraso, no autorizada para publicar una web en producción sin cambiar de plan.

YouTube Data API: cada `search.list` cuesta unidades de cuota (normalmente 100), por lo que se aplica caché de 12 horas por búsqueda.

**En vivo**: React consulta al backend cada minuto y el servidor usa caché (hasta 5 minutos si hay partidos, 20 minutos si no). Esto es actualización automática, **no transmisión minuto a minuto garantizada**.

## 4. Carpetas

```
futbollive/
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env.example
│   └── .runtime/          # se crea al ejecutar; NO viene en el ZIP
├── frontend/
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── src/
│       ├── main.jsx
│       └── style.css
├── instalar-futbollive.bat
├── iniciar-futbollive.bat
├── .gitignore
└── README.md
```

## 5. Límites reales y pruebas

No hemos probado una llamada autenticada con tus cuatro claves: son privadas y no se incluyen en esta entrega.
Si la página muestra error de temporada o de cobertura, la respuesta procede del proveedor; revisa la URL de `/api/futbol/clasificacion?league=39` para diagnosticar.

Si ves `EADDRINUSE` en CMD, ya hay un servidor en el puerto 3001: detén el anterior (Ctrl+C), o busca su PID antes de matarlo.

**Fuentes oficiales:**

- https://docs.football-data.org/general/v4/policies.html
- https://www.football-data.org/documentation/quickstart
- https://www.api-football.com/documentation-v3
- https://newsapi.org/docs/endpoints/everything
- https://developers.google.com/youtube/v3/docs/search/list

## Nueva comprobación: resúmenes de partidos (no videos genéricos)

Con el backend y frontend encendidos, abre: `http://localhost:5173/` → **Videos** → selecciona una liga, o entra en una liga y pulsa **Videos**. Las consultas solo consideran partidos finalizados de hoy y mañana.

Para revisar la respuesta JSON: `http://localhost:3001/api/videos?league=39` (Premier League). Puedes añadir `&day=AAAA-MM-DD` para filtrar uno de los dos días vigentes, o `&offset=5` para buscar el siguiente lote de hasta cinco partidos finalizados. Los campos `finishedMatches`, `checkedMatches` y `matchedVideos` ayudan a distinguir entre ausencia de partidos, resumen no publicado y búsqueda correcta.

Si no se encuentran resultados, **no es un fallo automático**: puede no haber partidos terminados o ningún canal ha publicado resúmenes con ambos equipos en el título dentro del intervalo. Los resultados de YouTube no son una fuente oficial de los partidos; valida la procedencia del canal al abrirlos.


## Mejoras de legibilidad y control de cuota (octubre 2026)

- Tipografía y escudos más grandes en menús, equipos, marcadores, tablas, noticias y videos.
- El backend comprueba la cuota preventiva según el día UTC de API-Sports, que se reinicia a las 00:00 UTC (19:00 de Perú). No borres `backend/.runtime/state.json` para aparentar recuperar solicitudes: es un control local, no la cuota del proveedor.
- Caché de partidos de **hoy 45 minutos**, de mañana **4 horas** y de partidos en vivo **15 min** si hay encuentros o **60 min** si no hay ninguno. Son frecuencias conservadoras para el plan gratuito. Las puntuaciones NO se actualizarán minuto a minuto.
- React deja de pedir los partidos o en vivo en las pantallas donde no se necesitan, y actualiza el indicador de cuota sin hacer llamadas externas.
- Cuando no se pueden obtener los partidos por cuota o restricciones, la pantalla diferencia la falta de datos de un día sin encuentros.
- Las tablas de las cinco ligas principales siguen usando football-data.org, independiente de API-Football. NewsAPI y YouTube conservan sus respectivas cuotas.

Conserva `.env` y la carpeta `.runtime` al sustituir el proyecto. Un `used:75` continuará apareciendo hasta el reinicio de cuota, salvo que ya haya cambiado el día UTC. Cambiar o borrar manualmente el contador **no restaura la cuota del proveedor**.


## Corrección del contador de API-Football

Esta edición sincroniza la cuota local con `GET https://v3.football.api-sports.io/status` (no consume la cuota diaria) cada dos minutos, incluyendo cuando se abre `/api/health`. El indicador `footballBudget.verifiedWithProvider` señala si se pudo verificar; si falla la consulta, la aplicación NO desbloquea solicitudes a ciegas.

Por ejemplo, si el dashboard oficial indica 11 solicitudes usadas y el límite local de seguridad es 75, FutbolLive podrá mostrar `used: 11, remaining: 64` después de la sincronización. Esto no aumenta ni evita los límites reales del proveedor. El token sigue exclusivamente en `backend/.env`. No borres `.runtime` ni cambies tu clave.

## Búsqueda de noticias en la publicación pública

La integración opcional de GNews para estudiantes está explicada en
`NOTICIAS_GNEWS_LEER_PRIMERO.md`. No requiere colocar claves en Vercel.
