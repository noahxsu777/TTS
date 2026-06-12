import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, Timer, Trophy, Zap } from 'lucide-react';
import type { BattleState } from '../types';
import { formatDuration } from '../utils/formatters';

interface BattlePanelProps {
  battle: BattleState | null;
}

function ScoreBar({ score1, score2 }: { score1: number; score2: number }) {
  const total = score1 + score2;
  const p1 = total === 0 ? 50 : Math.max(5, Math.min(95, (score1 / total) * 100));
  const p2 = 100 - p1;

  return (
    <div className="relative h-7 rounded-full overflow-hidden flex" style={{ background: 'rgba(255,255,255,0.04)' }}>
      <motion.div
        className="h-full flex items-center justify-end pr-2 relative"
        animate={{ width: `${p1}%` }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
        style={{
          background: 'linear-gradient(90deg, #FF6B00 0%, #FF9F0A 100%)',
          boxShadow: '4px 0 16px rgba(255,159,10,0.6)',
        }}
      >
        <span className="text-[10px] font-mono font-bold text-black/70 whitespace-nowrap">
          {p1.toFixed(0)}%
        </span>
      </motion.div>
      <motion.div
        className="h-full flex items-center justify-start pl-2 relative"
        animate={{ width: `${p2}%` }}
        transition={{ duration: 0.6, ease: 'easeInOut' }}
        style={{
          background: 'linear-gradient(90deg, #0A84FF 0%, #00C7FF 100%)',
          boxShadow: '-4px 0 16px rgba(10,132,255,0.6)',
        }}
      >
        <span className="text-[10px] font-mono font-bold text-black/70 whitespace-nowrap">
          {p2.toFixed(0)}%
        </span>
      </motion.div>
      {/* Center divider */}
      <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-white/20 z-10" />
    </div>
  );
}

function Countdown({ endTime }: { endTime: number }) {
  const [remaining, setRemaining] = useState(endTime - Date.now());

  useEffect(() => {
    const t = setInterval(() => setRemaining(endTime - Date.now()), 1000);
    return () => clearInterval(t);
  }, [endTime]);

  const isUrgent = remaining < 60_000;

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-1 rounded-full"
      style={{
        background: isUrgent ? 'rgba(255,69,58,0.12)' : 'rgba(255,214,10,0.08)',
        border: `1px solid ${isUrgent ? 'rgba(255,69,58,0.3)' : 'rgba(255,214,10,0.2)'}`,
      }}
    >
      <Timer size={11} style={{ color: isUrgent ? '#FF453A' : '#FFD60A' }} />
      <span
        className="font-mono text-xs font-bold"
        style={{ color: isUrgent ? '#FF453A' : '#FFD60A' }}
      >
        {remaining > 0 ? formatDuration(remaining) : '0:00'}
      </span>
    </div>
  );
}

export default function BattlePanel({ battle }: BattlePanelProps) {
  const team1 = battle?.teams[0];
  const team2 = battle?.teams[1];

  return (
    <div className="glass-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-ios-sm flex items-center justify-center"
            style={{ background: 'rgba(255,159,10,0.12)', border: '1px solid rgba(255,159,10,0.25)' }}
          >
            <Swords size={14} className="text-[#FF9F0A]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Battle PVP</p>
            <p className="section-label">live combat</p>
          </div>
        </div>
        {battle && <Countdown endTime={battle.endTime} />}
      </div>

      <AnimatePresence mode="wait">
        {!battle ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center py-8 gap-3"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Swords size={32} className="text-white/20" />
            </motion.div>
            <p className="text-xs text-white/25 font-mono">No active battle</p>
            <p className="text-[10px] text-white/15">Waiting for PVP event…</p>
          </motion.div>
        ) : (
          <motion.div
            key="battle"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {/* Teams header */}
            <div className="flex items-center justify-between">
              {/* Team 1 */}
              <motion.div
                className="flex flex-col items-start gap-1"
                whileHover={{ scale: 1.02 }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,159,10,0.2), rgba(255,107,0,0.1))',
                    border: '2px solid rgba(255,159,10,0.4)',
                    boxShadow: '0 0 16px rgba(255,159,10,0.3)',
                  }}
                >
                  🔥
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-white truncate max-w-[80px]">
                    {team1?.hostUser.nickname ?? 'Team 1'}
                  </p>
                  <p className="stat-mono text-[#FF9F0A]">
                    {(team1?.score ?? 0).toLocaleString()} 💎
                  </p>
                </div>
              </motion.div>

              {/* VS */}
              <div className="flex flex-col items-center">
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="relative"
                >
                  <Zap size={20} className="text-[#FFD60A]" fill="#FFD60A" />
                  <div
                    className="absolute inset-0 blur-sm"
                    style={{ background: '#FFD60A', opacity: 0.3, borderRadius: '50%' }}
                  />
                </motion.div>
                <span className="text-[10px] font-mono text-white/25 mt-1">VS</span>
              </div>

              {/* Team 2 */}
              <motion.div
                className="flex flex-col items-end gap-1"
                whileHover={{ scale: 1.02 }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                  style={{
                    background: 'linear-gradient(135deg, rgba(10,132,255,0.2), rgba(0,199,255,0.1))',
                    border: '2px solid rgba(10,132,255,0.4)',
                    boxShadow: '0 0 16px rgba(10,132,255,0.3)',
                  }}
                >
                  ⚡
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold text-white truncate max-w-[80px]">
                    {team2?.hostUser.nickname ?? 'Team 2'}
                  </p>
                  <p className="stat-mono text-[#0A84FF]">
                    {(team2?.score ?? 0).toLocaleString()} 💎
                  </p>
                </div>
              </motion.div>
            </div>

            {/* Score bar */}
            <ScoreBar score1={team1?.score ?? 0} score2={team2?.score ?? 0} />

            {/* Winner indicator */}
            {battle.status === 'finished' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-center gap-2 py-2"
                style={{
                  background: 'rgba(255,214,10,0.08)',
                  border: '1px solid rgba(255,214,10,0.25)',
                  borderRadius: '10px',
                }}
              >
                <Trophy size={14} className="text-[#FFD60A]" />
                <span className="text-xs font-semibold text-[#FFD60A]">
                  {(team1?.score ?? 0) >= (team2?.score ?? 0)
                    ? team1?.hostUser.nickname
                    : team2?.hostUser.nickname} wins!
                </span>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
