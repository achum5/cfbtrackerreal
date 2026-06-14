import { describe, it, expect } from 'vitest'
import { computeScoutScore, scoutTier, scoutGrade, topScoutedAttrs, SCOUT_WEIGHTS, scoutLetter, inferPlayStyle, schemeFits, scoutReport, scoutDossier, dossierParagraphs, gradeBreakdown } from '../scoutGrade'

const player = (o) => ({ position: 'QB', archetype: 'Pocket Passer', stars: 4, devTrait: 'Impact', ...o })

describe('scoutGrade — engine', () => {
  it('returns null when no attributes are scouted', () => {
    expect(computeScoutScore(player({ attributes: null }))).toBeNull()
    expect(computeScoutScore(player({ attributes: {} }))).toBeNull()
    expect(scoutGrade(player({ attributes: {} })).score).toBeNull()
  })

  it('weights the archetype\'s key attributes (accuracy-heavy QB scores ~its accuracy)', () => {
    // Pocket Passer leans accuracy/throw power/awareness — all 90 → base ~90.
    const s = computeScoutScore(player({
      devTrait: 'Normal', stars: 3,
      attributes: { 'Throw Power': 90, 'Short Accuracy': 90, 'Medium Accuracy': 90, 'Deep Accuracy': 90, 'Under Pressure': 90, Awareness: 90, Speed: 60, Acceleration: 60 },
    }))
    // base ~90, Normal dev -5, 3* +0 → ~85
    expect(s).toBeGreaterThanOrEqual(82)
    expect(s).toBeLessThanOrEqual(90)
  })

  it('low key attributes drag the score down even with good physicals', () => {
    const s = computeScoutScore(player({
      devTrait: 'Normal', stars: 3,
      attributes: { 'Throw Power': 60, 'Short Accuracy': 60, 'Medium Accuracy': 60, 'Deep Accuracy': 60, 'Under Pressure': 60, Awareness: 60, Speed: 95, Acceleration: 95 },
    }))
    expect(s).toBeLessThan(74) // Depth tier
  })

  it('dev trait + stars raise the score', () => {
    const attrs = { 'Throw Power': 85, 'Short Accuracy': 85, 'Medium Accuracy': 85, 'Deep Accuracy': 85, 'Under Pressure': 85, Awareness: 85 }
    const elite = computeScoutScore(player({ devTrait: 'Elite', stars: 5, attributes: attrs }))
    const normal = computeScoutScore(player({ devTrait: 'Normal', stars: 2, attributes: attrs }))
    expect(elite).toBeGreaterThan(normal)
    expect(elite - normal).toBeGreaterThanOrEqual(12) // ~ (10 - -5) + (2 - -1)
  })

  it('falls back to a flat average for an archetype with no weight table', () => {
    const s = computeScoutScore({
      position: 'K', archetype: 'Accurate', stars: 3, devTrait: 'Normal',
      attributes: { 'Kick Power': 80, 'Kick Accuracy': 80 },
    })
    // base = avg(80,80)=80, Normal -5, 3* 0, no phys → 75
    expect(s).toBe(75)
  })

  it('scoutTier maps scores to bands', () => {
    expect(scoutTier(90).key).toBe('elite')
    expect(scoutTier(84).key).toBe('premium')
    expect(scoutTier(77).key).toBe('core')
    expect(scoutTier(60).key).toBe('depth')
    expect(scoutTier(null)).toBeNull()
  })

  it('topScoutedAttrs returns the highest-weighted scouted attributes', () => {
    const top = topScoutedAttrs(player({
      attributes: { 'Throw Power': 70, 'Short Accuracy': 95, 'Medium Accuracy': 92, Awareness: 60, Speed: 80 },
    }), 2)
    expect(top).toHaveLength(2)
    // Short/Medium Accuracy are the heavily-weighted ones present
    expect(top.map((t) => t.name)).toContain('Short Accuracy')
  })

  it('every weight table is keyed <BUCKET>_<Archetype> and has positive weights', () => {
    for (const [key, w] of Object.entries(SCOUT_WEIGHTS)) {
      expect(key).toMatch(/^[A-Z]+_/)
      expect(Object.values(w).some((v) => v > 0)).toBe(true)
    }
  })

  it('scoutLetter maps scores to letter grades', () => {
    expect(scoutLetter(96)).toBe('A+')
    expect(scoutLetter(90)).toBe('A')
    expect(scoutLetter(78)).toBe('B')
    expect(scoutLetter(40)).toBe('F')
    expect(scoutLetter(null)).toBeNull()
  })

  it('inferPlayStyle reads pass vs rush yards', () => {
    const pass = [{ statsByYear: { 2030: { passing: { yds: 4000 }, rushing: { yds: 800 } } } }]
    const run = [{ statsByYear: { 2030: { passing: { yds: 1000 }, rushing: { yds: 2600 } } } }]
    expect(inferPlayStyle(pass, 2030)).toBe('pass')
    expect(inferPlayStyle(run, 2030)).toBe('run')
    expect(inferPlayStyle([], 2030)).toBe('balanced')
  })

  it('schemeFits respects archetype tendency and balanced schemes', () => {
    expect(schemeFits('Pocket Passer', 'pass')).toBe(true)
    expect(schemeFits('Pure Runner', 'pass')).toBe(false)
    expect(schemeFits('Pocket Passer', 'balanced')).toBeNull() // everyone fits
    expect(schemeFits('Lurker', 'pass')).toBeNull() // defensive — n/a
  })

  it('scoutReport composes a grade + strengths + scheme-fit blurb', () => {
    const r = scoutReport(player({
      devTrait: 'Elite', stars: 5,
      attributes: { 'Throw Power': 92, 'Short Accuracy': 90, 'Medium Accuracy': 90, 'Deep Accuracy': 88, Awareness: 85, Speed: 60 },
    }), 'pass')
    expect(r).toMatch(/grades out at/)
    expect(r).toMatch(/pass-heavy offense/)
    expect(r).toMatch(/Elite dev trait/)
    expect(scoutReport(player({ attributes: {} }))).toBeNull()
  })

  it('scoutDossier returns labelled sections including a bottom line', () => {
    const d = scoutDossier(player({
      devTrait: 'Star', stars: 5,
      attributes: { 'Throw Power': 92, 'Short Accuracy': 90, 'Medium Accuracy': 90, 'Deep Accuracy': 88, Awareness: 85 },
    }), 'pass')
    const labels = d.map((s) => s.label)
    expect(labels).toContain('Projection')
    expect(labels).toContain('Strengths')
    expect(labels).toContain('Bottom line')
    expect(scoutDossier(player({ attributes: {} }))).toBeNull()
  })

  it('scoutDossier folds into paragraphs and adds a depth-chart line', () => {
    const p = player({
      devTrait: 'Star', stars: 5,
      attributes: { 'Throw Power': 92, 'Short Accuracy': 90, 'Medium Accuracy': 90, 'Deep Accuracy': 88, Awareness: 85 },
    })
    const d = scoutDossier(p, 'pass', { group: 'QB', returning: 0, rank: 2 })
    expect(d.some((s) => s.label === 'Depth-chart fit')).toBe(true)
    expect(d.find((s) => s.label === 'Depth-chart fit').body).toMatch(/nobody at QB/)
    const paras = dossierParagraphs(d)
    expect(paras.length).toBe(3) // overview / fit / verdict
    expect(paras.join(' ')).toMatch(/clear runway/)
    // No depth context → no depth line
    expect(scoutDossier(p, 'pass').some((s) => s.label === 'Depth-chart fit')).toBe(false)
  })

  it('gradeBreakdown parts sum to the published score', () => {
    const p = player({
      devTrait: 'Impact', stars: 4,
      attributes: { 'Throw Power': 88, 'Short Accuracy': 84, 'Medium Accuracy': 82, 'Deep Accuracy': 80, Awareness: 78 },
    })
    const bd = gradeBreakdown(p)
    expect(bd.score).toBe(computeScoutScore(p))
    const summed = Math.max(0, Math.min(99, Math.round(bd.adjustments.reduce((a, x) => a + x.value, 0))))
    expect(summed).toBe(bd.score)
    expect(bd.factors.every((f) => f.share > 0)).toBe(true)
    expect(bd.hasDev).toBe(true)
  })

  it('a blank dev trait is projected from stars, not penalized as Normal', () => {
    const attrs = { 'Throw Power': 85, 'Short Accuracy': 85, 'Medium Accuracy': 85, 'Deep Accuracy': 85, Awareness: 85 }
    const blank = computeScoutScore(player({ devTrait: '', stars: 4, attributes: attrs }))
    const normal = computeScoutScore(player({ devTrait: 'Normal', stars: 4, attributes: attrs }))
    expect(blank).toBeGreaterThan(normal) // +4 (4★ estimate) vs -5 (Normal)
    const bd = gradeBreakdown(player({ devTrait: '', stars: 4, attributes: attrs }))
    expect(bd.hasDev).toBe(false)
    expect(bd.adjustments.find((a) => a.kind === 'dev').note).toMatch(/hidden/)
  })
})
