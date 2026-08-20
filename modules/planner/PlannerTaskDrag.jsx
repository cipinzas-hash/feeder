const React = globalThis.React;

/**
 * Small interaction adapter. It does not own task state; callers provide
 * onReorder so mouse/touch/keyboard interactions converge on the same domain action.
 */
export default function PlannerTaskDrag({ taskId, disabled = false, onReorder, children }) {
  const startY = React.useRef(null);
  const active = React.useRef(false);

  const onPointerDown = (event) => {
    if (disabled) return;
    startY.current = event.clientY;
    active.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerUp = (event) => {
    if (!active.current) return;
    active.current = false;
    const dy = event.clientY - (startY.current ?? event.clientY);
    startY.current = null;
    if (Math.abs(dy) < 20) return;
    onReorder?.(taskId, dy < 0 ? -1 : 1);
  };

  return React.createElement(
    "span",
    {
      role: "button",
      tabIndex: disabled ? -1 : 0,
      "aria-label": "arrastrar tarea",
      style: { cursor: disabled ? "default" : "grab", touchAction: "none" },
      onPointerDown,
      onPointerUp,
      onKeyDown: (event) => {
        if (disabled) return;
        if (event.key === "ArrowUp") { event.preventDefault(); onReorder?.(taskId, -1); }
        if (event.key === "ArrowDown") { event.preventDefault(); onReorder?.(taskId, 1); }
      },
    },
    children,
  );
}
