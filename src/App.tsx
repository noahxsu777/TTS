import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Gem, Heart, Share2 } from 'lucide-react';
import type { AppConfig, LiveEvent, BattleState, RoomStats, WSMessage } from './types';
import { useWebSocket } from './hooks/useWebSocket';
import { uid, applyTemplate, censorWords } from './utils/formatters';
import Header from './components/Header';
import ConnectionPanel from './components/ConnectionPanel';
import LiveEventsFeed from './components/LiveEventsFeed';
import BattlePanel from './components/BattlePanel';
import BoosterTracker from './components/BoosterTracker';
import ConfigPanel from './components/ConfigPanel';
import ProfileLookup from './components/ProfileLookup';

// ── Default config ────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: AppConfig = {
  voice: {
    engine: 'tiktok',
    voice: 'en_us_001',
    pitch: 1,
    speed: 1,
    volume: 80,
    readChat: true,
    readGifts: true,
    readFollows: true,
  },
  triggers: {
    muteAll: false,
    subscribersOnly: false,
    moderatorsOnly: false,
    minGiftDiamonds: 0,
    whitelist: [],
  },
  templates: {
    follow: 'Thank you {username} for following!',
    subscribe: 'Welcome {username} to the family! ✨',
    gift: '{username} sent a {gift} — thank you so much! 💎',
    share: '{username} shared the stream! 🔥 You\'re awesome!',
    like: '{username} liked the stream! ❤️',
    join: 'Welcome {username}!',
  },
  moderation: {
    bannedWords: [],
    silenceAll: false,
    silenceUntil: null,
  },
  gifts: {
    sounds: [],
    globalEnabled: true,
    minDiamondsForAlert: 0,
  },
};

// Build WebSocket URL dynamically (works in dev & prod)
const WS_URL = (() => {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
})();

// Max events to keep in feed
const MAX_EVENTS = 120;

// ── Starfield background ──────────────────────────────────────────────────────
function Starfield() {
  const stars = useRef<{ x: number; y: number; size: number; delay: number; dur: number }[]>(
    Array.from({ length: 80 }, () => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 1.5 + 0.5,
      delay: Math.random() * 4,
      dur: Math.random() * 3 + 2,
    }))
  );

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
        {stars.current.map((s, i) => (
          <circle
            key={i}
            cx={`${s.x}%`}
            cy={`${s.y}%`}
            r={s.size}
            fill="white"
          >
            <animate
              attributeName="opacity"
              values="0.1;0.6;0.1"
              dur={`${s.dur}s`}
              begin={`${s.delay}s`}
              repeatCount="indefinite"
            />
          </circle>
        ))}
      </svg>
      {/* Ambient glow blobs */}
      <div
        className="absolute w-96 h-96 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'rgba(10,132,255,0.04)', top: '5%', left: '-5%' }}
      />
      <div
        className="absolute w-80 h-80 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'rgba(191,90,242,0.04)', top: '10%', right: '-5%' }}
      />
      <div
        className="absolute w-64 h-64 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'rgba(255,159,10,0.03)', bottom: '20%', left: '40%' }}
      />
    </div>
  );
}

