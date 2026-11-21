import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Disc3,
  Volume2,
  VolumeX,
  Github,
  Users,
  Coins,
  History,
  Sliders,
  Play,
  RotateCcw,
  CheckCircle2,
  ArrowRight,
  HardDrive,
  Cloud,
  Sparkles,
  Crown,
  Flame,
  Gem,
} from 'lucide-react';
import type {
  DrawRecord,
  DrawSettings,
  DrawStageStep,
  GitHubConfig,
  SyncStatus,
  WheelItem,
} from './types';
import {
  classifyAmountTier,
  formatAmount,
  mergeDrawRecords,
  removeOneAtIndex,
} from './utils/drawLogic';
import { soundEngine } from './services/soundEngine';
import {
  detectGitHubPagesRepo,
  fetchGitHubHistory,
  isGitHubReadReady,
  isGitHubWriteReady,
  syncRecordsToGitHub,
} from './services/githubStorage';
import { RouletteWheel } from './components/RouletteWheel';
import { SpecialEffects } from './components/SpecialEffects';
import { PoolEditor } from './components/PoolEditor';
import { HistoryPanel } from './components/HistoryPanel';
import { GitHubSettingsModal } from './components/GitHubSettingsModal';

const STORAGE_KEYS = {
  itemName: 'lpr_item_name_v1',
  participants: 'lpr_participants_v1',
  amounts: 'lpr_amounts_v1',
  settings: 'lpr_settings_v1',
  records: 'lpr_records_v1',
  github: 'lpr_github_config_v1',
};

const SAMPLE_ITEM_NAME = '烈焰之魂';

const SAMPLE_PARTICIPANTS = [
  'KAI_01',
  'MIKA_88',
  'ALEX_TW',
  'LUNA_99',
  'RYAN_07',
  'CHLOE_X',
  'LEO_PRO',
  'YUKI_55',
];

const SAMPLE_AMOUNTS = [100, 280, 450, 600, 750, 920, 1200, 1800];

const DEFAULT_SETTINGS: DrawSettings = {
  removeWinnerAfterDraw: true,
  removeAmountAfterDraw: true,
  soundEnabled: true,
  volume: 0.75,
  autoAdvanceToAmount: true,
};

const DEFAULT_GITHUB_CONFIG: GitHubConfig = {
  owner: 'kevin1688',
  repo: 'sm_club',
  branch: 'main',
  filePath: 'data/history.json',
  token: '',
  autoSync: false,
};

