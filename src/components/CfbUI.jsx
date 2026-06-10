import { useRef, useState, useEffect, useLayoutEffect } from 'react'
import { getContrastTextColor } from '../utils/colorUtils'

// Shared "CFB 27" broadcast-style UI primitives used across the team page
// (TeamYear) and player page (Player). Extracted so both surfaces share the
// exact same tab bar and rating-ring treatment instead of drifting apart.

// Tab bar, CFB-27 broadcast style: the ACTIVE tab is a solid team-color chip
// (true color + gradient sheen + film grain + contrast-aware label), inactive
// tabs stay quiet until hovered. This replaced the old sliding-underline bar.
// It's the single source for the app's primary tab bar (TeamYear / Player /
// WeeklyScores) — to revert the look, restore this function from git.
export function TabBar({ tabs, activeKey, onSelect, accentColor }) {
  const accent = accentColor || '#3a3d47'
  const activeText = getContrastTextColor(accent)
  return (
    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
      {tabs.map(tab => {
        const isActive = activeKey === tab.key
        return (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            className={`relative flex-shrink-0 rounded-md px-3 sm:px-4 lg:px-5 py-2.5 font-bold uppercase tracking-wide whitespace-nowrap transition-[background-color,color,filter] duration-150 ${
              isActive ? 'cfb-texture hover:brightness-[1.06]' : 'text-txt-tertiary hover:text-txt-primary hover:bg-surface-2'
            }`}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.9rem',
              ...(isActive ? {
                backgroundColor: accent,
                backgroundImage: 'linear-gradient(120deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0) 46%), linear-gradient(180deg, rgba(0,0,0,0.05) 0%, rgba(0,0,0,0.32) 100%)',
                color: activeText,
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                border: '1px solid rgba(0,0,0,0.28)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              } : {}),
            }}
          >
            <span className="relative z-[1]">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

// Card section header — the team-color accent bar + uppercase display title
// used at the top of every card/section on the team and player pages. Pass an
// `accent` (team primary color); optional `right` renders a meta/action on the
// far right (e.g. a "Full Timeline →" link or a week label).
export function CardSectionHeader({ label, accent, right, className = '' }) {
  return (
    <div
      className={`relative px-4 py-3 bg-surface-2 border-b border-surface-4 flex items-center justify-between gap-3 ${className}`}
      style={{
        // Faint team-color wash fading off the left accent + a subtle top
        // highlight so the bar reads as a lit broadcast strip, not flat fill.
        backgroundImage: accent
          ? `linear-gradient(90deg, ${accent}26 0%, ${accent}0d 16%, transparent 38%), linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 40%)`
          : undefined,
      }}
    >
      <h3
        className="font-display font-bold uppercase leading-none text-txt-primary truncate"
        style={{ fontSize: '0.98rem', letterSpacing: '0.05em' }}
      >
        {label}
      </h3>
      {right != null && <div className="flex-shrink-0">{right}</div>}
    </div>
  )
}

// CFB-broadcast-style rating rings: a labeled set of team-color outlined
// circles (e.g. OVR / OFF / DEF, or any single rating). `items` is an array
// of { label, value }. ringColor outlines the circle; textColor fills the
// number + label (both usually the contrast text of the team banner).
export function StatRings({ items, ringColor, textColor, size = 'md' }) {
  if (!items || items.length === 0) return null
  const dims = {
    xs: { dim: 'w-9 h-9', num: 'text-[11px]', lab: 'text-[6px]' },
    sm: { dim: 'w-11 h-11', num: 'text-sm', lab: 'text-[7px]' },
    md: { dim: 'w-11 h-11 sm:w-[3.25rem] sm:h-[3.25rem]', num: 'text-sm sm:text-base', lab: 'text-[7px] sm:text-[8px]' },
    lg: { dim: 'w-16 h-16 sm:w-20 sm:h-20', num: 'text-2xl sm:text-3xl', lab: 'text-[9px] sm:text-[10px]' },
  }
  const { dim, num, lab } = dims[size] || dims.md
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {items.map(it => (
        <div
          key={it.label}
          className={`${dim} rounded-full flex flex-col items-center justify-center shrink-0`}
          style={{
            border: `2px solid ${ringColor}`,
            background: 'radial-gradient(circle at 50% 30%, rgba(255,255,255,0.12), rgba(255,255,255,0.02) 70%)',
            boxShadow: `0 0 14px ${ringColor}40, inset 0 1px 1px rgba(255,255,255,0.12)`,
          }}
        >
          <span className={`font-display font-extrabold leading-none tabular-nums ${num}`} style={{ color: textColor }}>
            {it.value ?? '—'}
          </span>
          <span className={`font-bold tracking-[0.12em] mt-0.5 ${lab}`} style={{ color: textColor, opacity: 0.65 }}>
            {it.label}
          </span>
        </div>
      ))}
    </div>
  )
}
