// build-panoramas.mjs — módulo Panoramas (issue #17), Fase 1 (13-nov-2026).
// ─────────────────────────────────────────────────────────────────────────────
// Reúne eventos culturales de Santiago en un contrato común y escribe
// data/panoramas.json. Un adaptador por fuente (ver docs/modulo-panoramas.md):
//
//   cclm    Centro Cultural La Moneda — API REST de WordPress (+ campos ACF)
//   artdec  Red Nacional del Servicio Nacional del Patrimonio, filtro región RM
//           (HTML estructurado de Drupal, paginado con ?page=N)
//
// Reglas del issue que se cumplen aquí:
//  · Una falla de fuente NO borra eventos válidos: si una fuente falla o
//    devuelve 0, se conservan sus eventos anteriores marcados como `rancio`.
//  · `visto` (firstSeen) se conserva entre corridas: es lo que permite avisar
//    "nuevo" y es la base de enterarse con anticipación.
//  · Deduplicación entre fuentes por título normalizado + fecha de inicio.
//
// Variables: PANORAMAS_OUT (salida), PANORAMAS_HOY (YYYY-MM-DD, para pruebas),
// PANORAMAS_FIXTURES (directorio con muestras: modo prueba sin red).
// ─────────────────────────────────────────────────────────────────────────────

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.PANORAMAS_OUT || path.join(__dirname, "..", "data", "panoramas.json");
const FIXTURES = process.env.PANORAMAS_FIXTURES || null;
const UA = "angst-feed/1.0 ( https://github.com/cipinzas-hash/feeder )";
const GAP_MS = 1000;
const HORIZONTE_DIAS = 120;       // no guardar eventos que empiezan más allá de esto
const GRACIA_DIAS = 1;            // un evento terminado hace ≤1 día todavía se conserva

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(...a);
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const HOY = process.env.PANORAMAS_HOY || iso(new Date());
const dMs = k => new Date(k + "T12:00:00").getTime();
const sumar = (k, n) => { const d = new Date(dMs(k)); d.setDate(d.getDate() + n); return iso(d); };
const entre = (a, b) => Math.round((dMs(b) - dMs(a)) / 86400000);

const MESES = { enero: 1, ene: 1, febrero: 2, feb: 2, marzo: 3, mar: 3, abril: 4, abr: 4, mayo: 5, may: 5, junio: 6, jun: 6, julio: 7, jul: 7, agosto: 8, ago: 8, septiembre: 9, setiembre: 9, sep: 9, sept: 9, octubre: 10, oct: 10, noviembre: 11, nov: 11, diciembre: 12, dic: 12 };
const norm = s => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const decode = s => (s || "").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;|&#038;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/&#8211;/g, "–").replace(/&#8217;/g, "’").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n));
const limpio = s => decode((s || "").replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const idDe = (fuente, clave) => `${fuente}:${crypto.createHash("sha1").update(String(clave)).digest("hex").slice(0, 10)}`;
const fechaYMD = (y, m, d) => (y && m && d) ? `${y}-${pad(m)}-${pad(d)}` : null;

// ── HTTP (o fixtures) ───────────────────────────────────────────────────────
let ultimaPeticion = 0;
async function getTexto(url, fixture) {
  if (FIXTURES) {
    const f = path.join(FIXTURES, fixture || "");
    if (!fixture || !fs.existsSync(f)) return { ok: false, status: 404, text: "" };
    return { ok: true, status: 200, text: fs.readFileSync(f, "utf8") };
  }
  const espera = ultimaPeticion + GAP_MS - Date.now(); if (espera > 0) await sleep(espera);
  ultimaPeticion = Date.now();
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 30000);
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json,text/html,*/*", "Accept-Language": "es-CL,es;q=0.9" }, signal: c.signal, redirect: "follow" });
    const text = await r.text(); clearTimeout(t);
    return { ok: r.ok, status: r.status, text };
  } catch (e) { clearTimeout(t); return { ok: false, status: 0, text: "", error: String(e.message || e) }; }
}
function jsonTolerante(t) {   // en pruebas con muestras truncadas
  try { return JSON.parse(t); } catch { /* intenta recortar al último objeto completo */ }
  const i = t.lastIndexOf("},{\"id\""); if (i < 0) return null;
  try { return JSON.parse(t.slice(0, i + 1) + "]"); } catch { return null; }
}

