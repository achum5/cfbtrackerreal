import { describe, it, expect } from 'vitest'
import { isDocTooLargeError } from '../firestoreErrors'

// This classifier decides when the loud red "your saves are NOT reaching the
// cloud" banner shows. False negative = a user silently loses months of data
// (the "whole season gone except week two" report). False positive = we scare
// a user whose save actually succeeded. Both directions get pinned.
describe('isDocTooLargeError', () => {
  it('matches the real Firestore oversized-document rejection', () => {
    // Shape the Web SDK produces when the server refuses a >1MiB doc.
    expect(isDocTooLargeError({
      code: 'invalid-argument',
      message: 'Document cannot be written because its size (1,234,567 bytes) exceeds the maximum allowed size of 1,048,576 bytes.',
    })).toBe(true)
  })

  it('matches the gRPC-style INVALID_ARGUMENT text form', () => {
    expect(isDocTooLargeError(new Error(
      'INVALID_ARGUMENT: entity is too big. size=1200000 max=1048576',
    ))).toBe(true)
  })

  it('matches the per-field variant ("longer than N bytes")', () => {
    expect(isDocTooLargeError({
      code: 'invalid-argument',
      message: 'The value of property "teams" is longer than 1048487 bytes.',
    })).toBe(true)
  })

  it('does NOT fire for other invalid-argument rejections', () => {
    // Same code, unrelated cause — must not show the size banner.
    expect(isDocTooLargeError({
      code: 'invalid-argument',
      message: 'Unsupported field value: undefined (found in field player.name)',
    })).toBe(false)
  })

  it('does NOT fire for permission-denied', () => {
    expect(isDocTooLargeError({
      code: 'permission-denied',
      message: 'Missing or insufficient permissions.',
    })).toBe(false)
  })

  it('does NOT fire for network-flavored failures or empty input', () => {
    expect(isDocTooLargeError({ code: 'unavailable', message: 'The service is currently unavailable.' })).toBe(false)
    expect(isDocTooLargeError(null)).toBe(false)
    expect(isDocTooLargeError(undefined)).toBe(false)
    expect(isDocTooLargeError({})).toBe(false)
  })
})

import { describeOversizedWrite } from '../firestoreErrors'

describe('describeOversizedWrite — which document was too big', () => {
  const rejection = (path, size = '1,234,567') => ({
    code: 'invalid-argument',
    message: `Document 'projects/cfbtracker-200ab/databases/(default)/documents/${path}' cannot be written because its size (${size} bytes) exceeds the maximum allowed size of 1,048,576 bytes.`,
  })

  it('the main dynasty doc (the only one "Migrate to Subcollections" fixes)', () => {
    expect(describeOversizedWrite(rejection('dynasties/abc123'))).toMatchObject({ kind: 'main', path: 'dynasties/abc123', bytes: 1234567 })
  })

  it('a season doc, with its year', () => {
    expect(describeOversizedWrite(rejection('dynasties/abc123/seasons/2027'))).toMatchObject({ kind: 'season', year: 2027, collection: 'seasons' })
  })

  it('a team shard under a season', () => {
    expect(describeOversizedWrite(rejection('dynasties/abc123/seasons/2027/teamShards/3'))).toMatchObject({ kind: 'teamShard', year: 2027 })
  })

  it('a record in another subcollection', () => {
    expect(describeOversizedWrite(rejection('dynasties/abc123/players/42'))).toMatchObject({ kind: 'subcollection', collection: 'players' })
  })

  it('no path in the message: unknown, but the property is kept when named', () => {
    expect(describeOversizedWrite({ code: 'invalid-argument', message: 'Document cannot be written because its size (1,234,567 bytes) exceeds the maximum allowed size of 1,048,576 bytes.' }))
      .toMatchObject({ kind: 'unknown', path: null, bytes: 1234567 })
    expect(describeOversizedWrite({ code: 'invalid-argument', message: 'The value of property "teams" is longer than 1048487 bytes.' }))
      .toMatchObject({ kind: 'unknown', property: 'teams' })
  })

  it('null for anything that is not an oversized write', () => {
    expect(describeOversizedWrite({ code: 'permission-denied', message: 'Missing or insufficient permissions.' })).toBeNull()
    expect(describeOversizedWrite(null)).toBeNull()
  })
})
