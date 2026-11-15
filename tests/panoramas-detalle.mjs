// Lectura limpia del detalle de un evento (modules/feed/scripts/lib/panoramas-detalle.mjs).
// Cloudflare /markdown entrega la página entera; el limpiador debe dejar solo el texto del evento.
import assert from "node:assert/strict";
import { leerMarkdown, textoDeHtml, pedirMarkdown, pideInscripcion, MAX_DETALLE } from "../modules/feed/scripts/lib/panoramas-detalle.mjs";

const PAGINA = `
[Saltar al contenido](#main)

* [Inicio](/)
* [Exposiciones](/exposiciones)
* [Actividades](/actividades)
* [Contacto](/contacto)

Usamos cookies para mejorar tu experiencia en el sitio.

# Mariposas y Polillas, Colores en Movimiento

![portada](https://x.cl/img.jpg)

Del 24 abril 2025 al 3 enero 2027

Una exposición que recorre la diversidad de mariposas y polillas de Chile, desde sus ciclos de vida hasta el papel que cumplen en los ecosistemas, con ejemplares de la colección del museo.

La muestra invita a mirar de cerca los colores y las formas de estos insectos, y a entender por qué su presencia habla de la salud de un territorio.

[Compartir en Facebook](https://fb.com) [Compartir en X](https://x.com)

## Eventos relacionados

[Otra exposición](/otra) [Más actividades](/mas)

© 2026 Museo Nacional de Historia Natural. Todos los derechos reservados.
`;

// 1. Deja la descripción y nada del menú, las cookies, los botones ni el pie
{
  const t = leerMarkdown(PAGINA, "Mariposas y Polillas, Colores en Movimiento");
  assert(t.startsWith("Una exposición que recorre"), "empieza en la descripción, no en el menú");
  assert(t.includes("salud de un territorio"), "conserva el segundo párrafo");
  for (const ruido of ["cookies", "Inicio", "Compartir", "Todos los derechos", "Otra exposición", "https://", "!["]) assert(!t.includes(ruido), `no debe quedar "${ruido}"`);
  assert.equal(t.split("\n\n").length, 2, "dos párrafos");
}

// 2. Quita el marcado: enlaces → su texto, énfasis, encabezados
{
  const t = leerMarkdown("# Título del evento\n\nSe presenta **la banda** en el [teatro del barrio](https://t.cl), con entrada liberada y cupos limitados para todos.", "Título del evento");
  assert.equal(t, "Se presenta la banda en el teatro del barrio, con entrada liberada y cupos limitados para todos.", "texto plano");
  assert(!t.includes("**") && !t.includes("]("), "sin marcado");
}

// 3. Sin texto útil → "" (la app cae al enlace "ver original")
assert.equal(leerMarkdown("", "x"), "");
assert.equal(leerMarkdown("# Algo\n\n[a](/a) [b](/b) [c](/c)\n\nCorto.", "Algo"), "");
assert.equal(leerMarkdown(null, "x"), "");

// 4. Sin el título en la página: exige bloques largos (no cuela menús sueltos)
{
  const t = leerMarkdown("Inicio Nosotros Contacto Prensa\n\nUna descripción larga y real del evento, con varias frases, que cuenta de qué se trata la actividad y a quién va dirigida.", "Título que no aparece");
  assert(!t.includes("Nosotros") && t.includes("descripción larga"), "descarta el menú y conserva la prosa");
}

// 5. Tope de largo, cortando en límite de frase
{
  const largo = Array.from({ length: 80 }, (_, i) => `Párrafo número ${i} del evento, con texto suficiente para contar como contenido real de la página.`).join("\n\n");
  const t = leerMarkdown("# E\n\n" + largo, "E");
  assert(t.length <= MAX_DETALLE + 1, `largo ${t.length} ≤ ${MAX_DETALLE}`);
  assert(t.endsWith("…") || t.endsWith("."), "corta limpio");
}

// 6. Resumen de WordPress → texto plano
assert.equal(textoDeHtml("<p>corto</p>"), "");
assert(textoDeHtml("<p>" + "Descripción del evento en La Moneda. ".repeat(4) + "&hellip;</p>").startsWith("Descripción del evento"));

// 7. Cloudflare: éxito, permiso (fatal), límite (fatal), error suelto, timeout
{
  const fake = (status, body) => async () => ({ status, ok: status >= 200 && status < 300, json: async () => body });
  const cfg = { cuenta: "acc", token: "tok" };
  assert.deepEqual(await pedirMarkdown("https://x.cl", { ...cfg, fetchFn: fake(200, { success: true, result: "# md" }) }), { ok: true, markdown: "# md" });
  const r403 = await pedirMarkdown("https://x.cl", { ...cfg, fetchFn: fake(403, {}) });
  assert(!r403.ok && r403.fatal && /Browser Rendering/.test(r403.motivo), "403 = fatal con motivo claro");
  assert((await pedirMarkdown("https://x.cl", { ...cfg, fetchFn: fake(429, {}) })).fatal, "429 = fatal");
  const r500 = await pedirMarkdown("https://x.cl", { ...cfg, fetchFn: fake(500, {}) });
  assert(!r500.ok && !r500.fatal, "500 no corta el resto");
  assert(!(await pedirMarkdown("https://x.cl", { ...cfg, fetchFn: fake(200, { success: true }) })).ok, "sin result = falla");
  let visto; await pedirMarkdown("https://x.cl/e", { ...cfg, fetchFn: async (u, o) => { visto = { u, o }; return { status: 200, ok: true, json: async () => ({ result: "m" }) }; } });
  assert(visto.u.endsWith("/accounts/acc/browser-rendering/markdown"), "endpoint /markdown de la cuenta");
  assert.equal(visto.o.headers.Authorization, "Bearer tok");
  assert.equal(JSON.parse(visto.o.body).url, "https://x.cl/e");
}
// 8. Inscripción previa leída del texto (con negaciones; casos reales de panoramas.json)
assert.equal(pideInscripcion("Modera: Juvenal Barría.  Actividad gratuita, no requiere inscripción previa."), false, "CCLM: NO requiere (no es un sí)");
assert.equal(pideInscripcion("Los/as interesados/as en asistir a la inauguración deben inscribirse en el formulario adjunto abajo."), true, "Museos: deben inscribirse");
assert.equal(pideInscripcion("Taller con inscripción previa en el sitio web."), true);
assert.equal(pideInscripcion("Requiere inscripción previa. Cupos limitados."), true);
assert.equal(pideInscripcion("Entrada liberada, sin inscripción."), false);
assert.equal(pideInscripcion("Es necesaria la inscripción previa."), true);
assert.equal(pideInscripcion("Inscríbete aquí para participar."), true);
assert.equal(pideInscripcion("Se recomienda reserva previa para grupos."), null, "recomendación ≠ requisito");
assert.equal(pideInscripcion("Una exposición sobre la inscripción de los nombres en la piedra."), null, "palabra suelta, sin pedirla");
assert.equal(pideInscripcion("No requiere inscripción. Los niños deben inscribirse en el taller aparte."), true, "un sí en otra oración gana a un no");
assert.equal(pideInscripcion("No olvides la inscripción previa antes del viernes."), true, "\"no olvides\" no es una negación");
assert.equal(pideInscripcion("Sin necesidad de inscripción previa."), false);
assert.equal(pideInscripcion(""), null);
assert.equal(pideInscripcion(null), null);
console.log("OK panoramas-detalle");
