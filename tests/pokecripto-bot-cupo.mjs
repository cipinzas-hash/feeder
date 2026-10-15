// Escenarios del bot con la API falsa: búsqueda por set que no funciona (cosecha carta por carta), cupo diario compartido,
// cupo real bajo según cabeceras. Correr: node tests/pokecripto-bot-cupo.mjs
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

let n = 0;
const t = (nombre, fn) => { fn(); n++; console.log("✓", nombre); };
const hoy = new Date().toISOString().slice(0, 10);
const c = (id, name, number, set, setCode, extra = {}) => ({ id, cardId: setCode + "-" + number, name, number, set, setCode, estado: "hunting", carpeta: "MLP", priceHistory: [], tcgMarket: null, tcgUpdated: null, ...extra });

function escenario(inv, { env = {}, estado = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "pokebot2-")), P = f => join(dir, f);
  writeFileSync(P("inv.json"), JSON.stringify(inv)); writeFileSync(P("pending.json"), "[]"); writeFileSync(P("ov.json"), "{}");
  if (estado) writeFileSync(P("estado.json"), JSON.stringify(estado));
  const run = () => {
    writeFileSync(P("log.txt"), "");
    const r = spawnSync("node", ["--import", "./tests/helpers/mock-api.mjs", "modules/feed/scripts/build-pokecripto.mjs"], {
      cwd: process.cwd(), encoding: "utf-8",
      env: { ...process.env, TCG_API_KEY: "K", POKECRIPTO_INVENTARIO_PATH: P("inv.json"), POKECRIPTO_PENDING_PATH: P("pending.json"), POKECRIPTO_OVERRIDES_PATH: P("ov.json"),
        POKECRIPTO_ESTADO_PATH: P("estado.json"), POKECRIPTO_MERGED_PATH: P("merged.json"), POKECRIPTO_DESCUBRIMIENTO_TOPE: "40", POKECRIPTO_THROTTLE_MS: "0", POKECRIPTO_PAUSA_MS: "0", MOCK_LOG: P("log.txt"), ...env },
    });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    return { out: r.stdout, log: readFileSync(P("log.txt"), "utf-8").trim().split("\n").filter(Boolean), inv: Object.fromEntries(JSON.parse(readFileSync(P("inv.json"), "utf-8")).map(x => [x.id, x])), estado: JSON.parse(readFileSync(P("estado.json"), "utf-8")) };
  };
  return run;
}

// A) la búsqueda por set no sirve: se apaga sola y la búsqueda carta por carta cosecha ids de las cartas hermanas
const invA = [c("s1", "Solo", "5", "Delta Species", "del"), c("s2", "Solo", "5", "Otro Set", "de2"), c("x1", "Nada1", "1", "Set Uno", "u1"), c("x2", "Nada2", "2", "Set Dos", "u2"), c("x3", "Nada3", "3", "Set Tres", "u3")];
const runA = escenario(invA, { env: { MOCK_NO_SETSEARCH: "1" } });
const a1 = runA();
t("cosecha: UNA búsqueda 'Solo 5' deja tcgId y precio a las dos cartas (mismo nombre y número en dos sets)", () => {
  assert.equal(a1.inv.s1.tcgId, "t-sol-5"); assert.equal(a1.inv.s2.tcgId, "t-sol2-5");
  assert.equal(a1.inv.s1.priceHistory.at(-1).src, "tpl"); assert.equal(a1.inv.s2.tcgMarket, 9);
  assert.equal(a1.log.filter(l => l === "SEARCH q=Solo 5 page=1").length, 1);
  assert.equal(a1.estado.ultimaCorrida.rotacion.idsCosechadosDeOtras >= 1, true);
});
t("sin match en 3 sets seguidos: el descubrimiento por set se apaga 7 días y queda el diagnóstico legible en el estado", () => {
  assert.ok(a1.estado.descubrimientoSetApagadoHasta > hoy);
  assert.equal(a1.estado.diagnosticoDescubrimiento.resultados, 0); assert.ok(a1.estado.diagnosticoDescubrimiento.consulta);
});
const a2 = runA();
t("2ª corrida: no repite búsquedas por set mientras está apagado", () => {
  assert.ok(!a2.log.some(l => /^SEARCH q=(Set Uno|Set Dos|Set Tres|Delta Species|Otro Set) /.test(l) && !/ \d+ page/.test(l.replace(/ page=\d+$/, "")) ));
});

// B) cupo diario ya gastado por otra corrida: cero consultas a tcgpricelookup, sigue por pokemontcg.io
const runB = escenario([c("g1", "Zzz", "1", "Gamma", "gam", { cardId: "gam-1" })], { estado: { cupoDia: { fecha: hoy, usadas: 85 } } });
const b = runB();
t("cupo diario compartido: si ya se usaron 85 hoy no hace ninguna consulta a tcgpricelookup y el resto sigue por pokemontcg.io", () => {
  assert.equal(b.log.filter(l => /^(SEARCH|BATCH)/.test(l)).length, 0);
  assert.equal(b.inv.g1.tcgMarket, 0.4); assert.equal(b.inv.g1.priceHistory.at(-1).src, "ptcg");
});

// C) la API dice que quedan 5 consultas reales: tras la primera, el bot se detiene
const runC = escenario(invA.concat([c("a1", "Foo", "1", "Alpha", "alp")]), { env: { MOCK_REMAINING: "5" } });
const cc = runC();
t("cupo real bajo (cabecera = 5): se detiene después de la primera consulta y lo anota", () => {
  assert.equal(cc.log.filter(l => /^(SEARCH|BATCH)/.test(l)).length, 1);
  assert.equal(cc.estado.ultimaCorrida.cupoRestanteApi, 5);
});
// D) sin cupo de tcgpricelookup: la carta que pokemontcg.io tampoco puede preciar se aparta de la cola (ptcgIntento), no se atasca
const runD = escenario([c("n1", "NadaEnNingunLado", "1", "Nop", "nop"), c("g1", "Zzz", "1", "Gamma", "gam", { cardId: "gam-1" })], { estado: { cupoDia: { fecha: hoy, usadas: 85 } } });
const d = runD();
t("sin cupo: la carta sin precio queda con ptcgIntento (no con tcgIntento) y la que sí tiene precio sigue su camino", () => {
  assert.equal(d.inv.n1.ptcgIntento, hoy); assert.equal(d.inv.n1.tcgIntento, undefined); assert.equal(d.inv.g1.tcgMarket, 0.4);
});
const runE = escenario([c("a1", "Foo", "1", "Alpha", "alp"), c("a2", "Bar", "2", "Alpha", "alp")], { env: { POKECRIPTO_DESCUBRIMIENTO_TOPE: "0" } });
const e = runE();
t("descubrimiento por set con tope 0 (el valor por defecto): no hace ninguna búsqueda por nombre de set", () => {
  assert.ok(!e.log.some(l => l.startsWith("SEARCH q=Alpha")));
  assert.equal(e.estado.ultimaCorrida.descubrimiento.llamadas, 0);
  assert.equal(e.inv.a1.tcgId, "t-alp-1"); // igual consigue su tcgId por la búsqueda carta por carta
});
console.log(`\n${n} pruebas en verde`);
