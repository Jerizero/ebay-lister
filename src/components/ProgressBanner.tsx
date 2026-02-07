'use client';

import { useEffect, useState } from 'react';

interface ProgressBannerProps {
  isVisible: boolean;
  message?: string;
  subMessage?: string;
  progress?: number;
  total?: number;
  current?: number;
}

export function ProgressBanner({
  isVisible,
  message = 'Processing...',
  subMessage,
  progress,
  total,
  current,
}: ProgressBannerProps) {
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setElapsedTime(0);
      return;
    }

    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="sticky top-0 z-50 animate-fade-in">
      {/* Solid dark background for readability */}
      <div className="relative overflow-hidden bg-slate-900">

        {/* Content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-6">
            {/* Left: Status indicator and message */}
            <div className="flex items-center gap-4 min-w-0">
              {/* Animated status indicator */}
              <div className="relative flex-shrink-0">
                <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-indigo-300 border-t-white rounded-full animate-spin" />
                </div>
              </div>

              <div className="min-w-0">
                <p className="font-semibold text-white truncate">{message}</p>
                {subMessage && (
                  <p className="text-sm text-slate-400 truncate mt-0.5">{subMessage}</p>
                )}
              </div>
            </div>

            {/* Center: Progress bar */}
            <div className="flex-1 max-w-lg hidden sm:block">
              {typeof progress === 'number' && (
                <div className="flex items-center gap-4">
                  <div className="flex-1 bg-slate-700 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-indigo-500 transition-all duration-500 ease-out"
                      style={{ width: `${Math.max(progress, 2)}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-white whitespace-nowrap min-w-[60px] text-right">
                    {current && total ? `${current}/${total}` : `${Math.round(progress)}%`}
                  </span>
                </div>
              )}
            </div>

            {/* Right: Time elapsed */}
            <div className="flex-shrink-0 flex items-center gap-2 bg-slate-800 px-3 py-1.5 rounded-lg">
              <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm font-medium text-white">
                {formatTime(elapsedTime)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
