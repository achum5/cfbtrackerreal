/**
 * PageHero primitive — the unified, neutral CFB-27 page header used across the
 * site's league-wide pages (Awards, Bowl History, Standings, Leaders, …).
 *
 * Clean and bold: a dark card with a smooth top sheen + gentle bottom darken
 * (NO diagonal-line texture), an uppercase bold display title, optional eyebrow,
 * meta, right cluster, actions, and body children (e.g. tabs).
 *
 * Props:
 *   title       — string or ReactNode (rendered display-lg if string)
 *   eyebrow     — optional pre-title small label (all-caps)
 *   meta        — optional ReactNode rendered below title
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
    <section
      className={`card overflow-hidden mb-6 relative reveal ${className}`.trim()}
      style={{
        backgroundImage:
          'linear-gradient(120deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 40%), linear-gradient(180deg, rgba(255,255,255,0.035) 0%, transparent 30%, rgba(0,0,0,0.22) 100%)',
      }}
    >
      <div className={`relative px-6 sm:px-8 ${hasTabs ? 'pt-5 pb-2 sm:pt-6 sm:pb-2' : 'py-5 sm:py-6'}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <div className="label-sm text-txt-tertiary mb-1.5">{eyebrow}</div>
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
              <div className="mt-2 label-sm text-txt-tertiary flex items-center gap-2 flex-wrap normal-case">
                {meta}
              </div>
            )}
          </div>
          {(right || actions) && (
            <div className="flex flex-col sm:items-end gap-3 flex-shrink-0">
              {right}
              {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
            </div>
          )}
        </div>
        {children && <div className="mt-6">{children}</div>}
      </div>

      {/* Docked tab nav — sits on the hero's bottom edge with a hairline rule,
          matching the team and player page headers. */}
      {hasTabs && (
        <div className="relative border-t" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
          <div className="flex overflow-x-auto no-scrollbar px-3 sm:px-5">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => onTabChange?.(tab.key)}
                  className="relative flex-shrink-0 px-3 sm:px-4 lg:px-5 py-3 font-bold uppercase whitespace-nowrap transition-opacity hover:opacity-100"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: '0.85rem',
                    letterSpacing: '0.06em',
                    color: 'var(--text-primary)',
                    opacity: isActive ? 1 : 0.5,
                  }}
                >
                  {tab.label}
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute left-2 right-2 bottom-0 h-[3px] rounded-t-sm"
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
