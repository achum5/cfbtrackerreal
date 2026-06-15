import { describe, it, expect } from 'vitest'
import { computeScoutScore, SCOUT_WEIGHTS } from '../scoutGrade'
import { initialOvr, harvestScoutObservations, buildScoutCalibration, scoutCalibration } from '../scoutLearning'

// Build a scouted+enrolled player whose initial OVR is (raw grade + delta).
const enrolled = (o, delta = 0) => {
  const recruitYear = o.recruitYear ?? 2030
  const p = { pid: o.pid, position: o.position, archetype: o.archetype, stars: o.stars ?? 4, devTrait: o.devTrait, attributes: o.attributes, recruitYear }
  const pred = computeScoutScore(p)
  return { ...p, overallByYear: { [recruitYear + 1]: Math.round(pred + delta) } }
}

const QB_ATTRS = (over = {}) => ({
  'Throw Power': 85, 'Short Accuracy': 85, 'Medium Accuracy': 85, 'Deep Accuracy': 85,
  'Under Pressure': 80, Awareness: 82, 'Throw On Run': 70, 'Break Sack': 65, ...over,
})
const WR_ATTRS = (over = {}) => ({
  Speed: 88, Acceleration: 86, 'Deep Route': 82, Catching: 84, 'Short Route': 80, 'Medium Route': 80, ...over,
})

describe('scoutLearning — observations', () => {
  it('initialOvr prefers the enrollment-year rating', () => {
    expect(initialOvr({ recruitYear: 2030, overallByYear: { 2031: 74, 2032: 80 } })).toBe(74)
    expect(initialOvr({ recruitYear: 2030, overallByYear: { 2033: 88 } })).toBe(88) // earliest available
    expect(initialOvr({ overallByYear: {} })).toBeNull()
  })

  it('harvests only scouted players who have enrolled with a real OVR', () => {
    const players = [
      enrolled({ pid: 1, position: 'QB', archetype: 'Pocket Passer', attributes: QB_ATTRS() }, 4),
      { pid: 2, position: 'QB', archetype: 'Pocket Passer', attributes: QB_ATTRS() }, // no OVR yet
      { pid: 3, position: 'WR', archetype: 'Speedster', attributes: null, overallByYear: { 2031: 70 }, recruitYear: 2030 }, // unscouted
      { pid: 4, position: 'WR', archetype: 'Speedster', attributes: WR_ATTRS(), isTarget: true, commitmentTid: null, recruitYear: 2030 }, // open target
    ]
    const obs = harvestScoutObservations(players)
    expect(obs.map((o) => o.pid)).toEqual([1])
  })
})

describe('scoutLearning — calibration', () => {
  it('stays report-only below the minimum sample size', () => {
    const players = [
      enrolled({ pid: 1, position: 'QB', archetype: 'Pocket Passer', attributes: QB_ATTRS() }, 5),
      enrolled({ pid: 2, position: 'QB', archetype: 'Pocket Passer', attributes: QB_ATTRS() }, 5),
    ]
    const m = scoutCalibration(players)
    expect(m.active).toBe(false)
    expect(m.n).toBe(2)
    expect(m.positionOffset).toEqual({})
  })

  it('learns position offsets and reduces ranking error', () => {
    const players = []
    let pid = 0
    // We systematically UNDER-grade QBs (+6) and OVER-grade WRs (-6).
    for (let i = 0; i < 7; i++) players.push(enrolled({ pid: ++pid, position: 'QB', archetype: 'Pocket Passer', attributes: QB_ATTRS({ Awareness: 80 + i }) }, 6))
    for (let i = 0; i < 7; i++) players.push(enrolled({ pid: ++pid, position: 'WR', archetype: 'Speedster', attributes: WR_ATTRS({ Speed: 84 + i }) }, -6))
    const m = scoutCalibration(players)
    expect(m.active).toBe(true)
    expect(m.n).toBe(14)
    expect(m.positionOffset.QB).toBeGreaterThan(0)
    expect(m.positionOffset.WR).toBeLessThan(0)
    expect(m.residualMAE.after).toBeLessThanOrEqual(m.residualMAE.before)
    expect(m.residualMAE.gainPct).toBeGreaterThan(0)
    // The model actually moves a fresh grade in the learned direction.
    const rawQB = computeScoutScore({ position: 'QB', archetype: 'Pocket Passer', attributes: QB_ATTRS(), stars: 4 })
    const calQB = computeScoutScore({ position: 'QB', archetype: 'Pocket Passer', attributes: QB_ATTRS(), stars: 4 }, m)
    expect(calQB).toBeGreaterThan(rawQB)
  })

  it('tunes an archetype attribute weight toward what predicted success', () => {
    // Within one archetype, Under Pressure drives over-performance beyond its prior weight.
    const players = []
    for (let i = 0; i < 12; i++) {
      const up = 70 + i * 2 // 70..92
      players.push(enrolled(
        { pid: i + 1, position: 'QB', archetype: 'Pocket Passer', attributes: QB_ATTRS({ 'Under Pressure': up }) },
        (up - 80) * 1.0, // actual beats grade when Under Pressure is high
      ))
    }
    const m = scoutCalibration(players)
    const tuned = m.learnedWeights['QB_Pocket Passer']
    expect(tuned).toBeTruthy()
    expect(tuned['Under Pressure']).toBeGreaterThan(SCOUT_WEIGHTS['QB_Pocket Passer']['Under Pressure'])
  })

  it('learns hidden-dev priors from how traits actually revealed', () => {
    const players = []
    // Five 5-stars that all revealed Elite → prior should approach DEV_ADJ.Elite (10).
    for (let i = 0; i < 6; i++) players.push(enrolled({ pid: i + 1, position: 'WR', archetype: 'Speedster', stars: 5, devTrait: 'Elite', attributes: WR_ATTRS({ Speed: 86 + i }) }, 2))
    for (let i = 0; i < 6; i++) players.push(enrolled({ pid: 10 + i, position: 'QB', archetype: 'Pocket Passer', stars: 3, devTrait: 'Normal', attributes: QB_ATTRS({ Awareness: 78 + i }) }, -2))
    const m = scoutCalibration(players)
    expect(m.devPriors[5]).toBe(10)   // Elite
    expect(m.devPriors[3]).toBe(-5)   // Normal
  })
})
