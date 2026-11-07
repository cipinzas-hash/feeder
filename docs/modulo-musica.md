# Módulo de música (🎧) — descubrimiento de lanzamientos

Estado: **Fase 1 fusionada a `main`** (1-nov-2026). Reemplaza a la categoría "Dark scene / Música" del Feed.

## Qué hace
Un carrusel con un lanzamiento a la vez (portada + reproductor) y, desde ahí, la **ficha del artista**: bio, ubicación, foto, discografía completa con carátulas y nombres, reproductor por disco, links y las noticias que lo mencionan. El único estado persistente es el ♥ (ver "Me gusta y directorio de artistas", Fase 2).

## Decisiones tomadas (de Cris)
- "Conciertos" se queda en Vitrina; no se mueve.
- Los lanzamientos salen **solo de los blogs** actuales (Side-Line, Post-Punk.com, Electrozombies).
- Lo ya guardado en el **Buzón** sigue mostrándose como noticia en modo legacy (`MusicExtendedView`).
- La categoría "Dark scene / Música" **ya no existe en el Feed**: sus noticias no van en `feed.json` y las que quedaban sin leer en la cola se retiran al abrir el Feed (el Buzón no se toca).

## Cómo fluyen los datos
```
build-feed.mjs  ──►  data/musica-noticias.json   (las 3 fuentes; ya NO van a feed.json)
build-musica.mjs ──►  data/musica.json            (lanzamientos + fichas de artista)
MusicaPage.jsx   ◄──  MUSICA_JSON_URL             (shared/constants.js)
```
`update-feed.yml` corre `build-musica` justo después de `build-feed` (con `continue-on-error`: si falla, el feed no se cae). `update-musica.yml` es la herramienta **manual** (modo `build` / `musica` / `capturar`).

## Cómo se arma cada ficha (`scripts/build-musica.mjs`)
1. **Gemini** extrae `{es_lanzamiento, tipo, artista, disco}` de cada titular (respaldo heurístico sin key; cache por guid). Varias noticias del mismo disco → una tarjeta con todas sus fuentes.
2. **Bandcamp es el ancla** de identidad y contenido (`scripts/lib/bandcamp.mjs`): su página `/music` entrega discografía completa (títulos, carátulas, IDs de reproductor), bio, ubicación y foto en una request. Las páginas de **sello** se filtran por artista y se sigue hasta la página propia de la banda. Una página que contiene el disco pero **no se llama como el artista** nunca se toma como suya (puede ser un sello o colectivo): solo se muestran los discos que nombran al artista y no se usa su bio/foto.
3. **MusicBrainz, Wikipedia, TheAudioDB** solo suman con identidad **verificada**: (A) el disco de la noticia está en su discografía, o (B) el Bandcamp que MusicBrainz tiene registrado coincide con el que ya identificamos. TheAudioDB exige además el mismo MBID. Un nombre parecido no basta (casos reales: SMILE, T.A.N.K., Irîs).
4. **Deezer** (foto y reproductor de respaldo, p. ej. vkei) solo si el disco de la noticia está entre sus álbumes.
5. Un lanzamiento sin forma de escucharse (ni reproductor, ni discos, ni Deezer) **no entra**: el módulo es audio primero.

## Operación
- Por corrida se enriquecen como máximo `MUSICA_MAX_ARTISTAS` (14; 40 en la manual) y `MUSICA_MAX_MIN` minutos; lo pendiente sigue en la próxima corrida (hay caché por artista, TTL 14 días). Subir `ESQUEMA_ARTISTA` en `build-musica.mjs` obliga a rehacer las fichas cacheadas.
- Un lanzamiento con disco nuevo en Bandcamp refresca la ficha aunque no venza el TTL.
- La ventana de lanzamientos es la de las noticias (30 días, `RETENTION_DAYS` de build-feed).
- Pruebas: `node tests/musica.mjs` (parser contra HTML **real** de Bandcamp en `tests/fixtures/bandcamp/`, identidad, sellos, agrupación). Si Bandcamp cambia su marcado, se vuelve a capturar con `update-musica.yml` modo `capturar`.

