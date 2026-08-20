/* Meta Pod novelty banner. Visual language is intentionally close to the
 * existing eSports/event banners: strong identity, compact metadata and one
 * clear action. */

export function MetaPodBanner({ episode, onListen }) {
  if (!episode) return null;

  return (
    <section className="angst-metapod-banner" aria-label="Nuevo episodio de Meta Pod">
      <div className="angst-metapod-banner__identity">
        {episode.artwork || episode.image ? (
          <img
            src={episode.artwork || episode.image}
            alt="Meta Pod"
            className="angst-metapod-banner__logo"
          />
        ) : (
          <div className="angst-metapod-banner__logo angst-metapod-banner__logo--fallback">META POD</div>
        )}
      </div>
      <div className="angst-metapod-banner__copy">
        <div className="angst-metapod-banner__eyebrow">POKÉMON TCG · PODCAST</div>
        <h2>META POD</h2>
        <p>NUEVO EPISODIO DISPONIBLE</p>
        <strong>{episode.title}</strong>
      </div>
      <button type="button" onClick={() => onListen?.(episode)}>
        ▶ ESCUCHAR
      </button>
    </section>
  );
}
