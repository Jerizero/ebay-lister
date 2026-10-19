'use client';

import { useState } from 'react';
import { PhotoGroup, Listing } from '@/types';
import { ListingCard } from '@/components/ListingCard';
import { exportListingsToCsv } from '@/lib/utils';

interface PhotoGroupDisplayProps {
  groups: PhotoGroup[];
  listings: Listing[];
  onEditGroups?: () => void;
  onSaveDrafts?: () => void;
  onListingChange?: (listing: Listing) => void;
  onBatchUpdateListings?: (updater: (prev: Listing[]) => Listing[]) => void;
  onSubmitListing?: (listing: Listing) => void;
  onRefreshComps?: (listingId: string, query: string) => void;
  submittingId?: string | null;
  refreshingCompId?: string | null;
}

function isClothing(description: string): boolean {
  const clothingKeywords = [
    'jeans', 'pants', 'shorts', 'shirt', 'top', 'blouse', 'sweater',
    'jacket', 'coat', 'dress', 'skirt', 'hoodie', 'cardigan', 'polo',
    'tee', 't-shirt', 'crewneck', 'pullover', 'blazer', 'vest', 'tank',
  ];
  return clothingKeywords.some((keyword) => description.includes(keyword));
}

function getListingTips(group: PhotoGroup): string[] {
  const tips: string[] = [];
  const description = group.aiDescription?.toLowerCase() || '';
  const photoCount = group.photos.length;

  if (photoCount === 1) {
    tips.push('Add more angles - listings with 3+ photos sell faster');
  }
  if (isClothing(description)) {
    tips.push('Include a clear photo of the size/brand label');
  }
  if (description.includes('jeans') || description.includes('pants') || description.includes('shorts')) {
    tips.push('Show item fully laid out');
  }
  if (description.includes('shoes') || description.includes('sneaker') || description.includes('boot')) {
    tips.push('Add a photo of the sole');
  }
  if (description.includes('bag') || description.includes('purse')) {
    tips.push('Show the interior');
  }

  return tips.slice(0, 2);
}

function getCommonTips(groups: PhotoGroup[]): string[] {
  if (groups.length < 3) return [];

  const frequency = new Map<string, number>();
  for (const group of groups) {
    const tips = getListingTips(group);
    for (const tip of tips) {
      frequency.set(tip, (frequency.get(tip) || 0) + 1);
    }
  }

  const threshold = Math.ceil(groups.length * 0.5);
  const commonTips: string[] = [];
  for (const [tip, count] of frequency.entries()) {
    if (count >= threshold) {
      commonTips.push(tip);
    }
  }

  return commonTips.slice(0, 2);
}

function getUniqueTips(group: PhotoGroup, commonTips: string[]): string[] {
  const allTips = getListingTips(group);
  return allTips.filter((tip) => !commonTips.includes(tip)).slice(0, 2);
}

