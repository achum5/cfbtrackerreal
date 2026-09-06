import { describe, it, expect } from 'vitest'
import { mergePreseasonForConference } from '../preseasonHonors'

const conf = (c) => (e) => e.conf === c

describe('mergePreseasonForConference', () => {
  it('replaces only the saved conference and keeps the others', () => {
    const existing = [{ player: 'S1', conf: 'SEC' }, { player: 'B1', conf: 'Big Ten' }]
    const out = mergePreseasonForConference(existing, [{ player: 'S2', conf: 'SEC' }], conf('SEC'))
    expect(out).toEqual([{ player: 'B1', conf: 'Big Ten' }, { player: 'S2', conf: 'SEC' }])
  })
  it('clearing a conference removes its rows and nothing else', () => {
    const existing = [{ player: 'S1', conf: 'SEC' }, { player: 'B1', conf: 'Big Ten' }]
    expect(mergePreseasonForConference(existing, [], conf('SEC'))).toEqual([{ player: 'B1', conf: 'Big Ten' }])
  })
  it('tolerates a missing existing list', () => {
    expect(mergePreseasonForConference(undefined, [{ player: 'S1', conf: 'SEC' }], conf('SEC'))).toEqual([{ player: 'S1', conf: 'SEC' }])
  })
})
