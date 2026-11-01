export default {
  id: "musica",
  tabLabel: "Música",
  // Sin estado persistente: el módulo solo lee musica.json (lo arma build-musica.mjs) y
  // mantiene en memoria el lanzamiento y el artista abiertos. No agrega claves de
  // localStorage, así que no toca core/persistence.js ni tests/export-coverage.mjs.
  state: {},
};
