import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

// Load .env in dev
try {
  const env = readFileSync('.env', 'utf8');
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length && !process.env[k.trim()]) {
      process.env[k.trim()] = v.join('=').trim();
    }
  }
} catch { /* .env not present in prod */ }

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);
const TIKTOOLS_API_KEY = process.env.TIKTOOLS_API_KEY || '';
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// ── Gift cache ────────────────────────────────────────────────────────────────
interface TikGift {
  id: number;
  name: string;
  diamond: number;
  image: string;
  emoji: string;
  category?: string;
}

// Comprehensive built-in TikTok gift list (fallback when API unavailable)
const BUILTIN_GIFTS: TikGift[] = [
  { id: 5655, name: 'Rose',              diamond: 1,     image: '', emoji: '🌹', category: 'Basic' },
  { id: 5652, name: 'TikTok',            diamond: 1,     image: '', emoji: '🎵', category: 'Basic' },
  { id: 7804, name: 'Friendship Necklace', diamond: 1,   image: '', emoji: '📿', category: 'Basic' },
  { id: 5680, name: 'Tiny Diny',         diamond: 1,     image: '', emoji: '🦕', category: 'Basic' },
  { id: 6086, name: 'Heart Me',          diamond: 1,     image: '', emoji: '💗', category: 'Basic' },
  { id: 6080, name: 'Ice Cream Cone',    diamond: 5,     image: '', emoji: '🍦', category: 'Food' },
  { id: 6083, name: 'Finger Heart',      diamond: 5,     image: '', emoji: '🤍', category: 'Love' },
  { id: 6067, name: 'Candy Cane',        diamond: 5,     image: '', emoji: '🍬', category: 'Food' },
  { id: 6068, name: 'Love You',          diamond: 10,    image: '', emoji: '💕', category: 'Love' },
  { id: 6091, name: 'Football',          diamond: 29,    image: '', emoji: '⚽', category: 'Sports' },
  { id: 6094, name: 'Sunglasses',        diamond: 49,    image: '', emoji: '😎', category: 'Fashion' },
  { id: 6102, name: 'Perfume',           diamond: 49,    image: '', emoji: '🌸', category: 'Fashion' },
  { id: 5488, name: 'GG',               diamond: 99,    image: '', emoji: '🏆', category: 'Gaming' },
  { id: 6307, name: 'Festival',          diamond: 99,    image: '', emoji: '🎉', category: 'Celebration' },
  { id: 7296, name: 'Flower to You',     diamond: 199,   image: '', emoji: '💐', category: 'Love' },
  { id: 6118, name: 'Crown',             diamond: 299,   image: '', emoji: '👑', category: 'Luxury' },
  { id: 6122, name: 'Lion',              diamond: 299,   image: '', emoji: '🦁', category: 'Animals' },
  { id: 6310, name: 'Star',              diamond: 299,   image: '', emoji: '⭐', category: 'Basic' },
  { id: 6400, name: 'Hand Heart',        diamond: 499,   image: '', emoji: '🫶', category: 'Love' },
  { id: 6420, name: 'Piano',             diamond: 699,   image: '', emoji: '🎹', category: 'Music' },
  { id: 6248, name: 'Rocket',            diamond: 1499,  image: '', emoji: '🚀', category: 'Space' },
  { id: 6451, name: 'Vintage Microphone', diamond: 1999, image: '', emoji: '🎙️', category: 'Music' },
  { id: 6466, name: 'Drama Queen',       diamond: 5000,  image: '', emoji: '👸', category: 'Luxury' },
  { id: 7720, name: 'Galaxy',            diamond: 17499, image: '', emoji: '🌌', category: 'Space' },
  { id: 7356, name: 'Universe',          diamond: 34999, image: '', emoji: '🌠', category: 'Space' },
  { id: 7679, name: 'Interstellar',      diamond: 44999, image: '', emoji: '🛸', category: 'Space' },
];

