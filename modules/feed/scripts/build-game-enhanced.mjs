// Pipeline de datos reales de Game enhanced (nov-2026). Lo corre update-game-enhanced.yml (diario + manual).
// Escribe modules/feed/data/game-enhanced.json, que lee la pestaña 🎮 de la app.
//   · decomps : awesome-decomp-games (data/games.json) cruzado con los juegos terminados de Cristopher.
//   · estudios: IGDB (secrets IGDB_CLIENT_ID / IGDB_CLIENT_SECRET): juegos nuevos y próximos de las
//               desarrolladoras de sus terminados (solo juegos principales, expansiones independientes y remakes).
// Cada fuente falla por separado: si una cae, se conserva lo anterior de esa fuente y se anota el error.
// Sin llaves de IGDB (p. ej. en local) corre solo decomps.
// Issue #43 (nov-2026): los "terminados" ya no salen de un archivo fijo sino del registro de Angst (campo
// gameEnhancedRegistro del estado en Angst-data, ANGST_STATE_PATH); terminados.json queda como semilla única
// cuando el estado aún no trae registro. Además escribe game-enhanced-fichas.json (portada, resumen y géneros
// de IGDB de cada juego del registro) y game-enhanced-readmes.json (README de cada decomp en texto plano).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DIA, proyectosDeDecomps, portsNativos, mapaDeEstudios, itemsDeEstudios, fichaDeIgdb, readmeABloques, estadoDeReadme, sugerenciasDePlataformas, repoDeUrl, listaDeRegistro, relacionadosDe, jugadosDe, elegirCoincidencia, planPortadas } from "./lib/game-enhanced-lib.mjs";
import { idRegistro, ESTADOS_JUGADOS } from "../../gameenhanced/lib/claves.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SALIDA = path.join(RAIZ, "modules/feed/data/game-enhanced.json");
const SALIDA_FICHAS = path.join(RAIZ, "modules/feed/data/game-enhanced-fichas.json");
const SALIDA_READMES = path.join(RAIZ, "modules/feed/data/game-enhanced-readmes.json");
const SALIDA_PLATAFORMAS = path.join(RAIZ, "modules/feed/data/game-enhanced-plataformas.json");
const SALIDA_PORTADAS = path.join(RAIZ, "modules/feed/data/game-enhanced-portadas.json");
const SEMILLA = JSON.parse(fs.readFileSync(path.join(RAIZ, "modules/gameenhanced/data/terminados.json"), "utf8")).juegos;

// Registro de Angst: con ANGST_STATE_PATH definido, un archivo ilegible ABORTA la corrida (no se pisan datos con la semilla
// por un fallo transitorio); un estado sin el campo del registro todavía es lo normal antes del primer 📤 y usa la semilla.
function leerRegistro() {
  // 1) El archivo propio del registro en Angst-data (rama main), que Angst escribe en cada cambio (A, nov-2026). Si existe y no se puede leer
  //    o no tiene la forma esperada, ABORTA (no se pisan datos con una fuente más vieja por un fallo transitorio).
  const rutaArchivo = process.env.ANGST_REGISTRO_PATH;
  if (rutaArchivo && fs.existsSync(rutaArchivo)) {
    let archivo;
    try { archivo = JSON.parse(fs.readFileSync(rutaArchivo, "utf8")); }
    catch (e) { console.error(`No se pudo leer el registro de Angst en ${rutaArchivo}: ${e.message}. Se aborta para no pisar datos.`); process.exit(1); }
    const lista = listaDeRegistro({ gameEnhancedRegistro: archivo });
    if (!lista) { console.error(`El archivo ${rutaArchivo} no tiene la forma de un registro (falta «juegos»). Se aborta para no pisar datos.`); process.exit(1); }
    return { lista, origen: `game-enhanced-registro.json de Angst-data (${lista.length} juegos)` };
  }
  // 2) El estado completo que sube 📤 (campo gameEnhancedRegistro), mientras el archivo propio aún no existe.
  const ruta = process.env.ANGST_STATE_PATH;
  if (!ruta) return { lista: null, origen: "semilla terminados.json (sin ANGST_STATE_PATH)" };
  let estado;
  try { estado = JSON.parse(fs.readFileSync(ruta, "utf8")); }
  catch (e) { console.error(`No se pudo leer el estado de Angst en ${ruta}: ${e.message}. Se aborta para no pisar datos.`); process.exit(1); }
  const lista = listaDeRegistro(estado);
  return lista ? { lista, origen: `registro de Angst (${lista.length} juegos)` } : { lista: null, origen: "semilla terminados.json (el estado de Angst aún no trae registro)" };
}
const { lista: REGISTRO, origen: ORIGEN_REGISTRO } = leerRegistro();
const JUEGOS_REGISTRO = REGISTRO ?? SEMILLA.map(t => ({ titulo: t.titulo, busqueda: t.busqueda, estado: "terminado" }));
const RELACIONADOS = relacionadosDe(JUEGOS_REGISTRO);   // terminado + jugando + inconcluso + quiero: cruce con decomps y ports
console.log(`Registro: ${RELACIONADOS.length} juegos, ${jugadosDe(JUEGOS_REGISTRO).length} jugados (${ORIGEN_REGISTRO})`);
const DECOMP_URL = "https://raw.githubusercontent.com/SubmitGame/awesome-decomp-games/main/data/games.json";
const AHORA = Date.now();
const dormir = ms => new Promise(r => setTimeout(r, ms));

