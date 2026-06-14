import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Tv, Play, Pause, Volume2, VolumeX, Maximize2,
  List, Search, Loader2, AlertCircle, ChevronRight,
  Signal, ChevronDown, Radio,
} from 'lucide-react';
import Hls from 'hls.js';

interface Channel {
  name: string;
  url: string;
  logo?: string;
  group?: string;
}

function parseM3U(text: string): Channel[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const channels: Channel[] = [];
  let cur: Partial<Channel> = {};
  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      cur = {};
      const nameM = line.match(/tvg-name="([^"]*)"/);
      const logoM = line.match(/tvg-logo="([^"]*)"/);
      const groupM = line.match(/group-title="([^"]*)"/);
      const comma = line.lastIndexOf(',');
      cur.name = (nameM?.[1] || (comma >= 0 ? line.slice(comma + 1).trim() : '')) || 'Canal';
      if (logoM?.[1]) cur.logo = logoM[1];
      cur.group = groupM?.[1] || 'General';
    } else if (!line.startsWith('#') && /^https?:\/\//.test(line)) {
      channels.push({ name: cur.name ?? 'Canal', url: line, logo: cur.logo, group: cur.group ?? 'General' });
      cur = {};
    }
  }
  return channels;
}

function grouped(channels: Channel[]) {
  const g: Record<string, Channel[]> = {};
  for (const ch of channels) {
    const k = ch.group || 'General';
    (g[k] ??= []).push(ch);
  }
  return g;
}

