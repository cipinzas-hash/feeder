// SONDA (solo lectura): ¿qué productos de TCGplayer (vía tcgcsv) existen para unas cartas de Pokémon y cómo se llaman? Sirve para entender por qué una versión
// (de liga, prerelease, sello…) no aparece como variante. Busca por nombre en TODOS los grupos y lista grupo, producto, número, rareza y precios por subtipo.
// Env: NOMBRES="toxtricity,absol"  ·  salida: docs/sonda-cartas.md
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(AQUI, "..", "..", "..", "docs", "sonda-cartas.md");
const BASE = "https://tcgcsv.com/tcgplayer/3";
const NOMBRES = (process.env.NOMBRES || "toxtricity,absol").split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
const UA = { "User-Agent": "angst-feed-bot (github.com/cipinzas-hash/feeder)" };
const dormir = ms => new Promise(r => setTimeout(r, ms));
async function get(url) { for (let i = 1; i <= 5; i++) { try { const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) }); if (r.status === 429) { await dormir(5000 * i); continue; } if (!r.ok) throw new Error("HTTP " + r.status); return (await r.json()).results || []; } catch (e) { if (i === 5) return null; await dormir(1500 * i); } } return null; }
const ext = (p, ...ks) => { for (const k of ks) { const e = (p.extendedData || []).find(x => x.name === k); if (e) return e.value; } return ""; };
const grupos = await get(`${BASE}/groups`); if (!grupos) { console.error("sin grupos"); process.exit(1); }
const hallados = [], etiquetas = new Map(); let revisados = 0;
for (const g of grupos) {
  const prods = await get(`${BASE}/${g.groupId}/products`); await dormir(250); revisados++;
  if (!prods) continue;
  const m = prods.filter(p => NOMBRES.some(n => String(p.name).toLowerCase().includes(n)));
  for (const p of prods) { const t = (/\(([^)]*(league|prerelease|staff|stamp|promo|championship)[^)]*)\)/i.exec(p.name) || [])[1]; if (t) { const k = `${g.name} :: ${t}`; etiquetas.set(k, (etiquetas.get(k) || 0) + 1); } }
  if (!m.length) continue;
  const precios = (await get(`${BASE}/${g.groupId}/prices`)) || []; await dormir(250);
  for (const p of m) hallados.push({ grupo: g.name, pid: p.productId, nombre: p.name, numero: ext(p, "Number"), rareza: ext(p, "Rarity"), precios: precios.filter(r => r.productId === p.productId).map(r => `${r.subTypeName || "-"} $${r.marketPrice ?? "—"}`).join(" · ") });
}
const md = [`# Sonda de cartas (${new Date().toISOString().slice(0, 10)})`, "", `Grupos revisados: ${revisados}. Búsqueda: ${NOMBRES.join(", ")}.`, "", "| Grupo | Producto | Número | Rareza | Precios |", "|---|---|---|---|---|",
  ...hallados.sort((a, b) => a.nombre.localeCompare(b.nombre)).map(h => `| ${h.grupo} | ${h.nombre} (${h.pid}) | ${h.numero} | ${h.rareza} | ${h.precios} |`),
  "", "## Productos con etiqueta entre paréntesis (league / prerelease / staff / stamp / promo / championship), por grupo", "",
  ...[...etiquetas.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, c]) => `- ${c} × ${k}`)].join("\n");
fs.writeFileSync(OUT, md + "\n"); console.log(md.slice(0, 3000));
