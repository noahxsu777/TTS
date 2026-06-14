import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy, Clock, RefreshCw, Loader2, Calendar,
  Circle, ChevronDown, ChevronRight, Zap,
} from 'lucide-react';

interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  status: 'NS' | 'LIVE' | '1H' | '2H' | 'HT' | 'ET' | 'FT' | 'AET' | 'PEN' | string;
  minute?: number | null;
  competition: string;
  competitionLogo?: string;
  kickoff: string; // ISO
  homeLogo?: string;
  awayLogo?: string;
  venue?: string;
}

// ── Free public football API (football-data.org v4 / TheSportsDB) ─────────────
// Proxy through our server to avoid CORS & key exposure
async function fetchMatches(): Promise<Match[]> {
  try {
    const r = await fetch('/api/football-schedule', { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch {
    return getMockMatches();
  }
}

function getMockMatches(): Match[] {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString();
  const add = (h: number) => { const d = new Date(today); d.setHours(d.getHours() + h); return fmt(d); };

  return [
    { id: '1', homeTeam: 'Real Madrid', awayTeam: 'Barcelona', homeScore: 2, awayScore: 1, status: 'LIVE', minute: 67, competition: 'La Liga', kickoff: add(-1), homeLogo: '', awayLogo: '' },
    { id: '2', homeTeam: 'Manchester City', awayTeam: 'Arsenal', homeScore: null, awayScore: null, status: 'NS', competition: 'Premier League', kickoff: add(1) },
    { id: '3', homeTeam: 'PSG', awayTeam: 'Lyon', homeScore: null, awayScore: null, status: 'NS', competition: 'Ligue 1', kickoff: add(2) },
    { id: '4', homeTeam: 'Bayern Munich', awayTeam: 'Dortmund', homeScore: 3, awayScore: 2, status: 'FT', competition: 'Bundesliga', kickoff: add(-4) },
    { id: '5', homeTeam: 'Juventus', awayTeam: 'Inter', homeScore: 1, awayScore: 1, status: 'HT', competition: 'Serie A', kickoff: add(-1) },
    { id: '6', homeTeam: 'Atlético Madrid', awayTeam: 'Sevilla', homeScore: null, awayScore: null, status: 'NS', competition: 'La Liga', kickoff: add(3) },
    { id: '7', homeTeam: 'Chelsea', awayTeam: 'Liverpool', homeScore: null, awayScore: null, status: 'NS', competition: 'Premier League', kickoff: add(5) },
    { id: '8', homeTeam: 'América', awayTeam: 'Chivas', homeScore: null, awayScore: null, status: 'NS', competition: 'Liga MX', kickoff: add(4) },
    { id: '9', homeTeam: 'Nacional', awayTeam: 'Millonarios', homeScore: null, awayScore: null, status: 'NS', competition: 'Liga BetPlay', kickoff: add(6) },
    { id: '10', homeTeam: 'Flamengo', awayTeam: 'Palmeiras', homeScore: 0, awayScore: 0, status: '2H', minute: 78, competition: 'Brasileirão', kickoff: add(-1) },
  ];
}

function statusLabel(m: Match): { text: string; color: string; live: boolean } {
  switch (m.status) {
    case 'LIVE':
    case '1H':
    case '2H':
    case 'ET':
      return { text: m.minute ? `${m.minute}'` : 'EN VIVO', color: '#30D158', live: true };
    case 'HT':
      return { text: 'DESCANSO', color: '#FF9F0A', live: true };
    case 'FT':
    case 'AET':
    case 'PEN':
      return { text: 'FINALIZADO', color: 'rgba(255,255,255,0.3)', live: false };
    case 'NS':
    default: {
      const ko = new Date(m.kickoff);
      const h = ko.getHours().toString().padStart(2, '0');
      const min = ko.getMinutes().toString().padStart(2, '0');
      return { text: `${h}:${min}`, color: 'rgba(255,255,255,0.55)', live: false };
    }
  }
}

function groupByCompetition(matches: Match[]): Record<string, Match[]> {
  const g: Record<string, Match[]> = {};
  for (const m of matches) {
    (g[m.competition] ??= []).push(m);
  }
  // Sort: live first, then by kickoff
  for (const k of Object.keys(g)) {
    g[k].sort((a, b) => {
      const aLive = ['LIVE','1H','2H','HT','ET'].includes(a.status) ? 0 : 1;
      const bLive = ['LIVE','1H','2H','HT','ET'].includes(b.status) ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      return new Date(a.kickoff).getTime() - new Date(b.kickoff).getTime();
    });
  }
  return g;
}

function TeamLogo({ src, name }: { src?: string; name: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return <img src={src} alt={name} className="w-7 h-7 object-contain flex-shrink-0 rounded-full" onError={() => setErr(true)} />;
}

export default function MatchSchedule() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all');

  const refresh = useCallback(async () => {
    setLoading(true);
    const data = await fetchMatches();
    setMatches(data);
    setLastUpdate(new Date());
    // Auto-open groups that have live matches
    const g = groupByCompetition(data);
    const open: Record<string, boolean> = {};
    for (const [comp, ms] of Object.entries(g)) {
      if (ms.some(m => ['LIVE','1H','2H','HT','ET'].includes(m.status))) open[comp] = true;
    }
    // Always open first group
    const first = Object.keys(g)[0];
    if (first) open[first] = true;
    setOpenGroups(open);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    // Auto-refresh every 60s
    const iv = setInterval(refresh, 60000);
    return () => clearInterval(iv);
  }, [refresh]);

  const filtered = matches.filter(m => {
    if (filter === 'live') return ['LIVE','1H','2H','HT','ET'].includes(m.status);
    if (filter === 'upcoming') return m.status === 'NS';
    if (filter === 'finished') return ['FT','AET','PEN'].includes(m.status);
    return true;
  });

  const groups = groupByCompetition(filtered);

  const liveCount = matches.filter(m => ['LIVE','1H','2H','HT','ET'].includes(m.status)).length;
  const upcomingCount = matches.filter(m => m.status === 'NS').length;

  const FILTERS: { id: typeof filter; label: string }[] = [
    { id: 'all', label: 'Todos' },
    { id: 'live', label: `En vivo${liveCount ? ` (${liveCount})` : ''}` },
    { id: 'upcoming', label: 'Próximos' },
    { id: 'finished', label: 'Finalizados' },
  ];

  return (
    <div className="glass-card overflow-hidden" style={{ borderColor: 'rgba(48,209,88,0.15)' }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.05]"
        style={{ background: 'rgba(48,209,88,0.06)' }}>
        <Trophy size={14} style={{ color: '#30D158' }} />
        <span className="text-xs font-semibold text-white/80">Agenda Fútbol</span>

        {liveCount > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(48,209,88,0.15)', border: '1px solid rgba(48,209,88,0.3)' }}>
            <span className="live-dot" style={{ width: 6, height: 6 }} />
            <span className="text-[9px] font-bold text-[#30D158]">{liveCount} EN VIVO</span>
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {lastUpdate && (
            <span className="text-[9px] text-white/20 font-mono hidden sm:block">
              {lastUpdate.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={refresh}
            disabled={loading}
            className="p-1.5 rounded-ios-sm hover:bg-white/[0.06] transition-colors"
            style={{ color: loading ? 'rgba(255,255,255,0.2)' : '#30D158' }}
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex border-b border-white/[0.04] overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="flex-shrink-0 px-3 py-2 text-[11px] font-semibold whitespace-nowrap transition-all relative"
            style={{ color: filter === f.id ? '#30D158' : 'rgba(255,255,255,0.3)' }}
          >
            {f.label}
            {filter === f.id && (
              <motion.div layoutId="match-filter-bar"
                className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full"
                style={{ background: '#30D158', boxShadow: '0 0 8px rgba(48,209,88,0.5)' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="overflow-y-auto feed-scroll" style={{ maxHeight: 480 }}>
        {loading && matches.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[#30D158]">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-xs">Cargando partidos…</span>
          </div>
        ) : Object.keys(groups).length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12">
            <Calendar size={28} style={{ color: 'rgba(255,255,255,0.15)' }} />
            <p className="text-xs text-white/30">No hay partidos en esta categoría</p>
          </div>
        ) : (
          Object.entries(groups).map(([comp, ms]) => (
            <div key={comp}>
              {/* Competition header */}
              <button
                onClick={() => setOpenGroups(p => ({ ...p, [comp]: !p[comp] }))}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/[0.02] transition-colors"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}
              >
                <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(48,209,88,0.1)' }}>
                  <Trophy size={10} style={{ color: '#30D158' }} />
                </div>
                <span className="text-[11px] font-bold text-white/60 truncate">{comp}</span>
                <span className="ml-auto text-[9px] text-white/25 font-mono mr-1">{ms.length}</span>
                <ChevronRight size={10} className="flex-shrink-0 transition-transform"
                  style={{ color: 'rgba(255,255,255,0.25)', transform: openGroups[comp] ? 'rotate(90deg)' : undefined }} />
              </button>

              <AnimatePresence initial={false}>
                {openGroups[comp] && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden"
                  >
                    {ms.map(m => {
                      const st = statusLabel(m);
                      const isLive = st.live;
                      const hasScore = m.homeScore !== null && m.awayScore !== null;

                      return (
                        <div
                          key={m.id}
                          className="px-4 py-3 flex items-center gap-3 transition-colors"
                          style={{
                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                            background: isLive ? 'rgba(48,209,88,0.03)' : undefined,
                          }}
                        >
                          {/* Status */}
                          <div className="w-14 flex-shrink-0 text-center">
                            {isLive && (
                              <span className="live-dot inline-block mr-1" style={{ width: 5, height: 5 }} />
                            )}
                            <span className="text-[10px] font-bold"
                              style={{ color: st.color }}>
                              {st.text}
                            </span>
                          </div>

                          {/* Teams */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <TeamLogo src={m.homeLogo} name={m.homeTeam} />
                              <span className="text-xs text-white/80 truncate font-medium flex-1">{m.homeTeam}</span>
                              {hasScore && (
                                <span className="text-sm font-bold font-mono ml-auto" style={{ color: isLive ? '#30D158' : 'rgba(255,255,255,0.85)' }}>
                                  {m.homeScore}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <TeamLogo src={m.awayLogo} name={m.awayTeam} />
                              <span className="text-xs text-white/55 truncate flex-1">{m.awayTeam}</span>
                              {hasScore && (
                                <span className="text-sm font-bold font-mono ml-auto" style={{ color: isLive ? '#30D158' : 'rgba(255,255,255,0.85)' }}>
                                  {m.awayScore}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))
        )}
      </div>

      {/* Footer note */}
      <div className="px-4 py-2 border-t border-white/[0.03] flex items-center gap-1.5">
        <Zap size={9} style={{ color: 'rgba(255,255,255,0.2)' }} />
        <span className="text-[9px] text-white/20">Actualización automática cada 60 segundos</span>
      </div>
    </div>
  );
}