let giftCache: TikGift[] | null = null;
let giftCacheTime = 0;
const GIFT_CACHE_TTL = 12 * 3600 * 1000; // 12h

async function fetchGiftsFromTikTools(): Promise<TikGift[] | null> {
  if (!TIKTOOLS_API_KEY) return null;
  const endpoints = [
    'https://tik.tools/api/gifts',
    'https://tik.tools/api/gift/list',
    'https://tik.tools/api/gift',
  ];
  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        headers: { Authorization: `Bearer ${TIKTOOLS_API_KEY}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (!r.ok) continue;
      const raw = await r.json() as any;
      const arr: any[] = Array.isArray(raw) ? raw : (raw?.gifts ?? raw?.data ?? raw?.result ?? []);
      if (arr.length > 0) {
        const gifts = arr.map((g: any) => ({
          id: g.id ?? g.gift_id ?? g.giftId ?? 0,
          name: g.name ?? g.gift_name ?? g.giftName ?? 'Unknown',
          diamond: g.diamond ?? g.diamond_count ?? g.diamondCount ?? g.diamonds ?? 0,
          image: g.image ?? g.picture ?? g.img ?? g.icon ?? g.url ?? '',
          emoji: g.emoji ?? '🎁',
          category: g.category ?? g.type ?? '',
        })) as TikGift[];
        return gifts.filter(g => g.id > 0);
      }
    } catch { /* try next endpoint */ }
  }
  return null;
}

// ── WebSocket server ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

interface ClientState {
  username: string | null;
  tiktokConn: any;
  pingInterval: ReturnType<typeof setInterval> | null;
  mockInterval: ReturnType<typeof setInterval> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  lastPong: number;
  isAlive: boolean;
}

function safeSend(ws: WebSocket, msg: object) {
  if (ws.readyState === WebSocket.OPEN) {
    try { ws.send(JSON.stringify(msg)); } catch { /* ignore */ }
  }
}

function startMockEvents(ws: WebSocket, username: string): ReturnType<typeof setInterval> {
  const nicknames = ['StarGazer', 'NeonRider', 'CosmicWave', 'PixelDrift', 'NightOwl', 'SolarFlare', 'LunaStream', 'ByteWave'];
  const comments = [
    '¡Hola! 👋', 'Great stream!', '¿Cuándo es la batalla?', 'LET\'S GOOOO 🔥',
    'First time here, loving it!', 'ggwp', 'Te amo desde Colombia 🇨🇴',
    'QUÉ ÉPICO', 'Keep it up 💪', 'Greetings from Mexico 🇲🇽',
    'This is amazing!', '❤️❤️❤️', 'GO GO GO!', 'Nuevo aquí!',
  ];
  const gifts = BUILTIN_GIFTS.slice(0, 12);

  let viewers = 1200 + Math.floor(Math.random() * 500);
  let likeCount = 0;
  let battleScore1 = 50000;
  let battleScore2 = 45000;

  safeSend(ws, { type: 'connected', username });
  safeSend(ws, { type: 'roomUser', data: { viewerCount: viewers, likeCount } });

  setTimeout(() => {
    safeSend(ws, {
      type: 'battle',
      data: {
        teams: [
          { id: 1, score: battleScore1, totalScore: battleScore1, hostUser: { userId: '111', nickname: username, avatar: '' } },
          { id: 2, score: battleScore2, totalScore: battleScore2, hostUser: { userId: '222', nickname: 'OpponentStreamer', avatar: '' } },
        ],
        endTime: Date.now() + 5 * 60 * 1000,
        status: 'active',
      },
    });
  }, 2000);

  return setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const rand = Math.random();

    if (rand < 0.40) {
      safeSend(ws, {
        type: 'chat',
        data: {
          userId: 'u_' + Math.random().toString(36).slice(2, 8),
          nickname: nicknames[Math.floor(Math.random() * nicknames.length)],
          comment: comments[Math.floor(Math.random() * comments.length)],
          isModerator: Math.random() < 0.05,
          isSubscriber: Math.random() < 0.3,
          teamMemberLevel: Math.floor(Math.random() * 5),
        },
      });
    } else if (rand < 0.60) {
      likeCount += Math.floor(Math.random() * 80) + 20;
      viewers += Math.floor(Math.random() * 10) - 4;
      safeSend(ws, { type: 'roomUser', data: { viewerCount: Math.max(1, viewers), likeCount } });
    } else if (rand < 0.78) {
      const gift = gifts[Math.floor(Math.random() * gifts.length)];
      const nick = nicknames[Math.floor(Math.random() * nicknames.length)];
      const repeat = Math.random() < 0.3 ? Math.floor(Math.random() * 10) + 1 : 1;
      safeSend(ws, {
        type: 'gift',
        data: {
          userId: 'u_' + Math.random().toString(36).slice(2, 8),
          nickname: nick,
          giftId: gift.id,
          giftName: gift.name,
          giftIcon: gift.emoji,
          diamondCount: gift.diamond * repeat,
          repeatCount: repeat,
          repeatEnd: true,
        },
      });
      if (Math.random() < 0.5) battleScore1 += gift.diamond * repeat;
      else battleScore2 += gift.diamond * repeat;
      safeSend(ws, {
        type: 'battle',
        data: {
          teams: [
            { id: 1, score: battleScore1, totalScore: battleScore1, hostUser: { userId: '111', nickname: username, avatar: '' } },
            { id: 2, score: battleScore2, totalScore: battleScore2, hostUser: { userId: '222', nickname: 'OpponentStreamer', avatar: '' } },
          ],
          endTime: Date.now() + 4.5 * 60 * 1000,
          status: 'active',
        },
      });
    } else if (rand < 0.90) {
      safeSend(ws, {
        type: 'follow',
        data: { userId: 'u_' + Math.random().toString(36).slice(2, 8), nickname: nicknames[Math.floor(Math.random() * nicknames.length)] },
      });
    } else {
      safeSend(ws, {
        type: 'share',
        data: { userId: 'u_' + Math.random().toString(36).slice(2, 8), nickname: nicknames[Math.floor(Math.random() * nicknames.length)] },
      });
    }
  }, 1800);
}

async function connectTikTok(ws: WebSocket, state: ClientState, username: string) {
  if (state.reconnectTimer) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null; }

  state.username = username;
  safeSend(ws, { type: 'connecting', username });

  if (!TIKTOOLS_API_KEY) {
    safeSend(ws, { type: 'info', message: 'No API key configured — running in demo mode' });
    state.mockInterval = startMockEvents(ws, username);
    return;
  }

  try {
    // @ts-ignore — v2 ESM types
    const mod = await import('tiktok-live-connector');
    const TikTokLiveConnection = mod.TikTokLiveConnection ?? mod.default?.TikTokLiveConnection;
    const SignConfig = mod.SignConfig ?? mod.default?.SignConfig;

    if (!TikTokLiveConnection) throw new Error('TikTokLiveConnection not found in module');

    // Apply EulerStream API key for WebSocket signing
    if (SignConfig) {
      SignConfig.apiKey = TIKTOOLS_API_KEY;
    }

    const conn = new TikTokLiveConnection(username, {
      processInitialData: true,
      fetchRoomInfoOnConnect: true,
      enableExtendedGiftInfo: true,
    });
    state.tiktokConn = conn;

    // Forward live events to the browser client
    const FORWARD_EVENTS = ['chat', 'gift', 'like', 'roomUser', 'share', 'follow', 'subscribe', 'member', 'envelope', 'questionNew'];
    for (const ev of FORWARD_EVENTS) {
      conn.on(ev, (data: unknown) => safeSend(ws, { type: ev, data }));
    }

    // Battle (v2 event name)
    conn.on('linkMicBattle', (data: unknown) => safeSend(ws, { type: 'battle', data }));

    conn.on('streamEnd', () => {
      safeSend(ws, { type: 'disconnected' });
      scheduleReconnect(ws, state);
    });

    conn.on('disconnected', (_info: unknown) => {
      safeSend(ws, { type: 'disconnected' });
      scheduleReconnect(ws, state);
    });

    conn.on('error', (err: Error) => {
      safeSend(ws, { type: 'error', message: err?.message ?? 'Unknown error' });
    });

    await conn.connect();
    safeSend(ws, { type: 'connected', username });

  } catch (err: any) {
    const msg = err?.message ?? String(err);
    safeSend(ws, { type: 'error', message: `Connection failed: ${msg.slice(0, 120)}` });
    // Retry after 10s on failure
    if (ws.readyState === WebSocket.OPEN && state.username) {
      state.reconnectTimer = setTimeout(() => {
        safeSend(ws, { type: 'info', message: `Retrying connection to @${state.username}…` });
        connectTikTok(ws, state, state.username!);
      }, 10000);
    }
  }
}

function scheduleReconnect(ws: WebSocket, state: ClientState) {
  if (ws.readyState === WebSocket.OPEN && state.username) {
    state.reconnectTimer = setTimeout(() => {
      safeSend(ws, { type: 'info', message: `Reconnecting to @${state.username}…` });
      connectTikTok(ws, state, state.username!);
    }, 5000);
  }
}

wss.on('connection', (ws: WebSocket, req) => {
  const state: ClientState = {
    username: null, tiktokConn: null,
    pingInterval: null, mockInterval: null,
    reconnectTimer: null, lastPong: Date.now(), isAlive: true,
  };

  // Heartbeat — terminate dead connections
  state.pingInterval = setInterval(() => {
    if (!state.isAlive) {
      ws.terminate();
      return;
    }
    state.isAlive = false;
    safeSend(ws, { type: 'ping', ts: Date.now() });
  }, 20000);

  ws.on('pong', () => { state.isAlive = true; state.lastPong = Date.now(); });

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'pong') {
        state.isAlive = true;
        state.lastPong = Date.now();
        return;
      }

      if (msg.action === 'connect' && msg.username) {
        state.tiktokConn?.disconnect?.();
        if (state.mockInterval) { clearInterval(state.mockInterval); state.mockInterval = null; }
        await connectTikTok(ws, state, msg.username.replace('@', ''));
      }

      if (msg.action === 'disconnect') {
        state.tiktokConn?.disconnect?.();
        state.tiktokConn = null;
        state.username = null;
        if (state.mockInterval) { clearInterval(state.mockInterval); state.mockInterval = null; }
        if (state.reconnectTimer) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null; }
        safeSend(ws, { type: 'disconnected' });
      }
    } catch { /* ignore parse errors */ }
  });

  ws.on('close', () => {
    if (state.pingInterval) clearInterval(state.pingInterval);
    if (state.mockInterval) clearInterval(state.mockInterval);
    if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
    state.tiktokConn?.disconnect?.();
  });

  ws.on('error', () => { /* handled by close */ });
});

// ── API Endpoints ─────────────────────────────────────────────────────────────

app.get('/api/gifts', async (_req: Request, res: Response) => {
  // Serve from cache if fresh
  if (giftCache && Date.now() - giftCacheTime < GIFT_CACHE_TTL) {
    return res.json(giftCache);
  }
  // Try Tik.Tools
  const remote = await fetchGiftsFromTikTools();
  if (remote && remote.length > 0) {
    giftCache = remote;
    giftCacheTime = Date.now();
    return res.json(remote);
  }
  // Fallback
  giftCache = BUILTIN_GIFTS;
  giftCacheTime = Date.now();
  res.json(BUILTIN_GIFTS);
});

app.get('/api/user_profile', async (req: Request, res: Response) => {
  const { username } = req.query as { username?: string };
  if (!username) return res.status(400).json({ error: 'username required' });

  if (!TIKTOOLS_API_KEY) {
    return res.json({
      mock: true,
      userId: 'demo_123',
      uniqueId: username.replace('@', ''),
      nickname: username.replace('@', ''),
      avatar: `https://picsum.photos/seed/${username}/200`,
      signature: '🎮 Live Streamer | Gaming & Entertainment',
      followerCount: 125400,
      followingCount: 312,
      heartCount: 2800000,
      videoCount: 89,
      isLive: true,
      viewerCount: 1432,
      league: { id: 'gold', name: 'Gold League', score: 98750, rank: 14, diamonds: 19750, region: 'Americas', startTime: Date.now() - 3 * 86400000, endTime: Date.now() + 4 * 86400000 },
    });
  }

  try {
    const endpoints = [
      `https://tik.tools/api/user?username=${encodeURIComponent(username.replace('@', ''))}`,
      `https://tik.tools/api/profile?username=${encodeURIComponent(username.replace('@', ''))}`,
    ];
    for (const url of endpoints) {
      const r = await fetch(url, { headers: { Authorization: `Bearer ${TIKTOOLS_API_KEY}` }, signal: AbortSignal.timeout(8000) });
      if (r.ok) { return res.json(await r.json()); }
    }
    throw new Error('All profile endpoints failed');
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/stream_url', async (req: Request, res: Response) => {
  const { username } = req.query as { username?: string };
  if (!username) return res.status(400).json({ error: 'username required' });
  if (!TIKTOOLS_API_KEY) return res.status(403).json({ error: 'API key not configured' });
  try {
    const r = await fetch(`https://tik.tools/api/stream?username=${encodeURIComponent(username.replace('@', ''))}`, {
      headers: { Authorization: `Bearer ${TIKTOOLS_API_KEY}` }, signal: AbortSignal.timeout(8000),
    });
    res.json(await r.json());
  } catch (err: any) { res.status(502).json({ error: err.message }); }
});