let previo = { decomps: [], estudios: [], fuentes: {} };
try { previo = { ...previo, ...JSON.parse(fs.readFileSync(SALIDA, "utf8")) }; } catch (e) { /* primera corrida */ }
const leerPrevio = (ruta, clave) => { try { return JSON.parse(fs.readFileSync(ruta, "utf8"))[clave] || {}; } catch (e) { return {}; } };
const fichasPrevias = leerPrevio(SALIDA_FICHAS, "fichas"), readmesPrevios = leerPrevio(SALIDA_READMES, "readmes"), plataformasPrevias = leerPrevio(SALIDA_PLATAFORMAS, "plataformas"), portadasPrevias = leerPrevio(SALIDA_PORTADAS, "portadas");
const out = { version: 1, generatedAt: new Date(AHORA).toISOString(), fuentes: { ...(previo.fuentes || {}) }, semilla: SEMILLA.map(t => ({ titulo: t.titulo, busqueda: t.busqueda })), decomps: previo.decomps || [], ports: previo.ports || [], estudios: previo.estudios || [] };
const ok = { decomps: false, readmes: false, plataformas: false, estudios: false, portadas: false };
let fichasVigentes = fichasPrevias;   // fichas de IGDB del registro: las nuevas si estudios() corrió, si no las de la corrida anterior

async function decomps() {
  const res = await fetch(DECOMP_URL);
  if (!res.ok) throw new Error(`games.json HTTP ${res.status}`);
  const d = await res.json();
  if (!Array.isArray(d.games)) throw new Error("games.json sin lista games");
  out.decomps = proyectosDeDecomps(d.games, RELACIONADOS, AHORA);
  out.ports = portsNativos(d.games, RELACIONADOS, AHORA);
  out.fuentes.decomps = { ok: true, actualizado: out.generatedAt, generadoPorLaFuente: d.generated_at || null, proyectosEnLaFuente: d.games.length, proyectos: out.decomps.length, ports: out.ports.length };
  ok.decomps = true;
}

