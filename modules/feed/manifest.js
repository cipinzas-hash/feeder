export default {
  id: "feed",
  tabLabel: "Feed",
  // Sin campos en el payload de los 24 — este módulo persiste solo, con sus
  // propias keys de localStorage (angst-feed-proto-v1,
  // angst-feed-microdocs-vistos-v1, angst-feed-podcasts-escuchados-v1),
  // separadas del payload central a propósito: no compite con la "regla
  // vital" ni necesita export/restore, y no colisiona con angst-v12.
  state: {},
};
