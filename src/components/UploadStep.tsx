'use client';

import { Photo } from '@/types';
import { PhotoUploader } from '@/components/PhotoUploader';
import { PhotoGrid } from '@/components/PhotoGrid';

interface UploadStepProps {
  photos: Photo[];
  isProcessing: boolean;
  onPhotosUploaded: (photos: Photo[]) => void;
  onRemovePhoto: (id: string) => void;
  onStartGrouping: () => void;
}

export function UploadStep({
  photos,
  isProcessing,
  onPhotosUploaded,
  onRemovePhoto,
  onStartGrouping,
}: UploadStepProps) {
  return (
    <div className="space-y-6">
      {/* Primary action bar when photos are staged */}
      {photos.length > 0 && (
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <p className="font-bold text-slate-900 text-base">
              {photos.length} photo{photos.length !== 1 ? 's' : ''} staged for grouping
            </p>
            <p className="text-sm text-slate-600 mt-0.5">
              Step 1 groups photos by item so you can verify them before generating listings and comps.
            </p>
          </div>
          <button
            onClick={onStartGrouping}
            disabled={isProcessing}
            className={`
              px-6 py-3 rounded-xl font-semibold text-white text-sm
              transition-all duration-150
              ${
                isProcessing
                  ? 'bg-slate-400 cursor-not-allowed'
                  : 'bg-blue-700 hover:bg-blue-800 shadow-sm'
              }
            `}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Grouping Photos...
              </span>
            ) : (
              `Step 1: Group ${photos.length} Photo${photos.length !== 1 ? 's' : ''} with AI →`
            )}
          </button>
        </section>
      )}

      {/* Dropzone */}
      <section>
        <PhotoUploader
          onPhotosUploaded={onPhotosUploaded}
          isProcessing={isProcessing}
        />
      </section>

      {/* Staged photos grid */}
      {photos.length > 0 && (
        <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-bold text-slate-900">
              Staged Photos ({photos.length})
            </h2>
            <span className="text-xs text-slate-500">
              Hover any photo to remove it from the batch
            </span>
          </div>
          <PhotoGrid photos={photos} onRemovePhoto={onRemovePhoto} />
        </section>
      )}

      {/* Compact pipeline overview when empty */}
      {photos.length === 0 && (
        <section className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">
            Two-Stage Listing Pipeline
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h3 className="font-semibold text-slate-900 text-sm">
                  Vision Item Grouping
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed pl-8">
                Drop a mixed camera roll of clothes, shoes, or gear. Gemini Vision clusters angles and size tags by item and pauses for your review.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h3 className="font-semibold text-slate-900 text-sm">
                  Verify Groups & Pull eBay Comps
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed pl-8">
                Split or merge any group before spending listing calls. Confirmed groups query real eBay comps to ground pricing and item specifics.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-md bg-slate-900 text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="font-semibold text-slate-900 text-sm">
                  Direct eBay EPS Upload or CSV
                </h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed pl-8">
                Uploads photos to eBay Picture Services (`i.ebayimg.com`), maps leaf category IDs, and saves offers to eBay or exports a Seller Hub CSV.
              </p>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
