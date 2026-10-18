'use client';

import { EbayStatus } from '@/components/EbayStatus';

export type WorkflowStep = 'upload' | 'review-groups' | 'grouped' | 'editing';

interface AppHeaderProps {
  step: WorkflowStep;
  groupsCount: number;
  listingsCount: number;
  photosCount: number;
  isRestoredFromStorage?: boolean;
  onStepClick?: (step: WorkflowStep) => void;
  onEbayStatusChange: (connected: boolean) => void;
  onClearAll: () => void;
}

export function AppHeader({
  step,
  groupsCount,
  listingsCount,
  photosCount,
  isRestoredFromStorage,
  onStepClick,
  onEbayStatusChange,
  onClearAll,
}: AppHeaderProps) {
  const activeStage =
    step === 'upload'
      ? 1
      : step === 'review-groups' || step === 'editing'
      ? 2
      : 3;

  return (
    <header className="bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Brand & Pipeline Stepper */}
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white font-bold text-base tracking-tight">
                eB
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                    eBay Mass Lister
                  </h1>
                  {isRestoredFromStorage && photosCount > 0 && (
                    <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-600 rounded-md">
                      Session auto-saved
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Vision grouping · Sold comps · eBay EPS upload
                </p>
              </div>
            </div>

            {/* 3-Stage Stepper */}
            <nav aria-label="Listing pipeline steps" className="hidden md:flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => onStepClick?.('upload')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  activeStage === 1
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                1. Upload ({photosCount})
              </button>
              <span className="text-slate-300">→</span>
              <button
                type="button"
                disabled={groupsCount === 0}
                onClick={() => groupsCount > 0 && onStepClick?.('review-groups')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  activeStage === 2
                    ? 'bg-slate-900 text-white'
                    : groupsCount > 0
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                }`}
              >
                2. Confirm Groups ({groupsCount})
              </button>
              <span className="text-slate-300">→</span>
              <button
                type="button"
                disabled={listingsCount === 0}
                onClick={() => listingsCount > 0 && onStepClick?.('grouped')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                  activeStage === 3
                    ? 'bg-slate-900 text-white'
                    : listingsCount > 0
                    ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    : 'bg-slate-50 text-slate-400 cursor-not-allowed'
                }`}
              >
                3. Price & List ({listingsCount})
              </button>
            </nav>
          </div>

          {/* Right Status & Batch Controls */}
          <div className="flex items-center gap-3">
            <EbayStatus onStatusChange={onEbayStatusChange} />
            {photosCount > 0 && (
              <button
                onClick={onClearAll}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Clear Batch
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
