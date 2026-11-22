import React, { useEffect, useRef, useState } from 'react';
import { Crown, Flame, Sparkles } from 'lucide-react';
import type { DanmakuColor, DanmakuMessage } from '../types/realtime';
import { DANMAKU_TRACK_COUNT, pickDanmakuTrack } from '../utils/danmakuLogic';

interface ActiveBullet extends DanmakuMessage {
  track: number;
  durationSec: number;
}

interface DanmakuOverlayProps {
  messages: DanmakuMessage[];
  visible: boolean;
}

const USER_COLOR_CLASS: Record<DanmakuColor, string> = {
  white: 'text-white',
  lucky: 'text-[#6EE7B7]',
  danger: 'text-[#FDA4AF]',
  gold: 'text-[#FDE68A]',
};

export const DanmakuOverlay: React.FC<DanmakuOverlayProps> = ({ messages, visible }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trackFreeAtRef = useRef<number[]>(Array(DANMAKU_TRACK_COUNT).fill(0));
  const seenIdsRef = useRef<Set<string>>(new Set());
  const [bullets, setBullets] = useState<ActiveBullet[]>([]);
  const [stageWidth, setStageWidth] = useState<number>(640);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.('change', handler);
    return () => mq.removeEventListener?.('change', handler);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    setStageWidth(el.clientWidth || 640);
    const obs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setStageWidth(Math.round(entry.contentRect.width));
        }
      }
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Schedule any newly arrived messages into non-overlapping tracks
  useEffect(() => {
    if (messages.length === 0) return;

    const now = Date.now();
    const fresh: ActiveBullet[] = [];

    for (const msg of messages) {
      if (seenIdsRef.current.has(msg.id)) continue;
      seenIdsRef.current.add(msg.id);

      // Keep seen-set bounded
      if (seenIdsRef.current.size > 400) {
        const first = seenIdsRef.current.values().next().value;
        if (first) seenIdsRef.current.delete(first);
      }

      const track = pickDanmakuTrack(trackFreeAtRef.current, now);
      const isSystem = msg.kind !== 'user';
      const charCount = Array.from(msg.text).length + Array.from(msg.senderName).length;
      const durationSec = isSystem
        ? 8.8
        : Math.max(6.4, Math.min(9.5, 6.2 + charCount * 0.065));

      // Estimate time until bullet tail clears right edge (~28% of travel time)
      const clearMs = Math.max(1600, Math.min(3400, (charCount * 90) + 1200));
      trackFreeAtRef.current[track] = Math.max(now, trackFreeAtRef.current[track]) + clearMs;

      fresh.push({
        ...msg,
        track,
        durationSec,
      });
    }

    if (fresh.length === 0) return;

    setBullets((prev) => [...prev.slice(-36), ...fresh]);

    const timers = fresh.map((b) =>
      window.setTimeout(() => {
        setBullets((prev) => prev.filter((item) => item.id !== b.id));
      }, (b.durationSec + 0.5) * 1000)
    );

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [messages]);

  if (!visible) return null;

  // Accessible calm feed fallback for users preferring reduced motion (pinned to top to never cover input)
  if (reducedMotion) {
    const latestFew = bullets.slice(-4);
    if (latestFew.length === 0) return null;
    return (
      <div
        aria-live="polite"
        className="pointer-events-none absolute inset-x-3 top-3 z-20 flex flex-col gap-1.5"
      >
        {latestFew.map((b) => (
          <div
            key={b.id}
            className="self-start rounded-lg border border-white/15 bg-[#0F0F23]/90 px-3 py-1 text-xs font-bold text-white shadow-lg"
          >
            <span className="text-[#A78BFA] mr-1.5">{b.senderName}:</span>
            <span className={USER_COLOR_CLASS[b.color]}>{b.text}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 bottom-8 z-20 overflow-hidden rounded-2xl select-none"
      style={{ '--danmaku-stage-width': `${stageWidth}px` } as React.CSSProperties}
    >
      {bullets.map((b) => {
        // Keep all 7 tracks cleanly in the upper-to-mid wheel zone (4% ~ 58%) so lower controls & input are never obscured
        const topPct = 4 + b.track * 9;
        const isSysMin = b.kind === 'system-min';
        const isSysMax = b.kind === 'system-max';
        const isSysInfo = b.kind === 'system-info';

        return (
          <div
            key={b.id}
            className="animate-danmaku-scroll absolute left-full whitespace-nowrap"
            style={
              {
                top: `${topPct}%`,
                '--danmaku-duration': `${b.durationSec}s`,
              } as React.CSSProperties
            }
          >
            {isSysMin || isSysMax || isSysInfo ? (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs sm:text-sm font-black shadow-xl backdrop-blur-sm ${
                  isSysMin
                    ? 'border-[#34D399] bg-[#064E3B]/90 text-[#FEF08A]'
                    : isSysMax
                      ? 'border-[#FB7185] bg-[#881337]/90 text-[#FFE4E6]'
                      : 'border-[#A78BFA] bg-[#3B0764]/90 text-[#F5F3FF]'
                }`}
              >
                {isSysMin ? (
                  <Crown className="h-3.5 w-3.5 text-[#FDE68A]" />
                ) : isSysMax ? (
                  <Flame className="h-3.5 w-3.5 text-[#FDA4AF]" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5 text-[#C4B5FD]" />
                )}
                <span>{b.text}</span>
              </span>
            ) : (
              <span className="inline-flex items-baseline gap-1.5 text-sm sm:text-base font-bold danmaku-stroke">
                <span className="text-xs font-semibold text-[#C4B5FD]/95">{b.senderName}</span>
                <span className={USER_COLOR_CLASS[b.color]}>{b.text}</span>
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

