export type AmountTier = 'min' | 'max' | 'normal';

export type DrawStageStep =
  | 'ready-participant'
  | 'spinning-participant'
  | 'participant-locked'
  | 'spinning-amount'
  | 'result-revealed';

export type SyncStatus = 'local-only' | 'syncing' | 'synced' | 'error';

export interface DrawRecord {
  id: string;
  timestamp: string;
  itemName: string;
  winnerId: string;
  amount: number;
  currencyUnit?: string;
  tier: AmountTier;
  poolMin: number;
  poolMax: number;
  participantCount: number;
  amountCount: number;
  syncedToGitHub?: boolean;
}

export interface DrawSettings {
  currencyUnit: string;
  removeWinnerAfterDraw: boolean;
  removeAmountAfterDraw: boolean;
  soundEnabled: boolean;
  volume: number; // 0 to 1
  autoAdvanceToAmount: boolean;
}

export interface GitHubConfig {
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  token: string;
  autoSync: boolean;
}

export interface WheelItem {
  id: string;
  label: string;
  rawValue: string | number;
  badge?: 'min' | 'max';
}

