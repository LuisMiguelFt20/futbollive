# FutbolLive — Buscar noticias (GNews Education)

Se conserva el despliegue actual: React/Vite en Vercel, Node/Express en Render,
API-Football, BSD, football-data.org y YouTube. NewsAPI Developer sigue
deshabilitada en producción (`NEWS_PUBLIC_ENABLED=false`).

## Obtener GNews

1. Abrir https://gnews.io/student-education y solicitar acceso educativo.
2. Esperar aprobación. GNews tiene programa académico no comercial gratuito;
   los beneficios no se activan hasta aprobar la solicitud.
3. Crear cuenta, y tomar la API Key desde su panel. No compartirla.
4. En Render → servicio futbollive-api → Environment añadir:
   - GNEWS_API_KEY: tu clave real.
   - GNEWS_EDUCATION_APPROVED: true (SOLO si GNews aprobó el uso educativo).
   - Mantener NEWS_PUBLIC_ENABLED=false.
5. Subir los archivos de este ZIP a tu copia local del repositorio y luego:
   git add .
   git commit -m "Integra búsqueda de noticias con GNews académico"
   git push origin main
6. Render y Vercel publican de nuevo el commit por GitHub.
   Si la configuración no se actualiza automáticamente, desplegar manualmente.
7. Revisar https://futbollive-api.onrender.com/api/health (configured.gnews true)
8. Probar https://futbollive-api.onrender.com/api/noticias?q=Barcelona
9. Abrir https://futbollive-beige.vercel.app/, sección Noticias y buscar un equipo.

## Qué hace

- Busca noticias en español de las últimas 48 horas en GNews.
- Se consulta con Enter o con botón Buscar, no cada tecla.
- 10 artículos por consulta con caché de 30 minutos para ahorrar cuota.
- La clave siempre se usa en el backend y no está en el ZIP.
- La disponibilidad depende de las condiciones de la cuenta, la cobertura y el retraso.
- Si no hay GNews aprobado, la pantalla indica por qué no hay noticias.

## Licencias

El programa de educación es solo para proyectos académicos y no comerciales.
Las noticias enlazan a su fuente original. El contenido y las imágenes son de
sus editores; respeta siempre sus derechos. No convertir esta web en un producto
comercial con una clave académica sin cambiar de plan/licencia.

Fuentes: https://gnews.io/student-education
https://docs.gnews.io/endpoints/search-endpoint
