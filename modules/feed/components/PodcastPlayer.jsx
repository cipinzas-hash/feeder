/*
 * Angst podcast player — first media consumer: Meta Pod.
 *
 * The player is deliberately source-agnostic: it receives a media item with
 * audioUrl + artwork, so the same UI can later consume other novelty sources.
 * A future core integration can keep this component mounted while FeedPage
 * changes screens.
 */

export function PodcastPlayer({ item, onClose }) {
  if (!item?.audioUrl) return null;

  return (
    <div className="angst-podcast-player" role="region" aria-label="Reproductor de podcast">
      <img
        className="angst-podcast-player__artwork"
        src={item.artwork || item.image || ""}
        alt=""
      />
      <div className="angst-podcast-player__meta">
        <div className="angst-podcast-player__source">{item.source || "PODCAST"}</div>
        <div className="angst-podcast-player__title">{item.title}</div>
        <audio controls preload="metadata" src={item.audioUrl} />
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Cerrar reproductor">×</button>
      )}
    </div>
  );
}

export function normalizePodcastItem(item) {
  if (!item) return null;
  return {
    id: item.guid || item.link || item.title,
    source: item.source || "Podcast",
    title: item.title || "Sin título",
    audioUrl: item.audioUrl || null,
    artwork: item.artwork || item.image || null,
    image: item.image || null,
    pubDate: item.pubDate || null,
    link: item.link || null,
    categoria: item.categoria || "Podcasts",
  };
}
