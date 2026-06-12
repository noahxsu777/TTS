import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Users, Heart, Video, Loader2, TrendingUp, DollarSign,
  Globe, Trophy, Plus, BarChart2, AlertCircle, ExternalLink,
} from 'lucide-react';
import type { UserProfile } from '../types';
import {
  calculateMonetization, formatFollowers, formatDiamonds,
  formatCurrency, EXCHANGE_RATES,
} from '../utils/monetization';

const DIAMOND_SIMS = [5_000, 20_000, 100_000, 500_000];

function StatPill({ label, value, icon: Icon, color }: { label: string; value: string; icon: React.ElementType; color: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-ios-sm"
      style={{ background: `${color}0A`, border: `1px solid ${color}20` }}
    >
      <Icon size={13} style={{ color }} />
      <div>
        <p className="stat-mono text-white/80 text-xs">{value}</p>
        <p className="text-[9px] text-white/30">{label}</p>
      </div>
    </div>
  );
}

function CurrencyRow({ flag, currency, code, value, decimals = 2 }: { flag: string; currency: string; code: string; value: number; decimals?: number }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-base">{flag}</span>
        <div>
          <p className="text-xs text-white/70 font-medium">{currency}</p>
          <p className="text-[9px] text-white/25 font-mono">{code}</p>
        </div>
      </div>
      <span className="stat-mono text-sm" style={{
        background: 'linear-gradient(135deg, #FFD60A, #FF9F0A)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
      }}>
        {code === 'USD' ? '$' : code === 'EUR' ? '€' : ''}{value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
      </span>
    </div>
  );
}

