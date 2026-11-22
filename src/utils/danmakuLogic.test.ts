import { describe, expect, it } from 'vitest';
import {
  checkDanmakuCooldown,
  generateRoomCode,
  normalizeRoomCode,
  pickDanmakuTrack,
  sanitizeDanmakuText,
} from './danmakuLogic';

describe('danmakuLogic', () => {
  it('sanitizes whitespace, newlines, and caps length at 40 characters', () => {
    expect(sanitizeDanmakuText('  歐皇\n\n降臨   啦！  ')).toBe('歐皇 降臨 啦！');
    const longText = '測'.repeat(60);
    expect(Array.from(sanitizeDanmakuText(longText))).toHaveLength(40);
    expect(sanitizeDanmakuText('   \n\t  ')).toBe('');
  });

  it('enforces anti-spam cooldown cleanly', () => {
    expect(checkDanmakuCooldown(0, 1000)).toEqual({ allowed: true, remainingMs: 0 });
    expect(checkDanmakuCooldown(1000, 1800, 1500)).toEqual({ allowed: false, remainingMs: 700 });
    expect(checkDanmakuCooldown(1000, 2500, 1500)).toEqual({ allowed: true, remainingMs: 0 });
  });

  it('picks the least-busy track to avoid overlapping danmaku', () => {
    const now = 5000;
    expect(pickDanmakuTrack([7000, 4000, 6000, 3000], now)).toBe(3);
    expect(pickDanmakuTrack([6500, 5800, 6200], now)).toBe(1);
  });

  it('generates readable 6-char room codes and parses invite URLs', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[A-Z2-9]{6}$/);
    expect(normalizeRoomCode('https://kevin1688.github.io/sm_club/?room=sm888')).toBe('SM888');
    expect(normalizeRoomCode('  abc-123  ')).toBe('ABC-123');
  });
});
