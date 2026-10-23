#!/usr/bin/env node
// Sync planner (semana) → calendario Familia de Google, y bandeja Familia → Angst (issue #26, docs/gcal-sync.md).
//
// Corre en Actions (update-gcal-sync.yml). Lee el estado exportado de Angst (rama `state-sync` de Angst-data),
// calcula los eventos deseados para hoy → +WINDOW_DAYS y reconcilia SOLO los eventos con marca propia
// (extendedProperties.private.angst = "1"). Lo demás del calendario no se toca; se copia a google-inbox.json.
//
// MODO SECO por defecto: sin GCAL_LIVE=true no escribe nada en Google (solo el plan en Angst-data, privado).
// IMPORTANTE: feeder es público y los logs de Actions también → este script NUNCA imprime textos de tareas ni
// resúmenes de eventos, solo conteos y claves. Los detalles van a archivos de Angst-data (privado).

import { readFileSync, writeFileSync, existsSync, unlinkSync } from "node:fs";
import {
  addDays, todayIn, buildDesired, planSync, verificarSeguridad, buildInbox,
  esDeAngst, fechaLocalDe,
} from "./gcal-sync-lib.mjs";

const env = n => process.env[n];
const falta = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "GCAL_CALENDAR_ID", "STATE_PATH", "INBOX_PATH"].filter(n => !env(n));
if (falta.length) { console.error(`✗ Faltan variables: ${falta.join(", ")}`); process.exit(1); }

const TZ = env("GCAL_TZ") || "America/Santiago";
const LIVE = env("GCAL_LIVE") === "true";
const WINDOW_DAYS = Number(env("WINDOW_DAYS") || 42);
const CAL = encodeURIComponent(env("GCAL_CALENDAR_ID"));
const API = "https://www.googleapis.com/calendar/v3";
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function accessToken() {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"), client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: env("GOOGLE_REFRESH_TOKEN"), grant_type: "refresh_token",
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error(`token: ${j.error || r.status}`);
  return j.access_token;
}

let TOKEN = null;
// Reintenta ante 429/5xx/rate limit. Los errores no incluyen cuerpos de respuesta (pueden traer texto privado).
async function gcal(method, path, { params, body } = {}) {
  const url = `${API}${path}${params ? `?${new URLSearchParams(params)}` : ""}`;
  for (let intento = 0; ; intento++) {
    const r = await fetch(url, {
      method,
      headers: { authorization: `Bearer ${TOKEN}`, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (r.ok) return r.status === 204 ? null : r.json();
    const j = await r.json().catch(() => ({}));
    const razon = j?.error?.errors?.[0]?.reason || j?.error?.status || "";
    const reintentable = r.status === 429 || r.status >= 500 || /rateLimit/i.test(razon);
    if (!reintentable || intento >= 5) throw new Error(`${method} ${path.split("/").pop().slice(0, 12)} → ${r.status} ${razon}`);
    await dormir(500 * 2 ** intento + Math.random() * 300);
  }
}

async function listarEventos(from, to) {
  const out = [];
  let pageToken;
  do {
    const j = await gcal("GET", `/calendars/${CAL}/events`, {
      params: {
        singleEvents: "true", showDeleted: "false", maxResults: "2500", timeZone: TZ,
        timeMin: `${addDays(from, -2)}T00:00:00Z`, timeMax: `${addDays(to, 3)}T00:00:00Z`,
        ...(pageToken ? { pageToken } : {}),
      },
    });
    out.push(...(j.items || []));
    pageToken = j.nextPageToken;
  } while (pageToken);
  return out;
}

async function enParalelo(items, n, fn) {
  let i = 0, fallos = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) {
      const it = items[i++];
      try { await fn(it); } catch (e) { fallos++; console.error(`✗ ${e.message}`); }
    }
  }));
  return fallos;
}

// ── estado ────────────────────────────────────────────────────────────────
const state = JSON.parse(readFileSync(env("STATE_PATH"), "utf8"));
if (state.schemaVersion !== 1 || typeof state.dayData !== "object" || !state.dayData) {
  console.error("✗ Estado inesperado (schemaVersion/dayData): se aborta sin tocar nada");
  process.exit(1);
}
const edadH = state.exportedAt ? (Date.now() - Date.parse(state.exportedAt)) / 3.6e6 : null;
console.log(`estado exportado hace ${edadH == null ? "?" : edadH.toFixed(1)} h · modo ${LIVE ? "LIVE" : "SECO"}`);

const from = todayIn(TZ);
const to = addDays(from, WINDOW_DAYS);
TOKEN = await accessToken();

const todos = await listarEventos(from, to);
const enVentana = todos.filter(g => { const f = fechaLocalDe(g); return f && f >= from && f <= to; });
const deAngst = enVentana.filter(esDeAngst);

const deseados = buildDesired(state, { from, to });
const plan = planSync(deseados, deAngst, TZ);
verificarSeguridad(plan, { desiredCount: deseados.length, existingCount: deAngst.length });

const porTipo = {};
for (const e of deseados) porTipo[e.kind] = (porTipo[e.kind] || 0) + 1;
console.log(`ventana ${from} → ${to} · deseados ${deseados.length} ${JSON.stringify(porTipo)}`);
console.log(`plan: crear ${plan.create.length} · actualizar ${plan.update.length} · borrar ${plan.remove.length} · sin cambios ${plan.keep}`);

let fallos = 0;
if (LIVE) {
  fallos += await enParalelo(plan.create, 4, c => gcal("POST", `/calendars/${CAL}/events`, { params: { sendUpdates: "none" }, body: c.body }));
  fallos += await enParalelo(plan.update, 4, u => gcal("PUT", `/calendars/${CAL}/events/${encodeURIComponent(u.id)}`, { params: { sendUpdates: "none" }, body: u.body }));
  fallos += await enParalelo(plan.remove, 4, d => gcal("DELETE", `/calendars/${CAL}/events/${encodeURIComponent(d.id)}`, { params: { sendUpdates: "none" } }));
  console.log(`aplicado con ${fallos} fallo(s)`);
  if (env("PLAN_PATH") && existsSync(env("PLAN_PATH"))) unlinkSync(env("PLAN_PATH")); // el plan del modo seco quedó obsoleto
} else if (env("PLAN_PATH")) {
  // El plan con textos va a Angst-data (privado), nunca al log público.
  const resumen = x => ({ key: x.key, summary: x.body?.summary, start: x.body?.start?.date || x.body?.start?.dateTime });
  writeFileSync(env("PLAN_PATH"), JSON.stringify({
    generatedAt: new Date().toISOString(), window: { from, to }, live: false,
    create: plan.create.map(resumen), update: plan.update.map(resumen), remove: plan.remove, keep: plan.keep,
  }, null, 1) + "\n");
}

// ── bandeja Familia → Angst ───────────────────────────────────────────────
const eventos = buildInbox(enVentana);
let previos = null;
if (existsSync(env("INBOX_PATH"))) { try { previos = JSON.parse(readFileSync(env("INBOX_PATH"), "utf8")).events; } catch { /* archivo ilegible: se reescribe */ } }
if (JSON.stringify(previos) !== JSON.stringify(eventos)) {
  writeFileSync(env("INBOX_PATH"), JSON.stringify({ generatedAt: new Date().toISOString(), window: { from, to }, events: eventos }, null, 1) + "\n");
  console.log(`bandeja: ${eventos.length} evento(s) de otras manos (actualizada)`);
} else {
  console.log(`bandeja: ${eventos.length} evento(s) de otras manos (sin cambios)`);
}

if (fallos) process.exit(1);
