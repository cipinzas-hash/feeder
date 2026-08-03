// Motor de persistencia genérico. Reemplaza la "regla vital de los 22 campos"
// (documentada en angst-context-4.md §2.3): antes, todo campo de estado nuevo
// debía agregarse a mano en saveToStorage, buildExportPayload,
// REQUIRED_EXPORT_FIELDS y restoreFromPayload dentro de AngstApp. Ahora cada
// módulo lo declara una vez en su manifest.js y este archivo hace el resto.

const STORAGE_KEY = "angst-v12";

export function buildDefaultState(manifests) {
  const state = {};
  for (const m of manifests) {
    for (const [key, spec] of Object.entries(m.state || {})) {
      state[key] = structuredClone(spec.default);
    }
  }
  return state;
}

export function requiredExportFields(manifests) {
  return manifests.flatMap((m) => Object.keys(m.state || {}));
}

export function buildExportPayload(fullState, manifests) {
  const payload = {};
  for (const key of requiredExportFields(manifests)) {
    payload[key] = fullState[key];
  }
  return payload;
}

// Antes de exportar: aborta con mensaje claro en vez de generar un backup
// incompleto (mismo comportamiento que el handleExport actual).
export function validateExportPayload(payload, manifests) {
  const missing = requiredExportFields(manifests).filter((k) => !(k in payload));
  return missing.length ? { ok: false, missing } : { ok: true };
}

export function restoreFromPayload(payload, manifests) {
  const restored = {};
  for (const key of requiredExportFields(manifests)) {
    if (key in payload) restored[key] = payload[key];
  }
  return restored;
}

export async function localGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? null : JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export async function localSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    return false;
  }
}

// Secrets (API keys, etc.) — fuera del payload de backup por diseño, en su
// propia clave de localStorage. Nunca viajan en un .json exportado.
export function getSecret(manifest, secretKey) {
  const spec = manifest.secrets?.[secretKey];
  if (!spec) return null;
  return localStorage.getItem(spec.storageKey);
}

export function setSecret(manifest, secretKey, value) {
  const spec = manifest.secrets?.[secretKey];
  if (!spec) return false;
  localStorage.setItem(spec.storageKey, value);
  return true;
}

export function downloadBackupJSON(payload) {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `angst-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
