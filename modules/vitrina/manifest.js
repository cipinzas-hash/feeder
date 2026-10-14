export default {
  id: "vitrina",
  tabLabel: "Vitrina",
  // `state: {}` es correcto pero engañoso: Vitrina no usa React state de
  // AngstApp, persiste en sus propias claves de localStorage Y TODAS viajan en
  // el export (💾 / 📤): el mapa campo -> clave es LOCAL_KEY_FIELDS en
  // core/persistence.js (cine-estado, microdocs/conciertos/podcasts/VOD vistos,
  // podcast-positions, series-overlay, dispatched). Excepciones deliberadas, con
  // su motivo: EXPORT_EXEMPT_KEYS (angst-simkl-pending-v1, secretos, cachés).
  // tests/export-coverage.mjs falla si se agrega una clave sin declararla.
  // Guardar un ítem desde Vitrina escribe al Buzón de Feed (shared/buzon.js).
  state: {},
};
