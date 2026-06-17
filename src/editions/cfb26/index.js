// CFB 26 edition bundle — the BASE edition.
//
// This mirrors how the app has always behaved. Every dynasty created
// before the edition system existed has no `gameEdition` field, and by
// design (see ../index.js → LEGACY_EDITION) those untagged dynasties
// resolve to THIS bundle forever. So cfb26 must always describe the
// app's original, pre-edition behavior.
//
// Phase 0 only needs the edition's identity + feature flags. As we move
// game-rule constants (progression, scout tiers, season structure…) into
// the edition system in later phases, they get added here as the
// canonical cfb26 values, and cfb27 overrides only what changed.

export default {
  key: 'cfb26',
  label: 'CFB 26',
  shortLabel: '26',
  releaseYear: 2025,
  // Base edition — inherits from nothing.
  extends: null,

  // Feature flags gate entire CFB 27 subsystems. All OFF here so a cfb26
  // dynasty never renders or stores any of the new mechanics. UI reads
  // these via `config.features.x` — never by checking the edition key.
  features: {
    dynastyPoints: false,    // program budget / point economy
    nil: false,              // per-player & per-recruit NIL
    wearAndTear: false,      // health / practice-plan tradeoff
    coachingCarousel: false, // job security, express interest, hiring queue
    scoutingWeek: false,     // week-0 scouting-only recruiting
    commitLadder: false,     // soft/hard commit + gems
  },
}
