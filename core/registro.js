// Nivel de registro del día (Semana): qué parte de los campos del día está llena.
// Es lo que mostraba la pilita junto a la fecha; ahora lo muestran las barritas del
// encabezado de cada día (en lugar del estrés, que queda en el anillo del dashboard).
// Función pura, sin datos nuevos (R8): lee los mismos campos de siempre.

// day = dayData[dateKey]; esTrabajo = el día tiene marca "work"; tieneNutri = hay nutriLog ese día.
function nivelRegistro(day, { esTrabajo = false, tieneNutri = false } = {}) {
  const d = day || {};
  const fields = [d.menu, d.aseoMode, d.cookingMode, d.summary, d.energy, d.concentration, d.intensity || d.mood];
  if (esTrabajo) fields.push(d.workLevel);
  fields.push(d.sleep);
  fields.push(tieneNutri ? "ok" : undefined);
  const filled = fields.filter(f => f !== undefined && f !== null && f !== "").length;
  return { filled, total: fields.length, pct: Math.round((filled / fields.length) * 100) };
}

// Mismos tramos de color que la pilita: rojo → verde a medida que se llena.
function colorRegistro(pct) { return pct <= 30 ? "#e53935" : pct <= 60 ? "#ff9800" : pct <= 90 ? "#ffcc00" : "#4caf50"; }

// Cinco barritas, una por cada 20 %.
function barrasRegistro(pct) { return Math.min(5, Math.ceil(pct / 20)); }

export { nivelRegistro, colorRegistro, barrasRegistro };
