import React, { useState } from 'react';
import {
  Users,
  Coins,
  Plus,
  Trash2,
  Sparkles,
  X,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
  Gem,
} from 'lucide-react';
import type { DrawSettings } from '../types';
import { formatAmount, parseAmountInput, parseParticipantInput } from '../utils/drawLogic';

interface PoolEditorProps {
  itemName: string;
  participants: string[];
  amounts: number[];
  settings: DrawSettings;
  disabled: boolean;
  onUpdateItemName: (next: string) => void;
  onUpdateParticipants: (next: string[]) => void;
  onUpdateAmounts: (next: number[]) => void;
  onUpdateSettings: (patch: Partial<DrawSettings>) => void;
  onLoadSampleData: () => void;
}

const CURRENCY_PRESETS = ['新台幣', '天幣', '藍鑽', '金幣', 'NT$'];

export const PoolEditor: React.FC<PoolEditorProps> = ({
  itemName,
  participants,
  amounts,
  settings,
  disabled,
  onUpdateItemName,
  onUpdateParticipants,
  onUpdateAmounts,
  onUpdateSettings,
  onLoadSampleData,
}) => {
  const [participantDraft, setParticipantDraft] = useState('');
  const [amountDraft, setAmountDraft] = useState('');

  const currencyUnit = settings.currencyUnit || '新台幣';
  const uniqueAmounts = Array.from(new Set(amounts));
  const hasMinMax = uniqueAmounts.length >= 2;
  const minAmount = hasMinMax ? Math.min(...amounts) : null;
  const maxAmount = hasMinMax ? Math.max(...amounts) : null;

  const handleAddParticipants = () => {
    const parsed = parseParticipantInput(participantDraft);
    if (parsed.length === 0) return;
    onUpdateParticipants([...participants, ...parsed]);
    setParticipantDraft('');
  };

  const handleAddAmounts = () => {
    const parsed = parseAmountInput(amountDraft);
    if (parsed.length === 0) return;
    onUpdateAmounts([...amounts, ...parsed]);
    setAmountDraft('');
  };

  const removeParticipantAt = (idx: number) => {
    onUpdateParticipants(participants.filter((_, i) => i !== idx));
  };

  const removeAmountAt = (idx: number) => {
    onUpdateAmounts(amounts.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-5">
      {/* Quick Load Demo & Reset */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#4C1D95]/60 bg-[#0F0F23]/70 px-3.5 py-2.5">
        <span className="text-xs font-medium text-[#CBD5E1]">
          支援批次貼上（換行、逗號皆可自動切分）
        </span>
        <button
          type="button"
          disabled={disabled}
          onClick={onLoadSampleData}
          className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 rounded-lg border border-[#7C3AED]/60 bg-[#7C3AED]/15 px-3 py-1.5 text-xs font-semibold text-[#DDD6FE] transition-colors duration-200 hover:bg-[#7C3AED]/30 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          <span>載入模擬範例</span>
        </button>
      </div>

      {/* Section 0: Auction Target Item */}
      <section aria-labelledby="auction-item-heading" className="space-y-2">
        <label
          id="auction-item-heading"
          htmlFor="auction-item-input"
          className="flex items-center gap-2 text-sm font-bold text-white"
        >
          <Gem className="h-4 w-4 text-[#F43F5E]" aria-hidden="true" />
          <span>本次搶標項目</span>
        </label>
        <input
          id="auction-item-input"
          type="text"
          disabled={disabled}
          value={itemName}
          onChange={(e) => onUpdateItemName(e.target.value)}
          placeholder="例如：烈焰之魂、傳說裝備、限定公仔..."
          className="min-h-[44px] w-full rounded-xl border border-[#F43F5E]/50 bg-[#0F0F23] px-3.5 text-sm font-semibold text-white placeholder-[#64748B] transition-colors focus:border-[#FB7185] focus:outline-none focus:ring-2 focus:ring-[#F43F5E]/35 disabled:opacity-50"
        />
      </section>

      {/* Section 1: Participant IDs */}
      <section aria-labelledby="participants-heading" className="space-y-3 border-t border-white/10 pt-5">
        <div className="flex items-center justify-between">
          <h3 id="participants-heading" className="flex items-center gap-2 text-sm font-bold text-white">
            <Users className="h-4 w-4 text-[#A78BFA]" aria-hidden="true" />
            <span>人物 ID 名單</span>
            <span className="rounded-full bg-[#7C3AED]/25 px-2.5 py-0.5 text-xs font-semibold text-[#DDD6FE] tabular-nums">
              {participants.length} 人
            </span>
          </h3>
          {participants.length > 0 && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onUpdateParticipants([])}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-[#FB7185] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>清空</span>
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="participant-batch-input" className="sr-only">
            輸入多個人物 ID
          </label>
          <textarea
            id="participant-batch-input"
            rows={2}
            disabled={disabled}
            value={participantDraft}
            onChange={(e) => setParticipantDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleAddParticipants();
              }
            }}
            placeholder="輸入人物 ID，例如：KAI_01, MIKA_88, 小明（每行一個或逗號分隔）"
            className="w-full rounded-xl border border-[#4C1D95]/70 bg-[#0F0F23] px-3.5 py-2.5 text-sm text-[#E2E8F0] placeholder-[#64748B] transition-colors focus:border-[#A78BFA] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40 disabled:opacity-50"
          />
          <button
            type="button"
            disabled={disabled || !participantDraft.trim()}
            onClick={handleAddParticipants}
            className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#7C3AED] px-4 py-2 text-sm font-bold text-white transition-colors duration-200 hover:bg-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>加入人物 ID</span>
          </button>
        </div>

        {/* Participant Pills */}
        <div className="max-h-36 overflow-y-auto rounded-xl border border-white/10 bg-[#0F0F23]/60 p-2.5">
          {participants.length === 0 ? (
            <p className="py-3 text-center text-xs text-[#94A3B8]">尚未加入任何人物 ID</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {participants.map((pid, idx) => (
                <span
                  key={`${pid}-${idx}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#7C3AED]/45 bg-[#1E1C35] pl-2.5 pr-1 py-1 text-xs font-semibold text-[#E2E8F0]"
                >
                  <span className="max-w-[130px] truncate">{pid}</span>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => removeParticipantAt(idx)}
                    aria-label={`移除人物 ${pid}`}
                    className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[#94A3B8] transition-colors hover:bg-[#F43F5E]/20 hover:text-[#FDA4AF] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#A78BFA]"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Section 2: Amounts Pool */}
      <section aria-labelledby="amounts-heading" className="space-y-3 border-t border-white/10 pt-5">
        <div className="flex items-center justify-between">
          <h3 id="amounts-heading" className="flex items-center gap-2 text-sm font-bold text-white">
            <Coins className="h-4 w-4 text-[#FBBF24]" aria-hidden="true" />
            <span>抽獎金額池</span>
            <span className="rounded-full bg-[#F59E0B]/20 px-2.5 py-0.5 text-xs font-semibold text-[#FDE68A] tabular-nums">
              {amounts.length} 筆
            </span>
          </h3>
          {amounts.length > 0 && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onUpdateAmounts([])}
              className="inline-flex min-h-[36px] cursor-pointer items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-[#FB7185] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              <span>清空</span>
            </button>
          )}
        </div>

        {/* Currency Unit Selector */}
        <div className="space-y-2 rounded-xl border border-white/10 bg-[#0F0F23]/65 p-3">
          <div className="flex items-center justify-between gap-2">
            <label htmlFor="currency-unit-input" className="text-xs font-bold text-[#E2E8F0]">
              價錢單位
            </label>
            <div className="flex flex-wrap gap-1" role="group" aria-label="常用價錢單位快捷選擇">
              {CURRENCY_PRESETS.map((preset) => {
                const active = currencyUnit === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    disabled={disabled}
                    onClick={() => onUpdateSettings({ currencyUnit: preset })}
                    className={`min-h-[30px] cursor-pointer rounded-lg px-2.5 text-[11px] font-bold transition-colors disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FBBF24] ${
                      active
                        ? 'bg-[#F59E0B] text-[#0F0F23]'
                        : 'border border-white/10 bg-[#1E1C35] text-[#CBD5E1] hover:border-[#F59E0B]/60 hover:text-white'
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
            </div>
          </div>
          <input
            id="currency-unit-input"
            type="text"
            disabled={disabled}
            value={settings.currencyUnit}
            onChange={(e) => onUpdateSettings({ currencyUnit: e.target.value })}
            placeholder="自訂單位，例如：新台幣、天幣、萬天幣、藍鑽..."
            className="min-h-[40px] w-full rounded-lg border border-[#4C1D95]/60 bg-[#0F0F23] px-3 text-xs font-semibold text-white placeholder-[#64748B] focus:border-[#FBBF24] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/35 disabled:opacity-50"
          />
        </div>

        {/* Min / Max Live Preview Strip */}
        {hasMinMax && minAmount !== null && maxAmount !== null && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2 rounded-lg border border-[#10B981]/40 bg-[#10B981]/10 px-3 py-2">
              <TrendingDown className="h-4 w-4 shrink-0 text-[#34D399]" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-[11px] text-[#A7F3D0]">幸運最低價特效</div>
                <div className="truncate font-bold text-white tabular-nums">
                  {formatAmount(minAmount, currencyUnit)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-[#F43F5E]/40 bg-[#F43F5E]/10 px-3 py-2">
              <TrendingUp className="h-4 w-4 shrink-0 text-[#FB7185]" aria-hidden="true" />
              <div className="min-w-0">
                <div className="text-[11px] text-[#FECDD3]">最高價買單特效</div>
                <div className="truncate font-bold text-white tabular-nums">
                  {formatAmount(maxAmount, currencyUnit)}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label htmlFor="amount-batch-input" className="sr-only">
            輸入多個抽獎金額
          </label>
          <textarea
            id="amount-batch-input"
            rows={2}
            disabled={disabled}
            value={amountDraft}
            onChange={(e) => setAmountDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                handleAddAmounts();
              }
            }}
            placeholder="輸入多個金額數字，例如：100, 350, 500, 880, 1500（自動判定最大與最小值）"
            className="w-full rounded-xl border border-[#4C1D95]/70 bg-[#0F0F23] px-3.5 py-2.5 text-sm text-[#E2E8F0] placeholder-[#64748B] transition-colors focus:border-[#FBBF24] focus:outline-none focus:ring-2 focus:ring-[#F59E0B]/40 disabled:opacity-50"
          />
          <button
            type="button"
            disabled={disabled || !amountDraft.trim()}
            onClick={handleAddAmounts}
            className="inline-flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-1.5 rounded-xl bg-[#F59E0B] px-4 py-2 text-sm font-bold text-[#0F0F23] transition-colors duration-200 hover:bg-[#FBBF24] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FDE68A]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>加入抽獎金額</span>
          </button>
        </div>

        {/* Amount Pills */}
        <div className="max-h-36 overflow-y-auto rounded-xl border border-white/10 bg-[#0F0F23]/60 p-2.5">
          {amounts.length === 0 ? (
            <p className="py-3 text-center text-xs text-[#94A3B8]">尚未加入任何金額</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {amounts.map((amt, idx) => {
                const isMin = hasMinMax && amt === minAmount;
                const isMax = hasMinMax && amt === maxAmount;
                return (
                  <span
                    key={`${amt}-${idx}`}
                    className={`inline-flex items-center gap-1 rounded-lg border pl-2.5 pr-1 py-1 text-xs font-bold tabular-nums ${
                      isMin
                        ? 'border-[#10B981]/70 bg-[#10B981]/20 text-[#D1FAE5]'
                        : isMax
                          ? 'border-[#F43F5E]/70 bg-[#F43F5E]/20 text-[#FFE4E6]'
                          : 'border-white/15 bg-[#1E1C35] text-[#E2E8F0]'
                    }`}
                  >
                    <span>{formatAmount(amt, currencyUnit)}</span>
                    {isMin && (
                      <span className="rounded bg-[#10B981]/40 px-1 text-[10px] text-[#FEF08A]">
                        MIN
                      </span>
                    )}
                    {isMax && (
                      <span className="rounded bg-[#F43F5E]/40 px-1 text-[10px] text-[#FFE4E6]">
                        MAX
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => removeAmountAt(idx)}
                      aria-label={`移除金額 ${amt}`}
                      className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-[#CBD5E1] transition-colors hover:bg-black/30 hover:text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#A78BFA]"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Section 3: Draw Rules Toggle Switches (User Requirement #2) */}
      <section aria-labelledby="draw-rules-heading" className="space-y-2.5 border-t border-white/10 pt-5">
        <h3 id="draw-rules-heading" className="flex items-center gap-2 text-sm font-bold text-white">
          <SlidersHorizontal className="h-4 w-4 text-[#A78BFA]" aria-hidden="true" />
          <span>抽獎移除開關設定</span>
        </h3>

        <ToggleRow
          label="人物 ID 抽出後移除"
          description={
            settings.removeWinnerAfterDraw
              ? '已開啟：抽中者將自輪盤移除（不重複得標）'
              : '已關閉：抽中者保留在輪盤中（可重複得標）'
          }
          checked={settings.removeWinnerAfterDraw}
          disabled={disabled}
          onChange={(val) => onUpdateSettings({ removeWinnerAfterDraw: val })}
        />

        <ToggleRow
          label="抽獎金額 抽出後移除"
          description={
            settings.removeAmountAfterDraw
              ? '已開啟：抽出的金額將自獎池移除（不重複）'
              : '已關閉：抽出的金額保留在獎池（可重複抽中）'
          }
          checked={settings.removeAmountAfterDraw}
          disabled={disabled}
          onChange={(val) => onUpdateSettings({ removeAmountAfterDraw: val })}
        />

        <ToggleRow
          label="抽完人物自動切換至金額輪盤"
          description={
            settings.autoAdvanceToAmount
              ? '已開啟：鎖定人物後自動倒數進入金額抽選'
              : '已關閉：鎖定人物後由手動點擊再抽金額'
          }
          checked={settings.autoAdvanceToAmount}
          disabled={disabled}
          onChange={(val) => onUpdateSettings({ autoAdvanceToAmount: val })}
        />
      </section>
    </div>
  );
};

interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({
  label,
  description,
  checked,
  disabled,
  onChange,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="flex min-h-[54px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#0F0F23]/75 px-3.5 py-2.5 text-left transition-colors duration-200 hover:border-[#7C3AED]/60 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
  >
    <div className="min-w-0">
      <div className="text-xs font-bold text-white">{label}</div>
      <div className="mt-0.5 text-[11px] text-[#94A3B8]">{description}</div>
    </div>
    <span
      aria-hidden="true"
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
        checked ? 'bg-[#7C3AED]' : 'bg-[#334155]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </span>
  </button>
);

