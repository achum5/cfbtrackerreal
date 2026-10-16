/**
 * PageHero primitive — the unified, neutral CFB-27 page header used across the
 * site's league-wide pages (Awards, Bowl History, Standings, Leaders, …).
 *
 * Editorial, not boxed: the title sits on the page background with a hairline
 * rule underneath (or an underline tab strip when `tabs` are passed). Team and
 * player pages keep their team-colored mastheads; every league-wide page uses
 * this plain header so the two kinds of page read differently at a glance.
 * Uppercase bold display title, optional eyebrow, meta, right cluster,
 * actions, and body children (e.g. filters).
 *
 * Props:
 *   title       — string or ReactNode (rendered display-lg if string)
 *   eyebrow     — optional pre-title small label (all-caps)
 *   meta        — optional ReactNode rendered below title
 *   subtitle    — optional sentence-case intro line below the title/meta
 *   right       — optional ReactNode placed on the right (e.g. stat cluster)
 *   actions     — optional ReactNode below right (e.g. action buttons)
 *   children    — renders inside the hero body (below title+meta), e.g. tabs
 *
 * `accentColor` is accepted for backward compatibility and ignored.
 */
export default function PageHero({
  title,
  eyebrow,
  meta,
  subtitle,
  right,
  actions,
  children,
  // Optional docked tab strip rendered flush along the hero's bottom edge —
  // same treatment as the team/player page headers. Pass `tabs` as an array
  // of { key, label }, plus `activeTab` + `onTabChange`.
  tabs,
  activeTab,
  onTabChange,
  className = '',
}) {
  const hasTabs = Array.isArray(tabs) && tabs.length > 0
  return (
    <section className={`mb-6 relative reveal ${className}`.trim()}>
      <div
        className={`relative ${hasTabs ? 'pb-1' : 'pb-5'}`}
        style={hasTabs ? undefined : { borderBottom: '1px solid var(--surface-4)' }}
      >
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 sm:gap-6">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <div className="label-sm text-txt-tertiary mb-2">{eyebrow}</div>
            )}
            {/* Uppercase cascades to node titles (e.g. TitleWithYear) too —
                text-transform inherits, so the year/label read uppercase. */}
            <div className="uppercase">
              {typeof title === 'string' ? (
                <h1 className="display-lg text-txt-primary leading-none m-0 break-words">
                  {title}
                </h1>
              ) : (
                title
              )}
            </div>
            {meta && (
              <div className="mt-2.5 label-sm text-txt-tertiary flex items-center gap-2 flex-wrap normal-case">
                {meta}
              </div>
            )}
            {subtitle && (
              <p className="mt-3 text-sm text-txt-secondary leading-relaxed max-w-2xl">
                {subtitle}
              </p>
            )}
          </div>
          {(right || actions) && (
            <div className="flex flex-col sm:items-end gap-3 flex-shrink-0">
              {right}
              {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
            </div>
          )}
        </div>
        {children && <div className="mt-5">{children}</div>}
      </div>

      {/* Tab nav — an underline strip on the page background, ruled off
          from the content below. */}
      {hasTabs && (
        <div className="relative mt-3" style={{ borderBottom: '1px solid var(--surface-4)' }}>
          <div className="flex overflow-x-auto no-scrollbar -mx-1">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onTabChange?.(tab.key)}
                  className={`relative flex-shrink-0 px-3 sm:px-4 py-3 font-bold uppercase whitespace-nowrap transition-colors ${isActive ? 'text-txt-primary' : 'text-txt-tertiary hover:text-txt-secondary'}`}
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.85rem',
                    letterSpacing: '0.06em',
                  }}
                >
                  {tab.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-3 right-3 sm:left-4 sm:right-4 -bottom-px h-[2px]"
                      style={{ backgroundColor: 'var(--text-primary)' }}
                    />
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
}
