const { load } = require('cheerio');

const BASE = 'https://www.tvporinternet2.com';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Referer': 'https://www.google.com/',
  'Cache-Control': 'no-cache',
};

function toAbs(href, base) {
  if (!href) return '';
  href = href.trim();
  if (href.startsWith('http')) return href;
  if (href.startsWith('//')) return 'https:' + href;
  if (href.startsWith('/')) return BASE + href;
  return (base || BASE) + '/' + href;
}

async function fetchHtml(url, timeout) {
  const r = await fetch(url, {
    headers: HEADERS,
    redirect: 'follow',
    signal: AbortSignal.timeout(timeout || 20000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
  return r.text();
}

function extractChannels(html) {
  const $ = load(html);
  const channels = [];
  const seen = new Set();

  function addChannel(name, logo, pageUrl) {
    if (!name || !pageUrl) return;
    name = name.replace(/\s+/g, ' ').trim();
    if (name.length < 2 || name.length > 80) return;
    if (/^(home|inicio|contacto|privacidad|política|blog|noticias|nosotros|facebook|twitter|instagram|youtube|whatsapp)$/i.test(name)) return;
    if (seen.has(pageUrl)) return;
    seen.add(pageUrl);
    channels.push({ name, logo: logo || '', pageUrl });
  }

  // Strategy 1: Links with -en-vivo, /ver/, /canal/ patterns
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (!href.includes('en-vivo') && !href.includes('/ver/') && !href.includes('/canal/') && !href.includes('/live/')) return;
    const fullUrl = toAbs(href, BASE);
    if (!fullUrl.startsWith(BASE)) return;
    const img = $(el).find('img').first();
    const logo = toAbs(img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src') || '', BASE);
    const name = img.attr('alt') || $(el).text().replace(/\s+/g, ' ').trim();
    addChannel(name, logo, fullUrl);
  });

  // Strategy 2: Article/post cards
  if (channels.length < 3) {
    $('article, .post, .card, .channel-item, .channel-card, .item').each((_, el) => {
      const $el = $(el);
      const link = $el.find('a').first();
      const href = link.attr('href') || '';
      const fullUrl = toAbs(href, BASE);
      if (!fullUrl.startsWith(BASE) || fullUrl === BASE + '/' || fullUrl === BASE) return;
      const path = new URL(fullUrl).pathname;
      if (/\/(page|category|tag|feed|wp-|sitemap|search|author)/i.test(path) || path === '/') return;
      const img = $el.find('img').first();
      const logo = toAbs(img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src') || '', BASE);
      const name = img.attr('alt') || $el.find('h1,h2,h3,h4,.title,.name,.channel-name').first().text().trim() || link.text().trim();
      addChannel(name, logo, fullUrl);
    });
  }

  // Strategy 3: Image links
  if (channels.length < 3) {
    $('a:has(img)').each((_, el) => {
      const $el = $(el);
      const href = $el.attr('href') || '';
      const fullUrl = toAbs(href, BASE);
      if (!fullUrl.startsWith(BASE) || fullUrl === BASE + '/' || fullUrl === BASE) return;
      const path = new URL(fullUrl).pathname;
      if (/\/(page|category|tag|feed|wp-|sitemap|search|author|wp-content|wp-admin)/i.test(path) || path === '/') return;
      const img = $el.find('img').first();
      const logo = toAbs(img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src') || '', BASE);
      const name = img.attr('alt') || $el.text().replace(/\s+/g, ' ').trim();
      addChannel(name, logo, fullUrl);
    });
  }

  // Strategy 4: Any internal links with slugs (last resort)
  if (channels.length < 3) {
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      const fullUrl = toAbs(href, BASE);
      if (!fullUrl.startsWith(BASE)) return;
      let path;
      try { path = new URL(fullUrl).pathname; } catch { return; }
      if (/\/(page|category|tag|feed|wp-|sitemap|search|author|wp-content|wp-admin|\?)/i.test(path) || path === '/' || path.length < 3) return;
      const img = $(el).find('img').first();
      const logo = toAbs(img.attr('src') || img.attr('data-src') || '', BASE);
      const name = img.attr('alt') || $(el).text().replace(/\s+/g, ' ').trim() || path.replace(/\//g, ' ').replace(/-/g, ' ').trim();
      addChannel(name, logo, fullUrl);
    });
  }

  return channels;
}

function extractStreams(html, pageUrl) {
  const $ = load(html);
  const streams = [];
  const seen = new Set();
  const base = pageUrl.substring(0, pageUrl.lastIndexOf('/') + 1);

  function addStream(src) {
    if (!src) return;
    src = toAbs(src.trim(), base);
    if (!src.startsWith('http')) return;
    if (seen.has(src)) return;
    const bad = ['disqus', 'facebook.com', 'doubleclick', 'google-analytics', 'twitter.com', 'whatsapp', 'telegram.me', 'adsbygoogle', 'googlesyndication'];
    if (bad.some(b => src.includes(b))) return;
    if (src.length < 10) return;
    seen.add(src);
    streams.push({ url: src, label: `Opción ${streams.length + 1}` });
  }

  // Iframes
  $('iframe').each((_, el) => {
    addStream($(el).attr('src') || $(el).attr('data-src') || '');
  });

  // Video sources
  $('video').each((_, el) => {
    addStream($(el).attr('src') || '');
    $(el).find('source').each((__, s) => addStream($(s).attr('src') || ''));
  });

  // Script stream vars (common player config patterns)
  $('script:not([src])').each((_, el) => {
    const txt = $(el).html() || '';
    const patterns = [
      /(?:file|src|source|stream|hls|url)\s*[:=]+\s*["']([^"']{10,}\.m3u8[^"']*)/gi,
      /(?:file|src|source|stream|url)\s*[:=]+\s*["']([^"']{10,}\.mp4[^"']*)/gi,
      /(?:file|src|source)\s*[:=]+\s*["'](rtmp:\/\/[^"']{5,})/gi,
    ];
    for (const pat of patterns) {
      let m;
      while ((m = pat.exec(txt)) !== null) addStream(m[1]);
    }
  });

  return streams;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ?page=URL — extract stream options from a channel page
  if (req.query.page) {
    const url = decodeURIComponent(req.query.page);
    try {
      const html = await fetchHtml(url, 15000);
      const streams = extractStreams(html, url);
      return res.json({ streams });
    } catch (e) {
      return res.json({ streams: [], error: e.message });
    }
  }

  // Main scrape — get all channels from homepage
  try {
    const html = await fetchHtml(BASE);
    const channels = extractChannels(html);

    if (!channels.length) {
      const $ = load(html);
      return res.json({
        channels: [],
        error: 'No se encontraron canales en la página principal.',
        debug: {
          title: $('title').text(),
          totalLinks: $('a[href]').length,
          bodyPreview: $('body').text().replace(/\s+/g, ' ').substring(0, 300),
        },
      });
    }

    return res.json({ channels, count: channels.length });
  } catch (e) {
    return res.json({ channels: [], error: e.message });
  }
};
