const { writeFile, mkdir } = require('fs/promises');
const path = require('path');

const AUDIO_EXT = /\.(mp3|mpeg|mpg|m4a|ogg|wav|aac|flac)$/i;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const rawName = ((req.query.name) || '').replace(/[^a-zA-Z0-9.\-_ ]/g, '_').trim();
  if (!rawName) return res.status(400).json({ error: 'name requerido' });

  const filename = AUDIO_EXT.test(rawName) ? rawName : rawName + '.mp3';
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: 'nombre inválido' });
  }

  // Vercel /tmp is writable but ephemeral — files disappear after deployment
  // For permanent storage, commit files to the repo
  const tmpDir = path.join('/tmp', 'sounds');
  try {
    await mkdir(tmpDir, { recursive: true });
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const buf = Buffer.concat(chunks);
    await writeFile(path.join(tmpDir, filename), buf);
    res.json({
      url: `/sounds/${encodeURIComponent(filename)}`,
      filename,
      size: buf.length,
      note: 'Temporal: para que sea permanente, sube el archivo al repositorio GitHub.',
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
