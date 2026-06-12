import React from 'react';
import { motion } from 'motion/react';
import { Gift, Bell, BellOff, Music } from 'lucide-react';
import type { GiftConfig } from '../../types';

const DEFAULT_GIFTS = [
  { id: '5655', giftId: 5655, giftName: 'Rose', giftIcon: '🌹', diamonds: 1 },
  { id: '5652', giftId: 5652, giftName: 'TikTok', giftIcon: '🎵', diamonds: 1 },
  { id: '6080', giftId: 6080, giftName: 'Ice Cream', giftIcon: '🍦', diamonds: 5 },
  { id: '6094', giftId: 6094, giftName: 'Sunglasses', giftIcon: '😎', diamonds: 49 },
  { id: '5488', giftId: 5488, giftName: 'GG Trophy', giftIcon: '🏆', diamonds: 99 },
  { id: '6118', giftId: 6118, giftName: 'Crown', giftIcon: '👑', diamonds: 299 },
  { id: '7356', giftId: 7356, giftName: 'Universe', giftIcon: '🌌', diamonds: 34999 },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      onClick={() => onChange(!checked)}
      className="toggle"
      style={{ background: checked ? '#FFD60A' : 'rgba(255,255,255,0.1)' }}
    >
      <motion.span layout className="toggle-thumb" style={{ marginLeft: checked ? '22px' : '2px' }} />
    </button>
  );
}

interface GiftsTabProps {
  config: GiftConfig;
  onChange: (c: GiftConfig) => void;
}

export default function GiftsTab({ config, onChange }: GiftsTabProps) {
  const getSoundForGift = (giftId: number) =>
    config.sounds.find(s => s.giftId === giftId);

  const updateSound = (giftId: number, soundUrl: string) => {
    const existing = config.sounds.find(s => s.giftId === giftId);
    const gift = DEFAULT_GIFTS.find(g => g.giftId === giftId)!;
    if (existing) {
      onChange({
        ...config,
        sounds: config.sounds.map(s => s.giftId === giftId ? { ...s, soundUrl } : s),
      });
    } else {
      onChange({
        ...config,
        sounds: [...config.sounds, {
          id: String(giftId),
          giftId,
          giftName: gift.giftName,
          giftIcon: gift.giftIcon,
          soundUrl,
          enabled: true,
          diamonds: gift.diamonds,
        }],
      });
    }
  };

  const toggleGift = (giftId: number, enabled: boolean) => {
    onChange({
      ...config,
      sounds: config.sounds.map(s => s.giftId === giftId ? { ...s, enabled } : s),
    });
  };

  return (
    <div className="space-y-4">
      {/* Global toggle */}
      <div
        className="flex items-center justify-between p-3 rounded-ios-sm"
        style={{ background: 'rgba(255,214,10,0.06)', border: '1px solid rgba(255,214,10,0.15)' }}
      >
        <div className="flex items-center gap-2">
          <Gift size={14} className="text-[#FFD60A]" />
          <div>
            <p className="text-xs font-medium text-white/80">Gift Sound Alerts</p>
            <p className="text-[10px] text-white/30">Play audio on gift events</p>
          </div>
        </div>
        <Toggle checked={config.globalEnabled} onChange={(v) => onChange({ ...config, globalEnabled: v })} />
      </div>

      {/* Min diamonds */}
      <div className="space-y-1.5">
        <p className="section-label">Min diamonds for alert</p>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#FFD60A]">💎</span>
          <input
            type="number"
            value={config.minDiamondsForAlert}
            min={0}
            onChange={(e) => onChange({ ...config, minDiamondsForAlert: parseInt(e.target.value) || 0 })}
            className="input-cosmic pl-9 text-sm"
          />
        </div>
      </div>

      {/* Gift list */}
      <div className="space-y-2">
        <p className="section-label flex items-center gap-1.5"><Music size={9} /> Gift Sound Map</p>
        <div className="space-y-2">
          {DEFAULT_GIFTS.map((gift) => {
            const sound = getSoundForGift(gift.giftId);
            return (
              <motion.div
                key={gift.giftId}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-1.5 p-2.5 rounded-ios-sm"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{gift.giftIcon}</span>
                    <div>
                      <p className="text-[11px] font-medium text-white/70">{gift.giftName}</p>
                      <p className="text-[9px] text-[#FFD60A]/60 font-mono">{gift.diamonds}💎</p>
                    </div>
                  </div>
                  {sound ? (
                    <button
                      onClick={() => toggleGift(gift.giftId, !sound.enabled)}
                      className="w-7 h-7 rounded-full flex items-center justify-center transition-colors"
                      style={{
                        background: sound.enabled ? 'rgba(255,214,10,0.12)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${sound.enabled ? 'rgba(255,214,10,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      }}
                    >
                      {sound.enabled
                        ? <Bell size={11} className="text-[#FFD60A]" />
                        : <BellOff size={11} className="text-white/20" />
                      }
                    </button>
                  ) : null}
                </div>
                <input
                  type="url"
                  value={sound?.soundUrl ?? ''}
                  onChange={(e) => updateSound(gift.giftId, e.target.value)}
                  placeholder="https://… .mp3 or leave empty"
                  className="input-cosmic text-[10px] py-2 font-mono"
                />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
