import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Gift, Search, SlidersHorizontal, Play, Bell, BellOff,
  Volume2, Upload, Loader2, CheckCircle, ChevronDown, X,
} from 'lucide-react';

interface TikGift {
  id: number;
  name: string;
  diamond: number;
  image: string;
  emoji: string;
  category?: string;
}

interface GiftSoundConfig {
  giftId: number;
  soundUrl: string;
  enabled: boolean;
}

interface GiftGalleryProps {
  sounds: Record<number, GiftSoundConfig>;
  onSoundChange: (sounds: Record<number, GiftSoundConfig>) => void;
}

const DIAMOND_RANGES = [
  { label: 'All', min: 0, max: Infinity },
  { label: '1–9💎', min: 1, max: 9 },
  { label: '10–99💎', min: 10, max: 99 },
  { label: '100–999💎', min: 100, max: 999 },
  { label: '1K+💎', min: 1000, max: Infinity },
];

function diamondColor(n: number): string {
  if (n >= 10000) return '#BF5AF2';
  if (n >= 1000)  return '#FFD60A';
  if (n >= 100)   return '#0A84FF';
  if (n >= 10)    return '#30D158';
  return '#ffffff60';
}

function formatDiamonds(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'K';
  return String(n);
}

// ── Single gift card ──────────────────────────────────────────────────────────
function GiftCard({
  gift, config, onChange, onTest,
}: {
  gift: TikGift;
  config: GiftSoundConfig | undefined;
  onChange: (c: GiftSoundConfig) => void;
  onTest: (soundUrl: string) => void;
}) {
  const [inputVal, setInputVal] = useState(config?.soundUrl ?? '');
  const [saved, setSaved] = useState(false);
  const enabled = config?.enabled ?? false;
  const hasSoundUrl = !!(config?.soundUrl);

  const handleUrlBlur = () => {
    if (inputVal !== (config?.soundUrl ?? '')) {
      onChange({ giftId: gift.id, soundUrl: inputVal, enabled: enabled || !!inputVal });
      if (inputVal) { setSaved(true); setTimeout(() => setSaved(false), 1500); }
    }
  };

  const toggleEnabled = () => {
    onChange({ giftId: gift.id, soundUrl: config?.soundUrl ?? '', enabled: !enabled });
  };

  const dColor = diamondColor(gift.diamond);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="relative flex flex-col rounded-ios overflow-hidden"
      style={{
        background: hasSoundUrl && enabled
          ? `linear-gradient(145deg, ${dColor}10 0%, rgba(255,255,255,0.03) 100%)`
          : 'rgba(255,255,255,0.03)',
        border: `1px solid ${hasSoundUrl && enabled ? dColor + '30' : 'rgba(255,255,255,0.06)'}`,
        boxShadow: hasSoundUrl && enabled
          ? `0 8px 24px -8px ${dColor}30, inset 0 1px 0 rgba(255,255,255,0.06)`
          : '0 4px 16px -4px rgba(0,0,0,0.5)',
      }}
    >
      {/* Gift visual */}
      <div className="flex flex-col items-center px-3 pt-4 pb-2 gap-2">
        {gift.image ? (
          <img
            src={gift.image}
            alt={gift.name}
            className="w-14 h-14 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div
            className="w-14 h-14 rounded-ios-sm flex items-center justify-center text-3xl"
            style={{ background: `${dColor}12`, border: `1px solid ${dColor}20` }}
          >
            {gift.emoji}
          </div>
        )}
        <div className="text-center">
          <p className="text-xs font-semibold text-white leading-tight">{gift.name}</p>
          <p className="stat-mono text-[10px] mt-0.5" style={{ color: dColor }}>
            {formatDiamonds(gift.diamond)} 💎
          </p>
          {gift.category && (
            <p className="text-[9px] text-white/20 font-mono mt-0.5">{gift.category}</p>
          )}
        </div>
      </div>

      {/* Sound URL input */}
      <div className="px-2 pb-2">
        <input
          type="url"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onBlur={handleUrlBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') handleUrlBlur(); }}
          placeholder=".mp3 URL…"
          className="w-full bg-white/[0.04] border border-white/[0.07] rounded-lg px-2 py-1.5 text-[10px] font-mono text-white/60 placeholder-white/15 outline-none focus:border-white/20 transition-colors"
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between px-2 pb-3 gap-1">
        {/* Play test */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => config?.soundUrl && onTest(config.soundUrl)}
          disabled={!hasSoundUrl}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{
            background: hasSoundUrl ? `${dColor}18` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${hasSoundUrl ? dColor + '30' : 'rgba(255,255,255,0.06)'}`,
            opacity: hasSoundUrl ? 1 : 0.4,
          }}
        >
          {saved
            ? <CheckCircle size={12} className="text-[#30D158]" />
            : <Play size={12} style={{ color: hasSoundUrl ? dColor : 'rgba(255,255,255,0.2)' }} fill={hasSoundUrl ? dColor : 'transparent'} />
          }
        </motion.button>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Enable toggle */}
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={toggleEnabled}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
          style={{
            background: enabled ? `${dColor}18` : 'rgba(255,255,255,0.04)',
            border: `1px solid ${enabled ? dColor + '30' : 'rgba(255,255,255,0.06)'}`,
          }}
        >
          {enabled
            ? <Bell size={12} style={{ color: dColor }} />
            : <BellOff size={12} className="text-white/20" />
          }
        </motion.button>
      </div>

      {/* Active indicator */}
      {hasSoundUrl && enabled && (
        <div
          className="absolute top-2 right-2 w-2 h-2 rounded-full"
          style={{ background: dColor, boxShadow: `0 0 6px ${dColor}` }}
        />
      )}
    </motion.div>
  );
}

// ── Main Gallery ──────────────────────────────────────────────────────────────
export default function GiftGallery({ sounds, onSoundChange }: GiftGalleryProps) {
  const [gifts, setGifts] = useState<TikGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [rangeIdx, setRangeIdx] = useState(0);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/gifts')
      .then(r => r.json())
      .then(data => { if (!cancelled) { setGifts(Array.isArray(data) ? data : []); } })
      .catch(() => { })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const testSound = useCallback((url: string) => {
    audioRef.current?.pause();
    const a = new Audio(url);
    audioRef.current = a;
    a.volume = 0.7;
    a.play().catch(() => {});
  }, []);

  const handleSoundChange = useCallback((cfg: GiftSoundConfig) => {
    onSoundChange({ ...sounds, [cfg.giftId]: cfg });
  }, [sounds, onSoundChange]);

  const range = DIAMOND_RANGES[rangeIdx];

  const filtered = gifts
    .filter(g => {
      if (search && !g.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (g.diamond < range.min || g.diamond > range.max) return false;
      return true;
    })
    .sort((a, b) => sortDir === 'asc' ? a.diamond - b.diamond : b.diamond - a.diamond);

  const configuredCount = Object.values(sounds).filter(s => s.enabled && s.soundUrl).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-ios-sm flex items-center justify-center"
            style={{ background: 'rgba(255,214,10,0.12)', border: '1px solid rgba(255,214,10,0.3)' }}
          >
            <Gift size={15} className="text-[#FFD60A]" />
          </div>
          <div>
            <p className="text-sm font-bold text-white font-display">Gift Sound Gallery</p>
            <p className="text-[10px] text-white/30 font-mono">
              {loading ? 'Loading gifts…' : `${gifts.length} gifts · ${configuredCount} with sound`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sort */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-ios-sm text-xs text-white/50 hover:text-white/80 transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <ChevronDown size={12} className={`transition-transform ${sortDir === 'asc' ? '' : 'rotate-180'}`} />
            {sortDir === 'asc' ? 'Cheapest first' : 'Most expensive'}
          </motion.button>

          {/* Filter toggle */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFilters(f => !f)}
            className="w-9 h-9 rounded-ios-sm flex items-center justify-center transition-colors"
            style={{
              background: showFilters ? 'rgba(10,132,255,0.15)' : 'rgba(255,255,255,0.04)',
              border: showFilters ? '1px solid rgba(10,132,255,0.4)' : '1px solid rgba(255,255,255,0.07)',
              color: showFilters ? '#0A84FF' : 'rgba(255,255,255,0.4)',
            }}
          >
            <SlidersHorizontal size={14} />
          </motion.button>
        </div>
      </div>

      {/* Search + filters */}
      <div className="space-y-2">
        <div className="relative">
          <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search gifts by name…"
            className="input-cosmic pl-9 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50">
              <X size={12} />
            </button>
          )}
        </div>

        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-2 flex-wrap pt-1">
                {DIAMOND_RANGES.map((r, i) => (
                  <motion.button
                    key={r.label}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setRangeIdx(i)}
                    className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: rangeIdx === i ? 'rgba(255,214,10,0.15)' : 'rgba(255,255,255,0.04)',
                      border: rangeIdx === i ? '1px solid rgba(255,214,10,0.4)' : '1px solid rgba(255,255,255,0.07)',
                      color: rangeIdx === i ? '#FFD60A' : 'rgba(255,255,255,0.4)',
                    }}
                  >
                    {r.label}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Gift grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-white/30">
          <Loader2 size={20} className="animate-spin" />
          <span className="text-sm font-mono">Loading gift catalog…</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-white/20">
          <Gift size={32} />
          <p className="text-sm font-mono">No gifts match your filter</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map(gift => (
              <GiftCard
                key={gift.id}
                gift={gift}
                config={sounds[gift.id]}
                onChange={handleSoundChange}
                onTest={testSound}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Stats bar */}
      {!loading && gifts.length > 0 && (
        <div className="flex items-center justify-between text-[10px] text-white/20 font-mono pt-1">
          <span>{filtered.length} of {gifts.length} gifts shown</span>
          <div className="flex items-center gap-1.5">
            <Volume2 size={10} />
            <span>{configuredCount} gifts with sound alerts configured</span>
          </div>
        </div>
      )}
    </div>
  );
}
