import React, { useEffect, useState } from 'react';
import {
  Radio,
  X,
  Crown,
  Tv,
  Volume2,
  Shuffle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import type { RoomRole, SupabaseConfig } from '../types/realtime';
import { generateRoomCode, normalizeRoomCode } from '../utils/danmakuLogic';
import {
  getSavedSupabaseOverride,
  resolveSupabaseConfig,
  saveSupabaseOverride,
} from '../services/realtimeService';

interface RoomModalProps {
  open: boolean;
  initialTab?: RoomRole;
  initialRoomCode?: string;
  initialNickname: string;
  onJoinOrCreate: (params: {
    role: RoomRole;
    roomCode: string;
    nickname: string;
    supabaseConfig: SupabaseConfig;
  }) => void;
  onClose: () => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({
  open,
  initialTab = 'host',
  initialRoomCode = '',
  initialNickname,
  onJoinOrCreate,
  onClose,
}) => {
  const [tab, setTab] = useState<RoomRole>(initialTab);
  const [roomCode, setRoomCode] = useState<string>(initialRoomCode || generateRoomCode());
  const [nickname, setNickname] = useState<string>(initialNickname);

  const resolved = resolveSupabaseConfig();
  const [showAdvanced, setShowAdvanced] = useState<boolean>(resolved.source === 'none');
  const [sbUrl, setSbUrl] = useState<string>(getSavedSupabaseOverride().url);
  const [sbKey, setSbKey] = useState<string>(getSavedSupabaseOverride().anonKey);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTab(initialTab);
    if (initialRoomCode) {
      setRoomCode(normalizeRoomCode(initialRoomCode));
    } else if (initialTab === 'host') {
      setRoomCode((prev) => prev || generateRoomCode());
    } else {
      setRoomCode('');
    }
    setNickname(initialNickname);
    const current = resolveSupabaseConfig();
    setShowAdvanced(current.source === 'none');
    const override = getSavedSupabaseOverride();
    setSbUrl(override.url);
    setSbKey(override.anonKey);
    setError(null);
  }, [open, initialTab, initialRoomCode, initialNickname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const builtInReady = Boolean(
    (import.meta.env.VITE_SUPABASE_URL || '').trim() &&
      (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedCode = normalizeRoomCode(roomCode);
    if (!cleanedCode) {
      setError('請輸入或產生有效的房間代碼。');
      return;
    }

    // Save optional local override if filled
    if (sbUrl.trim() || sbKey.trim()) {
      if (!sbUrl.trim() || !sbKey.trim()) {
        setError('若要使用自訂 Supabase 連線，請同時填入 Project URL 與 Publishable Key。');
        return;
      }
      saveSupabaseOverride({ url: sbUrl.trim(), anonKey: sbKey.trim() });
    } else if (showAdvanced && !builtInReady) {
      setError('尚未設定 Supabase Project URL 與 Publishable Key，請先填入上方連線資訊。');
      return;
    } else {
      saveSupabaseOverride({ url: '', anonKey: '' });
    }

    const finalConfig = resolveSupabaseConfig().config;
    if (!finalConfig.url || !finalConfig.anonKey) {
      setError('找不到有效的 Supabase 連線設定。');
      return;
    }

    const finalNickname =
      nickname.trim() || (tab === 'host' ? '主持人' : `觀眾_${Math.floor(100 + Math.random() * 900)}`);

    onJoinOrCreate({
      role: tab,
      roomCode: cleanedCode,
      nickname: finalNickname,
      supabaseConfig: finalConfig,
    });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="room-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-[#7C3AED]/60 bg-[#17152E] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7C3AED]/20 text-[#C4B5FD]">
              <Radio className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2 id="room-modal-title" className="font-display text-xl text-white">
                即時連線房設定
              </h2>
              <p className="text-xs text-[#94A3B8]">
                同步觀看轉盤減速過程與即時發射彈幕（不影響原有經典模式）
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉房間設定視窗"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-[#94A3B8] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Role Switch Tabs */}
        <div
          role="tablist"
          aria-label="選擇房間角色"
          className="mt-5 grid grid-cols-2 gap-1.5 rounded-xl border border-white/10 bg-[#0F0F23] p-1.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'host'}
            onClick={() => {
              setTab('host');
              if (!roomCode) setRoomCode(generateRoomCode());
              setError(null);
            }}
            className={`flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] ${
              tab === 'host'
                ? 'bg-[#F59E0B] text-[#0F0F23]'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <Crown className="h-4 w-4" aria-hidden="true" />
            <span>建立主持房間</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={tab === 'viewer'}
            onClick={() => {
              setTab('viewer');
              setError(null);
            }}
            className={`flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] ${
              tab === 'viewer'
                ? 'bg-[#7C3AED] text-white'
                : 'text-[#94A3B8] hover:text-white'
            }`}
          >
            <Tv className="h-4 w-4" aria-hidden="true" />
            <span>加入觀戰房間</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Room Code */}
          <div>
            <label htmlFor="room-code-input" className="block text-xs font-bold text-[#E2E8F0]">
              {tab === 'host' ? '房間代碼（可自訂或隨機產生）' : '輸入房間代碼或貼上邀請連結'}
            </label>
            <div className="mt-1.5 flex gap-2">
              <input
                id="room-code-input"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value)}
                placeholder={tab === 'host' ? '例如：SM888' : '例如：SM888 或完整網址'}
                className="min-h-[44px] flex-1 rounded-xl border border-[#4C1D95]/70 bg-[#0F0F23] px-3.5 text-sm font-bold tracking-wider text-white uppercase placeholder-[#64748B] focus:border-[#A78BFA] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
              />
              {tab === 'host' && (
                <button
                  type="button"
                  onClick={() => setRoomCode(generateRoomCode())}
                  className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#4C1D95] bg-[#0F0F23] px-3.5 text-xs font-bold text-[#C4B5FD] transition-colors hover:bg-[#252242] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
                >
                  <Shuffle className="h-4 w-4" aria-hidden="true" />
                  <span>隨機</span>
                </button>
              )}
            </div>
          </div>

          {/* Nickname */}
          <div>
            <label htmlFor="room-nickname-input" className="block text-xs font-bold text-[#E2E8F0]">
              {tab === 'host' ? '主持人顯示名稱' : '您的觀眾暱稱（發送彈幕顯示用）'}
            </label>
            <input
              id="room-nickname-input"
              type="text"
              maxLength={16}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder={tab === 'host' ? '例如：盟主 / 主持人' : '例如：KAI_01'}
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#4C1D95]/70 bg-[#0F0F23] px-3.5 text-sm text-white placeholder-[#64748B] focus:border-[#A78BFA] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
            />
          </div>

          {/* Supabase Connection Status & Optional Override */}
          <div className="rounded-xl border border-white/10 bg-[#0F0F23]/75 p-3">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full cursor-pointer items-center justify-between text-xs font-bold text-[#E2E8F0]"
            >
              <span className="inline-flex items-center gap-1.5">
                {builtInReady ? (
                  <CheckCircle2 className="h-4 w-4 text-[#34D399]" aria-hidden="true" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-[#FBBF24]" aria-hidden="true" />
                )}
                <span>
                  {builtInReady
                    ? 'Supabase Realtime 已就緒（內建連線）'
                    : 'Supabase 連線設定（首次需填入）'}
                </span>
              </span>
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />
              )}
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-2.5 border-t border-white/10 pt-3">
                <p className="text-[11px] leading-relaxed text-[#94A3B8]">
                  {builtInReady
                    ? '網站已內建預設連線，留空即使用預設值；若要改連您自己的 Supabase 專案可於下方覆寫。'
                    : '請填入 Supabase Project URL 與 Publishable / anon public key（僅保存於本機瀏覽器）。'}
                </p>
                <input
                  type="url"
                  value={sbUrl}
                  onChange={(e) => setSbUrl(e.target.value)}
                  placeholder="https://xxxx.supabase.co"
                  aria-label="Supabase Project URL"
                  className="min-h-[40px] w-full rounded-lg border border-[#4C1D95]/60 bg-[#17152E] px-3 text-xs text-white placeholder-[#64748B] focus:border-[#A78BFA] focus:outline-none"
                />
                <input
                  type="text"
                  value={sbKey}
                  onChange={(e) => setSbKey(e.target.value)}
                  placeholder="sb_publishable_... 或 anon public key"
                  aria-label="Supabase Publishable Key"
                  className="min-h-[40px] w-full rounded-lg border border-[#4C1D95]/60 bg-[#17152E] px-3 text-xs text-white placeholder-[#64748B] focus:border-[#A78BFA] focus:outline-none"
                />
              </div>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-[#F43F5E]/50 bg-[#F43F5E]/15 px-3 py-2 text-xs text-[#FFE4E6]"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-[#FB7185]" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            className={`flex min-h-[50px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold shadow-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] ${
              tab === 'host'
                ? 'bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-[#0F0F23] hover:brightness-110'
                : 'bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white hover:brightness-110'
            }`}
          >
            {tab === 'host' ? (
              <>
                <Crown className="h-4 w-4" aria-hidden="true" />
                <span>開啟主持房間並同步目前名單</span>
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4" aria-hidden="true" />
                <span>進入現場（同步轉盤並開啟音效）</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