// ── Quick stats bar ───────────────────────────────────────────────────────────
function StatsBar({ stats, events }: { stats: RoomStats; events: LiveEvent[] }) {
  const giftTotal = events.filter(e => e.type === 'gift').reduce((s, e) => s + (e.diamondCount ?? 0), 0);
  const followCount = events.filter(e => e.type === 'follow').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-2 sm:grid-cols-4 gap-3"
    >
      {[
        { icon: Users, label: 'Viewers', value: stats.viewerCount.toLocaleString(), color: '#0A84FF' },
        { icon: Heart, label: 'Likes', value: stats.likeCount.toLocaleString(), color: '#FF453A' },
        { icon: Gem, label: '💎 Session', value: giftTotal.toLocaleString(), color: '#FFD60A' },
        { icon: Share2, label: 'Follows', value: followCount.toLocaleString(), color: '#30D158' },
      ].map(({ icon: Icon, label, value, color }) => (
        <div
          key={label}
          className="glass-card px-4 py-3 flex items-center gap-3"
          style={{ borderColor: `${color}18` }}
        >
          <div
            className="w-8 h-8 rounded-ios-sm flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}12` }}
          >
            <Icon size={14} style={{ color }} />
          </div>
          <div>
            <p className="stat-mono text-sm font-bold text-white">{value}</p>
            <p className="text-[9px] text-white/30 uppercase tracking-wider">{label}</p>
          </div>
        </div>
      ))}
    </motion.div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [stats, setStats] = useState<RoomStats>({ viewerCount: 0, likeCount: 0 });
  const [tiktokConnected, setTiktokConnected] = useState(false);
  const [tiktokConnecting, setTiktokConnecting] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');
  const [statusMsg, setStatusMsg] = useState('Enter a TikTok username to start monitoring a live stream');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const configRef = useRef(config);
  configRef.current = config;

  // ── TTS playback ──────────────────────────────────────────────────────────
  const speak = useCallback(async (text: string) => {
    const cfg = configRef.current;
    if (cfg.triggers.muteAll) return;
    if (cfg.moderation.silenceAll) {
      if (cfg.moderation.silenceUntil && cfg.moderation.silenceUntil < Date.now()) {
        setConfig(c => ({ ...c, moderation: { ...c.moderation, silenceAll: false, silenceUntil: null } }));
      } else return;
    }
    // Censor words
    const censored = censorWords(text, cfg.moderation.bannedWords);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: censored, voice: cfg.voice.voice }),
      });
      const data = await res.json();
      if (data.audio) {
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
        audio.volume = cfg.voice.volume / 100;
        audio.playbackRate = cfg.voice.speed;
        audioRef.current = audio;
        audio.play().catch(() => {});
      }
    } catch { /* ignore */ }
  }, []);

  // ── Gift sound playback ───────────────────────────────────────────────────
  const playGiftSound = useCallback((giftId: number, diamonds: number) => {
    const cfg = configRef.current;
    if (!cfg.gifts.globalEnabled) return;
    if (diamonds < cfg.gifts.minDiamondsForAlert) return;
    const sound = cfg.gifts.sounds.find(s => s.giftId === giftId && s.enabled && s.soundUrl);
    if (sound?.soundUrl) {
      const audio = new Audio(sound.soundUrl);
      audio.volume = cfg.voice.volume / 100;
      audio.play().catch(() => {});
    }
  }, []);

  // ── WebSocket message handler ─────────────────────────────────────────────
  const handleMessage = useCallback((msg: WSMessage) => {
    const cfg = configRef.current;

    if (msg.type === 'connected') {
      setTiktokConnected(true);
      setTiktokConnecting(false);
      setStatusMsg(`Connected to @${msg.username ?? currentUsername}'s live stream`);
    }

    if (msg.type === 'disconnected') {
      setTiktokConnected(false);
      setStatusMsg('Stream ended or disconnected');
      setBattle(null);
    }

    if (msg.type === 'error') {
      setTiktokConnected(false);
      setTiktokConnecting(false);
      setStatusMsg(`Error: ${msg.message}`);
    }

    if (msg.type === 'info') {
      setStatusMsg(msg.message ?? '');
    }

    if (msg.type === 'roomUser') {
      const d = msg.data as any;
      setStats({ viewerCount: d?.viewerCount ?? 0, likeCount: d?.likeCount ?? 0 });
    }

    if (msg.type === 'battle') {
      setBattle(msg.data as unknown as BattleState);
    }

    // Add to events feed
    const addEvent = (ev: Omit<LiveEvent, 'id' | 'timestamp'>) => {
      const newEv: LiveEvent = { ...ev, id: uid(), timestamp: Date.now() };
      setEvents(prev => [newEv, ...prev].slice(0, MAX_EVENTS));
      return newEv;
    };

    if (msg.type === 'chat') {
      const d = msg.data as any;
      // Access control
      if (cfg.triggers.muteAll) return;
      if (cfg.triggers.subscribersOnly && !d?.isSubscriber && !d?.isModerator) return;
      if (cfg.triggers.moderatorsOnly && !d?.isModerator) return;
      if (cfg.triggers.whitelist.length > 0 && !cfg.triggers.whitelist.includes(d?.uniqueId ?? '') && !d?.isModerator) return;

      addEvent({
        type: 'chat',
        userId: d?.userId ?? '',
        nickname: d?.nickname ?? 'Unknown',
        comment: d?.comment ?? '',
        isModerator: d?.isModerator ?? false,
        isSubscriber: d?.isSubscriber ?? false,
      });

      if (cfg.voice.readChat && d?.comment) {
        const text = applyTemplate('{username}: {comment}', {
          username: d.nickname ?? '',
          comment: d.comment ?? '',
        });
        speak(text);
      }
    }

    if (msg.type === 'gift') {
      const d = msg.data as any;
      if (!d?.repeatEnd) return; // Only fire on last in streak
      const ev = addEvent({
        type: 'gift',
        userId: d?.userId ?? '',
        nickname: d?.nickname ?? 'Unknown',
        giftName: d?.giftName ?? 'Gift',
        giftIcon: d?.giftIcon ?? '🎁',
        diamondCount: d?.diamondCount ?? 0,
        repeatCount: d?.repeatCount ?? 1,
      });

      playGiftSound(d?.giftId ?? 0, d?.diamondCount ?? 0);

      if (cfg.voice.readGifts && (d?.diamondCount ?? 0) >= cfg.triggers.minGiftDiamonds) {
        const tpl = cfg.templates.gift;
        if (tpl) {
          speak(applyTemplate(tpl, {
            username: d?.nickname ?? '',
            gift: d?.giftName ?? 'a gift',
            diamonds: String(d?.diamondCount ?? 0),
            count: String(d?.repeatCount ?? 1),
          }));
        }
      }
    }

    if (msg.type === 'follow') {
      const d = msg.data as any;
      const ev = addEvent({ type: 'follow', userId: d?.userId ?? '', nickname: d?.nickname ?? 'Someone' });
      if (cfg.voice.readFollows) {
        const tpl = cfg.templates.follow;
        if (tpl) speak(applyTemplate(tpl, { username: d?.nickname ?? '' }));
      }
    }

    if (msg.type === 'share') {
      const d = msg.data as any;
      addEvent({ type: 'share', userId: d?.userId ?? '', nickname: d?.nickname ?? 'Someone' });
      const tpl = cfg.templates.share;
      if (tpl) speak(applyTemplate(tpl, { username: d?.nickname ?? '' }));
    }

    if (msg.type === 'subscribe') {
      const d = msg.data as any;
      addEvent({ type: 'subscribe', userId: d?.userId ?? '', nickname: d?.nickname ?? 'Someone' });
      const tpl = cfg.templates.subscribe;
      if (tpl) speak(applyTemplate(tpl, { username: d?.nickname ?? '' }));
    }

    if (msg.type === 'like') {
      const d = msg.data as any;
      setStats(s => ({ ...s, likeCount: d?.totalLikeCount ?? s.likeCount }));
    }
  }, [speak, playGiftSound, currentUsername]);

  const { status: wsStatus, send } = useWebSocket(WS_URL, { onMessage: handleMessage });

  // ── Connect / Disconnect ──────────────────────────────────────────────────
  const handleConnect = useCallback((username: string) => {
    setCurrentUsername(username);
    setTiktokConnecting(true);
    setStatusMsg(`Connecting to @${username}…`);
    setEvents([]);
    setBattle(null);
    setStats({ viewerCount: 0, likeCount: 0 });
    send({ action: 'connect', username });
  }, [send]);

  const handleDisconnect = useCallback(() => {
    send({ action: 'disconnect' });
    setTiktokConnected(false);
    setCurrentUsername('');
    setStatusMsg('Disconnected from stream');
    setBattle(null);
    setStats({ viewerCount: 0, likeCount: 0 });
  }, [send]);

  return (
    <div className="min-h-screen relative">
      <Starfield />
      <div className="scan-overlay" />

      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Header */}
        <Header
          wsStatus={wsStatus}
          tiktokConnected={tiktokConnected}
          username={currentUsername}
          viewerCount={stats.viewerCount}
        />

        {/* Main content */}
        <main className="flex-1 p-4 max-w-[1600px] mx-auto w-full space-y-4">
          {/* Stats bar — shown when connected */}
          <AnimatePresence>
            {tiktokConnected && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <StatsBar stats={stats} events={events} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Column 1: Connection + Events */}
            <div className="space-y-4">
              <ConnectionPanel
                isConnected={tiktokConnected}
                connecting={tiktokConnecting}
                username={currentUsername}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                statusMessage={statusMsg}
              />
              <LiveEventsFeed events={events} isConnected={tiktokConnected} />
            </div>

            {/* Column 2: Battle + Boosters */}
            <div className="space-y-4">
              <BattlePanel battle={battle} />
              <BoosterTracker />
            </div>

            {/* Column 3: Config (spans full on mobile) */}
            <div className="md:col-span-2 xl:col-span-1">
              <ConfigPanel config={config} onChange={setConfig} />
            </div>
          </div>

          {/* Profile lookup - full width */}
          <div>
            <ProfileLookup />
          </div>
        </main>

        {/* Footer */}
        <footer className="py-4 text-center">
          <p className="text-[10px] text-white/10 font-mono tracking-widest">
            TIKLIVE COMMAND · STREAMER CONTROL CENTER · v1.0
          </p>
        </footer>
      </div>
    </div>
  );
}
