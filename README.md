# Angst

**Angst** is a modular personal planning and life-management application.

This repository currently retains the historical repository name `feeder` for continuity. The product identity is now **Angst**.

## Architecture 0.0

Angst is being reorganized as a modular monorepo.

```text
app/        application shell and composition
core/       platform infrastructure
modules/    independent product domains
build/      packaging and distribution
scripts/    project-level tooling
.github/    automation
 docs/      architectural documentation
```

`0.0` is the architectural baseline. It means that module boundaries, ownership, persistence contracts and integration points are being made explicit; it does not mean that the product is finished.

## Current modules

- Planner / Semana
- Exercise
- Nutrition
- Health
- Budget
- Routines
- Feed
- Pokecripto
- Nutria
- Espíritu
- Fadiman

## Development principle

The first architectural migration changes structure before behavior. Existing user-facing behavior is treated as the source of truth until a module is explicitly versioned forward.

See `docs/ARCHITECTURE.md` and `docs/MODULES.md` for the current project model.
