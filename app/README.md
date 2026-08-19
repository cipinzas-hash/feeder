# Angst App Shell — v0.0

This directory owns the application composition layer.

`app/App.jsx` is the build entry point and delegates to `app/Shell.jsx`. The Shell currently mounts `core/LegacyApp.jsx` through the compatibility boundary in `core/App.jsx`, so the product keeps its existing behavior while modules are extracted.

## Responsibilities

The Shell owns:

- the top-level application composition;
- the module registry;
- top-level navigation and module mounting;
- explicit cross-module integration contracts;
- application-wide lifecycle coordination.

## Non-responsibilities

The Shell must not permanently own a module's domain state, business rules, or persistence implementation.

## Migration rule

Legacy behavior stays behind `core/LegacyApp.jsx`. New functionality belongs in `modules/` or `core/` infrastructure and must be introduced through the Shell boundary rather than added to the legacy application.
