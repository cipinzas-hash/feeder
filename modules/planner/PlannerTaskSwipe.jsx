const React = globalThis.React;

/**
 * Touch/pointer adapter for postponing a task to the next day.
 * It never mutates Planner state directly; it delegates to onPostpone.
 */
export default function PlannerTaskSwipe({ taskId, disabled = false, onPostpone, children }) {
  const startX = React.useRef(null);
  const startY = React.useRef(null);
  const active = React.useRef(false);

  const onPointerDown = (event) => {
    if (disabled) return;
    startX.current = event.clientX;
    startY.current = event.clientY;
    active.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerUp = (event) => {
    if (!active.current) return;
    active.current = false;
    const dx = event.clientX - (startX.current ?? event.clientX);
    const dy = event.clientY - (startY.current ?? event.clientY);
    startX.current = null;
    startY.current = null;
    if (dx < 60 || Math.abs(dx) <= Math.abs(dy)) return;
    onPostpone?.(taskId);
  };

  return React.createElement(
    "span",
    {
      role: "button",
      tabIndex: disabled ? -1 : 0,
      "aria-label": "postergar tarea al día siguiente",
      style: { touchAction: "pan-y", cursor: disabled ? "default" : "grab" },
      onPointerDown,
      onPointerUp,
    },
    children,
  );
}
