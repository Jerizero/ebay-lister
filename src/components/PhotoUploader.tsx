'use client';

import { useCallback, useState } from 'react';
import { Photo } from '@/types';
import { isSupportedImageFile } from '@/lib/utils';

interface PhotoUploaderProps {
  onPhotosUploaded: (photos: Photo[]) => void;
  isProcessing?: boolean;
}

export function PhotoUploader({ onPhotosUploaded, isProcessing }: PhotoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);
      const imageFiles = fileArray.filter((file) => isSupportedImageFile(file));

      if (imageFiles.length === 0) {
        alert('Please upload image files (JPG, PNG, WebP, or HEIC)');
        return;
      }

      setUploadProgress(0);

      const photos: Photo[] = [];
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const id = `photo-${Date.now()}-${i}`;
        const url = URL.createObjectURL(file);

        photos.push({
          id,
          file,
          url,
        });

        setUploadProgress(Math.round(((i + 1) / imageFiles.length) * 100));
      }

      setUploadProgress(null);
      onPhotosUploaded(photos);
    },
    [onPhotosUploaded]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      if (e.dataTransfer.files) {
        processFiles(e.dataTransfer.files);
      }
    },
    [processFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        processFiles(e.target.files);
      }
    },
    [processFiles]
  );

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-200
        ${
          isDragging
            ? 'border-blue-600 bg-blue-50/70'
            : 'border-slate-300 bg-white hover:border-blue-500'
        }
        ${isProcessing ? 'opacity-60 pointer-events-none' : ''}
      `}
    >
      <div className="relative p-10 sm:p-12 text-center">
        <input
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
        />

        <div className="space-y-4">
          <div
            className={`
              mx-auto w-14 h-14 rounded-xl flex items-center justify-center transition-colors
              ${isDragging ? 'bg-blue-700 text-white' : 'bg-slate-900 text-white'}
            `}
          >
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
          </div>

          <div>
            <p className="text-xl font-bold text-slate-900">
              {isDragging ? 'Release to add photos to batch' : 'Drop product photos here'}
            </p>
            <p className="text-sm text-slate-600 mt-1.5">
              Mix multiple items and angles freely, or{' '}
              <span className="font-semibold text-blue-700 underline underline-offset-2">
                browse local files
              </span>
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 pt-1 text-xs font-medium text-slate-500">
            <span>JPG, PNG, WebP, HEIC</span>
            <span>·</span>
            <span>Up to 200 photos per batch</span>
            <span>·</span>
            <span>Auto-saved to browser storage</span>
          </div>

          {uploadProgress !== null && (
            <div className="mt-4 max-w-xs mx-auto">
              <div className="flex justify-between text-xs font-medium text-slate-700 mb-1.5">
                <span>Loading photos...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden bg-slate-200">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-200"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
