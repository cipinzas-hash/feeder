// Pipeline de datos reales de Game enhanced (nov-2026). Lo corre update-game-enhanced.yml (diario + manual).
// Escribe modules/feed/data/game-enhanced.json, que lee la pestaña 🎮 de la app.
//   · decomps : awesome-decomp-games (data/games.json) cruzado con los juegos terminados de Cristopher.
//   · estudios: IGDB (secrets IGDB_CLIENT_ID / IGDB_CLIENT_SECRET): juegos nuevos y próximos de las
//               desarrolladoras de sus terminados (solo juegos principales, expansiones independientes y remakes).
// Cada fuente falla por separado: si una cae, se conserva lo anterior de esa fuente y se anota el error.
// Sin llaves de IGDB (p. ej. en local) corre solo decomps.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DIA, proyectosDeDecomps, mapaDeEstudios, itemsDeEstudios } from "./lib/game-enhanced-lib.mjs";

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SALIDA = path.join(RAIZ, "modules/feed/data/game-enhanced.json");
const TERMINADOS = JSON.parse(fs.readFileSync(path.join(RAIZ, "modules/gameenhanced/data/terminados.json"), "utf8")).juegos;
const DECOMP_URL = "https://raw.githubusercontent.com/SubmitGame/awesome-decomp-games/main/data/games.json";
const AHORA = Date.now();
const dormir = ms => new Promise(r => setTimeout(r, ms));

let previo = { decomps: [], estudios: [], fuentes: {} };
try { previo = { ...previo, ...JSON.parse(fs.readFileSync(SALIDA, "utf8")) }; } catch (e) { /* primera corrida */ }
const out = { version: 1, generatedAt: new Date(AHORA).toISOString(), fuentes: { ...(previo.fuentes || {}) }, decomps: previo.decomps || [], estudios: previo.estudios || [] };
const ok = { decomps: false, estudios: false };

async function decomps() {
  const res = await fetch(DECOMP_URL);
  if (!res.ok) throw new Error(`games.json HTTP ${res.status}`);
  const d = await res.json();
  if (!Array.isArray(d.games)) throw new Error("games.json sin lista games");
  out.decomps = proyectosDeDecomps(d.games, TERMINADOS, AHORA);
  out.fuentes.decomps = { ok: true, actualizado: out.generatedAt, generadoPorLaFuente: d.generated_at || null, proyectosEnLaFuente: d.games.length, proyectos: out.decomps.length };
  ok.decomps = true;
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

  // 1) Desarrolladoras de cada terminado
  const resultados = [];
  for (const t of TERMINADOS) {
    try {
      const r = await igdb("games", `search "${t.busqueda.replace(/"/g, "")}"; fields name,version_parent,involved_companies.developer,involved_companies.company.name,involved_companies.company.id; limit 8;`);
      const k = norm(t.busqueda);
      const g = r.find(x => norm(x.name) === k && !x.version_parent) || r.find(x => norm(x.name) === k) || r.find(x => norm(x.name).startsWith(k) && !x.version_parent) || null;
      const devs = g ? (g.involved_companies || []).filter(c => c.developer && c.company).map(c => ({ id: c.company.id, nombre: c.company.name })) : [];
      resultados.push({ titulo: t.titulo, desarrolladoras: devs, encontrado: !!g });
    } catch (e) { console.error(`buscar «${t.busqueda}»: ${e.message}`); resultados.push({ titulo: t.titulo, desarrolladoras: [], encontrado: false }); }
  }
  const mapa = mapaDeEstudios(resultados);
  if (!mapa.length) throw new Error("IGDB no devolvió ninguna desarrolladora");

  // 2) Lanzamientos recientes y próximos de cada desarrolladora
  const desde = Math.floor((AHORA - 150 * DIA) / 1000), hasta = Math.floor((AHORA + 900 * DIA) / 1000);
  let campoTipo = "game_type";   // IGDB renombró `category` a `game_type`; si el campo nuevo no existe se cae a `category`
  const porEstudio = [];
  for (const e of mapa) {
    const consulta = () => igdb("games", `fields name,first_release_date,${campoTipo},version_parent,url,platforms.abbreviation; where involved_companies.company = ${e.id} & involved_companies.developer = true & version_parent = null & first_release_date > ${desde} & first_release_date < ${hasta}; sort first_release_date asc; limit 100;`);
    try {
      let juegos;
      try { juegos = await consulta(); }
      catch (err) { if (err.status === 400 && campoTipo === "game_type") { campoTipo = "category"; juegos = await consulta(); } else throw err; }
      porEstudio.push({ estudio: e, juegos });
    } catch (err) { console.error(`estudio ${e.nombre}: ${err.message}`); }
  }
  if (!porEstudio.length) throw new Error("IGDB: ninguna consulta de estudios funcionó");
  out.estudios = itemsDeEstudios(porEstudio, AHORA);
  out.fuentes.igdb = { ok: true, actualizado: out.generatedAt, terminadosConDesarrolladora: resultados.filter(r => r.desarrolladoras.length).length, estudios: mapa.length, estudiosConsultados: porEstudio.length, llamadas, campoTipo, juegos: out.estudios.length };
  ok.estudios = true;
}

for (const [nombre, fn] of [["decomps", decomps], ["estudios", estudios]]) {
  try { await fn(); console.log(`${nombre} OK`); }
  catch (e) {
    console.error(`${nombre} falló: ${e.message}`);
    out.fuentes[nombre === "estudios" ? "igdb" : "decomps"] = { ...(previo.fuentes?.[nombre === "estudios" ? "igdb" : "decomps"] || {}), ok: false, error: e.message, intento: out.generatedAt };
  }
}
if (!ok.decomps && !ok.estudios) { console.error("Ninguna fuente respondió: no se escribe nada."); process.exit(1); }
fs.writeFileSync(SALIDA, JSON.stringify(out, null, 1) + "\n");
console.log(`Escrito ${path.relative(RAIZ, SALIDA)}: ${out.decomps.length} decomps, ${out.estudios.length} de estudios`);
