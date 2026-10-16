/**
 * Convert hex color to RGB values
 */
export function hexToRgb(hex) {
  // Remove # if present
  hex = hex.replace('#', '')

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  return { r, g, b }
}

/**
 * Calculate relative luminance of a color
 * Based on WCAG guidelines
 */
export function getLuminance(r, g, b) {
  // Normalize RGB values
  const [rs, gs, bs] = [r, g, b].map(val => {
    val = val / 255
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  })

  // Calculate luminance
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

/**
 * Determine if a color is light or dark
 * Returns true if the color is light (needs dark text)
 */
export function isLightColor(hexColor) {
  const { r, g, b } = hexToRgb(hexColor)
  const luminance = getLuminance(r, g, b)

  // Threshold of 0.5 - colors with luminance > 0.5 are considered light
  return luminance > 0.5
}

/**
 * Is this color very dark (near-black / dark navy / dark maroon)?
 * Used to decide when a team logo sitting ON this color needs a white
 * plate behind it — a black-on-black logo otherwise vanishes. Threshold is
 * low (0.12) so only genuinely dark team colors trigger it; mid-tone team
 * colors (green, red, blue) leave logos plate-free.
 */
export function isDarkColor(hexColor, threshold = 0.12) {
  if (!hexColor || typeof hexColor !== 'string' || !hexColor.match(/^#[0-9A-Fa-f]{6}$/)) {
    return false
  }
  const { r, g, b } = hexToRgb(hexColor)
  return getLuminance(r, g, b) < threshold
}

/**
 * Get the appropriate text color based on a background color.
 *
 * Default: black on light backgrounds, white on dark ones (max legibility).
 * Optional: pass the team's secondary color — on a LIGHT primary, a pure-black
 * label reads stark/off-brand (black on Michigan's maize), so if the secondary
 * contrasts cleanly with the background (e.g. Michigan navy on maize) we prefer
 * it. A contrast-ratio guard (>= 4.5) means the swap never hurts legibility;
 * otherwise it falls back to black. Dark backgrounds always keep white text.
 */
export function getContrastTextColor(backgroundColor, secondaryColor = null) {
  // Handle undefined/null/invalid colors - default to black text
  if (!backgroundColor || typeof backgroundColor !== 'string' || !backgroundColor.match(/^#[0-9A-Fa-f]{6}$/)) {
    return '#000000'
  }
  const baseChoice = isLightColor(backgroundColor) ? '#000000' : '#ffffff'
  if (baseChoice === '#000000' && secondaryColor && /^#[0-9A-Fa-f]{6}$/.test(secondaryColor)) {
    if (getContrastRatio(backgroundColor, secondaryColor) >= 4.5) {
      return secondaryColor
    }
  }
  return baseChoice
}

/**
 * A team's secondary color as text on its primary — unless the pair is
 * unreadable (e.g. Tulane's light blue on its dark green, ~2:1), in which
 * case fall back to black/white via getContrastTextColor. `min` defaults to
 * 3:1, the floor for bold UI text; most real team pairings clear it and keep
 * their two-tone look.
 */
export function readableTextOn(backgroundColor, preferredColor, min = 3) {
  const hex = /^#[0-9A-Fa-f]{6}$/
  if (!hex.test(backgroundColor || '')) return preferredColor || '#ffffff'
  if (hex.test(preferredColor || '') && getContrastRatio(backgroundColor, preferredColor) >= min) {
    return preferredColor
  }
  return getContrastTextColor(backgroundColor)
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1, color2) {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)

  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b)
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b)

  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)

  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Mix two colors together
 * @param {string} color1 - First hex color
 * @param {string} color2 - Second hex color
 * @param {number} ratio - Mix ratio (0 = all color1, 1 = all color2)
 */
export function mixColors(color1, color2, ratio) {
  const rgb1 = hexToRgb(color1)
  const rgb2 = hexToRgb(color2)

  const r = Math.round(rgb1.r * (1 - ratio) + rgb2.r * ratio)
  const g = Math.round(rgb1.g * (1 - ratio) + rgb2.g * ratio)
  const b = Math.round(rgb1.b * (1 - ratio) + rgb2.b * ratio)

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * Get a dark modal background color based on team colors
 * If secondary is light, creates a dark tinted background using primary color
 * If secondary is already dark, uses it directly
 * @param {Object} teamColors - Object with primary and secondary colors
 * @returns {Object} Modal colors { background, text, accent, border, headerBg }
 */
export function getModalColors(teamColors) {
  // Modal chrome is neutral — the same surface/border/text values as the
  // design tokens in index.css (as hex, because callers append alpha suffixes
  // like `${accent}20`). It used to tint every modal's background, border and
  // inputs with the team's colors, so each modal looked slightly different
  // from the shared Modal/sheet modals and from team to team. Team color now
  // only shows up where it carries meaning: `accent` (primary actions and
  // selected states).
  const primary = teamColors?.primary || '#374151'
  return {
    background: '#242730',  // --surface-2
    headerBg: '#2f323c',    // --surface-3
    text: '#f5f5f7',        // --text-primary
    textMuted: '#a4a5af',   // --text-tertiary
    accent: primary,
    border: '#3b3e49',      // --surface-4
    inputBg: '#191b22',     // --surface-1
    inputBorder: '#3b3e49', // --surface-4
  }
}
