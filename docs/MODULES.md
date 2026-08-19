# Angst — Module Registry 0.0

This file is the initial inventory of the product modules discovered in the historical `feeder` codebase.

`0.0` means **identified and bounded**, not complete or stable.

| Module | Current code | 0.0 state owner | Initial architectural status |
|---|---|---|---|
| Planner | currently embedded mainly in `core/App.jsx` | target: `dayData`, week navigation, recurring tasks, calendar marks, rollover and planner-specific configuration | **Extract first** |
| Exercise | `modules/ejercicio` | `ejercicioLog`, `customEjercicios`, `ejercicioDecks` | **Module confirmed** |
| Nutrition | `modules/nutricion` | `nutriLog`, `customFoods`, `foodOverrides`, `nutriDecks` | **Module confirmed** |
| Health | `modules/salud` | `kidsHealth` / family configuration | **Module confirmed** |
| Budget | `modules/presupuesto` | `budgets` | **Module confirmed** |
| Routines | `modules/rutinas` | `routines` | **Module confirmed** |
| Feed | `modules/feed` | own feed-related local storage today | **Module confirmed; pipeline attached** |
| Pokecripto | `modules/pokecripto` | inventory, folders, dark catalog, price cache; API secret kept separately | **Module confirmed** |
| Nutria | `modules/nutria` | `nutria` | **Module confirmed; business domain needs explicit contract** |
| Espíritu | `modules/espiritu` | no independent state today | **Module confirmed; integration-heavy** |
| Fadiman | `modules/fadiman` | current manifest declares `fadimanData`; page also uses additional log/protocol concepts that need normalization | **Needs state-contract audit** |

## Module boundaries at 0.0

### Planner

Planner is not yet a directory. It is the largest architectural extraction still required.

Current evidence in `core/App.jsx` includes:

- `dayData`
- `weekOffset`
- routines / recurring tasks
- calendar marks
- rollover state
- cooking and cleaning options
- schedule state
- task editing / drag state
- custody scheduling
- day-level task model

These are planner/application concerns and should not remain permanent responsibilities of Platform Core.

### Exercise

The manifest already declares the principal persisted state, which is the model to replicate for other modules: the module owns its state and Core persistence consumes the manifest.

### Nutrition

Nutrition has a clear state boundary. It also consumes a stress callback from the planner side rather than owning stress state itself. That relationship should later become an explicit integration contract.

### Health

Health owns the health/family dataset. Personal or family data must never be hardcoded into source files or architecture documentation.

### Budget

Budget owns monthly budget data. Nutria currently consumes budget information through integration props; this is an explicit cross-module relationship that should remain in the shell/integration layer rather than creating hidden coupling.

### Routines

Routines currently has a small isolated state contract. It is a good candidate for a clean standalone module boundary.

### Feed

Feed is both a runtime module and a data pipeline subsystem. The browser module reads generated JSON while GitHub Actions and the feed builder generate that data. The separation between runtime state and generated data should remain explicit.

### Pokecripto

Pokecripto already demonstrates the intended manifest model: persisted state and secrets are distinct, and the API key is deliberately excluded from backup payloads.

### Nutria

Nutria is larger than a normal utility module: it represents a business/productivity domain containing sales, costs, formulas and product data. Its default state factory currently lives in `modules/nutria/defaults.js`, which is evidence that the module should own its own domain defaults instead of placing them in shared Core.

### Espíritu

Espíritu currently declares no owned persisted state and consumes Planner/Health data through props. That means its boundary is currently more like a view/integration module than an independent data domain. We will preserve it for 0.0 but review whether its final home should be a module or a Planner subfeature.

### Fadiman

Fadiman is a specialized tracking module. Its manifest currently declares `fadimanData`, while the page also references protocol logs separately. Before migration is considered complete, the state contract must account for every persisted concept owned by the module.

## Versioning rule

Every module receives an explicit version:

```text
0.0 = architectural baseline
0.1 = first meaningful functional evolution
0.2 = second evolution
...
1.0 = stable public module contract
```

The first implementation target is **not** to make every module `0.1`. It is to make every module honest about what it owns at `0.0`.

## Extraction order

1. Planner / Semana extraction from `core/App.jsx`
2. App/Shell and module registry
3. Core UI split from product-specific UI
4. Persistence normalization against all manifests
5. Fadiman state-contract audit
6. Cross-module integration contracts
7. Build and CI boundary cleanup
8. Optional repository splitting after module contracts are stable
