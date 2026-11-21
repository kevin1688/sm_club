import React, { useMemo, useState } from 'react';
import {
  Search,
  Download,
  CloudUpload,
  RefreshCw,
  Trash2,
  Crown,
  Flame,
  Sparkles,
  Cloud,
  HardDrive,
  Github,
  Gem,
} from 'lucide-react';
import type { AmountTier, DrawRecord, GitHubConfig, SyncStatus } from '../types';
import { formatAmount, recordsToCsv } from '../utils/drawLogic';
import { isGitHubReadReady, isGitHubWriteReady } from '../services/githubStorage';

interface HistoryPanelProps {
  records: DrawRecord[];
  githubConfig: GitHubConfig;
  syncStatus: SyncStatus;
  onSyncAllToGitHub: () => void;
  onPullFromGitHub: () => void;
  onClearLocalRecords: () => void;
  onOpenGitHubSettings: () => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  records,
  githubConfig,
  syncStatus,
  onSyncAllToGitHub,
  onPullFromGitHub,
  onClearLocalRecords,
  onOpenGitHubSettings,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | AmountTier>('all');
  const [confirmClear, setConfirmClear] = useState(false);

  const unsyncedCount = useMemo(
    () => records.filter((r) => !r.syncedToGitHub).length,
    [records]
  );

