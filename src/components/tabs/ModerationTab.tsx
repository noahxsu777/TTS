import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Plus, X, VolumeX, Volume2, Clock } from 'lucide-react';
import type { ModerationConfig } from '../../types';
import { uid } from '../../utils/formatters';

function Toggle({ checked, onChange, color = '#FF453A' }: { checked: boolean; onChange: (v: boolean) => void; color?: string }) {
  return (
    <button
      type="button"
      role="switch"
      onClick={() => onChange(!checked)}
      className="toggle flex-shrink-0"
      style={{ background: checked ? color : 'rgba(255,255,255,0.1)' }}
    >
      <motion.span layout className="toggle-thumb" style={{ marginLeft: checked ? '22px' : '2px' }} />
    </button>
  );
}

interface ModerationTabProps {
  config: ModerationConfig;
  onChange: (c: ModerationConfig) => void;
}

export default function ModerationTab({ config, onChange }: ModerationTabProps) {
  const [wordInput, setWordInput] = useState('');
  const [replInput, setReplInput] = useState('');
  const [silenceMinutes, setSilenceMinutes] = useState(5);

  const update = <K extends keyof ModerationConfig>(key: K, val: ModerationConfig[K]) =>
    onChange({ ...config, [key]: val });

  const addWord = () => {
    const w = wordInput.trim();
    if (!w) return;
    const r = replInput.trim() || '***';
    if (config.bannedWords.some(b => b.word.toLowerCase() === w.toLowerCase())) return;
    update('bannedWords', [...config.bannedWords, { id: uid(), word: w, replacement: r }]);
    setWordInput('');
    setReplInput('');
  };

  const removeWord = (id: string) =>
    update('bannedWords', config.bannedWords.filter(w => w.id !== id));

  const setSilence = () => {
    update('silenceUntil', Date.now() + silenceMinutes * 60 * 1000);
    update('silenceAll', true);
  };

  const clearSilence = () => {
    update('silenceAll', false);
    update('silenceUntil', null);
  };

  const remainingMs = config.silenceUntil ? config.silenceUntil - Date.now() : 0;
  const remainingMin = Math.max(0, Math.ceil(remainingMs / 60000));

  return (
    <div className="space-y-5">
      {/* Global mute */}
      <div
        className="flex items-center justify-between p-3 rounded-ios-sm"
        style={{ background: 'rgba(255,69,58,0.06)', border: '1px solid rgba(255,69,58,0.15)' }}
      >
        <div className="flex items-center gap-2.5">
          <VolumeX size={14} className="text-[#FF453A]" />
          <div>
            <p className="text-xs font-medium text-white/80">Silence All TTS</p>
            <p className="text-[10px] text-white/30">Temporarily mute all speech</p>
          </div>
        </div>
        <Toggle checked={config.silenceAll} onChange={(v) => { update('silenceAll', v); if (!v) update('silenceUntil', null); }} />
      </div>

      {/* Timed silence */}
      <div className="space-y-2">
        <p className="section-label flex items-center gap-1.5"><Clock size={9} /> Timed Silence</p>
        {config.silenceUntil && remainingMs > 0 ? (
          <div
            className="flex items-center justify-between p-3 rounded-ios-sm"
            style={{ background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.2)' }}
          >
            <span className="text-xs text-[#FF9F0A] font-mono">
              🤫 Silenced — {remainingMin}min remaining
            </span>
            <button onClick={clearSilence} className="btn-green px-3 py-1.5 text-[11px] flex items-center gap-1">
              <Volume2 size={11} /> Unmute
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="number"
              value={silenceMinutes}
              onChange={(e) => setSilenceMinutes(Math.max(1, parseInt(e.target.value) || 1))}
              className="input-cosmic w-20 text-center text-sm"
              min={1}
              max={120}
            />
            <span className="flex items-center text-xs text-white/30">min</span>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={setSilence}
              className="btn-neon flex-1 text-xs flex items-center justify-center gap-1.5"
              style={{ background: 'rgba(255,69,58,0.1)', border: '1px solid rgba(255,69,58,0.3)', color: '#FF453A' }}
            >
              <VolumeX size={12} /> Silence {silenceMinutes}min
            </motion.button>
          </div>
        )}
      </div>

      {/* Banned words */}
      <div className="space-y-2">
        <p className="section-label flex items-center gap-1.5"><Shield size={9} /> Word Filter</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={wordInput}
            onChange={(e) => setWordInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addWord()}
            placeholder="banned word"
            className="input-cosmic text-xs"
          />
          <input
            type="text"
            value={replInput}
            onChange={(e) => setReplInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addWord()}
            placeholder="replace with (***)"
            className="input-cosmic text-xs"
          />
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={addWord}
          className="btn-neon w-full text-xs flex items-center justify-center gap-1.5 text-[#FF453A]"
          style={{ background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.25)' }}
        >
          <Plus size={12} /> Add Filter
        </motion.button>

        <div className="space-y-1.5 max-h-40 overflow-y-auto feed-scroll">
          <AnimatePresence>
            {config.bannedWords.map(({ id, word, replacement }) => (
              <motion.div
                key={id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] text-[#FF453A] truncate">{word}</span>
                  <span className="text-white/20 text-xs">→</span>
                  <span className="font-mono text-[11px] text-white/40 truncate">{replacement}</span>
                </div>
                <button onClick={() => removeWord(id)} className="text-white/20 hover:text-[#FF453A] transition-colors flex-shrink-0">
                  <X size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
          {config.bannedWords.length === 0 && (
            <p className="text-[10px] text-white/20 text-center py-2 font-mono">No filters configured</p>
          )}
        </div>
      </div>
    </div>
  );
}
