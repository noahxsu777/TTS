import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Gem, Heart, UserPlus } from 'lucide-react';
import type { AppConfig, LiveEvent, BattleState, RoomStats, WSMessage, GiftSoundConfig } from './types';
import { useWebSocket } from './hooks/useWebSocket';
import { uid, applyTemplate, censorWords } from './utils/formatters';
import Header from './components/Header';
import ConnectionPanel from './components/ConnectionPanel';
import LiveEventsFeed from './components/LiveEventsFeed';
import BattlePanel from './components/BattlePanel';
import BoosterTracker from './components/BoosterTracker';
import ConfigPanel from './components/ConfigPanel';
import ProfileLookup from './components/ProfileLookup';
import IPTVPlayer from './components/IPTVPlayer';
import MatchSchedule from './components/MatchSchedule';

// ── Default config ────────────────────────────────────────────────────────────
const DEFAULT_CONFIG: AppConfig = {
  voice: {
    engine: 'tiktok', voice: 'en_us_001',
    pitch: 1, speed: 1, volume: 80,
    readChat: true, readGifts: true, readFollows: true,
  },
  triggers: {
    muteAll: false, subscribersOnly: false, moderatorsOnly: false,
    minGiftDiamonds: 0, whitelist: [],
  },
  templates: {
    follow: 'Thank you {username} for following!',
    subscribe: 'Welcome {username} to the family! ✨',
    gift: '{username} sent a {gift}! Thank you! 💎',
    share: '{username} shared the stream! You\'re awesome! 🔥',
    like: '{username} liked the stream! ❤️',
    join: 'Welcome {username}!',
  },
  moderation: { bannedWords: [], silenceAll: false, silenceUntil: null },
  gifts: { sounds: [], globalEnabled: true, minDiamondsForAlert: 0 },
};

