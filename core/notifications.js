async function requestNotifPermission() {
  if(!("Notification" in window)) return false;
  if(Notification.permission === "granted") return true;
  if(Notification.permission === "denied") return false;
  const p = await Notification.requestPermission();
  return p === "granted";
}

function getSW() {
  return navigator.serviceWorker?.controller || null;
}

function scheduleNotif(id, title, body, fireAt) {
  const sw = getSW();
  if(!sw || Notification.permission !== "granted") return;
  sw.postMessage({type:"SCHEDULE", notif:{id, title, body, icon:"", fireAt}});
}

function cancelNotif(id) {
  const sw = getSW();
  if(sw) sw.postMessage({type:"CANCEL", id});
}

function cancelNotifPrefix(prefix) {
  const sw = getSW();
  if(sw) sw.postMessage({type:"CANCEL_PREFIX", prefix});
}

// Build notifications for a day's tasks
function scheduleTaskNotifs(dateKey, tasks) {
  // Cancel all existing notifs for this day
  cancelNotifPrefix("task-"+dateKey);
  const dayDate = new Date(dateKey+"T00:00:00");
  tasks.forEach(task => {
    // Fixed tasks with deadline - multiple alarm chips
    if(task.fixed && task.deadline && task.notifMins != null) {
      const minsArr = Array.isArray(task.notifMins) ? task.notifMins : [task.notifMins];
      minsArr.forEach(mins => {
        const fireMs = new Date(
          dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(),
          task.deadline.h, task.deadline.m, 0
        ).getTime() - (mins * 60000);
        if(fireMs > Date.now()) {
          scheduleNotif(
            "task-"+dateKey+"-"+task.id+"-"+mins,
            task.text || "Tarea fija",
            mins===0 ? "Es ahora" : `En ${mins} min`,
            fireMs
          );
        }
      });
    }
    // Urgent tasks with custom notif time
    if(task.urgent && !task.done && task.notifAt) {
      const [h,m] = task.notifAt.split(":").map(Number);
      const fireMs = new Date(
        dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate(), h, m, 0
      ).getTime();
      if(fireMs > Date.now()) {
        scheduleNotif(
          "task-"+dateKey+"-"+task.id+"-urgent",
          "🚨 "+( task.text || "Tarea urgente"),
          "Pendiente hoy",
          fireMs
        );
      }
    }
  });
}

// Build notification for a routine step
function scheduleRoutineStepNotif(routine, stepIdx, startMs) {
  cancelNotifPrefix("routine-"+routine.id);
  const step = routine.steps[stepIdx];
  if(!step) return;
  // Notify at step start time
  if(startMs > Date.now()) {
    scheduleNotif(
      "routine-"+routine.id+"-"+stepIdx,
      (routine.emoji||"⏱️")+" "+routine.name,
      "Paso "+(stepIdx+1)+": "+step.name,
      startMs
    );
  }
}


export { requestNotifPermission, getSW, scheduleNotif, cancelNotif, cancelNotifPrefix, scheduleTaskNotifs, scheduleRoutineStepNotif };