  const stats = useMemo(() => {
    const totalCount = records.length;
    const totalAmount = records.reduce((sum, r) => sum + r.amount, 0);
    const minHits = records.filter((r) => r.tier === 'min').length;
    const maxHits = records.filter((r) => r.tier === 'max').length;
    return { totalCount, totalAmount, minHits, maxHits };
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((r) => {
      if (tierFilter !== 'all' && r.tier !== tierFilter) return false;
      if (
        q &&
        !r.winnerId.toLowerCase().includes(q) &&
        !(r.itemName || '').toLowerCase().includes(q) &&
        !String(r.amount).includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [records, searchQuery, tierFilter]);

  const handleExportCsv = () => {
    if (filteredRecords.length === 0) return;
    const csv = recordsToCsv(filteredRecords);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roulette-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canWriteGitHub = isGitHubWriteReady(githubConfig);
  const canReadGitHub = isGitHubReadReady(githubConfig);

  return (
    <div className="space-y-4">
      {/* KPI Metrics Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-white/10 bg-[#0F0F23]/80 p-3">
          <div className="text-[11px] font-medium text-[#94A3B8]">總得標筆數</div>
          <div className="mt-1 font-display text-xl text-white tabular-nums">
            {stats.totalCount}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0F0F23]/80 p-3">
          <div className="text-[11px] font-medium text-[#94A3B8]">累計總金額</div>
          <div className="mt-1 truncate font-display text-xl text-[#FDE68A] tabular-nums">
            {formatAmount(stats.totalAmount)}
          </div>
        </div>
        <div className="rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 p-3">
          <div className="flex items-center gap-1 text-[11px] font-medium text-[#A7F3D0]">
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            <span>幸運最低價次數</span>
          </div>
          <div className="mt-1 font-display text-xl text-[#34D399] tabular-nums">
            {stats.minHits}
          </div>
        </div>
        <div className="rounded-xl border border-[#F43F5E]/30 bg-[#F43F5E]/10 p-3">
          <div className="flex items-center gap-1 text-[11px] font-medium text-[#FECDD3]">
            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            <span>最高價買單次數</span>
          </div>
          <div className="mt-1 font-display text-xl text-[#FB7185] tabular-nums">
            {stats.maxHits}
          </div>
        </div>
      </div>

      {/* GitHub Cloud Sync Action Bar */}
      <div className="rounded-xl border border-[#4C1D95]/70 bg-[#17142E] p-3 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-white">
            <Github className="h-4 w-4 text-[#A78BFA]" aria-hidden="true" />
            <span>
              {canWriteGitHub
                ? `已連接 ${githubConfig.owner}/${githubConfig.repo}`
                : '本機模擬儲存模式'}
            </span>
          </div>
          {unsyncedCount > 0 && (
            <span className="rounded-full bg-[#F59E0B]/20 px-2 py-0.5 text-[11px] font-bold text-[#FDE68A] tabular-nums">
              {unsyncedCount} 筆待上傳
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={syncStatus === 'syncing'}
            onClick={canWriteGitHub ? onSyncAllToGitHub : onOpenGitHubSettings}
            className="inline-flex min-h-[40px] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[#7C3AED] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-[#8B5CF6] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
          >
            <CloudUpload className="h-4 w-4" aria-hidden="true" />
            <span>
              {syncStatus === 'syncing'
                ? '同步中...'
                : canWriteGitHub
                  ? '同步上傳至 GitHub'
                  : '設定並上傳至 GitHub'}
            </span>
          </button>

          {canReadGitHub && (
            <button
              type="button"
              disabled={syncStatus === 'syncing'}
              onClick={onPullFromGitHub}
              aria-label="從 GitHub 拉取最新紀錄"
              className="inline-flex min-h-[40px] cursor-pointer items-center justify-center gap-1 rounded-lg border border-[#4C1D95] bg-[#0F0F23] px-3 py-2 text-xs font-semibold text-[#E2E8F0] transition-colors hover:bg-[#252242] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncStatus === 'syncing' ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span>拉取</span>
            </button>
          )}
        </div>
      </div>

      {/* Search + Filter + Export */}
      <div className="space-y-2.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]"
            aria-hidden="true"
          />
          <label htmlFor="history-search" className="sr-only">
            搜尋搶標項目、得標者 ID 或金額
          </label>
          <input
            id="history-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜尋項目（如烈焰之魂）、得標者 ID 或金額..."
            className="min-h-[44px] w-full rounded-xl border border-[#4C1D95]/60 bg-[#0F0F23] pl-9 pr-3.5 text-sm text-[#E2E8F0] placeholder-[#64748B] focus:border-[#A78BFA] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="依結果等級篩選">
            {(
              [
                { key: 'all', label: '全部' },
                { key: 'min', label: '幸運最低價' },
                { key: 'max', label: '最高價' },
                { key: 'normal', label: '一般' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setTierFilter(opt.key)}
                className={`min-h-[34px] cursor-pointer rounded-lg px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA] ${
                  tierFilter === opt.key
                    ? 'bg-[#7C3AED] text-white'
                    : 'bg-[#0F0F23] text-[#94A3B8] hover:bg-white/5 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={filteredRecords.length === 0}
              onClick={handleExportCsv}
              className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-[#0F0F23] px-2.5 text-xs font-semibold text-[#CBD5E1] transition-colors hover:bg-white/10 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>CSV</span>
            </button>

            {records.length > 0 &&
              (!confirmClear ? (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="inline-flex min-h-[34px] cursor-pointer items-center gap-1 rounded-lg border border-white/10 bg-[#0F0F23] px-2.5 text-xs font-semibold text-[#94A3B8] transition-colors hover:border-[#F43F5E]/50 hover:text-[#FB7185] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>清空本機</span>
                </button>
              ) : (
                <div className="inline-flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onClearLocalRecords();
                      setConfirmClear(false);
                    }}
                    className="min-h-[34px] cursor-pointer rounded-lg bg-[#EF4444] px-2.5 text-xs font-bold text-white hover:bg-[#DC2626]"
                  >
                    確定清空
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="min-h-[34px] cursor-pointer rounded-lg bg-[#27273B] px-2 text-xs text-[#CBD5E1] hover:bg-[#334155]"
                  >
                    取消
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* Records List */}
      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {filteredRecords.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#4C1D95]/60 bg-[#0F0F23]/50 py-10 text-center">
            <p className="text-sm font-semibold text-[#CBD5E1]">尚無符合條件的得標紀錄</p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              完成一次「抽人物 → 抽金額」後，紀錄將自動顯示於此。
            </p>
          </div>
        ) : (
          filteredRecords.map((rec) => {
            const isMin = rec.tier === 'min';
            const isMax = rec.tier === 'max';
            return (
              <article
                key={rec.id}
                className={`rounded-xl border p-3.5 transition-colors duration-200 ${
                  isMin
                    ? 'border-[#10B981]/45 bg-[#10B981]/[0.08]'
                    : isMax
                      ? 'border-[#F43F5E]/45 bg-[#F43F5E]/[0.08]'
                      : 'border-white/10 bg-[#0F0F23]/75'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="mb-1 inline-flex max-w-full items-center gap-1 rounded-md border border-[#F43F5E]/35 bg-[#F43F5E]/10 px-2 py-0.5 text-[11px] font-bold text-[#FECDD3]">
                      <Gem className="h-3 w-3 shrink-0 text-[#FB7185]" aria-hidden="true" />
                      <span className="truncate">{rec.itemName || '未指定項目'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display text-base text-white">
                        {rec.winnerId}
                      </span>
                      {isMin ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#10B981]/25 px-2 py-0.5 text-[11px] font-bold text-[#6EE7B7]">
                          <Crown className="h-3 w-3" aria-hidden="true" />
                          <span>幸運最低價</span>
                        </span>
                      ) : isMax ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#F43F5E]/25 px-2 py-0.5 text-[11px] font-bold text-[#FDA4AF]">
                          <Flame className="h-3 w-3" aria-hidden="true" />
                          <span>最高價買單</span>
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#7C3AED]/20 px-2 py-0.5 text-[11px] font-semibold text-[#C4B5FD]">
                          <Sparkles className="h-3 w-3" aria-hidden="true" />
                          <span>一般</span>
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-[#94A3B8]">
                      <span>{new Date(rec.timestamp).toLocaleString('zh-TW')}</span>
                      <span>
                        當輪區間：{formatAmount(rec.poolMin)} ~ {formatAmount(rec.poolMax)}
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <div
                      className={`font-display text-lg tabular-nums ${
                        isMin ? 'text-[#34D399]' : isMax ? 'text-[#FB7185]' : 'text-[#FDE68A]'
                      }`}
                    >
                      {formatAmount(rec.amount)}
                    </div>
                    <div className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#94A3B8]">
                      {rec.syncedToGitHub ? (
                        <>
                          <Cloud className="h-3.5 w-3.5 text-[#34D399]" aria-hidden="true" />
                          <span className="text-[#A7F3D0]">已同步 GitHub</span>
                        </>
                      ) : (
                        <>
                          <HardDrive className="h-3.5 w-3.5 text-[#FBBF24]" aria-hidden="true" />
                          <span>本機模擬</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
};