const WS_URL = (() => {
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws`;
})();

const MAX_EVENTS = 150;

// ── Starfield ─────────────────────────────────────────────────────────────────
const STARS = Array.from({ length: 90 }, () => ({
  x: Math.random() * 100,
  y: Math.random() * 100,
  r: Math.random() * 1.4 + 0.3,
  delay: Math.random() * 5,
  dur: Math.random() * 3 + 2,
}));

function Starfield() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden select-none">
      <svg className="w-full h-full absolute inset-0" xmlns="http://www.w3.org/2000/svg">
        {STARS.map((s, i) => (
          <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="white">
            <animate attributeName="opacity" values="0.08;0.55;0.08" dur={`${s.dur}s`} begin={`${s.delay}s`} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>
      {/* Ambient blobs */}
      <div className="absolute w-[600px] h-[400px] rounded-full blur-[120px] top-[-10%] left-[-10%]"
        style={{ background: 'rgba(10,132,255,0.05)' }} />
      <div className="absolute w-[500px] h-[350px] rounded-full blur-[100px] top-[5%] right-[-8%]"
        style={{ background: 'rgba(191,90,242,0.05)' }} />
      <div className="absolute w-[400px] h-[300px] rounded-full blur-[80px] bottom-[10%] left-[35%]"
        style={{ background: 'rgba(255,159,10,0.04)' }} />
    </div>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar({ stats, events }: { stats: RoomStats; events: LiveEvent[] }) {
  const diamonds = events.filter(e => e.type === 'gift').reduce((s, e) => s + (e.diamondCount ?? 0), 0);
  const follows  = events.filter(e => e.type === 'follow').length;

  const items = [
    { icon: Users,    label: 'Viewers',      value: stats.viewerCount.toLocaleString(), color: '#0A84FF' },
    { icon: Heart,    label: 'Likes',        value: stats.likeCount.toLocaleString(),   color: '#FF453A' },
    { icon: Gem,      label: 'Diamonds',     value: diamonds.toLocaleString(),          color: '#FFD60A' },
    { icon: UserPlus, label: 'New Follows',  value: follows.toLocaleString(),           color: '#30D158' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-2 sm:grid-cols-4 gap-3"
    >
      {items.map(({ icon: Icon, label, value, color }) => (
        <div
          key={label}
          className="glass-card px-4 py-3 flex items-center gap-3"
          style={{ borderColor: `${color}20` }}
        >
          <div
            className="w-9 h-9 rounded-ios-sm flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}12`, border: `1px solid ${color}22` }}
          >
            <Icon size={15} style={{ color }} />
          </div>
          <div>
            <p className="font-mono text-sm font-bold text-white tabular-nums">{value}</p>
            <p className="text-[9px] text-white/28 uppercase tracking-wider font-semibold">{label}</p>
          </div>
        </div>
      ))}
    </motion.div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [giftSounds, setGiftSounds] = useState<Record<number, GiftSoundConfig>>({});
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [battle, setBattle] = useState<BattleState | null>(null);
  const [stats, setStats] = useState<RoomStats>({ viewerCount: 0, likeCount: 0 });
  const [tiktokConnected, setTiktokConnected] = useState(false);
  const [tiktokConnecting, setTiktokConnecting] = useState(false);
  const [currentUsername, setCurrentUsername] = useState('');
  const [statusMsg, setStatusMsg] = useState('Enter a TikTok username to monitor a live stream');

  const configRef    = useRef(config);
  const giftSoundRef = useRef(giftSounds);
  const usernameRef  = useRef(currentUsername);
  configRef.current    = config;
  giftSoundRef.current = giftSounds;
  usernameRef.current  = currentUsername;

  // ── TTS ───────────────────────────────────────────────────────────────────
  const speak = useCallback(async (text: string) => {
    const cfg = configRef.current;
    if (cfg.triggers.muteAll || cfg.moderation.silenceAll) return;
    const clean = censorWords(text, cfg.moderation.bannedWords);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: clean, voice: cfg.voice.voice }),
      });
      const data = await res.json();
      if (data.audio) {
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
        audio.volume = cfg.voice.volume / 100;
        audio.playbackRate = cfg.voice.speed;
        audio.play().catch(() => {});
      }
    } catch { /* ignore */ }
  }, []);

  // ── Gift sounds ───────────────────────────────────────────────────────────
  const playGiftSound = useCallback((giftId: number, diamonds: number) => {
    const cfg = configRef.current;
    const sounds = giftSoundRef.current;
    if (!cfg.gifts.globalEnabled) return;
    if (diamonds < cfg.gifts.minDiamondsForAlert) return;
    const s = sounds[giftId];
    if (s?.enabled && s?.soundUrl) {
      const a = new Audio(s.soundUrl);
      a.volume = cfg.voice.volume / 100;
      a.play().catch(() => {});
    }
  }, []);

  // ── WS message handler ────────────────────────────────────────────────────
  const handleMessage = useCallback((msg: WSMessage) => {
    const cfg = configRef.current;

    switch (msg.type) {
      case 'connected':
        setTiktokConnected(true);
        setTiktokConnecting(false);
        setStatusMsg(`Connected to @${(msg as any).username ?? usernameRef.current}'s live stream`);
        break;
      case 'connecting':
        setTiktokConnecting(true);
        break;
      case 'disconnected':
        setTiktokConnected(false);
        setStatusMsg('Stream ended or disconnected — auto-reconnecting…');
        setBattle(null);
        break;
      case 'error':
        setTiktokConnected(false);
        setTiktokConnecting(false);
        setStatusMsg(`⚠ ${msg.message}`);
        break;
      case 'info':
        setStatusMsg(msg.message ?? '');
        break;
      case 'roomUser': {
        const d = msg.data as any;
        setStats({ viewerCount: d?.viewerCount ?? 0, likeCount: d?.likeCount ?? 0 });
        break;
      }
      case 'battle':
        setBattle(msg.data as unknown as BattleState);
        break;
      case 'like': {
        const d = msg.data as any;
        if (d?.totalLikeCount) setStats(s => ({ ...s, likeCount: d.totalLikeCount }));
        break;
      }
      case 'chat': {
        const d = msg.data as any;
        if (cfg.triggers.muteAll) break;
        if (cfg.triggers.subscribersOnly && !d?.isSubscriber && !d?.isModerator) break;
        if (cfg.triggers.moderatorsOnly && !d?.isModerator) break;
        if (cfg.triggers.whitelist.length > 0 && !cfg.triggers.whitelist.includes(d?.userId ?? '') && !d?.isModerator) break;
        const ev: LiveEvent = {
          id: uid(), type: 'chat', timestamp: Date.now(),
          userId: d?.userId ?? '', nickname: d?.nickname ?? 'Unknown',
          comment: d?.comment ?? '', isModerator: d?.isModerator, isSubscriber: d?.isSubscriber,
        };
        setEvents(p => [ev, ...p].slice(0, MAX_EVENTS));
        if (cfg.voice.readChat && d?.comment) {
          speak(`${d.nickname}: ${d.comment}`);
        }
        break;
      }
      case 'gift': {
        const d = msg.data as any;
        if (!d?.repeatEnd) break;
        const ev: LiveEvent = {
          id: uid(), type: 'gift', timestamp: Date.now(),
          userId: d?.userId ?? '', nickname: d?.nickname ?? 'Unknown',
          giftName: d?.giftName ?? 'Gift', giftIcon: d?.giftIcon ?? '🎁',
          diamondCount: d?.diamondCount ?? 0, repeatCount: d?.repeatCount ?? 1,
        };
        setEvents(p => [ev, ...p].slice(0, MAX_EVENTS));
        playGiftSound(d?.giftId ?? 0, d?.diamondCount ?? 0);
        if (cfg.voice.readGifts && (d?.diamondCount ?? 0) >= cfg.triggers.minGiftDiamonds) {
          const tpl = cfg.templates.gift;
          if (tpl) speak(applyTemplate(tpl, { username: d?.nickname ?? '', gift: d?.giftName ?? 'a gift', diamonds: String(d?.diamondCount ?? 0), count: String(d?.repeatCount ?? 1) }));
        }
        break;
      }
      case 'follow': {
        const d = msg.data as any;
        const ev: LiveEvent = { id: uid(), type: 'follow', timestamp: Date.now(), userId: d?.userId ?? '', nickname: d?.nickname ?? 'Someone' };
        setEvents(p => [ev, ...p].slice(0, MAX_EVENTS));
        if (cfg.voice.readFollows) {
          const tpl = cfg.templates.follow;
          if (tpl) speak(applyTemplate(tpl, { username: d?.nickname ?? '' }));
        }
        break;
      }
      case 'share': {
        const d = msg.data as any;
        const ev: LiveEvent = { id: uid(), type: 'share', timestamp: Date.now(), userId: d?.userId ?? '', nickname: d?.nickname ?? 'Someone' };
        setEvents(p => [ev, ...p].slice(0, MAX_EVENTS));
        const tpl = cfg.templates.share;
        if (tpl) speak(applyTemplate(tpl, { username: d?.nickname ?? '' }));
        break;
      }
      case 'subscribe': {
        const d = msg.data as any;
        const ev: LiveEvent = { id: uid(), type: 'subscribe', timestamp: Date.now(), userId: d?.userId ?? '', nickname: d?.nickname ?? 'Someone' };
        setEvents(p => [ev, ...p].slice(0, MAX_EVENTS));
        const tpl = cfg.templates.subscribe;
        if (tpl) speak(applyTemplate(tpl, { username: d?.nickname ?? '' }));
        break;
      }
    }
  }, [speak, playGiftSound]);

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
    setTiktokConnecting(false);
    setCurrentUsername('');
    setStatusMsg('Disconnected from stream');
    setBattle(null);
    setStats({ viewerCount: 0, likeCount: 0 });
  }, [send]);

  return (
    <div className="min-h-screen relative text-white">
      <Starfield />
      <div className="scan-overlay" />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Header
          wsStatus={wsStatus}
          tiktokConnected={tiktokConnected}
          username={currentUsername}
          viewerCount={stats.viewerCount}
        />

        <main className="flex-1 p-4 max-w-[1640px] mx-auto w-full space-y-4">
          {/* Stats bar — live only */}
          <AnimatePresence>
            {tiktokConnected && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 0 }}
                exit={{ opacity: 0, height: 0 }}
              >
                <StatsBar stats={stats} events={events} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bento grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {/* Col 1: Connection + feed */}
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

            {/* Col 2: Battle + Boosters */}
            <div className="space-y-4">
              <BattlePanel battle={battle} />
              <BoosterTracker />
            </div>

            {/* Col 3: Config (full width on mobile/tablet) */}
            <div className="md:col-span-2 xl:col-span-1">
              <ConfigPanel
                config={config}
                onChange={setConfig}
                giftSounds={giftSounds}
                onGiftSoundsChange={setGiftSounds}
              />
            </div>
          </div>

          {/* Profile Lookup */}
          <ProfileLookup />

          {/* IPTV + Agenda row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <IPTVPlayer />
            <MatchSchedule />
          </div>
        </main>

        <footer className="py-4 text-center">
          <p className="text-[9px] text-white/10 font-mono tracking-[0.2em]">
            TIKLIVE COMMAND · STREAMER CONTROL CENTER · v2.0
          </p>
        </footer>
      </div>
    </div>
  );
}
