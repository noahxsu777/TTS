import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, Wifi, WifiOff, Loader2, Radio, Eye } from 'lucide-react';
import type { WSStatus } from '../hooks/useWebSocket';

interface HeaderProps {
  wsStatus: WSStatus;
  tiktokConnected: boolean;
  username: string;
  viewerCount: number;
}

const WS_LABEL: Record<WSStatus, string> = {
  idle: 'Standby', connecting: 'Connecting…', open: 'Ready', closed: 'Reconnecting…', error: 'Error',
};
const WS_COLOR: Record<WSStatus, string> = {
  idle: '#ffffff25', connecting: '#FFD60A', open: '#30D158', closed: '#FF9F0A', error: '#FF453A',
};

export default function Header({ wsStatus, tiktokConnected, username, viewerCount }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const wsColor = WS_COLOR[wsStatus];

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="sticky top-0 z-50 px-4 py-3"
      style={{
        background: 'linear-gradient(180deg, rgba(10,10,12,0.97) 0%, rgba(10,10,12,0.82) 100%)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        boxShadow: '0 4px 24px -4px rgba(0,0,0,0.6)',
      }}
    >
      <div className="max-w-[1640px] mx-auto flex items-center justify-between gap-3">
        {/* Logo */}
        <motion.div className="flex items-center gap-3" whileHover={{ scale: 1.01 }}>
          <div
            className="relative w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #FF9F0A 0%, #FF5A00 100%)',
              boxShadow: '0 0 24px rgba(255,159,10,0.5), inset 0 1px 0 rgba(255,255,255,0.25)',
            }}
          >
            <Zap size={20} className="text-black" fill="black" />
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-xl" style={{ boxShadow: '0 0 0 2px rgba(255,159,10,0.2)' }} />
          </div>
          <div>
            <h1 className="font-display font-extrabold text-base leading-none tracking-tight">
              TikLive <span className="text-gradient-orange">Command</span>
            </h1>
            <p className="text-[9px] font-mono tracking-[0.2em] text-white/25 mt-0.5">STREAMER CONTROL CENTER</p>
          </div>
        </motion.div>

        {/* Right status area */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {/* Live badge */}
          <AnimatePresence>
            {tiktokConnected && username && (
              <motion.div
                initial={{ opacity: 0, scale: 0.85, x: 8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{
                  background: 'rgba(48,209,88,0.08)',
                  border: '1px solid rgba(48,209,88,0.28)',
                  boxShadow: '0 0 16px rgba(48,209,88,0.1)',
                }}
              >
                <span className="live-dot" />
                <span className="text-[#30D158] text-xs font-bold font-mono tracking-widest">LIVE</span>
                <span className="text-white/55 text-xs font-mono">@{username}</span>
                {viewerCount > 0 && (
                  <div className="flex items-center gap-1 text-white/35 text-[10px] font-mono">
                    <Eye size={10} />
                    {viewerCount.toLocaleString()}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* WS status */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs"
            style={{ background: `${wsColor}10`, border: `1px solid ${wsColor}25`, color: wsColor }}
          >
            {wsStatus === 'connecting' || wsStatus === 'closed'
              ? <Loader2 size={11} className="animate-spin" />
              : wsStatus === 'open'
              ? <Wifi size={11} />
              : <WifiOff size={11} />
            }
            <span className="font-mono hidden sm:inline text-[10px]">{WS_LABEL[wsStatus]}</span>
          </div>

          {/* Broadcasting badge */}
          <AnimatePresence>
            {tiktokConnected && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="hidden md:flex items-center gap-1.5 text-xs text-[#FF9F0A]"
                style={{ animation: 'glowPulseOrange 3s ease-in-out infinite' }}
              >
                <Radio size={11} className="animate-pulse" />
                <span className="font-mono text-[10px]">ON AIR</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Clock */}
          <div className="font-mono text-[11px] text-white/20 tracking-widest hidden lg:block tabular-nums">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </div>
    </motion.header>
  );
}
