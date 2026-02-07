'use client';

import { PhotoGroup, Listing } from '@/types';
import { PhotoGroupDisplay } from '@/components/PhotoGroupDisplay';

interface GroupedStepProps {
  groups: PhotoGroup[];
  listings: Listing[];
  submittingId: string | null;
  onBack: () => void;
  onEditGroups: () => void;
  onSaveDrafts: () => void;
  onListingChange: (listing: Listing) => void;
  onSubmitListing: (listing: Listing) => void;
}

export function GroupedStep({
  groups,
  listings,
  submittingId,
  onBack,
  onEditGroups,
  onSaveDrafts,
  onListingChange,
  onSubmitListing,
}: GroupedStepProps) {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to photos
        </button>
      </div>

      <PhotoGroupDisplay
        groups={groups}
        listings={listings}
        onEditGroups={onEditGroups}
        onSaveDrafts={onSaveDrafts}
        onListingChange={onListingChange}
        onSubmitListing={onSubmitListing}
        submittingId={submittingId}
      />
    </div>
  );
}
