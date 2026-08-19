# Angst App Shell — v0.0

This directory owns application composition.

## Current composition modes

- `legacy` (default): renders `core/App.jsx`, preserving the historical application while migration is underway.
- `planner`: mounts `modules/planner/PlannerPage.jsx` through a real module-owned state/action contract, without rendering `LegacyApp`.

## Responsibilities

The Shell:

- registers available modules;
- chooses top-level composition;
- mounts module pages;
- provides explicit cross-module integration contracts;
- coordinates application-wide lifecycle events.

The Shell should not permanently own a module's domain state, business rules, or persistence implementation.

## Migration rule

New product capabilities must not be added to `core/LegacyApp.jsx`. Existing behavior is migrated out of that file module by module.
