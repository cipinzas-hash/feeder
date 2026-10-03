// Rutina vigente: Día A (lunes) y Día B (viernes). Issue #22.
//
// Contenido ESTÁTICO (no se guarda en estado ni en exportaciones). Los pesos
// son valores SUGERIDOS en pantalla (`sugeridoKg`): no se escribe ni migra
// ningún dato persistido. Para ejercicios con discos (plateUnit "lb") el
// sugerido se expresa en lb de discos + barra, igual que en el registro.
//
// Campos por ítem:
//   exId        id del catálogo (EJERCICIOS_DEFAULT) — ahí viven nombre, emoji, músculos.
//   series, repMin, repMax, rest   prescripción de la rutina (pisa la del catálogo SOLO en esta vista).
//   sugeridoKg  peso de partida sugerido (kg, almacenamiento canónico). null = peso corporal.
//   paso        kg que se suma al progresar (negativo en máquina de asistencia). null = sin regla de peso.
//   progTexto   qué hacer al llegar al tope cuando no hay regla de peso.
//   ritmo       tempo de la repetición.
//   montaje     señales a revisar ANTES de la primera repetición.
//   recorrido   cómo se ejecuta.
//   bien        "va bien si".   corrige   "corrige si".   parada   cuándo termina la serie.
//   calent      guía de calentamiento (solo en pantalla; no se registra como serie).

export const RUTINA_DESDE = "2026-10-02"; // marcas desde esta fecha cuentan como "de la rutina nueva"

const LB = 2.2046;
const kgDeDiscos = (lb, baseKg) => Math.round((baseKg + lb / LB) * 100) / 100;

