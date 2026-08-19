# Angst — Architecture 0.0

## Status

- Project identity: **Angst**
- Historical repository: `feeder`
- Architecture baseline: **0.0**
- Working branch: `angst-architecture-0.0`
- This document defines the target architecture before structural migration.

## 1. Principles

1. **Angst is the product; `feeder` is repository history.** The codebase is being reorganized under the Angst identity without discarding the existing implementation history.
2. **Core is infrastructure, not a feature.** Core provides shared capabilities required by modules and the application shell. A feature should not be placed in Core merely because it is important.
3. **Modules own their state and behavior.** A module declares its persisted state through a manifest and exposes a UI entry point to the shell.
4. **The shell composes modules.** The application layer decides navigation, placement, and cross-module integration; modules should not import the application component directly.
5. **Cross-module communication is explicit.** Shared state should be passed through contracts, services, or events rather than through arbitrary access to another module's React state.
6. **Persistence is infrastructure.** Saving, restore, backup and secrets are Core services. A module declares what it owns; Core handles the mechanics.
7. **Build infrastructure is separate from runtime architecture.** GitHub Actions, feed builders and bundling scripts are tooling, not application modules.
8. **0.0 is a foundation snapshot.** We freeze the conceptual boundaries first; feature evolution begins after the architecture baseline is accepted.

## 2. Target shape

```text
angst/
├── app/                     # composition of the product
│   ├── App.jsx
│   ├── registry.js          # module registry
│   └── navigation.js
│
├── core/                    # platform services only
│   ├── persistence.js
│   ├── dates.js
│   ├── notifications.js
│   ├── format.js
│   ├── events.js            # target, to be introduced
│   └── ui/                   # target extraction from current shared UI
│
├── modules/                 # product modules
│   ├── planner/
│   ├── exercise/
│   ├── nutrition/
│   ├── health/
│   ├── budget/
│   ├── routines/
│   ├── feed/
│   ├── media/
│   ├── gaming/              # target grouping; current submodules remain separate during migration
│   ├── spirit/
│   ├── business/
│   └── ...
│
├── build/                   # bundling / generation tools
├── .github/                 # CI / scheduled jobs
└── docs/                    # architecture, module contracts, roadmap
```

This is a **target shape**, not a request to rename every directory immediately. Migration is incremental.

## 3. Current-to-target interpretation

### Application / Shell

`core/App.jsx` is currently doing application composition, global state management, navigation, integration glue, and feature logic at once. It is the primary architectural bottleneck. The first major migration is to reduce it to composition and orchestration.

The current application entry point also imports the existing module pages directly. That is useful evidence that the module boundary already exists, but the shell still owns too much module state.

### Core / Platform

Current files that are strong candidates for Core:

- `core/persistence.js`
- `core/dates.js`
- `core/format.js`
- `core/notifications.js`
- selected shared UI primitives from `core/ui.jsx`

`core/stress.js` is **not yet accepted as permanent Core**. It appears to encode planner-domain logic and should be evaluated as part of the Planner module before being retained as a platform service.

### Planner

The current `dayData`, week navigation, recurring tasks, calendar marks, rollover behavior, custody scheduling, cooking/cleaning options and related logic currently live inside `AngstApp`. These belong conceptually to the Planner module, not to Core.

This is the most important boundary to establish because many other modules currently integrate with Planner through props/callbacks.

### Current modules

The repository currently contains these explicit module directories:

- `ejercicio`
- `espiritu`
- `fadiman`
- `feed`
- `nutria`
- `nutricion`
- `pokecripto`
- `presupuesto`
- `rutinas`
- `salud`

These are **candidate product modules**, not yet a declaration that their final boundaries are correct.

## 4. Module contract

Every first-class module should converge on this shape:

```text
modules/<module>/
├── manifest.js
├── <Module>Page.jsx
├── state.js             # optional
├── service.js           # optional
├── defaults.js          # optional
├── components/          # optional
└── README.md
```

The minimum contract is:

```js
export default {
  id: "example",
  version: "0.0",
  tabLabel: "Example",
  state: {
    // module-owned persisted state
  },
  secrets: {
    // optional, never included in backups
  }
};
```

Version belongs to the module contract, not to arbitrary commit messages.

## 5. Persistence contract

The current code already contains the beginning of the intended architecture: `core/persistence.js` builds default state, determines export fields, validates backups and restores state from module manifests.

That direction is retained.

The rule for Angst 0.0 is:

> **A module declares the data it owns once; Core provides persistence mechanics.**

No module should require edits in multiple unrelated Core functions merely because a new state field was introduced.

## 6. Dependencies

Dependency direction should be:

```text
App / Shell
    ↓
Modules
    ↓
Core / Platform
```

Permitted:

- App imports modules.
- App imports Core services.
- Modules import Core services.
- Modules expose explicit integration hooks.

Discouraged / forbidden as architecture settles:

- Core importing product modules.
- A module importing `App.jsx`.
- A module directly mutating another module's state.
- Feature code hidden inside generic Core utilities.

When two modules need to cooperate, the integration belongs at the shell or in an explicit shared service/contract.

## 7. Build and data pipelines

The current repository also contains a feed builder with its own package and GitHub Actions. That is evidence that `feed` is more than a UI page: it has a data-generation pipeline.

Therefore:

```text
Feed module
   ├── runtime UI
   └── feed data pipeline
          └── GitHub Actions
```

The pipeline is part of the Feed subsystem but remains **build/infrastructure tooling**, not browser runtime code.

## 8. What is deliberately NOT being done in 0.0

- No immediate repository split into ten repositories.
- No large rewrite of all modules at once.
- No feature additions during structural migration.
- No renaming of persisted keys unless required for correctness.
- No deletion of historical code until the replacement path is proven.

The purpose of 0.0 is to create a stable architectural base from which later versions can evolve safely.
