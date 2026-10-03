import { RUTINA, RUTINA_DESDE, diaSugerido, ultimoDiaRutina, fechaCorta, haceTexto } from "./rutina.js";
import { DIBUJOS, FIG_VIEWBOX } from "./figuras.js";
const { useState, useEffect, useRef, useMemo, useCallback } = React;

const MUSCLE_GROUPS = [
  {k:"pecho",       label:"Pecho",          emoji:"💪", side:"front"},
  {k:"espalda",     label:"Espalda",        emoji:"🔗", side:"back"},
  {k:"hombro",      label:"Hombro",         emoji:"🏋️", side:"front"},
  {k:"biceps",      label:"Bíceps",         emoji:"💪", side:"front"},
  {k:"triceps",     label:"Tríceps",        emoji:"🦾", side:"back"},
  {k:"cuadriceps",  label:"Cuádriceps",     emoji:"🦵", side:"front"},
  {k:"gluteo",      label:"Glúteo",         emoji:"🍑", side:"back"},
  {k:"isquio",      label:"Isquiotibiales", emoji:"🦵", side:"back"},
  {k:"abdominales", label:"Abdominales",    emoji:"⬛", side:"front"},
];

const EJERCICIOS_DEFAULT = [
  // ── GYM ──────────────────────────────────────────────────────────────────
  // Pecho
  {id:"press-banca",    name:"Press banca",             emoji:"🏋️", muscles:[{g:"pecho",pct:0.7},{g:"triceps",pct:0.2},{g:"hombro",pct:0.1}],   series:4, repMin:8,  repMax:12, weightStep:2.5, restSecs:90,  plateUnit:"lb", barWeightKg:20, how:"Acostado en el banco de press. Agarre al ancho de hombros, baja controlado hasta el pecho, empuja explosivo."},
  {id:"apertura-cable", name:"Aperturas en cable",      emoji:"🦅", muscles:[{g:"pecho",pct:0.8},{g:"hombro",pct:0.2}],                          series:3, repMin:10, repMax:15, weightStep:2.5, restSecs:60,  how:"Torre de cable dual a la altura del pecho. Brazos semi-extendidos, junta las manos al frente en arco."},
  {id:"press-cerrado",  name:"Press cerrado",            emoji:"🤏", muscles:[{g:"pecho",pct:0.3},{g:"triceps",pct:0.6},{g:"hombro",pct:0.1}],   series:3, repMin:8,  repMax:12, weightStep:2.5, restSecs:75,  plateUnit:"lb", barWeightKg:20, how:"Banco de press, agarre angosto (manos casi juntas). Codos pegados al cuerpo al bajar."},
  // Press banca del Día B (issue #22): id propio para que su progresión no se mezcle con la del Día A
  {id:"press-banca-b",  name:"Press banca (Día B)",     emoji:"🏋️", muscles:[{g:"pecho",pct:0.7},{g:"triceps",pct:0.2},{g:"hombro",pct:0.1}],   series:3, repMin:8,  repMax:10, weightStep:2.27, restSecs:120, plateUnit:"lb", barWeightKg:20, how:"Igual que el press banca del Día A, con pausa de 1 s con la barra tocando el pecho."},
  // Espalda
  {id:"dominadas",      name:"Dominadas asistidas",      emoji:"🧗", muscles:[{g:"espalda",pct:0.7},{g:"biceps",pct:0.3}],                       series:3, repMin:6,  repMax:10, weightStep:-2.5,restSecs:90,  variantes:["Neutro","Supino","Prono"], how:"Máquina de asistencia — menos peso de asistencia = más difícil. Jala el pecho hacia la barra, controla la bajada. La máquina tiene 3 posiciones de agarre (elegir arriba) -- no ejercitan exactamente igual, neutro suele sentirse más cómodo, supino carga algo más bíceps, prono suele ser el más duro de dorsal."},
  {id:"jalon-pecho",    name:"Jalón al pecho",           emoji:"⬇️", muscles:[{g:"espalda",pct:0.75},{g:"biceps",pct:0.25}],                     series:3, repMin:10, repMax:15, weightStep:2.5, restSecs:75,  how:"Torre de cable dual con barra alta. Jala hacia el pecho apretando omóplatos, sube controlado."},
  {id:"remo-polea",     name:"Remo en polea",            emoji:"🚣", muscles:[{g:"espalda",pct:0.6},{g:"biceps",pct:0.2},{g:"hombro",pct:0.2}],  series:3, repMin:10, repMax:15, weightStep:2.5, restSecs:75,  how:"Torre de cable dual a la altura media. Jala hacia el abdomen, codos pegados."},
  {id:"remo-manc",      name:"Remo a un brazo",          emoji:"🏋️", muscles:[{g:"espalda",pct:0.65},{g:"biceps",pct:0.25},{g:"abdominales",pct:0.1}], series:3, repMin:8, repMax:12, weightStep:2.5, restSecs:75, how:"Apoyo en banco con una mano y rodilla. Mancuerna o kettlebell, jala hacia la cadera."},
  // Hombro
  {id:"press-militar",  name:"Press militar",            emoji:"🪖", muscles:[{g:"hombro",pct:0.7},{g:"triceps",pct:0.3}],                       series:3, repMin:8,  repMax:12, weightStep:2.5, restSecs:75,  how:"De pie o sentado, mancuernas a la altura de hombros. Empuja arriba sin arquear la espalda."},
  {id:"elev-lateral",   name:"Elevación lateral",        emoji:"🦅", muscles:[{g:"hombro",pct:1}],                                               series:3, repMin:12, repMax:18, weightStep:1,   restSecs:45,  how:"Mancuernas a los costados. Sube hasta la altura de hombros, baja controlado."},
  {id:"elev-frontal",   name:"Elevación frontal",        emoji:"☝️", muscles:[{g:"hombro",pct:0.9},{g:"pecho",pct:0.1}],                        series:3, repMin:12, repMax:18, weightStep:1,   restSecs:45,  how:"Torre de cable dual, polea baja. Sube el brazo al frente hasta la altura de hombro."},
  {id:"face-pull",      name:"Face pull",                emoji:"😤", muscles:[{g:"hombro",pct:0.5},{g:"espalda",pct:0.5}],                       series:3, repMin:12, repMax:18, weightStep:1,   restSecs:45,  how:"Torre de cable dual con cuerda, a la altura de la cara. Jala hacia atrás separando las manos."},
  // Bíceps
  {id:"curl-manc",      name:"Curl con mancuerna",       emoji:"💪", muscles:[{g:"biceps",pct:1}],                                               series:3, repMin:10, repMax:15, weightStep:1,   restSecs:45,  how:"De pie, codos fijos pegados al cuerpo. Sube doblando el brazo, aprieta arriba, baja lento."},
  {id:"curl-polea",     name:"Curl en polea",            emoji:"💪", muscles:[{g:"biceps",pct:0.9},{g:"espalda",pct:0.1}],                       series:3, repMin:10, repMax:15, weightStep:1,   restSecs:45,  how:"Torre de cable dual, polea baja con barra recta. Mismo patrón que el curl con mancuerna."},
  {id:"curl-martillo",  name:"Curl martillo",            emoji:"🔨", muscles:[{g:"biceps",pct:1}],                                               series:3, repMin:10, repMax:15, weightStep:1,   restSecs:45,  how:"Mancuernas con agarre neutro (palmas enfrentadas). Mismo movimiento que el curl normal."},
  // Tríceps
  {id:"press-frances",  name:"Press francés",            emoji:"🇫🇷", muscles:[{g:"triceps",pct:0.9},{g:"hombro",pct:0.1}],                     series:3, repMin:10, repMax:15, weightStep:1,   restSecs:60,  how:"Acostado o sentado, mancuerna sobre la cabeza. Baja doblando solo el codo, sube extendiendo."},
  {id:"ext-triceps",    name:"Extensión en polea",       emoji:"🦾", muscles:[{g:"triceps",pct:0.9},{g:"hombro",pct:0.1}],                       series:3, repMin:10, repMax:15, weightStep:1,   restSecs:60,  how:"Torre de cable dual, polea alta con cuerda. Codos pegados al torso, extiende hacia abajo."},
  {id:"dip-asistido",   name:"Dip asistido",             emoji:"🪑", muscles:[{g:"triceps",pct:0.7},{g:"pecho",pct:0.2},{g:"hombro",pct:0.1}],  series:3, repMin:8,  repMax:12, weightStep:-2.5,restSecs:90,  how:"Misma máquina de asistencia que dominadas — menos peso de asistencia = más difícil. Baja hasta 90° en los codos, empuja arriba controlado."},
  // Piernas
  {id:"sentadilla",     name:"Sentadilla con barra",     emoji:"🏋️", muscles:[{g:"cuadriceps",pct:0.5},{g:"gluteo",pct:0.35},{g:"isquio",pct:0.15}], series:4, repMin:8, repMax:12, weightStep:5, restSecs:120, plateUnit:"lb", barWeightKg:20, how:"Módulo de sentadilla, barra en hombros. Pies al ancho de hombros, baja controlado, empuja desde los talones."},
  {id:"prensa",         name:"Prensa de piernas",        emoji:"🦵", muscles:[{g:"cuadriceps",pct:0.55},{g:"gluteo",pct:0.3},{g:"isquio",pct:0.15}],  series:3, repMin:10, repMax:15, weightStep:5, restSecs:90, plateUnit:"lb", barWeightKg:0, how:"Máquina de prensa — acostado, empujás la plataforma con las piernas hacia arriba. Peso base del carro desconocido, se cuenta solo lo agregado (ver nota en discos)."},
  {id:"ext-cuadriceps", name:"Extensión de cuádriceps",  emoji:"🦵", muscles:[{g:"cuadriceps",pct:0.95},{g:"gluteo",pct:0.05}],                  series:3, repMin:10, repMax:15, weightStep:2.5, restSecs:60,  how:"Máquina sentado, extiende las piernas contra la resistencia hasta casi estirar del todo."},
  {id:"peso-muerto",    name:"Peso muerto con KB",       emoji:"🏋️", muscles:[{g:"isquio",pct:0.5},{g:"gluteo",pct:0.3},{g:"espalda",pct:0.2}], series:3, repMin:8,  repMax:12, weightStep:2.5, restSecs:90,  how:"Kettlebell o mancuernas frente a los muslos. Inclina el torso bajando por las piernas, espalda recta."},
  {id:"peso-muerto-rumano", name:"Peso muerto rumano",  emoji:"🏋️", muscles:[{g:"isquio",pct:0.5},{g:"gluteo",pct:0.35},{g:"espalda",pct:0.15}], series:3, repMin:8, repMax:10, weightStep:2.27, restSecs:120, plateUnit:"lb", barWeightKg:20, how:"Barra pegada a los muslos. Caderas hacia atrás con espalda neutra, baja bajo la rodilla, sube empujando la cadera."},
  {id:"hip-thrust-kb",  name:"Hip thrust con kettlebells", emoji:"🌉", muscles:[{g:"gluteo",pct:0.75},{g:"isquio",pct:0.25}],                   series:3, repMin:10, repMax:15, weightStep:2.27, restSecs:75, how:"Espalda alta apoyada en el banco, una kettlebell a cada lado de la cadera. Sube hasta torso recto y aprieta el glúteo."},
  {id:"zancadas",       name:"Zancadas",                 emoji:"🚶", muscles:[{g:"cuadriceps",pct:0.45},{g:"gluteo",pct:0.4},{g:"isquio",pct:0.15}], series:3, repMin:10, repMax:14, weightStep:2.5, restSecs:75, how:"Kettlebells a los costados. Paso largo adelante, baja la rodilla trasera casi al suelo."},
  {id:"sent-goblet",    name:"Sentadilla goblet",        emoji:"🍷", muscles:[{g:"cuadriceps",pct:0.5},{g:"gluteo",pct:0.3},{g:"abdominales",pct:0.2}], series:3, repMin:10, repMax:15, weightStep:2.5, restSecs:75, how:"Kettlebell sostenida frente al pecho con ambas manos. Baja entre las piernas controlado."},
  // Abdominales
  {id:"crunch-banco",       name:"Crunch en banquillo",    emoji:"🔻", muscles:[{g:"abdominales",pct:0.9},{g:"cuadriceps",pct:0.1}], series:3, repMin:15, repMax:25, weightStep:0, restSecs:45, how:"Banquillo reclinable de abdominales. Sube el torso contrayendo el abdomen, baja controlado."},
  {id:"elev-piernas-banco", name:"Elevación de piernas",   emoji:"🦵", muscles:[{g:"abdominales",pct:0.7},{g:"cuadriceps",pct:0.3}], series:3, repMin:12, repMax:20, weightStep:0, restSecs:45, how:"En el banquillo, piernas estiradas. Sube hasta 90°, baja sin tocar el suelo entre reps."},
  {id:"crunch-cable",       name:"Crunch de rodillas",     emoji:"🙇", muscles:[{g:"abdominales",pct:0.9},{g:"espalda",pct:0.1}],    series:3, repMin:12, repMax:20, weightStep:1, restSecs:45, how:"Torre de cable dual, polea alta con cuerda. De rodillas, dobla el torso hacia abajo contrayendo el abdomen."},
  {id:"russian-twist",      name:"Russian twist",          emoji:"🌀", muscles:[{g:"abdominales",pct:1}],                             series:3, repMin:16, repMax:24, weightStep:1, restSecs:45, how:"Sentado, kettlebell con ambas manos. Gira el torso de lado a lado tocando el suelo."},

  // ── CALISTENIA — sin equipamiento ────────────────────────────────────────
  // weightStep:0 = sin peso → doble progresión por nextVariant en vez de kg
  {id:"cal-pushup",     name:"Push-up",                  emoji:"💪", muscles:[{g:"pecho",pct:0.6},{g:"triceps",pct:0.3},{g:"hombro",pct:0.1}], series:3, repMin:8,  repMax:15, weightStep:0, restSecs:60, nextVariant:"Archer push-up", how:"Manos al ancho de hombros, codos a ~45°. Baja hasta casi tocar el suelo. Cuerpo en línea recta. Sube explosivo."},
  {id:"cal-pushup-dec", name:"Push-up declinado",        emoji:"📐", muscles:[{g:"pecho",pct:0.65},{g:"hombro",pct:0.25},{g:"triceps",pct:0.1}], series:3, repMin:8, repMax:15, weightStep:0, restSecs:60, nextVariant:"Push-up pike", how:"Pies elevados en silla o cama. Manos al ancho de hombros, codos a 45°. Baja el pecho controlando."},
  {id:"cal-pike",       name:"Pike push-up",             emoji:"🔺", muscles:[{g:"hombro",pct:0.8},{g:"triceps",pct:0.2}],                       series:3, repMin:8,  repMax:15, weightStep:0, restSecs:60, nextVariant:"Handstand push-up (pared)", how:"Caderas elevadas formando V invertida. Baja la cabeza doblando codos. Más vertical = más hombro."},
  {id:"cal-dip",        name:"Dip entre sillas",         emoji:"🪑", muscles:[{g:"triceps",pct:0.7},{g:"pecho",pct:0.2},{g:"hombro",pct:0.1}],  series:3, repMin:8,  repMax:15, weightStep:0, restSecs:60, nextVariant:"Dip con pausa 3s abajo", how:"Manos en dos sillas estables, codos hacia atrás. Baja hasta 90°, empuja volviendo. Cuerpo vertical."},
  {id:"cal-bulgara",    name:"Búlgara peso corporal",    emoji:"🦵", muscles:[{g:"cuadriceps",pct:0.5},{g:"gluteo",pct:0.4},{g:"isquio",pct:0.1}], series:3, repMin:8, repMax:15, weightStep:0, restSecs:75, nextVariant:"Búlgara con pausa 2s abajo", how:"Pie trasero elevado en silla. Baja con la pierna delantera controlando la rodilla. Sin rebote."},
  {id:"cal-hipthrust",  name:"Hip thrust corporal",      emoji:"🌉", muscles:[{g:"gluteo",pct:0.7},{g:"isquio",pct:0.3}],                        series:3, repMin:15, repMax:25, weightStep:0, restSecs:45, nextVariant:"Hip thrust unilateral", how:"Hombros en silla o cama, rodillas dobladas. Empuja las caderas arriba apretando glúteos 1 seg. Baja controlado."},
  {id:"cal-zancada",    name:"Zancada sin peso",         emoji:"🚶", muscles:[{g:"cuadriceps",pct:0.45},{g:"gluteo",pct:0.4},{g:"isquio",pct:0.15}], series:3, repMin:10, repMax:20, weightStep:0, restSecs:60, nextVariant:"Zancada con salto", how:"Paso largo adelante, baja la rodilla trasera casi al suelo. Empuja desde el talón delantero para volver."},
  {id:"cal-pistol",     name:"Sentadilla pistol (asist)",emoji:"🔫", muscles:[{g:"cuadriceps",pct:0.6},{g:"gluteo",pct:0.3},{g:"isquio",pct:0.1}], series:3, repMin:5, repMax:10, weightStep:0, restSecs:75, nextVariant:"Pistol squat sin asistencia", how:"Apoyá una mano en la pared. Una pierna extendida al frente, baja lento con la otra. Sube controlado."},
  {id:"cal-superman",   name:"Superman",                 emoji:"🦸", muscles:[{g:"espalda",pct:0.7},{g:"gluteo",pct:0.2},{g:"isquio",pct:0.1}],  series:3, repMin:12, repMax:20, weightStep:0, restSecs:45, nextVariant:"Superman con pausa 3s", how:"Boca abajo, brazos extendidos. Levanta simultáneamente brazos y piernas. Aguanta 1 seg arriba. Baja controlado."},
  {id:"cal-remo-mesa",  name:"Remo bajo mesa",           emoji:"🍽️", muscles:[{g:"espalda",pct:0.7},{g:"biceps",pct:0.3}],                       series:3, repMin:8,  repMax:15, weightStep:0, restSecs:60, nextVariant:"Remo con pies elevados", how:"Tumbado bajo mesa sólida. Agarra el borde con manos al ancho de hombros. Jala el pecho hacia la mesa apretando omóplatos."},
  {id:"cal-curl-toalla",name:"Curl bíceps con toalla",   emoji:"🏳️", muscles:[{g:"biceps",pct:1}],                                               series:3, repMin:10, repMax:15, weightStep:0, restSecs:45, nextVariant:"Curl con mochila cargada", how:"Engancha una toalla en una puerta. Parado frente a ella, codos fijos al cuerpo. Dobla el brazo jalando la toalla."},
  {id:"cal-plancha",    name:"Plancha",                  emoji:"⬛", muscles:[{g:"abdominales",pct:0.7},{g:"espalda",pct:0.2},{g:"hombro",pct:0.1}], series:3, repMin:20, repMax:60, weightStep:0, restSecs:45, nextVariant:"Plancha lateral", how:"Boca abajo en codos y puntas de pie. Cuerpo recto, abdomen apretado. Cada 20-60 seg = 1 serie. Tiempo en segundos."},
  {id:"cal-elev-piernas",name:"Elevación piernas suelo", emoji:"🦵", muscles:[{g:"abdominales",pct:0.8},{g:"cuadriceps",pct:0.2}],               series:3, repMin:10, repMax:20, weightStep:0, restSecs:45, nextVariant:"Elevación piernas en barra", how:"Boca arriba, manos bajo glúteos. Piernas juntas sube hasta 90°. Baja lento sin tocar el suelo entre reps."},
  {id:"cal-cruncho",    name:"Crunch suelo",             emoji:"🔻", muscles:[{g:"abdominales",pct:1}],                                           series:3, repMin:15, repMax:30, weightStep:0, restSecs:45, nextVariant:"Crunch bicicleta", how:"Boca arriba, rodillas dobladas, manos detrás de la nuca sin jalar. Sube el torso contrayendo el abdomen, baja controlado."},
];

