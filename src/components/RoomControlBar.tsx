import React, { useState } from 'react';
import {
  Radio,
  Users,
  Copy,
  Check,
  Eye,
  EyeOff,
  LogOut,
  Crown,
  Tv,
  Settings2,
  AlertCircle,
} from 'lucide-react';
import type {
  RealtimeConnectionState,
  RoomParticipantPresence,
  RoomRole,
} from '../types/realtime';

interface RoomControlBarProps {
  roomCode: string;
  role: RoomRole;
  connectionState: RealtimeConnectionState;
  connectionError: string | null;
  members: RoomParticipantPresence[];
  danmakuVisible: boolean;
  onToggleDanmaku: () => void;
  onCopyInviteLink: () => void;
  onOpenRoomModal: () => void;
  onLeaveRoom: () => void;
}

export const RoomControlBar: React.FC<RoomControlBarProps> = ({
  roomCode,
  role,
  connectionState,
  connectionError,
  members,
  danmakuVisible,
  onToggleDanmaku,
  onCopyInviteLink,
  onOpenRoomModal,
  onLeaveRoom,
}) => {
  const [copied, setCopied] = useState(false);
  const [showMembers, setShowMembers] = useState(false);

  const handleCopy = () => {
    onCopyInviteLink();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (!roomCode) {
    return (
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#7C3AED]/55 bg-[#1B1736]/95 px-4 py-3.5 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#7C3AED]/25 text-[#C4B5FD]">
            <Radio className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">即時連線房（Supabase Realtime）</div>
            <div className="text-xs text-[#94A3B8]">
              開房分享連結讓全場同步觀看轉盤與丟彈幕，或輸入房號加入觀戰
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenRoomModal}
          className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#8B5CF6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
        >
          <Radio className="h-4 w-4" aria-hidden="true" />
          <span>建立 / 加入房間</span>
        </button>
      </div>
    );
  }

  return (
    <div className="mb-5 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#7C3AED]/55 bg-[#191633]/95 px-4 py-3 shadow-lg">
        {/* Left: Status + Room Code + Role */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
              connectionState === 'connected'
                ? 'bg-[#10B981]/20 text-[#6EE7B7] border border-[#10B981]/45'
                : connectionState === 'connecting'
                  ? 'bg-[#F59E0B]/20 text-[#FDE68A] border border-[#F59E0B]/45'
                  : 'bg-[#F43F5E]/20 text-[#FDA4AF] border border-[#F43F5E]/45'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                connectionState === 'connected'
                  ? 'bg-[#34D399] animate-pulse'
                  : connectionState === 'connecting'
                    ? 'bg-[#FBBF24] animate-pulse'
                    : 'bg-[#FB7185]'
              }`}
            />
            <span>
              {connectionState === 'connected'
                ? '即時同步中'
                : connectionState === 'connecting'
                  ? '連線中...'
                  : '連線異常'}
            </span>
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#0F0F23] px-2.5 py-1 text-xs font-bold text-white tabular-nums">
            <span className="text-[#94A3B8]">房號</span>
            <span className="font-display tracking-wider text-[#C4B5FD]">{roomCode}</span>
          </span>

          <span
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold ${
              role === 'host'
                ? 'bg-[#F59E0B]/20 text-[#FDE68A] border border-[#F59E0B]/40'
                : 'bg-[#7C3AED]/20 text-[#DDD6FE] border border-[#7C3AED]/40'
            }`}
          >
            {role === 'host' ? (
              <>
                <Crown className="h-3.5 w-3.5" aria-hidden="true" />
                <span>主持人</span>
              </>
            ) : (
              <>
                <Tv className="h-3.5 w-3.5" aria-hidden="true" />
                <span>觀眾模式</span>
              </>
            )}
          </span>

          {/* Online Members Button */}
          <button
            type="button"
            onClick={() => setShowMembers((v) => !v)}
            className="inline-flex min-h-[34px] cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-[#0F0F23]/80 px-2.5 text-xs font-semibold text-[#E2E8F0] transition-colors hover:border-[#A78BFA]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
          >
            <Users className="h-3.5 w-3.5 text-[#34D399]" aria-hidden="true" />
            <span className="tabular-nums">{Math.max(1, members.length)} 人在線</span>
          </button>
        </div>

        {/* Right: Quick Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl bg-[#7C3AED] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#8B5CF6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-[#6EE7B7]" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{copied ? '已複製邀請連結' : '複製邀請連結'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleDanmaku}
            className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl border border-white/15 bg-[#0F0F23] px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
          >
            {danmakuVisible ? (
              <Eye className="h-3.5 w-3.5 text-[#A78BFA]" aria-hidden="true" />
            ) : (
              <EyeOff className="h-3.5 w-3.5 text-[#94A3B8]" aria-hidden="true" />
            )}
            <span>{danmakuVisible ? '彈幕：開' : '彈幕：關'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenRoomModal}
            aria-label="房間與連線設定"
            className="inline-flex min-h-[38px] cursor-pointer items-center justify-center rounded-xl border border-white/15 bg-[#0F0F23] px-2.5 text-xs text-[#CBD5E1] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onLeaveRoom}
            className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#F43F5E]/40 bg-[#F43F5E]/10 px-3 py-1.5 text-xs font-bold text-[#FDA4AF] transition-colors hover:bg-[#F43F5E]/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
          >
            <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
            <span>離開房間</span>
          </button>
        </div>
      </div>

      {connectionState === 'error' && connectionError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-[#F43F5E]/50 bg-[#F43F5E]/15 px-3.5 py-2 text-xs text-[#FFE4E6]"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-[#FB7185]" aria-hidden="true" />
          <span>{connectionError}</span>
        </div>
      )}

      {showMembers && members.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-white/10 bg-[#0F0F23]/90 px-3.5 py-2.5 text-xs">
          <span className="text-[#94A3B8] mr-1">在線名單：</span>
          {members.map((m) => (
            <span
              key={m.clientId}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold ${
                m.role === 'host'
                  ? 'bg-[#F59E0B]/20 text-[#FDE68A]'
                  : 'bg-[#1E1C35] text-[#E2E8F0]'
              }`}
            >
              {m.role === 'host' && <Crown className="h-3 w-3" aria-hidden="true" />}
              <span>{m.nickname}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
