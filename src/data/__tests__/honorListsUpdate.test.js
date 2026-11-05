import { describe, it, expect } from 'vitest'
import { buildHonorListsUpdate } from '../cfb27SaveSync'

// The save sync writes each year's honors with a merge, so a key it includes
// replaces that list and a key it leaves out keeps it. It used to include
// both lists whenever the save had either one, writing an empty
// All-Conference list over the year's teams when the save only carried
// national honors.

const keys = { national: 'allAmericans', conference: 'allConference' }
const id = (e) => e

describe('buildHonorListsUpdate', () => {
  it('includes only the lists the save has', () => {
    expect(buildHonorListsUpdate({ national: [{ p: 1 }], conference: [] }, keys, id)).toEqual({ allAmericans: [{ p: 1 }] })
    expect(buildHonorListsUpdate({ conference: [{ p: 2 }] }, keys, id)).toEqual({ allConference: [{ p: 2 }] })
  })
  it('includes both when both are present, mapped', () => {
    const out = buildHonorListsUpdate({ national: [1], conference: [2] }, keys, (e) => e * 10)
    expect(out).toEqual({ allAmericans: [10], allConference: [20] })
  })
  it('is null when the save has neither, so nothing is written', () => {
    expect(buildHonorListsUpdate(undefined, keys, id)).toBe(null)
    expect(buildHonorListsUpdate({ national: [], conference: [] }, keys, id)).toBe(null)
  })
})
