export function relativeTime(ts: number): string {
  const delta = Math.floor((Date.now() - ts) / 1000);
  if (delta < 10) return 'just now';
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  return `${Math.floor(delta / 3600)}h ago`;
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const secs = s % 60;
  return `${m}:${secs.toString().padStart(2, '0')}`;
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function truncate(str: string, max = 80): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}

export function censorWords(text: string, bannedWords: Array<{ word: string; replacement: string }>): string {
  let result = text;
  for (const { word, replacement } of bannedWords) {
    if (!word) continue;
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'gi'), replacement || '***');
  }
  return result;
}
