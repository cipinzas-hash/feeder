// Angst 0.0 application entry point.
// Default: legacy application, so the architecture branch does not change
// the product experience yet. Development/QA can mount an isolated module with
// ?module=planner without touching LegacyApp.
import AngstShell from "./Shell.jsx";

export default function AngstAppEntry() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const module = new URLSearchParams(search).get("module");

  return React.createElement(AngstShell, {
    legacy: module !== "planner",
    module,
  });
}
