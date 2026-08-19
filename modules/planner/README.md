# Planner — v0.0

Planner is the canonical home for the weekly planning domain currently embedded in `core/App.jsx`.

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

## Integration

Other modules may consume planner information through explicit callbacks/selectors exposed by the application shell or a Planner service.

Examples already visible in the current implementation include Nutrition consuming a stress score derived from planner state and Espíritu consuming day/calendar information.

## Migration rule

The existing behavior is the source of truth during migration. The first extraction should change structure, not product behavior.

## Version

`0.0` — architectural baseline.
