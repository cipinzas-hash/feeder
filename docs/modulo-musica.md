# Módulo de música (🎧) — descubrimiento de lanzamientos

Estado: **Fase 1 en la rama `musica`** (oct-2026). Reemplaza a la categoría "Dark scene / Música" del Feed.

## Qué hace
Un carrusel con un lanzamiento a la vez (portada + reproductor) y, desde ahí, la **ficha del artista**: bio, ubicación, foto, discografía completa con carátulas y nombres, reproductor por disco, links y las noticias que lo mencionan. Sin estado persistente: no agrega claves de localStorage (no toca `core/persistence.js` ni el export).

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

## Al fusionar la rama a main
1. `MUSICA_JSON_URL` en `modules/shared/constants.js`: cambiar `/musica/` por `/main/` (único lugar).
2. Reconstruir el bundle (`npm run build`) y commitear `index.html`.
3. Borrar `docs/logs-musica/` (logs de desarrollo).
