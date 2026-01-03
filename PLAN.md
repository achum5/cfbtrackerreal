# Simplified Roster & Player Departure Architecture

## Inspiration from BBGM

BBGM's elegance comes from:
1. **`player.tid`** = current team ID (simple integer)
2. **`player.stats[].tid`** = which team they played for each season (immutable history)
3. **`player.transactions[]`** = movement log (trades, signings, releases)

The key insight: **rosters are derived, not stored**. A team's roster = all players where `tid === team.tid`.

## Current CFB Tracker Problems

We have 5 different mechanisms tracking player departures:

| Field | Location | Purpose | Status |
|-------|----------|---------|--------|
| `playersLeavingByYear[year]` | dynasty | Track departures | Pending |
| `player.leavingYear + leavingReason` | player | Track departures (duplicated!) | Pending |
| `player.leftTeam + leftYear + leftReason` | player | Finalized departure | Final |
| `player.transferredTo` | player | Pending transfer destination | Pending |
| `player.teamsByYear[year]` absence | player | Historical team record | Final |

These must stay in sync across multiple weeks. It's error-prone and confusing.

## Proposed Simplified Architecture

### Core Philosophy (like BBGM)

1. **Player owns their data** - all state lives on the player object
2. **Rosters are derived** - filter players by `teamsByYear[year]`
3. **Single source of truth for departure** - one mechanism, not five

### New Player Fields

```javascript
player = {
  // Current team (like BBGM's tid)
  team: 'UT',

  // Historical team membership (like BBGM's stats[].tid per season)
  // This is the PRIMARY source for roster filtering
  teamsByYear: { 2025: 'UT', 2026: 'UT', 2027: 'MICH' },

  // Movement history (like BBGM's transactions[])
  // Replaces: leavingYear, leavingReason, leftTeam, leftYear, leftReason, transferredTo, transferredFrom
  movements: [
    { year: 2025, type: 'recruited', from: null, to: 'UT' },
    { year: 2027, type: 'transfer', from: 'UT', to: 'MICH', reason: 'Transfer' },
    // or: { year: 2028, type: 'departure', from: 'UT', to: null, reason: 'Graduating' }
    // or: { year: 2028, type: 'departure', from: 'UT', to: null, reason: 'Pro Draft', draftRound: 1 }
  ],

  // NEW: Pending departure (set in Week 1 offseason, finalized at Signing Day)
  // Replaces: leavingYear, leavingReason, transferredTo, plus dynasty.playersLeavingByYear
  pendingDeparture: {
    year: 2026,
    reason: 'Transfer',  // or 'Graduating', 'Pro Draft'
    destination: 'MICH'  // null for graduating/pro draft
  },

  // Recruit info (unchanged)
  isRecruit: false,
  recruitYear: null,
  previousTeam: 'Syracuse',  // For incoming portal recruits
  isPortal: true
}
```

### Key Changes

#### 1. Remove Dynasty-Level `playersLeavingByYear`
- **Currently**: Stored at both dynasty AND player level, must stay in sync
- **New**: Only use `player.pendingDeparture` - derive dynasty list when needed:
  ```javascript
  const getPlayersLeaving = (dynasty, year) =>
    dynasty.players.filter(p => p.pendingDeparture?.year === year)
  ```

#### 2. Finalize Departures at Signing Day (Year Flip)
- **Currently**: Departures finalized at `advanceToNewSeason()` (week 8→preseason)
- **New**: Finalize during year flip (week 5→6):
  ```javascript
  // In advanceWeek, when nextYear = dynasty.currentYear + 1:
  if (player.pendingDeparture?.year === dynasty.currentYear) {
    // Add to movements history
    const movement = {
      year: dynasty.currentYear,
      type: player.pendingDeparture.reason === 'Transfer' ? 'transfer' : 'departure',
      from: teamAbbr,
      to: player.pendingDeparture.destination,
      reason: player.pendingDeparture.reason
    }

    // Clear pendingDeparture, update team if transfer
    player.movements.push(movement)
    player.pendingDeparture = null
    if (movement.to) {
      player.team = movement.to
      player.teamsByYear[nextYear] = movement.to
    }
    // DO NOT add teamsByYear[nextYear] for departing players
  }
  ```

#### 3. Auto-Detect Returning Players
- **When**: Player appears in recruiting commitments AND has `pendingDeparture`
- **Action**: Clear `pendingDeparture`, add back to `teamsByYear[nextYear]`
- **Already implemented**: Lines 1383-1524 in Dashboard.jsx handle this! Just need to work with new field.

#### 4. Simplified `isPlayerOnRoster()`

```javascript
export function isPlayerOnRoster(player, teamAbbr, year) {
  // Exclude non-roster players
  if (player.isHonorOnly || player.isRecruit) return false
  if (player.recruitYear && Number(year) <= Number(player.recruitYear)) return false

  // PRIMARY: Check teamsByYear (the source of truth)
  if (player.teamsByYear?.[year] !== undefined) {
    return player.teamsByYear[year] === teamAbbr
  }

  // FALLBACK: Current team field for legacy data
  return player.team === teamAbbr
}
```

No more checking `leftTeam`, `leavingYear`, `transferredTo` - those are replaced by:
- `pendingDeparture` (pending) → processed at year flip
- `movements[]` (historical log)
- `teamsByYear` absence (doesn't have an entry = not on roster)

### Migration Strategy

#### Phase 1: Add `movements[]` and `pendingDeparture`
1. Create migration function to populate from existing fields
2. Convert `leavingYear + leavingReason + transferredTo` → `pendingDeparture`
3. Convert `leftTeam + leftYear + leftReason` → add to `movements[]`

#### Phase 2: Update All Code
1. Update `handlePlayersLeavingSave()` to set `pendingDeparture`
2. Update `handleTransferDestinationsSave()` to update `pendingDeparture.destination`
3. Move departure finalization from `advanceToNewSeason()` to year flip in `advanceWeek()`
4. Simplify `isPlayerOnRoster()` to not check legacy fields
5. Remove `playersLeavingByYear` usage

#### Phase 3: Cleanup
1. Remove old fields after migration is stable
2. Update CLAUDE.md

### Benefits

1. **Single source of truth**: `player.pendingDeparture` for pending, `movements[]` for history
2. **Simpler roster check**: Just check `teamsByYear[year]`
3. **Better history**: `movements[]` gives complete player movement log
4. **Earlier finalization**: Departures processed at Signing Day, not week 8
5. **BBGM-inspired**: Familiar pattern, proven at scale

### Questions to Resolve

1. Should `movements[]` replace `previousTeam`/`isPortal` for incoming recruits?
   - Could add `{ type: 'recruited', from: 'Syracuse', to: 'UT' }` instead
2. For displaying "where did they go" - use `movements[]` or keep `transferredFrom`/`transferredTo` as derived fields?

## Implementation Order

1. [ ] Add migration function for movements[] and pendingDeparture
2. [ ] Update handlePlayersLeavingSave to use pendingDeparture
3. [ ] Update handleTransferDestinationsSave to use pendingDeparture.destination
4. [ ] Move departure finalization to Signing Day (year flip in advanceWeek)
5. [ ] Add auto-detect for returning players (clear pendingDeparture)
6. [ ] Simplify isPlayerOnRoster to trust teamsByYear
7. [ ] Remove playersLeavingByYear references
8. [ ] Update CLAUDE.md
