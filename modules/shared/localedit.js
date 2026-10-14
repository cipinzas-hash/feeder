// Marca de "edición local" del guard de sync con Angst-data.
//
// App.jsx compara esta marca contra el exportedAt del snapshot del repo antes
// de aplicarlo (repoEsMasNuevo): si lo local es más nuevo, NO lo pisa. Antes
// solo saveToStorage (planner) la actualizaba, así que marcar una peli en
// Vitrina, escuchar un podcast o tocar el Feed no contaba como edición y una
// lectura automática podía pisarlo con un snapshot más viejo (auditoría 13-oct-2026).
// Todo lo que el usuario edita fuera de angst-v12 llama a marcarEdicionLocal().
export const LOCAL_EDIT_KEY = "angst-last-local-edit-v1";

export function marcarEdicionLocal() {
  try { localStorage.setItem(LOCAL_EDIT_KEY, new Date().toISOString()); } catch (e) {}
}
