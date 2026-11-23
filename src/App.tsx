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
  Radio,
  Monitor,
  Tv,
  Minimize2,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  type CurrencyUnit,
  type DrawRecord,
  type DrawSettings,
  type DrawStageStep,
  type GitHubConfig,
  type SyncStatus,
  type WheelItem,
} from './types';
import type {
  AppMode,
  DanmakuColor,
  DanmakuKind,
  DanmakuMessage,
  RealtimeConnectionState,
  RoomParticipantPresence,
  RoomRole,
  RoomStateSnapshot,
  SupabaseConfig,
  SyncedSpinCommand,
} from './types/realtime';
import {
  classifyAmountTier,
  formatAmount,
  mergeDrawRecords,
  removeOneAtIndex,
} from './utils/drawLogic';
import { normalizeRoomCode } from './utils/danmakuLogic';
import { soundEngine } from './services/soundEngine';
import {
  detectGitHubPagesRepo,
  fetchGitHubHistory,
  isGitHubReadReady,
  isGitHubWriteReady,
  syncRecordsToGitHub,
} from './services/githubStorage';
import { realtimeRoomService } from './services/realtimeService';
import { RouletteWheel } from './components/RouletteWheel';
import { SpecialEffects } from './components/SpecialEffects';
import { PoolEditor } from './components/PoolEditor';
import { HistoryPanel } from './components/HistoryPanel';
import { GitHubSettingsModal } from './components/GitHubSettingsModal';
import { RoomControlBar } from './components/RoomControlBar';
import { RoomModal } from './components/RoomModal';
import { DanmakuOverlay } from './components/DanmakuOverlay';
import { DanmakuComposer } from './components/DanmakuComposer';
import { DanmakuLiveFeed } from './components/DanmakuLiveFeed';

const STORAGE_KEYS = {
  itemName: 'lpr_item_name_v1',
  participants: 'lpr_participants_v1',
  amounts: 'lpr_amounts_v1',
  settings: 'lpr_settings_v2',
  records: 'lpr_records_v1',
  github: 'lpr_github_config_v1',
  nickname: 'lpr_nickname_v1',
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
  currencyUnit: '天幣',
  removeWinnerAfterDraw: true,
  removeAmountAfterDraw: true,
  soundEnabled: true,
  volume: 0.75,
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

function getInitialRoomCodeFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return normalizeRoomCode(params.get('room') || '');
}

