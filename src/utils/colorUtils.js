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
 * Get the appropriate text color (black or white) based on background color
 */
export function getContrastTextColor(backgroundColor) {
  return isLightColor(backgroundColor) ? '#000000' : '#ffffff'
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
