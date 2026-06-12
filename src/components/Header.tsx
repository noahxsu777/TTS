import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Radio, Wifi, WifiOff, Loader2, Zap } from 'lucide-react';
import type { WSStatus } from '../hooks/useWebSocket';

interface HeaderProps {
  wsStatus: WSStatus;
  tiktokConnected: boolean;
  username: string;
  viewerCount: number;
}

export default function Header({ wsStatus, tiktokConnected, username, viewerCount }: HeaderProps) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const wsLabel = { idle: 'Standby', connecting: 'Connecting…', open: 'Ready', closed: 'Reconnecting', error: 'Error' }[wsStatus];
  const wsColor = { idle: 'text-white/30', connecting: 'text-[#FFD60A]', open: 'text-[#30D158]', closed: 'text-[#FF9F0A]', error: 'text-[#FF453A]' }[wsStatus];

  return (
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="sticky top-0 z-50 px-4 py-3"
      style={{
        background: 'linear-gradient(180deg, rgba(12,12,14,0.98) 0%, rgba(12,12,14,0.85) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="relative w-9 h-9 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #FF9F0A 0%, #FF6B00 100%)',
              boxShadow: '0 0 20px rgba(255,159,10,0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
            }}
          >
            <Zap size={18} className="text-black" fill="black" />
          </motion.div>
          <div>
            <h1 className="font-display font-bold text-sm tracking-tight leading-none">
              TikLive <span className="text-gradient-orange">Command</span>
            </h1>
            <p className="text-[10px] text-white/30 font-mono tracking-widest mt-0.5">STREAMER CONTROL CENTER</p>
          </div>
        </div>

        {/* Status row */}
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* TikTok Live status */}
          {tiktokConnected && username && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: 'rgba(48,209,88,0.08)',
                border: '1px solid rgba(48,209,88,0.25)',
              }}
            >
              <span className="live-dot" />
              <span className="text-[#30D158] text-xs font-semibold font-mono tracking-wide">LIVE</span>
              <span className="text-white/60 text-xs font-mono">@{username}</span>
              {viewerCount > 0 && (
                <span className="text-white/40 text-[10px] font-mono">
                  · {viewerCount.toLocaleString()} viewers
                </span>
              )}
            </motion.div>
          )}

          {/* WebSocket status */}
          <div className={`flex items-center gap-1.5 text-xs ${wsColor}`}>
            {wsStatus === 'connecting' || wsStatus === 'closed'
              ? <Loader2 size={12} className="animate-spin" />
              : wsStatus === 'open'
              ? <Wifi size={12} />
              : <WifiOff size={12} />
            }
            <span className="font-mono hidden sm:inline">{wsLabel}</span>
          </div>

          {/* Live session indicator */}
          {tiktokConnected && (
            <div className="flex items-center gap-1.5 text-xs text-[#FF9F0A]">
              <Radio size={12} className="animate-pulse" />
              <span className="font-mono hidden md:inline">Broadcasting</span>
            </div>
          )}

          {/* Clock */}
          <div className="font-mono text-xs text-white/25 tracking-widest hidden md:block">
            {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
        </div>
      </div>
    </motion.header>
  );
}
