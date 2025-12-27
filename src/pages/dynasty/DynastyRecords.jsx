import { useState, useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useDynasty, aggregateBoxScoreStats } from '../../context/DynastyContext'
import { usePathPrefix } from '../../hooks/usePathPrefix'
import { getTeamLogo } from '../../data/teams'
import { teamAbbreviations, getAbbreviationFromDisplayName } from '../../data/teamAbbreviations'

// Stat category definitions with all 51 stats
const STAT_CATEGORIES = {
  passing: {
    name: 'Passing',
    minNote: 'Rate stats require minimum 150 pass attempts (career) / 50 attempts (season)',
    stats: [
      { key: 'completions', label: 'Completions', abbr: 'CMP', field: 'Completions' },
      { key: 'attempts', label: 'Pass Attempts', abbr: 'ATT', field: 'Attempts' },
      { key: 'compPct', label: 'Completion %', abbr: 'CMP%', calculated: true, minAtt: { career: 150, season: 50 }, format: 'pct' },
      { key: 'yards', label: 'Passing Yards', abbr: 'YDS', field: 'Yards' },
      { key: 'ypa', label: 'Yards/Attempt', abbr: 'Y/A', calculated: true, minAtt: { career: 150, season: 50 }, format: 'avg' },
      { key: 'aypa', label: 'Adj. Yards/Attempt', abbr: 'AY/A', calculated: true, minAtt: { career: 150, season: 50 }, format: 'avg' },
      { key: 'tds', label: 'Passing TDs', abbr: 'TD', field: 'Touchdowns' },
      { key: 'ints', label: 'Interceptions', abbr: 'INT', field: 'Interceptions', lowerIsBetter: true },
      { key: 'rating', label: 'Passer Rating', abbr: 'RTG', calculated: true, minAtt: { career: 150, season: 50 }, format: 'rating' },
      { key: 'ypg', label: 'Yards/Game', abbr: 'Y/G', calculated: true, minAtt: { career: 150, season: 50 }, format: 'avg' },
      { key: 'tdPct', label: 'TD %', abbr: 'TD%', calculated: true, minAtt: { career: 150, season: 50 }, format: 'pct' },
      { key: 'intPct', label: 'INT %', abbr: 'INT%', calculated: true, minAtt: { career: 150, season: 50 }, format: 'pct', lowerIsBetter: true }
    ]
  },
  rushing: {
    name: 'Rushing',
    minNote: 'Rate stats require minimum 100 rush attempts (career) / 25 attempts (season)',
    stats: [
      { key: 'attempts', label: 'Rush Attempts', abbr: 'ATT', field: 'Carries' },
      { key: 'yards', label: 'Rush Yards', abbr: 'YDS', field: 'Yards' },
      { key: 'ypc', label: 'Yards/Carry', abbr: 'Y/C', calculated: true, minAtt: { career: 100, season: 25 }, format: 'avg' },
      { key: 'tds', label: 'Rush TDs', abbr: 'TD', field: 'Touchdowns' }
    ]
  },
  receiving: {
    name: 'Receiving',
    minNote: 'Rate stats require minimum 50 receptions (career) / 10 receptions (season)',
    stats: [
      { key: 'receptions', label: 'Receptions', abbr: 'REC', field: 'Receptions' },
      { key: 'yards', label: 'Receiving Yards', abbr: 'YDS', field: 'Yards' },
      { key: 'ypr', label: 'Yards/Reception', abbr: 'Y/R', calculated: true, minAtt: { career: 50, season: 10 }, format: 'avg' },
      { key: 'tds', label: 'Receiving TDs', abbr: 'TD', field: 'Touchdowns' }
    ]
  },
  scrimmage: {
    name: 'Scrimmage',
    minNote: 'Combined rushing and receiving stats',
    stats: [
      { key: 'plays', label: 'Scrimmage Plays', abbr: 'PLY', calculated: true },
      { key: 'yards', label: 'Scrimmage Yards', abbr: 'YDS', calculated: true },
      { key: 'tds', label: 'Scrimmage TDs', abbr: 'TD', calculated: true }
    ]
  },
  allPurpose: {
    name: 'All-Purpose',
    minNote: 'Rate stats require minimum 1,500 yards (career) / 300 yards (season)',
    stats: [
      { key: 'plays', label: 'All-Purpose Plays', abbr: 'PLY', calculated: true },
      { key: 'yards', label: 'All-Purpose Yards', abbr: 'YDS', calculated: true },
      { key: 'ypp', label: 'Yards/Play', abbr: 'Y/P', calculated: true, minYds: { career: 1500, season: 300 }, format: 'avg' },
      { key: 'tds', label: 'All-Purpose TDs', abbr: 'TD', calculated: true }
    ]
  },
  defensive: {
    name: 'Defensive',
    stats: [
      { key: 'soloTackles', label: 'Solo Tackles', abbr: 'SOLO', field: 'Solo Tackles' },
      { key: 'astTackles', label: 'Assisted Tackles', abbr: 'AST', field: 'Assisted Tackles' },
      { key: 'totalTackles', label: 'Total Tackles', abbr: 'TOT', calculated: true },
      { key: 'tfl', label: 'Tackles for Loss', abbr: 'TFL', field: 'Tackles for Loss' },
      { key: 'sacks', label: 'Sacks', abbr: 'SCK', field: 'Sacks' },
      { key: 'ints', label: 'Interceptions', abbr: 'INT', field: 'Interceptions' },
      { key: 'intYards', label: 'INT Return Yards', abbr: 'YDS', field: 'INT Return Yards' },
      { key: 'defTds', label: 'Defensive TDs', abbr: 'TD', field: 'Defensive TDs' },
      { key: 'pdef', label: 'Passes Defensed', abbr: 'PD', field: 'Deflections' },
      { key: 'ff', label: 'Forced Fumbles', abbr: 'FF', field: 'Forced Fumbles' },
      { key: 'blocks', label: 'Blocks', abbr: 'BLK', field: 'Blocks' },
      { key: 'safeties', label: 'Safeties', abbr: 'SAF', field: 'Safeties' }
    ]
  },
  kicking: {
    name: 'Kicking',
    minNote: 'FG% requires minimum 25 attempts (career) / 5 attempts (season)',
    stats: [
      { key: 'xpa', label: 'XP Attempted', abbr: 'XPA', field: 'XP Attempted' },
      { key: 'xpm', label: 'XP Made', abbr: 'XPM', field: 'XP Made' },
      { key: 'fga', label: 'FG Attempted', abbr: 'FGA', field: 'FG Attempted' },
      { key: 'fgm', label: 'FG Made', abbr: 'FGM', field: 'FG Made' },
      { key: 'fgPct', label: 'FG %', abbr: 'FG%', calculated: true, minAtt: { career: 25, season: 5 }, format: 'pct' }
    ]
  },
  punting: {
    name: 'Punting',
    minNote: 'Rate stats require minimum 50 punts (career) / 10 punts (season)',
    stats: [
      { key: 'punts', label: 'Punts', abbr: 'P', field: 'Punts' },
      { key: 'yards', label: 'Punt Yards', abbr: 'YDS', field: 'Punting Yards' },
      { key: 'ypp', label: 'Yards/Punt', abbr: 'Y/P', calculated: true, minAtt: { career: 50, season: 10 }, format: 'avg' }
    ]
  },
  kickReturn: {
    name: 'Kick Returns',
    minNote: 'Rate stats require minimum 20 returns (career) / 5 returns (season)',
    stats: [
      { key: 'returns', label: 'Kick Returns', abbr: 'RET', field: 'Kickoff Returns' },
      { key: 'yards', label: 'KR Yards', abbr: 'YDS', field: 'KR Yardage' },
      { key: 'avg', label: 'Yards/Return', abbr: 'AVG', calculated: true, minAtt: { career: 20, season: 5 }, format: 'avg' },
      { key: 'tds', label: 'KR TDs', abbr: 'TD', field: 'KR Touchdowns' }
    ]
  },
  puntReturn: {
    name: 'Punt Returns',
    minNote: 'Rate stats require minimum 20 returns (career) / 5 returns (season)',
    stats: [
      { key: 'returns', label: 'Punt Returns', abbr: 'RET', field: 'Punt Returns' },
      { key: 'yards', label: 'PR Yards', abbr: 'YDS', field: 'PR Yardage' },
      { key: 'avg', label: 'Yards/Return', abbr: 'AVG', calculated: true, minAtt: { career: 20, season: 5 }, format: 'avg' },
      { key: 'tds', label: 'PR TDs', abbr: 'TD', field: 'PR Touchdowns' }
    ]
  }
}

