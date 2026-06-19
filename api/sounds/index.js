const { readdir, stat } = require('fs/promises');
const path = require('path');

const AUDIO_EXT = /\.(mp3|mpeg|mpg|m4a|ogg|wav|aac|flac)$/i;

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).end();

  const soundsDir = path.join(process.cwd(), 'public', 'sounds');
  try {
    const names = await readdir(soundsDir);
    const list = await Promise.all(
      names.filter(n => AUDIO_EXT.test(n)).map(async name => {
        const s = await stat(path.join(soundsDir, name));
        return {
          name,
          url: `/sounds/${encodeURIComponent(name)}`,
          size: s.size,
          createdAt: s.birthtime,
        };
      })
    );
    list.sort((a, b) => a.name.localeCompare(b.name));
    res.json(list);
  } catch {
    res.json([]);
  }
};
