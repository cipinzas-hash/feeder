# Angst App Shell — v0.0

This directory is the target home for the application composition layer.

The current implementation still lives in `core/App.jsx`. During migration, `App.jsx` remains the runtime entry point so behavior is not changed prematurely.

## Responsibilities

The Shell will eventually:

- register available modules;
- decide top-level navigation;
- mount module pages;
- provide explicit cross-module integration contracts;
- coordinate application-wide lifecycle events.

## Non-responsibilities

The Shell should not permanently own a module's domain state, business rules, or persistence implementation.
