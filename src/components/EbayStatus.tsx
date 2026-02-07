'use client';

import { useState, useEffect } from 'react';

interface EbayStatusProps {
  onStatusChange?: (connected: boolean) => void;
}

export function EbayStatus({ onStatusChange }: EbayStatusProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkStatus();

    // Check for OAuth callback params
    const params = new URLSearchParams(window.location.search);
    const connected = params.get('ebay_connected');
    const oauthError = params.get('ebay_error');

    if (connected === 'true') {
      setIsConnected(true);
      onStatusChange?.(true);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (oauthError) {
      setError(oauthError);
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [onStatusChange]);

  const checkStatus = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/ebay/status');
      const data = await response.json();
      setIsConnected(data.connected);
      onStatusChange?.(data.connected);
    } catch {
      console.error('Failed to check eBay status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = () => {
    window.location.href = '/api/ebay/auth';
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        <span className="text-sm text-slate-500">Checking eBay...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
          <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm text-red-600">{error}</span>
        </div>
        <button
          onClick={handleConnect}
          className="px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
        <div className="w-2 h-2 bg-emerald-500 rounded-full" />
        <span className="text-sm font-medium text-emerald-700">eBay Connected</span>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm font-medium rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all shadow-sm hover:shadow-md"
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.77 10.24a6.57 6.57 0 0 0 5.05 2.4c2.2 0 4.2-1.1 5.4-2.78.1-.14.2-.28.28-.43a.94.94 0 0 0-.82-1.43h-.38a.93.93 0 0 0-.75.38c-.75 1-1.97 1.66-3.33 1.66a4.17 4.17 0 0 1-3.4-1.78.93.93 0 0 0-.76-.38h-.38a.94.94 0 0 0-.91 1.36zm12.46 3.52a6.57 6.57 0 0 0-5.05-2.4c-2.2 0-4.2 1.1-5.4 2.78-.1.14-.2.28-.28.43a.94.94 0 0 0 .82 1.43h.38a.93.93 0 0 0 .75-.38c.75-1 1.97-1.66 3.33-1.66a4.17 4.17 0 0 1 3.4 1.78.93.93 0 0 0 .76.38h.38a.94.94 0 0 0 .91-1.36z" />
      </svg>
      Connect eBay
    </button>
  );
}
