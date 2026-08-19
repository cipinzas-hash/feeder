# Angst 0.0 — Migration from LegacyApp

## Purpose

Move the historical `core/LegacyApp.jsx` toward the modular Angst architecture without changing product behavior unnecessarily.

## Rules

1. `main` remains untouched during the architecture migration.
2. `core/LegacyApp.jsx` is the compatibility baseline and is not the destination for new features.
3. A domain is considered migrated only when its state, actions, persistence, and UI no longer require LegacyApp ownership.
4. Existing `angst-v12` persistence remains the compatibility data source during migration.
5. Every module begins at version `0.0` and receives an explicit public API.

## Planner extraction order

### 1. weekOffset — primary field

Status: **isolated in Planner**

Planner owns:
- state representation
- storage
- navigation actions
- provider
- UI contract

Legacy still renders its historical copy until the visual extraction is completed.

### 2. calMarks

Next extraction target.

Remove direct ownership from Legacy state and expose mark operations through Planner actions.

### 3. custody

Move custody state and its date rule behind Planner domain/actions.

### 4. routines / recurring

Move recurring-task definitions and routine collections behind Planner state/actions.

### 5. cookingOpts / aseoOpts / lastRollover

Move the remaining Planner configuration and rollover state behind the module boundary.

### 6. dayData

Final and largest Planner-state extraction. This includes task mutations, shopping items, schedule, daily notes and day-level registration fields.

### 7. Semana UI

Replace the historical `Semana` render in LegacyApp with the real `modules/planner/PlannerPage.jsx` implementation.

### 8. Legacy cleanup

Delete Planner-specific imports, refs, effects and helper functions from `core/LegacyApp.jsx`.

## Target architecture

```text
app/
  App.jsx
  Shell.jsx

core/
  App.jsx          # compatibility adapter
  LegacyApp.jsx    # temporary legacy implementation

modules/
  planner/
    PlannerPage.jsx
    PlannerProvider.jsx
    domain.js
    state.js
    actions.js
    storage.js
    legacyAdapter.js
    ownership.js
    navigation.js
```

## Exit condition for Planner 0.0

Planner is considered structurally migrated when `LegacyApp.jsx` no longer owns any of the fields listed by `PLANNER_OWNED_FIELDS` and its Semana tab is supplied by `PlannerPage`.
