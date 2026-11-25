// Historial MENSUAL de TODO el pool desde el archivo diario de tcgcsv.com (desde el 8-feb-2024): Pokémon (categoría 3), Yu-Gi-Oh! (2) y Digimon (63).
// Régimen de 3 datos por mes (23-nov-2026): de cada producto+subtipo y cada mes se guarda la MEDIA, el MÍNIMO y el MÁXIMO del precio de mercado y
// nada más. Salida: modules/feed/data/tcgcrypto-hist/<categoría>/<grupo>.json = {m: "YYYY-MM" del primer mes, t: {"pid|subtipo": [desfase, media, mín, máx, media, …]}}
// (desfase = meses desde `m` hasta el primer dato de ese producto; null = mes sin dato). La app baja el archivo del grupo de la carta al agregarla y la
// fila queda con su histMes completo; el bot de precios sigue sumando el día a día.
//
// Solo se procesan meses CERRADOS. Corrida completa = todos los días desde feb-2024 (varios GB de descargas, una sola vez; los archivos son inmutables y
// la documentación de tcgcsv pide no repetirlas). Corrida mensual (cron, día 2) = solo los meses cerrados que faltan según tcgcrypto-hist/estado.json.
// Para mantener el repositorio liviano solo se guardan los productos que alguna vez valieron ≥ MIN_USD (por omisión 0,50): el bulk no sirve para
// decidir una compra. El informe (estado.json) dice cuánto habría pesado sin el filtro, para poder cambiarlo con datos.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const DATA = process.env.DATA_DIR || path.join(AQUI, "..", "data");
const SALIDA = path.join(DATA, "tcgcrypto-hist");
const CATS = (process.env.CATS || "3,2,63").split(",").map(Number);
const MIN_USD = Number(process.env.MIN_USD ?? 0.5);
const PRIMER_DIA = process.env.DESDE || "2024-02-08";
const ARCHIVO = process.env.ARCHIVO_BASE || "https://tcgcsv.com/archive/tcgplayer";
const LOCAL = process.env.ARCHIVO_LOCAL || null;        // solo pruebas: carpeta con <fecha>/<cat>/<grupo>/prices ya extraídos
const CONCURRENCIA = Number(process.env.CONCURRENCIA || 3);
const UA = { "User-Agent": "angst-feed-bot (github.com/cipinzas-hash/feeder)" };
const hoy = process.env.HOY || new Date().toISOString().slice(0, 10);
const dormir = ms => new Promise(r => setTimeout(r, ms));
const r2 = x => Math.round(x * 100) / 100;
const mesDe = f => f.slice(0, 7);
const sumaMes = (m, k) => { let [y, mo] = m.split("-").map(Number); mo += k; y += Math.floor((mo - 1) / 12); mo = ((mo - 1) % 12 + 12) % 12 + 1; return `${y}-${String(mo).padStart(2, "0")}`; };
const difMeses = (a, b) => { const [ya, ma] = a.split("-").map(Number), [yb, mb] = b.split("-").map(Number); return (yb - ya) * 12 + (mb - ma); };

fs.mkdirSync(SALIDA, { recursive: true });
const estadoPath = path.join(SALIDA, "estado.json");
const estado = fs.existsSync(estadoPath) ? JSON.parse(fs.readFileSync(estadoPath, "utf-8")) : { inicio: mesDe(PRIMER_DIA), ultimoMes: null };
const INICIO = estado.inicio;                                   // mes 0 de todos los archivos
const mesActual = mesDe(hoy);
const ultimoCerrado = sumaMes(mesActual, -1);
const primerPendiente = estado.ultimoMes ? sumaMes(estado.ultimoMes, 1) : INICIO;
const avisos = [];
if (difMeses(primerPendiente, ultimoCerrado) < 0) { console.log(`Nada que hacer: el historial ya llega a ${estado.ultimoMes}.`); process.exit(0); }

// días a procesar = los de los meses cerrados pendientes (desde el 8-feb-2024 el primero)
const dias = [];
for (let m = primerPendiente; difMeses(m, ultimoCerrado) >= 0; m = sumaMes(m, 1)) {
  const [y, mo] = m.split("-").map(Number); const n = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  for (let d = 1; d <= n; d++) { const f = `${m}-${String(d).padStart(2, "0")}`; if (f >= PRIMER_DIA) dias.push(f); }
}
const NMESES = difMeses(primerPendiente, ultimoCerrado) + 1;
// stats: `${cat}|${grupo}|${pid}|${sub}` -> Float64Array(NMESES*4) [n, suma, mín, máx] por mes
const stats = new Map();
const resumen = { dias: dias.length, diasLeidos: 0, diasSinArchivo: 0, filas: 0 };