export const RUTINA = {
  A: {
    label: "Día A",
    dia: "lunes",
    items: [
      {
        exId: "press-banca", series: 4, repMin: 6, repMax: 8, rest: 120,
        sugeridoKg: kgDeDiscos(40, 20), paso: 2.27,
        ritmo: "Baja 2 s, sin pausa, sube firme",
        montaje: [
          "Pies firmes en el piso, escápulas juntas y hacia abajo",
          "Glúteos, espalda alta y cabeza pegados al banco",
          "Muñecas rectas sobre los antebrazos",
        ],
        recorrido: "Baja hasta rozar el pecho bajo, sin rebote. Codos a ~45-60° del torso, nunca abiertos a 90°. Sube extendiendo sin bloquear.",
        bien: ["Al fondo los antebrazos quedan verticales", "La barra sube pareja, sin desviarse"],
        corrige: ["Se despegan los glúteos del banco", "Los codos se abren", "Rebotas en el pecho"],
        parada: "Termina la serie si se despegan los glúteos o la barra sube torcida. Sin ayudante, deja 1-2 reps en reserva y usa los topes de seguridad.",
        calent: { tipo: "pct", pasos: [[0.5, 8], [0.75, 4]] },
      },
      {
        exId: "dominadas", series: 3, repMin: 6, repMax: 8, rest: 120,
        sugeridoKg: 12, paso: -2.5,
        ritmo: "Sube firme, baja 2-3 s",
        montaje: [
          "Mismo agarre durante todo el bloque (neutro o supino)",
          "Hombros bajos, sin encogerlos",
          "Pecho alto antes de tirar",
        ],
        recorrido: "Tira del pecho hacia la barra llevando los codos a las costillas. Arriba, la barbilla pasa la barra. Baja hasta casi extender los brazos, sin colgarte pasivo.",
        bien: ["Sientes dorsales y espalda, no solo bíceps", "El cuerpo no se balancea"],
        corrige: ["Los hombros suben a las orejas", "Tiras con el cuello", "Rebotas abajo"],
        parada: "Termina la serie si necesitas balanceo para subir o la barbilla no llega a la barra.",
      },
      {
        exId: "peso-muerto-rumano", series: 3, repMin: 8, repMax: 10, rest: 120,
        sugeridoKg: kgDeDiscos(35, 20), paso: 2.27,
        ritmo: "Baja 2-3 s, sube empujando la cadera",
        montaje: [
          "Pies a ancho de caderas, rodillas apenas flexionadas y fijas",
          "Espalda neutra, pecho alto",
          "Barra pegada a los muslos",
        ],
        recorrido: "Lleva las caderas hacia atrás, como cerrando una puerta con el glúteo. La barra baja rozando muslos y rodillas hasta debajo de la rodilla. Para cuando sientas el estiramiento atrás del muslo. Sube empujando la cadera hacia delante y aprieta el glúteo arriba, sin arquear la lumbar.",
        bien: ["La tensión está en glúteos e isquios, no en la espalda baja", "La barra no se despega de las piernas"],
        corrige: ["Las rodillas se doblan más al bajar", "La barra se aleja de las piernas", "La espalda se redondea (ya bajaste demasiado)"],
        parada: "Termina la serie en cuanto la espalda se redondee o la barra se despegue de las piernas.",
      },
      {
        exId: "prensa", series: 3, repMin: 10, repMax: 12, rest: 120,
        sugeridoKg: kgDeDiscos(155, 0), paso: 2.27,
        ritmo: "Baja 2 s, sin rebote, sube 1 s",
        montaje: [
          "Pies altos y separados en la plataforma",
          "Espalda y pelvis pegadas al respaldo",
          "Rodillas alineadas con la punta de los pies",
        ],
        recorrido: "Baja hasta ~90° de rodilla, con los muslos casi paralelos a la plataforma; es el punto de parada, no una meta de profundidad. Extiende casi del todo, dejando 5-10° de flexión (sin bloquear).",
        bien: ["Sientes glúteo y cuádriceps", "Las rodillas siguen la línea de los pies"],
        corrige: ["La pelvis se levanta del respaldo", "Las rodillas colapsan hacia dentro", "La espalda baja se despega"],
        parada: "Para antes de la profundidad si la pelvis se despega. Si las primeras series salen muy duras, baja ~15 lb de discos. Si duele la rodilla, acorta hasta el rango sin dolor.",
      },
      {
        exId: "elev-lateral", series: 3, repMin: 12, repMax: 15, rest: 60,
        sugeridoKg: 4.5, paso: 1,
        ritmo: "Sube controlado, baja 2-3 s",
        montaje: [
          "Torso apenas inclinado hacia delante, sin balanceo",
          "Codos suavemente flexionados, fijos toda la serie",
          "Hombros abajo, lejos de las orejas",
        ],
        recorrido: "Sube los brazos hacia los lados, como abriendo alas, hasta la altura del hombro, paralelos al suelo. El codo va un poco más alto que la mano, como vertiendo una jarra por el lado del meñique. Baja despacio hasta los costados de los muslos.",
        bien: ["Ardor en el costado del hombro, no en el cuello", "Solo se mueven los brazos", "Terminas con 1-2 reps en reserva"],
        corrige: ["Sientes el cuello o el trapecio: baja el peso", "Te balanceas con la cadera: baja el peso", "Subes por encima del hombro: corta ahí", "Bajas de golpe"],
        parada: "Termina la serie en cuanto necesites impulso de cadera o el trapecio tome el trabajo.",
      },
    ],
  },
  B: {
    label: "Día B",
    dia: "viernes",
    items: [
      {
        exId: "dip-asistido", series: 4, repMin: 6, repMax: 8, rest: 120,
        sugeridoKg: 12, paso: -2.5,
        ritmo: "Baja 2 s, sube firme",
        montaje: [
          "Torso vertical, codos hacia atrás y pegados al cuerpo",
          "Hombros abajo y atrás",
          "Primer ejercicio del día: llegas fresco",
        ],
        recorrido: "Baja hasta ~90° de codo, con los hombros a la altura de los codos, no más abajo. Sube hasta extender casi del todo, sin bloquear.",
        bien: ["Sientes tríceps y pecho bajo", "Sin presión en la parte delantera del hombro"],
        corrige: ["Los hombros suben a las orejas", "Los codos se abren", "Te balanceas"],
        parada: "Termina la serie si te balanceas o duele el hombro; en ese caso corta la profundidad.",
        calent: { tipo: "asist", pasos: [[10, 5], [5, 5]] },
      },
      {
        exId: "press-banca-b", series: 3, repMin: 8, repMax: 10, rest: 120,
        sugeridoKg: kgDeDiscos(30, 20), paso: 2.27,
        ritmo: "Baja 2 s, pausa de 1 s tocando el pecho, sube sin impulso",
        montaje: [
          "Pies firmes en el piso, escápulas juntas y hacia abajo",
          "Glúteos, espalda alta y cabeza pegados al banco",
          "Muñecas rectas sobre los antebrazos",
        ],
        recorrido: "Igual que el Día A, pero con pausa de 1 s con la barra tocando el pecho, sin rebote. Codos a ~45-60° del torso.",
        bien: ["Subes sin impulso tras la pausa", "Las 3 series salen con técnica limpia"],
        corrige: ["Rebotas en el pecho", "Se despegan los glúteos", "Los codos se abren"],
        parada: "Termina la serie si ya no puedes pausar 1 s o se despegan los glúteos.",
      },
      {
        exId: "remo-polea", series: 3, repMin: 10, repMax: 12, rest: 75,
        sugeridoKg: 29.48, paso: 2.27,
        ritmo: "Tira, aprieta 1 s, vuelve en 2 s",
        montaje: [
          "Pecho alto, espalda neutra",
          "Rodillas ligeramente flexionadas",
          "Brazos estirados sin redondear la espalda",
        ],
        recorrido: "Tira hacia el ombligo con los codos rozando las costillas. Aprieta las escápulas 1 s y vuelve en 2 s hasta estirar los brazos.",
        bien: ["Sientes espalda media y dorsales", "El torso casi no se mueve"],
        corrige: ["Te inclinas atrás para ayudar", "Encoges los hombros", "Solo trabajas bíceps"],
        parada: "Termina la serie si tienes que inclinarte hacia atrás para completar la rep.",
      },
      {
        exId: "hip-thrust-kb", series: 3, repMin: 10, repMax: 15, rest: 75,
        sugeridoKg: 31.75, paso: null,
        progTexto: "Con 15 reps en las 3 series: agrega pausa de 2 s arriba. Cuando eso sea cómodo, pasa a una pierna con una kettlebell de 35 lb, 3×8-12 por lado. Para una semana de poca energía: 25 + 25 lb.",
        ritmo: "Sube firme, aprieta 1-2 s arriba, baja controlado",
        montaje: [
          "Parte baja de las escápulas apoyada en el borde del banco (contra una pared para que no se mueva)",
          "Una kettlebell a cada lado del pliegue de la cadera, cada una sujeta con una mano, asa hacia fuera",
          "Pies a ancho de caderas, talones plantados",
        ],
        recorrido: "Sube hasta que el torso quede recto y las tibias verticales. Mentón recogido, costillas abajo. Aprieta 1-2 s arriba y baja controlado.",
        bien: ["Sientes el glúteo, no la espalda baja", "Las kettlebells no ruedan"],
        corrige: ["Arqueas la lumbar arriba", "Sientes más cuádriceps: acerca los pies", "Sientes más isquios: aleja los pies"],
        parada: "Termina la serie si arqueas la lumbar para completar la rep.",
      },
      {
        exId: "ext-triceps", series: 3, repMin: 10, repMax: 12, rest: 75,
        sugeridoKg: 29.48, paso: 2.27,
        ritmo: "Extiende, aprieta, vuelve en 2 s",
        montaje: [
          "Codos pegados a los costados y fijos",
          "Torso quieto, sin inclinarlo para empujar",
        ],
        recorrido: "Extiende hasta casi bloquear, abriendo un poco la cuerda al final. Vuelve en 2 s hasta ~90° de codo.",
        bien: ["Solo se mueven los antebrazos", "Las muñecas se mantienen rectas"],
        corrige: ["Los codos se adelantan", "El torso se inclina para empujar", "Pasas de 12 reps con facilidad: sube 5 lb"],
        parada: "Termina la serie si los codos se adelantan o el torso empieza a empujar.",
      },
      {
        exId: "ext-cuadriceps", series: 2, repMin: 12, repMax: 15, rest: 75,
        sugeridoKg: 49.9, paso: 2.27,
        ritmo: "Sube, pausa 1 s apretando, baja 2-3 s",
        montaje: [
          "Respaldo ajustado: rodilla alineada con el eje de la máquina",
          "Almohadilla en la parte baja de la espinilla",
          "Caderas pegadas al asiento",
        ],
        recorrido: "Extiende casi del todo, pausa de 1 s apretando el cuádriceps, y baja en 2-3 s hasta ~90°.",
        bien: ["Movimiento suave, sin golpe arriba ni balanceo"],
        corrige: ["Levantas las caderas del asiento", "Bloqueas con un golpe arriba", "Sientes molestia en la rodilla: acorta el rango"],
        parada: "Termina la serie si se levantan las caderas o aparece molestia en la rodilla.",
      },
      {
        exId: "elev-piernas-banco", series: 3, repMin: 10, repMax: 15, rest: 60,
        sugeridoKg: null, paso: null,
        progTexto: "Con 15 reps en las 3 series, agrega carga (por ejemplo una mancuerna chica entre los pies).",
        ritmo: "Sube controlado, baja sin tocar el banco",
        montaje: [
          "Acostado, manos sujetando el banco detrás de la cabeza",
          "Espalda baja pegada al banco",
        ],
        recorrido: "Sube las piernas juntas hasta que la pelvis se despegue levemente. Baja controlado sin arquear la lumbar.",
        bien: ["Sientes el abdomen bajo", "La lumbar sigue pegada al banco"],
        corrige: ["La lumbar se arquea: flexiona las rodillas o acorta el rango", "Solo sientes el frente de la cadera"],
        parada: "Termina la serie si la lumbar se despega del banco.",
      },
    ],
  },
};

