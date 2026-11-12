// Sonda de viabilidad de datos reales de Game enhanced (11-nov-2026).
// Solo MIDE; no toca la app ni feed.json. Escribe:
//   modules/feed/data/sonda-game-enhanced.json  (datos completos)
//   docs/sonda-game-enhanced.md                  (reporte legible)
// Tres piezas, cada una con su try/catch para que una caída no tire las otras:
//   1) awesome-decomp-games (data/games.json): ¿se lee solo? ¿cuántos de los 71 terminados tienen proyecto?
//   2) IGDB (secrets IGDB_CLIENT_ID / IGDB_CLIENT_SECRET): ¿casan los 71? ¿qué lanzan sus desarrolladoras?
//   3) Noticias que feeder ya recoge: ¿cuántas dicen "sucesor espiritual" y tocan algo de la lista?
// Sin las llaves de IGDB corre solo 1 y 3 (útil para probar en local).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "../../..");
const SALIDA_JSON = path.join(RAIZ, "modules/feed/data/sonda-game-enhanced.json");
const SALIDA_MD = path.join(RAIZ, "docs/sonda-game-enhanced.md");
const TERMINADOS = JSON.parse(fs.readFileSync(path.join(RAIZ, "modules/gameenhanced/data/terminados.json"), "utf8")).juegos;
const DECOMP_URL = "https://raw.githubusercontent.com/SubmitGame/awesome-decomp-games/main/data/games.json";
const AHORA = Date.now();
const DIA = 86400000;

const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const dormir = ms => new Promise(r => setTimeout(r, ms));
const pct = (n, d) => (d ? `${n}/${d} (${Math.round((100 * n) / d)}%)` : `${n}/0`);
const dias = iso => (iso ? Math.round((AHORA - new Date(iso).getTime()) / DIA) : null);
const cel = s => String(s ?? "—").replace(/\|/g, "/").replace(/\n/g, " ");
const GENERICAS = new Set(["Journey", "Portal", "Crash", "Marathon", "Barrack", "Foobar", "Bastion"]);   // nombres demasiado comunes para cruzar por saga

const R = { generado: new Date(AHORA).toISOString(), terminados: TERMINADOS.length, errores: [] };

// ═══ 1) awesome-decomp-games ═════════════════════════════════════════════════
async function parte1() {
  const res = await fetch(DECOMP_URL);
  if (!res.ok) throw new Error(`games.json HTTP ${res.status}`);
  const d = await res.json();
  const juegos = d.games || [];
  const p = { fuente: DECOMP_URL, generadoPorLaFuente: d.generated_at, entradas: juegos.length, juegosUnicos: d.unique_games, porTipo: d.counts, navegador: d.browser_playable };
  const campos = ["id", "game_key", "type", "platform", "stars", "last_commit", "release_date", "progress", "play_url", "needs_assets", "ai_flag", "score", "inactive"];
  p.camposPresentes = Object.fromEntries(campos.map(c => [c, juegos.filter(j => j[c] !== null && j[c] !== undefined && j[c] !== "").length]));

  const porTitulo = TERMINADOS.map(t => {
    const clave = norm(t.busqueda), saga = norm(t.franquicia);
    const t1 = juegos.filter(j => j.game_key === clave);
    const t2 = juegos.filter(j => j.game_key !== clave && clave.length >= 7 && j.game_key.includes(clave));
    const t3 = GENERICAS.has(t.franquicia) ? [] : juegos.filter(j => j.game_key.includes(saga) && !t1.includes(j) && !t2.includes(j));
    return { titulo: t.titulo, saga: t.franquicia, t1: t1.length, t2: t2.length, t3: t3.length, proyectos: [...t1, ...t2].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 6).map(j => ({ id: j.id, titulo: j.title, tipo: j.type, plataforma: j.platform, estrellas: j.stars, ultimoCommit: j.last_commit, progreso: j.progress, jugableEnNavegador: !!j.play_url, pideAssets: j.needs_assets, ia: j.ai_flag, score: j.score, inactivo: j.inactive, url: j.url })) };
  });
  p.coberturaTitulo = { exacto: porTitulo.filter(x => x.t1).length, exactoOContiene: porTitulo.filter(x => x.t1 || x.t2).length, soloSaga: porTitulo.filter(x => !x.t1 && !x.t2 && x.t3).length, sinNada: porTitulo.filter(x => !x.t1 && !x.t2 && !x.t3).length };
  p.porTitulo = porTitulo;

  const sagas = [...new Set(TERMINADOS.map(t => t.franquicia))];
  p.porSaga = sagas.map(s => {
    const k = norm(s);
    const m = GENERICAS.has(s) ? [] : juegos.filter(j => j.game_key.includes(k));
    return { saga: s, generica: GENERICAS.has(s), proyectos: m.length, activos: m.filter(j => !j.inactive).length, jugablesEnNavegador: m.filter(j => j.play_url).length };
  });

  // señales de "novedad" disponibles sobre lo que SÍ casa con un título tuyo
  const tuyos = porTitulo.flatMap(x => x.proyectos);
  const ids = new Set(tuyos.map(x => x.id));
  const entradas = juegos.filter(j => ids.has(j.id));
  p.senales = {
    proyectosTuyos: entradas.length,
    commitUltimos14d: entradas.filter(j => dias(j.last_commit) <= 14).length,
    releaseUltimos30d: entradas.filter(j => j.release_date && dias(j.release_date) <= 30).length,
    conProgreso: entradas.filter(j => j.progress !== null && j.progress !== undefined).length,
    conJugarEnNavegador: entradas.filter(j => j.play_url).length,
    conPideAssets: entradas.filter(j => j.needs_assets !== null && j.needs_assets !== undefined).length,
    conBanderaIA: entradas.filter(j => j.ai_flag).length,
    inactivos: entradas.filter(j => j.inactive).length,
    porTipo: Object.fromEntries(["decompilation", "static-recomp", "source-port", "engine-remake", "disassembly", "browser-port"].map(t => [t, entradas.filter(j => j.type === t).length])),
  };
  p.hayCampoDeFechaDeAlta = juegos.some(j => "added_at" in j || "created_at" in j || "added" in j);
  R.parte1 = p;
}

