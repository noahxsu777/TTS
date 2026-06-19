module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const url = req.query.url;
  if (!url) return res.json({ channels: [], count: 0, error: 'URL requerida' });

  let parsed;
  try { parsed = new URL(url); } catch {
    return res.json({ channels: [], count: 0, error: 'URL inválida' });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return res.json({ channels: [], count: 0, error: 'Solo se aceptan URLs http/https' });
  }

  const userAgents = [
    'VLC/3.0.20 LibVLC/3.0.20',
    'Kodi/19.4 (X11; Linux x86_64) App_Bitness/64 Version/19.4-Matrix-19.4.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
    'okhttp/4.9.0',
  ];

  let text = '', lastError = '';
  for (const ua of userAgents) {
    try {
      const r = await fetch(url, {
        headers: { 'User-Agent': ua, 'Accept': '*/*', 'Connection': 'keep-alive' },
        redirect: 'follow', signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) { lastError = `HTTP ${r.status}`; continue; }
      const t = await r.text();
      if (t && t.length > 10) { text = t; break; }
    } catch (e) {
      lastError = e?.message || 'Error de conexión';
    }
  }

  if (!text) return res.json({ channels: [], count: 0, error: `No se pudo descargar la lista. ${lastError}` });

  const norm = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (/^<!doctype|^<html/i.test(norm)) {
    return res.json({ channels: [], count: 0, error: 'La URL devolvió una página web, no una lista IPTV.' });
  }

  const lines = norm.split('\n');
  const channels = [];
  const seen = new Set();
  const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

  function attr(line, key) {
    return line.match(new RegExp(`${key}=["']([^"']*)["']`))?.[1]
        ?? line.match(new RegExp(`${key}=([^\\s,>]+)`))?.[1] ?? '';
  }
  function toAbs(u) {
    if (u.startsWith('http') || u.startsWith('rtmp')) return u;
    if (u.startsWith('/')) return parsed.origin + u;
    return baseUrl + u;
  }
  function addCh(id, name, url, logo, group) {
    const abs = toAbs(url);
    if (seen.has(abs)) return;
    seen.add(abs);
    const safeId = (id||name).toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').slice(0,60)||`ch${channels.length}`;
    channels.push({ id: safeId, name: name||'Canal', url: abs, logo, group: group||'IPTV' });
  }

  if (norm.includes('#EXTINF')) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line.startsWith('#EXTINF')) continue;
      const name = attr(line,'tvg-name') || line.slice(line.lastIndexOf(',')+1).trim();
      const logo = attr(line,'tvg-logo'), group = attr(line,'group-title'), tvgId = attr(line,'tvg-id');
      let streamUrl = '';
      for (let j=i+1;j<lines.length&&j<i+10;j++){const nl=lines[j].trim();if(nl&&!nl.startsWith('#')){streamUrl=nl;break;}}
      if (streamUrl) addCh(tvgId||name, name, streamUrl, logo, group);
    }
  }
  if (!channels.length) {
    for (let i=0;i<lines.length;i++){
      const t=lines[i].trim();
      if(!t||t.startsWith('#'))continue;
      if(t.startsWith('http')||t.startsWith('rtmp')){
        const name=decodeURIComponent(t.split('/').pop()?.replace(/[?#].*/,'')||`Canal ${i}`);
        addCh(`url-${i}`,name,t,'','IPTV');
      }
    }
  }

  if (!channels.length) return res.json({ channels:[], count:0, error:'No se encontraron canales.' });
  res.json({ channels, count: channels.length });
};