// Qué día sugiere cada día de la semana (0=domingo): lunes A; martes a viernes B;
// sábado y domingo A (el próximo lunes). Es solo la pestaña inicial; se puede elegir a mano.
export function diaSugerido(date = new Date()) {
  const d = date.getDay();
  if (d === 1) return "A";
  if (d >= 2 && d <= 5) return "B";
  return "A";
}

// ── Último día de la rutina hecho (A o B) ─────────────────────────────────
// Cada ejercicio pertenece a un solo día, así que el día se infiere de las series
// marcadas en `ejercicioLog` (solo lectura, no se guarda nada). Cuentan las fechas
// desde RUTINA_DESDE: los registros del ciclo anterior no se pueden clasificar como A o B.
export const DIA_DE = Object.fromEntries(
  Object.entries(RUTINA).flatMap(([dia, d]) => d.items.map((i) => [i.exId, dia]))
);

// `isDone(valor)` decide si una serie está hecha (mismo criterio que la vista de sesión).
// En una fecha con series de ambos días gana el que tenga más series hechas (empate: A).
// Devuelve {dia, fecha} o null si aún no hay registros de la rutina nueva.
export function ultimoDiaRutina(log, isDone) {
  const fechas = Object.keys(log || {}).filter((k) => k >= RUTINA_DESDE).sort().reverse();
  for (const fecha of fechas) {
    const n = { A: 0, B: 0 };
    for (const [k, v] of Object.entries(log[fecha] || {})) {
      const m = k.match(/^(.*)_(\d+)$/);
      const dia = m && DIA_DE[m[1]];
      if (dia && isDone(v)) n[dia]++;
    }
    if (n.A || n.B) return { dia: n.A >= n.B ? "A" : "B", fecha };
  }
  return null;
}

const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const partes = (key) => key.split("-").map(Number); // "2026-10-05" -> [2026, 10, 5]
export function fechaCorta(key) {
  const [y, m, d] = partes(key);
  return `${DIAS_CORTOS[new Date(y, m - 1, d).getDay()]} ${d}-${MESES_CORTOS[m - 1]}`;
}
export function haceTexto(key, hoyKey) {
  const [y, m, d] = partes(key), [y2, m2, d2] = partes(hoyKey);
  const n = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y, m - 1, d)) / 86400000);
  return n <= 0 ? "hoy" : n === 1 ? "ayer" : `hace ${n} días`;
}
