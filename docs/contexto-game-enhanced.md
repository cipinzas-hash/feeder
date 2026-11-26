# Contexto de traspaso: módulo 🎮 Game enhanced (Angst)

Documento para que otro agente continúe el trabajo sin perder nada. Fecha: 20-nov-2026. Complementa `docs/modulo-game-enhanced.md`
(descripción técnica del módulo) y `docs/angst-lineamiento-y-handoff.md` (normas de diseño y protocolo de entrega de toda la app).
**No contiene credenciales** (ver §1).

---

## 0. En una página

- **Qué es.** Un módulo de Angst (la app personal de Cristopher) con navegación estilo XMB de PSP/PS3. Muestra novedades de juegos que le
  importan y es su registro de juegos. Siete categorías en el eje horizontal:
  ✨ Novedades · 🧩 Decomps · 🏢 Estudios · 🕹️ Ports · 🏁 Terminados · 🎯 Quiero jugar · ⏳ Pendientes.
- **Cómo se alimenta.** Un workflow diario (`update-game-enhanced`, 08:40 UTC) baja una lista pública de decompilaciones, consulta IGDB y GitHub,
  y hace commit de JSON en `main`. La app los lee desde `raw.githubusercontent.com`. No hay servidor propio para este módulo.
- **Qué está hecho y publicado.** Todo lo de §6. Está en `main`; las pruebas pasan; falta que Cristopher lo pruebe en celular y tablet.
- **Qué falta.** Un plan aprobado en principio (§7): (A) registro de juegos que viva en Angst-data y búsqueda en IGDB directa desde la app vía
  Worker; (B) estados 🎮 Jugando / ⏸️ Inconcluso y sugerencias más profundas; (C) imágenes de las burbujas fiables. **Falta su "Go" explícito.**
- **Cómo trabaja Cristopher.** Directo, sin rodeos; acumula cambios y da un "Go" explícito antes de implementar; quiere el trabajo sobre el repo
  vivo, con precisión quirúrgica. Detalle en §9.

## 1. Primeros pasos (antes de tocar nada)

1. **Pedir a Cristopher un PAT fine-grained de GitHub** (github.com/settings/tokens?type=beta), acceso a todos sus repositorios, permisos en
   Read and write: **Contents, Issues, Actions, Secrets, Variables**. Administration no hace falta. Un agente nuevo llega **sin ninguna credencial**.
   Los secrets de Actions no se pueden leer desde fuera: solo un workflow en ejecución los ve.
2. Probar el token con `GET /repos/cipinzas-hash/feeder` (debe dar `permissions.push: true`) antes de asumir que algo más falla.
3. **No guardar ni commitear credenciales.** Tampoco el `AUTH_SECRET` del Worker (Cristopher lo tiene; el navegador lo pide una vez por
   dispositivo con `prompt()` y lo guarda en `localStorage` bajo `angst-simkl-auth-v1`).
4. **Límites de red del sandbox de Claude:** solo `github.com`, `api.github.com`, `raw.githubusercontent.com` y registros de npm/pip/cargo.
   No alcanza `api.igdb.com`, `*.workers.dev`, `*.github.io` ni la Cloudflare API. Todo lo que necesite esos destinos se hace **vía GitHub
   Actions** (que sí tiene salida normal): el workflow escribe el resultado en un archivo commiteado y el agente lo lee por `raw.githubusercontent.com`.
5. **El agente no puede ver capturas de pantalla ni probar un dispositivo real.** Para lo visual o táctil: pedir una captura a Cristopher.
6. Trabajar con **issues de GitHub** (norma desde el 14-sep-2026): abrir un issue antes de un cambio sustancial, cerrarlo al terminar con un
   comentario de resumen. El de este módulo fue el #43 (cerrado).
7. Cristopher recomienda (y el agente anterior también) **revocar y rotar el PAT** al terminar cada sesión.

## 2. Repositorios y servicios

