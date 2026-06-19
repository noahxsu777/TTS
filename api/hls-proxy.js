// HLS proxy — rewrites m3u8 playlists so source URLs stay hidden
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = req.query.url;
  if (!url) return res.status(400).send('missing url');

  let parsed;
  try { parsed = new URL(url); } catch { return res.status(400).send('invalid url'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) return res.status(400).send('invalid protocol');

  const lpath = parsed.pathname.toLowerCase();
  const isPlaylist = lpath.includes('.m3u8') || url.includes('.m3u8');

  try {
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Referer': parsed.origin + '/',
        'Origin': parsed.origin,
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return res.status(r.status).send('upstream error');

    const ct = r.headers.get('content-type') || '';
    const isM3u8 = isPlaylist || ct.includes('mpegurl');

    if (isM3u8) {
      const text = await r.text();
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      const rewritten = text.split('\n').map(line => {
        const t = line.trim();
        if (t.startsWith('#') || t === '') return line;
        const abs = t.startsWith('http') ? t : baseUrl + t;
        return `/api/hls-proxy?url=${encodeURIComponent(abs)}`;
      }).join('\n');
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      return res.send(rewritten);
    }

    res.setHeader('Content-Type', ct || 'video/MP2T');
    const buf = await r.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (e) {
    res.status(502).send(e.message || 'proxy error');
  }
};
