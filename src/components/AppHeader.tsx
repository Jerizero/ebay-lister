'use client';

import { EbayStatus } from '@/components/EbayStatus';

interface AppHeaderProps {
  step: 'upload' | 'grouped' | 'editing';
  listingsCount: number;
  photosCount: number;
  onEbayStatusChange: (connected: boolean) => void;
  onClearAll: () => void;
}

export function AppHeader({
  step,
  listingsCount,
  photosCount,
  onEbayStatusChange,
  onClearAll,
}: AppHeaderProps) {
  return (
    <header className="relative overflow-hidden bg-white border-b border-slate-200">
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/50 via-white to-purple-50/50" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo mark */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold gradient-text">
                eBay Mass Lister
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {step === 'upload' && 'AI-powered bulk listing creation'}
                {step === 'grouped' && `${listingsCount} listing${listingsCount !== 1 ? 's' : ''} ready to review`}
                {step === 'editing' && 'Drag photos to reorganize groups'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <EbayStatus onStatusChange={onEbayStatusChange} />
            {photosCount > 0 && (
              <>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                  <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium text-slate-700">
                    {photosCount} photo{photosCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <button
                  onClick={onClearAll}
                  className="text-sm font-medium text-slate-500 hover:text-red-600 transition-colors"
                >
                  Start over
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