| Pieza | Dónde |
|---|---|
| App y pipeline | `cipinzas-hash/feeder` (público). `core/App.jsx` + `modules/*` → esbuild → `index.html` en la raíz → GitHub Pages (`cipinzas-hash.github.io/feeder/`) |
| Datos privados | `cipinzas-hash/Angst-data` (privado). Rama `state-sync`: `angst-full-state.json` (estado completo de la app, que sube Cristopher con 📤). Rama `main`: archivos de bots (Simkl, Pokécripto…) |
| Worker | `cloudflare-worker/angst-sync.js`, URL `https://angst-sync.angst-66394c52.workers.dev`. GET/POST genérico a archivos de Angst-data con `AUTH_SECRET`; `branch` opcional; `amend` solo fuera de `main`. Despliegue: `.github/workflows/deploy-worker.yml` + `.github/scripts/deploy_worker.py` (secrets `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `WORKER_GITHUB_PAT`, `WORKER_AUTH_SECRET`) |
| Fuente de decomps | `SubmitGame/awesome-decomp-games`, `data/games.json` (lista pública comunitaria) |
| IGDB | Credenciales Twitch como secrets del repo `feeder`: `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`. Límite 4 req/s |

## 3. Arquitectura del módulo

### 3.1 Archivos

- `modules/gameenhanced/GameEnhancedPage.jsx`: toda la UI (eje, filas, tarjeta, ficha-popup, formulario de alta, motor táctil).
- `modules/gameenhanced/logica.js`: lógica **pura** (sin React ni red): categorías, ventanas de tiempo, `itemsDe`, `disposicion` (geometría
  continua del XMB), `madurezDecomp`, `GLOSARIO_SUBTIPO`, `filasFicha`, `textoCompartir`, `sugerenciasDe`, portadas.
- `modules/gameenhanced/estado.js`: guardados y ocultos (`angst-game-enhanced-estado-v1`).
- `modules/gameenhanced/registro.js`: registro de juegos (`angst-game-enhanced-registro-v1`), con semilla única, alta, edición, quitar, restaurar.
- `modules/gameenhanced/lib/claves.mjs`: claves de título (`claveTitulo`, `idRegistro` = `"r-"+clave`), `ESTADOS_REGISTRO`, `repoDeUrl`,
  `tituloLimpio`, `PLATAFORMAS_SUGERIDAS`. **Compartido por cliente y pipeline** (deben calcular lo mismo).
- `modules/gameenhanced/data/terminados.json`: semilla de 71 juegos terminados (de su Stash, 10-nov). Solo se usa una vez.
- Pipeline: `modules/feed/scripts/build-game-enhanced.mjs` + `lib/game-enhanced-lib.mjs`; workflow `.github/workflows/update-game-enhanced.yml`.
- Datos publicados (`modules/feed/data/`): `game-enhanced.json`, `game-enhanced-fichas.json`, `game-enhanced-readmes.json`,
  `game-enhanced-plataformas.json`.
- Integración en `core/`: `core/App.jsx` (módulo nº 13, `rehidratarGameEnhanced*` al restaurar), `core/persistence.js` (`LOCAL_KEY_FIELDS`:
  `gameEnhancedEstado`, `gameEnhancedRegistro`). Compartidos: `modules/shared/catalog.js` (fetchers), `constants.js` (URLs), `ui.jsx`
  (`Ventana`, `VentanaCabecera` con `grande` opt-in).

### 3.2 Tipos de ítem

`d` decomp (coincide con un terminado del usuario) · `p` port nativo de un clásico (no depende de su lista) · `e` juego de un estudio ·
`r` juego de su registro. `esProyecto(j)` = d o p: comparten ficha, estado, README, releases y compartir.

### 3.3 Pipeline diario (`build-game-enhanced.mjs`)

Cada paso falla por separado: si cae, se conserva lo anterior de esa fuente y el error queda en `fuentes`. Orden:
1. **decomps**: baja `games.json` (~3.000 proyectos). `proyectosDeDecomps` (cruce por título con los terminados) y `portsNativos`
   (tipos `source-port`, `static-recomp`, `engine-remake`, `browser-port`; plataforma **original** clásica; activo; con versión; ≥100 ★; versión
   ≤90 días. El cliente muestra solo los últimos 30 días).
2. **readmes**: README de cada decomp y port en GitHub → bloques de texto plano (`readmeABloques`, ~3.800 caracteres) + `estado` (sección
   Status/Estado/Progress/Roadmap, `estadoDeReadme`). Entradas `v:2`; caché 6 días.
3. **plataformas**: ramas y forks de cada repo cuyo nombre/descripción indique 3DS, Vita, Wii U, Switch, PSP, Wii, GameCube, PS3/4/5, Xbox,
   Dreamcast, Saturn o Android (`sugerenciasDePlataformas`). Por repo, `v:2`, caché 6 días. **Sugerencias no verificadas.**
4. **estudios (IGDB)**: ficha de IGDB de **cada juego del registro** (portada, resumen, géneros; clave `r-<título>`), desarrolladoras de los
   terminados y juegos nuevos de esos estudios (`itemsDeEstudios`).

**Los terminados salen del registro de Angst** (campo `gameEnhancedRegistro` de `angst-full-state.json` en la rama `state-sync` de Angst-data,
vía `ANGST_STATE_PATH`). Si el estado aún no trae el campo, usa la semilla. **Si el archivo existe pero no se puede leer, la corrida aborta**
(no se pisan datos con la semilla por un fallo transitorio).

### 3.4 Persistencia (regla R8) y respaldo

Dos claves de `localStorage`, ambas en `LOCAL_KEY_FIELDS` (viajan en 💾 y 📤, se rehidratan en `restoreFromPayload`). Hay un test
(`tests/export-coverage.mjs`, `npm run audit:export`) que falla si una clave nueva no se exporta. El registro:
`{ v:1, sembrado: ts|null, juegos: { "r-<título>": { id, titulo, busqueda, estado, plataforma?, fecha?, nota?, agregado, actualizado } } }`.
Estados hoy: `terminado`, `quiero`, `pendiente` (definido como «empezado o en pausa»).

## 4. Reglas de diseño y de trabajo (obligatorias)

- **Lineamiento** (`docs/angst-lineamiento-y-handoff.md` §4): N1 un solo marco/componentes compartidos (no copiar piezas entre módulos); N2 patrón
  de fila + estado expandido (este módulo es excepción de patrón aprobada: XMB); N3 **colapsado sin scroll de módulo ni de página**, el scroll
  interno nace solo al expandir. R6 sin título propio. R7 Caveat + DM Sans, emojis como íconos. R8 persistencia exportable. Si el módulo en que
  se trabaja no cumple el lineamiento, se rediseña **como parte del mismo trabajo**, sin pedir otro Go (solo ese módulo).
- **Build obligatorio.** Tras cualquier cambio en `core/` o `modules/*.jsx`: `npm run build` (escribe `dist/angst-modular.html` **e** `index.html`)
  y commitear `index.html` con diff real. Sin eso, Pages no recibe nada aunque el push sea "exitoso".
- **Git.** El bot de Actions commitea seguido a `main` (datos). Antes de empezar: `git fetch origin main`. Antes de **cualquier**
  `git reset --hard`: `git status --short` (ya se perdió trabajo dos veces). Preferir: commitear solo los archivos propios (`git add <paths>`,
  nunca `-A` a ciegas), luego `git pull --rebase origin main`, luego `git push`. Mensajes con backticks o comillas: `git commit -F archivo`.
  Identidad: `user.name "angst-feed-bot"`, `user.email "actions@users.noreply.github.com"`.
- **Idioma.** Todo en español (UI, comentarios, commits, docs).
- **Citas de fuentes**: no se reproducen textos largos de terceros; el README del autor se muestra recortado y con enlace al original.

## 5. Decisiones de Cristopher (cronología)

- Auditoría inicial: poco contenido, no luce Angst. Pidió **leer el detalle de cada proyecto en la app** y un **registro de juegos terminados / por jugar /
  pendientes**, como la Vitrina. **Angst es la fuente primaria; se olvida Stash.**
- La navegación en cruz no se notaba: quería el **XMB de PSP/PS3**. Luego pidió **control táctil libre** (arrastre en continuo con inercia).
- Ficha como **popup** con la **×** (le queda más a mano que la flecha ←), **enlaces a los releases**, botón **↗ Compartir** como el de Panoramas,
  y que el XMB **recuerde la posición** al cerrar el popup.
- No entendía el estado de un proyecto (Tokyo Jungle): se agregó semáforo de madurez, «estado según el autor» y glosario en lenguaje llano.
- Quiere enterarse de **ports nativos de clásicos hechos sobre decomp, también fuera de su lista de jugados** (categoría 🕹️ Ports; ventana 30 días, ≥100 ★).
- Quiere ver el **estado en la lista antes de abrir la ficha** (insignia con el semáforo) y que cada decomp **sugiera versiones en otras plataformas**
  (3DS, Vita, Wii U… **y Android**).
- Sobre el Worker: al principio **no quería nada del Worker** para el alta; después pidió que **el registro consulte la API directo y viva en Angst-data**
  (esto sí requiere el Worker: ver §7-A).

## 6. Hecho y publicado (todo en `main`; issue #43 cerrado)

Commits principales: `de836ab` (XMB + registro + README + portadas IGDB) · `bc90366` (táctil libre, popup, releases, compartir) · `7353c45`
(estado del decomp) · `d3721bc`/`fd5c37f` (Ports) · `1908df4` y `688edee` (insignia + versiones en otras plataformas).

Validación: `node tests/gameenhanced.mjs`, `npm run audit:export`, `npm run build`, y la prueba de humo `tests/humo-gameenhanced/` (43 verificaciones,
ver su `LEEME.md`). Corridas reales del pipeline: todas con éxito. Último resultado: 161 repos revisados, 71 sugerencias de plataformas en 45 proyectos
(Android 41, Switch 12, Vita 7, 3DS 6, PSP 3, Wii U 2, Xbox 2); 103 ports guardados (67 en 30 días); 58 README convertidos.

**Sin confirmar** (solo Cristopher puede): sensación del arrastre (umbral 8 px, inercia de 240 ms en la lista y 110 ms en el eje), que colapsado no
desborde en celular y tablet (la válvula avisa por consola), y que la página desplegada en `github.io` se vea bien (no se pudo abrir desde el sandbox).

## 7. Plan A/B/C: HECHO el 21-nov-2026 con el Go de Cristopher (ver docs/modulo-game-enhanced.md, sección «21-nov-2026»)

Cristopher respondió «me parece bien» al plan de abajo. El orden propuesto: **A → B → C**, porque cada paso sostiene al siguiente. Antes de
implementar, **pedir su Go** y abrir un issue nuevo.

### A. Registro en Angst-data y búsqueda en IGDB directa

*Pedido:* «el registro de juegos tiene que consultar la API directo y el registro vive en Angst-data».

- **Por qué hace falta el Worker.** El navegador no puede llamar a IGDB: exige un secreto de Twitch y rechaza peticiones de origen cruzado.
  Hay que añadir un endpoint al Worker `angst-sync` (que ya tiene CORS y `AUTH_SECRET`), por ejemplo `GET /igdb/search?q=` (y `/igdb/game?id=`).
- **Credenciales.** `IGDB_CLIENT_ID` e `IGDB_CLIENT_SECRET` ya son secrets del repo; hay que subirlos como secrets del Worker desde
  `.github/scripts/deploy_worker.py` (revisar cómo sube hoy `GITHUB_PAT`/`AUTH_SECRET` y copiar el patrón). El Worker pide un token de Twitch
  (`client_credentials`), lo cachea hasta su vencimiento y respeta 4 req/s (cola); cachear búsquedas unas horas.
- **Respuesta sugerida:** `[{ igdbId, nombre, anio, portada (image_id), plataformas[], generos[], resumen }]`.
- **Cliente.** `FormAgregar` con autocompletado (debounce ~300 ms). Al elegir un resultado, el alta guarda `igdbId`, título, `portada`,
  `lanzamiento` y plataformas en la entrada del registro: la portada aparece **al instante**, sin esperar la corrida diaria. Sin `AUTH_SECRET` o sin
  red: alta manual por título, como hoy.
- **Registro como archivo propio en Angst-data**, escrito en cada cambio (sin depender de 📤): `game-enhanced-registro.json` en `main` de
  Angst-data, con forma `{ v:1, juegos:{id:entrada}, borrados:{id:ts} }` (tumbas para que un juego quitado no reaparezca). Sincronización:
  al abrir el módulo (si hay `AUTH_SECRET`) **leer y fusionar por entrada según `actualizado`** (gana la más reciente; una tumba más nueva gana);
  tras un cambio, con debounce de ~3 s, volver a leer, fusionar y escribir. `localStorage` queda como caché sin conexión; el registro sigue en
  `LOCAL_KEY_FIELDS` y en 💾 como respaldo. **Nunca `amend` en `main`** (el Worker lo ignora ahí a propósito: otros bots escriben en `main`).
  Mostrar «sin sincronizar» en la franja si no hay auth o hay escrituras pendientes.
- **Pipeline.** `leerRegistro()` debe preferir `.angst-data/game-enhanced-registro.json`, luego el campo del estado completo, luego la semilla.
  Conservar la regla de **abortar si el archivo existe y no se puede leer**. Revisar que el checkout de Angst-data (hoy rama `state-sync`) cubra `main`.
- **Costo a avisar:** cada ráfaga de cambios es un commit pequeño en Angst-data.
- *Leer primero* `cloudflare-worker/angst-sync.js` completo (cómo valida el header de auth, cómo resuelve el `sha` al escribir, CORS) y
  `.github/workflows/deploy-worker.yml`, que ya prueba el Worker tras desplegar.

### B. Estados 🎮 Jugando / ⏸️ Inconcluso y sugerencias más profundas

*Pedido:* «trackear los juegos que juego, sigo, inconclusos, para profundizar la lista de sugerencias».

- `ESTADOS_REGISTRO` (en `claves.mjs`, compartido) pasa a `["terminado","jugando","inconcluso","quiero"]`. **Migración:** el antiguo `pendiente`
  («empezado o en pausa») se lee como `inconcluso`, tanto en `registro.js` (`juegoValido`) como en `listaDeRegistro` del pipeline; añadir tests.
  *Confirmar con Cristopher* que su ⏳ Pendiente significaba eso (se lo preguntó; no respondió expresamente).
- Categorías: ✨ 🧩 🏢 🕹️ · 🏁 Terminados · 🎮 Jugando · ⏸️ Inconcluso · 🎯 Quiero jugar (8 en el eje; el botón ＋ sigue en las del registro).
  Campo opcional `empezado` (fecha) para jugando/inconcluso.
- **Sugerencias.** Hoy solo los terminados alimentan decomps, estudios y la marca «ya terminaste». Nuevo reparto: terminado, jugando e
  inconcluso (lo que ha jugado) alimentan **decomps y juegos nuevos de sus estudios**; `quiero` alimenta **decomps y ports que permiten jugarlo**.
  Cada ítem lleva `relacion` y el motivo cambia: «porque estás jugando X», «porque lo dejaste a medias», «porque quieres jugar X». En 🕹️ Ports,
  la marca pasa a decir la relación real. Generalizar `terminadosDe` en `game-enhanced-lib.mjs`.

### C. Imágenes de las burbujas fiables

*Pedido:* «asegurar la carga de imágenes es vital para la navegación correcta».

- **Diagnóstico.** Hoy tienen portada: juegos del registro (71, IGDB), estudios, y decomps/ports de un juego ya terminado. Los otros ~97 de los 103
  ports y los decomps sin juego propio muestran solo emoji. La fuente casi no trae imágenes (`og_image` 10/159, captura 3/159, `thumb` 0).
  La carga es frágil: `loading="lazy"` dentro de filas trasladadas y recortadas, un solo error deja el emoji hasta recargar, sin precarga,
  reintentos ni memoria de lo cargado (parpadea al cambiar de categoría).
- **Pipeline.** Buscar en IGDB la portada de **todos** los proyectos por `tituloLimpio(titulo)`, con caché (mismo patrón que las fichas), guardar
  en un archivo de portadas y usar `og_image` del repo como segundo recurso; el emoji queda al final. Reportar la cobertura real en `fuentes`
  (no se sabe aún cuántos títulos oscuros no matchean).
- **Cliente** (`Miniatura`): carga inmediata (sin `lazy`) de las filas a ±8 del foco y precarga de las siguientes; dos reintentos con espera;
  reintento al volver la conexión (`online`) y al volver a ser visible la pestaña; memoria de módulo de URLs ya cargadas; fondo neutro con
  fade-in en vez del emoji mientras carga; `t_cover_small` hasta 48 px y `t_cover_big` para el foco y la ficha; `decoding="async"` y
  `referrerPolicy="no-referrer"`.

## 8. Investigación de fuentes (preguntas que hizo Cristopher; nada de esto está aprobado)

- **¿Buscar entradas de la fuente de decomps directo desde la app?** Sí, sin Worker: `games.json` se sirve con `access-control-allow-origin: *`,
  pesa ~4,6 MB (~0,4 MB comprimido, aproximado) y `cache-control: max-age=300`. La app podría bajarlo bajo demanda y buscar en los ~3.000
  proyectos en el cliente. Es una opción para un buscador «en toda la lista»; hoy la app solo ve lo que el pipeline filtra.
- **¿Fuente de juegos modernos?** **IGDB** (ya la usa el pipeline) cubre juegos recientes y anunciados: `games` con `first_release_date` futuro,
  `release_dates` por plataforma, `hypes`; gratis para uso no comercial (acuerdo de desarrollador de Twitch), 4 req/s. **RAWG** (`api.rawg.io`):
  clave gratuita, 20.000 peticiones/mes, filtro `dates=` y `ordering=-added` para próximos lanzamientos, pero **exige enlace de atribución a RAWG**
  en cada página que use sus datos y la clave va en la URL (hay que pasarla por un proxy). Otras (no evaluadas a fondo): Steam, GiantBomb, OpenCritic.
- **Calendario de lanzamientos de Opera GX.** Es la función «Game Release Calendar» de **GX Corner** (navegador Opera GX): muestra lanzamientos
  de PC, PlayStation, Xbox, Switch y GX Games, con tráileres cuando hay, y Opera dice que se actualiza **cada día hábil**. **No encontré una API pública
  documentada** ni la fuente de sus datos; no se puede consumir desde Angst. Para algo equivalente, lo más directo es IGDB.

## 9. Cómo comunicarse con Cristopher

- Directo, con mínima elaboración; respuestas cortas y con la información que decide. Español.
- **Acumula cambios y da un "Go" explícito antes de implementar.** Proponer primero (con pros, contras y límites honestos), esperar el Go.
  No tomar un «me parece bien» sobre una propuesta parcial como Go de lo que no se describió.
- Precisión quirúrgica: avisar de lo que no se verificó (no se ve la pantalla ni el dispositivo) en vez de afirmarlo.
- Trabajo directo sobre el repo vivo; confirma en su celular/tablet y manda capturas cuando algo visual falla.
- Entiende de arquitectura y le interesan los criterios y umbrales (los cambia sin problema si se los señala).

## 10. Trampas conocidas

- La plataforma de un proyecto en la fuente es la del **juego original**, no a dónde se porteó. No se puede filtrar «portado a consola X» con ese campo.
- Los campos `progress` y `play_status` de la fuente existen pero vienen vacíos: el estado de avance se infiere de versión, actividad y el README.
- `inactivo` viene de las marcas `inactive`/`archived` de la lista, **no** de la edad del último commit.
- `haceDias` muestra meses a partir de ~30 días (72 días = «hace 2 m»).
- Estudios excluye a propósito ports, remasters, DLC y packs; los ports nativos vienen de la lista de decomps, no de IGDB.
- Los botones del eje y las fichas comparten texto («Quiero jugar»): en pruebas, usar `🎯 Quiero jugar` exacto.
- `GEMINI_API_KEY` del repo tiene un formato atípico y nunca se confirmó que funcione: no depender de resúmenes con IA.
- Una `Ventana` cierra al tocar fuera del recuadro; el popup de la ficha hereda ese comportamiento.
- Con 8 categorías el eje supera el ancho de 480 px: lo que sobra queda recortado (comportamiento esperado del XMB), pero revisar que ＋ no
  tape íconos.

## 11. Verificación

```bash
node tests/gameenhanced.mjs        # lógica pura, pipeline (README, estado, plataformas, ports, registro)
npm run audit:export               # toda clave local nueva debe exportarse
npm run build                      # regenera dist/ e index.html (commitear index.html)
# render real con jsdom: ver tests/humo-gameenhanced/LEEME.md
```

Para probar el pipeline de verdad: disparar `update-game-enhanced` con `workflow_dispatch`
(`POST /repos/cipinzas-hash/feeder/actions/workflows/update-game-enhanced.yml/dispatches`, `{"ref":"main"}`), esperar el `success` y leer los
JSON en `modules/feed/data/` tras `git pull --rebase`. `fuentes` dentro de `game-enhanced.json` resume cada paso (contadores y errores).