export default function ProfileLookup() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState('');
  const [simDiamonds, setSimDiamonds] = useState(0);

  const totalDiamonds = (profile?.league?.diamonds ?? 0) + simDiamonds;
  const mono = calculateMonetization(totalDiamonds);

  const search = useCallback(async () => {
    const u = query.trim().replace('@', '');
    if (!u) return;
    setLoading(true);
    setError('');
    setProfile(null);
    setSimDiamonds(0);
    try {
      const res = await fetch(`/api/user_profile?username=${encodeURIComponent(u)}`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: UserProfile = await res.json();
      setProfile(data);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch profile');
    }
    setLoading(false);
  }, [query]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') search();
  };

  const addSimDiamonds = (n: number) => setSimDiamonds(p => p + n);
  const resetSim = () => setSimDiamonds(0);

  return (
    <div className="glass-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-ios-sm flex items-center justify-center"
          style={{ background: 'rgba(255,214,10,0.12)', border: '1px solid rgba(255,214,10,0.25)' }}
        >
          <Search size={16} className="text-[#FFD60A]" />
        </div>
        <div>
          <h3 className="font-display font-bold text-sm text-white">Profile Analyzer</h3>
          <p className="section-label">monetization lookup & league tracker</p>
        </div>
      </div>

      {/* Search input */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#FFD60A] text-base">@</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            placeholder="tiktok_username"
            className="input-cosmic pl-8"
            autoComplete="off"
            autoCapitalize="none"
          />
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={search}
          disabled={loading || !query.trim()}
          className="btn-solid-orange px-5 flex items-center gap-2 flex-shrink-0"
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          {loading ? 'Searching…' : 'Search'}
        </motion.button>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 p-3 rounded-ios-sm text-xs text-[#FF453A]"
            style={{ background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.2)' }}
          >
            <AlertCircle size={14} />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {profile && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* Profile card */}
            <div
              className="flex items-start gap-4 p-4 rounded-ios"
              style={{
                background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              {/* Avatar */}
              <div className="relative flex-shrink-0">
                <div
                  className="w-16 h-16 rounded-full overflow-hidden"
                  style={{ border: '2px solid rgba(255,214,10,0.3)', boxShadow: '0 0 20px rgba(255,214,10,0.2)' }}
                >
                  {profile.avatar ? (
                    <img src={profile.avatar} alt={profile.nickname} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-[#FF9F0A]/20 to-[#0A84FF]/20 flex items-center justify-center text-2xl">
                      {profile.nickname?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                </div>
                {profile.isLive && (
                  <div
                    className="absolute -bottom-1 -right-1 flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                    style={{ background: '#30D158', boxShadow: '0 0 10px rgba(48,209,88,0.6)' }}
                  >
                    <span className="live-dot w-1.5 h-1.5 bg-white" />
                    <span className="text-[8px] font-bold text-black">LIVE</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="font-display font-bold text-white text-sm">{profile.nickname}</h4>
                    <p className="text-xs text-[#FFD60A]/70 font-mono">@{profile.uniqueId}</p>
                  </div>
                  {profile.isLive && profile.viewerCount && (
                    <div
                      className="px-2 py-1 rounded-full text-[10px] font-mono flex items-center gap-1 flex-shrink-0"
                      style={{ background: 'rgba(48,209,88,0.1)', border: '1px solid rgba(48,209,88,0.25)', color: '#30D158' }}
                    >
                      <span className="live-dot w-1.5 h-1.5" />
                      {profile.viewerCount.toLocaleString()} watching
                    </div>
                  )}
                </div>
                {profile.signature && (
                  <p className="text-[11px] text-white/40 mt-1.5 leading-relaxed line-clamp-2">{profile.signature}</p>
                )}

                {/* Stats row */}
                <div className="flex gap-2 mt-3 flex-wrap">
                  <StatPill label="Followers" value={formatFollowers(profile.followerCount)} icon={Users} color="#0A84FF" />
                  <StatPill label="Following" value={formatFollowers(profile.followingCount)} icon={Users} color="#30D158" />
                  <StatPill label="Likes" value={formatFollowers(profile.heartCount)} icon={Heart} color="#FF453A" />
                  <StatPill label="Videos" value={profile.videoCount.toString()} icon={Video} color="#BF5AF2" />
                </div>
              </div>
            </div>

            {/* League info */}
            {profile.league && (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="p-4 rounded-ios space-y-3"
                style={{
                  background: `linear-gradient(135deg, ${mono.tier.gradient.replace('from-', '').split(' ')[0].replace('from-', '')}14 0%, rgba(255,255,255,0.02) 100%)`,
                  border: `1px solid ${mono.tier.color}25`,
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy size={16} style={{ color: mono.tier.color }} />
                    <div>
                      <p className="text-xs font-bold" style={{ color: mono.tier.color }}>
                        {mono.tier.icon} {profile.league.name}
                      </p>
                      <p className="text-[10px] text-white/30 font-mono">{profile.league.region} Region</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="stat-mono text-sm text-white">#{profile.league.rank}</p>
                    <p className="text-[9px] text-white/30 font-mono">ranking</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/50">League score</span>
                  <span className="stat-mono text-white">{profile.league.score.toLocaleString()} pts</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/50">Diamonds earned (week)</span>
                  <span className="stat-mono text-[#FFD60A]">
                    {profile.league.diamonds > 0 ? `${formatDiamonds(profile.league.diamonds)} 💎` : 'No data'}
                  </span>
                </div>
              </motion.div>
            )}

            {/* Monetization calculator */}
            <div
              className="p-4 rounded-ios space-y-4"
              style={{ background: 'rgba(255,214,10,0.04)', border: '1px solid rgba(255,214,10,0.12)' }}
            >
              <div className="flex items-center gap-2">
                <DollarSign size={15} className="text-[#FFD60A]" />
                <h4 className="text-sm font-bold text-white">Earnings Calculator</h4>
                <span className="ml-auto text-[9px] px-2 py-0.5 rounded font-mono text-[#FFD60A] bg-[#FFD60A]/08 border border-[#FFD60A]/20">
                  $0.005/💎
                </span>
              </div>

              {/* Diamond display */}
              <div
                className="flex items-center justify-between p-3 rounded-ios-sm"
                style={{ background: 'rgba(255,255,255,0.03)' }}
              >
                <div>
                  <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">Total Diamonds</p>
                  <p className="text-2xl font-display font-bold text-gradient-gold mt-0.5">
                    {formatDiamonds(totalDiamonds)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-white/30 font-mono uppercase tracking-widest">League Tier</p>
                  <p className="text-sm font-bold mt-0.5" style={{ color: mono.tier.color }}>
                    {mono.tier.icon} {mono.tier.name}
                  </p>
                </div>
              </div>

              {/* Simulator buttons */}
              {(profile.league?.diamonds === 0 || !profile.league) && (
                <div>
                  <p className="section-label mb-2">Simulate diamond earnings</p>
                  <div className="grid grid-cols-4 gap-2">
                    {DIAMOND_SIMS.map(n => (
                      <motion.button
                        key={n}
                        whileTap={{ scale: 0.93 }}
                        onClick={() => addSimDiamonds(n)}
                        className="py-2 rounded-ios-sm text-[10px] font-mono font-bold transition-all"
                        style={{
                          background: 'rgba(255,214,10,0.08)',
                          border: '1px solid rgba(255,214,10,0.2)',
                          color: '#FFD60A',
                        }}
                      >
                        +{formatDiamonds(n)}
                      </motion.button>
                    ))}
                  </div>
                  {simDiamonds > 0 && (
                    <motion.button
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={resetSim}
                      className="text-[10px] text-white/20 hover:text-white/50 mt-2 font-mono transition-colors"
                    >
                      ↺ Reset simulation
                    </motion.button>
                  )}
                </div>
              )}

              {/* Currency breakdown */}
              {totalDiamonds > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-1"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Globe size={13} className="text-white/30" />
                    <p className="section-label">Currency Breakdown</p>
                  </div>
                  <CurrencyRow flag="🇺🇸" currency="US Dollar" code="USD" value={mono.usd} />
                  <CurrencyRow flag="🇪🇺" currency="Euro" code="EUR" value={mono.eur} />
                  <CurrencyRow flag="🇲🇽" currency="Peso Mexicano" code="MXN" value={mono.mxn} decimals={0} />
                  <CurrencyRow flag="🇨🇴" currency="Peso Colombiano" code="COP" value={mono.cop} decimals={0} />

                  {/* Exchange rate note */}
                  <p className="text-[9px] text-white/15 font-mono pt-2 text-center">
                    Rates: 1 USD = {EXCHANGE_RATES.EUR} EUR · {EXCHANGE_RATES.MXN} MXN · {EXCHANGE_RATES.COP.toLocaleString()} COP
                  </p>
                </motion.div>
              )}
            </div>

            {/* Projection chart */}
            {totalDiamonds > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="p-4 rounded-ios space-y-3"
                style={{ background: 'rgba(10,132,255,0.04)', border: '1px solid rgba(10,132,255,0.1)' }}
              >
                <div className="flex items-center gap-2">
                  <BarChart2 size={14} className="text-[#0A84FF]" />
                  <p className="text-xs font-semibold text-white">Weekly Projection</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Daily avg', value: mono.usd / 7, suffix: 'USD/day' },
                    { label: 'Monthly', value: mono.usd * 4.33, suffix: 'USD/mo' },
                  ].map(({ label, value, suffix }) => (
                    <div key={label} className="p-2.5 rounded-ios-sm" style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <p className="text-[9px] text-white/30 font-mono">{label}</p>
                      <p className="text-sm font-display font-bold text-gradient-blue mt-0.5">
                        ${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                      <p className="text-[9px] text-white/20 font-mono">{suffix}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Mock data notice */}
            {profile.mock && (
              <p className="text-[10px] text-white/20 font-mono text-center">
                ⚠️ Demo data — set TIKTOOLS_API_KEY for real profile data
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