export default function IPTVPlayer() {
  const [inputUrl, setInputUrl] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [groups, setGroups] = useState<Record<string, Channel[]>>({});
  const [active, setActive] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);   // start muted so autoplay works on mobile
  const [volume, setVolume] = useState(80);
  const [buffering, setBuffering] = useState(false);
  const [streamErr, setStreamErr] = useState('');
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [showList, setShowList] = useState(true); // on mobile toggles list vs player

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Load playlist ──────────────────────────────────────────────────────────
  const load = useCallback(async (rawUrl: string) => {
    const url = rawUrl.trim();
    if (!url) return;
    setLoading(true);
    setLoadError('');
    setChannels([]);
    setActive(null);
    setStreamErr('');

    // If it's a direct stream (not an M3U list), play it directly
    const looksLikeStream = /\.(ts|mp4|mkv|avi|flv)(\?|$)/i.test(url) ||
      url.includes('/stream') || url.includes('/live');

    try {
      let text = '';
      try {
        const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
        if (!r.ok) throw new Error('direct fetch failed');
        text = await r.text();
      } catch {
        const r = await fetch(`/api/iptv-proxy?url=${encodeURIComponent(url)}`, {
          signal: AbortSignal.timeout(14000),
        });
        if (!r.ok) throw new Error(await r.text().catch(() => `HTTP ${r.status}`));
        text = await r.text();
      }

      if (!text.includes('#EXTINF') || looksLikeStream) {
        // Direct stream URL
        const ch: Channel = { name: 'Stream', url, group: 'Stream' };
        setChannels([ch]);
        setGroups({ Stream: [ch] });
        setOpenGroups({ Stream: true });
        setLoading(false);
        playChannel(ch);
        return;
      }

      const parsed = parseM3U(text);
      if (!parsed.length) throw new Error('No se encontraron canales en la playlist');
      const g = grouped(parsed);
      setChannels(parsed);
      setGroups(g);
      const first = Object.keys(g)[0];
      setOpenGroups({ [first]: true });
      setShowList(true);
    } catch (e: any) {
      setLoadError(e?.message ?? 'Error al cargar la playlist');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Play a channel ─────────────────────────────────────────────────────────
  const playChannel = useCallback((ch: Channel) => {
    const video = videoRef.current;
    if (!video) return;

    setStreamErr('');
    setBuffering(true);
    setActive(ch);
    setPlaying(false);
    setShowList(false); // on mobile, switch to player view

    // Tear down old HLS
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    video.src = '';
    video.load();

    const src = ch.url;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 20,
        maxBufferLength: 30,
        startLevel: -1,
      });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.once(Hls.Events.MANIFEST_PARSED, () => {
        video.muted = muted;
        video.volume = volume / 100;
        video.play().catch(() => {
          // autoplay blocked — user must tap play
          setBuffering(false);
        });
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setStreamErr('Canal no disponible o sin señal');
          setBuffering(false);
          hls.destroy();
          hlsRef.current = null;
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = src;
      video.muted = muted;
      video.volume = volume / 100;
      video.play().catch(() => setBuffering(false));
    } else {
      // Try as plain video
      video.src = src;
      video.muted = muted;
      video.volume = volume / 100;
      video.play().catch(() => {
        setStreamErr('No se puede reproducir este stream en el navegador');
        setBuffering(false);
      });
    }
  }, [muted, volume]);

  // ── Video events ───────────────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onPlay    = () => { setPlaying(true);  setBuffering(false); };
    const onPause   = () => setPlaying(false);
    const onWait    = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onErr     = () => { setStreamErr('Error de stream'); setBuffering(false); };
    v.addEventListener('play',    onPlay);
    v.addEventListener('pause',   onPause);
    v.addEventListener('waiting', onWait);
    v.addEventListener('playing', onPlaying);
    v.addEventListener('error',   onErr);
    return () => {
      v.removeEventListener('play',    onPlay);
      v.removeEventListener('pause',   onPause);
      v.removeEventListener('waiting', onWait);
      v.removeEventListener('playing', onPlaying);
      v.removeEventListener('error',   onErr);
    };
  }, []);

  // Keep video muted/volume in sync
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = muted;
    v.volume = volume / 100;
  }, [muted, volume]);

  // Cleanup
  useEffect(() => () => { hlsRef.current?.destroy(); }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v || !active) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    setMuted(next);
    // If unmuting for first time while video is paused, try to play
    if (!next && v.paused && active) v.play().catch(() => {});
  };

  const goFullscreen = () => {
    const el = containerRef.current ?? videoRef.current;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen?.();
  };

  // Filter
  const q = search.toLowerCase();
  const filtered: Record<string, Channel[]> = {};
  for (const [g, chs] of Object.entries(groups)) {
    const m = q ? chs.filter(c => c.name.toLowerCase().includes(q) || g.toLowerCase().includes(q)) : chs;
    if (m.length) filtered[g] = m;
  }

  const totalCh = channels.length;
  const hasChannels = totalCh > 0;

  // ── Channel list (shared between mobile drawer and desktop sidebar) ─────────
  const ChannelList = (
    <div className="flex flex-col h-full">
      {/* Search */}
      <div className="px-2 py-2 border-b border-white/[0.04] flex-shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            className="w-full bg-white/[0.04] border border-white/[0.07] rounded-ios-sm pl-7 pr-2 py-2 text-xs text-white placeholder-white/20 outline-none"
            placeholder="Buscar canal…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Groups */}
      <div className="flex-1 overflow-y-auto feed-scroll">
        {Object.entries(filtered).map(([group, chs]) => (
          <div key={group}>
            <button
              onClick={() => setOpenGroups(p => ({ ...p, [group]: !p[group] }))}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/[0.03] transition-colors"
            >
              <ChevronRight
                size={10}
                className="flex-shrink-0 transition-transform"
                style={{
                  color: 'rgba(255,255,255,0.35)',
                  transform: openGroups[group] ? 'rotate(90deg)' : undefined,
                }}
              />
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/35 truncate">{group}</span>
              <span className="ml-auto font-mono text-[9px] text-white/20">{chs.length}</span>
            </button>

            <AnimatePresence initial={false}>
              {openGroups[group] && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  {chs.map((ch, i) => {
                    const isActive = active?.url === ch.url;
                    return (
                      <button
                        key={i}
                        onClick={() => playChannel(ch)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all active:bg-white/[0.06] min-h-[44px]"
                        style={{
                          background: isActive ? 'rgba(10,132,255,0.1)' : undefined,
                          borderLeft: isActive ? '2px solid #0A84FF' : '2px solid transparent',
                        }}
                      >
                        {ch.logo ? (
                          <img
                            src={ch.logo} alt=""
                            className="w-6 h-6 rounded object-contain flex-shrink-0"
                            style={{ background: 'rgba(255,255,255,0.05)' }}
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-6 h-6 rounded flex-shrink-0 flex items-center justify-center"
                            style={{ background: 'rgba(10,132,255,0.1)' }}>
                            <Tv size={11} style={{ color: '#0A84FF' }} />
                          </div>
                        )}
                        <span className="text-xs truncate leading-tight flex-1"
                          style={{ color: isActive ? '#fff' : 'rgba(255,255,255,0.65)' }}>
                          {ch.name}
                        </span>
                        {isActive && playing && (
                          <Signal size={10} className="flex-shrink-0" style={{ color: '#30D158' }} />
                        )}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="glass-card overflow-hidden" style={{ borderColor: 'rgba(10,132,255,0.15)' }}>

      {/* ── Header ── */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.05]"
        style={{ background: 'rgba(10,132,255,0.06)' }}>
        <Radio size={14} style={{ color: '#0A84FF' }} />
        <span className="text-xs font-semibold text-white/80">IPTV Player</span>
        {hasChannels && (
          <span className="text-[9px] px-2 py-0.5 rounded-full font-mono"
            style={{ background: 'rgba(10,132,255,0.14)', border: '1px solid rgba(10,132,255,0.25)', color: '#0A84FF' }}>
            {totalCh} canales
          </span>
        )}

        {/* Mobile toggle: list ↔ player */}
        {active && (
          <button
            onClick={() => setShowList(p => !p)}
            className="ml-auto flex items-center gap-1 px-2.5 py-1.5 rounded-ios-sm text-[11px] font-semibold transition-all sm:hidden"
            style={{
              background: showList ? 'rgba(10,132,255,0.15)' : 'rgba(48,209,88,0.12)',
              color: showList ? '#0A84FF' : '#30D158',
              border: `1px solid ${showList ? 'rgba(10,132,255,0.3)' : 'rgba(48,209,88,0.25)'}`,
            }}
          >
            {showList ? <><Play size={10} /> Ver</>  : <><List size={10} /> Canales</>}
          </button>
        )}
        {hasChannels && !active && (
          <span className="ml-auto text-[10px] text-white/30">Toca un canal para reproducir</span>
        )}
      </div>

      {/* ── URL input ── */}
      <div className="px-3 py-3 border-b border-white/[0.04]">
        <div className="flex gap-2">
          <input
            className="input-cosmic flex-1 text-xs min-h-[44px]"
            placeholder="URL de playlist .m3u o stream directo…"
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(inputUrl)}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
          />
          <button
            onClick={() => load(inputUrl)}
            disabled={loading || !inputUrl.trim()}
            className="btn-solid-orange px-4 text-xs whitespace-nowrap min-w-[72px] min-h-[44px] flex items-center justify-center"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : 'Cargar'}
          </button>
        </div>
        {loadError && (
          <div className="mt-2 flex items-start gap-1.5 text-[11px] text-[#FF453A]">
            <AlertCircle size={12} className="mt-px flex-shrink-0" />
            <span>{loadError}</span>
          </div>
        )}
      </div>

      {/* ── Main area ── */}
      {(hasChannels || active) && (
        <div className="flex flex-col md:flex-row" ref={containerRef}>

          {/* Desktop sidebar — always visible on md+ */}
          {hasChannels && (
            <div className="hidden md:flex flex-col border-r border-white/[0.05]"
              style={{ width: 240, maxHeight: 480 }}>
              {ChannelList}
            </div>
          )}

          {/* Mobile: channel list panel */}
          {hasChannels && showList && (
            <div className="md:hidden border-b border-white/[0.05]" style={{ maxHeight: 320 }}>
              {ChannelList}
            </div>
          )}

          {/* Video panel */}
          {active && !showList && (
            <div className="flex-1 flex flex-col min-w-0">
              {/* Video */}
              <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  playsInline
                  muted={muted}
                />

                {/* Buffering */}
                {buffering && !streamErr && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
                    <Loader2 size={36} className="animate-spin text-[#0A84FF]" />
                    <span className="text-xs text-white/50">Cargando stream…</span>
                  </div>
                )}

                {/* Stream error */}
                {streamErr && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 px-4 text-center">
                    <AlertCircle size={32} style={{ color: '#FF453A' }} />
                    <p className="text-sm text-white/70">{streamErr}</p>
                    <button
                      onClick={() => playChannel(active)}
                      className="btn-blue text-xs px-4 py-2"
                    >
                      Reintentar
                    </button>
                  </div>
                )}

                {/* Tap to play (autoplay blocked) */}
                {!playing && !buffering && !streamErr && (
                  <button
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/40"
                  >
                    <div className="w-16 h-16 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(10,132,255,0.85)', backdropFilter: 'blur(8px)' }}>
                      <Play size={28} fill="white" style={{ color: 'white', marginLeft: 4 }} />
                    </div>
                  </button>
                )}

                {/* Tap area when playing */}
                {playing && !streamErr && (
                  <button
                    onClick={togglePlay}
                    className="absolute inset-0 opacity-0"
                    aria-label="pause"
                  />
                )}

                {/* Top overlay: channel name + live dot */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-ios-sm"
                  style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
                  {playing && <span className="live-dot" style={{ width: 6, height: 6 }} />}
                  <span className="text-[11px] font-medium text-white truncate max-w-[200px]">{active.name}</span>
                </div>

                {/* Fullscreen */}
                <button
                  onClick={goFullscreen}
                  className="absolute bottom-2 right-2 p-2 rounded-ios-sm"
                  style={{ background: 'rgba(0,0,0,0.6)' }}
                >
                  <Maximize2 size={14} style={{ color: 'rgba(255,255,255,0.7)' }} />
                </button>

                {/* Unmute banner — shown when muted */}
                {muted && playing && (
                  <button
                    onClick={toggleMute}
                    className="absolute bottom-2 left-2 flex items-center gap-1.5 px-3 py-1.5 rounded-ios-sm text-xs font-semibold"
                    style={{ background: 'rgba(255,159,10,0.9)', color: '#000' }}
                  >
                    <VolumeX size={12} /> Toca para activar sonido
                  </button>
                )}
              </div>

              {/* Controls bar */}
              <div className="flex items-center gap-2 px-3 py-2.5"
                style={{ background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                {/* Play/Pause */}
                <button onClick={togglePlay} className="p-2 rounded-ios-sm active:scale-95 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center">
                  {playing
                    ? <Pause size={18} style={{ color: '#0A84FF' }} />
                    : <Play size={18} style={{ color: '#0A84FF' }} />}
                </button>

                {/* Mute */}
                <button onClick={toggleMute} className="p-2 rounded-ios-sm active:scale-95 transition-transform min-w-[44px] min-h-[44px] flex items-center justify-center">
                  {muted
                    ? <VolumeX size={16} style={{ color: '#FF9F0A' }} />
                    : <Volume2 size={16} style={{ color: 'rgba(255,255,255,0.7)' }} />}
                </button>

                {/* Volume slider */}
                <input
                  type="range" min={0} max={100} value={muted ? 0 : volume}
                  onChange={e => { setVolume(+e.target.value); if (+e.target.value > 0) setMuted(false); }}
                  className="flex-1 accent-[#0A84FF] h-1 cursor-pointer"
                  style={{ maxWidth: 120 }}
                />

                {/* Channel group label */}
                {active.group && (
                  <span className="ml-auto text-[9px] text-white/25 font-mono truncate max-w-[100px] hidden sm:block">
                    {active.group}
                  </span>
                )}

                {/* On desktop: channel list toggle */}
                <button
                  onClick={() => setShowList(p => !p)}
                  className="p-2 rounded-ios-sm transition-colors hidden md:flex items-center justify-center"
                  style={{ color: 'rgba(255,255,255,0.4)' }}
                >
                  <List size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Desktop: show player alongside sidebar even when showList is true */}
          {active && showList && (
            <div className="flex-1 hidden md:flex flex-col min-w-0">
              <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  playsInline
                  muted={muted}
                />
                {buffering && !streamErr && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Loader2 size={36} className="animate-spin text-[#0A84FF]" />
                  </div>
                )}
                {streamErr && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 text-center px-4">
                    <AlertCircle size={32} style={{ color: '#FF453A' }} />
                    <p className="text-sm text-white/70">{streamErr}</p>
                    <button onClick={() => playChannel(active)} className="btn-blue text-xs px-4 py-2">Reintentar</button>
                  </div>
                )}
                {!playing && !buffering && !streamErr && (
                  <button onClick={togglePlay} className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center"
                      style={{ background: 'rgba(10,132,255,0.85)' }}>
                      <Play size={28} fill="white" style={{ color: 'white', marginLeft: 4 }} />
                    </div>
                  </button>
                )}
                {playing && !streamErr && (
                  <button onClick={togglePlay} className="absolute inset-0 opacity-0" aria-label="pause" />
                )}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-ios-sm"
                  style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}>
                  {playing && <span className="live-dot" style={{ width: 6, height: 6 }} />}
                  <span className="text-[11px] font-medium text-white truncate max-w-[200px]">{active.name}</span>
                </div>
                <button onClick={goFullscreen} className="absolute bottom-2 right-2 p-2 rounded-ios-sm"
                  style={{ background: 'rgba(0,0,0,0.6)' }}>
                  <Maximize2 size={14} style={{ color: 'rgba(255,255,255,0.7)' }} />
                </button>
                {muted && playing && (
                  <button onClick={toggleMute}
                    className="absolute bottom-2 left-2 flex items-center gap-1.5 px-3 py-1.5 rounded-ios-sm text-xs font-semibold"
                    style={{ background: 'rgba(255,159,10,0.9)', color: '#000' }}>
                    <VolumeX size={12} /> Toca para activar sonido
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 px-3 py-2.5"
                style={{ background: 'rgba(0,0,0,0.4)', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <button onClick={togglePlay} className="p-2 rounded-ios-sm min-w-[44px] min-h-[44px] flex items-center justify-center">
                  {playing ? <Pause size={18} style={{ color: '#0A84FF' }} /> : <Play size={18} style={{ color: '#0A84FF' }} />}
                </button>
                <button onClick={toggleMute} className="p-2 rounded-ios-sm min-w-[44px] min-h-[44px] flex items-center justify-center">
                  {muted ? <VolumeX size={16} style={{ color: '#FF9F0A' }} /> : <Volume2 size={16} style={{ color: 'rgba(255,255,255,0.7)' }} />}
                </button>
                <input type="range" min={0} max={100} value={muted ? 0 : volume}
                  onChange={e => { setVolume(+e.target.value); if (+e.target.value > 0) setMuted(false); }}
                  className="flex-1 accent-[#0A84FF] h-1 cursor-pointer" style={{ maxWidth: 120 }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {!hasChannels && !loading && !loadError && (
        <div className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.15)' }}>
            <Tv size={26} style={{ color: 'rgba(10,132,255,0.5)' }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/50 mb-1">IPTV Player</p>
            <p className="text-[11px] text-white/25 leading-relaxed">
              Pega tu URL de playlist M3U<br />o un link de stream directo arriba
            </p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-10 text-[#0A84FF]">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-xs">Cargando playlist…</span>
        </div>
      )}
    </div>
  );
}
