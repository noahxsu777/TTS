const { load } = require('cheerio');

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*',
  'Accept-Language': 'es-ES,es;q=0.9',
};

function extractM3u8(html) {
  return (
    html.match(/["'`](https?:\/\/[^"'`\s<>]+\.m3u8[^"'`\s<>]*)/)?.[1] ??
    html.match(/file\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)/)?.[1] ??
    html.match(/source\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)/)?.[1] ??
    html.match(/src\s*:\s*["'](https?:\/\/[^"']+\.m3u8[^"']*)/)?.[1] ??
    null
  );
}

async function fetchHtml(url, referer, timeout) {
  try {
    const r = await fetch(url, {
      headers: { ...FETCH_HEADERS, 'Referer': referer },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeout || 8000),
    });
    return r.ok ? r.text() : null;
  } catch { return null; }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const rawUrl = req.query.url;
  if (!rawUrl) return res.json({ stream: null, type: null });

  let parsed;
  try { parsed = new URL(rawUrl); } catch { return res.json({ stream: null, type: null }); }
  if (!['http:', 'https:'].includes(parsed.protocol)) return res.json({ stream: null, type: null });

  try {
    // Level 1: fetch the channel page and look for m3u8
    const html1 = await fetchHtml(rawUrl, parsed.origin + '/');
    if (!html1) return res.json({ stream: null, type: null });

    const m3u8L1 = extractM3u8(html1);
    if (m3u8L1) return res.json({ stream: m3u8L1, type: 'hls' });

    // Level 2: find inner iframes, fetch each and look for m3u8
    const $ = load(html1);
    const iframes = [];
    $('iframe[src]').each((_, el) => {
      const src = ($(el).attr('src') || '').trim();
      if (src.startsWith('http') && !src.includes(parsed.hostname)) iframes.push(src);
    });

    // Also look for JS-embedded iframe src patterns
    const jsSrc = html1.match(/["'](https?:\/\/[^"'\s<>]*\/(?:embed|player|live|stream)[^"'\s<>]*)/g);
    if (jsSrc) iframes.push(...jsSrc.map(s => s.replace(/^["']|["']$/g, '')));

    for (const iframeSrc of iframes.slice(0, 3)) {
      let iframeOrigin;
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
};
