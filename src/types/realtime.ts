import type { CurrencyUnit, DrawRecord, DrawStageStep, WheelItem } from './index';

export type AppMode = 'classic' | 'live';

export type RoomRole = 'host' | 'viewer';

export type RealtimeConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type DanmakuColor = 'white' | 'lucky' | 'danger' | 'gold';

export type DanmakuKind = 'user' | 'system-info' | 'system-min' | 'system-max';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

export interface RoomParticipantPresence {
  clientId: string;
  nickname: string;
  role: RoomRole;
  joinedAt: string;
}

export interface SyncedSpinCommand {
  spinId: string;
  mode: 'participant' | 'amount';
  items: WheelItem[];
  startRotation: number;
  targetRotation: number;
  targetIndex: number;
  durationMs: number;
  /** Host timestamp when spin started (used strictly relative to host's sentAt for late joiners) */
  startedAt: number;
  /** Elapsed milliseconds already passed when received (0 for live broadcast, >0 for late join snapshot) */
  initialElapsedMs?: number;
}

export interface RoomStateSnapshot {
  roomCode: string;
  hostName: string;
  sentAt: number;
  itemName: string;
  participants: string[];
  amounts: number[];
  currencyUnit: CurrencyUnit;
  stage: DrawStageStep;
  lockedWinner: { id: string; index: number } | null;
  latestRecord: DrawRecord | null;
  records: DrawRecord[];
  activeSpin: SyncedSpinCommand | null;
}

export interface DanmakuMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  color: DanmakuColor;
  kind: DanmakuKind;
  createdAt: number;
}
