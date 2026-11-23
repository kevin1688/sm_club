import React, { useEffect, useRef } from 'react';
import { Crown, Flame, MessageSquareText, Sparkles, Users } from 'lucide-react';
import type { DanmakuColor, DanmakuMessage } from '../types/realtime';

interface DanmakuLiveFeedProps {
  messages: DanmakuMessage[];
  memberCount: number;
}

const TEXT_COLOR_CLASS: Record<DanmakuColor, string> = {
  white: 'text-[#F1F5F9]',
  lucky: 'text-[#6EE7B7]',
  danger: 'text-[#FDA4AF]',
  gold: 'text-[#FDE68A]',
};

export const DanmakuLiveFeed: React.FC<DanmakuLiveFeedProps> = ({ messages, memberCount }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <div className="hidden lg:flex flex-1 min-h-0 flex-col mb-3 overflow-hidden rounded-xl border border-white/10 bg-[#0B0A1B]/85">
      {/* Panel Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3.5 py-2.5">
        <div className="flex items-center gap-2 text-xs font-bold text-white">
          <MessageSquareText className="h-4 w-4 text-[#A78BFA]" aria-hidden="true" />
          <span>現場即時彈幕</span>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#10B981]/15 px-2 py-0.5 text-[11px] font-semibold text-[#6EE7B7] tabular-nums">
          <Users className="h-3 w-3" aria-hidden="true" />
          <span>{Math.max(1, memberCount)}</span>
        </span>
      </div>

      {/* Scrollable Messages */}
      <div
        ref={scrollRef}
        aria-live="polite"
        className="flex-1 min-h-0 overflow-y-auto px-3 py-2.5 space-y-2"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center px-4">
            <Sparkles className="h-6 w-6 text-[#7C3AED]/70 mb-2" aria-hidden="true" />
            <p className="text-xs font-semibold text-[#CBD5E1]">轉盤正在熱烈進行中！</p>
            <p className="mt-1 text-[11px] text-[#94A3B8]">
              點擊下方快捷梗詞或輸入文字，立即向全場發射彈幕。
            </p>
          </div>
        ) : (
          messages.slice(-50).map((msg) => {
            const isSysMin = msg.kind === 'system-min';
            const isSysMax = msg.kind === 'system-max';
            const isSysInfo = msg.kind === 'system-info';

            if (isSysMin || isSysMax || isSysInfo) {
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold leading-snug ${
                    isSysMin
                      ? 'border-[#10B981]/45 bg-[#10B981]/15 text-[#FEF08A]'
                      : isSysMax
                        ? 'border-[#F43F5E]/45 bg-[#F43F5E]/15 text-[#FFE4E6]'
                        : 'border-[#7C3AED]/45 bg-[#7C3AED]/15 text-[#EDE9FE]'
                  }`}
                >
                  {isSysMin ? (
                    <Crown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FDE68A]" aria-hidden="true" />
                  ) : isSysMax ? (
                    <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#FDA4AF]" aria-hidden="true" />
                  ) : (
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#C4B5FD]" aria-hidden="true" />
                  )}
                  <span className="break-words">{msg.text}</span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className="rounded-lg bg-white/[0.03] px-2.5 py-1.5 text-xs leading-relaxed break-words"
              >
                <span className="mr-1.5 font-bold text-[#A78BFA]">{msg.senderName}</span>
                <span className={`font-semibold ${TEXT_COLOR_CLASS[msg.color]}`}>{msg.text}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

