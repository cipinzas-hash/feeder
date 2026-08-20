import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync(new URL("../app/App.jsx", import.meta.url), "utf8");

assert.match(source, /const legacy = params\.get\("legacy"\) === "1"/);
assert.match(source, /module: legacy \? null : "planner"/);
assert.doesNotMatch(source, /module !== "planner"/);

console.log("app entry boundary ok");
