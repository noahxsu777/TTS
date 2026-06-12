import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Volume2, Play, Mic } from 'lucide-react';
import type { VoiceConfig } from '../../types';

const TIKTOK_VOICES = [
  { id: 'en_us_001', label: 'English (US) — Female 1' },
  { id: 'en_us_002', label: 'English (US) — Female 2' },
  { id: 'en_us_006', label: 'English (US) — Male 1' },
  { id: 'en_us_007', label: 'English (US) — Male 2' },
  { id: 'en_uk_001', label: 'English (UK) — Male' },
  { id: 'en_au_001', label: 'English (AU) — Female' },
  { id: 'es_mx_002', label: 'Español (MX) — Male' },
  { id: 'es_es_001', label: 'Español (ES)' },
  { id: 'pt_br_001', label: 'Português (BR)' },
  { id: 'fr_001',    label: 'Français' },
  { id: 'de_001',    label: 'Deutsch' },
  { id: 'jp_001',    label: '日本語' },
  { id: 'kr_001',    label: '한국어' },
];

function Slider({
  label, value, min, max, step = 1, unit = '',
  color = '#0A84FF', onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; color?: string;
  onChange: (v: number) => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-white/60">{label}</span>
        <span className="stat-mono text-white/80">{value}{unit}</span>
      </div>
      <div className="relative h-5 flex items-center">
        <div className="relative w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div
            className="absolute left-0 top-0 h-full rounded-full"
            style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: `0 0 6px ${color}60` }}
          />
          <input
            type="range" min={min} max={max} step={step} value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="absolute inset-0 w-full opacity-0 cursor-pointer h-5"
            style={{ zIndex: 2 }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg cursor-pointer"
            style={{ left: `calc(${pct}% - 8px)`, background: color, boxShadow: `0 0 8px ${color}80`, zIndex: 1 }}
          />
        </div>
      </div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="toggle"
      style={{ background: checked ? '#0A84FF' : 'rgba(255,255,255,0.1)' }}
    >
      <motion.span
        layout
        className="toggle-thumb"
        style={{ marginLeft: checked ? '22px' : '2px' }}
      />
    </button>
  );
}

interface VoicesTabProps {
  config: VoiceConfig;
  onChange: (c: VoiceConfig) => void;
}

export default function VoicesTab({ config, onChange }: VoicesTabProps) {
  const [testing, setTesting] = useState(false);

  const update = <K extends keyof VoiceConfig>(key: K, val: VoiceConfig[K]) =>
    onChange({ ...config, [key]: val });

  const testTTS = async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: 'TikLive Command, streamer control center activated!', voice: config.voice }),
      });
      const data = await res.json();
      if (data.audio) {
        const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`);
        audio.volume = config.volume / 100;
        audio.playbackRate = config.speed;
        await audio.play();
      }
    } catch { /* ignore */ }
    setTesting(false);
  };

  return (
    <div className="space-y-5">
      {/* Engine selector */}
      <div className="space-y-2">
        <p className="section-label flex items-center gap-1.5"><Mic size={9} /> Engine</p>
        <div className="grid grid-cols-2 gap-2">
          {(['tiktok', 'google'] as const).map(eng => (
            <motion.button
              key={eng}
              whileTap={{ scale: 0.97 }}
              onClick={() => update('engine', eng)}
              className="py-2 rounded-ios-sm text-xs font-medium transition-all"
              style={{
                background: config.engine === eng ? 'rgba(10,132,255,0.15)' : 'rgba(255,255,255,0.04)',
                border: config.engine === eng ? '1px solid rgba(10,132,255,0.5)' : '1px solid rgba(255,255,255,0.06)',
                color: config.engine === eng ? '#0A84FF' : 'rgba(255,255,255,0.5)',
                boxShadow: config.engine === eng ? '0 0 12px rgba(10,132,255,0.2)' : 'none',
              }}
            >
              {eng === 'tiktok' ? '🎵 TikTok TTS' : '🌐 Google TTS'}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Voice selector */}
      <div className="space-y-2">
        <p className="section-label">Voice</p>
        <select
          value={config.voice}
          onChange={(e) => update('voice', e.target.value)}
          className="input-cosmic"
          style={{ fontSize: '12px' }}
        >
          {TIKTOK_VOICES.map(v => (
            <option key={v.id} value={v.id}>{v.label}</option>
          ))}
        </select>
      </div>

      {/* Sliders */}
      <div className="space-y-4">
        <Slider label="Volume" value={config.volume} min={0} max={100} unit="%" color="#30D158" onChange={(v) => update('volume', v)} />
        <Slider label="Speed" value={config.speed} min={0.5} max={2} step={0.1} color="#0A84FF" onChange={(v) => update('speed', v)} />
        <Slider label="Pitch" value={config.pitch} min={0.5} max={2} step={0.1} color="#FF9F0A" onChange={(v) => update('pitch', v)} />
      </div>

      {/* Read settings */}
      <div className="space-y-3">
        <p className="section-label">Read events aloud</p>
        {([
          ['readChat', '💬 Chat messages'],
          ['readGifts', '🎁 Gifts'],
          ['readFollows', '👥 Follows'],
        ] as const).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-xs text-white/60">{label}</span>
            <Toggle checked={config[key]} onChange={(v) => update(key, v)} />
          </div>
        ))}
      </div>

      {/* Test button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={testTTS}
        disabled={testing}
        className="btn-blue w-full flex items-center justify-center gap-2"
      >
        {testing ? (
          <div className="w-3.5 h-3.5 border-2 border-[#0A84FF]/30 border-t-[#0A84FF] rounded-full animate-spin" />
        ) : (
          <Play size={13} fill="#0A84FF" />
        )}
        {testing ? 'Playing…' : 'Test Voice'}
      </motion.button>
    </div>
  );
}
