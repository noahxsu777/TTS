export const DIAMOND_TO_USD = 0.005;

// Stable reference exchange rates
export const EXCHANGE_RATES = {
  EUR: 0.92,
  MXN: 17.15,
  COP: 4050,
} as const;

export interface LeagueTier {
  name: string;
  color: string;
  gradient: string;
  minDiamonds: number;
  maxDiamonds: number;
  icon: string;
}

export const LEAGUE_TIERS: LeagueTier[] = [
  { name: 'No League', color: '#6B7280', gradient: 'from-gray-600 to-gray-700', minDiamonds: 0, maxDiamonds: 999, icon: '○' },
  { name: 'Bronze', color: '#CD7F32', gradient: 'from-amber-700 to-amber-600', minDiamonds: 1000, maxDiamonds: 9999, icon: '🥉' },
  { name: 'Silver', color: '#C0C0C0', gradient: 'from-gray-400 to-gray-300', minDiamonds: 10000, maxDiamonds: 49999, icon: '🥈' },
  { name: 'Gold', color: '#FFD60A', gradient: 'from-yellow-400 to-amber-400', minDiamonds: 50000, maxDiamonds: 199999, icon: '🥇' },
  { name: 'Diamond', color: '#0A84FF', gradient: 'from-blue-500 to-cyan-400', minDiamonds: 200000, maxDiamonds: 499999, icon: '💎' },
  { name: 'Elite', color: '#BF5AF2', gradient: 'from-purple-500 to-pink-500', minDiamonds: 500000, maxDiamonds: Infinity, icon: '👑' },
];

export function getLeagueTier(diamonds: number): LeagueTier {
  return LEAGUE_TIERS.slice().reverse().find(t => diamonds >= t.minDiamonds) ?? LEAGUE_TIERS[0];
}

export function diamondsToUSD(diamonds: number): number {
  return diamonds * DIAMOND_TO_USD;
}

export function calculateMonetization(diamonds: number) {
  const usd = diamondsToUSD(diamonds);
  const tier = getLeagueTier(diamonds);
  return {
    diamonds,
    usd,
    eur: usd * EXCHANGE_RATES.EUR,
    mxn: usd * EXCHANGE_RATES.MXN,
    cop: usd * EXCHANGE_RATES.COP,
    tier,
  };
}

export function formatCurrency(value: number, currency: string, decimals = 2): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }) + ' ' + currency;
}

export function formatDiamonds(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
}
