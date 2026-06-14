import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Trophy, RefreshCw, Loader2, Calendar,
  ChevronRight, Zap, Play, Tv, AlertCircle, ExternalLink,
} from 'lucide-react';

interface FLMatch {
  id: string;
  title: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoff: string;
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  streamPageUrl: string;
  homeLogo?: string;
  awayLogo?: string;
}

interface MatchScheduleProps {
  onPlayStream?: (url: string, name: string) => void;
}

function statusBadge(m: FLMatch): { text: string; color: string; live: boolean } {
  const s = m.status;
  if (['LIVE', '1H', '2H', 'ET'].includes(s))
    return { text: 'EN VIVO', color: '#30D158', live: true };
  if (s === 'HT') return { text: 'DESCANSO', color: '#FF9F0A', live: true };
  if (['FT', 'AET', 'PEN'].includes(s))
    return { text: 'FINALIZADO', color: 'rgba(255,255,255,0.3)', live: false };
  // Try to parse time from kickoff
  try {
    const d = new Date(m.kickoff);
    if (!isNaN(d.getTime())) {
      return {
        text: `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`,
        color: 'rgba(255,255,255,0.5)',
        live: false,
      };
    }
  } catch {}
  return { text: m.kickoff.slice(0, 5) || 'HOY', color: 'rgba(255,255,255,0.5)', live: false };
}

function groupByComp(matches: FLMatch[]): Record<string, FLMatch[]> {
  const g: Record<string, FLMatch[]> = {};
  for (const m of matches) {
    const k = m.competition || 'Fútbol';
    (g[k] ??= []).push(m);
  }
  for (const k of Object.keys(g)) {
    g[k].sort((a, b) => {
      const aL = a.status === 'LIVE' ? 0 : a.status === 'NS' ? 1 : 2;
      const bL = b.status === 'LIVE' ? 0 : b.status === 'NS' ? 1 : 2;
      return aL - bL;
    });
  }
  return g;
}