// README de cada decomp y de cada port nativo (solo repos de GitHub), ya convertido a texto plano. Se reutiliza si tiene menos de 6 días.
async function readmes() {
  const token = process.env.GITHUB_TOKEN;
  const nuevos = {};
  const c = { pedidos: 0, reutilizados: 0, sinReadme: 0, fallos: 0 };
  let limite = false;
  for (const p of [...out.decomps, ...out.ports]) {
    const repo = repoDeUrl(p.url);
    if (!repo) continue;
    const prev = readmesPrevios[p.id];
    if (prev && prev.v === 2 && prev.repo === repo && AHORA - new Date(prev.actualizado).getTime() < 6 * DIA) { nuevos[p.id] = prev; c.reutilizados++; continue; }
    if (limite) { if (prev) nuevos[p.id] = prev; continue; }
    c.pedidos++;
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), 15000);
    try {
      await dormir(150);
      const r = await fetch(`https://api.github.com/repos/${repo}/readme`, { signal: ctl.signal, headers: { Accept: "application/vnd.github.raw+json", "User-Agent": "angst-feed-bot", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      if (r.status === 404) { c.sinReadme++; continue; }
      if (r.status === 403 || r.status === 429) { limite = true; c.fallos++; if (prev) nuevos[p.id] = prev; console.error(`README ${repo}: límite de la API (HTTP ${r.status}); se conserva lo anterior del resto`); continue; }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const md = await r.text();
      const { bloques, recortado } = readmeABloques(md);
      if (bloques.length) nuevos[p.id] = { v: 2, repo, actualizado: new Date(AHORA).toISOString(), recortado, estado: estadoDeReadme(md), bloques };
      else c.sinReadme++;
    } catch (e) { c.fallos++; if (prev) nuevos[p.id] = prev; console.error(`README ${repo}: ${e.message}`); }
    finally { clearTimeout(tm); }
  }
  if (!Object.keys(nuevos).length && c.fallos) throw new Error(`ningún README disponible (${c.fallos} fallos)`);
  fs.writeFileSync(SALIDA_READMES, JSON.stringify({ version: 1, generatedAt: out.generatedAt, readmes: nuevos }, null, 1) + "\n");
  out.fuentes.readmes = { ok: true, actualizado: out.generatedAt, ...c, conReadme: Object.keys(nuevos).length, conEstado: Object.values(nuevos).filter(x => x.estado).length };
  ok.readmes = true;
}

// Versiones en otras plataformas (3DS, Vita, Wii U, Switch, Android…): ramas y forks de cada repo, por nombre. Se guarda por
// repo (un repo puede estar como decomp y como port) y se reutiliza si tiene menos de 6 días y la misma plataforma original.
async function plataformas() {
  const token = process.env.GITHUB_TOKEN;
  const repos = new Map();
  for (const p of [...out.decomps, ...out.ports]) { const r = repoDeUrl(p.url); if (r && !repos.has(r)) repos.set(r, p.plataforma || ""); }
  const nuevos = {};
  const c = { repos: repos.size, pedidos: 0, reutilizados: 0, fallos: 0 };
  let limite = false;
  const gh = async ruta => {
    const ctl = new AbortController();
    const tm = setTimeout(() => ctl.abort(), 15000);
    try {
      await dormir(120);
      const r = await fetch("https://api.github.com" + ruta, { signal: ctl.signal, headers: { Accept: "application/vnd.github+json", "User-Agent": "angst-feed-bot", ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
      return { status: r.status, json: r.ok ? await r.json() : null };
    } finally { clearTimeout(tm); }
  };
  for (const [repo, original] of repos) {
    const prev = plataformasPrevias[repo];
    if (prev && prev.v === 2 && prev.original === original && AHORA - new Date(prev.actualizado).getTime() < 6 * DIA) { nuevos[repo] = prev; c.reutilizados++; continue; }
    if (limite) { if (prev) nuevos[repo] = prev; continue; }
    c.pedidos++;
    try {
      const ramas = await gh(`/repos/${repo}/branches?per_page=100`);
      const forks = await gh(`/repos/${repo}/forks?sort=stargazers&per_page=100`);
      if ([ramas.status, forks.status].some(s => s === 403 || s === 429)) { limite = true; c.fallos++; if (prev) nuevos[repo] = prev; console.error(`plataformas ${repo}: límite de la API; se conserva lo anterior del resto`); continue; }
      if (!ramas.json && !forks.json) { c.fallos++; if (prev) nuevos[repo] = prev; continue; }
      nuevos[repo] = { v: 2, original, actualizado: new Date(AHORA).toISOString(), sugerencias: sugerenciasDePlataformas({ repo, ramas: ramas.json || [], forks: forks.json || [], plataformaOriginal: original }) };
    } catch (e) { c.fallos++; if (prev) nuevos[repo] = prev; console.error(`plataformas ${repo}: ${e.message}`); }
  }
  if (!Object.keys(nuevos).length && c.fallos) throw new Error(`ninguna consulta de plataformas funcionó (${c.fallos} fallos)`);
  fs.writeFileSync(SALIDA_PLATAFORMAS, JSON.stringify({ version: 1, generatedAt: out.generatedAt, plataformas: nuevos }, null, 1) + "\n");
  out.fuentes.plataformas = { ok: true, actualizado: out.generatedAt, ...c, conSugerencias: Object.values(nuevos).filter(x => x.sugerencias.length).length, sugerencias: Object.values(nuevos).reduce((n, x) => n + x.sugerencias.length, 0) };
  ok.plataformas = true;
}

// Cliente de IGDB compartido por estudios() y portadas(): el token de Twitch se pide una sola vez por corrida.
let clienteIgdb = null, llamadasIgdb = 0;
async function getIgdb() {
  if (clienteIgdb) return clienteIgdb;
  const id = process.env.IGDB_CLIENT_ID, secreto = process.env.IGDB_CLIENT_SECRET;
  if (!id || !secreto) throw new Error("sin IGDB_CLIENT_ID / IGDB_CLIENT_SECRET");
  const tk = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secreto}&grant_type=client_credentials`, { method: "POST" });
  if (!tk.ok) throw new Error(`token Twitch HTTP ${tk.status}`);
  const token = (await tk.json()).access_token;
  clienteIgdb = async function igdb(endpoint, cuerpo) {
    for (let intento = 0; intento < 4; intento++) {
      llamadasIgdb++;
      await dormir(270);   // IGDB admite 4 pedidos por segundo
      const r = await fetch(`https://api.igdb.com/v4/${endpoint}`, { method: "POST", headers: { "Client-ID": id, Authorization: `Bearer ${token}`, Accept: "application/json" }, body: cuerpo });
      if (r.status === 429) { await dormir(1500); continue; }
      if (!r.ok) { const e = new Error(`IGDB ${endpoint} HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`); e.status = r.status; throw e; }
      return r.json();
    }
    throw new Error(`IGDB ${endpoint}: 429 persistente`);
  };
  return clienteIgdb;
}

async function estudios() {
  const igdb = await getIgdb();
  const llamadas0 = llamadasIgdb;
  const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // 1) Ficha de cada juego del registro (portada, resumen, géneros) y desarrolladoras de los terminados
  const resultados = [];
  const fichas = {};
  const CAMPOS = "name,version_parent,summary,cover.image_id,genres.name,platforms.abbreviation,first_release_date,url,involved_companies.developer,involved_companies.company.name,involved_companies.company.id";
  for (const t of JUEGOS_REGISTRO) {
    const id = idRegistro(t.titulo);
    try {
      const busqueda = t.busqueda || t.titulo;
      const r = await igdb("games", `search "${busqueda.replace(/"/g, "")}"; fields ${CAMPOS}; limit 8;`);
      const g = elegirCoincidencia(r, busqueda);
      if (id) { if (g) fichas[id] = fichaDeIgdb(g); else if (fichasPrevias[id]) fichas[id] = fichasPrevias[id]; }
      if (ESTADOS_JUGADOS.includes(t.estado)) {
        const devs = g ? (g.involved_companies || []).filter(c => c.developer && c.company).map(c => ({ id: c.company.id, nombre: c.company.name })) : [];
        resultados.push({ titulo: t.titulo, estado: t.estado, desarrolladoras: devs, encontrado: !!g });
      }
    } catch (e) {
      console.error(`buscar «${t.busqueda || t.titulo}»: ${e.message}`);
      if (id && fichasPrevias[id]) fichas[id] = fichasPrevias[id];
      if (ESTADOS_JUGADOS.includes(t.estado)) resultados.push({ titulo: t.titulo, estado: t.estado, desarrolladoras: [], encontrado: false });
    }
  }
  const mapa = mapaDeEstudios(resultados);
  if (!mapa.length) throw new Error("IGDB no devolvió ninguna desarrolladora");

  // 2) Lanzamientos recientes y próximos de cada desarrolladora
  const desde = Math.floor((AHORA - 150 * DIA) / 1000), hasta = Math.floor((AHORA + 900 * DIA) / 1000);
  let campoTipo = "game_type";   // IGDB renombró `category` a `game_type`; si el campo nuevo no existe se cae a `category`
  const porEstudio = [];
  for (const e of mapa) {
    const consulta = () => igdb("games", `fields name,first_release_date,${campoTipo},version_parent,url,platforms.abbreviation,summary,cover.image_id,genres.name; where involved_companies.company = ${e.id} & involved_companies.developer = true & version_parent = null & first_release_date > ${desde} & first_release_date < ${hasta}; sort first_release_date asc; limit 100;`);
    try {
      let juegos;
      try { juegos = await consulta(); }
      catch (err) { if (err.status === 400 && campoTipo === "game_type") { campoTipo = "category"; juegos = await consulta(); } else throw err; }
      porEstudio.push({ estudio: e, juegos });
    } catch (err) { console.error(`estudio ${e.nombre}: ${err.message}`); }
  }
  if (!porEstudio.length) throw new Error("IGDB: ninguna consulta de estudios funcionó");
  out.estudios = itemsDeEstudios(porEstudio, AHORA);
  fs.writeFileSync(SALIDA_FICHAS, JSON.stringify({ version: 1, generatedAt: out.generatedAt, fichas }, null, 1) + "\n");
  fichasVigentes = fichas;
  out.fuentes.igdb = { ok: true, actualizado: out.generatedAt, fichas: Object.keys(fichas).length, jugadosConDesarrolladora: resultados.filter(r => r.desarrolladoras.length).length, estudios: mapa.length, estudiosConsultados: porEstudio.length, llamadas: llamadasIgdb - llamadas0, campoTipo, juegos: out.estudios.length };
  ok.estudios = true;
}

// Portada de IGDB de TODOS los decomps y ports (no solo los que casan con un juego tuyo con ficha), por el título sin el paréntesis del repo.
// Caché: encontradas 30 días, sin resultado 7 (para reintentar títulos oscuros sin gastar 4 pedidos/s todos los días). Reporta la cobertura real.
async function portadas() {
  const items = [...out.decomps, ...out.ports];
  const { resueltos, pendientes } = planPortadas(items, fichasVigentes, portadasPrevias, AHORA);
  const igdb = await getIgdb();
  const llamadas0 = llamadasIgdb, nuevas = { ...resueltos };
  let fallos = 0;
  const porBusqueda = new Map();   // varios proyectos del mismo juego: una sola consulta
  for (const p of pendientes) { if (!porBusqueda.has(p.busqueda)) porBusqueda.set(p.busqueda, []); porBusqueda.get(p.busqueda).push(p.id); }
  for (const [busqueda, ids] of porBusqueda) {
    try {
      const r = await igdb("games", `search "${busqueda.replace(/"/g, "")}"; fields name,version_parent,cover.image_id; limit 8;`);
      const g = elegirCoincidencia(r, busqueda), imagen = g && g.cover && /^[a-z0-9]+$/i.test(g.cover.image_id || "") ? g.cover.image_id : null;
      for (const id of ids) nuevas[id] = { v: 1, imagen, busqueda, buscado: new Date(AHORA).toISOString(), ...(g ? { nombre: g.name } : {}) };
    } catch (e) {
      fallos++; console.error(`portada «${busqueda}»: ${e.message}`);
      for (const id of ids) if (portadasPrevias[id]) nuevas[id] = portadasPrevias[id];
    }
  }
  if (pendientes.length && fallos === porBusqueda.size) throw new Error(`ninguna consulta de portadas funcionó (${fallos} fallos)`);
  const vivos = new Set(items.map(i => i.id));
  for (const id of Object.keys(nuevas)) if (!vivos.has(id)) delete nuevas[id];
  fs.writeFileSync(SALIDA_PORTADAS, JSON.stringify({ version: 1, generatedAt: out.generatedAt, portadas: nuevas }, null, 1) + "\n");
  const conIgdb = items.filter(i => nuevas[i.id] && nuevas[i.id].imagen).length;
  const soloRepo = items.filter(i => !(nuevas[i.id] && nuevas[i.id].imagen) && i.imagenRepo).length;
  out.fuentes.portadas = { ok: true, actualizado: out.generatedAt, proyectos: items.length, conPortadaIgdb: conIgdb, soloImagenDelRepo: soloRepo, sinImagen: items.length - conIgdb - soloRepo, consultados: porBusqueda.size, fallos, llamadas: llamadasIgdb - llamadas0 };
  ok.portadas = true;
}

const CLAVE_FUENTE = { decomps: "decomps", readmes: "readmes", plataformas: "plataformas", estudios: "igdb", portadas: "portadas" };
for (const [nombre, fn] of [["decomps", decomps], ["readmes", readmes], ["plataformas", plataformas], ["estudios", estudios], ["portadas", portadas]]) {
  try { await fn(); console.log(`${nombre} OK`); }
  catch (e) {
    console.error(`${nombre} falló: ${e.message}`);
    const k = CLAVE_FUENTE[nombre];
    out.fuentes[k] = { ...(previo.fuentes?.[k] || {}), ok: false, error: e.message, intento: out.generatedAt };
  }
}
if (!ok.decomps && !ok.estudios) { console.error("Ninguna fuente respondió: no se escribe nada."); process.exit(1); }
fs.writeFileSync(SALIDA, JSON.stringify(out, null, 1) + "\n");
console.log(`Escrito ${path.relative(RAIZ, SALIDA)}: ${out.decomps.length} decomps, ${out.estudios.length} de estudios`);
