import type { AmountTier, DrawRecord } from '../types';

/**
 * Parse multiline / comma / whitespace separated participant IDs.
 * Trims entries, removes blanks, and optionally deduplicates while preserving order.
 */
export function parseParticipantInput(raw: string): string[] {
  return raw
    .split(/[\n,，、;\t]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

/**
 * Parse numeric amounts from flexible input (supports $, NT$, commas inside numbers when separated by newlines, etc.).
 * Keeps duplicates intentionally because an auction/group-buy pool may have multiple slots at the same price.
 */
export function parseAmountInput(raw: string): number[] {
  const tokens = raw
    .split(/[\n，、;\t]+/)
    .flatMap((line) => {
      const trimmed = line.trim();
      if (!trimmed) return [];
      // If a line looks like "1,200" (thousands comma), keep intact; if "100, 200, 300", split by comma
      if (/^(?:NT\$|\$|￥)?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(trimmed)) {
        return [trimmed];
      }
      return trimmed.split(/[,\s]+/);
    });

  const parsed: number[] = [];
  for (const token of tokens) {
    const cleaned = token
      .replace(/^(?:NT\$|US\$|\$|￥|¥)/i, '')
      .replace(/(?:新台幣|台幣|天幣|贊助幣|元)$/g, '')
      .replace(/,/g, '')
      .trim();
    if (!cleaned) continue;
    const value = Number(cleaned);
    if (Number.isFinite(value) && value >= 0) {
      parsed.push(value);
    }
  }
  return parsed;
}

/**
 * Determine whether the drawn amount is the minimum (lucky cheapest), maximum (highest to pay), or normal.
 * Only assigns 'min' or 'max' when the current pool has at least 2 distinct price values.
 */
export function classifyAmountTier(amount: number, pool: number[]): {
  tier: AmountTier;
  poolMin: number;
  poolMax: number;
} {
  if (pool.length === 0) {
    return { tier: 'normal', poolMin: amount, poolMax: amount };
  }
  const poolMin = Math.min(...pool);
  const poolMax = Math.max(...pool);

  if (poolMin === poolMax) {
    return { tier: 'normal', poolMin, poolMax };
  }
  if (amount === poolMin) {
    return { tier: 'min', poolMin, poolMax };
  }
  if (amount === poolMax) {
    return { tier: 'max', poolMin, poolMax };
  }
  return { tier: 'normal', poolMin, poolMax };
}

/**
 * Given a wheel rotation angle in radians (clockwise) and number of slices,
 * returns the index of the slice currently beneath the top pointer (-PI / 2).
 *
 * Slices are drawn starting at angle 0 (3 o'clock) clockwise:
 * slice i spans [i * sliceAngle, (i + 1) * sliceAngle] in wheel-local coordinates.
 * Under rotation `rotationRad`, wheel-local angle `theta` maps to screen angle `theta + rotationRad`.
 * Top pointer sits at screen angle `3 * PI / 2` (equivalent to `-PI / 2`).
 */
export function getSliceIndexAtPointer(rotationRad: number, itemCount: number): number {
  if (itemCount <= 0) return -1;
  const twoPi = Math.PI * 2;
  const sliceAngle = twoPi / itemCount;
  const pointerAngle = (3 * Math.PI) / 2;
  const localAngle = (((pointerAngle - rotationRad) % twoPi) + twoPi) % twoPi;
  const index = Math.floor(localAngle / sliceAngle) % itemCount;
  return index;
}

/**
 * Compute a target final rotation angle (strictly > currentRotation) that lands
 * cleanly inside the chosen `targetIndex` slice with slight natural jitter inside the slice.
 */
export function computeTargetRotation(
  currentRotation: number,
  targetIndex: number,
  itemCount: number,
  extraSpins = 6,
  jitterRatio = 0.5 // 0.15 to 0.85 within the slice
): number {
  const twoPi = Math.PI * 2;
  const sliceAngle = twoPi / itemCount;
  const clampedJitter = Math.min(0.82, Math.max(0.18, jitterRatio));
  const desiredLocalAngle = (targetIndex + clampedJitter) * sliceAngle;
  const pointerAngle = (3 * Math.PI) / 2;

  // We want: (pointerAngle - finalRotation) mod 2pi === desiredLocalAngle
  // => finalRotation mod 2pi === (pointerAngle - desiredLocalAngle) mod 2pi
  const desiredMod = (((pointerAngle - desiredLocalAngle) % twoPi) + twoPi) % twoPi;
  const currentMod = ((currentRotation % twoPi) + twoPi) % twoPi;
  let delta = desiredMod - currentMod;
  if (delta <= 0) {
    delta += twoPi;
  }
  return currentRotation + extraSpins * twoPi + delta;
}

/**
 * Deterministic 3.85-order fast-to-slow suspense easing for synced wheel spins.
 * Launches fast and smoothly brakes down into a nail-biting slow stop.
 * Guarantees host & viewers at any elapsed offset land on the exact same final angle & slice.
 */
export function evaluateSpinProgress(
  startRotation: number,
  targetRotation: number,
  durationMs: number,
  elapsedMs: number
): {
  progress: number;
  rotation: number;
  speedRatio: number;
  isSuspense: boolean;
  finished: boolean;
} {
  const safeDuration = Math.max(1, durationMs);
  const t = Math.max(0, Math.min(1, elapsedMs / safeDuration));
  const easeOut = 1 - Math.pow(1 - t, 3.85);
  const rotation = startRotation + (targetRotation - startRotation) * easeOut;
  const speedRatio = Math.pow(1 - t, 2.85);
  return {
    progress: t,
    rotation,
    speedRatio,
    isSuspense: t >= 0.58 && t < 1,
    finished: t >= 1,
  };
}

/**
 * Format amount with configurable currency unit.
 * Symbol prefixes (NT$, $, US$, ￥, ¥) appear before the number;
 * word/Chinese units (天幣, 新台幣, 贊助幣, etc.) appear cleanly after the number.
 */
export function formatAmount(amount: number, unit = '天幣'): string {
  const normalizedUnit = unit.trim() || '天幣';
  const formattedNumber = amount.toLocaleString('zh-TW', {
    maximumFractionDigits: 2,
  });

  if (/^(?:NT\$|US\$|HK\$|\$|￥|¥|€|£)$/i.test(normalizedUnit)) {
    return `${normalizedUnit} ${formattedNumber}`;
  }
  return `${formattedNumber} ${normalizedUnit}`;
}

/**
 * Remove one instance of a drawn item by index (or first match).
 */
export function removeOneAtIndex<T>(items: T[], index: number): T[] {
  if (index < 0 || index >= items.length) return items;
  return [...items.slice(0, index), ...items.slice(index + 1)];
}

/**
 * Merge local and remote draw records by unique `id`, sorting newest first.
 */
export function mergeDrawRecords(localRecords: DrawRecord[], remoteRecords: DrawRecord[]): DrawRecord[] {
  const map = new Map<string, DrawRecord>();

  for (const r of remoteRecords) {
    map.set(r.id, { ...r, syncedToGitHub: true });
  }
  for (const l of localRecords) {
    const existing = map.get(l.id);
    if (!existing) {
      map.set(l.id, l);
    } else {
      map.set(l.id, { ...existing, syncedToGitHub: true });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

/**
 * Export records to UTF-8 BOM CSV for Excel compatibility with Traditional Chinese.
 */
export function recordsToCsv(records: DrawRecord[]): string {
  const headers = ['時間', '搶標項目', '得標者 ID', '得標金額', '金額單位', '結果等級', '當輪最低價', '當輪最高價', '同步狀態'];
  const tierLabels: Record<AmountTier, string> = {
    min: '幸運最低價',
    max: '最高價買單',
    normal: '一般金額',
  };

  const escapeCell = (val: string | number) => {
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = records.map((r) => [
    new Date(r.timestamp).toLocaleString('zh-TW'),
    r.itemName || '未指定項目',
    r.winnerId,
    r.amount,
    r.currencyUnit || '天幣',
    tierLabels[r.tier],
    r.poolMin,
    r.poolMax,
    r.syncedToGitHub ? '已同步 GitHub' : '本機模擬',
  ]);

  return '\uFEFF' + [headers, ...rows].map((row) => row.map(escapeCell).join(',')).join('\n');
}

