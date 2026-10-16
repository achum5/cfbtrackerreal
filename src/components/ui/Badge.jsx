/**
 * Badge / Pill primitive. Small chip for conference, position, class, rank, result.
 *
 * Variants drive color:
 *   default  — neutral surface-3 bg, text-secondary
 *   accent   — team-primary-faded bg, team-primary text (page accent context)
 *   success  — win / positive
 *   danger   — loss / destructive
 *   warning  — pending / caveat
 *   info     — neutral informational
 *   primary  — emphasis without a status color (raised surface + border)
 *   outline  — transparent bg + surface-5 border + text-secondary
 *   solid    — explicit backgroundColor via `color` prop (for conference chips etc)
 *
 * Size: sm (default) | md
 */
export default function Badge({
  variant = 'default',
  size = 'sm',
  color, // only used by variant="solid"
  textColor,
  className = '',
  children,
  ...rest
}) {
  const sizeClass = size === 'md'
    ? 'text-[11px] px-2 py-1'
    : 'text-[10px] px-1.5 py-0.5'

  const baseClass =
    'inline-flex items-center justify-center font-semibold uppercase tracking-wider rounded-sm tabular-nums leading-none'

  const variantStyles = {
    default: { className: 'bg-surface-3 text-txt-secondary', style: undefined },
    accent: { className: 'text-txt-primary', style: { backgroundColor: 'var(--surface-3)' } },
    // Small (10–11px) bold text, so each fill/text pair clears 4.5:1: white
    // on the stock green was ~2.3:1, so success takes dark text; danger and
    // info deepen one step so white text stays legible.
    success: { className: '', style: { backgroundColor: 'var(--accent-success)', color: '#052e16' } },
    danger: { className: 'text-white', style: { backgroundColor: '#dc2626' } },
    warning: { className: 'text-black', style: { backgroundColor: 'var(--accent-warning)' } },
    info: { className: 'text-white', style: { backgroundColor: '#2563eb' } },
    // Emphasis without a status color (e.g. the Co-Commish role chip).
    primary: { className: 'text-txt-primary', style: { backgroundColor: 'var(--surface-4)', border: '1px solid var(--surface-5)' } },
    outline: { className: 'bg-transparent text-txt-secondary', style: { border: '1px solid var(--surface-5)' } },
    solid: { className: '', style: { backgroundColor: color, color: textColor || '#fff' } },
  }[variant] || { className: 'bg-surface-3 text-txt-secondary' }

  return (
    <span
      className={`${baseClass} ${sizeClass} ${variantStyles.className} ${className}`.trim()}
      style={variantStyles.style}
      {...rest}
    >
      {children}
    </span>
  )
}
