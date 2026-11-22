import React, { useEffect, useState } from 'react';
import { Send, MessageSquare, Sparkles } from 'lucide-react';
import type { DanmakuColor } from '../types/realtime';
import {
  checkDanmakuCooldown,
  DANMAKU_COOLDOWN_MS,
  DANMAKU_MAX_LENGTH,
  QUICK_DANMAKU_PRESETS,
  sanitizeDanmakuText,
} from '../utils/danmakuLogic';

interface DanmakuComposerProps {
  nickname: string;
  disabled: boolean;
  onUpdateNickname: (next: string) => void;
  onSendDanmaku: (text: string, color: DanmakuColor) => void;
}

const COLOR_OPTIONS: { key: DanmakuColor; label: string; dotClass: string }[] = [
  { key: 'white', label: '經典白', dotClass: 'bg-white' },
  { key: 'lucky', label: '幸運綠', dotClass: 'bg-[#34D399]' },
  { key: 'danger', label: '警示紅', dotClass: 'bg-[#FB7185]' },
  { key: 'gold', label: '應援金', dotClass: 'bg-[#FBBF24]' },
];

export const DanmakuComposer: React.FC<DanmakuComposerProps> = ({
  nickname,
  disabled,
  onUpdateNickname,
  onSendDanmaku,
}) => {
  const [draft, setDraft] = useState('');
  const [color, setColor] = useState<DanmakuColor>('white');
  const [lastSentAt, setLastSentAt] = useState<number>(0);
  const [cooldownLeftMs, setCooldownLeftMs] = useState<number>(0);

  useEffect(() => {
    if (lastSentAt <= 0) return;
    const tick = () => {
      const { allowed, remainingMs } = checkDanmakuCooldown(
        lastSentAt,
        Date.now(),
        DANMAKU_COOLDOWN_MS
      );
      setCooldownLeftMs(allowed ? 0 : remainingMs);
    };
    tick();
    const id = window.setInterval(tick, 120);
    return () => window.clearInterval(id);
  }, [lastSentAt]);

  const emitDanmaku = (rawText: string, chosenColor: DanmakuColor) => {
    if (disabled) return;
    const now = Date.now();
    const { allowed, remainingMs } = checkDanmakuCooldown(lastSentAt, now, DANMAKU_COOLDOWN_MS);
    if (!allowed) {
      setCooldownLeftMs(remainingMs);
      return;
    }
    const clean = sanitizeDanmakuText(rawText, DANMAKU_MAX_LENGTH);
    if (!clean) return;
    setLastSentAt(now);
    setCooldownLeftMs(DANMAKU_COOLDOWN_MS);
    onSendDanmaku(clean, chosenColor);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim()) return;
    emitDanmaku(draft, color);
    setDraft('');
  };

  const isCoolingDown = cooldownLeftMs > 0;

  return (
    <div className="mt-5 w-full rounded-xl border border-[#7C3AED]/40 bg-[#0F0F23]/85 p-3.5 space-y-3">
      {/* Header + Nickname + Color Picker */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <MessageSquare className="h-4 w-4 text-[#A78BFA]" aria-hidden="true" />
          <span>發射互動彈幕</span>
          <label htmlFor="danmaku-nickname" className="sr-only">
            您的彈幕暱稱
          </label>
          <input
            id="danmaku-nickname"
            type="text"
            maxLength={16}
            value={nickname}
            onChange={(e) => onUpdateNickname(e.target.value)}
            placeholder="輸入暱稱"
            className="w-28 rounded-lg border border-white/15 bg-[#1E1C35] px-2 py-1 text-xs font-semibold text-[#E2E8F0] placeholder-[#64748B] focus:border-[#A78BFA] focus:outline-none focus:ring-1 focus:ring-[#A78BFA]"
          />
        </div>

        {/* Color Pills */}
        <div className="flex items-center gap-1.5" role="radiogroup" aria-label="彈幕顏色">
          {COLOR_OPTIONS.map((opt) => {
            const active = color === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={active}
                aria-label={opt.label}
                onClick={() => setColor(opt.key)}
                className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] ${
                  active
                    ? 'scale-110 border-white bg-white/15'
                    : 'border-white/15 bg-black/30 hover:border-white/40'
                }`}
              >
                <span className={`h-3.5 w-3.5 rounded-full ${opt.dotClass}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Cheer Presets */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_DANMAKU_PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            disabled={disabled || isCoolingDown}
            onClick={() => emitDanmaku(preset.label, preset.color)}
            className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-[#1E1C35] px-2.5 py-1 text-xs font-semibold text-[#E2E8F0] transition-colors hover:border-[#A78BFA]/70 hover:bg-[#2A264A] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
          >
            <Sparkles className="h-3 w-3 text-[#FBBF24]" aria-hidden="true" />
            <span>{preset.label}</span>
          </button>
        ))}
      </div>

      {/* Text Input + Send */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <label htmlFor="danmaku-input" className="sr-only">
          輸入彈幕內容（最多 40 字）
        </label>
        <input
          id="danmaku-input"
          type="text"
          maxLength={DANMAKU_MAX_LENGTH}
          disabled={disabled}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={disabled ? '連線中，請稍候...' : '輸入彈幕一起喊聲（最多 40 字）...'}
          className="min-h-[44px] flex-1 rounded-xl border border-[#4C1D95]/70 bg-[#17152E] px-3.5 text-sm text-white placeholder-[#64748B] focus:border-[#A78BFA] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || isCoolingDown || !draft.trim()}
          className="inline-flex min-h-[44px] shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#7C3AED] px-4 text-xs font-bold text-white transition-colors hover:bg-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          <span className="tabular-nums">
            {isCoolingDown ? `${(cooldownLeftMs / 1000).toFixed(1)}s` : '發射'}
          </span>
        </button>
      </form>
    </div>
  );
};