function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function App() {
  const [itemName, setItemName] = useState<string>(() =>
    readStorage(STORAGE_KEYS.itemName, SAMPLE_ITEM_NAME)
  );
  const [participants, setParticipants] = useState<string[]>(() =>
    readStorage(STORAGE_KEYS.participants, SAMPLE_PARTICIPANTS)
  );
  const [amounts, setAmounts] = useState<number[]>(() =>
    readStorage(STORAGE_KEYS.amounts, SAMPLE_AMOUNTS)
  );
  const [settings, setSettings] = useState<DrawSettings>(() => ({
    ...DEFAULT_SETTINGS,
    ...readStorage<Partial<DrawSettings>>(STORAGE_KEYS.settings, {}),
  }));
  const [records, setRecords] = useState<DrawRecord[]>(() =>
    readStorage(STORAGE_KEYS.records, [])
  );
  const [githubConfig, setGitHubConfig] = useState<GitHubConfig>(() => {
    const saved = readStorage<Partial<GitHubConfig>>(STORAGE_KEYS.github, {});
    const detected = detectGitHubPagesRepo();
    return {
      ...DEFAULT_GITHUB_CONFIG,
      ...(detected && !saved.owner && !saved.repo ? detected : {}),
      ...saved,
    };
  });

  const [activeTab, setActiveTab] = useState<'pool' | 'history'>('pool');
  const [stage, setStage] = useState<DrawStageStep>('ready-participant');
  const [spinRequestId, setSpinRequestId] = useState<number>(0);

  const [lockedWinner, setLockedWinner] = useState<{ id: string; index: number } | null>(null);
  const [latestRecord, setLatestRecord] = useState<DrawRecord | null>(null);
  const [showResultOverlay, setShowResultOverlay] = useState(false);

  const [githubModalOpen, setGitHubModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local-only');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );

  const autoAdvanceTimerRef = useRef<number | null>(null);
  const recordsRef = useRef(records);
  recordsRef.current = records;

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.itemName, JSON.stringify(itemName));
  }, [itemName]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.participants, JSON.stringify(participants));
  }, [participants]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.amounts, JSON.stringify(amounts));
  }, [amounts]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    soundEngine.configure(settings.soundEnabled, settings.volume);
  }, [settings]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.records, JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.github, JSON.stringify(githubConfig));
  }, [githubConfig]);

  // Auto-load public GitHub history on initial mount when repo is known
  const initialPullDoneRef = useRef(false);
  useEffect(() => {
    if (initialPullDoneRef.current) return;
    if (!isGitHubReadReady(githubConfig)) return;
    initialPullDoneRef.current = true;
    void fetchGitHubHistory(githubConfig)
      .then(({ records: remote }) => {
        if (remote.length > 0) {
          setRecords((prev) => mergeDrawRecords(prev, remote));
        }
      })
      .catch(() => {
        // Silently keep local records if offline or repo is private without token
      });
  }, [githubConfig]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
      }
    };
  }, []);

  const showToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    setToast({ type, text });
  }, []);

  const isSpinning = stage === 'spinning-participant' || stage === 'spinning-amount';
  const wheelMode: 'participant' | 'amount' =
    stage === 'ready-participant' || stage === 'spinning-participant' ? 'participant' : 'amount';

  // Build wheel items with MIN/MAX badges for amount mode
  const wheelItems: WheelItem[] = useMemo(() => {
    if (wheelMode === 'participant') {
      return participants.map((pid, idx) => ({
        id: `p-${idx}-${pid}`,
        label: pid,
        rawValue: pid,
      }));
    }

    const unique = Array.from(new Set(amounts));
    const hasMinMax = unique.length >= 2;
    const minVal = hasMinMax ? Math.min(...amounts) : null;
    const maxVal = hasMinMax ? Math.max(...amounts) : null;

    return amounts.map((amt, idx) => ({
      id: `a-${idx}-${amt}`,
      label: formatAmount(amt),
      rawValue: amt,
      badge:
        hasMinMax && amt === minVal
          ? 'min'
          : hasMinMax && amt === maxVal
            ? 'max'
            : undefined,
    }));
  }, [wheelMode, participants, amounts]);

  const wheelAccentMode: 'default' | 'min' | 'max' =
    stage === 'result-revealed' && latestRecord
      ? latestRecord.tier === 'min'
        ? 'min'
        : latestRecord.tier === 'max'
          ? 'max'
          : 'default'
      : 'default';

  const canStartDraw =
    !isSpinning &&
    (stage === 'ready-participant'
      ? participants.length > 0 && amounts.length > 0
      : stage === 'participant-locked'
        ? amounts.length > 0
        : participants.length > 0 && amounts.length > 0);

  const performGitHubSync = useCallback(
    async (config: GitHubConfig, targetRecords: DrawRecord[], customMsg?: string) => {
      if (!isGitHubWriteReady(config)) {
        setSyncStatus('local-only');
        return;
      }
      setSyncStatus('syncing');
      setSyncError(null);
      try {
        const merged = await syncRecordsToGitHub(config, targetRecords, customMsg);
        setRecords(merged);
        setSyncStatus('synced');
        showToast('success', `已成功同步 ${merged.length} 筆歷史紀錄至 GitHub！`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'GitHub 同步失敗';
        setSyncStatus('error');
        setSyncError(msg);
        showToast('error', msg);
      }
    },
    [showToast]
  );

  const handlePullFromGitHub = useCallback(async () => {
    if (!isGitHubReadReady(githubConfig)) {
      setGitHubModalOpen(true);
      return;
    }
    setSyncStatus('syncing');
    setSyncError(null);
    try {
      const { records: remote } = await fetchGitHubHistory(githubConfig);
      const merged = mergeDrawRecords(recordsRef.current, remote);
      setRecords(merged);
      setSyncStatus(merged.every((r) => r.syncedToGitHub) ? 'synced' : 'local-only');
      showToast('success', `已從 GitHub 拉取雲端紀錄（目前合計 ${merged.length} 筆）。`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '無法從 GitHub 讀取紀錄';
      setSyncStatus('error');
      setSyncError(msg);
      showToast('error', msg);
    }
  }, [githubConfig, showToast]);

  const handleResetToParticipantStage = useCallback(() => {
    if (autoAdvanceTimerRef.current !== null) {
      window.clearTimeout(autoAdvanceTimerRef.current);
      autoAdvanceTimerRef.current = null;
    }
    setShowResultOverlay(false);
    setLockedWinner(null);
    setLatestRecord(null);
    setStage('ready-participant');
  }, []);

  const handleTriggerSpin = useCallback(() => {
    if (isSpinning) return;

    if (stage === 'result-revealed') {
      handleResetToParticipantStage();
      return;
    }

    if (stage === 'ready-participant') {
      if (participants.length === 0) {
        showToast('info', '請先在右側新增至少一位人物 ID！');
        setActiveTab('pool');
        return;
      }
      if (amounts.length === 0) {
        showToast('info', '請先在右側新增至少一個抽獎金額！');
        setActiveTab('pool');
        return;
      }
      setSpinRequestId((id) => id + 1);
      return;
    }

    if (stage === 'participant-locked') {
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
      if (amounts.length === 0) {
        showToast('info', '金額池已空，請先補充金額！');
        setActiveTab('pool');
        return;
      }
      setSpinRequestId((id) => id + 1);
    }
  }, [
    isSpinning,
    stage,
    participants.length,
    amounts.length,
    handleResetToParticipantStage,
    showToast,
  ]);

  // Keyboard shortcut: Space to spin when no input/modal is focused
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || githubModalOpen || showResultOverlay) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'BUTTON' ||
          target.isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      handleTriggerSpin();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [githubModalOpen, showResultOverlay, handleTriggerSpin]);

  const handleSpinStart = useCallback(() => {
    setStage((prev) =>
      prev === 'ready-participant' ? 'spinning-participant' : 'spinning-amount'
    );
  }, []);

  const handleSpinComplete = useCallback(
    (selectedIndex: number, item: WheelItem) => {
      if (wheelMode === 'participant') {
        const winnerId = String(item.rawValue);
        setLockedWinner({ id: winnerId, index: selectedIndex });
        setStage('participant-locked');
        soundEngine.playParticipantLocked();

        if (settings.autoAdvanceToAmount && amounts.length > 0) {
          autoAdvanceTimerRef.current = window.setTimeout(() => {
            autoAdvanceTimerRef.current = null;
            setSpinRequestId((id) => id + 1);
          }, 1150);
        }
        return;
      }

      // Amount spin completed -> Reveal Winner × Amount
      const drawnAmount = Number(item.rawValue);
      const winnerId = lockedWinner?.id ?? '未知得標者';
      const { tier, poolMin, poolMax } = classifyAmountTier(drawnAmount, amounts);

      if (tier === 'min') {
        soundEngine.playLuckyMinFanfare();
      } else if (tier === 'max') {
        soundEngine.playMaxPriceDrama();
      } else {
        soundEngine.playNormalResult();
      }

      const resolvedItemName = itemName.trim() || '未指定項目';

      const newRecord: DrawRecord = {
        id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        itemName: resolvedItemName,
        winnerId,
        amount: drawnAmount,
        tier,
        poolMin,
        poolMax,
        participantCount: participants.length,
        amountCount: amounts.length,
        syncedToGitHub: false,
      };

      const nextRecords = [newRecord, ...recordsRef.current];
      setRecords(nextRecords);
      setLatestRecord(newRecord);
      setStage('result-revealed');
      setShowResultOverlay(true);

      // Apply removal toggle settings
      if (settings.removeWinnerAfterDraw && lockedWinner) {
        setParticipants((prev) => removeOneAtIndex(prev, lockedWinner.index));
      }
      if (settings.removeAmountAfterDraw) {
        setAmounts((prev) => removeOneAtIndex(prev, selectedIndex));
      }

      // Auto-sync to GitHub if configured & enabled, otherwise stay local simulation
      if (githubConfig.autoSync && isGitHubWriteReady(githubConfig)) {
        void performGitHubSync(
          githubConfig,
          nextRecords,
          `chore(draw): [${resolvedItemName}] ${winnerId} won ${formatAmount(drawnAmount)} (${tier})`
        );
      } else {
        setSyncStatus('local-only');
        setSyncError(null);
      }
    },
    [
      wheelMode,
      itemName,
      settings.autoAdvanceToAmount,
      settings.removeWinnerAfterDraw,
      settings.removeAmountAfterDraw,
      amounts,
      participants.length,
      lockedWinner,
      githubConfig,
      performGitHubSync,
    ]
  );

  const handleSaveGitHubConfig = (next: GitHubConfig, syncNow: boolean) => {
    setGitHubConfig(next);
    setGitHubModalOpen(false);
    if (syncNow && isGitHubWriteReady(next)) {
      void performGitHubSync(next, recordsRef.current, 'chore(draw): batch upload local simulation records');
    } else {
      showToast('info', 'GitHub 設定已儲存於本機瀏覽器。');
    }
  };

  const handleLoadSampleData = () => {
    setItemName(SAMPLE_ITEM_NAME);
    setParticipants([...SAMPLE_PARTICIPANTS]);
    setAmounts([...SAMPLE_AMOUNTS]);
    handleResetToParticipantStage();
    showToast('info', `已載入搶標項目「${SAMPLE_ITEM_NAME}」、8 位模擬人物與 8 組金額。`);
  };

  const unsyncedCount = useMemo(
    () => records.filter((r) => !r.syncedToGitHub).length,
    [records]
  );

  const primaryActionLabel =
    stage === 'spinning-participant'
      ? '人物輪盤旋轉中...'
      : stage === 'spinning-amount'
        ? '金額輪盤旋轉中...'
        : stage === 'participant-locked'
          ? settings.autoAdvanceToAmount
            ? '即將開抽金額（點此立即旋轉）'
            : '開始抽獎金額'
          : stage === 'result-revealed'
            ? '準備下一輪抽獎'
            : '開始抽獎（第一步：抽人物）';

  const currentStepNumber =
    stage === 'ready-participant' || stage === 'spinning-participant'
      ? 1
      : stage === 'participant-locked' || stage === 'spinning-amount'
        ? 2
        : 3;

  return (
    <div className="min-h-screen bg-[#0F0F23] text-[#E2E8F0] relative overflow-x-hidden">
      {/* Subtle Ambient Background Gradients */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(124,58,237,0.16),transparent_50%),radial-gradient(ellipse_at_bottom_right,rgba(244,63,94,0.12),transparent_50%)]"
      />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-[#4C1D95]/45 bg-[#0F0F23]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#A78BFA]/40 bg-gradient-to-br from-[#7C3AED] to-[#4C1D95] text-white shadow-[0_0_20px_rgba(124,58,237,0.45)]">
              <Disc3 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-lg sm:text-xl leading-tight text-white">
                LUCKY PRICE ROULETTE
              </h1>
              <p className="text-[11px] font-medium text-[#94A3B8]">
                雙階段人物 × 金額輪盤抽獎系統
              </p>
            </div>
          </div>

          {/* Right Controls: Sound + GitHub Status */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Sound Toggle + Volume */}
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#1E1C35]/90 px-2 py-1">
              <button
                type="button"
                onClick={() =>
                  setSettings((s) => ({ ...s, soundEnabled: !s.soundEnabled }))
                }
                aria-label={settings.soundEnabled ? '關閉輪盤音效' : '開啟輪盤音效'}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-[#E2E8F0] transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
              >
                {settings.soundEnabled ? (
                  <Volume2 className="h-4 w-4 text-[#A78BFA]" aria-hidden="true" />
                ) : (
                  <VolumeX className="h-4 w-4 text-[#94A3B8]" aria-hidden="true" />
                )}
              </button>
              <label htmlFor="volume-slider" className="sr-only">
                音效音量
              </label>
              <input
                id="volume-slider"
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.soundEnabled ? settings.volume : 0}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setSettings((s) => ({
                    ...s,
                    volume: v,
                    soundEnabled: v > 0,
                  }));
                }}
                className="hidden sm:block w-20 accent-[#7C3AED] cursor-pointer"
              />
            </div>

            {/* GitHub Sync Button */}
            <button
              type="button"
              onClick={() => setGitHubModalOpen(true)}
              className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-[#7C3AED]/55 bg-[#1E1C35] px-3.5 py-2 text-xs font-bold text-white transition-colors duration-200 hover:bg-[#2A264A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
            >
              <Github className="h-4 w-4 text-[#C4B5FD]" aria-hidden="true" />
              <span className="hidden sm:inline">
                {isGitHubWriteReady(githubConfig) ? 'GitHub 已連接' : '本機模擬 / GitHub 設定'}
              </span>
              {isGitHubWriteReady(githubConfig) ? (
                <Cloud className="h-4 w-4 text-[#34D399]" aria-hidden="true" />
              ) : (
                <HardDrive className="h-4 w-4 text-[#FBBF24]" aria-hidden="true" />
              )}
              {unsyncedCount > 0 && (
                <span className="rounded-full bg-[#F59E0B] px-1.5 py-0.5 text-[10px] font-black text-[#0F0F23] tabular-nums">
                  {unsyncedCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-5 right-5 z-40 max-w-sm rounded-xl border px-4 py-3 text-xs font-semibold shadow-2xl backdrop-blur-md animate-reveal-pop ${
            toast.type === 'success'
              ? 'border-[#10B981]/60 bg-[#0D2B24]/95 text-[#D1FAE5]'
              : toast.type === 'error'
                ? 'border-[#F43F5E]/60 bg-[#2E0F1B]/95 text-[#FFE4E6]'
                : 'border-[#7C3AED]/60 bg-[#1E1C35]/95 text-[#EDE9FE]'
          }`}
        >
          {toast.text}
        </div>
      )}

      {/* Main Responsive Bento Container */}
      <main className="relative z-10 mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
        {/* Step Progress Strip */}
        <div className="mb-6 flex flex-wrap items-center justify-center gap-2 sm:gap-4">
          {[
            { step: 1, title: 'STEP 1 抽人物 ID', icon: Users },
            { step: 2, title: 'STEP 2 抽得標金額', icon: Coins },
            { step: 3, title: 'STEP 3 動畫揭曉與紀錄', icon: CheckCircle2 },
          ].map((item, idx) => {
            const Icon = item.icon;
            const active = currentStepNumber === item.step;
            const done = currentStepNumber > item.step;
            return (
              <React.Fragment key={item.step}>
                <div
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold transition-all duration-200 ${
                    active
                      ? 'border-[#A78BFA] bg-[#7C3AED]/30 text-white shadow-[0_0_20px_rgba(124,58,237,0.35)]'
                      : done
                        ? 'border-[#10B981]/50 bg-[#10B981]/15 text-[#6EE7B7]'
                        : 'border-white/10 bg-[#1E1C35]/60 text-[#94A3B8]'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{item.title}</span>
                </div>
                {idx < 2 && (
                  <ArrowRight
                    className="hidden sm:block h-4 w-4 text-[#4C1D95]"
                    aria-hidden="true"
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* LEFT STAGE: Roulette Arena (7 cols) */}
          <section
            aria-label="輪盤抽獎主舞台"
            className="arcade-stage rounded-2xl p-5 sm:p-7 lg:col-span-7 flex flex-col items-center"
          >
            {/* Target Auction Item Banner */}
            <div className="mb-3 flex w-full items-center justify-between gap-3 rounded-xl border border-[#F43F5E]/45 bg-gradient-to-r from-[#F43F5E]/15 via-[#7C3AED]/15 to-[#0F0F23]/80 px-4 py-2.5">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F43F5E]/20 text-[#FB7185]">
                  <Gem className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#FECDD3]">
                    本次搶標項目
                  </div>
                  <div className="truncate font-display text-base sm:text-lg text-white">
                    {itemName.trim() || '未指定項目（請於右側輸入）'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={isSpinning}
                onClick={() => {
                  setActiveTab('pool');
                  window.setTimeout(() => {
                    document.getElementById('auction-item-input')?.focus();
                  }, 50);
                }}
                className="shrink-0 cursor-pointer rounded-lg border border-white/15 bg-[#0F0F23]/70 px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] transition-colors hover:border-[#FB7185]/60 hover:text-white disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
              >
                更換項目
              </button>
            </div>

            {/* Current Round Matchup Scoreboard */}
            <div className="mb-5 grid w-full grid-cols-2 gap-3">
              <div
                className={`rounded-xl border px-4 py-3 transition-all duration-200 ${
                  lockedWinner
                    ? 'border-[#A78BFA]/70 bg-[#7C3AED]/20 shadow-[0_0_24px_rgba(124,58,237,0.25)]'
                    : 'border-white/10 bg-[#0F0F23]/75'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                  <Users className="h-3.5 w-3.5 text-[#A78BFA]" aria-hidden="true" />
                  <span>本輪得標人物 ID</span>
                </div>
                <div className="mt-1 truncate font-display text-lg sm:text-xl text-white">
                  {lockedWinner ? lockedWinner.id : '待抽出...'}
                </div>
              </div>

              <div
                className={`rounded-xl border px-4 py-3 transition-all duration-200 ${
                  latestRecord
                    ? latestRecord.tier === 'min'
                      ? 'border-[#10B981]/70 bg-[#10B981]/20'
                      : latestRecord.tier === 'max'
                        ? 'border-[#F43F5E]/70 bg-[#F43F5E]/20'
                        : 'border-[#F59E0B]/60 bg-[#F59E0B]/15'
                    : 'border-white/10 bg-[#0F0F23]/75'
                }`}
              >
                <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                  <Coins className="h-3.5 w-3.5 text-[#FBBF24]" aria-hidden="true" />
                  <span>本輪得標金額</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span
                    className={`truncate font-display text-lg sm:text-xl tabular-nums ${
                      latestRecord
                        ? latestRecord.tier === 'min'
                          ? 'text-[#34D399]'
                          : latestRecord.tier === 'max'
                            ? 'text-[#FB7185]'
                            : 'text-[#FDE68A]'
                        : 'text-[#94A3B8]'
                    }`}
                  >
                    {latestRecord ? formatAmount(latestRecord.amount) : '待抽出...'}
                  </span>
                  {latestRecord?.tier === 'min' && (
                    <Crown className="h-4 w-4 shrink-0 text-[#FDE68A]" aria-hidden="true" />
                  )}
                  {latestRecord?.tier === 'max' && (
                    <Flame className="h-4 w-4 shrink-0 text-[#FB7185]" aria-hidden="true" />
                  )}
                </div>
              </div>
            </div>

            {/* Active Mode Badge */}
            <div className="mb-2 flex items-center gap-2 text-xs font-bold">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${
                  wheelMode === 'participant'
                    ? 'bg-[#7C3AED]/25 text-[#DDD6FE] border border-[#7C3AED]/50'
                    : 'bg-[#F59E0B]/20 text-[#FDE68A] border border-[#F59E0B]/50'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {wheelMode === 'participant'
                    ? `人物輪盤模式（剩餘 ${participants.length} 位）`
                    : `金額輪盤模式（剩餘 ${amounts.length} 筆）`}
                </span>
              </span>
            </div>

            {/* The Canvas Roulette Wheel */}
            <RouletteWheel
              items={wheelItems}
              mode={wheelMode}
              isSpinning={isSpinning}
              disabled={!canStartDraw}
              actionLabel={primaryActionLabel}
              accentMode={wheelAccentMode}
              spinRequestId={spinRequestId}
              onSpinStart={handleSpinStart}
              onSpinComplete={handleSpinComplete}
              onTriggerSpin={handleTriggerSpin}
            />

            {/* Primary Stage Controls */}
            <div className="mt-6 flex w-full max-w-md flex-col gap-2.5">
              <button
                type="button"
                disabled={!canStartDraw}
                onClick={handleTriggerSpin}
                className={`flex min-h-[54px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-6 py-3.5 font-display text-base tracking-wide shadow-lg transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0F23] disabled:cursor-not-allowed disabled:opacity-45 ${
                  wheelMode === 'amount' && stage !== 'result-revealed'
                    ? 'bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-[#0F0F23] hover:brightness-110'
                    : stage === 'result-revealed'
                      ? 'bg-gradient-to-r from-[#7C3AED] to-[#6D28D9] text-white hover:brightness-110'
                      : 'bg-gradient-to-r from-[#F43F5E] to-[#E11D48] text-white hover:brightness-110'
                }`}
              >
                {stage === 'result-revealed' ? (
                  <RotateCcw className="h-5 w-5" aria-hidden="true" />
                ) : (
                  <Play className="h-5 w-5 fill-current" aria-hidden="true" />
                )}
                <span>{primaryActionLabel}</span>
              </button>

              <div className="flex items-center justify-between text-[11px] text-[#94A3B8] px-1">
                <span>
                  快捷鍵：按 <kbd className="rounded border border-white/20 bg-white/5 px-1.5 py-0.5 text-[#E2E8F0]">Space</kbd> 旋轉輪盤
                </span>
                {(stage === 'participant-locked' || stage === 'result-revealed') && (
                  <button
                    type="button"
                    onClick={handleResetToParticipantStage}
                    className="cursor-pointer font-semibold text-[#A78BFA] hover:text-white underline-offset-2 hover:underline"
                  >
                    重設本輪狀態
                  </button>
                )}
              </div>
            </div>
          </section>

          {/* RIGHT SIDEBAR: Pool Management & History Tabs (5 cols) */}
          <aside className="arcade-card rounded-2xl p-5 lg:col-span-5">
            {/* Tabs */}
            <div
              role="tablist"
              aria-label="控制面板分頁"
              className="mb-5 grid grid-cols-2 gap-1.5 rounded-xl bg-[#0F0F23] p-1.5 border border-white/10"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'pool'}
                onClick={() => setActiveTab('pool')}
                className={`flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] ${
                  activeTab === 'pool'
                    ? 'bg-[#7C3AED] text-white shadow'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                <Sliders className="h-4 w-4" aria-hidden="true" />
                <span>名單與開關</span>
              </button>

              <button
                type="button"
                role="tab"
                aria-selected={activeTab === 'history'}
                onClick={() => setActiveTab('history')}
                className={`flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] ${
                  activeTab === 'history'
                    ? 'bg-[#7C3AED] text-white shadow'
                    : 'text-[#94A3B8] hover:text-white'
                }`}
              >
                <History className="h-4 w-4" aria-hidden="true" />
                <span>歷史得標紀錄</span>
                <span className="rounded-full bg-black/25 px-2 py-0.5 text-[11px] tabular-nums">
                  {records.length}
                </span>
              </button>
            </div>

            {activeTab === 'pool' ? (
              <PoolEditor
                itemName={itemName}
                participants={participants}
                amounts={amounts}
                settings={settings}
                disabled={isSpinning}
                onUpdateItemName={setItemName}
                onUpdateParticipants={setParticipants}
                onUpdateAmounts={setAmounts}
                onUpdateSettings={(patch) =>
                  setSettings((prev) => ({ ...prev, ...patch }))
                }
                onLoadSampleData={handleLoadSampleData}
              />
            ) : (
              <HistoryPanel
                records={records}
                githubConfig={githubConfig}
                syncStatus={syncStatus}
                onSyncAllToGitHub={() =>
                  void performGitHubSync(
                    githubConfig,
                    records,
                    `chore(draw): sync ${records.length} roulette records`
                  )
                }
                onPullFromGitHub={() => void handlePullFromGitHub()}
                onClearLocalRecords={() => {
                  setRecords([]);
                  setSyncStatus('local-only');
                  showToast('info', '已清空本機模擬歷史紀錄。');
                }}
                onOpenGitHubSettings={() => setGitHubModalOpen(true)}
              />
            )}
          </aside>
        </div>
      </main>

      {/* Special Min/Max/Normal Celebration & Drama Overlay */}
      <SpecialEffects
        record={showResultOverlay ? latestRecord : null}
        syncStatus={syncStatus}
        syncError={syncError}
        onNextRound={handleResetToParticipantStage}
        onClose={() => setShowResultOverlay(false)}
      />

      {/* GitHub Cloud Settings Modal */}
      <GitHubSettingsModal
        open={githubModalOpen}
        config={githubConfig}
        unsyncedCount={unsyncedCount}
        onSave={handleSaveGitHubConfig}
        onClose={() => setGitHubModalOpen(false)}
      />
    </div>
  );
}

export default App;
