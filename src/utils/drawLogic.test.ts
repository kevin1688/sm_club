import { describe, expect, it } from 'vitest';
import {
  classifyAmountTier,
  computeTargetRotation,
  formatAmount,
  getSliceIndexAtPointer,
  mergeDrawRecords,
  parseAmountInput,
  parseParticipantInput,
  recordsToCsv,
  removeOneAtIndex,
} from './drawLogic';
import type { DrawRecord } from '../types';

describe('drawLogic', () => {
  it('parses participant IDs across newlines, commas, and Chinese separators', () => {
    expect(parseParticipantInput('Alice\nBob, Charlie，David、Eve\n  ')).toEqual([
      'Alice',
      'Bob',
      'Charlie',
      'David',
      'Eve',
    ]);
  });

  it('parses amounts flexibly including NT$ prefix, thousands commas, and Chinese units', () => {
    expect(parseAmountInput('NT$1,200\n$500\n100天幣, 250新台幣, 100')).toEqual([
      1200, 500, 100, 250, 100,
    ]);
  });

  it('formats prefix and Chinese currency units cleanly', () => {
    expect(formatAmount(1800, 'NT$')).toBe('NT$ 1,800');
    expect(formatAmount(1800, '天幣')).toBe('1,800 天幣');
    expect(formatAmount(1800, '新台幣')).toBe('1,800 新台幣');
  });

  it('classifies min, max, and normal amounts accurately', () => {
    const pool = [150, 500, 880, 1200];
    expect(classifyAmountTier(150, pool).tier).toBe('min');
    expect(classifyAmountTier(1200, pool).tier).toBe('max');
    expect(classifyAmountTier(500, pool).tier).toBe('normal');

    // Single unique amount should not trigger special min/max tier
    expect(classifyAmountTier(500, [500, 500]).tier).toBe('normal');
  });

  it('lands accurately on every target slice index under top pointer', () => {
    for (const itemCount of [2, 3, 5, 8, 12]) {
      for (let target = 0; target < itemCount; target += 1) {
        const finalRot = computeTargetRotation(1.23, target, itemCount, 6, 0.5);
        expect(finalRot).toBeGreaterThan(1.23 + 5 * Math.PI * 2);
        expect(getSliceIndexAtPointer(finalRot, itemCount)).toBe(target);
      }
    }
  });

  it('removes only one instance at the specified index', () => {
    expect(removeOneAtIndex([100, 200, 100], 0)).toEqual([200, 100]);
  });

  it('merges local and remote records without duplicates and sorts newest first', () => {
    const local: DrawRecord[] = [
      {
        id: 'rec_2',
        timestamp: '2026-11-21T12:10:00+08:00',
        itemName: '烈焰之魂',
        winnerId: 'Bob',
        amount: 100,
        tier: 'min',
        poolMin: 100,
        poolMax: 1000,
        participantCount: 4,
        amountCount: 4,
        syncedToGitHub: false,
      },
      {
        id: 'rec_1',
        timestamp: '2026-11-21T12:00:00+08:00',
        itemName: '烈焰之魂',
        winnerId: 'Alice',
        amount: 1000,
        tier: 'max',
        poolMin: 100,
        poolMax: 1000,
        participantCount: 5,
        amountCount: 5,
        syncedToGitHub: false,
      },
    ];
    const remote: DrawRecord[] = [
      {
        id: 'rec_1',
        timestamp: '2026-11-21T12:00:00+08:00',
        itemName: '烈焰之魂',
        winnerId: 'Alice',
        amount: 1000,
        tier: 'max',
        poolMin: 100,
        poolMax: 1000,
        participantCount: 5,
        amountCount: 5,
      },
    ];

    const merged = mergeDrawRecords(local, remote);
    expect(merged).toHaveLength(2);
    expect(merged[0].id).toBe('rec_2');
    expect(merged[0].syncedToGitHub).toBe(false);
    expect(merged[1].id).toBe('rec_1');
    expect(merged[1].syncedToGitHub).toBe(true);
  });

  it('exports UTF-8 BOM CSV with Chinese headers including auction item name and currency unit', () => {
    const csv = recordsToCsv([
      {
        id: 'rec_1',
        timestamp: '2026-11-21T12:00:00.000Z',
        itemName: '烈焰之魂',
        winnerId: 'KAI_01',
        amount: 199,
        currencyUnit: '天幣',
        tier: 'min',
        poolMin: 199,
        poolMax: 1999,
        participantCount: 4,
        amountCount: 4,
        syncedToGitHub: false,
      },
    ]);
    expect(csv.startsWith('\uFEFF時間,搶標項目,得標者 ID,得標金額,金額單位')).toBe(true);
    expect(csv).toContain('烈焰之魂');
    expect(csv).toContain('天幣');
    expect(csv).toContain('KAI_01');
    expect(csv).toContain('幸運最低價');
  });
});