function TeamLogo({ src, name }: { src?: string; name: string }) {
  const [err, setErr] = useState(false);
  if (!src || err) {
    return (
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
        style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.4)' }}>
        {name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <img src={src} alt={name}
      className="w-7 h-7 object-contain flex-shrink-0 rounded-full"
      style={{ background: 'rgba(255,255,255,0.04)' }}
      onError={() => setErr(true)}
    />
  );
}

export default function MatchSchedule({ onPlayStream }: MatchScheduleProps) {
  const [matches, setMatches] = useState<FLMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState<'all' | 'live' | 'upcoming' | 'finished'>('all');
  const [loadingStream, setLoadingStream] = useState<string | null>(null);
  const [streamErr, setStreamErr] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/fl-schedule', { signal: AbortSignal.timeout(15000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data: FLMatch[] = await r.json();
      if (data.error) throw new Error(data.error as any);
      setMatches(data);
      setLastUpdate(new Date());

      // Open groups with live matches + first group
      const g = groupByComp(data);
      const open: Record<string, boolean> = {};
      for (const [comp, ms] of Object.entries(g)) {
        if (ms.some(m => m.status === 'LIVE')) open[comp] = true;
      }
      const first = Object.keys(g)[0];
      if (first) open[first] = true;
      setOpenGroups(open);
    } catch (e: any) {
      setError(e?.message ?? 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const iv = setInterval(refresh, 90000);
    return () => clearInterval(iv);
  }, [refresh]);

  const handlePlay = useCallback(async (m: FLMatch) => {
    if (!m.streamPageUrl) return;
    setStreamErr(null);
    setLoadingStream(m.id);
    try {
      const r = await fetch(`/api/fl-stream?url=${encodeURIComponent(m.streamPageUrl)}`, {
        signal: AbortSignal.timeout(15000),
      });
      const data = await r.json();
      const streams: string[] = data.streams ?? [];

      if (streams.length > 0) {
        const best = streams.find(s => s.includes('.m3u8')) ?? streams[0];
        onPlayStream?.(best, m.title || `${m.homeTeam} vs ${m.awayTeam}`);
      } else {
        // Fallback: open the page URL itself in the IPTV player
        onPlayStream?.(m.streamPageUrl, m.title || `${m.homeTeam} vs ${m.awayTeam}`);
      }
    } catch {
      setStreamErr(m.id);
    } finally {
      setLoadingStream(null);
    }
  }, [onPlayStream]);

  const filtered = matches.filter(m => {
    if (filter === 'live') return m.status === 'LIVE';
    if (filter === 'upcoming') return m.status === 'NS';
    if (filter === 'finished') return ['FT','AET','PEN'].includes(m.status);
    return true;
  });

  const groups = groupByComp(filtered);
  const liveCount = matches.filter(m => m.status === 'LIVE').length;

  const FILTERS = [
    { id: 'all' as const, label: 'Todos' },
    { id: 'live' as const, label: liveCount ? `En vivo (${liveCount})` : 'En vivo' },
    { id: 'upcoming' as const, label: 'Próximos' },
    { id: 'finished' as const, label: 'Finalizados' },
  ];

  return (
    <div className="glass-card overflow-hidden" style={{ borderColor: 'rgba(48,209,88,0.15)' }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.05]"
        style={{ background: 'rgba(48,209,88,0.06)' }}>
        <Trophy size={14} style={{ color: '#30D158' }} />
        <span className="text-xs font-semibold text-white/80">Fútbol Libres</span>

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
          <button key={f.id} onClick={() => setFilter(f.id)}
            className="flex-shrink-0 px-3 py-2 text-[11px] font-semibold whitespace-nowrap transition-all relative"
            style={{ color: filter === f.id ? '#30D158' : 'rgba(255,255,255,0.3)' }}>
            {f.label}
            {filter === f.id && (
              <motion.div layoutId="fl-filter-bar"
                className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full"
                style={{ background: '#30D158', boxShadow: '0 0 8px rgba(48,209,88,0.5)' }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="overflow-y-auto feed-scroll" style={{ maxHeight: 500 }}>
        {loading && matches.length === 0 && (
          <div className="flex items-center justify-center gap-2 py-12 text-[#30D158]">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-xs">Cargando agenda…</span>
          </div>
        )}

        {!loading && error && matches.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10 px-6 text-center">
            <AlertCircle size={24} style={{ color: '#FF453A' }} />
            <p className="text-xs text-white/40">{error}</p>
            <button onClick={refresh} className="btn-green text-xs px-3 py-1.5 mt-1">Reintentar</button>
          </div>
        )}

        {!loading && !error && matches.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-10">
            <Calendar size={28} style={{ color: 'rgba(255,255,255,0.15)' }} />
            <p className="text-xs text-white/30">No hay partidos disponibles</p>
          </div>
        )}

        {Object.entries(groups).map(([comp, ms]) => (
          <div key={comp}>
            {/* Competition header */}
            <button
              onClick={() => setOpenGroups(p => ({ ...p, [comp]: !p[comp] }))}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-white/[0.02] transition-colors sticky top-0 z-10"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(10,10,12,0.8)', backdropFilter: 'blur(8px)' }}
            >
              <Trophy size={10} style={{ color: '#30D158' }} />
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
                    const st = statusBadge(m);
                    const isLive = st.live;
                    const hasScore = m.homeScore !== null && m.awayScore !== null;
                    const isLoadingThis = loadingStream === m.id;
                    const hasErr = streamErr === m.id;

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
                        <div className="w-16 flex-shrink-0 text-center">
                          {isLive && <span className="live-dot inline-block mr-1" style={{ width: 5, height: 5 }} />}
                          <span className="text-[10px] font-bold" style={{ color: st.color }}>{st.text}</span>
                        </div>

                        {/* Teams + score */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <TeamLogo src={m.homeLogo} name={m.homeTeam} />
                            <span className="text-xs text-white/80 truncate font-medium flex-1">{m.homeTeam}</span>
                            {hasScore && (
                              <span className="text-sm font-bold font-mono" style={{ color: isLive ? '#30D158' : 'rgba(255,255,255,0.85)' }}>
                                {m.homeScore}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <TeamLogo src={m.awayLogo} name={m.awayTeam} />
                            <span className="text-xs text-white/50 truncate flex-1">{m.awayTeam}</span>
                            {hasScore && (
                              <span className="text-sm font-bold font-mono" style={{ color: isLive ? '#30D158' : 'rgba(255,255,255,0.85)' }}>
                                {m.awayScore}
                              </span>
                            )}
                          </div>
                          {hasErr && (
                            <p className="text-[9px] text-[#FF453A] mt-0.5">No se encontró stream. Prueba abrirlo directo.</p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-col gap-1 flex-shrink-0">
                          {/* Play in IPTV */}
                          {onPlayStream && m.streamPageUrl && (
                            <button
                              onClick={() => handlePlay(m)}
                              disabled={isLoadingThis}
                              className="flex items-center gap-1 px-2 py-1.5 rounded-ios-sm text-[10px] font-semibold transition-all active:scale-95 min-h-[32px]"
                              style={{
                                background: isLive ? 'rgba(48,209,88,0.15)' : 'rgba(10,132,255,0.12)',
                                border: `1px solid ${isLive ? 'rgba(48,209,88,0.3)' : 'rgba(10,132,255,0.25)'}`,
                                color: isLive ? '#30D158' : '#0A84FF',
                              }}
                            >
                              {isLoadingThis
                                ? <Loader2 size={10} className="animate-spin" />
                                : <Play size={10} />}
                              Ver
                            </button>
                          )}
                          {/* Open page */}
                          {m.streamPageUrl && (
                            <a
                              href={m.streamPageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 rounded-ios-sm text-[9px] transition-all"
                              style={{ color: 'rgba(255,255,255,0.25)' }}
                            >
                              <ExternalLink size={9} /> Web
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-white/[0.03] flex items-center gap-1.5">
        <Zap size={9} style={{ color: 'rgba(255,255,255,0.2)' }} />
        <span className="text-[9px] text-white/20">futbol-libres.su · actualiza cada 90s</span>
      </div>
    </div>
  );
}
