import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Crown,
  Sparkles,
  Flame,
  Zap,
  Wallet,
  TrendingDown,
  TrendingUp,
  CheckCircle2,
  Cloud,
  CloudUpload,
  HardDrive,
  AlertCircle,
  RotateCcw,
  X,
  Gem,
} from 'lucide-react';
import type { DrawRecord, SyncStatus } from '../types';
import { formatAmount } from '../utils/drawLogic';

interface SpecialEffectsProps {
  record: DrawRecord | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  readOnlyViewer?: boolean;
  onNextRound: () => void;
  onClose: () => void;
}

const FALLING_PARTICLES = Array.from({ length: 14 }, (_, idx) => ({
  id: idx,
  left: `${5 + ((idx * 7.1) % 90)}%`,
  delay: `${(idx * 0.23) % 1.8}s`,
  duration: `${2.4 + (idx % 4) * 0.55}s`,
}));

export const SpecialEffects: React.FC<SpecialEffectsProps> = ({
  record,
  syncStatus,
  syncError,
  readOnlyViewer = false,
  onNextRound,
  onClose,
}) => {
  // Trigger confetti for lucky min (grand celebration) & subtle burst for normal
  useEffect(() => {
    if (!record) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    if (record.tier === 'min') {
      const colors = ['#10B981', '#FBBF24', '#34D399', '#FDE68A', '#FFFFFF'];
      const end = Date.now() + 1800;

      const fireFrame = () => {
        confetti({
          particleCount: 5,
          angle: 60,
          spread: 62,
          origin: { x: 0.05, y: 0.65 },
          colors,
        });
        confetti({
          particleCount: 5,
          angle: 120,
          spread: 62,
          origin: { x: 0.95, y: 0.65 },
          colors,
        });
        if (Date.now() < end) {
          requestAnimationFrame(fireFrame);
        }
      };

      confetti({
        particleCount: 90,
        spread: 85,
        origin: { y: 0.55 },
        colors,
      });
      requestAnimationFrame(fireFrame);
    } else if (record.tier === 'normal') {
      confetti({
        particleCount: 40,
        spread: 65,
        origin: { y: 0.6 },
        colors: ['#7C3AED', '#A78BFA', '#38BDF8', '#E2E8F0'],
      });
    }
  }, [record]);

  // Esc key to dismiss overlay
  useEffect(() => {
    if (!record) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [record, onClose]);

  if (!record) return null;

  const isMin = record.tier === 'min';
  const isMax = record.tier === 'max';
  const diffFromOtherEnd = isMin
    ? record.poolMax - record.amount
    : isMax
      ? record.amount - record.poolMin
      : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="draw-result-heading"
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md transition-opacity duration-200 ${
        isMax
          ? 'bg-[#2A0410]/82'
          : isMin
            ? 'bg-[#032219]/80'
            : 'bg-[#090818]/80'
      }`}
    >
      {/* Dramatic Lightning Flash for Maximum Price */}
      {isMax && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 bg-gradient-to-b from-[#F43F5E]/45 via-transparent to-[#EF4444]/35 animate-lightning-flash"
        />
      )}

      {/* Ambient Falling Icon Particles (SVG only — per UI/UX Pro Max) */}
      {(isMin || isMax) && (
        <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
          {FALLING_PARTICLES.map((p) => (
            <div
              key={p.id}
              className="absolute top-0 animate-float-fall"
              style={
                {
                  left: p.left,
                  '--fall-delay': p.delay,
                  '--fall-duration': p.duration,
                } as React.CSSProperties
              }
            >
              {isMin ? (
                p.id % 2 === 0 ? (
                  <Sparkles className="h-6 w-6 text-[#FBBF24]/85 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
                ) : (
                  <Crown className="h-5 w-5 text-[#34D399]/85 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                )
              ) : p.id % 3 === 0 ? (
                <Flame className="h-7 w-7 text-[#F43F5E]/85 drop-shadow-[0_0_10px_rgba(244,63,94,0.85)]" />
              ) : p.id % 3 === 1 ? (
                <Zap className="h-6 w-6 text-[#FB7185]/85 drop-shadow-[0_0_10px_rgba(251,113,133,0.85)]" />
              ) : (
                <Wallet className="h-6 w-6 text-[#FCA5A5]/75" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Main Result Card */}
      <div
        className={`relative w-full max-w-lg overflow-hidden rounded-2xl border-2 p-6 sm:p-8 shadow-2xl animate-reveal-pop ${
          isMax
            ? 'animate-screen-shake border-[#F43F5E] bg-gradient-to-b from-[#2B1020] via-[#1B0D1A] to-[#120A14] shadow-[0_0_60px_rgba(244,63,94,0.45)]'
            : isMin
              ? 'border-[#10B981] bg-gradient-to-b from-[#0E2D26] via-[#102226] to-[#0D1624] shadow-[0_0_60px_rgba(16,185,129,0.45)]'
              : 'border-[#7C3AED] bg-gradient-to-b from-[#241E44] to-[#13122A] shadow-[0_0_50px_rgba(124,58,237,0.4)]'
        }`}
      >
        {/* Shimmer sweep for Lucky Min */}
        {isMin && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[#FDE68A]/20 to-transparent animate-lucky-shimmer"
          />
        )}

        {/* Close Button (min 44x44px touch target) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉結果視窗"
          className="absolute right-3 top-3 flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-[#94A3B8] transition-colors duration-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {/* Top Tier Emblem & Headline */}
        <div className="flex flex-col items-center text-center">
          <div
            className={`relative mb-4 flex h-20 w-20 items-center justify-center rounded-2xl border-2 ${
              isMax
                ? 'border-[#FB7185] bg-[#F43F5E]/20 text-[#FDA4AF]'
                : isMin
                  ? 'border-[#FDE68A] bg-[#10B981]/20 text-[#FDE68A]'
                  : 'border-[#A78BFA] bg-[#7C3AED]/20 text-[#C4B5FD]'
            }`}
          >
            <div
              aria-hidden="true"
              className={`absolute inset-0 rounded-2xl blur-xl animate-pulse-halo ${
                isMax ? 'bg-[#F43F5E]/40' : isMin ? 'bg-[#10B981]/45' : 'bg-[#7C3AED]/35'
              }`}
            />
            {isMin ? (
              <Crown className="relative h-10 w-10" aria-hidden="true" />
            ) : isMax ? (
              <Flame className="relative h-10 w-10" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="relative h-10 w-10" aria-hidden="true" />
            )}
          </div>

          {/* Slammed Stamp Badge */}
          <div
            className={`mb-3 inline-flex items-center gap-1.5 rounded-full border px-4 py-1 text-xs font-bold tracking-wider uppercase ${
              isMax
                ? 'animate-stamp-slam border-[#FB7185] bg-[#F43F5E]/25 text-[#FFE4E6]'
                : isMin
                  ? 'border-[#34D399] bg-[#10B981]/25 text-[#D1FAE5]'
                  : 'border-[#A78BFA] bg-[#7C3AED]/25 text-[#EDE9FE]'
            }`}
          >
            {isMin ? (
              <>
                <TrendingDown className="h-4 w-4 text-[#FDE68A]" aria-hidden="true" />
                <span>超幸運！最低價便宜入手</span>
              </>
            ) : isMax ? (
              <>
                <TrendingUp className="h-4 w-4 text-[#FDA4AF]" aria-hidden="true" />
                <span>荷包警報！最高金額大戶誕生</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 text-[#C4B5FD]" aria-hidden="true" />
                <span>抽獎結果揭曉</span>
              </>
            )}
          </div>

          <h2 id="draw-result-heading" className="font-display text-2xl sm:text-3xl text-white">
            {isMin
              ? '恭喜幸運低價得標！'
              : isMax
                ? '慘遭最高價爆擊！'
                : '本輪得標確認'}
          </h2>
          <p className="mt-1.5 text-sm text-[#CBD5E1]">
            {isMin
              ? `太神啦！成功以最低價搶下「${record.itemName || '未指定項目'}」，比最高價足足現省 ${formatAmount(diffFromOtherEnd, record.currencyUnit)}！`
              : isMax
                ? `感謝大戶拿下「${record.itemName || '未指定項目'}」！需支付本輪最高金額，比最低價多出 ${formatAmount(diffFromOtherEnd, record.currencyUnit)}！`
                : `已完成「${record.itemName || '未指定項目'}」人物與金額雙輪盤抽選並記錄。`}
          </p>
        </div>

        {/* Target Item + Winner & Amount Showcase Box */}
        <div className="mt-6 space-y-2.5 rounded-xl border border-white/10 bg-[#0F0F23]/75 p-4">
          <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
              <Gem className="h-3.5 w-3.5 text-[#FB7185]" aria-hidden="true" />
              <span>搶標項目</span>
            </span>
            <span className="max-w-[68%] truncate font-display text-base sm:text-lg text-white">
              {record.itemName || '未指定項目'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="flex flex-col items-center sm:items-start rounded-lg bg-white/[0.03] px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                得標者 ID
              </span>
              <span className="mt-1 max-w-full truncate font-display text-2xl text-white">
                {record.winnerId}
              </span>
            </div>
            <div className="flex flex-col items-center sm:items-end rounded-lg bg-white/[0.03] px-4 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                得標金額
              </span>
              <span
                className={`mt-1 font-display text-2xl sm:text-3xl tabular-nums ${
                  isMin ? 'text-[#34D399]' : isMax ? 'text-[#FB7185]' : 'text-[#FDE68A]'
                }`}
              >
                {formatAmount(record.amount, record.currencyUnit)}
              </span>
            </div>
          </div>
        </div>

        {/* Sync Status Strip */}
        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-black/25 px-3 py-2 text-xs text-[#CBD5E1]">
          {readOnlyViewer ? (
            <>
              <Sparkles className="h-4 w-4 text-[#A78BFA]" aria-hidden="true" />
              <span>已同步揭曉結果（由主持人負責保存歷史紀錄）</span>
            </>
          ) : (
            <>
              {syncStatus === 'syncing' && (
                <>
                  <CloudUpload className="h-4 w-4 animate-bounce text-[#A78BFA]" aria-hidden="true" />
                  <span>正在自動同步至 GitHub 歷史紀錄...</span>
                </>
              )}
              {syncStatus === 'synced' && (
                <>
                  <Cloud className="h-4 w-4 text-[#34D399]" aria-hidden="true" />
                  <span>已成功記錄並上傳至 GitHub！</span>
                </>
              )}
              {syncStatus === 'local-only' && (
                <>
                  <HardDrive className="h-4 w-4 text-[#FBBF24]" aria-hidden="true" />
                  <span>已儲存於本機模擬紀錄（可隨時一鍵上傳至 GitHub）</span>
                </>
              )}
              {syncStatus === 'error' && (
                <>
                  <AlertCircle className="h-4 w-4 text-[#FB7185]" aria-hidden="true" />
                  <span className="truncate">
                    已先存本機，GitHub 同步失敗：{syncError || '請檢查設定'}
                  </span>
                </>
              )}
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          {!readOnlyViewer && (
            <button
              type="button"
              onClick={onNextRound}
              className={`flex min-h-[48px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0F23] ${
                isMin
                  ? 'bg-[#10B981] text-[#052E16] hover:bg-[#34D399]'
                  : isMax
                    ? 'bg-[#F43F5E] text-white hover:bg-[#FB7185]'
                    : 'bg-[#7C3AED] text-white hover:bg-[#8B5CF6]'
              }`}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>進行下一輪抽獎</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className={`flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl border border-[#4C1D95] bg-[#1E1C35] px-5 py-3 text-sm font-semibold text-[#E2E8F0] transition-colors duration-200 hover:bg-[#2A264A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] ${
              readOnlyViewer ? 'flex-1' : ''
            }`}
          >
            {readOnlyViewer ? '關閉視窗（等待主持人下一輪）' : '留在此畫面'}
          </button>
        </div>
      </div>
    </div>
  );
};
