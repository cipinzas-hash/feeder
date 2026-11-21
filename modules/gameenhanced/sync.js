import { fusionarRegistros, registrosIguales } from "./lib/fusion.mjs";
import { leerRegistro, aplicarFusion, alCambiarLocal } from "./registro.js";

// ─── Sincronización del registro de juegos con Angst-data (A, nov-2026) ─────────────────────────────────────
// El registro vive en Angst-data como `game-enhanced-registro.json` (rama main), escrito en cada cambio sin depender de 📤.
// localStorage queda como caché sin conexión (y en LOCAL_KEY_FIELDS / 💾 como respaldo). Flujo:
//   · al abrir el módulo (si hay AUTH_SECRET): leer → fusionar por entrada según `actualizado` (gana la más reciente; una tumba más
//     nueva gana) → aplicar lo fusionado en local → escribir si el archivo no lo tiene todavía;
//   · tras un cambio local: espera ~3 s (ráfagas = un solo commit), vuelve a leer, fusiona y escribe;
//   · nunca `amend` en main (otros bots escriben ahí; el Worker lo ignora a propósito). Si dos dispositivos escriben a la vez, la
//     escritura del segundo falla (el Worker responde 502 por el sha) y se repite todo el ciclo: leer, fusionar, escribir.
// Sin AUTH_SECRET (o sin red) el módulo funciona igual, con el registro solo en el dispositivo, y la franja avisa «sin sincronizar».
// El AUTH_SECRET es el mismo de Simkl / podcasts / Pokécripto: se guarda una vez por dispositivo (nunca viaja en un .json).
export const WORKER_URL = "https://angst-sync.angst-66394c52.workers.dev";
export const ARCHIVO_REGISTRO = "game-enhanced-registro.json";
export const AUTH_KEY = "angst-simkl-auth-v1";
export const ESPERA_CAMBIOS_MS = 3000;
const INTENTOS = 3;

// fase: "sin-auth" | "leyendo" | "sincronizado" | "pendiente" | "escribiendo" | "error"
let estado = { fase: "sin-auth", ultimo: null, error: null };
const oyentes = new Set();
function poner(fase, error = null) {
  estado = { fase, ultimo: fase === "sincronizado" ? Date.now() : estado.ultimo, error };
  oyentes.forEach(fn => fn(estado));
}
export const estadoSync = () => estado;

export function getAuth() { try { return globalThis.localStorage.getItem(AUTH_KEY) || null; } catch (e) { return null; } }
// Solo desde una acción explícita (tocar «sin sincronizar»): nunca se pide al abrir el módulo.
export function pedirAuth() {
  const v = typeof prompt === "function" ? prompt("Pegá el AUTH_SECRET del Worker (el mismo que Simkl/podcasts/Pokécripto, una sola vez):") : null;
  if (v && v.trim()) { try { globalThis.localStorage.setItem(AUTH_KEY, v.trim()); } catch (e) { /* sin cuota */ } return v.trim(); }
  return null;
}

let enCurso = null, otraVez = false, temporizador = 0, iniciado = false;

async function ciclo() {
  const auth = getAuth();
  if (!auth) { poner("sin-auth"); return; }
  for (let intento = 0; intento < INTENTOS; intento++) {
    const r = await fetch(`${WORKER_URL}?path=${ARCHIVO_REGISTRO}`, { headers: { "X-Angst-Auth": auth } });
    if (r.status === 401) { try { globalThis.localStorage.removeItem(AUTH_KEY); } catch (e) { /* ignorar */ } poner("error", "El Worker rechazó el AUTH_SECRET"); return; }
    if (!r.ok) throw new Error(`el Worker respondió ${r.status} al leer`);
    const archivo = await r.json();
    const remoto = archivo && archivo.found === false ? null : archivo;
    const local = leerRegistro();
    const fusion = fusionarRegistros(local, remoto || {});
    if (!registrosIguales(fusion, local)) aplicarFusion(fusion);
    const ahora = leerRegistro();   // ya validado por registro.js: esto es lo que se escribe
    if (remoto && registrosIguales(ahora, { sembrado: remoto.sembrado, juegos: remoto.juegos || {}, borrados: remoto.borrados || {} })) { poner("sincronizado"); return; }
    // No crear un archivo vacío antes de la semilla: el pipeline lo leería como «registro vacío a propósito».
    if (!remoto && ahora.sembrado == null && !Object.keys(ahora.juegos).length) { poner("sincronizado"); return; }
    poner("escribiendo");
    const w = await fetch(WORKER_URL, {
      method: "POST", headers: { "X-Angst-Auth": auth, "Content-Type": "application/json" },
      body: JSON.stringify({ path: ARCHIVO_REGISTRO, payload: { v: 1, sembrado: ahora.sembrado, juegos: ahora.juegos, borrados: ahora.borrados } }),
    });
    if (w.ok) { poner("sincronizado"); return; }
    if (w.status === 401) { poner("error", "El Worker rechazó el AUTH_SECRET"); return; }
    // Conflicto (otro dispositivo escribió entre la lectura y la escritura): se repite el ciclo.
  }
  throw new Error("no se pudo escribir tras varios intentos (conflictos)");
}

// Un ciclo a la vez; si llega otro cambio mientras corre, se repite al terminar.
export function sincronizar() {
  if (enCurso) { otraVez = true; return enCurso; }
  if (estado.fase !== "pendiente" && estado.fase !== "escribiendo") poner(getAuth() ? "leyendo" : "sin-auth");
  enCurso = (async () => {
    try { await ciclo(); }
    catch (e) { poner("error", String(e && e.message || e).slice(0, 160)); }
    finally {
      enCurso = null;
      if (otraVez) { otraVez = false; await sincronizar(); }
    }
  })();
  return enCurso;
}

// Se llama al montar el módulo (idempotente): engancha los cambios locales y las reconexiones, y hace la primera lectura.
export function iniciarSync() {
  if (!iniciado) {
    iniciado = true;
    alCambiarLocal(() => {
      if (!getAuth()) { poner("sin-auth"); return; }
      poner("pendiente");
      clearTimeout(temporizador);
      temporizador = setTimeout(sincronizar, ESPERA_CAMBIOS_MS);
    });
    if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("online", () => { if (getAuth()) sincronizar(); });
  }
  return sincronizar();
}

// Para tests: vuelve al estado inicial del módulo.
export function _reiniciarSync() { clearTimeout(temporizador); enCurso = null; otraVez = false; estado = { fase: "sin-auth", ultimo: null, error: null }; }

export function useSync() {
  const [e, setE] = React.useState(estado);
  React.useEffect(() => { oyentes.add(setE); setE(estado); return () => oyentes.delete(setE); }, []);
  return e;
}

// Búsqueda de juegos en IGDB a través del Worker (el navegador no puede llamarla directo). Sin AUTH_SECRET devuelve null (alta manual).
export async function buscarJuegos(q, señal) {
  const auth = getAuth();
  if (!auth) return null;
  const r = await fetch(`${WORKER_URL}/igdb/search?q=${encodeURIComponent(q)}`, { headers: { "X-Angst-Auth": auth }, signal: señal });
  if (!r.ok) throw new Error(`IGDB ${r.status}`);
  const lista = await r.json();
  return Array.isArray(lista) ? lista : [];
}
