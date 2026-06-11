import { useState, useEffect } from 'react'

/**
 * Progressive image for a full-screen photo lightbox. The full-res wsrv
 * re-encode can take a couple seconds; rather than showing nothing, we paint a
 * low-quality version blurred underneath with a spinner, then crossfade the
 * full-res copy in on load.
 *
 * The low-res `<img>` defines the layout box, so it must carry full-size
 * intrinsic dimensions (a large `w=` at a tiny `q=`) — otherwise the box
 * collapses to the placeholder's size and the full-res overlay shrinks with
 * it. The low quality is invisible behind the blur, and the small file lands
 * fast. The full-res copy is absolutely positioned to fill the box and fades
 * from 0→1 opacity when it finishes loading.
 *
 * Shared by the Game page Photos lightbox and the Player page Photos lightbox.
 */
export default function ProgressiveLightboxImage({ currentUrl, alt = '', maxHeight }) {
  const lowSrc = `https://wsrv.nl/?url=${encodeURIComponent(currentUrl)}&w=1600&output=webp&q=30`
  const highSrc = `https://wsrv.nl/?url=${encodeURIComponent(currentUrl)}&output=webp&q=92`
  const [loaded, setLoaded] = useState(false)
  // Reset to the blurred placeholder whenever we step to a new photo.
  useEffect(() => { setLoaded(false) }, [currentUrl])

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* Low-res placeholder — blurred, scaled slightly to hide blur fringe */}
      <img
        src={lowSrc}
        alt={alt}
        className="block select-none"
        style={{
          maxWidth: '100%',
          maxHeight,
          objectFit: 'contain',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.6)',
          filter: loaded ? 'none' : 'blur(14px)',
          transform: loaded ? 'none' : 'scale(1.03)',
          transition: 'filter 350ms ease, transform 350ms ease',
        }}
        draggable={false}
      />
      {/* Full-res copy — fills the placeholder box, fades in once decoded */}
      <img
        src={highSrc}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full select-none"
        style={{
          objectFit: 'contain',
          opacity: loaded ? 1 : 0,
          transition: 'opacity 350ms ease',
        }}
        onLoad={() => setLoaded(true)}
        onError={(e) => { if (e.currentTarget.src !== currentUrl) e.currentTarget.src = currentUrl }}
        draggable={false}
      />
      {/* Spinner over the blurred placeholder until the full-res arrives */}
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <svg className="animate-spin" width="44" height="44" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
            <path d="M22 12a10 10 0 0 0-10-10" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  )
}