// ── Retrocompatibilidad: serie puede ser true (legacy) o {done,reps,peso} ──
function getSerieValue(v) {
  if(!v) return null;
  if(v === true) return {done:true, reps:null, peso:null};
  return v;
}
function isSerieDone(v) {
  if(!v) return false;
  if(v === true) return true;
  return !!v.done;
}

// Factor de esfuerzo de una serie para el heatmap semanal.
//
// Antes era reps×peso (tonelaje) -- se cambió porque favorecía
// desproporcionadamente a los ejercicios de carga externa pesada: una serie
// al fallo en sentadilla (8×60kg=480) pesaba 5 veces más que una serie
// igual de al fallo en curl en polea (12×8kg=96) pese a ser, en términos de
// estímulo, ambas "una serie dura". Contar 1 por serie marcada (sin
// ponderar por peso) se acerca mucho más al marco de "series efectivas por
// semana" que usa la literatura de hipertrofia/fuerza (~10-20/semana/grupo)
// -- ver WEEKLY_MUSCLE_TARGET.
//
// SUPUESTO IMPORTANTE: esto asume que cada serie marcada se hizo cerca del
// fallo (así entrena Cristopher). Si en algún momento se registran series
// muy lejos del fallo (calentamiento, técnica, etc.) van a contar igual que
// una serie dura y van a inflar el número artificialmente -- no hay forma
// de distinguirlas con los datos que se guardan hoy (solo reps/peso/done).
function serieFactor(sv) {
  return sv?.done ? 1 : 0;
}

// Métrica de progreso de una serie, no el peso real registrado (ese se
// sigue mostrando tal cual en toda la UI). En carga directa más peso =
// más difícil = progreso; en carga de asistencia (weightStep<0, dominadas/
// dip asistido) es al revés -- menos peso de asistencia = más carga
// efectiva = progreso. Se invierte el signo del peso acá, en un solo
// lugar, para que "mejor sesión"/"PR"/deltaPct/el gráfico comparen todos
// en la misma dirección sin tener que duplicar la condición en cada sitio
// que hoy compara volumen (issue #11).
function volEfectivo(reps, peso, ex) {
  if (!peso) return reps || 0;
  const p = (ex && ex.weightStep < 0) ? -peso : peso;
  return (reps || 0) * p;
}

// 15 series efectivas/semana/grupo = punto medio del rango ~10-20 que cita
// la literatura de hipertrofia para gente ya entrenada (ej. revisiones de
// Schoenfeld et al.) -- se usa como el "100%" (naranjo) del heatmap.
// Rojo (150%+, ver colorForPct) marca por encima de ese rango, no
// necesariamente mejor -- ahí empiezan los retornos decrecientes según la
// misma literatura, así que rojo profundo es más "estás en el límite alto"
// que "esto es lo óptimo".
const WEEKLY_MUSCLE_TARGET = 15;

// Umbrales elegidos para que el color diga lo que Cristopher quiere leer:
// amarillo = apenas empecé, naranjo = medio camino, rojo = cumplí el
// objetivo de la semana. Antes el rojo recién aparecía SUPERANDO el 100%
// del objetivo (y encima había un bug -- `Math.min(1,pct)` capaba p a 1
// antes de llegar a esa rama, así que el rojo profundo nunca se veía en la
// práctica). Ahora: <35% amarillo, 35-70% naranjo, llegar al 100% del
// objetivo (15 series) = rojo pleno. Superar el 100% se sigue viendo (no
// se clampea), pero no hay un color "más allá del rojo" -- según la misma
// literatura de WEEKLY_MUSCLE_TARGET, pasar el rango no es "mejor", así que
// no tiene sentido premiarlo visualmente con más intensidad todavía.
function colorForPct(pct) {
  const p = Math.max(0, pct);
  if(p <= 0) return "#2a2a2a";
  if(p < 0.35) {
    const t = p / 0.35;
    return `rgb(${Math.round(42+(230-42)*t)},${Math.round(42+(200-42)*t)},${Math.round(42+(40-42)*t)})`;
  }
  if(p < 0.7) {
    const t = (p-0.35)/0.35;
    return `rgb(230,${Math.round(200-(200-140)*t)},40)`;
  }
  const t = Math.min(1, (p-0.7)/0.3); // satura en rojo pleno al llegar al 100% del objetivo
  return `rgb(230,${Math.round(140-(140-30)*t)},${Math.round(40-(40-30)*t)})`;
}

function weekDatesFor(dateKey) {
  const d = new Date(dateKey+"T12:00:00");
  const dow = (d.getDay()+6)%7;
  const monday = new Date(d); monday.setDate(d.getDate()-dow);
  return Array.from({length:7},(_,i)=>{
    const x = new Date(monday); x.setDate(monday.getDate()+i);
    return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0");
  });
}

