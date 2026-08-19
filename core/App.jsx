// Angst 0.0 compatibility boundary.
// The historical application remains intact in LegacyApp.jsx while the shell
// and modular architecture are migrated incrementally.
import React from "react";
import LegacyApp from "./LegacyApp.jsx";
import { PlannerProvider } from "../modules/planner/PlannerProvider.jsx";

export default function AngstLegacyRuntime() {
  return React.createElement(
    PlannerProvider,
    null,
    React.createElement(LegacyApp),
  );
}
