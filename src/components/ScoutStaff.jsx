import React, { useState, useMemo } from 'react';
import FrontPage from './ScoutStaffFrontPage';
import PlayerDatabase from './PlayerDatabase';
import ScoutAnalysis from './ScoutAnalysis';
import ThresholdLookup from './ThresholdLookup';
import PlayerCount from './PlayerCount';
import { useDynasty, getRecruitingCommitments } from '../context/DynastyContext';
import { flattenClassCommitments } from '../utils/recruitingScore';
import { positionBucket } from '../utils/recruitAttributes';
import { useTeamColors } from '../hooks/useTeamColors';

// ── Portal Board sub-view ─────────────────────────────────────────────────────
function PortalBoard({ committedRecruits, teamColors, teamLogo }) {
  const p = teamColors?.primary || '#374151';
  const portalPlayers = (committedRecruits || []).filter(r => r.isPortal || r.previousTeam);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header strip */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl" style={{ background: '#080c14', border: `1px solid ${p}22` }}>
        {teamLogo && <img src={teamLogo} alt="" className="w-6 h-6 object-contain flex-shrink-0" style={{ opacity: 0.7 }} />}
        <p style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 'clamp(1.1rem, 3vw, 1.5rem)', color: p, letterSpacing: '0.08em', lineHeight: 1 }}>TRANSFER PORTAL BOARD</p>
        <span className="ml-auto text-[9px] font-black uppercase tracking-widest" style={{ color: `${p}99` }}>
          {portalPlayers.length} Transfer{portalPlayers.length !== 1 ? 's' : ''}
        </span>
      </div>

      {portalPlayers.length === 0 ? (
        <div className="rounded-xl p-8 text-center" style={{ background: '#080c14', border: `1px solid ${p}22` }}>
          <p className="text-sm text-slate-500">No portal players in this year&apos;s class.</p>
          <p className="text-[10px] text-slate-600 mt-1">Portal commits are added via the Recruiting page. They appear here automatically once saved.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {portalPlayers.map((player, i) => {
            const stars = Number(player.stars) || 0;
            const devCls = {
              Elite: 'bg-amber-950 border-amber-700 text-amber-400',
              Star:  'bg-sky-950 border-sky-700 text-sky-400',
              Impact:'bg-emerald-950 border-emerald-700 text-emerald-400',
            }[player.devTrait] || 'bg-slate-800 border-slate-700 text-slate-400';

            return (
              <div key={player.pid || player.name || i}
                className="p-3 rounded-xl space-y-2"
                style={{ background: `linear-gradient(135deg, ${p}12, #0f172a)`, border: `1px solid ${p}30` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-white truncate">{player.name || 'Unknown'}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{player.position || '—'} · {player.archetype || '—'}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="flex gap-0.5">
                      {[...Array(5)].map((_, si) => (
                        <svg key={si} className="w-2.5 h-2.5" fill={si < stars ? '#f59e0b' : '#334155'} viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </span>
                    {player.devTrait && (
                      <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded border ${devCls}`}>{player.devTrait}</span>
                    )}
                  </div>
                </div>

                {player.previousTeam && (
                  <div className="flex items-center gap-1.5 text-[9px] text-slate-500">
                    <span className="font-bold uppercase tracking-wider text-sky-600">FROM</span>
                    <span className="text-slate-400 truncate">{player.previousTeam}</span>
                  </div>
                )}

                {(player.nationalRank || player.positionRank) && (
                  <div className="flex gap-3 text-[9px] text-slate-500">
                    {player.nationalRank && <span>Natl <span className="text-white font-bold">#{player.nationalRank}</span></span>}
                    {player.positionRank && <span>{player.position} <span className="text-white font-bold">#{player.positionRank}</span></span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ScoutStaff({ year } = {}) {
  const { currentDynasty } = useDynasty();
  const teamColors = useTeamColors(currentDynasty?.teamName, currentDynasty?.teams);
  const teamLogo   = currentDynasty?.teams?.[currentDynasty?.currentTid]?.logo || '';
  const p = teamColors?.primary   || '#374151';
  const s = teamColors?.secondary || '#ffffff';
  const [subView, setSubView] = useState('home');

  // The recruit board IS the recruiting Targets board — a single shared source.
  // Targets entered via the recruiting sheet (dynasty.players, isTarget) flow
  // straight into Scout Staff; attributes are already stored under the same
  // canonical names the grading engine expects (see utils/recruitAttributes.js).
  // We only normalize the raw game position to its grading bucket (RT → OT).
  const boardYear = Number(year ?? currentDynasty?.currentYear);
  const recruits = useMemo(() => {
    const players = currentDynasty?.players || [];
    return players
      .filter(pl => pl?.isTarget && Number(pl.targetYear) === boardYear && pl.name)
      .map(pl => {
        const position = positionBucket(pl.position);
        const group = position === 'ATH'
          ? 'Athlete Pipeline'
          : ['QB', 'HB', 'WR', 'TE', 'OT', 'OG', 'C'].includes(position) ? 'Offense' : 'Defense';
        return {
          pid: pl.pid,
          name: pl.name,
          position,
          archetype: pl.archetype || '',
          devTrait: pl.devTrait || '',
          stars: pl.stars,
          attributes: pl.attributes || {},
          group,
          isPortal: pl.isPortal,
          previousTeam: pl.previousTeam,
          nationalRank: pl.nationalRank,
          positionRank: pl.positionRank,
        };
      });
  }, [currentDynasty?.players, boardYear]);

  // Committed recruits for the current team/year, pulled from dynasty recruiting data
  const committedRecruits = useMemo(() => {
    if (!currentDynasty?.currentTid || !currentDynasty?.currentYear) return [];
    const raw = getRecruitingCommitments(currentDynasty, currentDynasty.currentTid, currentDynasty.currentYear);
    return flattenClassCommitments(raw);
  }, [currentDynasty]);

  const VIEW_META = {
    home:      { title: 'Scout Staff Intelligence Engine', sub: 'Integrating field intelligence with structured positional data' },
    database:  { title: 'Player Database',   sub: 'Complete Data Storage' },
    thresholds:{ title: 'Threshold Lookup',  sub: 'Player Comparison Tool' },
    analysis:  { title: 'Data Analysis',     sub: 'Staff Recommendations' },
    counts:    { title: 'Player Count',      sub: 'Current Overview' },
    portal:    { title: 'Portal Board',      sub: 'Transfer portal commitments' },
  };
  const meta = VIEW_META[subView] || VIEW_META.home;

  const teamTheme = { teamColors, teamLogo };

  return (
    <div
      className="w-full p-6 text-slate-100 rounded-xl shadow-2xl relative overflow-hidden"
      style={{
        background: `linear-gradient(155deg, ${p}22 0%, #020617 35%, #020617 70%, ${s}0a 100%)`,
        border: `1px solid ${p}35`,
      }}
    >
      {/* Full-page logo watermark */}
      {teamLogo && (
        <img
          src={teamLogo}
          alt=""
          className="absolute top-6 right-6 w-56 h-56 pointer-events-none select-none object-contain"
          style={{ opacity: 0.07, filter: 'grayscale(20%)' }}
        />
      )}

      <header className="flex justify-between items-center mb-6 pb-4 relative" style={{ borderBottom: `1px solid ${p}40` }}>
        <div>
          <h2 className="text-2xl font-bold text-white cursor-pointer" onClick={() => setSubView('home')}>{meta.title}</h2>
          <p className="text-sm text-slate-400">{meta.sub}</p>
        </div>
        {subView !== 'home' && (
          <button
            onClick={() => setSubView('home')}
            className="text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg text-slate-400 transition"
            style={{ background: `${p}18`, border: `1px solid ${p}40` }}
          >
            ← Main Hub
          </button>
        )}
      </header>

      <div className="mt-4">
        {subView === 'home' && <FrontPage setView={setSubView} currentTeamName={currentDynasty?.teamName || 'college football team'} currentYear={currentDynasty?.currentYear || new Date().getFullYear()} {...teamTheme} />}

        {/* Read-only: the board mirrors the recruiting Targets sheet. Add or edit
            recruits there (the same place the default Targets tab uses). */}
        {subView === 'database'   && <PlayerDatabase players={recruits} roleContext="Regional Scout" {...teamTheme} onGoToThresholds={() => setSubView('thresholds')} />}
        {subView === 'thresholds' && <ThresholdLookup players={recruits} roleContext="Data Analyst" {...teamTheme} onGoToDatabase={() => setSubView('database')} />}
        {subView === 'analysis'   && <ScoutAnalysis players={recruits} roleContext="Data Analyst" {...teamTheme} dynasty={currentDynasty} committedRecruits={committedRecruits} />}
        {subView === 'counts'     && <PlayerCount players={recruits} roleContext="Regional Scout" {...teamTheme} committedRecruits={committedRecruits} currentYear={currentDynasty?.currentYear} />}
        {subView === 'portal'     && <PortalBoard committedRecruits={committedRecruits} {...teamTheme} />}
      </div>
    </div>
  );
}