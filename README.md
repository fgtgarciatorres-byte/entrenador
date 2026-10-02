# Cancha · Asistente de entrenador

Piloto local para un club de baloncesto infantil. Se abre directamente con `index.html`; para probar el micrófono en Chrome o Edge es preferible servir la carpeta en `localhost`.

## Incluye

- Panel de inicio con recomendaciones según partido anterior y próximo rival.
- Registro de jugadores únicamente por dorsal.
- Notas locales por dorsal, sin nombres.
- Importación de resultados desde un CSV con columnas `fecha,rival,resultado,lectura`.
- Formación en siete microcapítulos sobre motivación, estrés, frustración, comunicación y familias.
- Voz mediante Web Speech API: reconocimiento y lectura de respuesta.
- Botón para abrir ChatGPT y copiar el contexto de la consulta. La sesión de ChatGPT permanece en la cuenta del usuario y no se almacenan credenciales.
- Carga de materiales del club en texto, Markdown o JSON desde Formación.
- Resumen automático de victorias, promedio anotado y diferencia media.
- Exportación e importación de una copia local en JSON.
- PWA instalable en móvil con `manifest.json` y `sw.js`.
- Logo oficial BSB integrado en la aplicación.

## Ejecutar

```powershell
cd .\entrenador
python -m http.server 4173
```

Abrir `http://localhost:4173`.

## Instalar en el teléfono

Publica esta carpeta en GitHub Pages. Desde Chrome o Edge en el teléfono, abre la URL publicada y elige `Instalar app` o `Añadir a pantalla de inicio`. La aplicación guarda los datos en el propio dispositivo.

## Límites del piloto

El análisis automático incluido es local y parte de los partidos que se carguen: no llama a una API de IA ni sincroniza un repositorio remoto del club. Para producción habría que añadir autenticación, permisos por entrenador, servidor, base de datos, repositorio de contenidos y una integración oficial con la API elegida. Las notas, estadísticas y materiales cargados se guardan en `localStorage` del navegador.
