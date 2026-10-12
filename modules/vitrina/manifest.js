export default {
  id: "vitrina",
  tabLabel: "Vitrina",
  // Sin campos en el payload central: igual que Feed, persiste solo con sus
  // propias keys de localStorage (angst-cine-estado-v1, angst-simkl-*,
  // angst-feed-microdocs-vistos-v1, angst-feed-conciertos-vistos-v1,
  // angst-feed-podcasts-escuchados-v1, angst-feed-melee-vod-vistos-v1).
  // Guardar un ítem desde Vitrina escribe al Buzón de Feed (shared/buzon.js).
  state: {},
};
