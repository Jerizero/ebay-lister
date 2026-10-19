'use client';

import { useState, useEffect, useCallback } from 'react';

interface EbayStatusProps {
  onStatusChange?: (connected: boolean) => void;
}

export function EbayStatus({ onStatusChange }: EbayStatusProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/ebay/status');
      const data = await response.json();
      setIsConnected(Boolean(data.connected));
      setEnvironment(data.environment || 'sandbox');
      setExpiresAt(data.expiresAt || null);
      onStatusChange?.(Boolean(data.connected));
    } catch {
      console.error('Failed to check eBay status');
    } finally {
      setIsLoading(false);
    }
  }, [onStatusChange]);

  useEffect(() => {
    checkStatus();

    const params = new URLSearchParams(window.location.search);
    const connected = params.get('ebay_connected');
    const oauthError = params.get('ebay_error');

    if (connected === 'true') {
      setIsConnected(true);
      onStatusChange?.(true);
      window.history.replaceState({}, '', window.location.pathname);
    } else if (oauthError) {
      setError(oauthError);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [checkStatus, onStatusChange]);

  const handleConnect = () => {
    window.location.href = '/api/ebay/auth';
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
        <div className="w-4 h-4 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
        <span className="text-xs text-slate-500">Checking eBay...</span>
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
          <span className="text-xs text-red-600">{error}</span>
        </div>
        <button
          onClick={handleConnect}
          className="px-3 py-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      {isConnected ? (
        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            environment === 'production'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
              : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
          }`}
          title="Click to view eBay connection & environment details"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              environment === 'production' ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          />
          <span>
            {environment === 'production' ? 'eBay Live' : 'eBay Sandbox'} Connected
          </span>
          <span className="text-[10px] uppercase font-bold opacity-75">
            {environment}
          </span>
        </button>
      ) : (
        <button
          onClick={handleConnect}
          className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-700 text-white text-xs font-semibold rounded-lg hover:bg-blue-800 transition-all shadow-sm"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.77 10.24a6.57 6.57 0 0 0 5.05 2.4c2.2 0 4.2-1.1 5.4-2.78.1-.14.2-.28.28-.43a.94.94 0 0 0-.82-1.43h-.38a.93.93 0 0 0-.75.38c-.75 1-1.97 1.66-3.33 1.66a4.17 4.17 0 0 1-3.4-1.78.93.93 0 0 0-.76-.38h-.38a.94.94 0 0 0-.91 1.36zm12.46 3.52a6.57 6.57 0 0 0-5.05-2.4c-2.2 0-4.2 1.1-5.4 2.78-.1.14-.2.28-.28.43a.94.94 0 0 0 .82 1.43h.38a.93.93 0 0 0 .75-.38c.75-1 1.97-1.66 3.33-1.66a4.17 4.17 0 0 1 3.4 1.78.93.93 0 0 0 .76.38h.38a.94.94 0 0 0 .91-1.36z" />
          </svg>
          Connect eBay ({environment})
        </button>
      )}

      {/* Environment details modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    environment === 'production' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
                <h3 className="font-bold text-slate-900 text-base">
                  eBay Connection Status
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-700">
              <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="text-slate-500">Active Environment:</span>
                <span className="font-semibold uppercase tracking-wider text-slate-900">
                  {environment === 'production' ? 'Production (Live eBay)' : 'Sandbox (Test Mode)'}
                </span>
              </div>

              {expiresAt && (
                <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500">Token Expiry:</span>
                  <span className="font-medium text-slate-900">
                    {new Date(expiresAt).toLocaleString()}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-100">
                <h4 className="font-semibold text-slate-900 mb-1 text-xs">
                  How to Switch to Production (Live eBay Selling)
                </h4>
                <p className="text-slate-600 leading-relaxed mb-2">
                  Update these lines in your <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px]">.env.local</code> file:
                </p>
                <div className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[11px] leading-relaxed overflow-x-auto select-all">
                  EBAY_ENVIRONMENT=production<br />
                  EBAY_CLIENT_ID=your-prod-app-id<br />
                  EBAY_CLIENT_SECRET=your-prod-cert-id<br />
                  EBAY_REDIRECT_URI=your-prod-runame
                </div>
                <p className="text-slate-500 text-[11px] mt-2">
                  After editing, restart the dev server and click Reconnect.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleConnect}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
              >
                Reconnect eBay
              </button>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
