// Helpers de detección de embeds (YouTube/Bandcamp/SoundCloud) -- viven acá para
// que los use tanto build-feed.mjs como el worker de extracción sin duplicarlos.
const LISTEN_EMBED_RE = /(youtube\.com\/(embed|watch)|youtu\.be\/|bandcamp\.com\/(track|album|embeddedplayer)|soundcloud\.com|open\.spotify\.com)/i;

export function hasListenEmbed(rawHtml) {
  return LISTEN_EMBED_RE.test(rawHtml || "");
}
// Si el embed ya detectado es de YouTube, se puede sacar el videoId directo del
// HTML sin gastar cuota de búsqueda — y es más preciso: es el video real que
// puso la banda/sello, no un resultado de búsqueda aproximado.
export function extractYoutubeId(rawHtml) {
  if (!rawHtml) return null;
  const m = rawHtml.match(/(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}
// Bandcamp NO tiene oEmbed (confirmado — lo rechaza, 404). Solo se puede reusar
// un embed si el blog YA trae el iframe de EmbeddedPlayer en el HTML crudo; si
// solo hay un link plano a la canción, no hay forma legítima de reconstruirlo
// (la API real de Bandcamp es para sellos/artistas, no para esto).
export function extractBandcampEmbedUrl(rawHtml) {
  if (!rawHtml) return null;
  const m = rawHtml.match(/https?:\/\/bandcamp\.com\/EmbeddedPlayer\/[^"'\s<>]+/i);
  return m ? m[0] : null;
}
// SoundCloud sí tiene oEmbed público real, sin auth — solo hace falta el link
// plano a la canción, la resolución del embed pasa en musicResolved (main()).
export function extractSoundcloudTrackUrl(rawHtml) {
  if (!rawHtml) return null;
  const m = rawHtml.match(/https?:\/\/soundcloud\.com\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+/i);
  return m ? m[0] : null;
}
