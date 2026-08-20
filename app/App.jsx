// Angst 0.0 application entry point.
// Planner is now the default runtime on the architecture branch.
// The historical app remains available explicitly through ?legacy=1.
import AngstShell from "./Shell.jsx";

export default function AngstAppEntry() {
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = new URLSearchParams(search);
  const legacy = params.get("legacy") === "1";

  return React.createElement(AngstShell, {
    legacy,
    module: legacy ? null : "planner",
  });
}
