import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const PORT = parseInt(process.env.PORT || '3000', 10);
const TIKTOOLS_API_KEY = process.env.TIKTOOLS_API_KEY || '';
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '2mb' }));

// ── WebSocket server ──────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

interface ClientState {
  username: string | null;
  tiktokConn: any;
  pingInterval: ReturnType<typeof setInterval> | null;
  mockInterval: ReturnType<typeof setInterval> | null;
}

function send(ws: WebSocket, msg: object) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

function startMockEvents(ws: WebSocket, username: string): ReturnType<typeof setInterval> {
  const nicknames = ['StarGazer', 'NeonRider', 'CosmicWave', 'PixelDrift', 'NightOwl', 'SolarFlare'];
  const comments = [
    '¡Hola! 👋', 'Great stream!', '¿Cuándo es la batalla?', 'LET\'S GOOOO 🔥',
    'First time here, loving it!', 'ggwp', 'Te amo desde Colombia 🇨🇴', 'Amazing content!',
    'QUÉ ÉPICO', 'Keep it up 💪', 'Nueva aquí, qué onda 😊', 'Greetings from Mexico 🇲🇽',
  ];
  const gifts = [
    { id: 5655, name: 'Rose', diamonds: 1, icon: '🌹' },
    { id: 5652, name: 'TikTok', diamonds: 1, icon: '🎵' },
    { id: 6080, name: 'Ice Cream Cone', diamonds: 5, icon: '🍦' },
    { id: 6083, name: 'Finger Heart', diamonds: 5, icon: '🤍' },
    { id: 6094, name: 'Sunglasses', diamonds: 49, icon: '😎' },
    { id: 5488, name: 'GG', diamonds: 99, icon: '🏆' },
    { id: 6118, name: 'Crown', diamonds: 299, icon: '👑' },
    { id: 7356, name: 'Universe', diamonds: 34999, icon: '🌌' },
  ];

  let likeCount = 0;
  let viewers = 1200 + Math.floor(Math.random() * 500);
  let battleScore1 = 50000;
  let battleScore2 = 45000;

  // Initial state
  send(ws, { type: 'connected', username });
  send(ws, { type: 'roomUser', data: { viewerCount: viewers, likeCount } });

  // Simulate a battle
  setTimeout(() => {
    send(ws, {
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
  }, 1500);

  return setInterval(() => {
    if (ws.readyState !== WebSocket.OPEN) return;
    const rand = Math.random();

    if (rand < 0.45) {
      // Chat
      const nick = nicknames[Math.floor(Math.random() * nicknames.length)];
      const comment = comments[Math.floor(Math.random() * comments.length)];
      send(ws, {
        type: 'chat',
        data: {
          userId: 'u_' + Math.random().toString(36).slice(2, 8),
          nickname: nick,
          comment,
          isModerator: Math.random() < 0.05,
          isSubscriber: Math.random() < 0.3,
          teamMemberLevel: Math.floor(Math.random() * 5),
        },
      });
    } else if (rand < 0.65) {
      // Like burst
      likeCount += Math.floor(Math.random() * 50) + 10;
      viewers += Math.floor(Math.random() * 5) - 2;
      send(ws, { type: 'roomUser', data: { viewerCount: Math.max(0, viewers), likeCount } });
    } else if (rand < 0.80) {
      // Gift
      const gift = gifts[Math.floor(Math.random() * gifts.length)];
      const nick = nicknames[Math.floor(Math.random() * nicknames.length)];
      send(ws, {
        type: 'gift',
        data: {
          userId: 'u_' + Math.random().toString(36).slice(2, 8),
          nickname: nick,
          giftId: gift.id,
          giftName: gift.name,
          giftIcon: gift.icon,
          diamondCount: gift.diamonds,
          repeatCount: Math.random() < 0.3 ? Math.floor(Math.random() * 10) + 1 : 1,
          repeatEnd: true,
        },
      });
      // Update battle score
      if (Math.random() < 0.5) {
        battleScore1 += gift.diamonds;
      } else {
        battleScore2 += gift.diamonds;
      }
      send(ws, {
        type: 'battle',
        data: {
          teams: [
            { id: 1, score: battleScore1, totalScore: battleScore1, hostUser: { userId: '111', nickname: username, avatar: '' } },
            { id: 2, score: battleScore2, totalScore: battleScore2, hostUser: { userId: '222', nickname: 'OpponentStreamer', avatar: '' } },
          ],
          endTime: Date.now() + 4 * 60 * 1000,
          status: 'active',
        },
      });
    } else if (rand < 0.90) {
      // Follow
      const nick = nicknames[Math.floor(Math.random() * nicknames.length)];
      send(ws, {
        type: 'follow',
        data: { userId: 'u_' + Math.random().toString(36).slice(2, 8), nickname: nick },
      });
    } else {
      // Share
      const nick = nicknames[Math.floor(Math.random() * nicknames.length)];
      send(ws, {
        type: 'share',
        data: { userId: 'u_' + Math.random().toString(36).slice(2, 8), nickname: nick },
      });
    }
  }, 1800);
}

async function connectTikTok(ws: WebSocket, state: ClientState, username: string) {
  state.username = username;
  try {
    // @ts-ignore
    const { WebcastPushConnection } = await import('tiktok-live-connector');
    const conn = new WebcastPushConnection(username, {
      processInitialData: true,
      fetchRoomInfoOnConnect: true,
      enableExtendedGiftInfo: true,
      enableWebsocketUpgrade: true,
      requestPollingIntervalMs: 2000,
    });
    state.tiktokConn = conn;

    const stateInfo = await conn.connect();
    send(ws, { type: 'connected', username, stateInfo });

    const events = ['chat', 'gift', 'like', 'roomUser', 'share', 'follow', 'subscribe', 'battle'];
    for (const ev of events) {
      conn.on(ev, (data: unknown) => send(ws, { type: ev, data }));
    }
    conn.on('disconnected', () => send(ws, { type: 'disconnected' }));
    conn.on('error', (err: Error) => send(ws, { type: 'error', message: err.message }));
  } catch {
    // Fallback: mock mode
    send(ws, { type: 'info', message: 'TikTok connector unavailable — running in demo mode' });
    state.mockInterval = startMockEvents(ws, username);
  }
}

wss.on('connection', (ws: WebSocket) => {
  const state: ClientState = { username: null, tiktokConn: null, pingInterval: null, mockInterval: null };

  // Heartbeat
  state.pingInterval = setInterval(() => {
    send(ws, { type: 'ping', ts: Date.now() });
  }, 25000);

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.action === 'connect' && msg.username) {
        if (state.tiktokConn) state.tiktokConn.disconnect?.();
        if (state.mockInterval) clearInterval(state.mockInterval);
        await connectTikTok(ws, state, msg.username.replace('@', ''));
      }

      if (msg.action === 'disconnect') {
        state.tiktokConn?.disconnect?.();
        state.tiktokConn = null;
        if (state.mockInterval) { clearInterval(state.mockInterval); state.mockInterval = null; }
        send(ws, { type: 'disconnected' });
      }
    } catch (e) {
      console.error('WS message error:', e);
    }
  });

  ws.on('close', () => {
    if (state.pingInterval) clearInterval(state.pingInterval);
    if (state.mockInterval) clearInterval(state.mockInterval);
    state.tiktokConn?.disconnect?.();
  });
});