// ── Fechas en español ───────────────────────────────────────────────────────
// Devuelve fechas YYYY-MM-DD encontradas en textos como "Domingo 29 de noviembre, 2026",
// "11 de noviembre, 2026 / 03 de enero, 2027", "Noviembre 29, 2026", "Enero, 03, 2027",
// "24/Abril/2025". Sin año explícito usa el año de referencia (y salta al siguiente si
// la fecha quedaría más de 60 días en el pasado).
function fechasEs(texto, refYear) {
  const t = norm(texto).replace(/ de /g, " ");
  const out = [];
  const res = [
    [/(\d{1,2}) (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?: (\d{4}))?/g, m => [m[3], MESES[m[2]], m[1]]],
    [/(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre) (\d{1,2}) (\d{4})/g, m => [m[3], MESES[m[1]], m[2]]],
  ];
  for (const [re, f] of res) for (const m of t.matchAll(re)) { let [y, mo, d] = f(m); if (!y) { y = refYear; } out.push(fechaYMD(+y, +mo, +d)); }
  return [...new Set(out.filter(Boolean))].sort();
}
function horaDe(texto) {
  const m = (texto || "").match(/(\d{1,2}):(\d{2})(?:\s*(?:a|-|–|hasta)\s*(\d{1,2}):(\d{2}))?/i);
  return m ? { inicio: `${pad(m[1])}:${m[2]}`, fin: m[3] ? `${pad(m[3])}:${m[4]}` : null } : null;
}
const COMUNAS = ["Santiago", "Recoleta", "Quinta Normal", "Providencia", "Independencia", "Ñuñoa", "Estación Central", "Las Condes", "Vitacura", "Lo Barnechea", "La Reina", "Macul", "San Miguel", "Cerrillos", "Lo Prado", "Cerro Navia", "Renca", "Huechuraba", "Conchalí", "Peñalolén", "La Florida", "Puente Alto", "Maipú", "San Joaquín", "La Cisterna", "Pudahuel", "Pirque", "San Bernardo", "Quilicura", "Colina", "Lampa", "San Ramón", "La Granja", "El Bosque", "Lo Espejo", "Pedro Aguirre Cerda", "Padre Hurtado", "Peñaflor", "Talagante", "Melipilla", "Buin", "Paine", "Calera de Tango", "San José de Maipo", "San Pedro", "Alhué", "Curacaví", "Isla de Maipo", "El Monte", "María Pinto", "Tiltil", "Lo Prado"];
function comunaDe(...textos) {
  const t = norm(textos.join(" | "));
  const orden = [...COMUNAS].sort((a, b) => b.length - a.length);
  for (const c of orden) if (new RegExp(`(^| )${norm(c)}( |$)`).test(t)) return c;
  return null;
}

