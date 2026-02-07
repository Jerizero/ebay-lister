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
    <>
      {/* Upload section */}
      <section className="mb-6">
        <PhotoUploader
          onPhotosUploaded={onPhotosUploaded}
          isProcessing={isProcessing}
        />
      </section>

      {/* Action button - above the fold */}
      {photos.length > 0 && (
        <section className="mb-6 flex items-center justify-between p-5 bg-white rounded-2xl border border-slate-200 shadow-lg animate-fade-in-up">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-900">
                {photos.length} photo{photos.length !== 1 ? 's' : ''} ready to process
              </p>
              <p className="text-sm text-slate-500">
                AI will group by item and generate complete listings
              </p>
            </div>
          </div>
          <button
            onClick={onStartGrouping}
            disabled={isProcessing}
            className={`
              px-6 py-3 rounded-xl font-semibold text-white
              transition-all duration-200
              ${isProcessing
                ? 'bg-slate-300 cursor-not-allowed'
                : 'btn-primary'
              }
            `}
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Group with AI
              </span>
            )}
          </button>
        </section>
      )}

      {/* Photos grid */}
      {photos.length > 0 && (
        <section className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-900">
              Your Photos
            </h2>
            <span className="text-sm text-slate-400">
              Hover to remove individual photos
            </span>
          </div>
          <PhotoGrid
            photos={photos}
            onRemovePhoto={onRemovePhoto}
          />
        </section>
      )}

      {/* Instructions */}
      {photos.length === 0 && (
        <section className="mt-16 animate-fade-in-up">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              How it works
            </h2>
            <p className="text-slate-500">
              Three simple steps to bulk create eBay listings
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="relative group">
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl hover:border-indigo-200 transition-all duration-300 card-hover">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-2">Upload Photos</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Drag & drop up to 200 product photos at once. Mix items freely.
                </p>
              </div>
              <div className="hidden md:block absolute top-1/2 -right-4 transform translate-x-1/2 -translate-y-1/2 z-10">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            <div className="relative group">
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl hover:border-indigo-200 transition-all duration-300 card-hover">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mb-5 shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-2">AI Groups Items</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  AI vision identifies which photos belong to the same item automatically.
                </p>
              </div>
              <div className="hidden md:block absolute top-1/2 -right-4 transform translate-x-1/2 -translate-y-1/2 z-10">
                <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            <div className="group">
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl hover:border-indigo-200 transition-all duration-300 card-hover">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/30 group-hover:scale-110 transition-transform">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-2">Ready Listings</h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Complete listings with titles, descriptions, and item specifics generated.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
