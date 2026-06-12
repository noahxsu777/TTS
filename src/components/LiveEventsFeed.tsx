import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Gift, Heart, UserPlus, Share2, Crown, Activity } from 'lucide-react';
import type { LiveEvent } from '../types';
import { truncate, formatTime } from '../utils/formatters';

interface LiveEventsFeedProps {
  events: LiveEvent[];
  isConnected: boolean;
}

const EVENT_CONFIG = {
  chat:      { icon: MessageCircle, color: '#ffffff',  bg: 'rgba(255,255,255,0.06)',  label: 'Chat' },
  gift:      { icon: Gift,          color: '#FFD60A',  bg: 'rgba(255,214,10,0.08)',   label: 'Gift' },
  like:      { icon: Heart,         color: '#FF453A',  bg: 'rgba(255,69,58,0.08)',    label: 'Like' },
  follow:    { icon: UserPlus,      color: '#30D158',  bg: 'rgba(48,209,88,0.08)',    label: 'Follow' },
  share:     { icon: Share2,        color: '#0A84FF',  bg: 'rgba(10,132,255,0.08)',   label: 'Share' },
  subscribe: { icon: Crown,         color: '#BF5AF2',  bg: 'rgba(191,90,242,0.08)',   label: 'Sub' },
};

function EventRow({ event }: { event: LiveEvent }) {
  const cfg = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.chat;
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -16, scale: 0.97 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 16, scale: 0.97 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="flex items-start gap-2.5 px-3 py-2 rounded-ios-sm hover:bg-white/[0.02] transition-colors group"
    >
      {/* Icon */}
      <div
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5"
        style={{ background: cfg.bg, border: `1px solid ${cfg.color}22` }}
      >
        <Icon size={11} style={{ color: cfg.color }} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span
            className="text-[11px] font-semibold truncate max-w-[120px]"
            style={{ color: event.isModerator ? '#FFD60A' : event.isSubscriber ? '#BF5AF2' : cfg.color }}
          >
            {event.nickname}
          </span>
          {event.isModerator && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-[#FFD60A]/10 text-[#FFD60A] font-mono">MOD</span>
          )}
          {event.isSubscriber && !event.isModerator && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-[#BF5AF2]/10 text-[#BF5AF2] font-mono">SUB</span>
          )}
        </div>
        <p className="text-[11px] text-white/50 leading-snug mt-0.5">
          {event.type === 'chat' && truncate(event.comment ?? '', 80)}
          {event.type === 'gift' && (
            <span>
              sent {event.giftIcon} <span style={{ color: '#FFD60A' }}>{event.giftName}</span>
              {(event.repeatCount ?? 1) > 1 && ` ×${event.repeatCount}`}
              <span className="text-[#FFD60A]/60 ml-1">({event.diamondCount ?? 0}💎)</span>
            </span>
          )}
          {event.type === 'follow' && <span className="text-[#30D158]">followed you!</span>}
          {event.type === 'share' && <span className="text-[#0A84FF]">shared the stream</span>}
          {event.type === 'like' && <span className="text-[#FF453A]">sent likes ❤️</span>}
          {event.type === 'subscribe' && <span className="text-[#BF5AF2]">subscribed! ✨</span>}
        </p>
      </div>

      {/* Timestamp */}
      <span className="flex-shrink-0 text-[9px] text-white/20 font-mono mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {formatTime(event.timestamp)}
      </span>
    </motion.div>
  );
}

export default function LiveEventsFeed({ events, isConnected }: LiveEventsFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [events.length]);

  return (
    <div className="glass-card flex flex-col" style={{ height: '360px' }}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-[#0A84FF]" />
          <span className="text-xs font-semibold text-white">Live Feed</span>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && <span className="live-dot w-1.5 h-1.5" />}
          <span className="text-[10px] text-white/25 font-mono">{events.length} events</span>
        </div>
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto feed-scroll px-1 pb-2">
        <AnimatePresence initial={false}>
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/20 gap-2">
              <Activity size={24} />
              <p className="text-xs font-mono">Connect to see live events</p>
            </div>
          ) : (
            events.map((ev) => <EventRow key={ev.id} event={ev} />)
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
