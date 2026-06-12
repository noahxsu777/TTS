export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

export interface ChatMessage {
  id: string;
  userId: string;
  nickname: string;
  comment: string;
  isModerator: boolean;
  isSubscriber: boolean;
  teamMemberLevel: number;
  timestamp: number;
}

export interface GiftEvent {
  id: string;
  userId: string;
  nickname: string;
  giftId: number;
  giftName: string;
  giftIcon?: string;
  diamondCount: number;
  repeatCount: number;
  repeatEnd: boolean;
  timestamp: number;
}

export interface LiveEvent {
  id: string;
  type: 'chat' | 'gift' | 'follow' | 'share' | 'subscribe' | 'like';
  userId: string;
  nickname: string;
  timestamp: number;
  comment?: string;
  giftName?: string;
  giftIcon?: string;
  diamondCount?: number;
  repeatCount?: number;
  isModerator?: boolean;
  isSubscriber?: boolean;
}

export interface BattleTeam {
  id: number;
  score: number;
  totalScore: number;
  hostUser: { userId: string; nickname: string; avatar: string };
}

export interface BattleState {
  teams: [BattleTeam, BattleTeam];
  endTime: number;
  status: 'active' | 'finished';
}

export interface RoomStats {
  viewerCount: number;
  likeCount: number;
}

// ── Config types ──────────────────────────────────────────────────────────────

export interface VoiceConfig {
  engine: 'tiktok' | 'google';
  voice: string;
  pitch: number;
  speed: number;
  volume: number;
  readChat: boolean;
  readGifts: boolean;
  readFollows: boolean;
}

export interface TriggerConfig {
  muteAll: boolean;
  subscribersOnly: boolean;
  moderatorsOnly: boolean;
  minGiftDiamonds: number;
  whitelist: string[];
}

export interface TemplateConfig {
  follow: string;
  subscribe: string;
  gift: string;
  share: string;
  like: string;
  join: string;
}

export interface WordFilter {
  id: string;
  word: string;
  replacement: string;
}

export interface ModerationConfig {
  bannedWords: WordFilter[];
  silenceAll: boolean;
  silenceUntil: number | null;
}

export interface GiftSound {
  id: string;
  giftId: number;
  giftName: string;
  giftIcon: string;
  soundUrl: string;
  enabled: boolean;
  diamonds: number;
}

export interface GiftConfig {
  sounds: GiftSound[];
  globalEnabled: boolean;
  minDiamondsForAlert: number;
}

export interface AppConfig {
  voice: VoiceConfig;
  triggers: TriggerConfig;
  templates: TemplateConfig;
  moderation: ModerationConfig;
  gifts: GiftConfig;
}

// ── Profile / Monetization ────────────────────────────────────────────────────

export interface LeagueData {
  id: string;
  name: string;
  score: number;
  rank: number;
  diamonds: number;
  region: string;
  startTime: number;
  endTime: number;
}

export interface UserProfile {
  mock?: boolean;
  userId: string;
  uniqueId: string;
  nickname: string;
  avatar: string;
  signature: string;
  followerCount: number;
  followingCount: number;
  heartCount: number;
  videoCount: number;
  isLive: boolean;
  viewerCount?: number;
  league?: LeagueData;
}

export interface MonetizationResult {
  diamonds: number;
  usd: number;
  eur: number;
  mxn: number;
  cop: number;
  leagueTier: string;
  leagueTierColor: string;
}

// WebSocket message shape
export interface WSMessage {
  type: string;
  data?: Record<string, unknown>;
  username?: string;
  message?: string;
  ts?: number;
}
