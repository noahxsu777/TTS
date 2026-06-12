import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic2, Filter, FileCode, Shield, Gift } from 'lucide-react';
import type { AppConfig } from '../types';
import VoicesTab from './tabs/VoicesTab';
import TriggersTab from './tabs/TriggersTab';
import TemplatesTab from './tabs/TemplatesTab';
import ModerationTab from './tabs/ModerationTab';
import GiftGallery from './GiftGallery';
import type { GiftSoundConfig } from '../types';

const TABS = [
  { id: 'voices',     label: 'Voices',     icon: Mic2,     color: '#0A84FF' },
  { id: 'triggers',   label: 'Triggers',   icon: Filter,   color: '#FF9F0A' },
  { id: 'templates',  label: 'Templates',  icon: FileCode, color: '#30D158' },
  { id: 'moderation', label: 'Moderation', icon: Shield,   color: '#FF453A' },
  { id: 'gifts',      label: 'Gifts',      icon: Gift,     color: '#FFD60A' },
] as const;

type TabId = typeof TABS[number]['id'];

interface ConfigPanelProps {
  config: AppConfig;
  onChange: (c: AppConfig) => void;
  giftSounds: Record<number, GiftSoundConfig>;
  onGiftSoundsChange: (s: Record<number, GiftSoundConfig>) => void;
}

export default function ConfigPanel({ config, onChange, giftSounds, onGiftSoundsChange }: ConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('voices');
  const active = TABS.find(t => t.id === activeTab)!;
  const isGifts = activeTab === 'gifts';

  return (
    <div
      className="glass-card flex flex-col"
      style={{ minHeight: isGifts ? 'auto' : '540px' }}
    >
      {/* Tab bar */}
      <div className="flex border-b border-white/[0.05]">
        {TABS.map(({ id, label, icon: Icon, color }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className="relative flex-1 flex flex-col items-center gap-1 py-3 px-1 transition-all min-w-[48px] min-h-[52px]"
              style={{ color: isActive ? color : 'rgba(255,255,255,0.25)' }}
            >
              <Icon size={15} />
              <span className="text-[9px] font-semibold tracking-wide uppercase hidden sm:block">
                {label}
              </span>
              {isActive && (
                <motion.div
                  layoutId="tab-bar"
                  className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full"
                  style={{ background: color, boxShadow: `0 0 8px ${color}90` }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab label row */}
      <div
        className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.03]"
        style={{ background: `${active.color}06` }}
      >
        <active.icon size={13} style={{ color: active.color }} />
        <span className="text-xs font-semibold text-white/80">{active.label}</span>
        <span
          className="ml-auto text-[9px] px-2 py-0.5 rounded-full font-mono"
          style={{ background: `${active.color}14`, border: `1px solid ${active.color}25`, color: active.color }}
        >
          CONFIG
        </span>
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto feed-scroll ${isGifts ? 'p-4' : 'p-4'}`}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {activeTab === 'voices' && (
              <VoicesTab config={config.voice} onChange={v => onChange({ ...config, voice: v })} />
            )}
            {activeTab === 'triggers' && (
              <TriggersTab config={config.triggers} onChange={t => onChange({ ...config, triggers: t })} />
            )}
            {activeTab === 'templates' && (
              <TemplatesTab config={config.templates} onChange={t => onChange({ ...config, templates: t })} />
            )}
            {activeTab === 'moderation' && (
              <ModerationTab config={config.moderation} onChange={m => onChange({ ...config, moderation: m })} />
            )}
            {activeTab === 'gifts' && (
              <GiftGallery sounds={giftSounds} onSoundChange={onGiftSoundsChange} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
