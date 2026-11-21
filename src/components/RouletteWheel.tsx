import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Play, RotateCw } from 'lucide-react';
import type { WheelItem } from '../types';
import { computeTargetRotation, getSliceIndexAtPointer } from '../utils/drawLogic';
import { soundEngine } from '../services/soundEngine';

interface RouletteWheelProps {
  items: WheelItem[];
  mode: 'participant' | 'amount';
  isSpinning: boolean;
  disabled: boolean;
  actionLabel: string;
  accentMode?: 'default' | 'min' | 'max';
  spinRequestId: number;
  onSpinStart: () => void;
  onSpinComplete: (selectedIndex: number, item: WheelItem) => void;
  onTriggerSpin: () => void;
}

const PARTICIPANT_COLORS = [
  '#4F46E5', // Indigo
  '#7C3AED', // Electric Violet
  '#0284C7', // Vivid Sky
  '#0D9488', // Deep Teal
  '#9333EA', // Royal Purple
  '#2563EB', // Cobalt
  '#C026D3', // Fuchsia
  '#0891B2', // Cyan
];

const AMOUNT_COLORS = [
  '#312E81', // Deep Indigo
  '#4C1D95', // Deep Violet
  '#1E3A8A', // Midnight Blue
  '#3B0764', // Dark Purple
  '#164E63', // Deep Cyan
  '#3730A3', // Royal Slate Indigo
];

