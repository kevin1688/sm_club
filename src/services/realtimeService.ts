import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import type {
  DanmakuMessage,
  RealtimeConnectionState,
  RoomParticipantPresence,
  RoomRole,
  RoomStateSnapshot,
  SupabaseConfig,
  SyncedSpinCommand,
} from '../types/realtime';
import type { DrawRecord } from '../types';

const SUPABASE_OVERRIDE_KEY = 'lpr_supabase_override_v1';

export function getBuiltInSupabaseConfig(): SupabaseConfig {
  return {
    url: (import.meta.env.VITE_SUPABASE_URL || '').trim(),
    anonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim(),
  };
}

export function getSavedSupabaseOverride(): SupabaseConfig {
  try {
    const raw = localStorage.getItem(SUPABASE_OVERRIDE_KEY);
    if (!raw) return { url: '', anonKey: '' };
    const parsed = JSON.parse(raw) as Partial<SupabaseConfig>;
    return {
      url: (parsed.url || '').trim(),
      anonKey: (parsed.anonKey || '').trim(),
    };
  } catch {
    return { url: '', anonKey: '' };
  }
}

export function saveSupabaseOverride(config: SupabaseConfig): void {
  const cleaned = { url: config.url.trim(), anonKey: config.anonKey.trim() };
  if (!cleaned.url && !cleaned.anonKey) {
    localStorage.removeItem(SUPABASE_OVERRIDE_KEY);
    return;
  }
  localStorage.setItem(SUPABASE_OVERRIDE_KEY, JSON.stringify(cleaned));
}

export function resolveSupabaseConfig(): {
  config: SupabaseConfig;
  source: 'env' | 'local' | 'none';
} {
  const local = getSavedSupabaseOverride();
  if (local.url && local.anonKey) {
    return { config: local, source: 'local' };
  }
  const env = getBuiltInSupabaseConfig();
  if (env.url && env.anonKey) {
    return { config: env, source: 'env' };
  }
  return { config: { url: '', anonKey: '' }, source: 'none' };
}

export interface RealtimeRoomCallbacks {
  onConnectionChange: (state: RealtimeConnectionState, errorMessage?: string) => void;
  onPresenceUpdate: (members: RoomParticipantPresence[]) => void;
  onStateSnapshot: (snapshot: RoomStateSnapshot) => void;
  onSpinStart: (command: SyncedSpinCommand) => void;
  onSpinResult: (record: DrawRecord) => void;
  onStageReset: () => void;
  onDanmaku: (message: DanmakuMessage) => void;
  onSyncRequested: () => void;
}