app.post('/api/tts', async (req: Request, res: Response) => {
  const { text, voice = 'en_us_001' } = req.body as { text?: string; voice?: string };
  if (!text) return res.status(400).json({ error: 'text required' });

  // Primary: TikTok TTS
  try {
    const r = await fetch('https://tiktok-tts.weilnet.workers.dev/api/generation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.slice(0, 300), voice }),
      signal: AbortSignal.timeout(7000),
    });
    if (r.ok) {
      const d = await r.json() as any;
      if (d?.data) return res.json({ audio: d.data, source: 'tiktok' });
    }
  } catch { /* fallback */ }

  // Fallback: Google TTS
  try {
    const lang = voice.startsWith('es') ? 'es' : voice.startsWith('pt') ? 'pt' : 'en';
    const r = await fetch(`https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text.slice(0, 200))}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(9000),
    });
    if (r.ok) {
      const b64 = Buffer.from(await r.arrayBuffer()).toString('base64');
      return res.json({ audio: b64, source: 'google' });
    }
  } catch { /* give up */ }

  res.status(502).json({ error: 'All TTS services unavailable' });
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', ts: new Date().toISOString(), uptime: process.uptime(), apiKey: !!TIKTOOLS_API_KEY });
});

// ── Static / Vite ─────────────────────────────────────────────────────────────
if (IS_PROD) {
  const distPath = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req: Request, res: Response) => res.sendFile(path.join(distPath, 'index.html')));
} else {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀  TikLive Command  •  http://0.0.0.0:${PORT}`);
  console.log(`   WebSocket  →  ws://0.0.0.0:${PORT}/ws`);
  console.log(`   API Key    →  ${TIKTOOLS_API_KEY ? '✓ configured' : '✗ not set'}`);
  console.log(`   Mode       →  ${IS_PROD ? 'production' : 'development'}\n`);
});
