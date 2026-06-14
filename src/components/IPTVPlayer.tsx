import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Tv, Play, Pause, Volume2, VolumeX, Maximize2, List, X, Search, Loader2, AlertCircle, ChevronRight, Signal } from 'lucide-react';

interface Channel {
  name: string;
  url: string;
  logo?: string;
  group?: string;
  id?: string;
}

function parseM3U(text: string): Channel[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const channels: Channel[] = [];
  let current: Partial<Channel> = {};

  for (const line of lines) {
    if (line.startsWith('#EXTINF')) {
      current = {};
      // Extract tvg-name
      const nameMatch = line.match(/tvg-name="([^"]*)"/);
      const logoMatch = line.match(/tvg-logo="([^"]*)"/);
      const groupMatch = line.match(/group-title="([^"]*)"/);
      const idMatch = line.match(/tvg-id="([^"]*)"/);
      // Friendly name after last comma
      const commaIdx = line.lastIndexOf(',');
      current.name = nameMatch?.[1] || (commaIdx >= 0 ? line.slice(commaIdx + 1).trim() : 'Unknown');
      current.logo = logoMatch?.[1];
      current.group = groupMatch?.[1];
      current.id = idMatch?.[1];
    } else if (!line.startsWith('#') && line.startsWith('http')) {
      if (!current.name) current.name = 'Channel';
      current.url = line;
      channels.push(current as Channel);
      current = {};
    }
  }
  return channels;
}

function groupChannels(channels: Channel[]): Record<string, Channel[]> {
  const groups: Record<string, Channel[]> = {};
  for (const ch of channels) {
    const g = ch.group || 'General';
    if (!groups[g]) groups[g] = [];
    groups[g].push(ch);
  }
  return groups;
}

