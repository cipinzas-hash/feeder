import {
  BASE_DATE,
  DAY_NAMES,
  DEFAULT_COOKING_OPTS,
  DEFAULT_ASEO_OPTS,
  makeEmptyDay,
  isWithKids,
  fmtTime,
} from "../modules/planner/index.js";

if (!(BASE_DATE instanceof Date)) throw new Error("Planner: BASE_DATE must be a Date");
if (DAY_NAMES.length !== 7) throw new Error("Planner: DAY_NAMES must contain 7 days");
if (DEFAULT_COOKING_OPTS.length === 0) throw new Error("Planner: cooking defaults are empty");
if (DEFAULT_ASEO_OPTS.length === 0) throw new Error("Planner: cleaning defaults are empty");

const empty = makeEmptyDay();
for (const key of ["tasks", "abasto", "cookingMode", "aseoMode", "menu", "summary", "humors", "humorCustom", "compras", "schedule"]) {
  if (!(key in empty)) throw new Error(`Planner: empty day missing ${key}`);
}

const custody = { baseDate: "2026-04-28", withKids: true, overrides: {} };
if (isWithKids("2026-04-28", custody) !== true) throw new Error("Planner: custody baseline failed");
if (isWithKids("2026-05-05", custody) !== false) throw new Error("Planner: custody alternating week failed");
if (fmtTime({ h: 8, m: 5 }) !== "08:05") throw new Error("Planner: time formatting failed");
if (fmtTime(null) !== "--:--") throw new Error("Planner: empty time formatting failed");

console.log("OK: Planner domain primitives validated");
