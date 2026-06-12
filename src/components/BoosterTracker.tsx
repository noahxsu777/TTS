import React from 'react';
import { motion } from 'motion/react';
import { TrendingUp, Box, Star, Rocket } from 'lucide-react';

interface Booster {
  id: string;
  type: 'chest' | 'rank' | 'universe' | 'topic';
  name: string;
  current: number;
  target: number;
  color: string;
  icon: React.ReactNode;
  unit: string;
}

const MOCK_BOOSTERS: Booster[] = [
  {
    id: 'chest',
    type: 'chest',
    name: 'Treasure Chest',
    current: 2340,
    target: 5000,
    color: '#FFD60A',
    icon: <Box size={12} />,
    unit: '💎',
  },
  {
    id: 'rank',
    type: 'rank',
    name: 'Weekly Rank',
    current: 98750,
    target: 200000,
    color: '#0A84FF',
    icon: <TrendingUp size={12} />,
    unit: 'pts',
  },
  {
    id: 'universe',
    type: 'universe',
    name: 'Universe Challenge',
    current: 47,
    target: 100,
    color: '#BF5AF2',
    icon: <Star size={12} />,
    unit: '⭐',
  },
  {
    id: 'topic',
    type: 'topic',
    name: 'Topic Boost',
    current: 890,
    target: 1000,
    color: '#30D158',
    icon: <Rocket size={12} />,
    unit: 'pts',
  },
];

function BoosterBar({ booster }: { booster: Booster }) {
  const pct = Math.min(100, (booster.current / booster.target) * 100);
  const isComplete = pct >= 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5" style={{ color: booster.color }}>
          {booster.icon}
          <span className="text-[11px] font-medium text-white/70">{booster.name}</span>
        </div>
        <span className="stat-mono text-white/40">
          {booster.current.toLocaleString()} / {booster.target.toLocaleString()} {booster.unit}
        </span>
      </div>

      <div className="relative h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          className="absolute left-0 top-0 h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'easeOut', delay: 0.2 }}
          style={{
            background: isComplete
              ? `linear-gradient(90deg, ${booster.color}, white)`
              : `linear-gradient(90deg, ${booster.color}88, ${booster.color})`,
            boxShadow: `0 0 8px ${booster.color}60`,
          }}
        />
        {isComplete && (
          <motion.div
            className="absolute inset-0"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
            style={{ background: `linear-gradient(90deg, transparent, ${booster.color}30, transparent)` }}
          />
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-[9px] text-white/20 font-mono">
          {isComplete ? '✓ COMPLETE' : `${pct.toFixed(0)}% complete`}
        </span>
        {!isComplete && (
          <span className="text-[9px] text-white/20 font-mono">
            {(booster.target - booster.current).toLocaleString()} to go
          </span>
        )}
      </div>
    </div>
  );
}

export default function BoosterTracker() {
  return (
    <div className="glass-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div
          className="w-8 h-8 rounded-ios-sm flex items-center justify-center"
          style={{ background: 'rgba(255,214,10,0.12)', border: '1px solid rgba(255,214,10,0.25)' }}
        >
          <Rocket size={14} className="text-[#FFD60A]" />
        </div>
        <div>
          <p className="text-xs font-semibold text-white">Active Boosters</p>
          <p className="section-label">challenges & missions</p>
        </div>
      </div>

      <div className="space-y-4">
        {MOCK_BOOSTERS.map((b, i) => (
          <motion.div
            key={b.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <BoosterBar booster={b} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
