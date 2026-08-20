const React = globalThis.React;

export default function PlannerTaskList({ tasks = [], actions = {} }) {
  const toggleTask = (id) => {
    actions.updateTasks?.((current) => current.map((task) => (
      task.id === id ? { ...task, done: !task.done } : task
    )));
  };

  const removeTask = (id) => {
    actions.updateTasks?.((current) => current.filter((task) => task.id !== id));
  };

  const addTask = () => {
    const task = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      text: "",
      done: false,
      fixed: false,
    };
    actions.updateTasks?.((current) => [...current, task]);
  };

  return React.createElement(
    "section",
    { className: "planner-day-card__tasks" },
    React.createElement("h3", null, "Tareas"),
    tasks.map((task) => React.createElement(
      "div",
      { key: task.id, className: task.fixed ? "planner-task planner-task--fixed" : "planner-task" },
      React.createElement(
        "button",
        { type: "button", onClick: () => toggleTask(task.id), "aria-label": task.done ? "marcar pendiente" : "marcar completada" },
        task.done ? "✓" : "○",
      ),
      React.createElement("span", { className: task.done ? "planner-task__done" : "" }, task.text || (task.fixed ? "tarea fija" : "tarea pendiente")),
      React.createElement("button", { type: "button", onClick: () => removeTask(task.id), "aria-label": "eliminar tarea" }, "×"),
    )),
    React.createElement("button", { type: "button", onClick: addTask }, "+ agregar tarea"),
  );
}