// ═══ 2) IGDB ═════════════════════════════════════════════════════════════════
async function parte2() {
  const id = process.env.IGDB_CLIENT_ID, secreto = process.env.IGDB_CLIENT_SECRET;
  if (!id || !secreto) { R.parte2 = { omitida: "sin IGDB_CLIENT_ID / IGDB_CLIENT_SECRET en el entorno" }; return; }
  const tk = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${id}&client_secret=${secreto}&grant_type=client_credentials`, { method: "POST" });
  if (!tk.ok) throw new Error(`token Twitch HTTP ${tk.status}: ${(await tk.text()).slice(0, 120)}`);
  const token = (await tk.json()).access_token;
  let llamadas = 0;
  async function igdb(endpoint, cuerpo) {
    for (let intento = 0; intento < 4; intento++) {
      llamadas++;
      await dormir(270);   // límite de IGDB: 4 pedidos por segundo
      const r = await fetch(`https://api.igdb.com/v4/${endpoint}`, { method: "POST", headers: { "Client-ID": id, Authorization: `Bearer ${token}`, Accept: "application/json" }, body: cuerpo });
      if (r.status === 429) { await dormir(1500); continue; }
      if (!r.ok) throw new Error(`IGDB ${endpoint} HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
      return r.json();
    }
    throw new Error(`IGDB ${endpoint}: 429 persistente`);
  }
  const p = { casados: [], sinMatch: [], desarrolladoras: {} };
  const camposJuego = "name,first_release_date,version_parent,franchises.name,involved_companies.developer,involved_companies.company.name,involved_companies.company.id,platforms.abbreviation";
  for (const t of TERMINADOS) {
    try {
      const lim = t.busqueda.replace(/"/g, "");
      const r = await igdb("games", `search "${lim}"; fields ${camposJuego}; limit 8;`);
      const k = norm(t.busqueda);
      const elegido = r.find(g => norm(g.name) === k && !g.version_parent) || r.find(g => norm(g.name) === k) || r.find(g => norm(g.name).startsWith(k) && !g.version_parent) || null;
      const devs = elegido ? (elegido.involved_companies || []).filter(c => c.developer && c.company).map(c => ({ id: c.company.id, nombre: c.company.name })) : [];
      const fila = { titulo: t.titulo, busqueda: t.busqueda, encontrado: elegido ? elegido.name : null, candidatos: r.slice(0, 3).map(g => g.name), desarrolladoras: devs, fecha: elegido && elegido.first_release_date ? new Date(elegido.first_release_date * 1000).toISOString().slice(0, 10) : null };
      (elegido ? p.casados : p.sinMatch).push(fila);
      for (const dv of devs) { (p.desarrolladoras[dv.id] ||= { id: dv.id, nombre: dv.nombre, tuyos: [] }).tuyos.push(t.titulo); }
    } catch (e) { R.errores.push(`IGDB buscar «${t.busqueda}»: ${e.message}`); }
  }
  // lanzamientos recientes y próximos de cada desarrolladora
  const desde = Math.floor((AHORA - 365 * DIA) / 1000), ahoraS = Math.floor(AHORA / 1000);
  const campos = "name,first_release_date,hypes,follows,version_parent,platforms.abbreviation,franchises.name";
  for (const dv of Object.values(p.desarrolladoras)) {
    try {
      const r = await igdb("games", `fields ${campos}; where involved_companies.company = ${dv.id} & involved_companies.developer = true & version_parent = null & first_release_date > ${desde}; sort first_release_date desc; limit 50;`);
      dv.lanzamientos365d = r.length;
      dv.proximos = r.filter(g => g.first_release_date > ahoraS).length;
      dv.conSeguidores = r.filter(g => (g.follows || 0) > 0).length;
      dv.muestra = r.slice().sort((a, b) => (b.follows || 0) + (b.hypes || 0) - ((a.follows || 0) + (a.hypes || 0))).slice(0, 5).map(g => ({ nombre: g.name, fecha: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : null, seguidores: g.follows || 0, hypes: g.hypes || 0, plataformas: (g.platforms || []).map(x => x.abbreviation).filter(Boolean).slice(0, 4).join("/") }));
    } catch (e) { R.errores.push(`IGDB desarrolladora ${dv.nombre}: ${e.message}`); }
  }
  p.llamadas = llamadas;
  const devs = Object.values(p.desarrolladoras);
  p.resumen = {
    casados: p.casados.length, sinMatch: p.sinMatch.length, conDesarrolladora: p.casados.filter(c => c.desarrolladoras.length).length,
    desarrolladorasUnicas: devs.length,
    conLanzamientoReciente: devs.filter(d => d.lanzamientos365d > 0).length,
    conProximos: devs.filter(d => d.proximos > 0).length,
    lanzamientosTotales365d: devs.reduce((a, d) => a + (d.lanzamientos365d || 0), 0),
    proximosTotales: devs.reduce((a, d) => a + (d.proximos || 0), 0),
    ruidosas: devs.filter(d => d.lanzamientos365d >= 10).map(d => `${d.nombre} (${d.lanzamientos365d})`),
  };
  R.parte2 = p;
}

// ═══ 3) "Sucesor espiritual" en las noticias que feeder ya recoge ═════════════
function parte3() {
  const DATA = path.join(RAIZ, "modules/feed/data");
  const cats = JSON.parse(fs.readFileSync(path.join(DATA, "feed.json"), "utf8")).categories;
  const FRASE = /spiritual (successor|sequel|follow-?up|heir)|sucesor(a|es)? espiritual|heir to|from the (creators|makers|team|studio|developers|minds) (of|behind)|de los creadores de|del estudio detr[aá]s de|por los creadores de|ex-?developers? (of|from)/i;
  const nombres = [...new Set([...TERMINADOS.map(t => t.busqueda), ...TERMINADOS.filter(t => !GENERICAS.has(t.franquicia)).map(t => t.franquicia)])]
    .filter(n => n.length >= 5 || /^(Tekken|Sonic|Crash)/.test(n));
  const reNombres = nombres.map(n => ({ n, re: new RegExp(`(^|[^a-z0-9])${n.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`) }));
  const texto = it => `${it.title || ""} ${it.summary || ""} ${String(it.fullText || "").slice(0, 6000)}`;
  const sinAcentos = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const p = { categorias: {}, coincidenciasFrase: [], mencionesDeTuLista: 0, mencionesGaming: 0, fechas: {} };
  let total = 0;
  for (const c of cats) {
    const items = c.items || [];
    total += items.length;
    const f = items.filter(it => FRASE.test(texto(it)));
    const m = items.filter(it => { const t = sinAcentos(texto(it)); return reNombres.some(x => x.re.test(t)); });
    p.categorias[c.cat] = { items: items.length, conFrase: f.length, mencionanTuLista: m.length };
    p.mencionesDeTuLista += m.length;
    if (c.cat === "Gaming") p.mencionesGaming = m.length;
    for (const it of f) {
      const t = sinAcentos(texto(it));
      const toca = reNombres.filter(x => x.re.test(t)).map(x => x.n).slice(0, 5);
      p.coincidenciasFrase.push({ categoria: c.cat, titulo: it.title, fuente: it.source, fecha: it.pubDate, enlace: it.link, tocaTuLista: toca });
    }
    const fs_ = items.map(it => new Date(it.pubDate).getTime()).filter(Number.isFinite);
    if (fs_.length) p.fechas[c.cat] = { desde: new Date(Math.min(...fs_)).toISOString().slice(0, 10), hasta: new Date(Math.max(...fs_)).toISOString().slice(0, 10) };
  }
  p.itemsRevisados = total;
  p.conFrase = p.coincidenciasFrase.length;
  p.conFraseYTuLista = p.coincidenciasFrase.filter(x => x.tocaTuLista.length).length;
  R.parte3 = p;
}

// ═══ Reporte ═════════════════════════════════════════════════════════════════
function reporte() {
  const L = [];
  const f = R.generado.slice(0, 10);
  L.push(`# Sonda de datos reales de Game enhanced — ${f}`, "");
  L.push(`Muestra: los ${R.terminados} juegos terminados de Cristopher (Stash, 10-nov-2026; \`modules/gameenhanced/data/terminados.json\`). Solo mide; no cambia la app.`, "");
  const a = R.parte1, b = R.parte2, c = R.parte3;
  L.push("## Resumen", "", "| Pieza | Resultado |", "|---|---|");
  if (a) {
    L.push(`| Decomps: ¿se lee solo? | Sí: \`data/games.json\`, ${a.entradas} entradas, generado por la fuente el ${cel(a.generadoPorLaFuente)} |`);
    L.push(`| Decomps: títulos tuyos con proyecto (exacto o contenido) | ${pct(a.coberturaTitulo.exactoOContiene, R.terminados)} |`);
    L.push(`| Decomps: títulos tuyos solo con proyecto de la saga | ${pct(a.coberturaTitulo.soloSaga, R.terminados)} |`);
    L.push(`| Decomps: títulos tuyos sin nada | ${pct(a.coberturaTitulo.sinNada, R.terminados)} |`);
  } else L.push("| Decomps | falló, ver errores |");
  if (b && b.resumen) {
    const s = b.resumen;
    L.push(`| IGDB: títulos que casan | ${pct(s.casados, R.terminados)} |`);
    L.push(`| IGDB: casados con desarrolladora | ${pct(s.conDesarrolladora, s.casados)} |`);
    L.push(`| IGDB: desarrolladoras únicas | ${s.desarrolladorasUnicas} |`);
    L.push(`| IGDB: desarrolladoras con lanzamiento en 12 meses / con próximos | ${s.conLanzamientoReciente} / ${s.conProximos} |`);
    L.push(`| IGDB: lanzamientos en 12 meses / próximos (todas sumadas) | ${s.lanzamientosTotales365d} / ${s.proximosTotales} |`);
  } else L.push(`| IGDB | ${b && b.omitida ? "omitida: " + b.omitida : "falló, ver errores"} |`);
  if (c) {
    L.push(`| Noticias revisadas (feed.json) | ${c.itemsRevisados} |`);
    L.push(`| Noticias con la frase de sucesor / "de los creadores de" | ${c.conFrase} (${c.conFraseYTuLista} tocan tu lista) |`);
    L.push(`| Noticias que mencionan algo de tu lista | ${c.mencionesDeTuLista} (en Gaming: ${c.mencionesGaming}) |`);
  }
  L.push("");

  if (a) {
    L.push("## 1) Decomps, ports y versiones web (awesome-decomp-games)", "");
    L.push(`Fuente: ${a.fuente}. ${a.entradas} entradas (${a.juegosUnicos} juegos únicos); ${a.navegador} jugables en el navegador. Por tipo: ${Object.entries(a.porTipo).map(([k, v]) => `${k} ${v}`).join(", ")}.`, "");
    L.push("Campos útiles y cuántas entradas los traen: " + Object.entries(a.camposPresentes).map(([k, v]) => `${k} ${v}`).join(", ") + ".", "");
    L.push(`Fecha de alta por proyecto en el JSON: ${a.hayCampoDeFechaDeAlta ? "sí" : "**no**; lo nuevo se detecta comparando contra el snapshot anterior (por `id`)"}.`, "");
    const s = a.senales;
    L.push("**Señales de novedad sobre los proyectos que casan con tus títulos:**", "");
    L.push(`- Proyectos tuyos (exacto o contenido): ${s.proyectosTuyos}; tipos: ${Object.entries(s.porTipo).filter(([, v]) => v).map(([k, v]) => `${k} ${v}`).join(", ")}`);
    L.push(`- Con commit en los últimos 14 días: ${s.commitUltimos14d} · con release en 30 días: ${s.releaseUltimos30d} · con % de progreso: ${s.conProgreso}`);
    L.push(`- Jugables en el navegador: ${s.conJugarEnNavegador} · con dato de "pide assets/ROM": ${s.conPideAssets} · con bandera de IA: ${s.conBanderaIA} · inactivos: ${s.inactivos}`, "");
    L.push("### Por título (tier: **E**xacto · **C**ontiene · **S**aga)", "", "| Título | E | C | S | Mejores proyectos (tipo · plataforma · ⭐ · último commit) |", "|---|---|---|---|---|");
    for (const x of a.porTitulo) {
      const mp = x.proyectos.slice(0, 3).map(y => `${cel(y.titulo)} (${y.tipo} · ${cel(y.plataforma)} · ⭐${y.estrellas ?? "?"} · ${y.ultimoCommit ? y.ultimoCommit.slice(0, 10) : "?"})`).join("; ");
      L.push(`| ${cel(x.titulo)} | ${x.t1} | ${x.t2} | ${x.t3} | ${mp || "—"} |`);
    }
    L.push("", "### Por saga", "", "| Saga | Proyectos | Activos | Jugables en navegador |", "|---|---|---|---|");
    for (const x of a.porSaga) L.push(`| ${cel(x.saga)}${x.generica ? " (nombre genérico: no se cruza)" : ""} | ${x.proyectos} | ${x.activos} | ${x.jugablesEnNavegador} |`);
    L.push("");
  }

  if (b && b.casados) {
    L.push("## 2) Estudios y lanzamientos (IGDB)", "");
    L.push(`Llamadas a IGDB: ${b.llamadas}. Sin match (${b.sinMatch.length}): ${b.sinMatch.map(x => `${cel(x.titulo)} → [${x.candidatos.join(" | ")}]`).join("; ") || "ninguno"}.`, "");
    if (b.resumen.ruidosas.length) L.push(`Desarrolladoras con 10 o más lanzamientos en 12 meses (ruido probable): ${b.resumen.ruidosas.join(", ")}.`, "");
    L.push("| Desarrolladora | Tus juegos | Lanzamientos 12 m | Próximos | Con seguidores | Lo más seguido |", "|---|---|---|---|---|---|");
    for (const d of Object.values(b.desarrolladoras).sort((x, y) => (y.lanzamientos365d || 0) - (x.lanzamientos365d || 0))) {
      L.push(`| ${cel(d.nombre)} | ${d.tuyos.length}: ${cel(d.tuyos.slice(0, 3).join(", "))} | ${d.lanzamientos365d ?? "?"} | ${d.proximos ?? "?"} | ${d.conSeguidores ?? "?"} | ${(d.muestra || []).slice(0, 2).map(m => `${cel(m.nombre)} (${m.fecha}, ${m.seguidores} seg.)`).join("; ") || "—"} |`);
    }
    L.push("");
  }

  if (c) {
    L.push("## 3) Sucesores espirituales en las noticias de feeder", "");
    L.push("Por categoría: " + Object.entries(c.categorias).map(([k, v]) => `${k}: ${v.items} noticias, ${v.conFrase} con la frase, ${v.mencionanTuLista} mencionan tu lista`).join(" · ") + ".", "");
    L.push("Ventana de fechas: " + Object.entries(c.fechas).map(([k, v]) => `${k} ${v.desde}→${v.hasta}`).join(" · ") + ".", "");
    if (c.coincidenciasFrase.length) {
      L.push("| Categoría | Noticia | Fuente | Fecha | Toca tu lista |", "|---|---|---|---|---|");
      for (const x of c.coincidenciasFrase.slice(0, 40)) L.push(`| ${cel(x.categoria)} | ${cel(x.titulo)} | ${cel(x.fuente)} | ${cel(String(x.fecha).slice(0, 10))} | ${x.tocaTuLista.join(", ") || "—"} |`);
    } else L.push("No hay noticias con la frase en la ventana actual.");
    L.push("");
  }
  if (R.errores.length) L.push("## Errores", "", ...R.errores.map(e => `- ${cel(e)}`), "");
  return L.join("\n");
}

function guardar() {
  fs.writeFileSync(SALIDA_JSON, JSON.stringify(R, null, 1));
  fs.writeFileSync(SALIDA_MD, reporte());
  console.log(`Reporte escrito: ${path.relative(RAIZ, SALIDA_MD)}`);
}
process.on("SIGTERM", () => { R.errores.push("SIGTERM: reporte parcial"); guardar(); process.exit(0); });

for (const [n, fn] of [["parte1", parte1], ["parte2", parte2], ["parte3", parte3]]) {
  try { await fn(); console.log(`${n} OK`); } catch (e) { R.errores.push(`${n}: ${e.message}`); console.error(`${n} falló: ${e.message}`); }
}
guardar();
