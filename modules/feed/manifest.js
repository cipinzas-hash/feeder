export default {
  id: "feed",
  tabLabel: "Feed",
  // `state: {}`: Feed no usa React state de AngstApp, persiste en sus propias
  // claves de localStorage (angst-feed-proto-v1 y las de vistos/escuchados), pero
  // SÍ viaja en el export (💾 / 📤) y SÍ se restaura: ver LOCAL_KEY_FIELDS en
  // core/persistence.js. (Un comentario anterior decía "no necesita
  // export/restore": era falso desde que existe el backup completo.)
  state: {},
};
