import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
// @ts-ignore
import * as cheerio from 'cheerio';

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

// ── IPTV proxy — fetches M3U playlists server-side to bypass CORS ─────────────
app.get('/api/iptv-proxy', async (req: Request, res: Response) => {
  const { url } = req.query as { url?: string };
  if (!url) return res.status(400).send('url required');

  // Only allow http/https URLs
  let parsed: URL;
  try { parsed = new URL(url); } catch { return res.status(400).send('invalid url'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) return res.status(400).send('only http/https allowed');

  try {
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; IPTV-Proxy/1.0)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return res.status(r.status).send(`upstream ${r.status}`);
    const text = await r.text();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.send(text);
  } catch (err: any) {
    res.status(502).send(err?.message ?? 'fetch failed');
  }
});

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*',
  'Accept-Language': 'es-ES,es;q=0.9',
};

function extractM3u8(html: string): string | null {
  // Common patterns: quoted URL, jwplayer/videojs source, HLS config
  return (
    html.match(/["'`](https?:\/\/[^"'`\s<>]+\.m3u8[^"'`\s<>]*)/)?.[1] ??
    html.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)/)?.[1] ??
    html.match(/source\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)/)?.[1] ??
    html.match(/src\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)/)?.[1] ??
    null
  );
}

// ── Channel stream extractor (ad-free: find m3u8 — 2-level deep) ─────────────
app.get('/api/ch-stream', async (req: Request, res: Response) => {
  const rawUrl = req.query.url as string;
  if (!rawUrl) return res.json({ stream: null, type: null });
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return res.json({ stream: null, type: null }); }

  async function fetchHtml(url: string, referer: string): Promise<string | null> {
    try {
      const r = await fetch(url, {
        headers: { ...FETCH_HEADERS, 'Referer': referer },
        signal: AbortSignal.timeout(8000),
      });
      return r.ok ? r.text() : null;
    } catch { return null; }
  }

  try {
    // Level 1: fetch the channel page
    const html1 = await fetchHtml(rawUrl, parsed.origin + '/');
    if (!html1) return res.json({ stream: null, type: null });

    const m3u8L1 = extractM3u8(html1);
    if (m3u8L1) return res.json({ stream: m3u8L1, type: 'hls' });

    // Level 2: find inner iframes, fetch each one and look for m3u8
    const $1 = cheerio.load(html1);
    const iframes: string[] = [];
    $1('iframe[src]').each((_: any, el: any) => {
      const src = ($1(el).attr('src') ?? '').trim();
      if (src.startsWith('http') && !src.includes(parsed.hostname)) iframes.push(src);
    });
    // Also look for JS-embedded iframe src patterns
    const jsSrc = html1.match(/["'](https?:\/\/[^"'\s<>]*\/(?:embed|player|live|stream)[^"'\s<>]*)/g);
    if (jsSrc) iframes.push(...jsSrc.map(s => s.replace(/^["']|["']$/g, '')));

    for (const iframeSrc of iframes.slice(0, 3)) {
      let iframeOrigin: string;
      try { iframeOrigin = new URL(iframeSrc).origin; } catch { continue; }
      const html2 = await fetchHtml(iframeSrc, iframeOrigin + '/');
      if (!html2) continue;
      const m3u8L2 = extractM3u8(html2);
      if (m3u8L2) return res.json({ stream: m3u8L2, type: 'hls' });
    }

    // Fallback: return first cross-domain iframe src
    if (iframes.length > 0) return res.json({ stream: iframes[0], type: 'iframe' });

    res.json({ stream: null, type: null });
  } catch {
    res.json({ stream: null, type: null });
  }
});

// ── HLS stream proxy (hides source URL, adds CORS + Referer headers) ──────────
app.get('/api/hls-proxy', async (req: Request, res: Response) => {
  const url = req.query.url as string;
  if (!url) return res.status(400).send('missing url');
  let parsed: URL;
  try { parsed = new URL(url); } catch { return res.status(400).send('invalid url'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) return res.status(400).send('invalid protocol');

  const lpath = parsed.pathname.toLowerCase();
  const isPlaylist = lpath.includes('.m3u8') || (req.query.url as string).includes('.m3u8');

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': FETCH_HEADERS['User-Agent'],
        'Referer': parsed.origin + '/',
        'Origin': parsed.origin,
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return res.status(r.status).send('upstream error');

    const ct = r.headers.get('content-type') || '';
    const isM3u8 = isPlaylist || ct.includes('mpegurl') || ct.includes('x-mpegURL');

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');

    if (isM3u8) {
      const text = await r.text();
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      const rewritten = text.split('\n').map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('#') || trimmed === '') return line;
        let abs = trimmed.startsWith('http') ? trimmed : baseUrl + trimmed;
        return `/api/hls-proxy?url=${encodeURIComponent(abs)}`;
      }).join('\n');
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(rewritten);
    }

    // Binary segment — pipe through
    res.setHeader('Content-Type', ct || 'video/MP2T');
    const buf = await r.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (err: any) {
    res.status(502).send(err?.message || 'proxy error');
  }
});

// ── M3U playlist parser (compatible with all IPTV formats) ───────────────────
app.get('/api/iptv-parse', async (req: Request, res: Response) => {
  const url = req.query.url as string;
  if (!url) return res.json({ channels: [], count: 0, error: 'URL requerida' });

  let parsed: URL;
  try { parsed = new URL(url); } catch {
    return res.json({ channels: [], count: 0, error: 'URL inválida — debe empezar con http:// o https://' });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.json({ channels: [], count: 0, error: 'Solo se aceptan URLs http:// y https://' });
  }

  // Try multiple User-Agents — VLC/Kodi are whitelisted by most IPTV providers
  const userAgents = [
    'VLC/3.0.20 LibVLC/3.0.20',
    'Kodi/19.4 (X11; Linux x86_64) App_Bitness/64 Version/19.4-Matrix-19.4.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    'okhttp/4.9.0',
  ];

  let text = '';
  let lastError = '';

  for (const ua of userAgents) {
    try {
      const r = await fetch(url, {
        headers: {
          'User-Agent': ua,
          'Accept': '*/*',
          'Accept-Language': 'es,en;q=0.8',
          'Connection': 'keep-alive',
          'Icy-MetaData': '1',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) { lastError = `El servidor respondió con código ${r.status}`; continue; }
      const t = await r.text();
      if (t && t.length > 10) { text = t; break; }
      lastError = 'El servidor devolvió una respuesta vacía';
    } catch (e: any) {
      lastError = e?.message?.includes('timeout') ? 'Tiempo de espera agotado' : (e?.message || 'Error de conexión');
    }
  }

  if (!text) {
    return res.json({ channels: [], count: 0, error: `No se pudo descargar la lista. ${lastError}. Verifica que la URL esté activa y accesible.` });
  }

  // Normalize
  const norm = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  // Detect HTML (login wall, error page)
  if (/^<!doctype|^<html/i.test(norm)) {
    return res.json({ channels: [], count: 0, error: 'La URL devolvió una página web en lugar de una lista. Puede requerir inicio de sesión o la URL es incorrecta.' });
  }

  const lines = norm.split('\n');
  const channels: any[] = [];
  const seen = new Set<string>();
  const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

  function attr(line: string, key: string): string {
    return line.match(new RegExp(`${key}=["']([^"']*)["']`))?.[1]
        ?? line.match(new RegExp(`${key}=([^\\s,>]+)`))?.[1]
        ?? '';
  }
  function toAbsolute(u: string): string {
    if (u.startsWith('http') || u.startsWith('rtmp')) return u;
    if (u.startsWith('/')) return parsed.origin + u;
    return baseUrl + u;
  }
  function addChannel(id: string, name: string, url: string, logo: string, group: string) {
    const abs = toAbsolute(url);
    if (seen.has(abs)) return;
    seen.add(abs);
    const safeId = id.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 60) || `ch${channels.length}`;
    channels.push({ id: safeId, name: name || 'Canal', url: abs, logo, group: group || 'IPTV' });
  }

  // ── Format 1: Standard M3U (#EXTINF) ─────────────────────────────────────
  if (norm.includes('#EXTINF')) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith('#EXTINF')) continue;
      const name = attr(line, 'tvg-name') || line.slice(line.lastIndexOf(',') + 1).trim();
      const logo = attr(line, 'tvg-logo');
      const group = attr(line, 'group-title');
      const tvgId = attr(line, 'tvg-id');
      let streamUrl = '';
      for (let j = i + 1; j < lines.length && j < i + 10; j++) {
        const nl = lines[j].trim();
        if (nl && !nl.startsWith('#')) { streamUrl = nl; break; }
      }
      if (!streamUrl) continue;
      addChannel(tvgId || name, name, streamUrl, logo, group);
    }
  }

  // ── Format 2: HLS Master Playlist (#EXT-X-STREAM-INF) ────────────────────
  if (channels.length === 0 && norm.includes('#EXT-X-STREAM-INF')) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith('#EXT-X-STREAM-INF')) continue;
      const res2 = attr(line, 'RESOLUTION');
      const bw   = attr(line, 'BANDWIDTH');
      const name = res2 ? `Stream ${res2}` : `Stream ${bw ? Math.round(parseInt(bw) / 1000) + 'kbps' : i + 1}`;
      let streamUrl = '';
      for (let j = i + 1; j < lines.length && j < i + 3; j++) {
        const nl = lines[j].trim();
        if (nl && !nl.startsWith('#')) { streamUrl = nl; break; }
      }
      if (!streamUrl) continue;
      addChannel(`stream-${i}`, name, streamUrl, '', 'Streams');
    }
  }

  // ── Format 3: KODIPROP / #EXTVLCOPT extended format ──────────────────────
  if (channels.length === 0 && (norm.includes('#KODIPROP') || norm.includes('#EXTVLCOPT'))) {
    let currentName = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('#EXTINF')) {
        currentName = line.slice(line.lastIndexOf(',') + 1).trim();
      } else if (!line.startsWith('#') && line.startsWith('http')) {
        addChannel(currentName || `ch${i}`, currentName || `Canal ${i}`, line, '', 'IPTV');
        currentName = '';
      }
    }
  }

  // ── Format 4: Plain URL list (one URL per line, no metadata) ─────────────
  if (channels.length === 0) {
    let idx = 0;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      try { new URL(trimmed.startsWith('http') || trimmed.startsWith('rtmp') ? trimmed : 'http://' + trimmed); } catch { continue; }
      if (trimmed.startsWith('http') || trimmed.startsWith('rtmp')) {
        const name = decodeURIComponent(trimmed.split('/').pop()?.replace(/[?#].*/, '') || `Canal ${idx + 1}`);
        addChannel(`url-${idx}`, name, trimmed, '', 'IPTV');
        idx++;
      }
    }
  }

  if (channels.length === 0) {
    return res.json({ channels: [], count: 0, error: 'No se encontraron canales en la lista. El formato puede no ser compatible o la lista está vacía.' });
  }

  res.json({ channels, count: channels.length });
});

// ── Channel page proxy (ad-strip + volume control injection) ─────────────────
app.get('/api/ch-proxy', async (req: Request, res: Response) => {
  const rawUrl = req.query.url as string;
  if (!rawUrl) return res.status(400).send('missing url');
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return res.status(400).send('invalid url'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) return res.status(400).send('invalid protocol');
  try {
    const resp = await fetch(rawUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        'Referer': parsed.origin + '/',
      },
      signal: AbortSignal.timeout(15000),
    });
    const html = await resp.text();
    const $ = cheerio.load(html);

    // Strip ad scripts
    const adPatterns = ['googlesyndication','doubleclick','adsbygoogle','googletagmanager',
      'amazon-adsystem','pagead','adsense','moatads','outbrain','taboola','revcontent',
      'mgid','yandex','scorecard','comscore','vidazoo','adnxs','criteo','zedo','pubmatic','openx'];
    $('script').each((_: any, el: any) => {
      const src = $(el).attr('src') || '';
      const cnt = $(el).html() || '';
      if (adPatterns.some(p => src.includes(p) || cnt.includes(p))) $(el).remove();
    });
    $('ins.adsbygoogle').remove();
    $('iframe[src*="googlesyndication"],iframe[src*="doubleclick"]').remove();
    $('[id^="google_ads"],[class*="adsbygoogle"],[id*="ad-container"],[class*="ad-banner"]').remove();

    // Fix relative URLs
    $('base').remove();
    $('head').prepend(`<base href="${parsed.origin}/">`);

    // Inject postMessage volume listener + MutationObserver to catch dynamically added videos
    $('body').append(`<script>
(function(){
  var _v=1;
  function apply(){
    document.querySelectorAll('video').forEach(function(v){v.volume=_v;v.muted=_v===0;});
    document.querySelectorAll('iframe').forEach(function(f){try{f.contentWindow.postMessage({type:'SET_VOLUME',volume:_v},'*');}catch(e){}});
  }
  window.addEventListener('message',function(e){if(e.data&&e.data.type==='SET_VOLUME'){_v=e.data.volume;apply();}});
  new MutationObserver(apply).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(apply,1200);
})();
</script>`);

    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-cache, no-store');
    res.send($.html());
  } catch (err: any) {
    res.status(502).send(`<html><body style="background:#000;color:#aaa;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center"><p>Error al cargar canal<br><small>${err.message}</small></p></body></html>`);
  }
});

// ── Futbol Libres scraper ─────────────────────────────────────────────────────
const BASE_URL = 'https://futbol-libres.su';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Referer': 'https://futbol-libres.su/',
};

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

let flCache: FLMatch[] | null = null;
let flCacheTime = 0;
const FL_CACHE_TTL = 90 * 1000; // 90s

async function scrapeFutbolLibres(): Promise<FLMatch[]> {
  const r = await fetch(BASE_URL, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const html = await r.text();
  const $ = cheerio.load(html);
  const matches: FLMatch[] = [];

  // Parse match cards — the site uses various selectors; try multiple patterns
  const selectors = [
    '.event', '.match', '.partido', '.game', '.fixture',
    '[class*="event"]', '[class*="match"]', '[class*="partido"]',
    'article', '.card',
  ];

  let found = false;
  for (const sel of selectors) {
    const els = $(sel);
    if (els.length >= 2) {
      els.each((i: number, el: any) => {
        const $el = $(el);
        const link = $el.find('a').first().attr('href') || $el.attr('href') || '';
        const title = $el.find('h1,h2,h3,h4,.title,.name,.teams').first().text().trim()
          || $el.text().trim().slice(0, 80);

        if (!title || title.length < 4) return;

        // Try to detect score
        const scoreText = $el.find('.score,.result,.marcador,[class*="score"],[class*="result"]').first().text().trim();
        let homeScore: number | null = null;
        let awayScore: number | null = null;
        const scoreM = scoreText.match(/(\d+)\s*[-:]\s*(\d+)/);
        if (scoreM) { homeScore = parseInt(scoreM[1]); awayScore = parseInt(scoreM[2]); }

        // Extract teams from title
        const vsMatch = title.match(/^(.+?)\s+(?:vs?\.?|-)\.?\s+(.+?)(?:\s*\||$)/i);
        const homeTeam = vsMatch?.[1]?.trim() ?? title;
        const awayTeam = vsMatch?.[2]?.trim() ?? '';

        // Competition
        const competition = $el.find('.league,.competition,.liga,[class*="league"],[class*="competition"]').first().text().trim() || 'Fútbol';

        // Time
        const timeText = $el.find('.time,.hour,.hora,.kickoff,[class*="time"],[class*="hour"]').first().text().trim();

        // Status
        let status = 'NS';
        const liveEl = $el.find('.live,[class*="live"],[class*="en-vivo"]');
        if (liveEl.length) status = 'LIVE';
        else if (homeScore !== null) status = 'FT';

        // Logos
        const imgs = $el.find('img');
        const homeLogo = imgs.eq(0).attr('src') ?? '';
        const awayLogo = imgs.eq(1).attr('src') ?? '';

        const fullLink = link.startsWith('http') ? link : (link ? `${BASE_URL}${link.startsWith('/') ? '' : '/'}${link}` : '');

        matches.push({
          id: String(i),
          title,
          homeTeam,
          awayTeam,
          competition,
          kickoff: timeText || new Date().toISOString(),
          status,
          homeScore,
          awayScore,
          streamPageUrl: fullLink,
          homeLogo: homeLogo.startsWith('http') ? homeLogo : (homeLogo ? `${BASE_URL}${homeLogo}` : ''),
          awayLogo: awayLogo.startsWith('http') ? awayLogo : (awayLogo ? `${BASE_URL}${awayLogo}` : ''),
        });
      });
      if (matches.length > 0) { found = true; break; }
    }
  }

  // Fallback: look for any <a> that looks like a match link
  if (!found || matches.length === 0) {
    $('a[href]').each((i: number, el: any) => {
      const $el = $(el);
      const href = $el.attr('href') ?? '';
      const text = $el.text().trim();
      if (text.length < 5 || text.length > 100) return;
      if (!text.match(/vs|vs\.|–|-|\d+:\d+/i) && !href.match(/partido|match|game|event|live/i)) return;
      const fullLink = href.startsWith('http') ? href : `${BASE_URL}${href.startsWith('/') ? '' : '/'}${href}`;
      const vsMatch = text.match(/^(.+?)\s+(?:vs?\.?|–|-)\s+(.+?)(?:\s*\||$)/i);
      matches.push({
        id: String(i + 1000),
        title: text,
        homeTeam: vsMatch?.[1]?.trim() ?? text,
        awayTeam: vsMatch?.[2]?.trim() ?? '',
        competition: 'Fútbol',
        kickoff: new Date().toISOString(),
        status: 'NS',
        homeScore: null,
        awayScore: null,
        streamPageUrl: fullLink,
      });
    });
  }

  return matches;
}

// Extract stream URL from a match page
async function extractStreamUrl(pageUrl: string): Promise<string[]> {
  if (!pageUrl) return [];
  try {
    const r = await fetch(pageUrl, { headers: HEADERS, signal: AbortSignal.timeout(12000) });
    if (!r.ok) return [];
    const html = await r.text();

    const streams: string[] = [];

    // Look for .m3u8 URLs
    const m3u8Matches = [...html.matchAll(/["'`]?(https?:\/\/[^"'`\s]+\.m3u8[^"'`\s]*)/g)];
    for (const m of m3u8Matches) streams.push(m[1]);

    // Look for common stream patterns
    const srcMatches = [...html.matchAll(/['"](https?:\/\/[^'"]*(?:stream|live|hls|playlist|master)[^'"]*)['"]/gi)];
    for (const m of srcMatches) {
      const u = m[1];
      if (!streams.includes(u)) streams.push(u);
    }

    // iframe src (sub-players)
    const $ = cheerio.load(html);
    $('iframe').each((_: number, el: any) => {
      const src = $(el).attr('src') ?? '';
      if (src && src.startsWith('http') && !streams.includes(src)) streams.push(src);
    });

    // source tags
    $('source[src]').each((_: number, el: any) => {
      const src = $(el).attr('src') ?? '';
      if (src && !streams.includes(src)) streams.push(src);
    });

    return [...new Set(streams)].slice(0, 5);
  } catch {
    return [];
  }
}

app.get('/api/fl-schedule', async (_req: Request, res: Response) => {
  if (flCache && Date.now() - flCacheTime < FL_CACHE_TTL) return res.json(flCache);
  try {
    const matches = await scrapeFutbolLibres();
    flCache = matches;
    flCacheTime = Date.now();
    res.json(matches);
  } catch (e: any) {
    res.status(502).json({ error: e?.message ?? 'Scrape failed' });
  }
});

app.get('/api/fl-stream', async (req: Request, res: Response) => {
  const { url } = req.query as { url?: string };
  if (!url) return res.status(400).json({ error: 'url required' });
  try {
    const streams = await extractStreamUrl(url);
    res.json({ streams });
  } catch (e: any) {
    res.status(502).json({ error: e?.message });
  }
});

// Health check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', ts: new Date().toISOString(), uptime: process.uptime(), apiKey: !!TIKTOOLS_API_KEY });
});

// ── Static / Vite ─────────────────────────────────────────────────────────────
if (IS_PROD) {
  const distPath = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distPath));
  // Named pages before the React catch-all
  app.get('/monchito', (_req: Request, res: Response) => res.sendFile(path.join(distPath, 'monchito.html')));
  app.get('/tv', (_req: Request, res: Response) => res.sendFile(path.join(distPath, 'monchito.html')));
  app.get('/mp3', (_req: Request, res: Response) => res.sendFile(path.join(distPath, 'mp3.html')));
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
