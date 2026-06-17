import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useDynasty } from '../../context/DynastyContext'
import { useAuth } from '../../context/AuthContext'
import { usePathPrefix } from '../../hooks/usePathPrefix'
import { Button } from '../../components/ui'
import { useToast } from '../../components/ui/Toast'
import CalendarJumper from '../../components/CalendarJumper'
import { getEditionKey, getEditionConfig } from '../../editions'
import { getDynastyPointsYears } from '../../data/dynastyPointsModel'

// Personal dev tools — gated to this account only (see DEV_EMAIL). Sidebar
// link + route are both gated, and this page hard-guards on the email too.
export const DEV_EMAIL = 'alex.guess1999@gmail.com'

export default function DevTools() {
  const { currentDynasty } = useDynasty()
  const { user } = useAuth()
  const pathPrefix = usePathPrefix()
  const { toast } = useToast()
  const [copied, setCopied] = useState('')

  // Hard guard — only the dev account can view this, even by direct URL.
  if (!user || user.email !== DEV_EMAIL) return <Navigate to={pathPrefix} replace />
  if (!currentDynasty) return null

  const editionKey = getEditionKey(currentDynasty)
  const config = getEditionConfig(editionKey)
  const features = config?.features ?? {}
  const dpYears = getDynastyPointsYears(currentDynasty)
  const coachCount = Object.keys(currentDynasty.coaches || {}).length

  const copy = async (label, value) => {
    try {
      await navigator.clipboard.writeText(typeof value === 'string' ? value : JSON.stringify(value, null, 2))
      setCopied(label)
      toast.success(`Copied ${label}`)
      setTimeout(() => setCopied(''), 1500)
    } catch (e) {
      toast.error('Copy failed')
    }
  }

  const Section = ({ title, subtitle, children }) => (
    <div className="card p-4 sm:p-5">
      <h2 className="font-display font-bold uppercase tracking-wide text-sm text-txt-primary m-0">{title}</h2>
      {subtitle && <p className="text-xs text-txt-tertiary mt-1 mb-3 m-0">{subtitle}</p>}
      <div className={subtitle ? '' : 'mt-3'}>{children}</div>
    </div>
  )

  const Row = ({ label, value, mono }) => (
    <div className="flex items-center justify-between gap-3 py-1.5 border-t border-surface-3 first:border-0">
      <span className="text-xs text-txt-tertiary">{label}</span>
      <span className={`text-sm text-txt-primary ${mono ? 'font-mono text-xs' : ''} truncate`}>{value}</span>
    </div>
  )

  const jsonBox = (value) => (
    <pre className="text-[11px] mt-2 p-3 rounded-md overflow-auto whitespace-pre font-mono" style={{ backgroundColor: 'var(--surface-3)', color: 'var(--text-secondary)', border: '1px solid var(--surface-4)', maxHeight: 320 }}>
      {JSON.stringify(value ?? null, null, 2)}
    </pre>
  )

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-8 px-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="display-md text-txt-primary m-0 leading-none">Dev Tools</h1>
          <p className="text-xs text-txt-tertiary mt-1">Private to {DEV_EMAIL}</p>
        </div>
        <Link to={`${pathPrefix}/admin`} className="btn-refined">Danger Zone</Link>
      </div>

      <Section title="Calendar / Phase Jumper" subtitle="Set the dynasty to any season, phase, and week — then open the Dashboard to see and edit that week's to-dos.">
        <CalendarJumper />
      </Section>

      <Section title="Dynasty Info">
        <Row label="Dynasty ID" value={currentDynasty.id} mono />
        <Row label="Edition" value={`${config?.label || editionKey} (${editionKey})`} />
        <Row label="Storage" value={currentDynasty.storageType || 'local'} />
        <Row label="Now" value={`${currentDynasty.currentYear} · ${String(currentDynasty.currentPhase || '').replace(/_/g, ' ')} · wk ${currentDynasty.currentWeek}`} />
        <Row label="Coaches (cid)" value={coachCount} />
        <Row label="Dynasty Points years" value={dpYears.length ? dpYears.join(', ') : '—'} />
      </Section>

      <Section title="Edition Features" subtitle={`Resolved flags for ${editionKey}.`}>
        <div className="grid grid-cols-2 gap-x-4">
          {Object.entries(features).map(([key, on]) => (
            <div key={key} className="flex items-center justify-between gap-2 py-1 border-t border-surface-3">
              <span className="text-xs text-txt-secondary truncate">{key}</span>
              <span className="text-xs font-bold" style={{ color: on ? 'var(--accent-success)' : 'var(--txt-tertiary)' }}>{on ? 'ON' : 'off'}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Raw Data" subtitle="Inspect / copy the CFB 27 data blobs.">
        <div className="flex flex-wrap gap-2 mb-3">
          <Button variant="outline" size="sm" onClick={() => copy('dynastyPoints', currentDynasty.dynastyPoints)}>{copied === 'dynastyPoints' ? 'Copied' : 'Copy dynastyPoints'}</Button>
          <Button variant="outline" size="sm" onClick={() => copy('coaches', currentDynasty.coaches)}>{copied === 'coaches' ? 'Copied' : 'Copy coaches'}</Button>
          <Button variant="outline" size="sm" onClick={() => copy('full dynasty', currentDynasty)}>{copied === 'full dynasty' ? 'Copied' : 'Copy full dynasty'}</Button>
        </div>
        <details>
          <summary className="text-xs text-txt-secondary cursor-pointer">dynastyPoints</summary>
          {jsonBox(currentDynasty.dynastyPoints)}
        </details>
        <details className="mt-2">
          <summary className="text-xs text-txt-secondary cursor-pointer">coaches</summary>
          {jsonBox(currentDynasty.coaches)}
        </details>
      </Section>
    </div>
  )
}