export function PhotoGroupDisplay({
  groups,
  listings,
  onEditGroups,
  onSaveDrafts,
  onListingChange,
  onBatchUpdateListings,
  onSubmitListing,
  onRefreshComps,
  submittingId,
  refreshingCompId,
}: PhotoGroupDisplayProps) {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [batchNotice, setBatchNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setBatchNotice(msg);
    setTimeout(() => setBatchNotice(null), 3000);
  };

  const handleAdjustPrices = (multiplierDelta: number, noticeText: string) => {
    if (!onBatchUpdateListings) return;
    onBatchUpdateListings((prev) =>
      prev.map((l) => {
        const currentPrice = Number.isFinite(l.price) ? (l.price as number) : 19.99;
        const newPrice = Math.max(0.99, Math.round(currentPrice * (1 + multiplierDelta) * 100) / 100);
        return {
          ...l,
          price: newPrice,
          updatedAt: new Date(),
        };
      })
    );
    showNotice(noticeText);
  };

  const handleSnapToCompMedian = () => {
    if (!onBatchUpdateListings) return;
    let updatedCount = 0;
    onBatchUpdateListings((prev) =>
      prev.map((l) => {
        if (l.comps?.medianPrice && Number.isFinite(l.comps.medianPrice)) {
          updatedCount++;
          return {
            ...l,
            price: l.comps.medianPrice,
            updatedAt: new Date(),
          };
        }
        return l;
      })
    );
    showNotice(
      updatedCount > 0
        ? `Snapped ${updatedCount} listing${updatedCount !== 1 ? 's' : ''} to eBay comp median`
        : 'No eBay comps available yet to snap prices'
    );
  };

  const handleSetAllShipping = (policy: 'buyer' | 'seller') => {
    if (!onBatchUpdateListings) return;
    onBatchUpdateListings((prev) =>
      prev.map((l) => ({
        ...l,
        shippingPaidBy: policy,
        updatedAt: new Date(),
      }))
    );
    showNotice(
      policy === 'seller'
        ? 'Applied Free Shipping to all listings'
        : 'Applied Buyer Pays Shipping to all listings'
    );
  };

  const handleSetAllReturns = (acceptsReturns: boolean) => {
    if (!onBatchUpdateListings) return;
    onBatchUpdateListings((prev) =>
      prev.map((l) => ({
        ...l,
        acceptsReturns,
        updatedAt: new Date(),
      }))
    );
    showNotice(
      acceptsReturns
        ? 'Applied 30-Day Returns to all listings'
        : 'Applied No Returns to all listings'
    );
  };

  const getListing = (groupId: string) => listings.find((l) => l.groupId === groupId);

  if (groups.length === 0) {
    return null;
  }

  const flaggedGroups = groups.filter((g) => g.flagged);
  const validGroups = groups.filter((g) => !g.flagged);

  const readyGroups = validGroups.filter((g) => getListing(g.id));
  const pendingGroups = validGroups.filter((g) => !getListing(g.id));

  const commonTips = getCommonTips(readyGroups);

  const totalEstimatedValue = listings.reduce(
    (sum, l) => sum + (Number.isFinite(l.price) ? (l.price as number) : 19.99),
    0
  );
  const unsubmittedCount = listings.filter((l) => l.status !== 'submitted').length;

  const handleDownloadCsv = () => {
    const csv = exportListingsToCsv(listings);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ebay-drafts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Flagged content warning */}
      {flaggedGroups.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
          <h3 className="font-semibold text-red-800">Content Flagged</h3>
          <p className="text-sm text-red-600 mt-1">
            {flaggedGroups.length} item{flaggedGroups.length !== 1 ? 's were' : ' was'} flagged as potentially inappropriate and excluded.
          </p>
        </div>
      )}

      {/* Common tips banner */}
      {commonTips.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <h3 className="font-semibold text-amber-900 text-sm">Batch Photo Tips</h3>
          <ul className="mt-1.5 space-y-1">
            {commonTips.map((tip, i) => (
              <li key={i} className="text-xs text-amber-800 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Pending listings indicator */}
      {pendingGroups.length > 0 && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-blue-700 rounded-full animate-spin" />
          <div>
            <p className="font-medium text-blue-950 text-sm">
              Generating {pendingGroups.length} remaining listing{pendingGroups.length !== 1 ? 's' : ''} & fetching eBay comps...
            </p>
          </div>
        </div>
      )}

      {/* Header with batch summary & actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Ready to List ({readyGroups.length})
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            Estimated batch value:{' '}
            <strong className="text-slate-900">${totalEstimatedValue.toFixed(2)}</strong>
            {pendingGroups.length > 0 && ` · ${pendingGroups.length} generating`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onEditGroups && (
            <button
              onClick={onEditGroups}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-all"
            >
              Edit Photo Groups
            </button>
          )}
          {readyGroups.length > 0 && (
            <button
              onClick={handleDownloadCsv}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 transition-all"
              title="Download eBay Seller Hub File Exchange CSV"
            >
              Export Seller Hub CSV
            </button>
          )}
          {onSaveDrafts && readyGroups.length > 0 && (
            <button
              onClick={onSaveDrafts}
              disabled={unsubmittedCount === 0}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 rounded-xl transition-all shadow-sm"
            >
              {unsubmittedCount === 0
                ? 'All Saved to eBay'
                : `Save All to eBay (${unsubmittedCount})`}
            </button>
          )}
        </div>
      </div>

      {/* Batch controls toolbar */}
      {readyGroups.length > 0 && onBatchUpdateListings && (
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              Batch Actions ({readyGroups.length} items)
            </span>
            {batchNotice && (
              <span className="text-xs text-emerald-700 font-semibold animate-fade-in">
                ✓ {batchNotice}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {/* Bulk Pricing */}
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Bulk Pricing
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleAdjustPrices(0.05, 'Bumped all prices +5%')}
                  className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-100 rounded-lg text-slate-800 transition-all shadow-2xs"
                  title="Increase all listing prices by 5%"
                >
                  +5%
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustPrices(-0.05, 'Reduced all prices -5%')}
                  className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-100 rounded-lg text-slate-800 transition-all shadow-2xs"
                  title="Reduce all listing prices by 5%"
                >
                  -5%
                </button>
                <button
                  type="button"
                  onClick={() => handleAdjustPrices(-0.10, 'Reduced all prices -10%')}
                  className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-100 rounded-lg text-slate-800 transition-all shadow-2xs"
                  title="Reduce all listing prices by 10%"
                >
                  -10%
                </button>
                <button
                  type="button"
                  onClick={handleSnapToCompMedian}
                  className="px-2.5 py-1 text-xs font-semibold bg-blue-50 border border-blue-200 hover:bg-blue-100 rounded-lg text-blue-900 transition-all shadow-2xs"
                  title="Set all item prices to their eBay comp median"
                >
                  Snap to Median
                </button>
              </div>
            </div>

            {/* Bulk Shipping */}
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Bulk Shipping Policy
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSetAllShipping('buyer')}
                  className="flex-1 px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-100 rounded-lg text-slate-800 transition-all shadow-2xs truncate"
                >
                  Buyer Pays
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllShipping('seller')}
                  className="flex-1 px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-100 rounded-lg text-slate-800 transition-all shadow-2xs truncate"
                >
                  Free Shipping
                </button>
              </div>
            </div>

            {/* Bulk Returns */}
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Bulk Return Policy
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSetAllReturns(true)}
                  className="flex-1 px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-100 rounded-lg text-slate-800 transition-all shadow-2xs truncate"
                >
                  30-Day Returns
                </button>
                <button
                  type="button"
                  onClick={() => handleSetAllReturns(false)}
                  className="flex-1 px-2.5 py-1 text-xs font-semibold bg-white border border-slate-300 hover:border-slate-400 hover:bg-slate-100 rounded-lg text-slate-800 transition-all shadow-2xs truncate"
                >
                  No Returns
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ready listings grid */}
      <div className="grid gap-4">
        {readyGroups.map((group, index) => {
          const listing = getListing(group.id)!;
          const isExpanded = expandedGroupId === group.id;
          const tips = getUniqueTips(group, commonTips);

          return (
            <ListingCard
              key={group.id}
              group={group}
              listing={listing}
              index={index}
              isExpanded={isExpanded}
              tips={tips}
              submittingId={submittingId}
              refreshingCompId={refreshingCompId}
              onToggleExpand={() => setExpandedGroupId(isExpanded ? null : group.id)}
              onListingChange={onListingChange}
              onSubmitListing={onSubmitListing}
              onRefreshComps={onRefreshComps}
            />
          );
        })}
      </div>
    </div>
  );
}