function computeWeeklyMuscleEffort(ejercicioLog, allExercicios, todayKey) {
  return computeWeekMuscleEffortFor(ejercicioLog, allExercicios, weekDatesFor(todayKey));
}

// Generaliza computeWeeklyMuscleEffort a CUALQUIER semana (no solo la
// actual) -- recibe directo las 7 fechas en vez de derivarlas de todayKey,
// así se puede reusar para la vista de historial semanal sin duplicar la
// lógica de sumar factor×pct por grupo muscular.
function computeWeekMuscleEffortFor(ejercicioLog, allExercicios, weekDates) {
  const totals = {};
  MUSCLE_GROUPS.forEach(g=>totals[g.k]=0);
  weekDates.forEach(dk=>{
    const dayLog = ejercicioLog[dk];
    if(!dayLog) return;
    Object.keys(dayLog).forEach(key=>{
      const sv = getSerieValue(dayLog[key]);
      if(!sv?.done) return;
      const exId = key.split("_").slice(0,-1).join("_") || key.split("_")[0];
      const ex = allExercicios.find(e=>e.id===exId);
      if(!ex) return;
      const f = serieFactor(sv);
      (ex.muscles||[]).forEach(m=>{ totals[m.g] = (totals[m.g]||0) + f*m.pct; });
    });
  });
  return totals;
}

// Ejercicios + series (reps/peso/fecha) realizados en una semana puntual,
// combinando las sesiones de todos los días de esa semana -- para el
// archivo semanal (vista "semanas"). Devuelve solo lo que efectivamente se
// hizo (series marcadas done), agrupado por ejercicio.
function computeWeekExerciseSummary(ejercicioLog, allExercicios, weekDates) {
  const porEjercicio = new Map(); // exId -> { ex, series: [{reps,peso,date}] }
  weekDates.forEach(dk=>{
    const dayLog = ejercicioLog[dk];
    if(!dayLog) return;
    Object.keys(dayLog).forEach(key=>{
      const sv = getSerieValue(dayLog[key]);
      if(!sv?.done) return;
      const exId = key.split("_").slice(0,-1).join("_") || key.split("_")[0];
      const ex = allExercicios.find(e=>e.id===exId);
      if(!ex) return;
      if(!porEjercicio.has(exId)) porEjercicio.set(exId, { ex, series: [] });
      porEjercicio.get(exId).series.push({ reps: sv.reps||0, peso: sv.peso||null, date: dk });
    });
  });
  return Array.from(porEjercicio.values());
}

// Lunes de todas las semanas que tienen al menos una serie hecha en
// ejercicioLog, más recientes primero -- para poblar el selector de la
// vista "semanas". No hace falta guardar nada aparte: ejercicioLog ya
// conserva el historial completo (no se poda), así que esto se recalcula
// al vuelo cada vez.
function weeksWithData(ejercicioLog) {
  const mondays = new Set();
  Object.keys(ejercicioLog).forEach(dk=>{
    const hasSomething = Object.values(ejercicioLog[dk]||{}).some(v=>isSerieDone(v));
    if(!hasSomething) return;
    mondays.add(weekDatesFor(dk)[0]);
  });
  return Array.from(mondays).sort((a,b)=>b.localeCompare(a));
}

function BodyHeatmap({ totals, onTap, compact }) {
  const FRONT_SHAPES = {
    hombro:      [{x:8,y:18,w:14,h:10},{x:58,y:18,w:14,h:10}],
    pecho:       [{x:24,y:18,w:32,h:16}],
    biceps:      [{x:6,y:30,w:10,h:18},{x:64,y:30,w:10,h:18}],
    abdominales: [{x:26,y:36,w:28,h:22}],
    cuadriceps:  [{x:22,y:60,w:14,h:30},{x:44,y:60,w:14,h:30}],
  };
  const BACK_SHAPES = {
    espalda:     [{x:22,y:18,w:36,h:26}],
    triceps:     [{x:6,y:30,w:10,h:18},{x:64,y:30,w:10,h:18}],
    gluteo:      [{x:22,y:46,w:36,h:12}],
    isquio:      [{x:22,y:60,w:14,h:30},{x:44,y:60,w:14,h:30}],
  };
  function pctOf(k){ return (totals[k]||0)/WEEKLY_MUSCLE_TARGET; }
  function Body({shapes, title}) {
    return (
      <div onClick={onTap} style={{cursor:onTap?"pointer":"default",textAlign:"center"}}>
        <svg width={compact?56:80} height={compact?70:100} viewBox="0 0 80 100">
          <ellipse cx="40" cy="8" rx="9" ry="9" fill="#2a2a2a"/>
          <rect x="22" y="16" width="36" height="2" fill="#2a2a2a"/>
          {Object.entries(shapes).map(([k,rects])=>{
            const c = colorForPct(pctOf(k));
            return rects.map((r,i)=>(
              <rect key={k+i} x={r.x} y={r.y} width={r.w} height={r.h} rx="3" fill={c} stroke="rgba(255,255,255,0.08)"/>
            ));
          })}
        </svg>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:1,textTransform:"uppercase",marginTop:2}}>{title}</div>
      </div>
    );
  }
  return (
    <div style={{background:"#111",borderRadius:compact?10:14,padding:compact?"8px 10px":"14px 16px",marginBottom:compact?0:16,display:"flex",alignItems:"center",justifyContent:"center",gap:compact?14:28,flexShrink:0}}>
      <Body shapes={FRONT_SHAPES} title="frente"/>
      <Body shapes={BACK_SHAPES} title="espalda"/>
    </div>
  );
}

function ProgresionChart({ history, compact, ex }) {
  if(!history || history.length < 2) return null;
  const W = compact ? 200 : 290, H = compact ? 48 : 72, pad = 8;
  const hasPeso = history.some(h => h.peso);
  const vals = history.map(h => volEfectivo(h.reps, h.peso, ex));
  const minV = Math.min(...vals) * 0.88, maxV = Math.max(...vals) * 1.12;
  const range = maxV - minV || 1;
  const px = i => pad + (i / (history.length - 1)) * (W - pad * 2);
  const py = v => H - pad - ((v - minV) / range) * (H - pad * 2);
  const path = history.map((h, i) => `${i === 0 ? "M" : "L"}${px(i).toFixed(1)},${py(vals[i]).toFixed(1)}`).join(" ");
  const last = vals[vals.length - 1], first = vals[0];
  const up = last >= first;
  const color = up ? "#2e7d52" : "#e53935";
  const deltaPct = first !== 0 ? ((last - first) / Math.abs(first) * 100).toFixed(0) : null;
  const lastEntry = history[history.length - 1];
  const label = hasPeso ? `${lastEntry.reps}r×${lastEntry.peso}kg` : `${lastEntry.reps}r`;
  return (
    <div>
      <svg width={W} height={H} style={{display:"block",overflow:"visible"}}>
        <path d={path} fill="none" stroke={color} strokeWidth={compact ? 1.5 : 2} strokeLinejoin="round" strokeLinecap="round"/>
        {history.map((h, i) => <circle key={i} cx={px(i)} cy={py(vals[i])} r={compact ? 2 : 3} fill={color}/>)}
        <text x={W - pad} y={py(last) - 5} textAnchor="end" fontSize={compact ? 8 : 10} fontFamily="DM Sans,sans-serif" fill={color} fontWeight="700">{label}</text>
      </svg>
      {!compact && deltaPct && (
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color,marginTop:2}}>
          {up ? "+" : ""}{deltaPct}% volumen · {history.length} sesiones
        </div>
      )}
    </div>
  );
}

function FloatingRestTimer({ secs, maxSecs, onSkip, onAddTime }) {
  return (
    <div onClick={onSkip} style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(0,0,0,0.92)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.4)",letterSpacing:3,textTransform:"uppercase",marginBottom:18}}>descansando</div>
      <div style={{position:"relative",width:220,height:220,marginBottom:14}}>
        <svg width="220" height="220" style={{position:"absolute",top:0,left:0,transform:"rotate(-90deg)"}}>
          <circle cx="110" cy="110" r="96" fill="none" stroke="#1a1a1a" strokeWidth="10"/>
          <circle cx="110" cy="110" r="96" fill="none" stroke={secs<=10?"#e53935":"#fff"} strokeWidth="10"
            strokeDasharray={2*Math.PI*96} strokeDashoffset={2*Math.PI*96*(1-secs/Math.max(maxSecs,1))}
            strokeLinecap="round" style={{transition:"stroke-dashoffset 0.9s linear,stroke 0.3s"}}/>
        </svg>
        <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
          <span style={{fontFamily:"'Caveat',cursive",fontSize:64,fontWeight:700,color:"#fff"}}>{secs}</span>
        </div>
      </div>
      <div style={{fontFamily:"'Caveat',cursive",fontSize:16,color:"rgba(255,255,255,0.4)",marginBottom:22}}>concentrate en la próxima serie</div>
      {/* Sin esto quedabas atrapado en pantalla completa los 90-120s
          enteros aunque ya estuvieras listo antes -- tocar afuera de los
          botones también saltea (onClick en el overlay), +15s para cuando
          hace falta más. stopPropagation en los botones para que no
          disparen el skip del overlay por accidente. */}
      <div style={{display:"flex",gap:10}}>
        <button onClick={e=>{e.stopPropagation();onAddTime(15);}} style={{padding:"10px 18px",borderRadius:20,border:"1px solid rgba(255,255,255,0.25)",background:"transparent",color:"rgba(255,255,255,0.7)",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,cursor:"pointer"}}>+15s</button>
        <button onClick={e=>{e.stopPropagation();onSkip();}} style={{padding:"10px 22px",borderRadius:20,border:"none",background:"#fff",color:"#111",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:700,cursor:"pointer"}}>saltar →</button>
      </div>
    </div>
  );
}

// KG ↔ LB
const KG_TO_LB = 2.2046;
function toDisplay(kg, unit){ return unit==="lb" ? parseFloat((kg*KG_TO_LB).toFixed(1)) : kg; }
function toKg(val, unit){ return unit==="lb" ? parseFloat((val/KG_TO_LB).toFixed(2)) : val; }

// ── Rutina A/B (issue #22): formato de cargas ──────────────────────────────
// Ejercicios con discos (plateUnit "lb"): se muestra lo que se carga físicamente
// (lb de discos), igual que en el registro. Máquina de asistencia (weightStep<0):
// se aclara que el número es asistencia, no carga.
function fmtCarga(kg, ex, unit) {
  if(kg==null) return "peso corporal";
  if(ex.plateUnit==="lb") {
    const base = ex.barWeightKg||0;
    const d = Math.round(toDisplay(Math.max(0,kg-base),"lb"));
    return base>0 ? `${d} lb de discos (${kg.toFixed(1)} kg total)` : `${d} lb de discos`;
  }
  const num = `${toDisplay(kg,unit)} ${unit}` + (unit==="kg" ? ` (${Math.round(toDisplay(kg,"lb"))} lb)` : ` (${kg.toFixed(1)} kg)`);
  return ex.weightStep<0 ? `asistencia ${num}` : num;
}
// Peso de una serie ya hecha, en la unidad natural del ejercicio.
function fmtPesoSerie(kg, ex, unit) {
  if(kg==null) return "";
  if(ex.plateUnit==="lb") return `${Math.round(toDisplay(Math.max(0,kg-(ex.barWeightKg||0)),"lb"))} lb discos`;
  return `${toDisplay(kg,unit)}${unit}`;
}
// Calentamiento: solo guía en pantalla, NO se registra como serie (el heatmap
// cuenta cada serie marcada como serie efectiva).
function calentamientoTexto(calent, kgBase, ex, unit) {
  if(kgBase==null) return null;
  const base = ex.barWeightKg||0;
  return (calent.pasos||[]).map(([a,reps]) => {
    if(calent.tipo==="asist") return `${reps} × asistencia ${toDisplay(kgBase+a,unit)} ${unit}`;
    const kgW = kgBase*a;
    if(ex.plateUnit==="lb") {
      const lb = Math.max(0, Math.round(toDisplay(Math.max(0,kgW-base),"lb")/5)*5);
      return lb===0 ? `${reps} × ${base>0?`barra sola (${base} kg)`:"sin discos"}` : `${reps} × ${lb} lb de discos`;
    }
    return `${reps} × ${toDisplay(Math.round(kgW*2)/2,unit)} ${unit}`;
  }).join(" · ");
}

