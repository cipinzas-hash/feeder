// pokecripto-reconcile-pending.mjs (12-oct-2026)
// Después de que el bot fusionó pending al inventario, deja en pending SOLO lo que el cliente haya encolado
// mientras el bot corría. Se corre dentro del checkout de Angst-data, ANTES de cada intento de commit/push:
// lee la versión de pending que hay en origin/main (la más nueva) y le quita las entradas que el bot ya fusionó
// (misma id Y mismo contenido). Antes el bot escribía "[]" y pisaba esas altas.
// Si el bot no llegó a fusionar nada (no existe MERGED_PATH) no toca pending.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { pendingRestante } from "../../pokecripto/lib/review.mjs";

const PENDING = process.env.POKECRIPTO_PENDING_PATH, MERGED = process.env.POKECRIPTO_MERGED_PATH, REPO = process.env.ANGST_DATA_DIR;
if (!PENDING || !MERGED || !REPO) { console.error("✗ Faltan POKECRIPTO_PENDING_PATH / POKECRIPTO_MERGED_PATH / ANGST_DATA_DIR"); process.exit(1); }
if (!existsSync(MERGED)) { console.log("ℹ Sin registro de lo fusionado: pending queda como está"); process.exit(0); }
let origen = [];
try { origen = JSON.parse(execSync("git show origin/main:pokecripto-pending.json", { cwd: REPO, encoding: "utf-8" })); }
catch (e) { try { origen = JSON.parse(readFileSync(PENDING, "utf-8")); } catch (e2) { origen = []; } }
const resto = pendingRestante(Array.isArray(origen) ? origen : [], JSON.parse(readFileSync(MERGED, "utf-8")));
writeFileSync(PENDING, JSON.stringify(resto, null, 2));
console.log(`✓ pending: ${resto.length} entrada(s) encolada(s) durante la corrida se conservan`);