// ── API Proxy Endpoints ───────────────────────────────────────────────────────

app.get('/api/user_profile', async (req: Request, res: Response) => {
  const { username } = req.query as { username?: string };
  if (!username) return res.status(400).json({ error: 'username required' });

  if (!TIKTOOLS_API_KEY) {
    // Return mock profile for demo
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
      league: {
        id: 'gold',
        name: 'Gold League',
        score: 98750,
        rank: 14,
        diamonds: 19750,
        region: 'Americas',
        startTime: Date.now() - 3 * 24 * 3600 * 1000,
        endTime: Date.now() + 4 * 24 * 3600 * 1000,
      },
    });
  }

  try {
    const r = await fetch(`https://tik.tools/api/user?username=${encodeURIComponent(username.replace('@', ''))}`, {
      headers: { Authorization: `Bearer ${TIKTOOLS_API_KEY}`, 'Content-Type': 'application/json' },
    });
    if (!r.ok) throw new Error(`Tik.Tools responded ${r.status}`);
    const data = await r.json();
    res.json(data);
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
      headers: { Authorization: `Bearer ${TIKTOOLS_API_KEY}` },
    });
    const data = await r.json();
    res.json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
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
      signal: AbortSignal.timeout(6000),
    });
    if (r.ok) {
      const d = await r.json() as any;
      if (d?.data) return res.json({ audio: d.data, source: 'tiktok' });
    }
  } catch { /* fall through */ }

  // Fallback: Google Translate TTS
  try {
    const lang = voice.startsWith('es') ? 'es' : voice.startsWith('pt') ? 'pt' : 'en';
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(text.slice(0, 200))}`;
    const r = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (r.ok) {
      const buf = await r.arrayBuffer();
      const b64 = Buffer.from(buf).toString('base64');
      return res.json({ audio: b64, source: 'google' });
    }
  } catch { /* fall through */ }

  res.status(502).json({ error: 'All TTS services unavailable' });
});

// Health check for Fly.io
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() });
});

// ── Static / Vite Middleware ──────────────────────────────────────────────────
if (IS_PROD) {
  const distPath = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (_req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  // Dynamic import to avoid loading Vite in prod
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
  // Catch-all for SPA in dev
  app.use((_req: Request, res: Response, _next: NextFunction) => {
    res.setHeader('Content-Type', 'text/html');
    vite.transformIndexHtml('/', '').then(() => {});
  });
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀  TikLive Command  •  http://0.0.0.0:${PORT}`);
  console.log(`   WebSocket  →  ws://0.0.0.0:${PORT}/ws`);
  console.log(`   Mode       →  ${IS_PROD ? 'production' : 'development'}\n`);
});