export default function DynastyRecords() {
  const { id: dynastyId } = useParams()
  const { currentDynasty } = useDynasty()
  const pathPrefix = usePathPrefix()
  const [mode, setMode] = useState(() => {
    // Restore mode from localStorage
    return localStorage.getItem('leaderboard-mode') || 'career'
  })
  const [expandedCategories, setExpandedCategories] = useState(() => {
    // Restore expanded categories from localStorage
    const saved = localStorage.getItem('leaderboard-expanded')
    return saved ? JSON.parse(saved) : ['passing']
  })

  // Get user's roster players (not honor-only)
  const getRosterPlayers = () => {
    if (!currentDynasty?.players) return []
    return currentDynasty.players.filter(p => !p.isHonorOnly)
  }

  // Get player info by PID
  const getPlayerInfo = (pid) => {
    const player = currentDynasty?.players?.find(p => p.pid === pid)
    // Get the team - use player's team if set, otherwise current dynasty team
    const playerTeam = player?.team || currentDynasty?.teamName
    const teamAbbr = getAbbreviationFromDisplayName(playerTeam) || playerTeam
    const teamLogo = getTeamLogo(playerTeam)
    return {
      name: player?.name || `Player ${pid}`,
      team: playerTeam,
      teamAbbr,
      teamLogo
    }
  }

  // Get player name by PID (legacy helper)
  const getPlayerName = (pid) => getPlayerInfo(pid).name

  // Calculate leaderboards
  const leaderboards = useMemo(() => {
    const rosterPids = new Set(getRosterPlayers().map(p => p.pid))

    // Combine stats from both sources:
    // 1. detailedStatsByYear (end-of-season entry from sheets/player profile)
    // 2. Box scores from games (computed on the fly)
    const endOfSeasonStats = currentDynasty?.detailedStatsByYear || {}
    const boxScoreStats = aggregateBoxScoreStats(currentDynasty) || {}
    const playerStats = currentDynasty?.playerStatsByYear || {}

    // Merge both stat sources into one combined structure
    const combinedStats = {}
    const allYears = new Set([...Object.keys(endOfSeasonStats), ...Object.keys(boxScoreStats)])

    allYears.forEach(year => {
      combinedStats[year] = {}
      const eosYear = endOfSeasonStats[year] || {}
      const boxYear = boxScoreStats[year] || {}
      const allCategories = new Set([...Object.keys(eosYear), ...Object.keys(boxYear)])

      allCategories.forEach(category => {
        const eosData = eosYear[category] || []
        const boxData = boxYear[category] || []

        // Merge by PID - combine stats from both sources
        const playerMap = {}

        // Add end-of-season stats
        eosData.forEach(entry => {
          if (!entry.pid) return
          playerMap[entry.pid] = { ...entry }
        })

        // Add/merge box score stats
        boxData.forEach(entry => {
          if (!entry.pid) return
          if (!playerMap[entry.pid]) {
            playerMap[entry.pid] = { ...entry }
          } else {
            // Merge - add numeric values
            Object.entries(entry).forEach(([key, value]) => {
              if (key === 'pid' || key === 'name') return
              if (typeof value === 'number') {
                playerMap[entry.pid][key] = (playerMap[entry.pid][key] || 0) + value
              }
            })
          }
        })

        combinedStats[year][category] = Object.values(playerMap)
      })
    })

    if (Object.keys(combinedStats).length === 0) return {}

    // Aggregate stats by player (career) or by player/year (season)
    const aggregateStats = (category) => {
      // Career mode: aggregate across all years
      // Season mode: keep each year separate
      const playerTotals = {}

      const years = Object.keys(combinedStats)

      years.forEach(year => {
        const yearData = combinedStats[year] || {}
        const playerYearStats = playerStats[year] || []

        // Map category to tab name
        const tabMap = {
          passing: 'Passing',
          rushing: 'Rushing',
          receiving: 'Receiving',
          defensive: 'Defensive',
          kicking: 'Kicking',
          punting: 'Punting',
          kickReturn: 'Kick Return',
          puntReturn: 'Punt Return'
        }

        const tabName = tabMap[category]
        if (!tabName) return

        const tabData = yearData[tabName] || []

        tabData.forEach(entry => {
          if (!entry.pid || !rosterPids.has(entry.pid)) return

          // For career mode: key by pid only (aggregate)
          // For season mode: key by pid+year (keep separate)
          const key = mode === 'career' ? entry.pid : `${entry.pid}-${year}`

          if (!playerTotals[key]) {
            playerTotals[key] = {
              pid: entry.pid,
              year: parseInt(year), // Single year for season mode
              years: [],
              gamesPlayed: 0
            }
          }

          if (!playerTotals[key].years.includes(parseInt(year))) {
            playerTotals[key].years.push(parseInt(year))
          }

          // Get games played from playerStatsByYear
          const basicStats = playerYearStats.find(p => p.pid === entry.pid)
          if (basicStats?.gamesPlayed) {
            if (mode === 'career') {
              playerTotals[key].gamesPlayed += basicStats.gamesPlayed
            } else {
              playerTotals[key].gamesPlayed = basicStats.gamesPlayed
            }
          }

          // Aggregate all numeric fields
          Object.entries(entry).forEach(([keyName, value]) => {
            if (keyName === 'pid' || keyName === 'name' || keyName === 'position' || keyName === 'year') return
            if (typeof value === 'number') {
              if (mode === 'career') {
                playerTotals[key][keyName] = (playerTotals[key][keyName] || 0) + value
              } else {
                playerTotals[key][keyName] = value
              }
            }
          })
        })
      })

      return Object.values(playerTotals)
    }

    // Calculate scrimmage stats (combined rush + receiving)
    const calcScrimmageStats = () => {
      if (mode === 'career') {
        // Career mode: aggregate all years
        const rushStats = aggregateStats('rushing')
        const recStats = aggregateStats('receiving')

        const combined = {}

        rushStats.forEach(p => {
          combined[p.pid] = {
            pid: p.pid,
            years: [...(p.years || [])],
            plays: (p['Carries'] || 0),
            yards: (p['Yards'] || 0),
            tds: (p['Touchdowns'] || 0)
          }
        })

        recStats.forEach(p => {
          if (!combined[p.pid]) {
            combined[p.pid] = { pid: p.pid, years: [], plays: 0, yards: 0, tds: 0 }
          }
          combined[p.pid].plays += (p['Receptions'] || 0)
          combined[p.pid].yards += (p['Yards'] || 0)
          combined[p.pid].tds += (p['Touchdowns'] || 0)
          p.years?.forEach(y => {
            if (!combined[p.pid].years.includes(y)) combined[p.pid].years.push(y)
          })
        })

        return Object.values(combined)
      } else {
        // Season mode: combine per year for each player
        const combined = {}
        const years = Object.keys(combinedStats)

        years.forEach(year => {
          const yearData = combinedStats[year] || {}
          const rushData = yearData['Rushing'] || []
          const recData = yearData['Receiving'] || []

          // Combine rush + rec for each player in this year
          const yearCombined = {}

          rushData.forEach(entry => {
            if (!entry.pid || !rosterPids.has(entry.pid)) return
            yearCombined[entry.pid] = {
              pid: entry.pid,
              year: parseInt(year),
              plays: (entry['Carries'] || 0),
              yards: (entry['Yards'] || 0),
              tds: (entry['Touchdowns'] || 0)
            }
          })

          recData.forEach(entry => {
            if (!entry.pid || !rosterPids.has(entry.pid)) return
            if (!yearCombined[entry.pid]) {
              yearCombined[entry.pid] = { pid: entry.pid, year: parseInt(year), plays: 0, yards: 0, tds: 0 }
            }
            yearCombined[entry.pid].plays += (entry['Receptions'] || 0)
            yearCombined[entry.pid].yards += (entry['Yards'] || 0)
            yearCombined[entry.pid].tds += (entry['Touchdowns'] || 0)
          })

          // Add to combined with year key
          Object.values(yearCombined).forEach(p => {
            combined[`${p.pid}-${year}`] = p
          })
        })

        return Object.values(combined)
      }
    }

    // Calculate all-purpose stats
    const calcAllPurposeStats = () => {
      if (mode === 'career') {
        const rushStats = aggregateStats('rushing')
        const recStats = aggregateStats('receiving')
        const krStats = aggregateStats('kickReturn')
        const prStats = aggregateStats('puntReturn')

        const combined = {}

        const addStats = (stats, playsField, yardsField, tdsField) => {
          stats.forEach(p => {
            if (!combined[p.pid]) {
              combined[p.pid] = { pid: p.pid, years: [], plays: 0, yards: 0, tds: 0 }
            }
            combined[p.pid].plays += (p[playsField] || 0)
            combined[p.pid].yards += (p[yardsField] || 0)
            combined[p.pid].tds += (p[tdsField] || 0)
            p.years?.forEach(y => {
              if (!combined[p.pid].years.includes(y)) combined[p.pid].years.push(y)
            })
          })
        }

        addStats(rushStats, 'Carries', 'Yards', 'Touchdowns')
        addStats(recStats, 'Receptions', 'Yards', 'Touchdowns')
        addStats(krStats, 'Kickoff Returns', 'KR Yardage', 'KR Touchdowns')
        addStats(prStats, 'Punt Returns', 'PR Yardage', 'PR Touchdowns')

        return Object.values(combined)
      } else {
        // Season mode: combine all sources per year for each player
        const combined = {}
        const years = Object.keys(combinedStats)

        years.forEach(year => {
          const yearData = combinedStats[year] || {}
          const rushData = yearData['Rushing'] || []
          const recData = yearData['Receiving'] || []
          const krData = yearData['Kick Return'] || []
          const prData = yearData['Punt Return'] || []

          const yearCombined = {}

          const addYearStats = (data, playsField, yardsField, tdsField) => {
            data.forEach(entry => {
              if (!entry.pid || !rosterPids.has(entry.pid)) return
              if (!yearCombined[entry.pid]) {
                yearCombined[entry.pid] = { pid: entry.pid, year: parseInt(year), plays: 0, yards: 0, tds: 0 }
              }
              yearCombined[entry.pid].plays += (entry[playsField] || 0)
              yearCombined[entry.pid].yards += (entry[yardsField] || 0)
              yearCombined[entry.pid].tds += (entry[tdsField] || 0)
            })
          }

          addYearStats(rushData, 'Carries', 'Yards', 'Touchdowns')
          addYearStats(recData, 'Receptions', 'Yards', 'Touchdowns')
          addYearStats(krData, 'Kickoff Returns', 'KR Yardage', 'KR Touchdowns')
          addYearStats(prData, 'Punt Returns', 'PR Yardage', 'PR Touchdowns')

          Object.values(yearCombined).forEach(p => {
            combined[`${p.pid}-${year}`] = p
          })
        })

        return Object.values(combined)
      }
    }

    // Build leaderboards for each category
    const result = {}

    Object.entries(STAT_CATEGORIES).forEach(([catKey, category]) => {
      let baseStats

      if (catKey === 'scrimmage') {
        baseStats = calcScrimmageStats()
      } else if (catKey === 'allPurpose') {
        baseStats = calcAllPurposeStats()
      } else {
        baseStats = aggregateStats(catKey)
      }

      result[catKey] = {}

      category.stats.forEach(stat => {
        let leaderboard = baseStats.map(p => {
          let value

          if (stat.calculated) {
            // Calculate derived stats
            switch (catKey) {
              case 'passing':
                const att = p['Attempts'] || 0
                const cmp = p['Completions'] || 0
                const yds = p['Yards'] || 0
                const tds = p['Touchdowns'] || 0
                const ints = p['Interceptions'] || 0

                if (stat.key === 'compPct') value = att > 0 ? (cmp / att * 100) : 0
                else if (stat.key === 'ypa') value = att > 0 ? (yds / att) : 0
                else if (stat.key === 'aypa') value = att > 0 ? ((yds + 20 * tds - 45 * ints) / att) : 0
                else if (stat.key === 'rating') {
                  // NCAA passer rating formula
                  if (att > 0) {
                    const a = Math.max(0, Math.min(((cmp / att) - 0.3) * 20, 2.375))
                    const b = Math.max(0, Math.min(((yds / att) - 3) * 0.25, 2.375))
                    const c = Math.max(0, Math.min((tds / att) * 20, 2.375))
                    const d = Math.max(0, 2.375 - ((ints / att) * 25))
                    value = ((a + b + c + d) / 6) * 100
                  } else value = 0
                }
                else if (stat.key === 'ypg') value = p.gamesPlayed > 0 ? (yds / p.gamesPlayed) : 0
                else if (stat.key === 'tdPct') value = att > 0 ? (tds / att * 100) : 0
                else if (stat.key === 'intPct') value = att > 0 ? (ints / att * 100) : 0

                // Apply minimum attempts filter
                if (stat.minAtt) {
                  const minReq = mode === 'career' ? stat.minAtt.career : stat.minAtt.season
                  if (att < minReq) value = null
                }
                break

              case 'rushing':
                const rushAtt = p['Carries'] || 0
                const rushYds = p['Yards'] || 0
                if (stat.key === 'ypc') {
                  value = rushAtt > 0 ? (rushYds / rushAtt) : 0
                  if (stat.minAtt) {
                    const minReq = mode === 'career' ? stat.minAtt.career : stat.minAtt.season
                    if (rushAtt < minReq) value = null
                  }
                }
                break

              case 'receiving':
                const rec = p['Receptions'] || 0
                const recYds = p['Yards'] || 0
                if (stat.key === 'ypr') {
                  value = rec > 0 ? (recYds / rec) : 0
                  if (stat.minAtt) {
                    const minReq = mode === 'career' ? stat.minAtt.career : stat.minAtt.season
                    if (rec < minReq) value = null
                  }
                }
                break

              case 'scrimmage':
                if (stat.key === 'plays') value = p.plays
                else if (stat.key === 'yards') value = p.yards
                else if (stat.key === 'tds') value = p.tds
                break

              case 'allPurpose':
                if (stat.key === 'plays') value = p.plays
                else if (stat.key === 'yards') value = p.yards
                else if (stat.key === 'tds') value = p.tds
                else if (stat.key === 'ypp') {
                  value = p.plays > 0 ? (p.yards / p.plays) : 0
                  if (stat.minYds) {
                    const minReq = mode === 'career' ? stat.minYds.career : stat.minYds.season
                    if (p.yards < minReq) value = null
                  }
                }
                break

              case 'defensive':
                if (stat.key === 'totalTackles') {
                  value = (p['Solo Tackles'] || 0) + (p['Assisted Tackles'] || 0)
                }
                break

              case 'kicking':
                const fga = p['FG Attempted'] || 0
                const fgm = p['FG Made'] || 0
                if (stat.key === 'fgPct') {
                  value = fga > 0 ? (fgm / fga * 100) : 0
                  if (stat.minAtt) {
                    const minReq = mode === 'career' ? stat.minAtt.career : stat.minAtt.season
                    if (fga < minReq) value = null
                  }
                }
                break

              case 'punting':
                const punts = p['Punts'] || 0
                const puntYds = p['Punting Yards'] || 0
                if (stat.key === 'ypp') {
                  value = punts > 0 ? (puntYds / punts) : 0
                  if (stat.minAtt) {
                    const minReq = mode === 'career' ? stat.minAtt.career : stat.minAtt.season
                    if (punts < minReq) value = null
                  }
                }
                break

              case 'kickReturn':
                const krRet = p['Kickoff Returns'] || 0
                const krYds = p['KR Yardage'] || 0
                if (stat.key === 'avg') {
                  value = krRet > 0 ? (krYds / krRet) : 0
                  if (stat.minAtt) {
                    const minReq = mode === 'career' ? stat.minAtt.career : stat.minAtt.season
                    if (krRet < minReq) value = null
                  }
                }
                break

              case 'puntReturn':
                const prRet = p['Punt Returns'] || 0
                const prYds = p['PR Yardage'] || 0
                if (stat.key === 'avg') {
                  value = prRet > 0 ? (prYds / prRet) : 0
                  if (stat.minAtt) {
                    const minReq = mode === 'career' ? stat.minAtt.career : stat.minAtt.season
                    if (prRet < minReq) value = null
                  }
                }
                break
            }
          } else {
            // Direct field lookup
            value = p[stat.field] || 0
          }

          const playerInfo = getPlayerInfo(p.pid)
          return {
            pid: p.pid,
            name: playerInfo.name,
            team: playerInfo.team,
            teamAbbr: playerInfo.teamAbbr,
            teamLogo: playerInfo.teamLogo,
            value,
            year: p.year, // Single year for season mode
            years: p.years?.sort((a, b) => a - b) || []
          }
        })

        // Filter out null values and sort
        leaderboard = leaderboard
          .filter(p => p.value !== null && p.value !== undefined)
          .sort((a, b) => stat.lowerIsBetter ? a.value - b.value : b.value - a.value)
          .slice(0, 10)

        result[catKey][stat.key] = leaderboard
      })
    })

    return result
  }, [currentDynasty, mode])

  const toggleCategory = (catKey) => {
    setExpandedCategories(prev => {
      const newCategories = prev.includes(catKey)
        ? prev.filter(c => c !== catKey)
        : [...prev, catKey]
      // Save to localStorage for persistence
      localStorage.setItem('leaderboard-expanded', JSON.stringify(newCategories))
      return newCategories
    })
  }

  const formatValue = (value, format) => {
    if (value === null || value === undefined) return '-'
    switch (format) {
      case 'pct': return value.toFixed(1) + '%'
      case 'avg': return value.toFixed(1)
      case 'rating': return value.toFixed(1)
      default: return value.toLocaleString()
    }
  }

  const formatYears = (years) => {
    if (!years || years.length === 0) return '-'
    if (years.length === 1) return years[0].toString()
    return `${years[0]}-${years[years.length - 1]}`
  }

  if (!currentDynasty) return null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg shadow-lg p-6 bg-gray-800 border-2 border-gray-600">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold text-white">
            Dynasty Leaderboard
          </h1>

          <div className="flex flex-wrap items-center gap-3">
            {/* Mode Toggle */}
            <div className="flex rounded-lg overflow-hidden border-2 border-gray-500">
              <button
                onClick={() => { setMode('career'); localStorage.setItem('leaderboard-mode', 'career') }}
                className={`px-4 py-2 font-semibold text-sm transition-colors ${
                  mode === 'career' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-300 hover:bg-gray-700'
                }`}
              >
                Career
              </button>
              <button
                onClick={() => { setMode('season'); localStorage.setItem('leaderboard-mode', 'season') }}
                className={`px-4 py-2 font-semibold text-sm transition-colors ${
                  mode === 'season' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-300 hover:bg-gray-700'
                }`}
              >
                Season
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stat Categories */}
      {Object.entries(STAT_CATEGORIES).map(([catKey, category]) => {
        const isExpanded = expandedCategories.includes(catKey)
        const catLeaderboards = leaderboards[catKey] || {}

        // Check if category has any data
        const hasData = Object.values(catLeaderboards).some(lb => lb && lb.length > 0)

        return (
          <div
            key={catKey}
            className="rounded-lg shadow-lg overflow-hidden bg-gray-800 border-2 border-gray-600"
          >
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(catKey)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-600 transition-colors bg-gray-700"
            >
              <h2 className="text-lg font-bold text-white">
                {category.name}
              </h2>
              <svg
                className={`w-6 h-6 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none"
                stroke="white"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Category Content */}
            {isExpanded && (
              <div className="p-4">
                {category.minNote && (
                  <p className="text-xs mb-4 italic text-gray-400">
                    {category.minNote}
                  </p>
                )}

                {!hasData ? (
                  <p className="text-center py-8 text-gray-500">
                    No {category.name.toLowerCase()} stats recorded yet
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {category.stats.map(stat => {
                      const statLeaderboard = catLeaderboards[stat.key] || []

                      return (
                        <div
                          key={stat.key}
                          className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden"
                        >
                          <div className="px-3 py-2 border-b bg-gray-100 border-gray-200">
                            <h3 className="text-sm font-bold text-gray-800">
                              {stat.label}
                            </h3>
                          </div>

                          {statLeaderboard.length === 0 ? (
                            <div className="p-3 text-center text-xs text-gray-400">
                              No qualifying players
                            </div>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-50 border-b">
                                  <th className="px-2 py-1.5 text-left text-gray-500 font-semibold w-8">#</th>
                                  <th className="px-2 py-1.5 text-left text-gray-500 font-semibold">Player</th>
                                  <th className="px-2 py-1.5 text-right text-gray-500 font-semibold">{stat.abbr}</th>
                                  <th className="px-2 py-1.5 text-right text-gray-500 font-semibold">
                                    {mode === 'career' ? 'Years' : 'Year'}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {statLeaderboard.map((entry, idx) => (
                                  <tr
                                    key={mode === 'career' ? entry.pid : `${entry.pid}-${entry.year}`}
                                    className={`border-b last:border-b-0 ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}
                                  >
                                    <td className="px-2 py-1.5 text-gray-400 font-medium">{idx + 1}</td>
                                    <td className="px-2 py-1.5">
                                      <div className="flex items-center gap-1.5">
                                        {entry.teamLogo && (
                                          <img
                                            src={entry.teamLogo}
                                            alt={entry.teamAbbr}
                                            className="w-5 h-5 object-contain flex-shrink-0"
                                            title={entry.team}
                                          />
                                        )}
                                        <Link
                                          to={`${pathPrefix}/player/${entry.pid}`}
                                          className="font-medium hover:underline truncate max-w-[100px] text-blue-600"
                                          title={entry.name}
                                        >
                                          {entry.name}
                                        </Link>
                                      </div>
                                    </td>
                                    <td className="px-2 py-1.5 text-right font-bold text-gray-900">
                                      {formatValue(entry.value, stat.format)}
                                    </td>
                                    <td className="px-2 py-1.5 text-right text-gray-500 text-[10px]">
                                      {mode === 'career' ? formatYears(entry.years) : entry.year}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
