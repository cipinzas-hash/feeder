// ─── Funciones puras del pipeline de Game enhanced (probadas en tests/gameenhanced.mjs) ─────────────
// Sin red ni disco: reciben datos ya descargados. Las usa build-game-enhanced.mjs.
export const DIA = 86400000;

export const norm = s => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Días desde `iso` hasta `ahora` (negativo si está en el futuro). null si no hay fecha válida.
export function diasDesde(iso, ahora) {
  const t = iso ? new Date(iso).getTime() : NaN;
  return Number.isFinite(t) ? Math.round((ahora - t) / DIA) : null;
}

// ── 1) awesome-decomp-games ─────────────────────────────────────────────────
// Un proyecto casa con un terminado si el título del proyecto, sin el paréntesis final con el nombre del
// repo/port ("Wolfenstein 3D (ECWolf)" → "Wolfenstein 3D"), es el mismo título, o ese título más una
// palabra de edición ("Remastered", "HD", "DX"…). Las secuelas NO cuentan (Tekken Tag Tournament 2,
// Final Fantasy XI…): antes se cruzaba por "contiene" y mezclaba sagas enteras.
const EDICIONES = new Set(["remastered", "remaster", "hd", "dx", "directorscut", "definitiveedition", "remake", "fullbody", "goldedition", "specialedition"]);
const SUFIJO_PAREN = /\s*\((?:[^()]|\([^()]*\))*\)\s*$/;

export function tituloLimpio(titulo) {
  let t = String(titulo || "");
  for (let i = 0; i < 3 && SUFIJO_PAREN.test(t); i++) t = t.replace(SUFIJO_PAREN, "");
  return t;
}

export function casaConTerminado(tituloProyecto, busqueda) {
  const k = norm(tituloLimpio(tituloProyecto)), clave = norm(busqueda);
  if (!clave || !k) return false;
  return k === clave || (k.startsWith(clave) && EDICIONES.has(k.slice(clave.length)));
}

export function proyectosDeDecomps(juegosFuente, terminados, ahora) {
  const porId = new Map();
  for (const t of terminados) {
    for (const j of juegosFuente) {
      if (j.type === "tool" || !casaConTerminado(j.title, t.busqueda)) continue;
      const it = porId.get(j.id) || {
        id: "d-" + j.id, tipo: "d", titulo: j.title, subtipo: j.type, plataforma: j.platform || null,
        estrellas: j.stars ?? null, ultimoCommit: j.last_commit || null, release: j.release || null, fechaRelease: j.release_date || null,
        url: j.url || null, jugableUrl: j.play_url || null, pideAssets: j.needs_assets || null,
        ia: !!j.ai_flag, inactivo: !!(j.inactive || j.archived), tuyos: [],
      };
      if (!it.tuyos.includes(t.titulo)) it.tuyos.push(t.titulo);
      porId.set(j.id, it);
    }
  }
  return [...porId.values()].map(it => {
    const d = [diasDesde(it.ultimoCommit, ahora), diasDesde(it.fechaRelease, ahora)].filter(x => x !== null);
    return { ...it, tuJuego: it.tuyos[0], dias: d.length ? Math.max(0, Math.min(...d)) : 9999 };
  }).sort((a, b) => a.dias - b.dias || (a.id < b.id ? -1 : 1));
}

// ── 2) IGDB ─────────────────────────────────────────────────────────────────
// Tipos de juego de IGDB que cuentan como "juego nuevo": principal (0), expansión independiente (4) y remake (8).
// Quedan fuera DLC, paquetes, mods, remasterizaciones, ediciones ampliadas y ports (son el ruido de Namco, SNK, Konami…).
export const TIPOS_IGDB_VALIDOS = new Set([0, 4, 8]);
const NOMBRE_RUIDO = /^arcade archives\b|\bmaster collection\b|\banniversary collection\b/i;

export function esJuegoNuevoValido(g) {
  const tipo = g.game_type ?? g.category ?? 0;
  const t = typeof tipo === "object" && tipo !== null ? tipo.id : tipo;
  return TIPOS_IGDB_VALIDOS.has(t) && !g.version_parent && !NOMBRE_RUIDO.test(g.name || "");
}

// IGDB usa el 31-dic como fecha cuando solo se conoce el año.
export function fechaAproximada(unix) {
  const d = new Date(unix * 1000);
  return d.getUTCMonth() === 11 && d.getUTCDate() === 31;
}

// Desarrolladoras a partir de los resultados de buscar cada terminado en IGDB.
export function mapaDeEstudios(resultados) {
  const mapa = new Map();
  for (const r of resultados) {
    for (const dv of r.desarrolladoras || []) {
      const e = mapa.get(dv.id) || { id: dv.id, nombre: dv.nombre, tuyos: [] };
      if (!e.tuyos.includes(r.titulo)) e.tuyos.push(r.titulo);
      mapa.set(dv.id, e);
    }
  }
  return [...mapa.values()].sort((a, b) => a.id - b.id);
}

// Lanzamientos recientes y próximos de las desarrolladoras → ítems "estudio" (sin repetir juegos co-desarrollados).
export function itemsDeEstudios(porEstudio, ahora) {
  const porId = new Map();
  for (const { estudio, juegos } of porEstudio) {
    for (const g of juegos) {
      if (!g.first_release_date || !esJuegoNuevoValido(g)) continue;
      const it = porId.get(g.id) || {
        id: "e-" + g.id, tipo: "e", titulo: g.name,
        fecha: new Date(g.first_release_date * 1000).toISOString().slice(0, 10),
        fechaAprox: fechaAproximada(g.first_release_date),
        plataformas: (g.platforms || []).map(p => p.abbreviation).filter(Boolean).slice(0, 6),
        url: g.url || null, estudios: [], tuyos: [],
      };
      if (!it.estudios.includes(estudio.nombre)) it.estudios.push(estudio.nombre);
      for (const t of estudio.tuyos) if (!it.tuyos.includes(t)) it.tuyos.push(t);
      porId.set(g.id, it);
    }
  }
  return [...porId.values()].map(it => ({
    ...it, estudio: it.estudios.join(" / "), tuJuego: it.tuyos[0],
    dias: Math.round((ahora - new Date(it.fecha + "T00:00:00Z").getTime()) / DIA),
  })).sort((a, b) => Math.abs(a.dias) - Math.abs(b.dias) || (a.id < b.id ? -1 : 1));
}
