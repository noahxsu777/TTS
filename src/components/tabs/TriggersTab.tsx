import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Plus, X, Filter, VolumeX, Crown, Users, Gift } from 'lucide-react';
import type { TriggerConfig } from '../../types';

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="toggle flex-shrink-0"
      style={{ background: checked ? '#FF9F0A' : 'rgba(255,255,255,0.1)' }}
    >
      <motion.span layout className="toggle-thumb" style={{ marginLeft: checked ? '22px' : '2px' }} />
    </button>
  );
}

interface TriggersTabProps {
  config: TriggerConfig;
  onChange: (c: TriggerConfig) => void;
}

export default function TriggersTab({ config, onChange }: TriggersTabProps) {
  const [whitelistInput, setWhitelistInput] = useState('');

  const update = <K extends keyof TriggerConfig>(key: K, val: TriggerConfig[K]) =>
    onChange({ ...config, [key]: val });

  const addToWhitelist = () => {
    const user = whitelistInput.trim().replace('@', '');
    if (user && !config.whitelist.includes(user)) {
      update('whitelist', [...config.whitelist, user]);
      setWhitelistInput('');
    }
  };

  const removeFromWhitelist = (user: string) =>
    update('whitelist', config.whitelist.filter(u => u !== user));

  const TOGGLES = [
    { key: 'muteAll' as const, label: 'Mute all TTS', sub: 'Silence all voice reading', icon: VolumeX, color: '#FF453A' },
    { key: 'subscribersOnly' as const, label: 'Subscribers only', sub: 'Only read subscriber chat', icon: Crown, color: '#BF5AF2' },
    { key: 'moderatorsOnly' as const, label: 'Moderators only', sub: 'Only read moderator chat', icon: Users, color: '#FFD60A' },
  ];

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="section-label flex items-center gap-1.5"><Filter size={9} /> Access Control</p>
        {TOGGLES.map(({ key, label, sub, icon: Icon, color }) => (
          <div
            key={key}
            className="flex items-center justify-between p-3 rounded-ios-sm"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: `${color}14` }}
              >
                <Icon size={13} style={{ color }} />
              </div>
              <div>
                <p className="text-xs font-medium text-white/80">{label}</p>
                <p className="text-[10px] text-white/30">{sub}</p>
              </div>
            </div>
            <Toggle checked={config[key]} onChange={(v) => update(key, v)} />
          </div>
        ))}
      </div>

      {/* Min gift value */}
      <div className="space-y-2">
        <p className="section-label flex items-center gap-1.5"><Gift size={9} /> Min gift diamonds for TTS</p>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FFD60A] text-sm">💎</span>
          <input
            type="number"
            value={config.minGiftDiamonds}
            min={0}
            max={999999}
            onChange={(e) => update('minGiftDiamonds', parseInt(e.target.value) || 0)}
            className="input-cosmic pl-9"
            placeholder="0 = all gifts"
          />
        </div>
        <p className="text-[10px] text-white/25">Gifts below this value won't trigger TTS</p>
      </div>

      {/* Whitelist */}
      <div className="space-y-2">
        <p className="section-label">Whitelist users (always allowed)</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={whitelistInput}
            onChange={(e) => setWhitelistInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addToWhitelist()}
            placeholder="@username"
            className="input-cosmic flex-1 text-xs"
          />
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={addToWhitelist}
            className="btn-green px-3 flex items-center gap-1"
          >
            <Plus size={13} />
          </motion.button>
        </div>
        {config.whitelist.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {config.whitelist.map(user => (
              <motion.span
                key={user}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs"
                style={{ background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.25)', color: '#30D158' }}
              >
                @{user}
                <button onClick={() => removeFromWhitelist(user)} className="hover:text-white transition-colors">
                  <X size={10} />
                </button>
              </motion.span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