export default function IPTVPlayer() {
  const [url, setUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [groups, setGroups] = useState<Record<string, Channel[]>>({});
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [showList, setShowList] = useState(true);
  const [search, setSearch] = useState('');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [buffering, setBuffering] = useState(false);
  const [streamError, setStreamError] = useState('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<any>(null);

  // Load M3U playlist
  const loadPlaylist = useCallback(async (playlistUrl: string) => {
    if (!playlistUrl.trim()) return;
    setLoading(true);
    setError('');
    setChannels([]);
    setActiveChannel(null);

    try {
      // Try direct fetch first, then proxy
      let text = '';
      try {
        const r = await fetch(playlistUrl, { signal: AbortSignal.timeout(10000) });
        if (!r.ok) throw new Error('fetch failed');
        text = await r.text();
      } catch {
        const r = await fetch(`/api/iptv-proxy?url=${encodeURIComponent(playlistUrl)}`, { signal: AbortSignal.timeout(12000) });
        if (!r.ok) throw new Error(await r.text());
        text = await r.text();
      }

      if (!text.includes('#EXTM3U') && !text.includes('#EXTINF')) {
        // Might be a direct stream URL
        setChannels([{ name: 'Stream', url: playlistUrl }]);
        setGroups({ Stream: [{ name: 'Stream', url: playlistUrl }] });
        setOpenGroups({ Stream: true });
        setUrl(playlistUrl);
        setLoading(false);
        return;
      }

      const parsed = parseM3U(text);
      if (parsed.length === 0) throw new Error('No channels found in playlist');

      const grouped = groupChannels(parsed);
      setChannels(parsed);
      setGroups(grouped);
      // Open first group by default
      const firstGroup = Object.keys(grouped)[0];
      setOpenGroups({ [firstGroup]: true });
      setUrl(playlistUrl);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load playlist');
    } finally {
      setLoading(false);
    }
  }, []);

  // HLS / native playback
  const playChannel = useCallback((ch: Channel) => {
    const video = videoRef.current;
    if (!video) return;

    setStreamError('');
    setBuffering(true);
    setActiveChannel(ch);

    // Destroy previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const streamUrl = ch.url;
    const isHls = streamUrl.includes('.m3u8') || streamUrl.includes('/hls/') || streamUrl.includes('/live/');

    if (isHls) {
      import('hls.js').then(({ default: Hls }) => {
        if (!Hls.isSupported()) {
          // Safari supports HLS natively
          video.src = streamUrl;
          video.play().catch(() => {});
          return;
        }
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 30,
        });
        hlsRef.current = hls;
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
        hls.on(Hls.Events.ERROR, (_: any, data: any) => {
          if (data.fatal) {
            setStreamError('Stream error — channel may be offline');
            setBuffering(false);
          }
        });
      });
    } else {
      video.src = streamUrl;
      video.play().catch(() => setStreamError('Could not play stream — may require HLS or auth'));
    }
  }, []);

  // Sync video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => { setPlaying(true); setBuffering(false); };
    const onPause = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onError = () => { setStreamError('Stream unavailable'); setBuffering(false); };
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onError);
    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onError);
    };
  }, []);

  // Volume sync
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume / 100;
      videoRef.current.muted = muted;
    }
  }, [volume, muted]);

  // Cleanup on unmount
  useEffect(() => () => { hlsRef.current?.destroy(); }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };

  const toggleFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else v.requestFullscreen?.();
  };

  const filteredGroups: Record<string, Channel[]> = {};
  const q = search.toLowerCase();
  for (const [g, chs] of Object.entries(groups)) {
    const matched = q ? chs.filter(c => c.name.toLowerCase().includes(q) || c.group?.toLowerCase().includes(q)) : chs;
    if (matched.length) filteredGroups[g] = matched;
  }

  const totalChannels = channels.length;

  return (
    <div className="glass-card overflow-hidden" style={{ borderColor: 'rgba(10,132,255,0.15)' }}>
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.05]"
        style={{ background: 'rgba(10,132,255,0.06)' }}>
        <Tv size={14} style={{ color: '#0A84FF' }} />
        <span className="text-xs font-semibold text-white/80">IPTV Player</span>
        {totalChannels > 0 && (
          <span className="ml-1 text-[9px] px-2 py-0.5 rounded-full font-mono"
            style={{ background: 'rgba(10,132,255,0.14)', border: '1px solid rgba(10,132,255,0.25)', color: '#0A84FF' }}>
            {totalChannels} canales
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          {activeChannel && (
            <button onClick={() => setShowList(p => !p)}
              className="p-1.5 rounded-ios-sm transition-colors"
              style={{ background: showList ? 'rgba(10,132,255,0.15)' : 'rgba(255,255,255,0.05)', color: showList ? '#0A84FF' : 'rgba(255,255,255,0.4)' }}>
              <List size={13} />
            </button>
          )}
        </div>
      </div>

      {/* URL input */}
      <div className="px-4 py-3 border-b border-white/[0.04]">
        <div className="flex gap-2">
          <input
            className="input-cosmic flex-1 text-xs"
            placeholder="https://example.com/playlist.m3u  ó  URL de stream directo…"
            value={inputUrl}
            onChange={e => setInputUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && loadPlaylist(inputUrl)}
          />
          <button
            onClick={() => loadPlaylist(inputUrl)}
            disabled={loading || !inputUrl.trim()}
            className="btn-solid-orange px-4 text-xs whitespace-nowrap"
          >
            {loading ? <Loader2 size={13} className="animate-spin" /> : 'Cargar'}
          </button>
        </div>
        {error && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-[#FF453A]">
            <AlertCircle size={11} /> {error}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex" style={{ minHeight: channels.length > 0 || activeChannel ? 380 : 0 }}>
        {/* Channel list */}
        <AnimatePresence initial={false}>
          {(channels.length > 0) && showList && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 220, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="flex-shrink-0 border-r border-white/[0.05] flex flex-col overflow-hidden"
            >
              {/* Search */}
              <div className="px-2 py-2 border-b border-white/[0.04]">
                <div className="relative">
                  <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/25" />
                  <input
                    className="w-full bg-white/[0.04] border border-white/[0.07] rounded-ios-sm pl-7 pr-2 py-1.5 text-[11px] text-white placeholder-white/20 outline-none"
                    placeholder="Buscar canal…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Groups + channels */}
              <div className="flex-1 overflow-y-auto feed-scroll py-1">
                {Object.entries(filteredGroups).map(([group, chs]) => (
                  <div key={group}>
                    <button
                      onClick={() => setOpenGroups(p => ({ ...p, [group]: !p[group] }))}
                      className="w-full flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/[0.03] transition-colors"
                    >
                      <ChevronRight size={10}
                        className="transition-transform flex-shrink-0"
                        style={{ color: 'rgba(255,255,255,0.3)', transform: openGroups[group] ? 'rotate(90deg)' : undefined }}
                      />
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-white/35 truncate">{group}</span>
                      <span className="ml-auto text-[9px] text-white/20 font-mono">{chs.length}</span>
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
                            const isActive = activeChannel?.url === ch.url;
                            return (
                              <button
                                key={i}
                                onClick={() => playChannel(ch)}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-left transition-all"
                                style={{
                                  background: isActive ? 'rgba(10,132,255,0.12)' : undefined,
                                  borderLeft: isActive ? '2px solid #0A84FF' : '2px solid transparent',
                                }}
                              >
                                {ch.logo ? (
                                  <img src={ch.logo} alt="" className="w-5 h-5 rounded object-contain flex-shrink-0 bg-white/5" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                ) : (
                                  <div className="w-5 h-5 rounded flex-shrink-0 flex items-center justify-center"
                                    style={{ background: 'rgba(10,132,255,0.1)' }}>
                                    <Tv size={9} style={{ color: '#0A84FF' }} />
                                  </div>
                                )}
                                <span className="text-[11px] text-white/70 truncate leading-tight"
                                  style={{ color: isActive ? '#fff' : undefined }}>
                                  {ch.name}
                                </span>
                                {isActive && playing && (
                                  <Signal size={9} className="ml-auto flex-shrink-0" style={{ color: '#30D158' }} />
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
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video area */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeChannel ? (
            <>
              {/* Video */}
              <div className="relative bg-black flex-1 flex items-center justify-center" style={{ minHeight: 260 }}>
                <video
                  ref={videoRef}
                  className="w-full h-full object-contain"
                  style={{ maxHeight: 340 }}
                  playsInline
                />

                {/* Buffering overlay */}
                {buffering && !streamError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Loader2 size={32} className="animate-spin text-[#0A84FF]" />
                  </div>
                )}

                {/* Stream error overlay */}
                {streamError && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 gap-2">
                    <AlertCircle size={28} style={{ color: '#FF453A' }} />
                    <p className="text-xs text-white/60 text-center px-4">{streamError}</p>
                    <button onClick={() => playChannel(activeChannel)} className="btn-blue text-xs px-3 py-1.5 mt-1">
                      Reintentar
                    </button>
                  </div>
                )}

                {/* Click to play/pause */}
                {!buffering && !streamError && (
                  <button
                    onClick={togglePlay}
                    className="absolute inset-0 w-full h-full opacity-0"
                    aria-label="toggle play"
                  />
                )}

                {/* Channel badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-ios-sm"
                  style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
                  {playing && <span className="live-dot w-1.5 h-1.5" />}
                  <span className="text-[10px] text-white/80 font-medium truncate max-w-[160px]">{activeChannel.name}</span>
                </div>

                {/* Fullscreen button */}
                <button
                  onClick={toggleFullscreen}
                  className="absolute bottom-2 right-2 p-1.5 rounded-ios-sm transition-colors hover:bg-white/10"
                  style={{ background: 'rgba(0,0,0,0.5)' }}
                >
                  <Maximize2 size={12} style={{ color: 'rgba(255,255,255,0.6)' }} />
                </button>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3 px-3 py-2 border-t border-white/[0.04]"
                style={{ background: 'rgba(0,0,0,0.3)' }}>
                <button onClick={togglePlay} className="p-1.5 rounded-ios-sm hover:bg-white/[0.07] transition-colors">
                  {playing
                    ? <Pause size={14} style={{ color: '#0A84FF' }} />
                    : <Play size={14} style={{ color: '#0A84FF' }} />
                  }
                </button>

                <button onClick={() => setMuted(p => !p)} className="p-1.5 rounded-ios-sm hover:bg-white/[0.07] transition-colors">
                  {muted
                    ? <VolumeX size={13} style={{ color: 'rgba(255,255,255,0.4)' }} />
                    : <Volume2 size={13} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  }
                </button>

                <input
                  type="range" min={0} max={100} value={muted ? 0 : volume}
                  onChange={e => { setVolume(+e.target.value); setMuted(false); }}
                  className="flex-1 h-1 accent-[#0A84FF] cursor-pointer"
                  style={{ maxWidth: 100 }}
                />

                <span className="text-[10px] text-white/30 font-mono ml-auto truncate max-w-[140px]">
                  {activeChannel.group ?? ''}
                </span>
              </div>
            </>
          ) : channels.length > 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
              <Tv size={32} style={{ color: 'rgba(10,132,255,0.4)' }} />
              <p className="text-sm text-white/40">Selecciona un canal para reproducir</p>
              <p className="text-[10px] text-white/20">{totalChannels} canales disponibles</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Empty state */}
      {channels.length === 0 && !loading && !error && (
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-6 text-center">
          <div className="w-14 h-14 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(10,132,255,0.08)', border: '1px solid rgba(10,132,255,0.15)' }}>
            <Tv size={22} style={{ color: 'rgba(10,132,255,0.5)' }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white/50">IPTV Player</p>
            <p className="text-[11px] text-white/25 mt-1">
              Ingresa una URL de playlist M3U o un link de stream directo
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
