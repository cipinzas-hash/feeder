// Angst application shell — 0.0
// Owns composition. LegacyApp is kept as the compatibility implementation
// until modules replace its views one by one.
import LegacyApp from "../core/App.jsx";
import { MODULES } from "./moduleRegistry.js";

export function AngstShell({ legacy = true }) {
  if (legacy) return <LegacyApp />;

  throw new Error("Angst 0.0 shell has no non-legacy module composition yet.");
}

export function getModuleRegistry() {
  return MODULES;
}

export default AngstShell;
