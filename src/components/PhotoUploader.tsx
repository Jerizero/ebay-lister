'use client';

import { useCallback, useState } from 'react';
import { Photo } from '@/types';

interface PhotoUploaderProps {
  onPhotosUploaded: (photos: Photo[]) => void;
  isProcessing?: boolean;
}

export function PhotoUploader({ onPhotosUploaded, isProcessing }: PhotoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const imageFiles = fileArray.filter(file => file.type.startsWith('image/'));

    if (imageFiles.length === 0) {
      alert('Please upload image files only');
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
  }, [onPhotosUploaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
  }, [processFiles]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      className={`
        relative overflow-hidden rounded-2xl transition-all duration-300
        ${isDragging
          ? 'scale-[1.02] shadow-2xl'
          : 'shadow-lg hover:shadow-xl'
        }
        ${isProcessing ? 'opacity-60 pointer-events-none' : ''}
      `}
    >
      {/* Animated gradient background */}
      <div className={`
        absolute inset-0 bg-gradient-to-br transition-all duration-500
        ${isDragging
          ? 'from-indigo-500 via-purple-500 to-pink-500 animate-gradient'
          : 'from-slate-50 via-white to-slate-50'
        }
      `} />

      {/* Glass overlay */}
      <div className={`
        absolute inset-0 transition-opacity duration-300
        ${isDragging ? 'opacity-20' : 'opacity-0'}
        bg-white
      `} />

      {/* Border */}
      <div className={`
        absolute inset-0 rounded-2xl border-2 border-dashed transition-all duration-300
        ${isDragging
          ? 'border-white/60'
          : 'border-slate-200 hover:border-indigo-300'
        }
      `} />

      {/* Content */}
      <div className="relative p-12 text-center">
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInput}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          disabled={isProcessing}
        />

        <div className="space-y-5">
          {/* Icon container with animation */}
          <div className={`
            mx-auto w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300
            ${isDragging
              ? 'bg-white/20 scale-110 animate-float'
              : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30'
            }
          `}>
            <svg
              className={`w-10 h-10 transition-colors duration-300 ${isDragging ? 'text-white' : 'text-white'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isDragging ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              )}
            </svg>
          </div>

          <div>
            <p className={`
              text-xl font-semibold transition-colors duration-300
              ${isDragging ? 'text-white' : 'text-slate-800'}
            `}>
              {isDragging ? 'Release to upload' : 'Drop photos here'}
            </p>
            <p className={`
              text-sm mt-2 transition-colors duration-300
              ${isDragging ? 'text-white/80' : 'text-slate-500'}
            `}>
              or <span className={`
                font-medium underline underline-offset-2 decoration-2
                ${isDragging ? 'decoration-white/50' : 'decoration-indigo-400 text-indigo-600'}
              `}>browse files</span>
            </p>
          </div>

          <div className={`
            flex items-center justify-center gap-6 text-xs transition-colors duration-300
            ${isDragging ? 'text-white/70' : 'text-slate-400'}
          `}>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              JPG, PNG, HEIC
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Up to 200 photos
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              AI-powered grouping
            </span>
          </div>

          {uploadProgress !== null && (
            <div className="mt-6 animate-fade-in">
              <div className="max-w-xs mx-auto">
                <div className="flex justify-between text-sm mb-2">
                  <span className={isDragging ? 'text-white' : 'text-slate-600'}>
                    Processing photos...
                  </span>
                  <span className={`font-medium ${isDragging ? 'text-white' : 'text-indigo-600'}`}>
                    {uploadProgress}%
                  </span>
                </div>
                <div className={`
                  h-2 rounded-full overflow-hidden
                  ${isDragging ? 'bg-white/20' : 'bg-slate-200'}
                `}>
                  <div
                    className={`
                      h-full rounded-full transition-all duration-300
                      ${isDragging
                        ? 'bg-white'
                        : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                      }
                    `}
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
