# Planner — v0.0

Planner is the canonical home for the weekly planning domain currently embedded in `core/App.jsx`.

## Public entry

`PlannerPage.jsx` is the module entrypoint declared by `manifest.js`.

The Shell mounts it with three contracts:

```js
{
  state,
  actions,
  integrations,
}
```

`state` is Planner-owned state. `actions` contains Planner mutations. `integrations` exposes read-only or explicitly defined information supplied by the application Shell.

## Ownership

Planner owns:

- day-level planning data;
- week navigation state;
- recurring tasks;
- routines used by the planner;
- calendar marks belonging to planner state;
- rollover behavior;
- planner-specific cooking and cleaning options;
- custody/calendar scheduling data;
- task editing and scheduling behavior.

## Internal layers

- `domain.js` — pure concepts and rules;
- `state.js` — immutable state model/helpers;
- `actions.js` — state transitions exposed to the Shell;
- `PlannerPage.jsx` — UI entrypoint;
- `index.js` — public module API.

## Integration

Other modules must consume Planner information through explicit selectors, callbacks, or Shell-provided integrations.

Examples already visible in the current implementation include Nutrition consuming a stress score derived from Planner state and Espíritu consuming day/calendar information.

## Migration rule

The existing behavior is the source of truth during migration. The first extraction should change structure, not product behavior.

The transitional `PlannerPage` is intentionally minimal. It establishes the mount contract before the historical `Semana` UI is moved out of `core/App.jsx`.

## Version

`0.0` — architectural baseline.