function acumular(fecha, cat, grupo, results) {
  const mi = difMeses(primerPendiente, mesDe(fecha));
  for (const r of results || []) {
    const mk = r.marketPrice ?? r.midPrice; if (mk == null || !(mk > 0)) continue;
    const k = `${cat}|${grupo}|${r.productId}|${r.subTypeName || ""}`;
    let a = stats.get(k); if (!a) { a = new Float64Array(NMESES * 4); for (let i = 0; i < NMESES; i++) { a[i * 4 + 2] = Infinity; a[i * 4 + 3] = -Infinity; } stats.set(k, a); }
    const o = mi * 4; a[o]++; a[o + 1] += mk; if (mk < a[o + 2]) a[o + 2] = mk; if (mk > a[o + 3]) a[o + 3] = mk; resumen.filas++;
  }
}
function caminar(raiz, fecha) {
  for (const cat of CATS) {
    const dc = path.join(raiz, String(cat)); if (!fs.existsSync(dc)) continue;
    for (const g of fs.readdirSync(dc, { withFileTypes: true })) {
      if (!g.isDirectory()) continue;
      const f = [path.join(dc, g.name, "prices"), path.join(dc, g.name, "prices.json")].find(x => fs.existsSync(x)); if (!f) continue;
      try { acumular(fecha, cat, g.name, JSON.parse(fs.readFileSync(f, "utf-8")).results); } catch (e) { avisos.push(`${fecha}/${cat}/${g.name}: ${String(e.message).slice(0, 60)}`); }
    }
  }
}
async function procesar(fecha) {
  if (LOCAL) { const d = path.join(LOCAL, fecha); if (!fs.existsSync(d)) { resumen.diasSinArchivo++; return; } caminar(d, fecha); resumen.diasLeidos++; return; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "dia-" + fecha + "-"));
  try {
    let buf = null, ult = "";
    for (let i = 1; i <= 4 && !buf; i++) {
      try { const r = await fetch(`${ARCHIVO}/prices-${fecha}.ppmd.7z`, { headers: UA, signal: AbortSignal.timeout(120000) }); if (r.status === 404) { ult = "404"; break; } if (!r.ok) throw new Error("HTTP " + r.status); buf = Buffer.from(await r.arrayBuffer()); }
      catch (e) { ult = String(e.message).slice(0, 80); await dormir(2000 * i); }
    }
    if (!buf) { if (ult === "404") resumen.diasSinArchivo++; else avisos.push(`archivo ${fecha}: ${ult}`); return; }
    const f7 = path.join(dir, "a.7z"); fs.writeFileSync(f7, buf);
    const x = spawnSync("7z", ["x", "-y", `-o${dir}/x`, f7], { encoding: "utf-8", maxBuffer: 1 << 26 });
    if (x.status !== 0) { avisos.push(`7z ${fecha}: ${String(x.stderr || x.stdout).slice(0, 100)}`); return; }
    const sub = fs.readdirSync(path.join(dir, "x")).find(n => /^\d{4}-\d{2}-\d{2}$/.test(n));
    caminar(sub ? path.join(dir, "x", sub) : path.join(dir, "x"), fecha); resumen.diasLeidos++;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
}
let ix = 0;
await Promise.all(Array.from({ length: CONCURRENCIA }, async () => { while (ix < dias.length) { const f = dias[ix++]; try { await procesar(f); } catch (e) { avisos.push(`día ${f}: ${String(e.message).slice(0, 100)}`); } if (ix % 100 === 0) console.log(`  …${ix}/${dias.length} días`); } }));

// ── Escritura: un archivo por grupo, fusionando con lo ya guardado (los meses nuevos se anexan; los viejos no se tocan) ──────────────
const porGrupo = new Map();                                       // `${cat}/${grupo}` -> {pid|sub: [desfase, …]}
let bytesTodo = 0, bytesFiltrado = 0, productos = 0, productosGuardados = 0;
for (const [k, a] of stats) {
  const [cat, grupo, pid, sub] = k.split("|");
  const tri = []; let primero = -1, max = 0;
  for (let i = 0; i < NMESES; i++) {
    const n = a[i * 4];
    if (n > 0) { if (primero < 0) primero = i; tri.push(r2(a[i * 4 + 1] / n), r2(a[i * 4 + 2]), r2(a[i * 4 + 3])); if (a[i * 4 + 3] > max) max = a[i * 4 + 3]; }
    else if (primero >= 0) tri.push(null, null, null);
  }
  if (primero < 0) continue;
  while (tri.length && tri[tri.length - 1] === null) tri.pop();
  const entrada = [difMeses(INICIO, primerPendiente) + primero, ...tri];
  const largo = JSON.stringify(entrada).length + pid.length + sub.length + 6;
  bytesTodo += largo; productos++;
  if (max < MIN_USD) continue;
  bytesFiltrado += largo; productosGuardados++;
  const g = `${cat}/${grupo}`; if (!porGrupo.has(g)) porGrupo.set(g, {}); porGrupo.get(g)[`${pid}|${sub}`] = entrada;
}
for (const [g, nuevo] of porGrupo) {
  const f = path.join(SALIDA, g + ".json"); fs.mkdirSync(path.dirname(f), { recursive: true });
  const previo = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf-8")) : { m: INICIO, t: {} };
  for (const [clave, e] of Object.entries(nuevo)) {
    const p = previo.t[clave];
    if (!p) { previo.t[clave] = e; continue; }
    // anexa: el existente termina en algún mes; los meses nuevos van a continuación (con huecos null si hace falta)
    const finPrevio = p[0] + (p.length - 1) / 3, inicioNuevo = e[0];
    const relleno = Math.max(0, inicioNuevo - finPrevio);
    previo.t[clave] = [...p, ...Array(relleno * 3).fill(null), ...e.slice(1)];
  }
  fs.writeFileSync(f, JSON.stringify(previo));
}
estado.ultimoMes = ultimoCerrado; estado.actualizado = new Date().toISOString();
estado.informe = { ...resumen, productosConHistorial: productos, productosGuardados, minUSD: MIN_USD, pesoSinFiltroMB: Math.round(bytesTodo / 1048.576) / 1000, pesoConFiltroMB: Math.round(bytesFiltrado / 1048.576) / 1000, archivos: porGrupo.size, avisos: avisos.slice(0, 20) };
fs.writeFileSync(estadoPath, JSON.stringify(estado, null, 1));
console.log(JSON.stringify(estado.informe, null, 1));