function EjercicioPage({ ejercicioLog, saveEjercicioLog, customEjercicios, saveCustomEjercicios }) {
  const todayKey = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  })();

  const [view,         setView]         = useState("session");
  const [openEx,       setOpenEx]       = useState(null);
  const [varianteElegida, setVarianteElegida] = useState({}); // exId -> variante elegida hoy (se resetea al recargar, no persiste entre días -- se guarda por serie al marcarla, ver markSerie)
  const [timerSecs,    setTimerSecs]    = useState(0);
  const [timerMax,     setTimerMax]     = useState(90);
  const [timerActive,  setTimerActive]  = useState(false);
  const [editEx,       setEditEx]       = useState(null);
  const [histExId,     setHistExId]     = useState(null);
  const [histWeek,      setHistWeek]     = useState(null); // lunes de la semana elegida en la vista "semanas"
  const [repsInput,    setRepsInput]    = useState({});
  const [pesoUnit,     setPesoUnit]     = useState("kg"); // "kg" | "lb" — UI only, storage always kg
  const [diaManual,    setDiaSel]       = useState(null); // "A" | "B" elegido a mano; null = sigue la sugerencia (issue #22)
  const [guiaAbierta,  setGuiaAbierta]  = useState({}); // exId -> bool; si no está, se abre sola hasta marcar la primera serie del día
  const timerRef = useRef(null);

  // allExercicios: los overrides de customEjercicios tienen que GANAR sobre
  // el default con el mismo id (edición o archivado de un ejercicio
  // default), no solo agregarse aparte -- antes [...DEFAULT,...custom] sin
  // deduplicar hacía que cualquier .find()/.filter() por id se quedara con
  // el default original sin editar (find() devuelve el primer match), y en
  // el editor aparecían dos filas duplicadas para el mismo ejercicio.
  const customOverrides = customEjercicios || {};
  const allExercicios = [
    ...EJERCICIOS_DEFAULT.map(e => customOverrides[e.id] || e),
    ...Object.values(customOverrides).filter(e => !EJERCICIOS_DEFAULT.some(d=>d.id===e.id)),
  ];
  const todaySeries    = ejercicioLog[todayKey] || {};


  useEffect(() => () => clearInterval(timerRef.current), []);

  function markSerie(exId, si, reps, pesoKg, restSecs, variante) {
    const key = `${exId}_${si}`;
    if(isSerieDone(todaySeries[key])) return;
    const entry = {done:true, reps: reps||null, peso: pesoKg||null, ...(variante?{variante}:{})};
    saveEjercicioLog({...ejercicioLog, [todayKey]: {...todaySeries, [key]: entry}});
    const t = restSecs || 90;
    setTimerMax(t);
    startTimer(t);
  }

  function startTimer(secs) {
    clearInterval(timerRef.current);
    setTimerSecs(secs);
    setTimerActive(true);
    timerRef.current = setInterval(() => {
      setTimerSecs(s => {
        if(s <= 1){ clearInterval(timerRef.current); setTimerActive(false); return 0; }
        return s - 1;
      });
    }, 1000);
  }

  function skipTimer() {
    clearInterval(timerRef.current);
    setTimerActive(false);
    setTimerSecs(0);
  }

  function addTimerSecs(extra) {
    setTimerSecs(s => s + extra);
    setTimerMax(m => m + extra); // si no, el anillo de progreso se ve raro al agregar tiempo
  }

  // Progreso de la sesión del día elegido: series hechas / series de la rutina (issue #22)
  // Último día de la rutina hecho (lectura del registro). Pestaña inicial: el otro día; si hoy ya hay series, ese mismo.
  const ultimoDia = ultimoDiaRutina(ejercicioLog, isSerieDone);
  const diaInicial = ultimoDia ? (ultimoDia.fecha===todayKey ? ultimoDia.dia : (ultimoDia.dia==="A"?"B":"A")) : diaSugerido();
  const diaSel     = diaManual ?? diaInicial;
  const rutinaDia   = RUTINA[diaSel];
  const rutinaItems = rutinaDia.items.map(item => ({item, rx: rutinaEx(item)})).filter(x => x.rx);
  const seriesTotal = rutinaItems.reduce((n,x) => n + (x.rx.series||3), 0);
  const seriesHechas = rutinaItems.reduce((n,x) => n + Array.from({length:x.rx.series||3},(_,si)=>isSerieDone(todaySeries[`${x.rx.id}_${si}`])?1:0).reduce((a,b)=>a+b,0), 0);
  const pct     = seriesTotal > 0 ? Math.round(seriesHechas / seriesTotal * 100) : 0;
  const allDone = seriesTotal > 0 && seriesHechas === seriesTotal;

  function getExHistory(exId, exOverride) {
    const ex   = exOverride || allExercicios.find(e => e.id === exId);
    const days = Object.keys(ejercicioLog).sort();
    const result = [];
    days.forEach(dk => {
      const dayLog = ejercicioLog[dk] || {};
      const keys = Object.keys(dayLog).filter(k => k.startsWith(exId + "_"));
      if(!keys.length) return;
      let bestReps = 0, bestPeso = null, hasDone = false, allTop = true;
      keys.forEach(k => {
        const sv = getSerieValue(dayLog[k]);
        if(!sv?.done) return;
        hasDone = true;
        const r = sv.reps || 0;
        const p = sv.peso || null;
        if(ex && r < ex.repMax) allTop = false;
        const vol = volEfectivo(r, p, ex);
        const bVol = volEfectivo(bestReps, bestPeso, ex);
        if(vol > bVol){ bestReps = r; bestPeso = p; }
      });
      if(hasDone) result.push({date: dk, reps: bestReps, peso: bestPeso, allTop});
    });
    return result;
  }

  // ── Rutina A/B (issue #22) ────────────────────────────────────────────────
  // Reemplaza getProgressionSuggestion / getCalisteniaProgression / applyProgression
  // y el acordeón por grupo muscular de la vista de sesión (obsoletos; siguen en el historial de git).

  // Ejercicio del catálogo con la prescripción de la rutina aplicada SOLO en esta vista.
  function rutinaEx(item) {
    const base = allExercicios.find(e => e.id === item.exId);
    if(!base) return null;
    return {...base, series:item.series, repMin:item.repMin, repMax:item.repMax, restSecs:item.rest, weightStep: item.paso ?? base.weightStep};
  }

  // Series hechas de un ejercicio, por fecha, en orden cronológico (solo lectura de ejercicioLog).
  function setsPorFecha(exId) {
    const out = [];
    Object.keys(ejercicioLog).sort().forEach(dk => {
      const dayLog = ejercicioLog[dk] || {};
      const sets = [];
      Object.keys(dayLog).forEach(k => {
        const m = k.match(/^(.*)_(\d+)$/);
        if(!m || m[1] !== exId) return;
        const sv = getSerieValue(dayLog[k]);
        if(sv?.done) sets[parseInt(m[2],10)] = {reps: sv.reps||null, peso: sv.peso||null};
      });
      if(sets.some(Boolean)) out.push({date: dk, sets});
    });
    return out;
  }

  // Peso que se propone en cada serie. Prioridad: subida confirmada a mano (si es posterior a la
  // última marca) > último peso marcado desde RUTINA_DESDE > peso sugerido de la rutina.
  // Las marcas anteriores a la rutina nueva NO fijan el peso (p. ej. la asistencia pasa a 12 kg).
  function pesoPorDefecto(item, rx) {
    const sesiones = setsPorFecha(rx.id).filter(x => x.date >= RUTINA_DESDE);
    const ultima = sesiones[sesiones.length-1];
    let ultimoPeso = null, ultimaFecha = null;
    if(ultima) {
      const conPeso = ultima.sets.filter(x => x && x.peso);
      if(conPeso.length) { ultimoPeso = conPeso[conPeso.length-1].peso; ultimaFecha = ultima.date; }
    }
    const pr = customEjercicios?.[rx.id]?.pesoRutina;
    if(pr && pr.kg!=null && (!ultimaFecha || pr.fecha >= ultimaFecha)) return pr.kg;
    if(ultimoPeso!=null) return ultimoPeso;
    return item.sugeridoKg ?? null;
  }

  // Aviso de progresión: la última sesión de la rutina completó todas las series en el tope del rango.
  function progresionRutina(item, rx) {
    const sesiones = setsPorFecha(rx.id).filter(x => x.date >= RUTINA_DESDE);
    const ult = sesiones[sesiones.length-1];
    if(!ult) return null;
    const hechas = ult.sets.filter(Boolean);
    const alTope = hechas.length >= rx.series && hechas.every(x => (x.reps||0) >= rx.repMax);
    if(!alTope) return null;
    if(item.paso != null) {
      const pesos = hechas.filter(x => x.peso);
      if(!pesos.length) return null;
      const kg = Math.max(0, parseFloat((pesos[pesos.length-1].peso + item.paso).toFixed(2)));
      const pr = customEjercicios?.[rx.id]?.pesoRutina;
      const ya = pr && pr.fecha >= ult.date && (item.paso > 0 ? pr.kg >= kg - 0.01 : pr.kg <= kg + 0.01);
      return ya ? null : {tipo:"peso", kg};
    }
    return item.progTexto ? {tipo:"texto", texto:item.progTexto} : null;
  }

  // Aplicar una subida confirmada por Cristopher. Se guarda el ejercicio fusionado COMPLETO en el
  // override (igual que el toggle de archivado; ver issue #1) más `pesoRutina: {kg, fecha}`.
  // Solo ocurre al tocar el botón; no se escribe nada de forma implícita.
  function aplicarPesoRutina(rx, kg) {
    const base = allExercicios.find(e => e.id === rx.id);
    if(!base) return;
    saveCustomEjercicios({...(customEjercicios||{}), [rx.id]: {...base, pesoRutina:{kg, fecha:todayKey}}});
  }

  function renderRutinaItem(item, idx) {
    const rx = rutinaEx(item);
    if(!rx) return null;
    const ex = rx;
    const nS = ex.series||3;
    const allExDone = Array.from({length:nS},(_,si)=>isSerieDone(todaySeries[`${ex.id}_${si}`])).every(Boolean);
    const algunaHecha = Array.from({length:nS},(_,si)=>isSerieDone(todaySeries[`${ex.id}_${si}`])).some(Boolean);
    const isOpenE   = openEx===ex.id;
    const exHist    = getExHistory(ex.id, rx);
    const lastHist  = exHist.length>0 ? exHist[exHist.length-1] : null;
    const usePeso   = item.sugeridoKg != null;
    const defaultPesoKg = pesoPorDefecto(item, rx);
    const prog      = progresionRutina(item, rx);
    const sesPrev   = setsPorFecha(ex.id).filter(x => x.date < todayKey);
    const prevSets  = sesPrev.length ? sesPrev[sesPrev.length-1].sets : [];
    const guiaOpen  = guiaAbierta[ex.id] ?? !algunaHecha;
    const dib       = DIBUJOS[ex.id];
    const mapaTotals = {};
    (ex.muscles||[]).forEach(m => { mapaTotals[m.g] = m.pct * WEEKLY_MUSCLE_TARGET; });
    const calentTxt = item.calent ? calentamientoTexto(item.calent, defaultPesoKg, ex, pesoUnit) : null;
    const lbl = {fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#aaa",letterSpacing:1,textTransform:"uppercase",marginBottom:4};
    const txt = {fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#555",lineHeight:1.55};

    return (
      <div key={ex.id} style={{border:`1px solid ${allExDone?"#c8e6c9":"#eee"}`,borderRadius:12,marginBottom:8,overflow:"hidden",background:"#fff"}}>
        <div onClick={()=>setOpenEx(isOpenE?null:ex.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",cursor:"pointer"}}>
          <span style={{fontFamily:"'Caveat',cursive",fontSize:20,color:"#bbb",width:18,textAlign:"center"}}>{idx+1}</span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,fontWeight:600,color:allExDone?"#aaa":"#222",textDecoration:allExDone?"line-through":"none"}}>{ex.emoji} {ex.name}</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#888"}}>{nS}×{ex.repMin}-{ex.repMax} · {usePeso ? fmtCarga(defaultPesoKg, ex, pesoUnit) : "peso corporal"}</div>
            {!allExDone && lastHist && (
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa"}}>
                último: {lastHist.reps?(lastHist.peso?`${lastHist.reps}r×${toDisplay(lastHist.peso,pesoUnit)}${pesoUnit}`:`${lastHist.reps}r`):"hecho"}
              </div>
            )}
          </div>
          <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#ccc"}}>{Array.from({length:nS},(_,si)=>isSerieDone(todaySeries[`${ex.id}_${si}`])?"●":"○").join(" ")}</div>
          <span style={{color:"#ccc",fontSize:11}}>{isOpenE?"▴":"▾"}</span>
        </div>

        {isOpenE && (
          <div style={{padding:"10px 14px 14px",background:"#fafafa",borderTop:"1px solid #f0f0f0"}}>
            <div style={{...txt,fontSize:11,color:"#999",marginBottom:8}}>descanso {ex.restSecs}s · ritmo: {item.ritmo}</div>

            {calentTxt && (
              <div style={{background:"#fff8e1",border:"1px solid #ffe9a8",borderRadius:8,padding:"8px 12px",marginBottom:10}}>
                <div style={{...lbl,color:"#b58900"}}>calentamiento · no se registra</div>
                <div style={{...txt,color:"#7a5c00"}}>{calentTxt}</div>
              </div>
            )}

            {prog?.tipo==="peso" && (
              <button onClick={()=>aplicarPesoRutina(ex,prog.kg)}
                style={{width:"100%",background:"#2e7d52",border:"none",borderRadius:8,padding:"10px",fontFamily:"'Caveat',cursive",fontSize:16,color:"#fff",cursor:"pointer",marginBottom:10,fontWeight:700}}>
                {ex.weightStep<0 ? "⬆ Menos asistencia: " : "⬆ Subir a "}{fmtCarga(prog.kg, ex, pesoUnit)}
              </button>
            )}
            {prog?.tipo==="texto" && (
              <div style={{background:"#e8f5e9",border:"1px solid #c8e6c9",borderRadius:8,padding:"10px 12px",marginBottom:10}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#2e7d52",fontWeight:600,marginBottom:2}}>listo para progresar</div>
                <div style={{...txt,color:"#1b5e20"}}>⬆ {prog.texto}</div>
              </div>
            )}

            {/* Guía de ejecución: dibujo, mapa de músculos y criterios de serie limpia */}
            <button onClick={()=>setGuiaAbierta(g=>({...g,[ex.id]:!guiaOpen}))}
              style={{width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center",background:"transparent",border:"1px dashed #ddd",borderRadius:8,padding:"7px 12px",cursor:"pointer",marginBottom:guiaOpen?8:10}}>
              <span style={{fontFamily:"'Caveat',cursive",fontSize:15,color:"#777"}}>📖 guía de ejecución</span>
              <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb"}}>{guiaOpen?"▴":"▾"}</span>
            </button>
            {guiaOpen && (
              <div style={{background:"#fff",border:"1px solid #eee",borderRadius:10,padding:"10px 12px",marginBottom:10}}>
                {dib && (
                  <div style={{display:"flex",gap:8,marginBottom:10}}>
                    {["inicio","final"].map(k=>(
                      <div key={k} style={{flex:1,textAlign:"center"}}>
                        <svg viewBox={FIG_VIEWBOX} style={{width:"100%",display:"block",background:"#fff",border:"1px solid #eee",borderRadius:8}} dangerouslySetInnerHTML={{__html:dib[k]}}/>
                        <div style={{...lbl,marginTop:4,marginBottom:0}}>{k}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}>
                  <BodyHeatmap totals={mapaTotals} compact/>
                  <div style={{flex:1}}>
                    <div style={lbl}>qué trabaja</div>
                    {(ex.muscles||[]).map(m=>{
                      const mg = MUSCLE_GROUPS.find(g2=>g2.k===m.g);
                      return <div key={m.g} style={{...txt,fontSize:12}}>{mg?.label||m.g} <span style={{color:"#bbb"}}>{Math.round(m.pct*100)}%</span></div>;
                    })}
                  </div>
                </div>
                <div style={lbl}>antes de la primera repetición</div>
                <div style={{...txt,marginBottom:8}}>{item.montaje.map((t,i)=><div key={i}>• {t}</div>)}</div>
                <div style={lbl}>recorrido</div>
                <div style={{...txt,marginBottom:8}}>{item.recorrido}</div>
                <div style={{...lbl,color:"#2e7d52"}}>va bien si</div>
                <div style={{...txt,marginBottom:8}}>{item.bien.map((t,i)=><div key={i}>✓ {t}</div>)}</div>
                <div style={{...lbl,color:"#c0392b"}}>corrige si</div>
                <div style={{...txt,marginBottom:8}}>{item.corrige.map((t,i)=><div key={i}>✗ {t}</div>)}</div>
                <div style={lbl}>cuándo cortar la serie</div>
                <div style={txt}>{item.parada}</div>
              </div>
            )}

            {ex.variantes && ex.variantes.length>0 && (
                            <div style={{marginBottom:10}}>
                              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"#aaa",letterSpacing:1,textTransform:"uppercase",marginBottom:5}}>agarre/variante de hoy</div>
                              <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                                {ex.variantes.map(v=>{
                                  const activa = (varianteElegida[ex.id]||ex.variantes[0])===v;
                                  return (
                                    <button key={v} onClick={()=>setVarianteElegida(s=>({...s,[ex.id]:v}))}
                                      style={{padding:"5px 11px",borderRadius:14,border:"1px solid "+(activa?"#111":"#ddd"),background:activa?"#111":"#fff",color:activa?"#fff":"#777",fontFamily:"'DM Sans',sans-serif",fontSize:11,cursor:"pointer"}}>
                                      {v}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
            {exHist.length>=2 && <div style={{background:"#fff",border:"1px solid #f0f0f0",borderRadius:8,padding:"8px 10px",marginBottom:10}}><ProgresionChart history={exHist} compact ex={ex}/></div>}

            <div style={{display:"flex",flexDirection:"column",gap:6}}>
                            {Array.from({length:nS},(_,si)=>{
                              const sv      = getSerieValue(todaySeries[`${ex.id}_${si}`]);
                              const isDone  = !!sv?.done;
                              const locked2 = si>0 && !isSerieDone(todaySeries[`${ex.id}_${si-1}`]);
                              const rKey    = `${ex.id}_${si}`;
                              const curReps = repsInput[rKey]?.reps ?? (isDone&&sv?.reps?sv.reps:ex.repMin);
                              // curPesoKg: valor en kg para storage; display convierte según unidad
                              const curPesoKg = repsInput[rKey]?.peso ?? (isDone&&sv?.peso?sv.peso:defaultPesoKg);
                              const displayPeso = curPesoKg!=null ? toDisplay(curPesoKg, pesoUnit) : "";

                              return (
                                <div key={si}>
                                <div style={{display:"flex",alignItems:"center",gap:6,opacity:locked2?0.3:1,background:isDone?"#f0faf4":"#fff",borderRadius:8,padding:"8px 10px",border:`1px dashed ${isDone?"#c8e6c9":locked2?"#f0f0f0":"#e0e0e0"}`}}>
                                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb",width:20,textAlign:"center",flexShrink:0}}>S{si+1}</span>
                                  <button onClick={()=>!locked2&&!isDone&&setRepsInput(r=>({...r,[rKey]:{...r[rKey],reps:Math.max(1,(curReps||1)-1)}}))} disabled={locked2||isDone} style={{width:26,height:26,borderRadius:4,border:"1px dashed #ddd",background:"transparent",cursor:locked2||isDone?"default":"pointer",fontSize:14,color:"#aaa",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,flexShrink:0}}>−</button>
                                  <span style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:isDone?"#2e7d52":"#111",minWidth:30,textAlign:"center"}}>{curReps}</span>
                                  <button onClick={()=>!locked2&&!isDone&&setRepsInput(r=>({...r,[rKey]:{...r[rKey],reps:(curReps||1)+1}}))} disabled={locked2||isDone} style={{width:26,height:26,borderRadius:4,border:"1px dashed #ddd",background:"transparent",cursor:locked2||isDone?"default":"pointer",fontSize:14,color:"#aaa",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,flexShrink:0}}>+</button>
                                  <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb",marginRight:4}}>r</span>
                                  {usePeso && (
                                    <div style={{display:"flex",alignItems:"center",gap:3,marginLeft:4}}>
                                      {ex.plateUnit==="lb" ? (() => {
                                        // Modo discos: la barra/base tiene su propio peso fijo en kg
                                        // (barWeightKg) y lo que se carga son discos en libras -- el
                                        // selector kg/lb global no alcanza acá porque son DOS unidades
                                        // mezcladas en el mismo objeto físico, no una elección de una
                                        // sola. Se tipea solo lo que se ve físicamente (libras de
                                        // discos, sumando ambos lados), y la app suma la base y
                                        // convierte sola -- el kg total sigue siendo lo que se guarda
                                        // (mismo storage canónico de siempre, no cambia nada del
                                        // historial/progresión).
                                        const base = ex.barWeightKg || 0;
                                        const curDiscosLb = curPesoKg!=null ? Math.round(toDisplay(Math.max(0,curPesoKg-base),"lb")) : "";
                                        const defaultDiscosLb = defaultPesoKg!=null ? Math.round(toDisplay(Math.max(0,defaultPesoKg-base),"lb")) : null;
                                        return (
                                          <>
                                            <input type="number" step="5" min="0"
                                              value={curDiscosLb}
                                              onChange={e=>{
                                                const rawLb = e.target.value!=="" ? parseFloat(e.target.value) : null;
                                                const kg = rawLb!=null ? parseFloat((base + toKg(rawLb,"lb")).toFixed(2)) : null;
                                                setRepsInput(r=>({...r,[rKey]:{...r[rKey],peso:kg}}));
                                              }}
                                              disabled={isDone||locked2}
                                              placeholder={defaultDiscosLb!=null ? String(defaultDiscosLb) : "lb"}
                                              title={base>0 ? `+ ${base}kg de barra = ${curPesoKg!=null?curPesoKg.toFixed(1):"?"}kg total` : "peso base del carro no cargado, solo discos"}
                                              style={{width:46,border:"1px dashed #ddd",borderRadius:6,padding:"3px 5px",fontSize:12,fontFamily:"'DM Sans',sans-serif",textAlign:"right",outline:"none",background:isDone?"#f0faf4":"#fff",color:"#333"}}/>
                                            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb"}}>lb discos</span>
                                          </>
                                        );
                                      })() : (
                                        <>
                                          <input type="number" step={pesoUnit==="lb"?"5":"2.5"} min="0"
                                            value={displayPeso}
                                            onChange={e=>{
                                              const raw = e.target.value!=="" ? parseFloat(e.target.value) : null;
                                              const kg  = raw!=null ? toKg(raw, pesoUnit) : null;
                                              setRepsInput(r=>({...r,[rKey]:{...r[rKey],peso:kg}}));
                                            }}
                                            disabled={isDone||locked2}
                                            placeholder={defaultPesoKg!=null ? String(toDisplay(defaultPesoKg,pesoUnit)) : pesoUnit}
                                            style={{width:50,border:"1px dashed #ddd",borderRadius:6,padding:"3px 5px",fontSize:12,fontFamily:"'DM Sans',sans-serif",textAlign:"right",outline:"none",background:isDone?"#f0faf4":"#fff",color:"#333"}}/>
                                          <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb"}}>{pesoUnit}</span>
                                        </>
                                      )}
                                    </div>
                                  )}
                                  <button onClick={()=>{
                                    if(locked2||isDone) return;
                                    const ri = repsInput[rKey];
                                    markSerie(ex.id, si, ri?.reps!==undefined?ri.reps:curReps, ri?.peso!==undefined?ri.peso:(curPesoKg||null), ex.restSecs, varianteElegida[ex.id]||ex.variantes?.[0]);
                                  }} disabled={locked2||isDone}
                                    style={{marginLeft:"auto",width:36,height:36,borderRadius:8,border:isDone?"none":"1px dashed #bbb",background:isDone?"#2e7d52":locked2?"#f5f5f5":"#111",color:isDone?"#fff":locked2?"#ddd":"#fff",cursor:locked2||isDone?"default":"pointer",fontSize:isDone?15:12,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}}>
                                    {isDone?"✓":"→"}
                                  </button>
                                </div>
                                {prevSets[si] && !isDone && (
                                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",padding:"2px 10px 0"}}>
                                    última vez: {prevSets[si].reps?`${prevSets[si].reps}r`:"hecho"}{prevSets[si].peso?` × ${fmtPesoSerie(prevSets[si].peso, ex, pesoUnit)}`:""}
                                  </div>
                                )}
                                </div>
                              );
                            })}
                          </div>
          </div>
        )}
      </div>
    );
  }

  function buildStats() {
    const allDates = Object.keys(ejercicioLog).sort().reverse();
    const sessionDates = allDates.filter(dk => Object.values(ejercicioLog[dk]||{}).some(v => isSerieDone(v)));
    // Racha actual
    let streak = 0;
    const checkD = new Date(todayKey + "T12:00:00");
    for(let i = 0; i < 90; i++){
      const dk = checkD.getFullYear()+"-"+String(checkD.getMonth()+1).padStart(2,"0")+"-"+String(checkD.getDate()).padStart(2,"0");
      if(sessionDates.includes(dk)){ streak++; } else if(i > 0) break;
      checkD.setDate(checkD.getDate() - 1);
    }
    // Mejor racha
    let maxStreak = 0, tmpStreak = 0;
    const sortedSessions = [...sessionDates].sort();
    sortedSessions.forEach((dk, i) => {
      if(i === 0){ tmpStreak = 1; }
      else {
        const diff = Math.round((new Date(dk+"T12:00:00") - new Date(sortedSessions[i-1]+"T12:00:00")) / 86400000);
        tmpStreak = diff === 1 ? tmpStreak + 1 : 1;
      }
      maxStreak = Math.max(maxStreak, tmpStreak);
    });
    // Esta semana
    const todayD = new Date();
    const weekStart = new Date(todayD); weekStart.setDate(todayD.getDate() - ((todayD.getDay()+6)%7));
    const thisWeekSessions = sessionDates.filter(dk => { const d=new Date(dk+"T12:00:00"); return d>=weekStart && d<=todayD; });
    // Promedio semanal
    const firstDate = sortedSessions[0];
    const weeksElapsed = firstDate ? Math.max(1, Math.ceil((new Date(todayKey+"T12:00:00")-new Date(firstDate+"T12:00:00"))/(7*86400000))) : 1;
    const avgPerWeek = sessionDates.length / weeksElapsed;
    // Grupos más trabajados — últimas 4 semanas
    const cutoff = new Date(todayD); cutoff.setDate(todayD.getDate()-28);
    const recentDates = allDates.filter(dk => new Date(dk+"T12:00:00") >= cutoff);
    const muscleCount = {};
    recentDates.forEach(dk => {
      const dLog = ejercicioLog[dk] || {};
      Object.keys(dLog).forEach(k => {
        if(!isSerieDone(dLog[k])) return;
        const exId = k.split("_").slice(0,-1).join("_") || k.split("_")[0];
        const ex = allExercicios.find(e=>e.id===exId);
        (ex?.muscles||[]).forEach(m => { muscleCount[m.g] = (muscleCount[m.g]||0) + 1; });
      });
    });
    // Volumen total reciente (series completadas, últimas 4 semanas)
    let totalSeriesRecent = 0;
    recentDates.forEach(dk => {
      totalSeriesRecent += Object.values(ejercicioLog[dk]||{}).filter(v=>isSerieDone(v)).length;
    });
    // Distribución por día de semana
    const dowCount = Array(7).fill(0);
    sessionDates.forEach(dk => { dowCount[(new Date(dk+"T12:00:00").getDay()+6)%7]++; });
    // Rank
    const frecScore  = Math.min(avgPerWeek/3, 1);
    const constScore = Math.min(maxStreak/7, 1);
    const raw = frecScore*60 + constScore*40;
    const rank = raw>=85?"S":raw>=70?"A":raw>=55?"B":raw>=40?"C":"D";
    return {sessionDates, streak, maxStreak, thisWeekSessions, rank, avgPerWeek, muscleCount, totalSeriesRecent, dowCount};
  }

  function saveExercise(ex) {
    const {_isNew, ...rest} = ex;
    const id = _isNew ? "custom-ex-"+Date.now() : ex.id;
    saveCustomEjercicios({...(customEjercicios||{}), [id]: {...rest, id}});
    setEditEx(null);
  }
  function deleteCustomEx(id){ const n = {...(customEjercicios||{})}; delete n[id]; saveCustomEjercicios(n); }

  const DARK = {background:"#1a1a1a",borderRadius:12,padding:"14px 16px",color:"#fff",marginBottom:12};
  const SL   = {fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:2,textTransform:"uppercase",marginBottom:8};

  // ═══ VISTA: HISTORIAL ═══
  if(view === "historial") {
    const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    const fmtD = dk => { const [,m,d] = dk.split("-").map(Number); return `${d} ${MONTHS[m-1]}`; };
    const exConHistorial = allExercicios.filter(ex =>
      Object.keys(ejercicioLog).some(dk =>
        Object.keys(ejercicioLog[dk]||{}).some(k => k.startsWith(ex.id+"_") && isSerieDone((ejercicioLog[dk]||{})[k]))
      )
    );
    const selEx   = histExId ? allExercicios.find(e=>e.id===histExId) : null;
    const hist    = histExId ? getExHistory(histExId) : [];
    const hasPeso = hist.some(h=>h.peso);
    const bestVol = hist.length ? Math.max(...hist.map(h => volEfectivo(h.reps, h.peso, selEx))) : 0;
    const lastEntry  = hist.length ? hist[hist.length-1] : null;
    const firstEntry = hist.length ? hist[0] : null;
    const lastVol  = lastEntry  ? volEfectivo(lastEntry.reps, lastEntry.peso, selEx)  : 0;
    const firstVol = firstEntry ? volEfectivo(firstEntry.reps, firstEntry.peso, selEx) : 0;
    const deltaPct = firstVol !== 0 ? Math.round((lastVol-firstVol)/Math.abs(firstVol)*100) : null;
    return (
      <div style={{padding:"16px",maxWidth:480,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <button onClick={()=>setView("session")} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer",padding:0,lineHeight:1}}>←</button>
          <span style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"#111"}}>📈 historial</span>
        </div>
        {exConHistorial.length===0 ? (
          <div style={{padding:"60px 0",textAlign:"center"}}>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:18,color:"#ccc",marginBottom:6}}>sin sesiones registradas aún</div>
          </div>
        ) : (<>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:20}}>
            {exConHistorial.map(ex=>(
              <button key={ex.id} onClick={()=>setHistExId(histExId===ex.id?null:ex.id)}
                style={{display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:20,border:"1.5px solid",cursor:"pointer",
                  background:histExId===ex.id?"#111":"transparent",color:histExId===ex.id?"#fff":"#555",borderColor:histExId===ex.id?"#111":"#ddd"}}>
                <span style={{fontSize:14}}>{ex.emoji}</span>
                <span style={{fontFamily:"'Caveat',cursive",fontSize:15,fontWeight:700}}>{ex.name}</span>
              </button>
            ))}
          </div>
          {selEx && hist.length>0 && (
            <div style={DARK}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <span style={{fontSize:22}}>{selEx.emoji}</span>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:"#fff"}}>{selEx.name}</div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.35)",marginTop:2}}>{hist.length} sesiones</div>
                </div>
                {deltaPct!==null && (
                  <div style={{textAlign:"right"}}>
                    <div style={{fontFamily:"'Caveat',cursive",fontSize:24,fontWeight:700,color:deltaPct>=0?"#aac756":"#ff8888",lineHeight:1}}>
                      {deltaPct>=0?"+":""}{deltaPct}%
                    </div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.3)"}}>progresión</div>
                  </div>
                )}
              </div>
              {/* KPI grid */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:14}}>
                {[
                  {label:"última sesión", val:lastEntry?.reps?(hasPeso?`${lastEntry.reps}r×${lastEntry.peso}kg`:`${lastEntry.reps}r`):"—", sub:lastEntry?fmtD(lastEntry.date):""},
                  {label:"PR volumen",    val:(()=>{ const pr=hist.find(h=>volEfectivo(h.reps,h.peso,selEx)===bestVol); return pr?(hasPeso?`${pr.reps}r×${pr.peso}kg`:`${bestVol}r`):"—"; })(), gold:true},
                  {label:"sesiones",      val:hist.length, sub:firstEntry?`desde ${fmtD(firstEntry.date)}`:""},
                ].map(({label,val,sub,gold})=>(
                  <div key={label} style={{background:"rgba(255,255,255,0.06)",borderRadius:8,padding:"10px"}}>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:8,color:"rgba(255,255,255,0.3)",letterSpacing:1,textTransform:"uppercase",marginBottom:4}}>{label}</div>
                    <div style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:gold?"#aac756":"#fff",lineHeight:1}}>{val}</div>
                    {sub&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.25)",marginTop:3}}>{sub}</div>}
                  </div>
                ))}
              </div>
              {hist.length>=2 && (
                <div style={{background:"rgba(255,255,255,0.04)",borderRadius:10,padding:12,marginBottom:14}}>
                  <div style={SL}>progresión</div>
                  <ProgresionChart history={hist} ex={selEx}/>
                </div>
              )}
              <div style={SL}>sesiones recientes</div>
              <div style={{display:"flex",flexDirection:"column",gap:2}}>
                {[...hist].reverse().slice(0,12).map(h=>{
                  const vol = volEfectivo(h.reps, h.peso, selEx);
                  const isPR = vol===bestVol && vol>0;
                  return (
                    <div key={h.date} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                      <div style={{fontFamily:"'Caveat',cursive",fontSize:15,color:"rgba(255,255,255,0.6)",minWidth:54}}>{fmtD(h.date)}</div>
                      <div style={{flex:1,fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#fff",fontWeight:600}}>
                        {h.reps?(hasPeso?`${h.reps} reps × ${h.peso} kg`:`${h.reps} reps`):"sin reps"}
                      </div>
                      {isPR&&<span style={{fontSize:11,color:"#aac756",flexShrink:0}}>🏆</span>}
                      {!isPR&&h.allTop&&<span style={{fontSize:11,color:"#aac756",flexShrink:0}}>🔝</span>}
                    </div>
                  );
                })}
              </div>
              {selEx.how && (
                <div style={{marginTop:14,background:"rgba(255,255,255,0.04)",borderRadius:8,padding:"10px 12px"}}>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.4)",lineHeight:1.6}}>{selEx.how}</div>
                </div>
              )}
            </div>
          )}
        </>)}
        <div style={{height:32}}/>
      </div>
    );
  }

  // ═══ VISTA: SEMANAS (archivo semanal -- muñeco + ejercicios/reps/pesos
  // combinados de esa semana, calculado al vuelo desde ejercicioLog, que ya
  // guarda todo el historial sin podar) ═══
  if(view === "semanas") {
    const DARK = {background:"#1a1a1a",borderRadius:12,padding:"14px 16px",color:"#fff",marginBottom:12};
    const SL   = {fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.35)",letterSpacing:2,textTransform:"uppercase",marginBottom:8};
    const MONTHS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
    const fmtD = dk => { const [,m,d] = dk.split("-").map(Number); return `${d} ${MONTHS[m-1]}`; };
    const semanas = weeksWithData(ejercicioLog);
    const monday = histWeek || semanas[0] || null;
    const weekDates = monday ? weekDatesFor(monday) : [];
    const sunday = weekDates[6];
    const weekTotals = monday ? computeWeekMuscleEffortFor(ejercicioLog, allExercicios, weekDates) : {};
    const weekEx = monday ? computeWeekExerciseSummary(ejercicioLog, allExercicios, weekDates) : [];
    return (
      <div style={{padding:"16px",maxWidth:480,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <button onClick={()=>setView("session")} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer",padding:0,lineHeight:1}}>←</button>
          <span style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"#111"}}>🗓️ semanas</span>
        </div>
        {semanas.length===0 ? (
          <div style={{padding:"60px 0",textAlign:"center"}}>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:18,color:"#ccc",marginBottom:6}}>sin semanas registradas aún</div>
          </div>
        ) : (<>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:20}}>
            {semanas.map(m=>{
              const s = weekDatesFor(m)[6];
              const activa = m===monday;
              return (
                <button key={m} onClick={()=>setHistWeek(m)}
                  style={{padding:"6px 12px",borderRadius:20,border:"1.5px solid",cursor:"pointer",
                    background:activa?"#111":"transparent",color:activa?"#fff":"#555",borderColor:activa?"#111":"#ddd"}}>
                  <span style={{fontFamily:"'Caveat',cursive",fontSize:14,fontWeight:700}}>{fmtD(m)}–{fmtD(s)}</span>
                </button>
              );
            })}
          </div>
          {monday && (
            <div style={DARK}>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:"#fff",marginBottom:14}}>
                semana del {fmtD(monday)} al {fmtD(sunday)}
              </div>
              <BodyHeatmap totals={weekTotals} onTap={()=>{}}/>
              {weekEx.length===0 ? (
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"rgba(255,255,255,0.35)",textAlign:"center",padding:"12px 0"}}>sin series marcadas esa semana</div>
              ) : (<>
                <div style={SL}>ejercicios de la semana</div>
                <div style={{display:"flex",flexDirection:"column",gap:2}}>
                  {weekEx.map(({ex,series})=>{
                    const hasPeso = series.some(s=>s.peso);
                    return (
                      <div key={ex.id} style={{padding:"9px 0",borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                          <span style={{fontSize:15}}>{ex.emoji}</span>
                          <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:600,color:"#fff",flex:1}}>{ex.name}</span>
                          <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.35)"}}>{series.length} series</span>
                        </div>
                        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.55)",paddingLeft:23}}>
                          {series.map((s,i)=>(
                            <span key={i}>{i>0?" · ":""}{s.reps}{hasPeso&&s.peso?`×${s.peso}kg`:"r"}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>)}
            </div>
          )}
        </>)}
        <div style={{height:32}}/>
      </div>
    );
  }

  // ═══ VISTA: STATS ═══
  if(view === "stats") {
    const {sessionDates, streak, maxStreak, thisWeekSessions, rank, avgPerWeek, muscleCount, totalSeriesRecent, dowCount} = buildStats();
    const RANK_COLORS = {S:"#fff",A:"rgba(255,255,255,0.9)",B:"rgba(255,255,255,0.7)",C:"rgba(255,255,255,0.5)",D:"rgba(255,255,255,0.3)"};
    const RANK_MSG = {
      S:"Racha sólida. El cuerpo lo nota aunque la cabeza no lo reconozca.",
      A:"Buena constancia. El hábito ya existe, ahora es mantenerlo.",
      B:"Ritmo irregular pero presente. Seguir importa más que la frecuencia perfecta.",
      C:"Pocas sesiones registradas. Un día a la vez.",
      D:"Empezando. El primer registro ya es más que cero.",
    };
    const sortedMuscles = Object.entries(muscleCount).sort((a,b)=>b[1]-a[1]);
    const maxMuscle     = Math.max(...Object.values(muscleCount), 1);
    const DOW_LABELS    = ["lun","mar","mié","jue","vie","sáb","dom"];
    const maxDow        = Math.max(...dowCount, 1);
    // Últimas 8 semanas
    const todayD = new Date();
    const weeks8 = Array.from({length:8},(_,i)=>{
      const start = new Date(todayD); start.setDate(todayD.getDate()-((todayD.getDay()+6)%7)-i*7);
      const end   = new Date(start);  end.setDate(start.getDate()+6);
      const s = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,"0")}-${String(start.getDate()).padStart(2,"0")}`;
      const e = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,"0")}-${String(end.getDate()).padStart(2,"0")}`;
      return {count:sessionDates.filter(dk=>dk>=s&&dk<=e).length, isThis:i===0};
    }).reverse();
    const maxWeek = Math.max(...weeks8.map(w=>w.count), 1);

    return (
      <div style={{background:"#0a0a0a",minHeight:"100vh",padding:"16px",maxWidth:480,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
          <button onClick={()=>setView("session")} style={{background:"transparent",border:"none",fontSize:20,color:"#444",cursor:"pointer",padding:0,lineHeight:1}}>←</button>
          <span style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color:"#fff"}}>📊 estadísticas</span>
        </div>
        {sessionDates.length===0 ? (
          <div style={{textAlign:"center",padding:"80px 0"}}>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:18,color:"#333"}}>sin sesiones aún</div>
          </div>
        ) : (<>
          {/* KPI strip */}
          <div style={{...DARK,display:"flex",gap:0,padding:0,overflow:"hidden"}}>
            {[
              {label:"racha",       val:`${streak}d`,                 color:streak>=7?"#aac756":"#fff"},
              {label:"mejor racha", val:`${maxStreak}d`,              color:"#888"},
              {label:"esta semana", val:`${thisWeekSessions.length}x`,color:thisWeekSessions.length>=3?"#aac756":"#fff"},
              {label:"total",       val:`${sessionDates.length}`,     color:"#888"},
            ].map(({label,val,color},i)=>(
              <div key={label} style={{flex:1,padding:"14px 8px",textAlign:"center",borderRight:i<3?"1px solid rgba(255,255,255,0.07)":"none"}}>
                <div style={{fontFamily:"'Caveat',cursive",fontSize:22,fontWeight:700,color,lineHeight:1}}>{val}</div>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:8,color:"rgba(255,255,255,0.3)",letterSpacing:1,textTransform:"uppercase",marginTop:4}}>{label}</div>
              </div>
            ))}
          </div>
          {/* Frecuencia semanal — 8 semanas */}
          <div style={{...DARK}}>
            <div style={SL}>sesiones por semana — últimas 8</div>
            <div style={{display:"flex",gap:3,alignItems:"flex-end",height:52}}>
              {weeks8.map((w,i)=>(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,height:"100%",justifyContent:"flex-end"}}>
                  <div style={{width:"100%",borderRadius:"3px 3px 0 0",
                    height:`${Math.max(w.count/maxWeek*80,w.count>0?5:2)}%`,
                    background:`rgba(255,255,255,${w.isThis?0.9:0.15+0.55*(w.count/maxWeek)})`,
                    border:w.isThis?"1px solid rgba(255,255,255,0.4)":"none"}}/>
                  {w.count>0&&<div style={{fontFamily:"'DM Sans',sans-serif",fontSize:8,color:"rgba(255,255,255,0.25)"}}>{w.count}</div>}
                </div>
              ))}
            </div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:8}}>
              promedio <span style={{color:"rgba(255,255,255,0.6)",fontWeight:600}}>{avgPerWeek.toFixed(1)}x/semana</span>
              <span style={{marginLeft:8,color:avgPerWeek>=3?"#aac756":"rgba(255,255,255,0.25)"}}>{avgPerWeek>=3?"✓ objetivo":"objetivo: 3x"}</span>
            </div>
          </div>
          {/* Grupos musculares más trabajados */}
          {sortedMuscles.length>0 && (
            <div style={{...DARK}}>
              <div style={SL}>grupos más trabajados — últimas 4 semanas</div>
              <div style={{display:"flex",flexDirection:"column",gap:7}}>
                {sortedMuscles.slice(0,6).map(([mk,count])=>{
                  const g = MUSCLE_GROUPS.find(g=>g.k===mk);
                  return (
                    <div key={mk} style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:14,flexShrink:0,width:20,textAlign:"center"}}>{g?.emoji}</span>
                      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"rgba(255,255,255,0.45)",width:80,flexShrink:0}}>{g?.label||mk}</div>
                      <div style={{flex:1,background:"rgba(255,255,255,0.08)",borderRadius:99,height:5,overflow:"hidden"}}>
                        <div style={{height:"100%",width:`${count/maxMuscle*100}%`,background:"rgba(255,255,255,0.6)",borderRadius:99,transition:"width 0.4s"}}/>
                      </div>
                      <div style={{fontFamily:"'Caveat',cursive",fontSize:16,fontWeight:700,color:"#fff",minWidth:20,textAlign:"right"}}>{count}</div>
                    </div>
                  );
                })}
              </div>
              {(()=>{
                const trabajados = new Set(sortedMuscles.map(([k])=>k));
                const faltantes  = MUSCLE_GROUPS.filter(g=>!trabajados.has(g.k));
                if(!faltantes.length) return null;
                return (
                  <div style={{marginTop:10,padding:"8px 10px",background:"rgba(255,150,50,0.1)",borderRadius:8}}>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,200,100,0.8)",fontWeight:600,marginBottom:3}}>sin trabajo reciente</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.3)"}}>
                      {faltantes.map(g=>`${g.emoji} ${g.label}`).join(" · ")}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
          {/* Días favoritos */}
          <div style={{...DARK}}>
            <div style={SL}>días que más entrenás</div>
            <div style={{display:"flex",gap:4,alignItems:"flex-end",height:44}}>
              {dowCount.map((count,i)=>(
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,height:"100%",justifyContent:"flex-end"}}>
                  <div style={{width:"100%",borderRadius:"3px 3px 0 0",
                    height:`${Math.max(count/maxDow*80,count>0?4:2)}%`,
                    background:count===Math.max(...dowCount)&&count>0?"#fff":`rgba(255,255,255,${count>0?0.3:0.06})`}}/>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.25)"}}>{DOW_LABELS[i]}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Volumen */}
          <div style={{...DARK,display:"flex",alignItems:"center",gap:16}}>
            <div style={{flex:1}}>
              <div style={SL}>series — últimas 4 semanas</div>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:36,fontWeight:700,color:"#fff",lineHeight:1}}>{totalSeriesRecent}</div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.3)",marginTop:4}}>series completadas</div>
            </div>
            <div style={{width:1,height:50,background:"rgba(255,255,255,0.08)"}}/>
            <div style={{flex:1,textAlign:"right"}}>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.3)",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>por semana</div>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:30,fontWeight:700,color:"rgba(255,255,255,0.55)",lineHeight:1}}>{(totalSeriesRecent/4).toFixed(0)}</div>
            </div>
          </div>
          {/* Rank */}
          <div style={{...DARK,textAlign:"center",padding:"28px 16px"}}>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:9,color:"rgba(255,255,255,0.25)",letterSpacing:3,textTransform:"uppercase",marginBottom:16}}>constancia</div>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:96,fontWeight:700,lineHeight:1,color:RANK_COLORS[rank],textShadow:rank==="S"?"0 0 40px rgba(255,255,255,0.4)":"none",marginBottom:8}}>{rank}</div>
            <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"rgba(255,255,255,0.2)",marginBottom:16}}>frecuencia {Math.round(Math.min(avgPerWeek/3,1)*100)}% · racha {Math.round(Math.min(maxStreak/7,1)*100)}%</div>
            <div style={{fontFamily:"'Caveat',cursive",fontSize:17,color:"rgba(255,255,255,0.55)",lineHeight:1.5,maxWidth:260,margin:"0 auto"}}>{RANK_MSG[rank]}</div>
          </div>
        </>)}
        <div style={{height:40}}/>
      </div>
    );
  }

  // ═══ VISTA: EDITOR ═══
  if(view === "editor") {
    return (
      <div style={{padding:"16px",maxWidth:720,margin:"0 auto"}}>
        {editEx && (
          <div onClick={()=>setEditEx(null)} style={{position:"fixed",inset:0,zIndex:600,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
            <div onClick={e=>e.stopPropagation()} style={{width:"min(96vw,480px)",background:"#fff",borderRadius:"16px 16px 0 0",padding:"24px 24px 40px",maxHeight:"90vh",overflowY:"auto"}}>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:"#111",marginBottom:16}}>{editEx._isNew?"➕ nuevo ejercicio":"✎ editar ejercicio"}</div>
              <div style={{display:"flex",gap:8,marginBottom:12}}>
                <input value={editEx.emoji||""} onChange={e=>setEditEx(ex=>({...ex,emoji:e.target.value}))} style={{width:46,border:"1px dashed #ddd",borderRadius:8,padding:"10px 8px",fontSize:20,textAlign:"center",outline:"none",color:"#111",flexShrink:0}}/>
                <input value={editEx.name||""} placeholder="nombre" onChange={e=>setEditEx(ex=>({...ex,name:e.target.value}))} style={{flex:1,border:"1px dashed #ddd",borderRadius:8,padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none",color:"#111"}}/>
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:5}}>instrucciones</div>
                <textarea value={editEx.how||""} rows={3} onChange={e=>setEditEx(ex=>({...ex,how:e.target.value}))} style={{width:"100%",border:"1px dashed #ddd",borderRadius:8,padding:"10px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",boxSizing:"border-box",resize:"vertical",color:"#111"}}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>series</div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <button onClick={()=>setEditEx(ex=>({...ex,series:Math.max(1,(ex.series||3)-1)}))} style={{width:30,height:30,borderRadius:6,border:"1px dashed #ddd",background:"transparent",fontSize:16,cursor:"pointer",color:"#555"}}>−</button>
                    <span style={{fontFamily:"'Caveat',cursive",fontSize:26,fontWeight:700,color:"#111",minWidth:24,textAlign:"center"}}>{editEx.series||3}</span>
                    <button onClick={()=>setEditEx(ex=>({...ex,series:Math.min(8,(ex.series||3)+1)}))} style={{width:30,height:30,borderRadius:6,border:"1px dashed #ddd",background:"transparent",fontSize:16,cursor:"pointer",color:"#555"}}>+</button>
                  </div>
                </div>
                <div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>descanso</div>
                  <select value={editEx.restSecs||90} onChange={e=>setEditEx(ex=>({...ex,restSecs:parseInt(e.target.value)}))} style={{width:"100%",border:"1px dashed #ddd",borderRadius:8,padding:"7px 8px",fontFamily:"'DM Sans',sans-serif",fontSize:12,outline:"none",background:"#fff",color:"#111"}}>
                    {[[45,"45 seg"],[60,"1 min"],[75,"1:15"],[90,"1:30"],[120,"2 min"],[150,"2:30"],[180,"3 min"]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>rango reps min</div>
                  <input type="number" value={editEx.repMin||8} onChange={e=>setEditEx(ex=>({...ex,repMin:parseInt(e.target.value)||8}))} style={{width:"100%",border:"1px dashed #ddd",borderRadius:8,padding:"7px 10px",fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none",color:"#111"}}/>
                </div>
                <div>
                  <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>rango reps max</div>
                  <input type="number" value={editEx.repMax||12} onChange={e=>setEditEx(ex=>({...ex,repMax:parseInt(e.target.value)||12}))} style={{width:"100%",border:"1px dashed #ddd",borderRadius:8,padding:"7px 10px",fontFamily:"'DM Sans',sans-serif",fontSize:14,outline:"none",color:"#111"}}/>
                </div>
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:4}}>siguiente variante (calistenia)</div>
                <input value={editEx.nextVariant||""} placeholder="ej: Archer push-up" onChange={e=>setEditEx(ex=>({...ex,nextVariant:e.target.value||undefined}))} style={{width:"100%",border:"1px dashed #ddd",borderRadius:8,padding:"9px 12px",fontFamily:"'DM Sans',sans-serif",fontSize:13,outline:"none",color:"#111",boxSizing:"border-box"}}/>
              </div>
              <div style={{marginBottom:12}}>
                <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#aaa",letterSpacing:2,textTransform:"uppercase",marginBottom:6}}>grupos musculares</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                  {MUSCLE_GROUPS.map(g=>{
                    const m = (editEx.muscles||[]).find(x=>x.g===g.k);
                    return (
                      <button key={g.k} onClick={()=>{
                        const cur = editEx.muscles||[];
                        const next = m ? cur.filter(x=>x.g!==g.k) : [...cur,{g:g.k,pct:0.5}];
                        setEditEx(ex=>({...ex,muscles:next}));
                      }} style={{padding:"5px 10px",borderRadius:8,border:"1px dashed #ddd",background:m?"#111":"transparent",color:m?"#fff":"#555",fontFamily:"'DM Sans',sans-serif",fontSize:11,cursor:"pointer"}}>
                        {g.emoji} {g.label}{m?` ${Math.round(m.pct*100)}%`:""}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button onClick={()=>saveExercise(editEx)} disabled={!editEx.name?.trim()} style={{width:"100%",background:editEx.name?.trim()?"#111":"#eee",color:editEx.name?.trim()?"#fff":"#aaa",border:"none",borderRadius:8,padding:"14px",fontFamily:"'Caveat',cursive",fontSize:18,cursor:"pointer",marginBottom:8}}>guardar</button>
              {!editEx._isNew && !EJERCICIOS_DEFAULT.find(e=>e.id===editEx.id) && (
                <button onClick={()=>{deleteCustomEx(editEx.id);setEditEx(null);}} style={{width:"100%",background:"transparent",color:"#e53935",border:"1px dashed #e53935",borderRadius:8,padding:"10px",fontFamily:"'DM Sans',sans-serif",fontSize:12,cursor:"pointer",marginBottom:8}}>eliminar ejercicio</button>
              )}
              <button onClick={()=>setEditEx(null)} style={{width:"100%",background:"transparent",color:"#bbb",border:"none",padding:"8px",fontFamily:"'DM Sans',sans-serif",fontSize:12,cursor:"pointer"}}>cancelar</button>
            </div>
          </div>
        )}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
          <button onClick={()=>setView("session")} style={{background:"transparent",border:"none",fontSize:20,color:"#bbb",cursor:"pointer",padding:0,lineHeight:1}}>←</button>
          <span style={{fontFamily:"'Caveat',cursive",fontSize:20,fontWeight:700,color:"#111"}}>✎ editar catálogo</span>
        </div>
        {MUSCLE_GROUPS.map(g=>{
          const gExs = allExercicios.filter(e=>(e.muscles||[]).some(m=>m.g===g.k));
          if(!gExs.length) return null;
          return (
            <div key={g.k} style={{marginBottom:16}}>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:16,fontWeight:700,color:"#111",marginBottom:6}}>{g.emoji} {g.label}</div>
              {gExs.map(ex=>{
                const hist = getExHistory(ex.id);
                const lastDate = hist.length ? hist[hist.length-1].date : null;
                return (
                <div key={ex.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 0",borderBottom:"1px dashed #f0f0f0",opacity:ex.archivado?0.45:1}}>
                  <span style={{fontSize:16}}>{ex.emoji}</span>
                  <div style={{flex:1}}>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:600,color:"#333"}}>{ex.name}{ex.weightStep===0?<span style={{fontSize:9,color:"#aaa",marginLeft:6}}>calistenia</span>:null}{ex.archivado?<span style={{fontSize:9,color:"#e53935",marginLeft:6}}>archivado</span>:null}</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,color:"#bbb"}}>{ex.series||3} series · {ex.repMin}-{ex.repMax} reps · {ex.restSecs||90}s descanso{lastDate?` · último: ${lastDate}`:" · nunca registrado"}</div>
                  </div>
                  <button onClick={()=>saveExercise({...ex, archivado: !ex.archivado})} title={ex.archivado?"Desarchivar":"Archivar (saca de la lista activa, el historial queda intacto)"}
                    style={{background:"transparent",border:"none",color:ex.archivado?"#2e7d52":"#bbb",fontSize:14,cursor:"pointer",padding:"4px 6px"}}>{ex.archivado?"↩":"🗄"}</button>
                  <button onClick={()=>setEditEx({...ex})} style={{background:"transparent",border:"none",color:"#bbb",fontSize:14,cursor:"pointer",padding:"4px 6px"}}>✎</button>
                </div>
              );})}
            </div>
          );
        })}
        <button onClick={()=>setEditEx({id:"",name:"",emoji:"💪",muscles:[],series:3,how:"",restSecs:90,repMin:8,repMax:12,weightStep:2.5,_isNew:true})}
          style={{width:"100%",background:"transparent",border:"1px dashed #ddd",borderRadius:10,padding:"12px",fontFamily:"'DM Sans',sans-serif",fontSize:12,color:"#aaa",cursor:"pointer",marginTop:8}}>
          + agregar ejercicio
        </button>
        <div style={{height:32}}/>
      </div>
    );
  }

  // ═══ VISTA: SESIÓN (main) ═══
  const weeklyTotals = computeWeeklyMuscleEffort(ejercicioLog, allExercicios, todayKey);
  const timerMins = Math.floor(timerSecs/60), timerSec2 = timerSecs%60;

  return (
    <div style={{padding:"16px",maxWidth:720,margin:"0 auto"}}>
      {timerActive && <FloatingRestTimer secs={timerSecs} maxSecs={timerMax} onSkip={skipTimer} onAddTime={addTimerSecs}/>}

      {/* Nav */}
      <div style={{display:"flex",gap:0,marginBottom:16,background:"#fff",border:"1px solid #eee",borderRadius:10,overflow:"hidden"}}>
        <div style={{flex:1,fontFamily:"'Caveat',cursive",fontSize:18,padding:"10px",background:"#111",color:"#fff",textAlign:"center"}}>🏋️ sesión</div>
        {[["historial","📈"],["semanas","🗓️"],["stats","📊"],["editor","✎"]].map(([v,icon])=>(
          <button key={v} onClick={()=>setView(v)} style={{padding:"10px 14px",background:"transparent",color:"#aaa",border:"none",borderLeft:"1px solid #eee",cursor:"pointer",fontSize:14,lineHeight:1}}>{icon}</button>
        ))}
      </div>

      {/* Heatmap */}
      <BodyHeatmap totals={weeklyTotals} onTap={()=>setView("stats")}/>

      {/* Progreso de sesión — por grupos musculares */}
      <div style={{background:"#fff",border:"1px solid #eee",borderRadius:12,padding:"14px 16px",marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:8}}>
          <span style={{fontFamily:"'Caveat',cursive",fontSize:18,color:"#111",fontWeight:700}}>{allDone?"sesión completa ✓":"progreso"}</span>
          <span style={{fontFamily:"'Caveat',cursive",fontSize:22,color:"#555",fontWeight:700}}>{pct}%</span>
        </div>
        <div style={{height:6,background:"#eee",borderRadius:99,overflow:"hidden"}}>
          <div style={{width:`${pct}%`,height:"100%",background:allDone?"#2e7d52":"#111",borderRadius:99,transition:"width 0.4s"}}/>
        </div>
        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#bbb",marginTop:6}}>{seriesHechas} de {seriesTotal} series · {rutinaDia.label}</div>
      </div>

      {/* Toggle kg/lb — global para toda la sesión */}
      <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
        <div style={{display:"flex",gap:0,border:"1px solid #e0e0e0",borderRadius:8,overflow:"hidden"}}>
          {["kg","lb"].map(u=>(
            <button key={u} onClick={()=>setPesoUnit(u)}
              style={{padding:"5px 14px",background:pesoUnit===u?"#111":"transparent",color:pesoUnit===u?"#fff":"#aaa",border:"none",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:12,fontWeight:600,transition:"all 0.15s"}}>
              {u}
            </button>
          ))}
        </div>
      </div>

      {/* Rutina — Día A / Día B (issue #22). Reemplaza el acordeón por grupo muscular. */}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        {Object.entries(RUTINA).map(([k,d])=>{
          const activa = diaSel===k;
          const sugerido = diaInicial===k;
          return (
            <button key={k} onClick={()=>setDiaSel(k)}
              style={{flex:1,padding:"10px 8px",borderRadius:10,border:"1px solid "+(activa?"#111":"#e0e0e0"),background:activa?"#111":"#fff",color:activa?"#fff":"#777",cursor:"pointer"}}>
              <div style={{fontFamily:"'Caveat',cursive",fontSize:18,fontWeight:700,lineHeight:1.1}}>{d.label}</div>
              <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:10,opacity:0.7}}>{d.dia}{sugerido?(ultimoDia?.fecha===todayKey?" · en curso":" · toca hoy"):""}</div>
            </button>
          );
        })}
      </div>
      <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:11,color:"#888",marginBottom:10}}>
        {!ultimoDia && "aún sin registro de la rutina nueva"}
        {ultimoDia && ultimoDia.fecha===todayKey && `Hoy: ${RUTINA[ultimoDia.dia].label} en curso`}
        {ultimoDia && ultimoDia.fecha!==todayKey && `Último: ${RUTINA[ultimoDia.dia].label} · ${fechaCorta(ultimoDia.fecha)} (${haceTexto(ultimoDia.fecha, todayKey)}) → toca ${RUTINA[ultimoDia.dia==="A"?"B":"A"].label}`}
      </div>
      {rutinaItems.map(({item},idx)=>renderRutinaItem(item, idx))}
      <div style={{height:32}}/>
    </div>
  );
}

export default EjercicioPage;
