import React, { useEffect, useState } from 'react';
import {
  Github,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  CloudUpload,
  ShieldCheck,
  PlugZap,
} from 'lucide-react';
import type { GitHubConfig } from '../types';
import { testGitHubConnection } from '../services/githubStorage';

interface GitHubSettingsModalProps {
  open: boolean;
  config: GitHubConfig;
  unsyncedCount: number;
  onSave: (next: GitHubConfig, syncNow: boolean) => void;
  onClose: () => void;
}

export const GitHubSettingsModal: React.FC<GitHubSettingsModalProps> = ({
  open,
  config,
  unsyncedCount,
  onSave,
  onClose,
}) => {
  const [draft, setDraft] = useState<GitHubConfig>(config);
  const [showToken, setShowToken] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(config);
      setTestResult(null);
    }
  }, [open, config]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testGitHubConnection(draft);
      setTestResult(res);
    } catch (err) {
      setTestResult({
        ok: false,
        message: err instanceof Error ? err.message : '連線測試失敗，請檢查網路或設定。',
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="github-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#7C3AED]/60 bg-[#17152E] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7C3AED]/20 text-[#C4B5FD]">
              <Github className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h2 id="github-modal-title" className="font-display text-xl text-white">
                GitHub 歷史紀錄雲端設定
              </h2>
              <p className="text-xs text-[#94A3B8]">
                先在本機模擬測試，設定完成後即可一鍵或自動同步至 GitHub Repo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉設定視窗"
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-[#94A3B8] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-[#10B981]/30 bg-[#10B981]/10 p-3 text-xs text-[#D1FAE5]">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#34D399]" aria-hidden="true" />
          <p className="leading-relaxed">
            您的 Personal Access Token <strong>僅儲存於本機瀏覽器 localStorage</strong>，絕不會寫入程式碼或推送到公開倉庫。建議於 GitHub 建立 Fine-grained PAT，僅勾選單一 Repo 的{' '}
            <code className="rounded bg-black/30 px-1 py-0.5 text-[#FEF08A]">
              Contents: Read and write
            </code>{' '}
            權限即可。
          </p>
        </div>

        {/* Form Fields */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="gh-owner" className="block text-xs font-bold text-[#E2E8F0]">
              GitHub 帳號 / 組織 (Owner)
            </label>
            <input
              id="gh-owner"
              type="text"
              value={draft.owner}
              onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
              placeholder="例如：your-username"
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#4C1D95]/70 bg-[#0F0F23] px-3.5 text-sm text-white placeholder-[#64748B] focus:border-[#A78BFA] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
            />
          </div>

          <div>
            <label htmlFor="gh-repo" className="block text-xs font-bold text-[#E2E8F0]">
              Repository 名稱
            </label>
            <input
              id="gh-repo"
              type="text"
              value={draft.repo}
              onChange={(e) => setDraft({ ...draft, repo: e.target.value })}
              placeholder="例如：lucky-price-roulette"
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#4C1D95]/70 bg-[#0F0F23] px-3.5 text-sm text-white placeholder-[#64748B] focus:border-[#A78BFA] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
            />
          </div>

          <div>
            <label htmlFor="gh-branch" className="block text-xs font-bold text-[#E2E8F0]">
              分支 (Branch)
            </label>
            <input
              id="gh-branch"
              type="text"
              value={draft.branch}
              onChange={(e) => setDraft({ ...draft, branch: e.target.value })}
              placeholder="main"
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#4C1D95]/70 bg-[#0F0F23] px-3.5 text-sm text-white placeholder-[#64748B] focus:border-[#A78BFA] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
            />
          </div>

          <div>
            <label htmlFor="gh-path" className="block text-xs font-bold text-[#E2E8F0]">
              紀錄檔路徑 (JSON)
            </label>
            <input
              id="gh-path"
              type="text"
              value={draft.filePath}
              onChange={(e) => setDraft({ ...draft, filePath: e.target.value })}
              placeholder="data/history.json"
              className="mt-1.5 min-h-[44px] w-full rounded-xl border border-[#4C1D95]/70 bg-[#0F0F23] px-3.5 text-sm text-white placeholder-[#64748B] focus:border-[#A78BFA] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="gh-token" className="block text-xs font-bold text-[#E2E8F0]">
              Personal Access Token (選填：讀取公開庫免填，寫入必填)
            </label>
            <div className="relative mt-1.5">
              <input
                id="gh-token"
                type={showToken ? 'text' : 'password'}
                value={draft.token}
                onChange={(e) => setDraft({ ...draft, token: e.target.value })}
                placeholder="github_pat_..."
                className="min-h-[44px] w-full rounded-xl border border-[#4C1D95]/70 bg-[#0F0F23] pl-3.5 pr-12 text-sm text-white placeholder-[#64748B] focus:border-[#A78BFA] focus:outline-none focus:ring-2 focus:ring-[#7C3AED]/40"
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                aria-label={showToken ? '隱藏 Token' : '顯示 Token'}
                className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-[#94A3B8] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
              >
                {showToken ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Auto-sync switch */}
        <button
          type="button"
          role="switch"
          aria-checked={draft.autoSync}
          onClick={() => setDraft({ ...draft, autoSync: !draft.autoSync })}
          className="mt-4 flex min-h-[52px] w-full cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-[#0F0F23]/80 px-4 py-2.5 text-left transition-colors hover:border-[#7C3AED]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
        >
          <div>
            <div className="text-xs font-bold text-white">每次抽獎結束自動寫入 GitHub</div>
            <div className="text-[11px] text-[#94A3B8]">
              若想先在本機反覆模擬再手動批次上傳，可先關閉此項
            </div>
          </div>
          <span
            aria-hidden="true"
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              draft.autoSync ? 'bg-[#7C3AED]' : 'bg-[#334155]'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                draft.autoSync ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </span>
        </button>

        {/* Test Result Banner */}
        {testResult && (
          <div
            role="status"
            className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs ${
              testResult.ok
                ? 'border-[#10B981]/50 bg-[#10B981]/15 text-[#D1FAE5]'
                : 'border-[#F43F5E]/50 bg-[#F43F5E]/15 text-[#FFE4E6]'
            }`}
          >
            {testResult.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#34D399]" aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#FB7185]" aria-hidden="true" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        {/* Footer Buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={testing || !draft.owner.trim() || !draft.repo.trim()}
            onClick={handleTest}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#4C1D95] bg-[#0F0F23] px-4 py-2 text-xs font-bold text-[#E2E8F0] transition-colors hover:bg-[#252242] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
          >
            <PlugZap className="h-4 w-4 text-[#A78BFA]" aria-hidden="true" />
            <span>{testing ? '測試中...' : '測試連線'}</span>
          </button>

          <button
            type="button"
            onClick={() => onSave(draft, false)}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl border border-[#7C3AED] bg-[#7C3AED]/20 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#7C3AED]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
          >
            <span>僅儲存設定</span>
          </button>

          <button
            type="button"
            disabled={!draft.owner.trim() || !draft.repo.trim() || !draft.token.trim()}
            onClick={() => onSave(draft, true)}
            className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl bg-[#7C3AED] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#8B5CF6] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#A78BFA]"
          >
            <CloudUpload className="h-4 w-4" aria-hidden="true" />
            <span>
              儲存並上傳{unsyncedCount > 0 ? ` (${unsyncedCount} 筆)` : '至 GitHub'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

