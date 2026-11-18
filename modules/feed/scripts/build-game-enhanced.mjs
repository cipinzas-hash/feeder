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
import { DIA, proyectosDeDecomps, mapaDeEstudios, itemsDeEstudios, fichaDeIgdb, readmeABloques, estadoDeReadme, repoDeUrl, listaDeRegistro, terminadosDe } from "./lib/game-enhanced-lib.mjs";
import { idRegistro } from "../../gameenhanced/lib/claves.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SALIDA = path.join(RAIZ, "modules/feed/data/game-enhanced.json");
const SALIDA_FICHAS = path.join(RAIZ, "modules/feed/data/game-enhanced-fichas.json");
const SALIDA_READMES = path.join(RAIZ, "modules/feed/data/game-enhanced-readmes.json");
const SEMILLA = JSON.parse(fs.readFileSync(path.join(RAIZ, "modules/gameenhanced/data/terminados.json"), "utf8")).juegos;

// Registro de Angst: con ANGST_STATE_PATH definido, un archivo ilegible ABORTA la corrida (no se pisan datos con la semilla
// por un fallo transitorio); un estado sin el campo del registro todavía es lo normal antes del primer 📤 y usa la semilla.
function leerRegistro() {
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
const TERMINADOS = terminadosDe(JUEGOS_REGISTRO);
console.log(`Terminados: ${TERMINADOS.length} (${ORIGEN_REGISTRO})`);
const DECOMP_URL = "https://raw.githubusercontent.com/SubmitGame/awesome-decomp-games/main/data/games.json";
const AHORA = Date.now();
const dormir = ms => new Promise(r => setTimeout(r, ms));

let previo = { decomps: [], estudios: [], fuentes: {} };
try { previo = { ...previo, ...JSON.parse(fs.readFileSync(SALIDA, "utf8")) }; } catch (e) { /* primera corrida */ }
const leerPrevio = (ruta, clave) => { try { return JSON.parse(fs.readFileSync(ruta, "utf8"))[clave] || {}; } catch (e) { return {}; } };
const fichasPrevias = leerPrevio(SALIDA_FICHAS, "fichas"), readmesPrevios = leerPrevio(SALIDA_READMES, "readmes");
const out = { version: 1, generatedAt: new Date(AHORA).toISOString(), fuentes: { ...(previo.fuentes || {}) }, semilla: SEMILLA.map(t => ({ titulo: t.titulo, busqueda: t.busqueda })), decomps: previo.decomps || [], estudios: previo.estudios || [] };
const ok = { decomps: false, readmes: false, estudios: false };

async function decomps() {
  const res = await fetch(DECOMP_URL);
  if (!res.ok) throw new Error(`games.json HTTP ${res.status}`);
  const d = await res.json();
  if (!Array.isArray(d.games)) throw new Error("games.json sin lista games");
  out.decomps = proyectosDeDecomps(d.games, TERMINADOS, AHORA);
  out.fuentes.decomps = { ok: true, actualizado: out.generatedAt, generadoPorLaFuente: d.generated_at || null, proyectosEnLaFuente: d.games.length, proyectos: out.decomps.length };
  ok.decomps = true;
}

// README de cada decomp (solo repos de GitHub), ya convertido a texto plano. Se reutiliza si tiene menos de 6 días.
async function readmes() {
  const token = process.env.GITHUB_TOKEN;
  const nuevos = {};
  const c = { pedidos: 0, reutilizados: 0, sinReadme: 0, fallos: 0 };
  let limite = false;
  for (const p of out.decomps) {
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

async function estudios() {
  const id = process.env.IGDB_CLIENT_ID, secreto = process.env.IGDB_CLIENT_SECRET;
  if (!id || !secreto) throw new Error("sin IGDB_CLIENT_ID / IGDB_CLIENT_SECRET");
  const tk = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secreto}&grant_type=client_credentials`, { method: "POST" });
  if (!tk.ok) throw new Error(`token Twitch HTTP ${tk.status}`);
  const token = (await tk.json()).access_token;
  let llamadas = 0;
  async function igdb(endpoint, cuerpo) {
    for (let intento = 0; intento < 4; intento++) {
      llamadas++;
      await dormir(270);   // IGDB admite 4 pedidos por segundo
      const r = await fetch(`https://api.igdb.com/v4/${endpoint}`, { method: "POST", headers: { "Client-ID": id, Authorization: `Bearer ${token}`, Accept: "application/json" }, body: cuerpo });
      if (r.status === 429) { await dormir(1500); continue; }
      if (!r.ok) { const e = new Error(`IGDB ${endpoint} HTTP ${r.status}: ${(await r.text()).slice(0, 160)}`); e.status = r.status; throw e; }
      return r.json();
    }
    throw new Error(`IGDB ${endpoint}: 429 persistente`);
  }
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
      const k = norm(busqueda);
      const g = r.find(x => norm(x.name) === k && !x.version_parent) || r.find(x => norm(x.name) === k) || r.find(x => norm(x.name).startsWith(k) && !x.version_parent) || null;
      if (id) { if (g) fichas[id] = fichaDeIgdb(g); else if (fichasPrevias[id]) fichas[id] = fichasPrevias[id]; }
      if (t.estado === "terminado") {
        const devs = g ? (g.involved_companies || []).filter(c => c.developer && c.company).map(c => ({ id: c.company.id, nombre: c.company.name })) : [];
        resultados.push({ titulo: t.titulo, desarrolladoras: devs, encontrado: !!g });
      }
    } catch (e) {
      console.error(`buscar «${t.busqueda || t.titulo}»: ${e.message}`);
      if (id && fichasPrevias[id]) fichas[id] = fichasPrevias[id];
      if (t.estado === "terminado") resultados.push({ titulo: t.titulo, desarrolladoras: [], encontrado: false });
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
  out.fuentes.igdb = { ok: true, actualizado: out.generatedAt, fichas: Object.keys(fichas).length, terminadosConDesarrolladora: resultados.filter(r => r.desarrolladoras.length).length, estudios: mapa.length, estudiosConsultados: porEstudio.length, llamadas, campoTipo, juegos: out.estudios.length };
  ok.estudios = true;
}

const CLAVE_FUENTE = { decomps: "decomps", readmes: "readmes", estudios: "igdb" };
for (const [nombre, fn] of [["decomps", decomps], ["readmes", readmes], ["estudios", estudios]]) {
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