function truncateText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(2, maxChars - 1))}…`;
}

export const RouletteWheel: React.FC<RouletteWheelProps> = ({
  items,
  mode,
  isSpinning,
  disabled,
  actionLabel,
  accentMode = 'default',
  spinRequestId,
  onSpinStart,
  onSpinComplete,
  onTriggerSpin,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef<number>(0);
  const flapperKickRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const lastHandledSpinIdRef = useRef<number>(0);
  const [liveHoverLabel, setLiveHoverLabel] = useState<string>('');
  const [isSuspensePhase, setIsSuspensePhase] = useState<boolean>(false);
  const ledPhaseRef = useRef<number>(0);

  // Store latest callbacks/items in refs so animation loop doesn't restart mid-spin
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onSpinStartRef = useRef(onSpinStart);
  onSpinStartRef.current = onSpinStart;
  const onSpinCompleteRef = useRef(onSpinComplete);
  onSpinCompleteRef.current = onSpinComplete;

  const drawWheel = (rotation: number, flapperAngle: number, ledTick: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displaySize = canvas.clientWidth || 420;
    if (canvas.width !== Math.round(displaySize * dpr) || canvas.height !== Math.round(displaySize * dpr)) {
      canvas.width = Math.round(displaySize * dpr);
      canvas.height = Math.round(displaySize * dpr);
    }

    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displaySize, displaySize);

    const cx = displaySize / 2;
    const cy = displaySize / 2 + 6;
    const outerRadius = displaySize * 0.44;
    const wheelRadius = outerRadius - 18;
    const currentItems = itemsRef.current;
    const count = currentItems.length;

    // 1. Ambient glow under wheel
    const glowColor =
      accentMode === 'min'
        ? 'rgba(16, 185, 129, 0.34)'
        : accentMode === 'max'
          ? 'rgba(244, 63, 94, 0.36)'
          : mode === 'amount'
            ? 'rgba(245, 158, 11, 0.24)'
            : 'rgba(124, 58, 237, 0.32)';
    const bgGlow = ctx.createRadialGradient(cx, cy, wheelRadius * 0.5, cx, cy, outerRadius + 22);
    bgGlow.addColorStop(0, glowColor);
    bgGlow.addColorStop(1, 'rgba(15, 15, 35, 0)');
    ctx.fillStyle = bgGlow;
    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius + 22, 0, Math.PI * 2);
    ctx.fill();

    // 2. 3D Metallic Bezel Ring
    const bezelGrad = ctx.createLinearGradient(cx - outerRadius, cy - outerRadius, cx + outerRadius, cy + outerRadius);
    bezelGrad.addColorStop(0, '#4C1D95');
    bezelGrad.addColorStop(0.28, '#2E1065');
    bezelGrad.addColorStop(0.52, '#6D28D9');
    bezelGrad.addColorStop(0.78, '#1E1B4B');
    bezelGrad.addColorStop(1, '#3B0764');

    ctx.beginPath();
    ctx.arc(cx, cy, outerRadius, 0, Math.PI * 2);
    ctx.fillStyle = bezelGrad;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    ctx.fill();
    ctx.shadowColor = 'transparent';

    // Metallic rim highlight stroke
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(196, 181, 253, 0.5)';
    ctx.stroke();

    // 3. Animated LED Chase Bulbs on Bezel
    const bulbCount = 24;
    const bulbOrbit = outerRadius - 9;
    for (let i = 0; i < bulbCount; i += 1) {
      const angle = (i / bulbCount) * Math.PI * 2 - Math.PI / 2;
      const bx = cx + Math.cos(angle) * bulbOrbit;
      const by = cy + Math.sin(angle) * bulbOrbit;
      const lit = (i + Math.floor(ledTick)) % 2 === 0;

      ctx.beginPath();
      ctx.arc(bx, by, 3.6, 0, Math.PI * 2);
      if (lit) {
        const bulbColor =
          accentMode === 'min'
            ? '#34D399'
            : accentMode === 'max'
              ? '#FB7185'
              : mode === 'amount'
                ? '#FBBF24'
                : '#C4B5FD';
        ctx.fillStyle = bulbColor;
        ctx.shadowColor = bulbColor;
        ctx.shadowBlur = 10;
      } else {
        ctx.fillStyle = 'rgba(15, 15, 35, 0.72)';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // 4. Wheel Slices
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    if (count === 0) {
      ctx.beginPath();
      ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#1E1C35';
      ctx.fill();
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      const sliceAngle = (Math.PI * 2) / count;
      const palette = mode === 'participant' ? PARTICIPANT_COLORS : AMOUNT_COLORS;

      for (let i = 0; i < count; i += 1) {
        const item = currentItems[i];
        const startA = i * sliceAngle;
        const endA = startA + sliceAngle;

        let baseColor = palette[i % palette.length];
        if (mode === 'amount') {
          if (item.badge === 'min') {
            baseColor = '#059669'; // Emerald for Lucky Min
          } else if (item.badge === 'max') {
            baseColor = '#E11D48'; // Crimson Rose for Max Price
          }
        }

        // Radial slice shading for 3D depth
        const midAngle = startA + sliceAngle / 2;
        const sliceGrad = ctx.createRadialGradient(0, 0, 26, 0, 0, wheelRadius);
        sliceGrad.addColorStop(0, '#1B1834');
        sliceGrad.addColorStop(0.28, baseColor);
        sliceGrad.addColorStop(1, baseColor);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, wheelRadius, startA, endA);
        ctx.closePath();
        ctx.fillStyle = sliceGrad;
        ctx.fill();

        // Crisp metallic divider line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
        ctx.lineWidth = count > 20 ? 1 : 1.75;
        ctx.stroke();

        // Special gold/crimson inner highlight arc for min/max slices
        if (item.badge === 'min' || item.badge === 'max') {
          ctx.beginPath();
          ctx.arc(0, 0, wheelRadius - 5, startA + 0.02, endA - 0.02);
          ctx.strokeStyle = item.badge === 'min' ? '#FDE68A' : '#FDA4AF';
          ctx.lineWidth = 4;
          ctx.stroke();
        }

        // Slice Label
        ctx.save();
        ctx.rotate(midAngle);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const fontSize =
          count <= 6 ? 16 : count <= 10 ? 14 : count <= 16 ? 12 : count <= 24 ? 10 : 8.5;
        const maxChars = count <= 8 ? 13 : count <= 16 ? 10 : 7;

        ctx.font = `700 ${fontSize}px "Chakra Petch", "Noto Sans TC", sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.72)';
        ctx.shadowBlur = 4;

        const displayLabel = truncateText(item.label, maxChars);
        ctx.fillText(displayLabel, wheelRadius - 18, 0);

        if (item.badge && count <= 14) {
          ctx.font = `700 ${Math.max(8, fontSize - 4)}px "Chakra Petch", "Noto Sans TC", sans-serif`;
          ctx.fillStyle = item.badge === 'min' ? '#FEF08A' : '#FFE4E6';
          ctx.fillText(
            item.badge === 'min' ? 'MIN 幸運' : 'MAX 最高',
            wheelRadius - 18,
            fontSize * 0.92
          );
        }

        ctx.restore();
      }

      // 5. Physical Peg Pins at Every Slice Boundary
      for (let i = 0; i < count; i += 1) {
        const pegAngle = i * sliceAngle;
        const px = Math.cos(pegAngle) * (wheelRadius - 3);
        const py = Math.sin(pegAngle) * (wheelRadius - 3);

        ctx.beginPath();
        ctx.arc(px, py, count > 20 ? 2.4 : 3.4, 0, Math.PI * 2);
        ctx.fillStyle = '#F8FAFC';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#312E81';
        ctx.stroke();
      }
    }

    // Subtle gloss overlay across wheel face
    const gloss = ctx.createLinearGradient(-wheelRadius, -wheelRadius, wheelRadius, wheelRadius);
    gloss.addColorStop(0, 'rgba(255, 255, 255, 0.14)');
    gloss.addColorStop(0.45, 'rgba(255, 255, 255, 0.02)');
    gloss.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
    ctx.beginPath();
    ctx.arc(0, 0, wheelRadius, 0, Math.PI * 2);
    ctx.fillStyle = gloss;
    ctx.fill();

    // Inner recessed hub ring
    ctx.beginPath();
    ctx.arc(0, 0, 48, 0, Math.PI * 2);
    ctx.fillStyle = '#0F0F23';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#7C3AED';
    ctx.stroke();

    ctx.restore();

    // 6. Top Physical Spring-Back Pointer Flapper
    ctx.save();
    ctx.translate(cx, cy - outerRadius + 3);
    ctx.rotate(flapperAngle);

    // Shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;

    // Pointer body (metallic crimson/gold arrow)
    ctx.beginPath();
    ctx.moveTo(0, 32);
    ctx.lineTo(-14, -4);
    ctx.quadraticCurveTo(0, -14, 14, -4);
    ctx.closePath();

    const ptrGrad = ctx.createLinearGradient(-14, -10, 14, 32);
    ptrGrad.addColorStop(0, '#FDA4AF');
    ptrGrad.addColorStop(0.45, '#F43F5E');
    ptrGrad.addColorStop(1, '#9F1239');
    ctx.fillStyle = ptrGrad;
    ctx.fill();

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#FFF1F2';
    ctx.stroke();

    // Center rivet
    ctx.shadowColor = 'transparent';
    ctx.beginPath();
    ctx.arc(0, 1, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#FDE68A';
    ctx.fill();
    ctx.restore();

    ctx.restore();
  };

  // Idle / ambient LED animation + resize redraw
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const tickIdle = (now: number) => {
      if (!isSpinning) {
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        if (!prefersReduced) {
          ledPhaseRef.current += dt * 2.4;
        }
        // Spring flapper gently back to 0
        flapperKickRef.current *= 0.85;
        drawWheel(rotationRef.current, flapperKickRef.current, ledPhaseRef.current);

        if (itemsRef.current.length > 0) {
          const idx = getSliceIndexAtPointer(rotationRef.current, itemsRef.current.length);
          const lbl = itemsRef.current[idx]?.label ?? '';
          setLiveHoverLabel((prev) => (prev === lbl ? prev : lbl));
        } else {
          setLiveHoverLabel('');
        }
      }
      rafId = requestAnimationFrame(tickIdle);
    };

    rafId = requestAnimationFrame(tickIdle);
    return () => cancelAnimationFrame(rafId);
  }, [isSpinning, items, mode, accentMode]);

  // Trigger spin when spinRequestId increments
  useEffect(() => {
    if (spinRequestId === 0 || spinRequestId === lastHandledSpinIdRef.current) return;
    lastHandledSpinIdRef.current = spinRequestId;

    const currentItems = itemsRef.current;
    if (currentItems.length === 0) return;

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const targetIndex = Math.floor(Math.random() * currentItems.length);
    const startRotation = rotationRef.current;
    // Extended revolutions + >2x spin duration for dramatic slow-crawl tension
    const extraSpins = prefersReduced ? 1 : mode === 'participant' ? 13 : 15;
    // Allow slightly wider landing range inside the target slice for near-peg edge suspense
    const jitter = 0.16 + Math.random() * 0.68;
    const targetRotation = computeTargetRotation(
      startRotation,
      targetIndex,
      currentItems.length,
      extraSpins,
      jitter
    );

    const durationMs = prefersReduced ? 600 : mode === 'participant' ? 10500 : 12000;
    const startTime = performance.now();
    let prevSliceIdx = getSliceIndexAtPointer(startRotation, currentItems.length);
    let suspenseEntered = false;

    setIsSuspensePhase(false);
    onSpinStartRef.current();
    soundEngine.playSpinStart();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / durationMs);
      // Calibrated 3.15-order physical deceleration: energetic launch -> long, nail-biting slow stop
      const easeOut = 1 - Math.pow(1 - t, 3.15);
      const currentRot = startRotation + (targetRotation - startRotation) * easeOut;
      const instantSpeedRatio = Math.pow(1 - t, 2.15);

      if (!suspenseEntered && t >= 0.62 && t < 1) {
        suspenseEntered = true;
        setIsSuspensePhase(true);
      }

      rotationRef.current = currentRot;
      ledPhaseRef.current += 0.18 + instantSpeedRatio * 1.5;

      const sliceIdx = getSliceIndexAtPointer(currentRot, currentItems.length);
      if (sliceIdx !== prevSliceIdx) {
        prevSliceIdx = sliceIdx;
        // Heavier flapper kick during the slow final ticks for tactile suspense
        flapperKickRef.current = instantSpeedRatio < 0.18 ? -0.44 : -0.3 - instantSpeedRatio * 0.22;
        soundEngine.playPegTick(instantSpeedRatio);
        setLiveHoverLabel(currentItems[sliceIdx]?.label ?? '');
      } else {
        flapperKickRef.current *= instantSpeedRatio < 0.18 ? 0.89 : 0.82;
      }

      drawWheel(currentRot, flapperKickRef.current, ledPhaseRef.current);

      if (t < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        flapperKickRef.current = 0;
        setIsSuspensePhase(false);
        drawWheel(targetRotation, 0, ledPhaseRef.current);
        const landedIdx = getSliceIndexAtPointer(targetRotation, currentItems.length);
        const chosenItem = currentItems[landedIdx] ?? currentItems[targetIndex];
        setLiveHoverLabel(chosenItem.label);
        onSpinCompleteRef.current(landedIdx, chosenItem);
      }
    };

    animFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameRef.current !== null) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [spinRequestId, mode]);

  const canClickHub = !disabled && !isSpinning && items.length > 0;

  return (
    <div className="relative flex flex-col items-center justify-center w-full select-none">
      {/* Live pointer readout pill */}
      <div
        aria-live="polite"
        className={`mb-3 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold shadow-lg transition-all duration-300 ${
          isSuspensePhase
            ? 'border-[#F43F5E] bg-[#2D0E1F]/95 text-[#FFE4E6] shadow-[0_0_24px_rgba(244,63,94,0.45)]'
            : 'border-[#7C3AED]/50 bg-[#0F0F23]/90 text-[#E2E8F0]'
        }`}
      >
        <Sparkles
          className={`h-4 w-4 ${isSuspensePhase ? 'text-[#FB7185] animate-pulse' : 'text-[#A78BFA]'}`}
          aria-hidden="true"
        />
        <span className={isSuspensePhase ? 'text-[#FDA4AF]' : 'text-[#94A3B8]'}>
          {isSuspensePhase ? '即將揭曉：' : '指針位置：'}
        </span>
        <span className="max-w-[200px] truncate font-bold text-white tabular-nums">
          {liveHoverLabel || (items.length === 0 ? '請先新增名單' : '準備就緒')}
        </span>
      </div>

      {/* Wheel Canvas + Interactive Center Hub */}
      <div className="relative w-full max-w-[440px] aspect-square flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="h-full w-full block"
          aria-label={mode === 'participant' ? '人物 ID 抽獎輪盤' : '抽獎金額輪盤'}
        />

        {/* Tactile 3D Center Spin Hub Button */}
        <button
          type="button"
          onClick={onTriggerSpin}
          disabled={!canClickHub}
          aria-label={actionLabel}
          className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 mt-[6px] flex h-[86px] w-[86px] flex-col items-center justify-center rounded-full border-2 font-display text-xs tracking-wider shadow-[0_10px_25px_rgba(0,0,0,0.75)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0F23] ${
            canClickHub
              ? mode === 'amount'
                ? 'cursor-pointer border-[#FDE68A] bg-gradient-to-b from-[#F59E0B] to-[#D97706] text-[#0F0F23] hover:brightness-110 active:scale-95'
                : 'cursor-pointer border-[#FDA4AF] bg-gradient-to-b from-[#F43F5E] to-[#BE123C] text-white hover:brightness-110 active:scale-95'
              : 'cursor-not-allowed border-[#4C1D95] bg-[#1E1C35] text-[#94A3B8]'
          }`}
        >
          {isSpinning ? (
            <RotateCw className="h-6 w-6 animate-spin" aria-hidden="true" />
          ) : (
            <Play className="h-5 w-5 fill-current mb-0.5" aria-hidden="true" />
          )}
          <span className="leading-tight font-bold">
            {isSpinning ? '旋轉中' : mode === 'participant' ? '抽人物' : '抽金額'}
          </span>
        </button>
      </div>
    </div>
  );
};

