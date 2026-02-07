'use client';

import { Photo } from '@/types';
import Image from 'next/image';

interface PhotoGridProps {
  photos: Photo[];
  onRemovePhoto?: (id: string) => void;
  selectable?: boolean;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
}

export function PhotoGrid({
  photos,
  onRemovePhoto,
  selectable,
  selectedIds = [],
  onToggleSelect,
}: PhotoGridProps) {
  if (photos.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
      {photos.map((photo, index) => {
        const isSelected = selectedIds.includes(photo.id);

        return (
          <div
            key={photo.id}
            className={`
              relative aspect-square rounded-xl overflow-hidden bg-slate-100 group
              transition-all duration-300 ease-out
              animate-fade-in-up
              ${selectable ? 'cursor-pointer' : ''}
              ${isSelected
                ? 'ring-2 ring-indigo-500 ring-offset-2 scale-[0.98]'
                : 'hover:scale-[1.02] hover:shadow-xl hover:z-10'
              }
            `}
            style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
            onClick={() => selectable && onToggleSelect?.(photo.id)}
          >
            <Image
              src={photo.url}
              alt="Uploaded photo"
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16vw"
            />

            {/* Gradient overlay on hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Selection checkbox */}
            {selectable && (
              <div className={`
                absolute top-2.5 left-2.5 w-6 h-6 rounded-lg flex items-center justify-center
                transition-all duration-200 shadow-lg
                ${isSelected
                  ? 'bg-indigo-500 border-0 scale-110'
                  : 'bg-white/90 border border-slate-200 backdrop-blur-sm'
                }
              `}>
                {isSelected && (
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            )}

            {/* Remove button */}
            {onRemovePhoto && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRemovePhoto(photo.id);
                }}
                className="absolute top-2.5 right-2.5 w-7 h-7 bg-white/90 backdrop-blur-sm text-slate-600 rounded-lg
                          opacity-0 group-hover:opacity-100 transition-all duration-200
                          flex items-center justify-center shadow-lg
                          hover:bg-red-500 hover:text-white hover:scale-110"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}

            {/* Photo number badge */}
            <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-2 py-1 rounded-md
                          opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              #{index + 1}
            </div>
          </div>
        );
      })}
    </div>
  );
}