## Límites conocidos (medidos en las sondas, `docs/sonda-musica*.md`)
- **Vkei**: casi no usa Bandcamp; el reproductor sale de Deezer/YouTube. La sonda cubrió bandas famosas (optimista).
- **Logos**: existen sobre todo para bandas establecidas; para las chicas la ficha usa el nombre en tipografía.
- Wikipedia cubre ~25 % de las bandas del blog; la bio de Bandcamp es la fuente principal de historia.
- Las imágenes se enlazan (bcbits, Deezer, TheAudioDB), no se copian al repo. Revisar términos de uso si algún día se publica fuera de uso personal.
- `build-feed.mjs` completo tarda más de 15 min en un runner limpio; para la música se usa `SOLO_CATEGORIA="Dark scene / Música"` (modo acotado).

## Montaje en el marco de Angst
La pestaña 12 se monta sobre `.app-fit` (norma N1 del lineamiento): `.musica` / `.musica-body` en `core/App.jsx`, sin `useAltoLibre` ni medir el alto a mano. La portada del lanzamiento se reparte el espacio libre con CSS (flex + `aspect-ratio`). Entrada colapsada = sin scroll; la ficha del artista y el reproductor abierto son estados expandidos (`data-expandido`) y scrollean. **Pendiente:** medir a 480/560/640/720 px de alto libre en celular y tablet (N3) y declarar el mínimo; no se midió en un navegador real.

## Al fusionar (hecho el 1-nov-2026)
`MUSICA_JSON_URL` apunta a `/main/`, se reconstruyó el bundle y se borraron los logs de desarrollo. `fetchFeedData` además excluye la categoría de música por si un `feed.json` anterior aún la trae.

## Me gusta y directorio de artistas (Fase 2, nov-2026)
Pedido de Cris: poder marcar que le gusta un lanzamiento, guardarlo, y juntar los artistas en un directorio filtrable por género para descubrir discos o sencillos.

**Decisión (de Cris):** el artista entra al directorio **automáticamente** al dar ♥ a un lanzamiento suyo.

- **Qué hay:** botón ♡/♥ en la tarjeta del lanzamiento, y en el encabezado dos chips: `lanzamientos` | `♥ artistas · N`. El directorio lista los artistas con ♥ (más reciente primero), con filtro por género (chips con conteo; `sin género` si algún artista no tiene). Tocar un artista abre su ficha (discografía para descubrir más discos/sencillos); la ficha vuelve a `← artistas`.
- **Persistencia:** UNA clave, `angst-musica-megusta-v1` (`{ [lanzamientoId]: { lz, nombre, foto, tags, at } }`), declarada en `LOCAL_KEY_FIELDS.musicaMegusta` → viaja en el export 💾 / Angst-data y se rehidrata en `restoreFromPayload` con `rehidratarMegusta()`. Es una clave **nueva**: no migra ni modifica datos existentes. Cada ♥ guarda una **copia** del lanzamiento y del artista, porque `musica.json` solo conserva ~30 días.
- **El directorio se deriva** de los ♥ (`directorio()` en `modules/musica/megusta.js`); no hay segundo almacén. Un artista sale del directorio cuando no le queda ningún ♥.
- **Código:** `modules/musica/megusta.js` (almacén + hook), `modules/musica/MusicaPage.jsx` (botón, chips, `Directorio`, ficha desde el directorio). Pruebas: `npm run test:musica` (`tests/musica-megusta.mjs`); `tests/export-coverage.mjs` exige la clave en el export.
- **Límite conocido — géneros:** solo vienen de MusicBrainz con identidad verificada (tags de `artistas[slug].mb.tags`): al 6-nov, 17 de 49 artistas los tenían. El resto cae en `sin género`. Cubrirlos exigiría extraer los tags de Bandcamp en `build-musica.mjs` (no hecho: es un cambio de pipeline, decisión pendiente de Cris).
- **Pendiente:** el bug "el reproductor queda cubierto por parte de la carátula" no se reprodujo en Chromium (Bandcamp, Deezer y YouTube, alturas 560–731 px: las cajas no se pisan). Hace falta una captura del caso real. Además `.musica` no define fondo propio y queda sobre el `#f7f6f4` de `.app` con texto claro; no se tocó por no estar pedido.
