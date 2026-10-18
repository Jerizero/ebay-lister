'use client';

import { PhotoGroup, Listing } from '@/types';
import { PhotoGroupDisplay } from '@/components/PhotoGroupDisplay';

interface GroupedStepProps {
  groups: PhotoGroup[];
  listings: Listing[];
  submittingId: string | null;
  refreshingCompId?: string | null;
  onBack: () => void;
  onEditGroups: () => void;
  onSaveDrafts: () => void;
  onListingChange: (listing: Listing) => void;
  onSubmitListing: (listing: Listing) => void;
  onRefreshComps: (listingId: string, query: string) => void;
}

export function GroupedStep({
  groups,
  listings,
  submittingId,
  refreshingCompId,
  onBack,
  onEditGroups,
  onSaveDrafts,
  onListingChange,
  onSubmitListing,
  onRefreshComps,
}: GroupedStepProps) {
  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Photo Upload
        </button>
      </div>

      <PhotoGroupDisplay
        groups={groups}
        listings={listings}
        onEditGroups={onEditGroups}
        onSaveDrafts={onSaveDrafts}
        onListingChange={onListingChange}
        onSubmitListing={onSubmitListing}
        onRefreshComps={onRefreshComps}
        submittingId={submittingId}
        refreshingCompId={refreshingCompId}
      />
    </div>
  );
}
