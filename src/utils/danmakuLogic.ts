export const DANMAKU_MAX_LENGTH = 40;
export const DANMAKU_COOLDOWN_MS = 1500;
export const DANMAKU_TRACK_COUNT = 7;

export const QUICK_DANMAKU_PRESETS = [
  { label: '歐皇降臨!', color: 'lucky' as const },
  { label: '荷包君保重', color: 'danger' as const },
  { label: '別停這格!', color: 'gold' as const },
  { label: '便宜帶走!', color: 'lucky' as const },
  { label: '感謝大戶!', color: 'danger' as const },
];

/**
 * Sanitize user danmaku text: trim, collapse line breaks / spaces, enforce max length.
 */
export function sanitizeDanmakuText(raw: string, maxLength = DANMAKU_MAX_LENGTH): string {
  const collapsed = raw.replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ').trim();
  if (!collapsed) return '';
  return Array.from(collapsed).slice(0, maxLength).join('');
}

/**
 * Anti-spam cooldown gate for sending danmaku.
 */
export function checkDanmakuCooldown(
  lastSentAt: number,
  now: number,
  cooldownMs = DANMAKU_COOLDOWN_MS
): { allowed: boolean; remainingMs: number } {
  if (lastSentAt <= 0) {
    return { allowed: true, remainingMs: 0 };
  }
  const elapsed = now - lastSentAt;
  if (elapsed >= cooldownMs) {
    return { allowed: true, remainingMs: 0 };
  }
  return { allowed: false, remainingMs: Math.max(0, cooldownMs - elapsed) };
}

/**
 * Pick the best horizontal track to minimize visual overlap across concurrent danmaku messages.
 * `trackFreeAt` holds the epoch timestamp when each track becomes clear for a new bullet.
 */
export function pickDanmakuTrack(trackFreeAt: number[], now: number): number {
  if (trackFreeAt.length === 0) return 0;

  // Prefer the first completely free track (with a slight round-robin feel via earliest free timestamp)
  let bestIdx = 0;
  let earliestFree = trackFreeAt[0];

  for (let i = 0; i < trackFreeAt.length; i += 1) {
    if (trackFreeAt[i] <= now && earliestFree > now) {
      bestIdx = i;
      earliestFree = trackFreeAt[i];
    } else if (trackFreeAt[i] < earliestFree) {
      bestIdx = i;
      earliestFree = trackFreeAt[i];
    }
  }

  return bestIdx;
}

/**
 * Generate a clean 6-character uppercase room code without confusing characters (0/O, 1/I/L).
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * Normalize user-entered room code (supports pasting full invite URL or raw code).
 */
export function normalizeRoomCode(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    if (/^https?:\/\//i.test(trimmed)) {
      const url = new URL(trimmed);
      const roomParam = url.searchParams.get('room');
      if (roomParam) {
        return roomParam.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().slice(0, 16);
      }
    }
  } catch {
    // Fall through to direct sanitization
  }
  return trimmed.replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase().slice(0, 16);
}
