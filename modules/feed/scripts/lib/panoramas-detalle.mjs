// panoramas-detalle.mjs — lectura limpia del detalle de un evento (módulo Panoramas).
// ─────────────────────────────────────────────────────────────────────────────
// Cloudflare Browser Rendering (/markdown) devuelve la PÁGINA ENTERA en Markdown:
// menú, banners de cookies, pie. Este archivo (puro, sin red, probado en
// tests/panoramas-detalle.mjs) deja solo el texto del evento: parte después del título,
// descarta bloques que son enlaces/menú/avisos y corta en el pie.
// Sin extractor por sitio: la Red de Museos reúne decenas de sitios distintos.
// ─────────────────────────────────────────────────────────────────────────────

export const MAX_DETALLE = 2500;   // caracteres por evento (panoramas.json viaja a cada celular)
const MIN_DETALLE = 80;            // menos que esto no es una descripción: se descarta

const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9ñ ]+/g, " ").replace(/\s+/g, " ").trim();

const RUIDO = /(cookies?|política de privacidad|politica de privacidad|términos y condiciones|aviso legal|compartir (en|por)|síguenos|siguenos|suscr[ií]be(te)?|newsletter|boletín|saltar al contenido|ir al contenido|volver arriba|buscar en el sitio|mapa del sitio|accesibilidad|todos los derechos|©|copyright|powered by|desarrollado por)/i;
const PIE = /(todos los derechos|©|copyright|mapa del sitio|política de privacidad|politica de privacidad|síguenos|siguenos|suscr[ií]be(te)?|newsletter|contáctanos|contactanos|eventos relacionados|te puede interesar|más noticias|otras exposiciones|otras actividades)/i;

// Quita el marcado Markdown de un bloque y mide cuánto de él era texto de enlaces.
function bloqueLimpio(raw) {
  const enlaces = [...raw.matchAll(/\[([^\]]*)\]\([^)]*\)/g)].reduce((n, m) => n + m[1].length, 0);
  const sinImg = raw.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  const texto = sinImg
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/^[ \t]*(#{1,6}|>|[-*+•]|\d+[.)])[ \t]+/gm, "")
    .replace(/[*_`~]{1,3}/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, " ")
    .trim();
  return { texto, densidadEnlaces: raw.length ? enlaces / raw.length : 0 };
}

function recortar(texto, max) {
  if (texto.length <= max) return texto;
  const corte = texto.slice(0, max);
  const finPar = corte.lastIndexOf("\n\n");
  const finOra = Math.max(corte.lastIndexOf(". "), corte.lastIndexOf("? "), corte.lastIndexOf("! "));
  const i = finPar > max * 0.6 ? finPar : finOra > max * 0.6 ? finOra + 1 : corte.lastIndexOf(" ");
  return corte.slice(0, i > 0 ? i : max).trimEnd() + "…";
}

// markdown de la página entera + título del evento → texto plano en párrafos ("" si no hay nada útil).
export function leerMarkdown(markdown, titulo = "") {
  if (typeof markdown !== "string" || !markdown.trim()) return "";
  const bloques = markdown.replace(/\r/g, "").split(/\n\s*\n/).map(b => b.trim()).filter(Boolean);
  const t = norm(titulo);
  const clave = t.slice(0, 30);
  // Empieza después del PRIMER bloque que contiene el título (el menú suele repetirlo antes: se
  // prefiere un encabezado # que lo contenga; si no hay, el primer bloque que lo nombra).
  let ini = clave ? bloques.findIndex(b => /^#{1,3}\s/.test(b) && norm(b).includes(clave)) : -1;
  if (ini < 0 && clave) ini = bloques.findIndex(b => norm(b).includes(clave) && b.length < 220);
  const desde = ini >= 0 ? ini + 1 : 0;

  const vistos = new Set();
  const salida = [];
  for (const raw of bloques.slice(desde)) {
    const { texto, densidadEnlaces } = bloqueLimpio(raw);
    if (!texto) continue;
    if (salida.length && PIE.test(texto) && texto.length < 200) break;      // llegó al pie
    if (/^#{1,6}\s/.test(raw) && salida.length && /^(compart|relacionad|te puede|otras? )/i.test(texto)) break;
    if (densidadEnlaces > 0.5) continue;                                    // menú / lista de enlaces
    if (RUIDO.test(texto) && texto.length < 220) continue;                  // cookies, redes, créditos del sitio
    const palabras = texto.split(" ").length;
    // Sin el título como ancla (la página no lo repite) se exige más para no colar menús sueltos.
    if (texto.length < (ini >= 0 ? 40 : 80) || palabras < (ini >= 0 ? 6 : 12)) continue;   // etiquetas sueltas, fechas, botones
    if (!/[.,;]/.test(texto)) continue;                                     // sin puntuación de prosa: casi siempre un menú en texto plano
    const k = norm(texto).slice(0, 60);
    if (vistos.has(k)) continue;
    vistos.add(k);
    salida.push(texto);
    if (salida.join("\n\n").length > MAX_DETALLE * 1.4) break;
  }
  const detalle = recortar(salida.join("\n\n"), MAX_DETALLE);
  return detalle.length >= MIN_DETALLE ? detalle : "";
}

// HTML del resumen de WordPress (excerpt.rendered) → texto plano. Es el respaldo de CCLM.
export function textoDeHtml(html) {
  const t = String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8211;|&#8212;/g, "–").replace(/&#8217;|&#8216;/g, "'").replace(/&hellip;|\[&hellip;\]/g, "…").replace(/&#\d+;|&[a-z]+;/g, " ").replace(/\s+/g, " ").trim();
  return t.length >= MIN_DETALLE ? recortar(t, MAX_DETALLE) : "";
}

// Llama a Cloudflare Browser Rendering /markdown. Devuelve {ok, markdown} o {ok:false, motivo, fatal}
// (fatal = credenciales/permiso: no tiene sentido seguir con el resto de eventos).
export async function pedirMarkdown(url, { cuenta, token, fetchFn = fetch, timeoutMs = 45000 }) {
  const c = new AbortController();
  const to = setTimeout(() => c.abort(), timeoutMs);
  try {
    const r = await fetchFn(`https://api.cloudflare.com/client/v4/accounts/${cuenta}/browser-rendering/markdown`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ url, rejectRequestPattern: ["/^.*\\.(css|woff2?|png|jpe?g|gif|svg|webp|mp4)(\\?.*)?$/"] }),
      signal: c.signal,
    });
    if (r.status === 401 || r.status === 403) return { ok: false, fatal: true, motivo: `HTTP ${r.status} (el token no tiene permiso Browser Rendering - Edit o no es válido)` };
    if (r.status === 429) return { ok: false, fatal: true, limite: true, esperaSeg: Number(r.headers && r.headers.get && r.headers.get("retry-after")) || null, motivo: "HTTP 429 (límite de Cloudflare alcanzado)" };
    if (!r.ok) return { ok: false, motivo: `HTTP ${r.status}` };
    const j = await r.json();
    if (!j || j.success === false || typeof j.result !== "string") return { ok: false, motivo: "respuesta sin markdown" };
    return { ok: true, markdown: j.result };
  } catch (e) {
    return { ok: false, motivo: e && e.name === "AbortError" ? "timeout" : String((e && e.message) || e) };
  } finally { clearTimeout(to); }
}
