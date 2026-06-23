import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { proxyImageUrl } from '../utils/imageProxy'
import { getCardStyle } from '../data/cardStyles'

// Render width for the enlarged card face — high enough to stay crisp at full
// screen while gaining wsrv's resilience (server-side fetch + cache) against a
// host dropping/placeholdering an image.
const CARD_W = 1600
// Lighter width for the in-grid thumbnail (it only renders a few hundred px).
const THUMB_W = 800

// Treat a face as missing once the browser reports a load error, so a dead
// host URL doesn't show a "Service unavailable" placeholder tile.
function ImageWithFallback({ src, onError, ...rest }) {
  return <img src={src} onError={onError} {...rest} />
}

/**
 * FlippableCard — a trading-card preview used wherever a prompt-driven card
 * needs to show its faces (player profile, Game page Cards tab, Card Collection).
 *
 * Interaction:
 *   • In the grid it shows the front (or only available) face.
 *   • Clicking it opens an enlarged overlay with a pop-in animation.
 *   • While enlarged, clicking the card flips front/back (when both faces
 *     exist). Clicking the backdrop (or Esc) collapses it back to the grid.
 *
 * Aspect ratio comes from the card style (oversized sets are taller than the
 * standard 5:7), falling back to 5:7 when unknown. Fills its container width.
 */
export default function FlippableCard({ frontImageUrl, backImageUrl, styleId, className = '' }) {
  const [flipped, setFlipped] = useState(false)
  const [expanded, setExpanded] = useState(false) // overlay mounted
  const [shown, setShown] = useState(false)        // drives the open/close transition
  const [frontBroken, setFrontBroken] = useState(false)
  const [backBroken, setBackBroken] = useState(false)
  const closeTimer = useRef(null)

  const aspectRatio = getCardStyle(styleId)?.aspectRatio || '5 / 7'
  const hasFront = !!frontImageUrl && !frontBroken
  const hasBack = !!backImageUrl && !backBroken
  const canFlip = hasFront && hasBack

  const open = useCallback(() => {
    if (!hasFront && !hasBack) return
    setFlipped(false)
    setExpanded(true)
  }, [hasFront, hasBack])

  const close = useCallback(() => {
    setShown(false)
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setExpanded(false), 220)
  }, [])

  // Kick off the pop-in once the overlay has mounted (next frame).
  useEffect(() => {
    if (!expanded) return
    const raf = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(raf)
  }, [expanded])

  // Esc closes; lock background scroll while the overlay is open.
  useEffect(() => {
    if (!expanded) return
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [expanded, close])

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  if (!hasFront && !hasBack) {
    return (
      <div
        className={`rounded-xl flex items-center justify-center text-xs text-txt-tertiary ${className}`}
        style={{
          width: '100%',
          aspectRatio,
          backgroundColor: 'var(--surface-2)',
          border: '1px dashed var(--surface-4)',
        }}
      >
        No images yet
      </div>
    )
  }

  const collapsedUrl = hasFront ? frontImageUrl : backImageUrl
  const markCollapsedBroken = () => (hasFront ? setFrontBroken(true) : setBackBroken(true))

  // In-grid thumbnail. Click opens the enlarged overlay.
  const collapsed = (
    <button
      type="button"
      onClick={open}
      className={`w-full block rounded-xl overflow-hidden shadow-2xl ${className}`}
      style={{ aspectRatio, cursor: 'zoom-in' }}
      title="Click to view"
    >
      <ImageWithFallback
        src={proxyImageUrl(collapsedUrl, THUMB_W)}
        alt=""
        className="w-full h-full object-cover"
        onError={markCollapsedBroken}
      />
    </button>
  )

  const faceShadow = '0 30px 70px rgba(0, 0, 0, 0.7)'

  const overlay = expanded
    ? createPortal(
        <div
          onClick={close}
          className="fixed inset-0 top-0 left-0 right-0 bottom-0 flex items-center justify-center z-[9999] p-4"
          style={{
            margin: 0,
            background: `rgba(0, 0, 0, ${shown ? 0.82 : 0})`,
            transition: 'background 220ms ease',
            cursor: 'zoom-out',
          }}
        >
          <div
            onClick={(e) => { e.stopPropagation(); if (canFlip) setFlipped(f => !f) }}
            title={canFlip ? 'Click to flip' : ''}
            style={{
              aspectRatio,
              width: 'min(92vw, 62vh)',
              maxHeight: '88vh',
              perspective: '1600px',
              cursor: canFlip ? 'pointer' : 'default',
              transform: shown ? 'scale(1)' : 'scale(0.88)',
              opacity: shown ? 1 : 0,
              transition: 'transform 240ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease',
            }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                transformStyle: 'preserve-3d',
                transition: 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1)',
                transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
              }}
            >
              {/* Front (or the only available) face */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  borderRadius: 14,
                  overflow: 'hidden',
                  boxShadow: faceShadow,
                }}
              >
                <ImageWithFallback
                  src={proxyImageUrl(hasFront ? frontImageUrl : backImageUrl, CARD_W)}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => (hasFront ? setFrontBroken(true) : setBackBroken(true))}
                />
              </div>
              {/* Back face — pre-rotated; only present when both faces exist. */}
              {canFlip && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backfaceVisibility: 'hidden',
                    WebkitBackfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    borderRadius: 14,
                    overflow: 'hidden',
                    boxShadow: faceShadow,
                  }}
                >
                  <ImageWithFallback
                    src={proxyImageUrl(backImageUrl, CARD_W)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={() => setBackBroken(true)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      {collapsed}
      {overlay}
    </>
  )
}
