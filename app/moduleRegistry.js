import planner from "../modules/planner/manifest.js";
import ejercicio from "../modules/ejercicio/manifest.js";
import nutricion from "../modules/nutricion/manifest.js";
import salud from "../modules/salud/manifest.js";
import presupuesto from "../modules/presupuesto/manifest.js";
import rutinas from "../modules/rutinas/manifest.js";
import feed from "../modules/feed/manifest.js";
import pokecripto from "../modules/pokecripto/manifest.js";
import nutria from "../modules/nutria/manifest.js";
import espiritu from "../modules/espiritu/manifest.js";
import fadiman from "../modules/fadiman/manifest.js";

export const MODULES = [
  planner,
  ejercicio,
  nutricion,
  salud,
  presupuesto,
  rutinas,
  feed,
  pokecripto,
  nutria,
  espiritu,
  fadiman,
];

export const MODULES_BY_ID = Object.fromEntries(
  MODULES.map((module) => [module.id, module]),
);

export function assertModuleVersions() {
  const invalid = MODULES.filter((module) => module.version !== "0.0");
  if (invalid.length) {
    throw new Error(
      `Angst 0.0: módulos sin versión 0.0: ${invalid.map((m) => m.id).join(", ")}`,
    );
  }
  return true;
}