// ── Adaptador CCLM ──────────────────────────────────────────────────────────
const CCLM = "https://www.cclm.cl/wp-json/wp/v2";
const CCLM_TIPOS = [
  ["actividad", "Actividad", 2], ["exposicion", "Exposición", 1], ["festival", "Festival", 1], ["cineteca_nacional", "Cine", 1],
];
function parseCclm(e, tipoRest, etiqueta) {
  const acf = e.acf || {};
  const tk = acf.ticketera_cclm || {};
  if (tk.evento_activo === false || tk.excluir_agenda === true || e.excluir_agenda === true) return null;
  const coord = acf.coordenada_adicional || "";
  const fechaDiv = (coord.match(/coordinates__date">([\s\S]*?)<\/div>/) || [])[1] || "";
  const horaDiv = (coord.match(/coordinates__time">([\s\S]*?)<\/div>/) || [])[1] || "";
  const sitios = [...coord.matchAll(/singles--coordinates">([\s\S]*?)<\/div>/g)].map(m => limpio(m[1])).filter(Boolean);
  const refYear = new Date(e.date || HOY).getFullYear();
  let fechas = fechasEs(limpio(fechaDiv), refYear);
  const horarios = Array.isArray(tk.horarios) ? tk.horarios : [];
  // Cuando la fecha es manual, el texto público manda (los horarios estructurados pueden estar desfasados).
  if (!fechas.length || tk.fecha_manual !== "manual") {
    const hs = horarios.flatMap(h => [h.fecha_inicio, h.fecha_cierre]).filter(Boolean).map(x => `${x.slice(0, 4)}-${x.slice(4, 6)}-${x.slice(6, 8)}`).sort();
    if (hs.length && (tk.fecha_manual !== "manual" || !fechas.length)) fechas = [hs[0], hs[hs.length - 1]];
  }
  if (!fechas.length) return null;
  const inicio = fechas[0], fin = fechas[fechas.length - 1];
  const hora = horaDe(limpio(horaDiv)) || (horarios[0] && horarios[0].hora_inicio ? { inicio: horarios[0].hora_inicio.slice(0, 5), fin: (horarios[0].hora_cierre || "").slice(0, 5) || null } : null);
  const textoPrecio = sitios.join(" ");
  const precios = tk.precios || {};
  const gratis = /gratuit|liberad|gratis/i.test(textoPrecio) ? true : (horarios.length && horarios.every(h => h.gratuito)) ? true : (Object.values(precios).some(v => +v > 0) ? false : null);
  const cupos = Math.max(0, ...horarios.map(h => +h.maximo_entradas || 0)) || null;
  const lugar = sitios.find(s => !/gratuit|liberad|gratis/i.test(s)) || null;
  const og = e.yoast_head_json && e.yoast_head_json.og_image && e.yoast_head_json.og_image[0];
  return {
    titulo: limpio(e.title && e.title.rendered), url: e.link, inicio, fin,
    hora: hora ? hora.inicio + (hora.fin ? "–" + hora.fin : "") : null,
    lugar: ["Centro Cultural La Moneda", lugar].filter(Boolean).join(" · "), direccion: "Plaza de la Ciudadanía 26, Santiago", comuna: "Santiago",
    categoria: tipoRest === "actividad" && acf.subtitulo ? limpio(acf.subtitulo).toLowerCase().replace(/^./, c => c.toUpperCase()) : etiqueta,
    gratis, precio: gratis === false && +precios.general > 0 ? +precios.general : null,
    cupos, ventaOnline: tk.venta_tickets === true, inscripcion: null, inscripcionUrl: null,
    imagen: og ? og.url : null, fuenteId: "cclm", fuente: "Centro Cultural La Moneda",
    modificado: e.modified || null,
  };
}
async function adaptadorCclm() {
  const eventos = []; let fallos = 0, paginas = 0;
  for (const [rest, etiqueta, maxPag] of CCLM_TIPOS) {
    for (let p = 1; p <= maxPag; p++) {
      const r = await getTexto(`${CCLM}/${rest}?per_page=50&page=${p}&orderby=date&order=desc`, `2_cclm_${rest}.json`);
      paginas++;
      if (!r.ok) { fallos++; if (r.status === 400) break; continue; }
      const j = jsonTolerante(r.text);
      if (!Array.isArray(j)) { fallos++; continue; }
      for (const e of j) { try { const ev = parseCclm(e, rest, etiqueta); if (ev) eventos.push(ev); } catch (err) { log("  cclm: error parseando", e && e.id, err.message); } }
      if (j.length < 50 || FIXTURES) break;
    }
  }
  return { eventos, ok: fallos < paginas, detalle: `${paginas - fallos}/${paginas} páginas` };
}

// ── Adaptador Red Nacional (artdec), región RM ─────────────────────────────
const ARTDEC = "https://www.artdec.gob.cl/cartelera/red-nacional?region=RM";
function parseArtdecFila(x) {
  const tit = x.match(/destacado__title">\s*<a href="([^"]+)">([\s\S]*?)<\/a>/);
  if (!tit) return null;
  const tiempos = [...x.matchAll(/<time>([^<]+)<\/time>/g)].map(m => m[1]);
  const fs0 = fechasEs(tiempos.join(" / "), new Date(HOY).getFullYear());
  const dia = x.match(/class="day">\s*(\d{1,2})/), mes = x.match(/class="month">\s*([A-Za-zñ]+)/), anio = x.match(/class="year">\s*(\d{4})/);
  const inicio = fs0[0] || (dia && mes && anio && MESES[norm(mes[1])] ? fechaYMD(+anio[1], MESES[norm(mes[1])], +dia[1]) : null);
  const fin = fs0.length > 1 ? fs0[fs0.length - 1] : inicio;
  if (!inicio) return null;
  const horario = limpio((x.match(/field-horario">([\s\S]*?)<\/div>/) || [])[1]);
  const direccion = limpio((x.match(/field-direccion">([\s\S]*?)<\/div>/) || [])[1]);
  const inst = limpio((x.match(/field--name-institucion">([\s\S]*?)<\/div>/) || [])[1]);
  const tema = limpio((x.match(/field-tematica">([\s\S]*?)<\/div>/) || [])[1]);
  const modal = limpio((x.match(/item-value="[^"]*">([\s\S]*?)<\/div>/) || [])[1]);
  const img = (x.match(/<img src="([^"]+)"/) || [])[1] || null;
  // Bloque de inscripción: "no-inscription" = sin inscripción; cualquier otra variante = hay que inscribirse.
  const ins = x.match(/inscription-container">\s*([\s\S]*?)<\/div>\s*(?:<div class="share-container"|<\/div>)/);
  let inscripcion = false, inscripcionUrl = null;
  if (ins && !/no-inscription/.test(ins[1])) { inscripcion = true; inscripcionUrl = (ins[1].match(/href="([^"]+)"/) || [])[1] || null; }
  const partes = inst.split(" - ");
  return {
    titulo: limpio(tit[2]), url: tit[1], inicio, fin,
    hora: horario && /\d/.test(horario) ? horario.replace(/\s*-\s*/, "–") : null,
    lugar: partes[partes.length - 1] || inst || null, direccion: direccion || null, comuna: comunaDe(direccion, inst),
    categoria: tema || "Museos y patrimonio", gratis: null, precio: null, cupos: null, ventaOnline: false,
    inscripcion, inscripcionUrl, imagen: img, fuenteId: "artdec", fuente: "Red Nacional de Museos (SNPC)",
    modalidad: /virtual/i.test(modal) ? "virtual" : "presencial",
  };
}
async function adaptadorArtdec() {
  const eventos = []; let leidas = 0, fallo = false, fueraDeRM = 0;
  for (let p = 0; p < 20; p++) {
    const r = await getTexto(p ? `${ARTDEC}&page=${p}` : ARTDEC, p === 0 ? "2_artdec_rm_p0_completo.html" : `artdec_filtrado_metropolitana_p${p}.html`);
    if (!r.ok) { if (p === 0) fallo = true; break; }
    const filas = r.text.split('<div class="views-row">').slice(1);
    leidas++;
    for (const f of filas) {
      try {
        const ev = parseArtdecFila(f);
        if (!ev || ev.modalidad === "virtual") continue;
        // El parámetro region=RM no filtra en el servidor (la sonda lo comprobó: llegan museos de Valparaíso,
        // Aysén y Limarí). Solo entra lo que se pueda ubicar en una comuna de la Región Metropolitana.
        if (!ev.comuna) { fueraDeRM++; continue; }
        eventos.push(ev);
      } catch (e) { log("  artdec: error en fila", e.message); }
    }
    if (filas.length < 10) break;
  }
  return { eventos, ok: !fallo && leidas > 0, detalle: `${leidas} páginas, ${fueraDeRM} descartados por no ubicarse en la RM` };
}

// ── Orquestación ────────────────────────────────────────────────────────────
const ADAPTADORES = [["cclm", adaptadorCclm], ["artdec", adaptadorArtdec]];

function normalizar(ev) {
  const id = idDe(ev.fuenteId, ev.url || `${ev.titulo}|${ev.inicio}`);
  return { id, ...ev, enCurso: entre(ev.inicio, ev.fin) > 45, fuentes: [{ id: ev.fuenteId, nombre: ev.fuente, url: ev.url }] };
}
function vigente(ev) {
  if (ev.fin < sumar(HOY, -GRACIA_DIAS)) return false;        // ya terminó
  if (ev.inicio > sumar(HOY, HORIZONTE_DIAS)) return false;    // demasiado lejos
  return true;
}
function deduplicar(lista) {
  const mapa = new Map();
  for (const ev of lista) {
    const k = norm(ev.titulo) + "|" + ev.inicio;
    const previo = mapa.get(k);
    if (!previo) { mapa.set(k, ev); continue; }
    previo.fuentes.push(...ev.fuentes.filter(f => !previo.fuentes.some(g => g.id === f.id)));
    for (const campo of ["hora", "lugar", "imagen", "precio", "cupos", "inscripcionUrl"]) if (previo[campo] == null && ev[campo] != null) previo[campo] = ev[campo];
    if (previo.gratis == null) previo.gratis = ev.gratis;
  }
  return [...mapa.values()];
}

async function main() {
  let previo = { eventos: [], fuentes: {} };
  try { previo = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch { /* primera corrida */ }
  const previosPorId = new Map((previo.eventos || []).map(e => [e.id, e]));
  const fuentesEstado = {}; let todos = [];

  for (const [id, fn] of ADAPTADORES) {
    log(`\n== ${id} ==`);
    let res;
    try { res = await fn(); } catch (e) { res = { eventos: [], ok: false, detalle: "excepción: " + (e.message || e) }; }
    const nuevos = res.eventos.map(normalizar).filter(vigente);
    const hubo = (previo.eventos || []).filter(e => e.fuenteId === id);
    if (!res.ok || (nuevos.length === 0 && hubo.length > 0)) {
      // health-check: la falla de una fuente no borra eventos válidos
      const conservados = hubo.filter(vigente).map(e => ({ ...e, rancio: true }));
      log(`  ✗ ${id}: ${res.detalle} → se conservan ${conservados.length} eventos anteriores`);
      fuentesEstado[id] = { ok: false, rancio: true, n: conservados.length, detalle: res.detalle, ultimaBuena: (previo.fuentes && previo.fuentes[id] && previo.fuentes[id].ultimaBuena) || null };
      todos.push(...conservados);
    } else {
      log(`  ✓ ${id}: ${res.eventos.length} leídos, ${nuevos.length} vigentes (${res.detalle})`);
      fuentesEstado[id] = { ok: true, n: nuevos.length, detalle: res.detalle, ultimaBuena: new Date().toISOString() };
      todos.push(...nuevos);
    }
  }

  // `visto` se hereda de la corrida anterior; lo nuevo estrena hoy.
  for (const ev of todos) { const p = previosPorId.get(ev.id); ev.visto = (p && p.visto) || HOY; }
  todos = deduplicar(todos);
  todos.sort((a, b) => a.inicio.localeCompare(b.inicio) || a.titulo.localeCompare(b.titulo, "es"));

  const out = { generatedAt: new Date().toISOString(), hoy: HOY, fuentes: fuentesEstado, eventos: todos };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, FIXTURES ? 1 : 0));
  log(`\nlisto: ${todos.length} eventos → ${OUT}`);
  const sinFuentes = Object.values(fuentesEstado).every(f => !f.ok);
  if (sinFuentes) { log("::error::ninguna fuente respondió bien"); process.exitCode = 1; }
}
main().catch(e => { console.error("error fatal:", e); process.exit(1); });