export function App() {
  const initialUrlRoom = useMemo(() => getInitialRoomCodeFromUrl(), []);

  // Dual Mode: 'classic' (100% original solo experience) vs 'live' (Supabase Realtime + Danmaku)
  const [appMode, setAppMode] = useState<AppMode>(initialUrlRoom ? 'live' : 'classic');

  // Local / Host Pool & Settings State
  const [itemName, setItemName] = useState<string>(() =>
    readStorage(STORAGE_KEYS.itemName, SAMPLE_ITEM_NAME)
  );
  const [participants, setParticipants] = useState<string[]>(() =>
    readStorage(STORAGE_KEYS.participants, SAMPLE_PARTICIPANTS)
  );
  const [amounts, setAmounts] = useState<number[]>(() =>
    readStorage(STORAGE_KEYS.amounts, SAMPLE_AMOUNTS)
  );
  const [settings, setSettings] = useState<DrawSettings>(() => {
    const savedV2 = readStorage<Partial<DrawSettings> | null>(STORAGE_KEYS.settings, null);
    if (savedV2) {
      const validUnit: CurrencyUnit =
        typeof savedV2.currencyUnit === 'string' && savedV2.currencyUnit.trim().length > 0
          ? savedV2.currencyUnit
          : DEFAULT_SETTINGS.currencyUnit;
      return {
        ...DEFAULT_SETTINGS,
        ...savedV2,
        currencyUnit: validUnit,
      };
    }
    // Migrate non-currency preferences from v1 while adopting new default '天幣'
    const legacyV1 = readStorage<Partial<DrawSettings>>('lpr_settings_v1', {});
    return {
      ...DEFAULT_SETTINGS,
      removeWinnerAfterDraw:
        legacyV1.removeWinnerAfterDraw ?? DEFAULT_SETTINGS.removeWinnerAfterDraw,
      removeAmountAfterDraw:
        legacyV1.removeAmountAfterDraw ?? DEFAULT_SETTINGS.removeAmountAfterDraw,
      soundEnabled: legacyV1.soundEnabled ?? DEFAULT_SETTINGS.soundEnabled,
      volume: legacyV1.volume ?? DEFAULT_SETTINGS.volume,
      currencyUnit: '天幣',
    };
  });
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

  // Shared Draw Stage State
  const [activeTab, setActiveTab] = useState<'pool' | 'history'>('pool');
  const [stage, setStage] = useState<DrawStageStep>('ready-participant');
  const [spinRequestId, setSpinRequestId] = useState<number>(0);
  const [lockedWinner, setLockedWinner] = useState<{ id: string; index: number } | null>(null);
  const [latestRecord, setLatestRecord] = useState<DrawRecord | null>(null);
  const [showResultOverlay, setShowResultOverlay] = useState(false);

  // GitHub Sync UI State
  const [githubModalOpen, setGitHubModalOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('local-only');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(
    null
  );

  // Live Room (Option A: Supabase Realtime) State
  const [nickname, setNickname] = useState<string>(() =>
    readStorage(STORAGE_KEYS.nickname, '')
  );
  const [roomCode, setRoomCode] = useState<string>('');
  const [roomRole, setRoomRole] = useState<RoomRole>(initialUrlRoom ? 'viewer' : 'host');
  const [roomModalOpen, setRoomModalOpen] = useState<boolean>(Boolean(initialUrlRoom));
  const [roomModalInitialTab, setRoomModalInitialTab] = useState<RoomRole>(
    initialUrlRoom ? 'viewer' : 'host'
  );
  const [connectionState, setConnectionState] =
    useState<RealtimeConnectionState>('disconnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [roomMembers, setRoomMembers] = useState<RoomParticipantPresence[]>([]);
  const [danmakuMessages, setDanmakuMessages] = useState<DanmakuMessage[]>([]);
  const [danmakuVisible, setDanmakuVisible] = useState<boolean>(true);

  // Viewer Mirrored State (kept completely separate from local classic state so leaving room never overwrites user's own lists!)
  const [viewerSnapshot, setViewerSnapshot] = useState<RoomStateSnapshot | null>(null);
  const [externalSpin, setExternalSpin] = useState<SyncedSpinCommand | null>(null);
  const [viewerStage, setViewerStage] = useState<DrawStageStep>('ready-participant');
  const [viewerLockedWinner, setViewerLockedWinner] = useState<{ id: string; index: number } | null>(
    null
  );
  const [viewerLatestRecord, setViewerLatestRecord] = useState<DrawRecord | null>(null);
  const [viewerShowOverlay, setViewerShowOverlay] = useState<boolean>(false);

  // Full-viewport Spotlight mode while wheel spins + brief post-spin reveal beat
  const [spotlightActive, setSpotlightActive] = useState<boolean>(false);
  const [spotlightBanner, setSpotlightBanner] = useState<string | null>(null);

  const recordsRef = useRef(records);
  recordsRef.current = records;
  const activeHostSpinRef = useRef<SyncedSpinCommand | null>(null);
  const pendingViewerResultRef = useRef<DrawRecord | null>(null);
  const viewerAnimatingRef = useRef<boolean>(false);
  const viewerActiveSpinIdRef = useRef<string>('');
  const spotlightExitTimerRef = useRef<number | null>(null);
  const resultOverlayTimerRef = useRef<number | null>(null);

  const isLiveMode = appMode === 'live';
  const isLiveConnected = isLiveMode && Boolean(roomCode) && connectionState === 'connected';
  const isLiveHost = isLiveMode && Boolean(roomCode) && roomRole === 'host';
  const isLiveViewer = isLiveMode && Boolean(roomCode) && roomRole === 'viewer';

  // Persist local preferences & data
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

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.nickname, JSON.stringify(nickname));
  }, [nickname]);

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
        // Keep local records if offline or repo is private without token
      });
  }, [githubConfig]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Cleanup realtime channel & timers on page unmount
  useEffect(() => {
    return () => {
      if (spotlightExitTimerRef.current !== null) {
        window.clearTimeout(spotlightExitTimerRef.current);
      }
      if (resultOverlayTimerRef.current !== null) {
        window.clearTimeout(resultOverlayTimerRef.current);
      }
      void realtimeRoomService.disconnect();
    };
  }, []);

  // Lock background page scroll while Spotlight Cinema Mode is active
  useEffect(() => {
    if (!spotlightActive) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [spotlightActive]);

  const clearSpotlightTimers = useCallback(() => {
    if (spotlightExitTimerRef.current !== null) {
      window.clearTimeout(spotlightExitTimerRef.current);
      spotlightExitTimerRef.current = null;
    }
    if (resultOverlayTimerRef.current !== null) {
      window.clearTimeout(resultOverlayTimerRef.current);
      resultOverlayTimerRef.current = null;
    }
  }, []);

  const exitSpotlightNow = useCallback(() => {
    clearSpotlightTimers();
    setSpotlightActive(false);
    setSpotlightBanner(null);
  }, [clearSpotlightTimers]);

  const showToast = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    setToast({ type, text });
  }, []);

  // Build host snapshot ref so Presence/REQUEST_SYNC always gets freshest state
  const buildHostSnapshot = useCallback((): RoomStateSnapshot => {
    const now = Date.now();
    let activeSpinPayload: SyncedSpinCommand | null = null;
    if (activeHostSpinRef.current) {
      const elapsed = now - activeHostSpinRef.current.startedAt;
      if (elapsed < activeHostSpinRef.current.durationMs) {
        activeSpinPayload = {
          ...activeHostSpinRef.current,
          initialElapsedMs: Math.max(0, elapsed),
        };
      }
    }

    return {
      roomCode,
      hostName: nickname.trim() || '主持人',
      sentAt: now,
      itemName,
      participants,
      amounts,
      currencyUnit: settings.currencyUnit,
      stage,
      lockedWinner,
      latestRecord,
      records: records.slice(0, 60),
      activeSpin: activeSpinPayload,
    };
  }, [
    roomCode,
    nickname,
    itemName,
    participants,
    amounts,
    settings.currencyUnit,
    stage,
    lockedWinner,
    latestRecord,
    records,
  ]);

  const buildHostSnapshotRef = useRef(buildHostSnapshot);
  buildHostSnapshotRef.current = buildHostSnapshot;

  // Broadcast updated state snapshot whenever host changes pool/stage/item/currency
  useEffect(() => {
    if (!isLiveHost || connectionState !== 'connected') return;
    const timer = window.setTimeout(() => {
      void realtimeRoomService.broadcastState(buildHostSnapshotRef.current());
    }, 180);
    return () => window.clearTimeout(timer);
  }, [
    isLiveHost,
    connectionState,
    itemName,
    participants,
    amounts,
    settings.currencyUnit,
    stage,
    lockedWinner,
    latestRecord,
    records,
  ]);

  const appendDanmaku = useCallback((msg: DanmakuMessage) => {
    setDanmakuMessages((prev) => [...prev.slice(-80), msg]);
  }, []);

  const emitSystemDanmaku = useCallback(
    (text: string, kind: DanmakuKind, color: DanmakuColor) => {
      if (!isLiveHost || connectionState !== 'connected') return;
      const msg: DanmakuMessage = {
        id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        senderId: realtimeRoomService.getClientId(),
        senderName: '系統賀報',
        text,
        color,
        kind,
        createdAt: Date.now(),
      };
      appendDanmaku(msg);
      void realtimeRoomService.broadcastDanmaku(msg);
    },
    [isLiveHost, connectionState, appendDanmaku]
  );

  // Effective displayed values (Viewer sees mirrored host state; Classic & Host see local state)
  const displayItemName = isLiveViewer ? (viewerSnapshot?.itemName ?? '等待主持人同步...') : itemName;
  const displayParticipants = isLiveViewer ? (viewerSnapshot?.participants ?? []) : participants;
  const displayAmounts = isLiveViewer ? (viewerSnapshot?.amounts ?? []) : amounts;
  const displayCurrencyUnit: CurrencyUnit = isLiveViewer
    ? (viewerSnapshot?.currencyUnit ?? '天幣')
    : settings.currencyUnit;
  const displayStage: DrawStageStep = isLiveViewer ? viewerStage : stage;
  const displayLockedWinner = isLiveViewer ? viewerLockedWinner : lockedWinner;
  const displayLatestRecord = isLiveViewer ? viewerLatestRecord : latestRecord;
  const displayRecords = isLiveViewer ? (viewerSnapshot?.records ?? records) : records;
  const displayShowOverlay = isLiveViewer ? viewerShowOverlay : showResultOverlay;

  const isSpinning =
    displayStage === 'spinning-participant' || displayStage === 'spinning-amount';
  const wheelMode: 'participant' | 'amount' =
    displayStage === 'ready-participant' || displayStage === 'spinning-participant'
      ? 'participant'
      : 'amount';

  // Build wheel items with MIN/MAX badges for amount mode
  const wheelItems: WheelItem[] = useMemo(() => {
    if (wheelMode === 'participant') {
      return displayParticipants.map((pid, idx) => ({
        id: `p-${idx}-${pid}`,
        label: pid,
        rawValue: pid,
      }));
    }

    const unique = Array.from(new Set(displayAmounts));
    const hasMinMax = unique.length >= 2;
    const minVal = hasMinMax ? Math.min(...displayAmounts) : null;
    const maxVal = hasMinMax ? Math.max(...displayAmounts) : null;

    return displayAmounts.map((amt, idx) => ({
      id: `a-${idx}-${amt}`,
      label: formatAmount(amt, displayCurrencyUnit),
      rawValue: amt,
      badge:
        hasMinMax && amt === minVal
          ? 'min'
          : hasMinMax && amt === maxVal
            ? 'max'
            : undefined,
    }));
  }, [wheelMode, displayParticipants, displayAmounts, displayCurrencyUnit]);

  const wheelAccentMode: 'default' | 'min' | 'max' =
    displayStage === 'result-revealed' && displayLatestRecord
      ? displayLatestRecord.tier === 'min'
        ? 'min'
        : displayLatestRecord.tier === 'max'
          ? 'max'
          : 'default'
      : 'default';

  const canStartDraw =
    !isLiveViewer &&
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
    exitSpotlightNow();
    if (isLiveViewer) {
      setViewerShowOverlay(false);
      return;
    }
    activeHostSpinRef.current = null;
    setShowResultOverlay(false);
    setLockedWinner(null);
    setLatestRecord(null);
    setStage('ready-participant');
    if (isLiveHost && connectionState === 'connected') {
      void realtimeRoomService.broadcastStageReset();
    }
  }, [exitSpotlightNow, isLiveViewer, isLiveHost, connectionState]);

  const handleTriggerSpin = useCallback(() => {
    if (isLiveViewer || isSpinning) return;

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
      if (amounts.length === 0) {
        showToast('info', '金額池已空，請先補充金額！');
        setActiveTab('pool');
        return;
      }
      setSpinRequestId((id) => id + 1);
    }
  }, [
    isLiveViewer,
    isSpinning,
    stage,
    participants.length,
    amounts.length,
    handleResetToParticipantStage,
    showToast,
  ]);

  // Keyboard shortcut: Space to spin when no input/modal is focused (disabled for viewers)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.code !== 'Space' ||
        isLiveViewer ||
        githubModalOpen ||
        roomModalOpen ||
        displayShowOverlay
      ) {
        return;
      }
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
  }, [isLiveViewer, githubModalOpen, roomModalOpen, displayShowOverlay, handleTriggerSpin]);

  const handleSpinStart = useCallback(() => {
    clearSpotlightTimers();
    setSpotlightBanner(null);
    setSpotlightActive(true);
    if (isLiveViewer) {
      viewerAnimatingRef.current = true;
      setViewerStage((prev) =>
        prev === 'ready-participant' ? 'spinning-participant' : 'spinning-amount'
      );
      return;
    }
    setStage((prev) =>
      prev === 'ready-participant' ? 'spinning-participant' : 'spinning-amount'
    );
  }, [clearSpotlightTimers, isLiveViewer]);

  const handleHostSpinDispatched = useCallback(
    (command: SyncedSpinCommand) => {
      if (!isLiveHost || connectionState !== 'connected') return;
      activeHostSpinRef.current = command;
      void realtimeRoomService.broadcastSpinStart({
        ...command,
        initialElapsedMs: 0,
      });
    },
    [isLiveHost, connectionState]
  );

  const handleSpinComplete = useCallback(
    (selectedIndex: number, item: WheelItem) => {
      const prefersReduced =
        typeof window !== 'undefined' &&
        window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const stage1HoldMs = prefersReduced ? 350 : 1450;
      const stage2HoldMs = prefersReduced ? 250 : 800;

      // Viewer finished synced wheel animation
      if (isLiveViewer) {
        viewerAnimatingRef.current = false;
        if (wheelMode === 'participant') {
          const winnerId = String(item.rawValue);
          setViewerLockedWinner({ id: winnerId, index: selectedIndex });
          setViewerStage('participant-locked');
          soundEngine.playParticipantLocked();
          setSpotlightBanner(`鎖定得標者：${winnerId}`);
          spotlightExitTimerRef.current = window.setTimeout(() => {
            spotlightExitTimerRef.current = null;
            setSpotlightActive(false);
            setSpotlightBanner(null);
          }, stage1HoldMs);
          return;
        }

        const hostRec = pendingViewerResultRef.current;
        const drawnAmount = hostRec ? hostRec.amount : Number(item.rawValue);
        const winnerId = hostRec ? hostRec.winnerId : viewerLockedWinner?.id ?? '未知得標者';
        const { tier, poolMin, poolMax } = hostRec
          ? { tier: hostRec.tier, poolMin: hostRec.poolMin, poolMax: hostRec.poolMax }
          : classifyAmountTier(drawnAmount, displayAmounts);

        const revealed: DrawRecord = hostRec ?? {
          id: `vrec_${Date.now()}`,
          timestamp: new Date().toISOString(),
          itemName: displayItemName,
          winnerId,
          amount: drawnAmount,
          currencyUnit: displayCurrencyUnit,
          tier,
          poolMin,
          poolMax,
          participantCount: displayParticipants.length,
          amountCount: displayAmounts.length,
        };
        pendingViewerResultRef.current = null;
        setViewerLatestRecord(revealed);
        setViewerStage('result-revealed');
        setSpotlightBanner(
          `${winnerId} × ${formatAmount(drawnAmount, revealed.currencyUnit)}`
        );

        resultOverlayTimerRef.current = window.setTimeout(() => {
          resultOverlayTimerRef.current = null;
          if (tier === 'min') {
            soundEngine.playLuckyMinFanfare();
          } else if (tier === 'max') {
            soundEngine.playMaxPriceDrama();
          } else {
            soundEngine.playNormalResult();
          }
          setSpotlightActive(false);
          setSpotlightBanner(null);
          setViewerShowOverlay(true);
        }, stage2HoldMs);
        return;
      }

      // Classic or Live Host spin completion
      activeHostSpinRef.current = null;

      if (wheelMode === 'participant') {
        const winnerId = String(item.rawValue);
        setLockedWinner({ id: winnerId, index: selectedIndex });
        setStage('participant-locked');
        soundEngine.playParticipantLocked();
        showToast('info', `已鎖定得標者「${winnerId}」，請手動點擊開始抽金額！`);
        emitSystemDanmaku(`人物揭曉！本輪由「${winnerId}」進入金額抽選！`, 'system-info', 'gold');
        setSpotlightBanner(`鎖定得標者：${winnerId}`);
        spotlightExitTimerRef.current = window.setTimeout(() => {
          spotlightExitTimerRef.current = null;
          setSpotlightActive(false);
          setSpotlightBanner(null);
        }, stage1HoldMs);
        return;
      }

      // Amount spin completed -> Reveal Winner × Amount
      const drawnAmount = Number(item.rawValue);
      const winnerId = lockedWinner?.id ?? '未知得標者';
      const { tier, poolMin, poolMax } = classifyAmountTier(drawnAmount, amounts);

      const resolvedItemName = itemName.trim() || '未指定項目';
      const resolvedUnit = settings.currencyUnit.trim() || '天幣';

      const newRecord: DrawRecord = {
        id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date().toISOString(),
        itemName: resolvedItemName,
        winnerId,
        amount: drawnAmount,
        currencyUnit: resolvedUnit,
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
      setSpotlightBanner(`${winnerId} × ${formatAmount(drawnAmount, resolvedUnit)}`);

      // Brief dramatic beat on the landed slice before launching full-screen result celebration
      resultOverlayTimerRef.current = window.setTimeout(() => {
        resultOverlayTimerRef.current = null;
        if (tier === 'min') {
          soundEngine.playLuckyMinFanfare();
        } else if (tier === 'max') {
          soundEngine.playMaxPriceDrama();
        } else {
          soundEngine.playNormalResult();
        }
        setSpotlightActive(false);
        setSpotlightBanner(null);
        setShowResultOverlay(true);
      }, stage2HoldMs);

      // Broadcast finalized result + celebration danmaku when hosting
      if (isLiveHost && connectionState === 'connected') {
        void realtimeRoomService.broadcastSpinResult(newRecord);
        const formattedPrice = formatAmount(drawnAmount, resolvedUnit);
        if (tier === 'min') {
          emitSystemDanmaku(
            `歐皇降臨！「${winnerId}」以最低價 ${formattedPrice} 便宜帶走「${resolvedItemName}」！`,
            'system-min',
            'lucky'
          );
        } else if (tier === 'max') {
          emitSystemDanmaku(
            `荷包警報！感謝大戶「${winnerId}」以最高價 ${formattedPrice} 拿下「${resolvedItemName}」！`,
            'system-max',
            'danger'
          );
        } else {
          emitSystemDanmaku(
            `恭喜「${winnerId}」以 ${formattedPrice} 得標「${resolvedItemName}」！`,
            'system-info',
            'gold'
          );
        }
      }

      // Apply removal toggle settings
      if (settings.removeWinnerAfterDraw && lockedWinner) {
        setParticipants((prev) => removeOneAtIndex(prev, lockedWinner.index));
      }
      if (settings.removeAmountAfterDraw) {
        setAmounts((prev) => removeOneAtIndex(prev, selectedIndex));
      }

      // Auto-sync to GitHub (Host / Classic only — never viewers)
      if (githubConfig.autoSync && isGitHubWriteReady(githubConfig)) {
        void performGitHubSync(
          githubConfig,
          nextRecords,
          `chore(draw): [${resolvedItemName}] ${winnerId} won ${formatAmount(drawnAmount, resolvedUnit)} (${tier})`
        );
      } else {
        setSyncStatus('local-only');
        setSyncError(null);
      }
    },
    [
      isLiveViewer,
      isLiveHost,
      connectionState,
      wheelMode,
      viewerLockedWinner,
      displayAmounts,
      displayItemName,
      displayCurrencyUnit,
      displayParticipants.length,
      itemName,
      settings.currencyUnit,
      settings.removeWinnerAfterDraw,
      settings.removeAmountAfterDraw,
      amounts,
      participants.length,
      lockedWinner,
      githubConfig,
      performGitHubSync,
      showToast,
      emitSystemDanmaku,
    ]
  );

  // Room Connection Handlers (Option A: Supabase Realtime)
  const updateUrlRoomParam = (code: string | null) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (code) {
      url.searchParams.set('room', code);
    } else {
      url.searchParams.delete('room');
    }
    window.history.replaceState({}, '', url.toString());
  };

  const handleLeaveRoom = useCallback(
    async (switchToClassic = false) => {
      await realtimeRoomService.disconnect();
      exitSpotlightNow();
      activeHostSpinRef.current = null;
      pendingViewerResultRef.current = null;
      viewerAnimatingRef.current = false;
      viewerActiveSpinIdRef.current = '';
      setRoomCode('');
      setConnectionState('disconnected');
      setConnectionError(null);
      setRoomMembers([]);
      setDanmakuMessages([]);
      setViewerSnapshot(null);
      setExternalSpin(null);
      setViewerShowOverlay(false);
      setViewerStage('ready-participant');
      setViewerLockedWinner(null);
      setViewerLatestRecord(null);
      updateUrlRoomParam(null);
      if (switchToClassic) {
        setAppMode('classic');
        showToast('info', '已切換回經典單機模式，所有本機名單與紀錄完整保留。');
      } else {
        showToast('info', '已離開即時連線房。');
      }
    },
    [showToast]
  );

  const handleJoinOrCreateRoom = async ({
    role,
    roomCode: chosenCode,
    nickname: chosenNickname,
    supabaseConfig,
  }: {
    role: RoomRole;
    roomCode: string;
    nickname: string;
    supabaseConfig: SupabaseConfig;
  }) => {
    // Unlock Web Audio right on this user click so viewers hear synchronized ticks & fanfare
    soundEngine.unlock();

    setNickname(chosenNickname);
    setAppMode('live');
    setRoomRole(role);
    setRoomCode(chosenCode);
    setRoomModalOpen(false);
    setConnectionError(null);
    setDanmakuMessages([]);
    viewerAnimatingRef.current = false;
    viewerActiveSpinIdRef.current = '';
    setExternalSpin(null);
    setViewerShowOverlay(false);
    updateUrlRoomParam(chosenCode);

    if (role === 'viewer') {
      setActiveTab('history');
    }

    await realtimeRoomService.connect(supabaseConfig, chosenCode, chosenNickname, role, {
      onConnectionChange: (state, errMsg) => {
        setConnectionState(state);
        setConnectionError(errMsg || null);
        if (state === 'connected') {
          if (role === 'host') {
            showToast('success', `主持房間 ${chosenCode} 已開啟！複製邀請連結即可邀大家同步觀看。`);
            void realtimeRoomService.broadcastState(buildHostSnapshotRef.current());
          } else {
            showToast('success', `已加入即時連線房 ${chosenCode}，正在同步主持人畫面！`);
          }
        }
      },
      onPresenceUpdate: (members) => {
        setRoomMembers(members);
      },
      onStateSnapshot: (snapshot) => {
        if (role !== 'viewer') return;
        setViewerSnapshot(snapshot);

        // If viewer is currently mid-spin, do not interrupt the local wheel animation with host's periodic STATE_SYNC
        if (viewerAnimatingRef.current) {
          if (snapshot.latestRecord) {
            pendingViewerResultRef.current = snapshot.latestRecord;
          }
          return;
        }

        setViewerLockedWinner(snapshot.lockedWinner);
        setViewerLatestRecord(snapshot.latestRecord);

        if (snapshot.activeSpin) {
          if (snapshot.activeSpin.spinId !== viewerActiveSpinIdRef.current) {
            viewerActiveSpinIdRef.current = snapshot.activeSpin.spinId;
            viewerAnimatingRef.current = true;
            setViewerShowOverlay(false);
            setViewerStage(
              snapshot.activeSpin.mode === 'participant'
                ? 'spinning-participant'
                : 'spinning-amount'
            );
            setExternalSpin(snapshot.activeSpin);
          }
        } else {
          setViewerStage(snapshot.stage);
        }
      },
      onSpinStart: (command) => {
        if (role !== 'viewer') return;
        if (command.spinId === viewerActiveSpinIdRef.current) return;
        viewerActiveSpinIdRef.current = command.spinId;
        viewerAnimatingRef.current = true;
        pendingViewerResultRef.current = null;
        setViewerShowOverlay(false);
        setViewerStage(
          command.mode === 'participant' ? 'spinning-participant' : 'spinning-amount'
        );
        setExternalSpin({ ...command, initialElapsedMs: 0 });
      },
      onSpinResult: (record) => {
        if (role !== 'viewer') return;
        pendingViewerResultRef.current = record;
        setViewerSnapshot((prev) =>
          prev
            ? {
                ...prev,
                latestRecord: record,
                records: mergeDrawRecords([record], prev.records),
              }
            : prev
        );
      },
      onStageReset: () => {
        if (role !== 'viewer') return;
        pendingViewerResultRef.current = null;
        viewerAnimatingRef.current = false;
        viewerActiveSpinIdRef.current = '';
        setViewerShowOverlay(false);
        setViewerLockedWinner(null);
        setViewerLatestRecord(null);
        setViewerStage('ready-participant');
      },
      onDanmaku: (msg) => {
        appendDanmaku(msg);
      },
      onSyncRequested: () => {
        if (role === 'host') {
          void realtimeRoomService.broadcastState(buildHostSnapshotRef.current());
        }
      },
    });
  };

  const handleSwitchAppMode = (nextMode: AppMode) => {
    if (nextMode === appMode) return;
    if (nextMode === 'classic') {
      if (roomCode) {
        void handleLeaveRoom(true);
      } else {
        setAppMode('classic');
      }
      return;
    }
    setAppMode('live');
    if (!roomCode) {
      setRoomModalInitialTab('host');
      setRoomModalOpen(true);
    }
  };

  const handleCopyInviteLink = () => {
    if (!roomCode) return;
    const url = new URL(window.location.href);
    url.searchParams.set('room', roomCode);
    const link = url.toString();
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(link);
    }
    showToast('success', `已複製房間邀請連結：${link}`);
  };

  const handleSendUserDanmaku = (text: string, color: DanmakuColor) => {
    if (!isLiveConnected) return;
    const msg: DanmakuMessage = {
      id: `dm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      senderId: realtimeRoomService.getClientId(),
      senderName: nickname.trim() || (roomRole === 'host' ? '主持人' : '匿名觀眾'),
      text,
      color,
      kind: 'user',
      createdAt: Date.now(),
    };
    appendDanmaku(msg);
    void realtimeRoomService.broadcastDanmaku(msg);
  };

  const handleSaveGitHubConfig = (next: GitHubConfig, syncNow: boolean) => {
    setGitHubConfig(next);
    setGitHubModalOpen(false);
    if (syncNow && isGitHubWriteReady(next)) {
      void performGitHubSync(
        next,
        recordsRef.current,
        'chore(draw): batch upload local simulation records'
      );
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

  const primaryActionLabel = isLiveViewer
    ? displayStage === 'spinning-participant'
      ? '同步觀看：人物輪盤旋轉中...'
      : displayStage === 'spinning-amount'
        ? '同步觀看：金額輪盤旋轉中...'
        : displayStage === 'participant-locked'
          ? `等待主持人為「${displayLockedWinner?.id ?? ''}」啟動金額輪盤...`
          : displayStage === 'result-revealed'
            ? '本輪已揭曉，等待主持人開啟下一輪...'
            : '等待主持人啟動抽獎...'
    : stage === 'spinning-participant'
      ? '人物輪盤旋轉中...'
      : stage === 'spinning-amount'
        ? '金額輪盤旋轉中...'
        : stage === 'participant-locked'
          ? lockedWinner
            ? `第二步：為「${lockedWinner.id}」抽金額`
            : '第二步：開始抽獎金額'
          : stage === 'result-revealed'
            ? '準備下一輪抽獎'
            : '開始抽獎（第一步：抽人物）';

  const currentStepNumber =
    displayStage === 'ready-participant' || displayStage === 'spinning-participant'
      ? 1
      : displayStage === 'participant-locked' || displayStage === 'spinning-amount'
        ? 2
        : 3;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#2B1242] via-[#211035] to-[#36143E] text-[#F8EDFF] relative overflow-x-hidden flex flex-col">
      {/* Pink & Lavender-Purple Ambient Aurora Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(244,114,182,0.30),transparent_52%),radial-gradient(ellipse_at_top_right,rgba(192,132,252,0.28),transparent_50%),radial-gradient(ellipse_at_bottom_center,rgba(236,72,153,0.22),transparent_55%)]"
      />

      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-[#F472B6]/35 bg-[#221036]/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#F9A8D4]/55 bg-gradient-to-br from-[#EC4899] to-[#A855F7] text-white shadow-[0_0_24px_rgba(236,72,153,0.48)]">
              <Disc3 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-display text-lg sm:text-xl leading-tight text-white">
                成俱樂部標標樂
              </h1>
              <p className="text-[11px] font-medium text-[#E9D5FF]">
                雙階段人物 × 金額輪盤抽獎系統
              </p>
            </div>
          </div>

          {/* Center: Dual-Mode Switcher (Classic vs Live Room) */}
          <div
            role="tablist"
            aria-label="運作模式切換"
            className="flex items-center gap-1 rounded-xl border border-[#4C1D95]/65 bg-[#17142E] p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={appMode === 'classic'}
              onClick={() => handleSwitchAppMode('classic')}
              className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] ${
                appMode === 'classic'
                  ? 'bg-[#7C3AED] text-white shadow'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
              <span>經典模式</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={appMode === 'live'}
              onClick={() => handleSwitchAppMode('live')}
              className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] ${
                appMode === 'live'
                  ? 'bg-gradient-to-r from-[#F43F5E] to-[#7C3AED] text-white shadow'
                  : 'text-[#94A3B8] hover:text-white'
              }`}
            >
              <Radio className="h-3.5 w-3.5" aria-hidden="true" />
              <span>即時連線房</span>
              {isLiveConnected && (
                <span className="h-2 w-2 rounded-full bg-[#34D399] animate-pulse" />
              )}
            </button>
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

            {/* GitHub Sync Button (Hidden in Viewer mode) */}
            {!isLiveViewer && (
              <button
                type="button"
                onClick={() => setGitHubModalOpen(true)}
                className="inline-flex min-h-[44px] cursor-pointer items-center gap-2 rounded-xl border border-[#7C3AED]/55 bg-[#1E1C35] px-3.5 py-2 text-xs font-bold text-white transition-colors duration-200 hover:bg-[#2A264A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
              >
                <Github className="h-4 w-4 text-[#C4B5FD]" aria-hidden="true" />
                <span className="hidden md:inline">
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
            )}
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

      {/* Main Responsive Bento Container (elevate stacking context during Spotlight so top header never overlaps!) */}
      <main
        className={`relative mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:py-8 ${
          spotlightActive ? 'z-50' : 'z-10'
        }`}
      >
        {/* Live Room Control Bar (Only rendered in Live Mode) */}
        {isLiveMode && (
          <RoomControlBar
            roomCode={roomCode}
            role={roomRole}
            connectionState={connectionState}
            connectionError={connectionError}
            members={roomMembers}
            danmakuVisible={danmakuVisible}
            onToggleDanmaku={() => setDanmakuVisible((v) => !v)}
            onCopyInviteLink={handleCopyInviteLink}
            onOpenRoomModal={() => {
              setRoomModalInitialTab(roomCode ? roomRole : 'host');
              setRoomModalOpen(true);
            }}
            onLeaveRoom={() => void handleLeaveRoom(false)}
          />
        )}

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
          {/* LEFT STAGE: Roulette Arena (expands seamlessly into full-viewport Theater Spotlight while spinning!) */}
          <section
            aria-label="輪盤抽獎主舞台"
            className={
              spotlightActive
                ? 'fixed inset-0 z-40 flex h-[100dvh] flex-col overflow-hidden bg-[radial-gradient(circle_at_35%_35%,rgba(244,114,182,0.32),rgba(168,85,247,0.22)_38%,rgba(26,12,42,0.97)_74%)] px-3 py-2 sm:px-5 sm:py-3 backdrop-blur-xl transition-all duration-300'
                : 'arcade-stage rounded-2xl p-5 sm:p-7 lg:col-span-7 flex flex-col items-center'
            }
          >
            {/* Spotlight Compact Top Header (Only shown when expanded) */}
            {spotlightActive && (
              <div className="mb-2 flex w-full max-w-[1440px] shrink-0 mx-auto items-center justify-between gap-3 rounded-xl border border-[#7C3AED]/45 bg-[#14122B]/92 px-3.5 py-1.5 shadow-xl">
                <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-2.5">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#F43F5E]/20 px-2.5 py-1 text-xs font-bold text-[#FECDD3]">
                    <Gem className="h-3.5 w-3.5 text-[#FB7185]" aria-hidden="true" />
                    <span className="max-w-[150px] truncate">
                      {displayItemName.trim() || '未指定項目'}
                    </span>
                  </span>
                  {displayLockedWinner && (
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#7C3AED]/25 px-2.5 py-1 text-xs font-bold text-[#EDE9FE]">
                      <Users className="h-3.5 w-3.5 text-[#C4B5FD]" aria-hidden="true" />
                      <span>得標者：{displayLockedWinner.id}</span>
                    </span>
                  )}
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                      wheelMode === 'participant'
                        ? 'bg-[#7C3AED]/25 text-[#DDD6FE]'
                        : 'bg-[#F59E0B]/20 text-[#FDE68A]'
                    }`}
                  >
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    <span>
                      {wheelMode === 'participant'
                        ? '第一步：抽出人物 ID'
                        : `第二步：抽出得標金額（${displayCurrencyUnit}）`}
                    </span>
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {isLiveMode && Boolean(roomCode) && (
                    <button
                      type="button"
                      onClick={() => setDanmakuVisible((v) => !v)}
                      aria-label={danmakuVisible ? '隱藏畫面飄過彈幕' : '顯示畫面飄過彈幕'}
                      className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-[#0F0F23]/80 px-2.5 py-1.5 text-xs font-semibold text-[#E2E8F0] transition-colors hover:border-[#A78BFA]/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
                    >
                      {danmakuVisible ? (
                        <Eye className="h-3.5 w-3.5 text-[#A78BFA]" aria-hidden="true" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-[#94A3B8]" aria-hidden="true" />
                      )}
                      <span className="hidden sm:inline">
                        {danmakuVisible ? '飄幕開' : '飄幕關'}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const hadPendingOverlay = resultOverlayTimerRef.current !== null;
                      exitSpotlightNow();
                      if (hadPendingOverlay) {
                        if (isLiveViewer) {
                          setViewerShowOverlay(true);
                        } else {
                          setShowResultOverlay(true);
                        }
                      }
                    }}
                    aria-label="收合回標準畫面"
                    className="inline-flex min-h-[38px] cursor-pointer items-center gap-1.5 rounded-lg border border-white/15 bg-[#0F0F23]/80 px-3 py-1.5 text-xs font-semibold text-[#E2E8F0] transition-colors hover:border-[#A78BFA]/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
                  >
                    <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">收合</span>
                  </button>
                </div>
              </div>
            )}

            {/* Theater Body: Desktop side-by-side (Oversized Wheel + Sleek Live Danmaku Panel) in Live Spotlight; vertical stack on Mobile & Normal Mode */}
            <div
              className={
                spotlightActive
                  ? `mx-auto flex flex-1 min-h-0 w-full max-w-[1440px] flex-col gap-2.5 sm:gap-4 overflow-hidden ${
                      isLiveMode && Boolean(roomCode)
                        ? 'lg:flex-row lg:items-stretch'
                        : 'items-center justify-center'
                    }`
                  : 'flex w-full flex-col items-center'
              }
            >
              {/* CHILD 1: Wheel Arena (Strictly overflow-hidden during Spotlight so Canvas NEVER overlaps DanmakuComposer!) */}
              <div
                className={
                  spotlightActive
                    ? 'relative flex flex-1 min-h-0 w-full flex-col items-center justify-center overflow-hidden rounded-2xl'
                    : 'relative flex w-full flex-col items-center'
                }
              >
                {/* Multi-Track Danmaku Overlay (Strictly confined inside the Wheel Arena!) */}
                {isLiveMode && Boolean(roomCode) && (
                  <DanmakuOverlay messages={danmakuMessages} visible={danmakuVisible} />
                )}

                {/* Spotlight Post-Spin Reveal Callout Banner */}
                {spotlightActive && spotlightBanner && (
                  <div className="mb-2 inline-flex shrink-0 items-center gap-2 rounded-full border border-[#FBBF24] bg-[#2D1B06]/95 px-5 py-1.5 font-display text-sm sm:text-base text-[#FEF08A] shadow-[0_0_28px_rgba(251,191,36,0.45)] animate-reveal-pop">
                    <Crown className="h-4 w-4 text-[#FBBF24]" aria-hidden="true" />
                    <span>{spotlightBanner}</span>
                  </div>
                )}

                {/* Standard Header & Scoreboard (Hidden while expanded in Spotlight mode) */}
                {!spotlightActive && (
                  <>
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
                            {displayItemName.trim() || '未指定項目（請於右側輸入）'}
                          </div>
                        </div>
                      </div>
                      {!isLiveViewer && (
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
                      )}
                    </div>

                    {/* Current Round Matchup Scoreboard */}
                    <div className="mb-5 grid w-full grid-cols-2 gap-3">
                      <div
                        className={`rounded-xl border px-4 py-3 transition-all duration-200 ${
                          displayLockedWinner
                            ? 'border-[#A78BFA]/70 bg-[#7C3AED]/20 shadow-[0_0_24px_rgba(124,58,237,0.25)]'
                            : 'border-white/10 bg-[#0F0F23]/75'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                          <Users className="h-3.5 w-3.5 text-[#A78BFA]" aria-hidden="true" />
                          <span>本輪得標人物 ID</span>
                        </div>
                        <div className="mt-1 truncate font-display text-lg sm:text-xl text-white">
                          {displayLockedWinner ? displayLockedWinner.id : '待抽出...'}
                        </div>
                      </div>

                      <div
                        className={`rounded-xl border px-4 py-3 transition-all duration-200 ${
                          displayLatestRecord
                            ? displayLatestRecord.tier === 'min'
                              ? 'border-[#10B981]/70 bg-[#10B981]/20'
                              : displayLatestRecord.tier === 'max'
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
                              displayLatestRecord
                                ? displayLatestRecord.tier === 'min'
                                  ? 'text-[#34D399]'
                                  : displayLatestRecord.tier === 'max'
                                    ? 'text-[#FB7185]'
                                    : 'text-[#FDE68A]'
                                : 'text-[#94A3B8]'
                            }`}
                          >
                            {displayLatestRecord
                              ? formatAmount(displayLatestRecord.amount, displayLatestRecord.currencyUnit)
                              : '待抽出...'}
                          </span>
                          {displayLatestRecord?.tier === 'min' && (
                            <Crown className="h-4 w-4 shrink-0 text-[#FDE68A]" aria-hidden="true" />
                          )}
                          {displayLatestRecord?.tier === 'max' && (
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
                            ? `人物輪盤模式（剩餘 ${displayParticipants.length} 位）`
                            : `金額輪盤模式（剩餘 ${displayAmounts.length} 筆｜${displayCurrencyUnit}）`}
                        </span>
                      </span>
                    </div>
                  </>
                )}

                {/* The Canvas Roulette Wheel (exact same React instance — zero remount or frame drop!) */}
                <RouletteWheel
                  items={wheelItems}
                  mode={wheelMode}
                  isSpinning={isSpinning}
                  disabled={!canStartDraw}
                  readOnly={isLiveViewer}
                  expanded={spotlightActive}
                  hasLiveSidebar={spotlightActive && isLiveMode && Boolean(roomCode)}
                  actionLabel={primaryActionLabel}
                  accentMode={wheelAccentMode}
                  spinRequestId={spinRequestId}
                  externalSpin={isLiveViewer ? externalSpin : null}
                  onSpinStart={handleSpinStart}
                  onSpinDispatched={handleHostSpinDispatched}
                  onSpinComplete={handleSpinComplete}
                  onTriggerSpin={handleTriggerSpin}
                />

                {/* Primary Stage Controls (Hidden during Spotlight to keep focus pure) */}
                {!spotlightActive && (
                  <div className="mt-6 flex w-full max-w-md flex-col gap-2.5">
                    {isLiveViewer ? (
                      <div className="flex min-h-[50px] w-full items-center justify-center gap-2 rounded-xl border border-[#7C3AED]/45 bg-[#17142E]/90 px-4 py-3 text-xs font-bold text-[#DDD6FE]">
                        <Tv className="h-4 w-4 text-[#A78BFA] shrink-0" aria-hidden="true" />
                        <span>{primaryActionLabel}</span>
                      </div>
                    ) : (
                      <>
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
                            快捷鍵：按{' '}
                            <kbd className="rounded border border-white/20 bg-white/5 px-1.5 py-0.5 text-[#E2E8F0]">
                              Space
                            </kbd>{' '}
                            旋轉輪盤
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
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* CHILD 2: Dedicated Live Danmaku Theater Panel (Desktop sleek right sidebar / Mobile pinned bottom bar — NEVER remounts!) */}
              {isLiveMode && Boolean(roomCode) && (
                <div
                  className={
                    spotlightActive
                      ? 'relative z-30 shrink-0 w-full lg:flex lg:h-full lg:min-h-0 lg:w-[320px] xl:w-[350px] lg:flex-col lg:rounded-2xl lg:border lg:border-[#7C3AED]/45 lg:bg-[#131129]/95 lg:p-3 lg:shadow-2xl'
                      : 'relative z-30 w-full'
                  }
                >
                  {spotlightActive && (
                    <DanmakuLiveFeed
                      messages={danmakuMessages}
                      memberCount={roomMembers.length}
                    />
                  )}
                  <div className="shrink-0">
                    <DanmakuComposer
                      nickname={nickname}
                      disabled={!isLiveConnected}
                      compact={spotlightActive}
                      onUpdateNickname={setNickname}
                      onSendDanmaku={handleSendUserDanmaku}
                    />
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* RIGHT SIDEBAR: Pool Management & History Tabs (5 cols) */}
          <aside className="arcade-card rounded-2xl p-5 lg:col-span-5">
            {isLiveViewer ? (
              <div className="space-y-4">
                {/* Viewer Read-only Room Pool Snapshot */}
                <div className="rounded-xl border border-[#7C3AED]/40 bg-[#0F0F23]/80 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-white">
                    <span className="inline-flex items-center gap-1.5">
                      <Tv className="h-4 w-4 text-[#A78BFA]" aria-hidden="true" />
                      <span>本場即時池資訊</span>
                    </span>
                    <span className="text-[11px] text-[#FDE68A]">幣別：{displayCurrencyUnit}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                      <span className="text-[#94A3B8]">候選人物：</span>
                      <span className="font-bold text-white tabular-nums">
                        {displayParticipants.length} 位
                      </span>
                    </div>
                    <div className="rounded-lg bg-white/[0.04] px-3 py-2">
                      <span className="text-[#94A3B8]">剩餘金額：</span>
                      <span className="font-bold text-white tabular-nums">
                        {displayAmounts.length} 筆
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm font-bold text-white">
                  <History className="h-4 w-4 text-[#A78BFA]" aria-hidden="true" />
                  <span>歷史得標紀錄</span>
                  <span className="rounded-full bg-[#7C3AED]/25 px-2.5 py-0.5 text-xs text-[#DDD6FE] tabular-nums">
                    {displayRecords.length}
                  </span>
                </div>

                <HistoryPanel
                  records={displayRecords}
                  defaultCurrencyUnit={displayCurrencyUnit}
                  githubConfig={githubConfig}
                  syncStatus={syncStatus}
                  readOnlyViewer
                  onSyncAllToGitHub={() => {}}
                  onPullFromGitHub={() => {}}
                  onClearLocalRecords={() => {}}
                  onOpenGitHubSettings={() => {}}
                />
              </div>
            ) : (
              <>
                {/* Tabs (Classic & Host) */}
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
                    defaultCurrencyUnit={settings.currencyUnit}
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
              </>
            )}
          </aside>
        </div>
      </main>

      {/* Footer with MIT License Notice */}
      <footer className="relative z-10 border-t border-[#F472B6]/25 bg-[#1F0F33]/75 py-4 text-center text-xs text-[#D8B4FE]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          Copyright &copy; 2026 <span className="font-semibold text-[#E2E8F0]">kb18k</span> &middot;{' '}
          <a
            href="https://github.com/kevin1688/sm_club/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#A78BFA] underline-offset-2 transition-colors hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
          >
            MIT License
          </a>
        </div>
      </footer>

      {/* Special Min/Max/Normal Celebration & Drama Overlay */}
      <SpecialEffects
        record={displayShowOverlay ? displayLatestRecord : null}
        syncStatus={syncStatus}
        syncError={syncError}
        readOnlyViewer={isLiveViewer}
        onNextRound={handleResetToParticipantStage}
        onClose={() =>
          isLiveViewer ? setViewerShowOverlay(false) : setShowResultOverlay(false)
        }
      />

      {/* GitHub Cloud Settings Modal */}
      <GitHubSettingsModal
        open={githubModalOpen}
        config={githubConfig}
        unsyncedCount={unsyncedCount}
        onSave={handleSaveGitHubConfig}
        onClose={() => setGitHubModalOpen(false)}
      />

      {/* Live Room Create / Join Modal */}
      <RoomModal
        open={roomModalOpen}
        initialTab={roomModalInitialTab}
        initialRoomCode={roomCode || initialUrlRoom}
        initialNickname={nickname}
        onJoinOrCreate={(params) => void handleJoinOrCreateRoom(params)}
        onClose={() => setRoomModalOpen(false)}
      />
    </div>
  );
}

export default App;
