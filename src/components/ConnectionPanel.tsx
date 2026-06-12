import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plug, PlugZap, X, AtSign, ChevronRight } from 'lucide-react';

interface ConnectionPanelProps {
  isConnected: boolean;
  connecting: boolean;
  username: string;
  onConnect: (username: string) => void;
  onDisconnect: () => void;
  statusMessage: string;
}

export default function ConnectionPanel({
  isConnected, connecting, username, onConnect, onDisconnect, statusMessage,
}: ConnectionPanelProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const u = input.trim().replace('@', '');
    if (u) onConnect(u);
  };

  return (
    <div className="glass-card p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-ios-sm flex items-center justify-center"
            style={{ background: 'rgba(10,132,255,0.12)', border: '1px solid rgba(10,132,255,0.25)' }}
          >
            <PlugZap size={14} className="text-[#0A84FF]" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">TikTok Live Connect</p>
            <p className="section-label">stream control</p>
          </div>
        </div>

        <AnimatePresence>
          {isConnected && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={onDisconnect}
              className="w-8 h-8 rounded-ios-sm flex items-center justify-center text-white/40 hover:text-[#FF453A] hover:bg-[#FF453A]/10 transition-colors"
            >
              <X size={14} />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Connection Form */}
      <AnimatePresence mode="wait">
        {!isConnected ? (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            onSubmit={handleSubmit}
            className="space-y-3"
          >
            <div className="relative">
              <AtSign size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/25" />
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="tiktok_username"
                className="input-cosmic pl-9"
                disabled={connecting}
                autoComplete="off"
                autoCapitalize="none"
              />
            </div>
            <button
              type="submit"
              disabled={connecting || !input.trim()}
              className="btn-solid-orange w-full flex items-center justify-center gap-2"
            >
              {connecting ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  <Plug size={14} />
                  Connect to Live Stream
                  <ChevronRight size={14} />
                </>
              )}
            </button>
          </motion.form>
        ) : (
          <motion.div
            key="connected"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {/* Connected card */}
            <div
              className="rounded-ios-sm p-3 flex items-center gap-3"
              style={{ background: 'rgba(48,209,88,0.06)', border: '1px solid rgba(48,209,88,0.2)' }}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#30D158]/30 to-[#00E5A0]/10 flex items-center justify-center">
                  <AtSign size={16} className="text-[#30D158]" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 live-dot w-2.5 h-2.5" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">@{username}</p>
                <p className="text-[11px] text-[#30D158] font-mono">● LIVE CONNECTED</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status message */}
      <AnimatePresence>
        {statusMessage && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[11px] text-white/30 font-mono leading-relaxed"
          >
            {statusMessage}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