class SupabaseRealtimeRoomService {
  private client: SupabaseClient | null = null;
  private clientKey = '';
  private channel: RealtimeChannel | null = null;
  private currentRoomCode = '';
  private clientId = `cli_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  public getClientId(): string {
    return this.clientId;
  }

  public getRoomCode(): string {
    return this.currentRoomCode;
  }

  public async connect(
    config: SupabaseConfig,
    roomCode: string,
    nickname: string,
    role: RoomRole,
    callbacks: RealtimeRoomCallbacks
  ): Promise<void> {
    await this.disconnect();

    if (!config.url || !config.anonKey) {
      callbacks.onConnectionChange('error', '尚未設定 Supabase Project URL 與 Publishable Key。');
      return;
    }

    const normalizedRoom = roomCode.trim().toUpperCase();
    if (!normalizedRoom) {
      callbacks.onConnectionChange('error', '請輸入有效的房間代碼。');
      return;
    }

    callbacks.onConnectionChange('connecting');

    const cacheKey = `${config.url}::${config.anonKey}`;
    if (!this.client || this.clientKey !== cacheKey) {
      this.client = createClient(config.url, config.anonKey, {
        realtime: {
          params: {
            eventsPerSecond: 20,
          },
        },
      });
      this.clientKey = cacheKey;
    }

    this.currentRoomCode = normalizedRoom;

    const channel = this.client.channel(`roulette_room_${normalizedRoom}`, {
      config: {
        broadcast: { self: false },
        presence: { key: this.clientId },
      },
    });

    const extractPresence = () => {
      const state = channel.presenceState<RoomParticipantPresence>();
      const members: RoomParticipantPresence[] = [];
      for (const entries of Object.values(state)) {
        for (const entry of entries) {
          if (entry && entry.clientId) {
            members.push({
              clientId: entry.clientId,
              nickname: entry.nickname || '匿名觀眾',
              role: entry.role === 'host' ? 'host' : 'viewer',
              joinedAt: entry.joinedAt || new Date().toISOString(),
            });
          }
        }
      }
      members.sort((a, b) => {
        if (a.role !== b.role) return a.role === 'host' ? -1 : 1;
        return a.joinedAt.localeCompare(b.joinedAt);
      });
      callbacks.onPresenceUpdate(members);
    };

    channel
      .on('presence', { event: 'sync' }, extractPresence)
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        extractPresence();
        if (role === 'host' && newPresences.length > 0) {
          callbacks.onSyncRequested();
        }
      })
      .on('presence', { event: 'leave' }, extractPresence)
      .on('broadcast', { event: 'STATE_SYNC' }, ({ payload }) => {
        if (payload) {
          callbacks.onStateSnapshot(payload as RoomStateSnapshot);
        }
      })
      .on('broadcast', { event: 'SPIN_START' }, ({ payload }) => {
        if (payload) {
          callbacks.onSpinStart(payload as SyncedSpinCommand);
        }
      })
      .on('broadcast', { event: 'SPIN_RESULT' }, ({ payload }) => {
        if (payload) {
          callbacks.onSpinResult(payload as DrawRecord);
        }
      })
      .on('broadcast', { event: 'STAGE_RESET' }, () => {
        callbacks.onStageReset();
      })
      .on('broadcast', { event: 'DANMAKU' }, ({ payload }) => {
        if (payload) {
          callbacks.onDanmaku(payload as DanmakuMessage);
        }
      })
      .on('broadcast', { event: 'REQUEST_SYNC' }, () => {
        if (role === 'host') {
          callbacks.onSyncRequested();
        }
      });

    this.channel = channel;

    channel.subscribe(async (status, err) => {
      if (this.channel !== channel) return;

      if (status === 'SUBSCRIBED') {
        try {
          await channel.track({
            clientId: this.clientId,
            nickname: nickname.trim() || (role === 'host' ? '主持人' : '觀眾'),
            role,
            joinedAt: new Date().toISOString(),
          } satisfies RoomParticipantPresence);
        } catch {
          // Presence track errors should not kill broadcast
        }
        callbacks.onConnectionChange('connected');
        if (role === 'viewer') {
          void this.requestStateSync();
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        callbacks.onConnectionChange(
          'error',
          err?.message || '無法連線至 Supabase Realtime，請確認網路與專案未休眠。'
        );
      } else if (status === 'CLOSED') {
        callbacks.onConnectionChange('disconnected');
      }
    });
  }

  public async disconnect(): Promise<void> {
    const ch = this.channel;
    this.channel = null;
    this.currentRoomCode = '';
    if (ch && this.client) {
      try {
        await ch.untrack();
      } catch {
        // Ignore untrack error on teardown
      }
      try {
        await this.client.removeChannel(ch);
      } catch {
        // Ignore cleanup error
      }
    }
  }

  public async broadcastState(snapshot: RoomStateSnapshot): Promise<void> {
    if (!this.channel) return;
    await this.channel.send({
      type: 'broadcast',
      event: 'STATE_SYNC',
      payload: snapshot,
    });
  }

  public async broadcastSpinStart(command: SyncedSpinCommand): Promise<void> {
    if (!this.channel) return;
    await this.channel.send({
      type: 'broadcast',
      event: 'SPIN_START',
      payload: command,
    });
  }

  public async broadcastSpinResult(record: DrawRecord): Promise<void> {
    if (!this.channel) return;
    await this.channel.send({
      type: 'broadcast',
      event: 'SPIN_RESULT',
      payload: record,
    });
  }

  public async broadcastStageReset(): Promise<void> {
    if (!this.channel) return;
    await this.channel.send({
      type: 'broadcast',
      event: 'STAGE_RESET',
      payload: { sentAt: Date.now() },
    });
  }

  public async broadcastDanmaku(message: DanmakuMessage): Promise<void> {
    if (!this.channel) return;
    await this.channel.send({
      type: 'broadcast',
      event: 'DANMAKU',
      payload: message,
    });
  }

  public async requestStateSync(): Promise<void> {
    if (!this.channel) return;
    await this.channel.send({
      type: 'broadcast',
      event: 'REQUEST_SYNC',
      payload: { requesterId: this.clientId, sentAt: Date.now() },
    });
  }
}

export const realtimeRoomService = new SupabaseRealtimeRoomService();
