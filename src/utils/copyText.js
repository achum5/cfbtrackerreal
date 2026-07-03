// Robust "copy text to clipboard" that works across the environments our
// mobile users actually hit — real Safari/Chrome tabs AND the in-app
// browsers (Discord, Instagram, Messages preview, etc.) that many people
// land in when they tap a link to dynastytracker.app.
//
// Why this exists: the old inline pattern was
//     try { await navigator.clipboard.writeText(text) }
//     catch { <opacity:0 textarea> + .select() + execCommand('copy') }
// and it flashed "Copied!" unconditionally. Two failure modes stacked:
//   1. In an in-app WebView the async Clipboard API is often missing or
//      rejects (no clipboard-write permission, or "document is not focused").
//   2. The catch fallback then runs, but WebKit/iOS refuses to copy from a
//      textarea that is opacity:0 / off-screen and ignores `.select()` for
//      clipboard purposes — so nothing lands on the clipboard.
// The button still said "Copied!" because success was never checked. That is
// exactly the "it says Copied but will not paste" report.
//
// Returns a Promise<boolean> that resolves true only when the text actually
// made it onto the clipboard, so callers can show an honest state.

const isIOS = () =>
  typeof navigator !== 'undefined' &&
  (/ip(hone|ad|od)/i.test(navigator.userAgent) ||
    // iPadOS 13+ reports as a Mac; detect the touch-capable variant.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

// Synchronous, execCommand-based copy. Kept iOS-correct: the element must be
// on-screen with a non-zero size, and iOS needs an explicit Range selection
// (it ignores textarea.select() for copy) with the field editable at select
// time. Runs inside the user gesture, so it survives in-app WebViews.
function legacyCopy(value) {
  if (typeof document === 'undefined') return false
  const ta = document.createElement('textarea')
  ta.value = value
  ta.setAttribute('readonly', '')
  // Visually hidden WITHOUT opacity:0 / display:none / off-screen positioning,
  // any of which cause WebKit to skip the copy.
  ta.style.position = 'fixed'
  ta.style.top = '0'
  ta.style.left = '0'
  ta.style.width = '1px'
  ta.style.height = '1px'
  ta.style.padding = '0'
  ta.style.border = 'none'
  ta.style.margin = '0'
  ta.style.fontSize = '16px' // avoids iOS zoom/focus jank
  ta.style.background = 'transparent'
  // Preserve the caller's current selection so we can restore it after.
  const prevSelection = document.getSelection()?.rangeCount
    ? document.getSelection().getRangeAt(0)
    : null
  document.body.appendChild(ta)

  let ok = false
  try {
    if (isIOS()) {
      ta.contentEditable = 'true'
      ta.readOnly = false
      const range = document.createRange()
      range.selectNodeContents(ta)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
      ta.setSelectionRange(0, value.length)
    } else {
      ta.focus()
      ta.select()
    }
    ok = document.execCommand('copy')
  } catch {
    ok = false
  }

  document.body.removeChild(ta)
  if (prevSelection) {
    const sel = document.getSelection()
    sel.removeAllRanges()
    sel.addRange(prevSelection)
  }
  return ok
}

/**
 * Copy `text` to the clipboard.
 * @param {string} text
 * @returns {Promise<boolean>} true only if the copy actually succeeded.
 */
export async function copyTextToClipboard(text) {
  const value = text == null ? '' : String(text)

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch {
      // Fall through: in-app WebView, denied permission, or unfocused doc.
      // The click's transient activation is still live here, so the
      // synchronous execCommand path below can still succeed.
    }
  }

  return legacyCopy(value)
}

export default copyTextToClipboard
