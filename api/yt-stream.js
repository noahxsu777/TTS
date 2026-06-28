module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const id = (req.query.id || '').trim();
  if (!id || !/^[a-zA-Z0-9_-]{11}$/.test(id)) {
    return res.status(400).json({ error: 'invalid video id' });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  for (const url of [`https://www.youtube.com/watch?v=${id}`, `https://m.youtube.com/watch?v=${id}`]) {
    try {
      const r = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
      if (!r.ok) continue;
      const html = await r.text();
      const m = html.match(/"hlsManifestUrl":"(https:[^"]+)"/);
      if (m) {
        const hlsUrl = m[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
        return res.json({ stream: hlsUrl, type: 'hls' });
      }
    } catch {}
  }

  res.json({ stream: null, error: 'No se pudo extraer el stream' });
};
