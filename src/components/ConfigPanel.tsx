import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic2, Filter, FileCode, Shield, Gift } from 'lucide-react';
import type { AppConfig } from '../types';
import VoicesTab from './tabs/VoicesTab';
import TriggersTab from './tabs/TriggersTab';
import TemplatesTab from './tabs/TemplatesTab';
import ModerationTab from './tabs/ModerationTab';
import GiftsTab from './tabs/GiftsTab';

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
}

export default function ConfigPanel({ config, onChange }: ConfigPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('voices');
  const active = TABS.find(t => t.id === activeTab)!;

  return (
    <div className="glass-card flex flex-col" style={{ minHeight: '540px' }}>
      {/* Tab bar */}
      <div className="flex border-b border-white/[0.05] overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="relative flex-1 flex flex-col items-center gap-1 py-3 px-2 transition-colors min-w-[56px]"
            style={{
              color: activeTab === id ? color : 'rgba(255,255,255,0.3)',
            }}
          >
            <Icon size={14} />
            <span className="text-[9px] font-semibold tracking-wide uppercase whitespace-nowrap hidden sm:block">
              {label}
            </span>
            {activeTab === id && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full"
                style={{ background: color, boxShadow: `0 0 8px ${color}80` }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Tab header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.03]">
        <active.icon size={14} style={{ color: active.color }} />
        <span className="text-xs font-semibold text-white">{active.label}</span>
        <span
          className="ml-auto text-[9px] px-2 py-0.5 rounded-full font-mono"
          style={{
            background: `${active.color}14`,
            border: `1px solid ${active.color}25`,
            color: active.color,
          }}
        >
          CONFIG
        </span>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto feed-scroll p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'voices' && (
              <VoicesTab config={config.voice} onChange={(v) => onChange({ ...config, voice: v })} />
            )}
            {activeTab === 'triggers' && (
              <TriggersTab config={config.triggers} onChange={(t) => onChange({ ...config, triggers: t })} />
            )}
            {activeTab === 'templates' && (
              <TemplatesTab config={config.templates} onChange={(t) => onChange({ ...config, templates: t })} />
            )}
            {activeTab === 'moderation' && (
              <ModerationTab config={config.moderation} onChange={(m) => onChange({ ...config, moderation: m })} />
            )}
            {activeTab === 'gifts' && (
              <GiftsTab config={config.gifts} onChange={(g) => onChange({ ...config, gifts: g })} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
