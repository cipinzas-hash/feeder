import { STORAGE_KEY } from "./constants.js";

// Guardar desde Vitrina en el Buzón de Feed. Feed y Vitrina son páginas
// excluyentes (nunca están montadas a la vez), así que escribir directo a
// localStorage es seguro: FeedPage relee el estado completo al montar.
// Devuelve true si agregó, false si ya estaba (por guid) o si falló.
export function addToFeedBuzon(item) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const s = raw ? JSON.parse(raw) : {};
    const buzon = Array.isArray(s.feedBuzon) ? s.feedBuzon : [];
    if (buzon.some(b => b.guid === item.guid)) return false;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...s, feedBuzon: [...buzon, item] }));
    return true;
  } catch (e) { return false; }
}

// Cuántos ítems hay en el Buzón (para el contador del tab 📌 fuera de Feed).
export function countFeedBuzon() {
  try {
    const s = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    return Array.isArray(s.feedBuzon) ? s.feedBuzon.length : 0;
  } catch (e) { return 0; }
}
