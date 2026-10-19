'use client';

import { useState } from 'react';
import { PhotoGroup, Listing } from '@/types';
import Image from 'next/image';

const CONDITIONS = [
  { value: 'NEW', label: 'New', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'LIKE_NEW', label: 'Like New', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'GOOD', label: 'Good', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'ACCEPTABLE', label: 'Acceptable', color: 'bg-slate-100 text-slate-700 border-slate-200' },
] as const;

interface ListingCardProps {
  group: PhotoGroup;
  listing: Listing;
  index: number;
  isExpanded: boolean;
  tips: string[];
  submittingId?: string | null;
  refreshingCompId?: string | null;
  onToggleExpand: () => void;
  onListingChange?: (listing: Listing) => void;
  onSubmitListing?: (listing: Listing) => void;
  onRefreshComps?: (listingId: string, query: string) => void;
}

import { computePhotoSignature } from '@/lib/utils';

export interface SpecificsAudit {
  required: string[];
  filledCount: number;
  totalCount: number;
  missing: string[];
  isComplete: boolean;
}

export function auditListingSpecifics(listing: Listing): SpecificsAudit {
  const categoryLower = (listing.category || '').toLowerCase();
  const titleLower = (listing.title || '').toLowerCase();

  let required = ['Brand', 'Type', 'Color', 'Condition'];

  if (
    categoryLower.includes('shoe') ||
    categoryLower.includes('sneaker') ||
    categoryLower.includes('boot') ||
    titleLower.includes('shoe') ||
    titleLower.includes('sneaker')
  ) {
    required = ['Brand', 'US Shoe Size', 'Department', 'Color', 'Style'];
  } else if (
    categoryLower.includes('cloth') ||
    categoryLower.includes('pant') ||
    categoryLower.includes('jean') ||
    categoryLower.includes('shirt') ||
    categoryLower.includes('jacket') ||
    categoryLower.includes('dress') ||
    categoryLower.includes('hoodie') ||
    categoryLower.includes('sweater')
  ) {
    required = ['Brand', 'Size', 'Size Type', 'Department', 'Color', 'Material'];
  }

  const existingKeysNormalized = Object.keys(listing.itemSpecifics || {}).map((k) =>
    k.toLowerCase().replace(/[^a-z0-9]/g, '')
  );

  const missing = required.filter((req) => {
    const reqNorm = req.toLowerCase().replace(/[^a-z0-9]/g, '');
    return !existingKeysNormalized.some(
      (k) => k === reqNorm || k.includes(reqNorm) || reqNorm.includes(k)
    );
  });

  const filledCount = required.length - missing.length;
  return {
    required,
    filledCount,
    totalCount: required.length,
    missing,
    isComplete: missing.length === 0,
  };
}

export function ListingCard({
  group,
  listing,
  index,
  isExpanded,
  tips,
  submittingId,
  refreshingCompId,
  onToggleExpand,
  onListingChange,
  onSubmitListing,
  onRefreshComps,
}: ListingCardProps) {
  const [newSpecKey, setNewSpecKey] = useState('');
  const [newSpecVal, setNewSpecVal] = useState('');

  const currentPhotos = listing.photos && listing.photos.length > 0 ? listing.photos : group.photos;
  const specificsAudit = auditListingSpecifics(listing);

  const handleSetCoverPhoto = (photoId: string) => {
    const targetIdx = currentPhotos.findIndex((p) => p.id === photoId);
    if (targetIdx <= 0) return;
    const reordered = [
      currentPhotos[targetIdx],
      ...currentPhotos.filter((_, idx) => idx !== targetIdx),
    ];
    onListingChange?.({
      ...listing,
      photos: reordered,
      photoSignature: computePhotoSignature(reordered),
      updatedAt: new Date(),
    });
  };

  const conditionStyle =
    CONDITIONS.find((c) => c.value === listing.condition)?.color ||
    'bg-slate-100 text-slate-700 border-slate-200';

  const comps = listing.comps;
  const isRefreshingComps = refreshingCompId === listing.id;

  const handleAddSpecific = () => {
    const key = newSpecKey.trim();
    const val = newSpecVal.trim();
    if (!key || !val) return;
    onListingChange?.({
      ...listing,
      itemSpecifics: {
        ...listing.itemSpecifics,
        [key]: val,
      },
      updatedAt: new Date(),
    });
    setNewSpecKey('');
    setNewSpecVal('');
  };

  const handleRemoveSpecific = (keyToRemove: string) => {
    const next = { ...listing.itemSpecifics };
    delete next[keyToRemove];
    onListingChange?.({
      ...listing,
      itemSpecifics: next,
      updatedAt: new Date(),
    });
  };

  return (
    <div
      className={`
        bg-white rounded-2xl border transition-all duration-200
        ${
          isExpanded
            ? 'border-blue-600 shadow-lg'
            : 'border-slate-200 shadow-sm hover:border-slate-300'
        }
      `}
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Card header */}
      <div className="p-4 cursor-pointer" onClick={onToggleExpand}>
        <div className="flex items-start gap-4">
          {/* Photo stack preview */}
          <div className="relative flex-shrink-0">
            <div className="relative w-24 h-24">
              {currentPhotos.slice(0, 3).map((photo, i) => (
                <div
                  key={photo.id}
                  className="absolute rounded-xl overflow-hidden bg-slate-100 shadow border-2 border-white"
                  style={{
                    width: '80px',
                    height: '80px',
                    left: `${i * 8}px`,
                    top: `${i * 4}px`,
                    zIndex: 3 - i,
                  }}
                >
                  <Image
                    src={photo.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="80px"
                  />
                </div>
              ))}
            </div>
            {currentPhotos.length > 3 && (
              <span className="absolute -bottom-1 -right-1 bg-slate-900 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                +{currentPhotos.length - 3}
              </span>
            )}
          </div>

          {/* Listing summary */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-slate-900 truncate">
                  {listing.title}
                </h3>
                <p className="text-sm text-slate-600 mt-1 line-clamp-2">
                  {listing.description}
                </p>
              </div>

              {/* Price & Status badges */}
              <div className="flex items-center gap-2.5 flex-shrink-0">
                <div className="text-right mr-1">
                  <div className="text-base font-bold text-slate-900">
                    ${(listing.price ?? 19.99).toFixed(2)}
                  </div>
                  {listing.suggestedPriceRange && (
                    <div className="text-[11px] text-slate-500">
                      Comps ${listing.suggestedPriceRange.min.toFixed(0)}-
                      ${listing.suggestedPriceRange.max.toFixed(0)}
                    </div>
                  )}
                </div>

                <span
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg border ${conditionStyle}`}
                >
                  {CONDITIONS.find((c) => c.value === listing.condition)?.label}
                </span>

                {listing.status === 'submitted' ? (
                  <div className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Saved on eBay
                  </div>
                ) : (
                  <span className="px-2.5 py-1 text-xs font-medium rounded-lg bg-slate-100 text-slate-700">
                    Draft
                  </span>
                )}
              </div>
            </div>

            {/* Quick metadata bar */}
            <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-slate-500">
              <span>{currentPhotos.length} photos</span>
              <span>
                Category: <strong className="text-slate-700">{listing.category.split(' > ').pop()}</strong>
                {listing.categoryId && ` (#${listing.categoryId})`}
              </span>
              {comps && (
                <span className="inline-flex items-center gap-1 text-blue-700 font-medium">
                  {comps.source === 'ai_estimate'
                    ? 'AI price estimate'
                    : `${comps.count} eBay comps (median $${comps.medianPrice.toFixed(2)})`}
                </span>
              )}
              {specificsAudit.isComplete ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  {specificsAudit.filledCount}/{specificsAudit.totalCount} Specifics
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-800 font-medium">
                  <span>{specificsAudit.filledCount}/{specificsAudit.totalCount} Specifics</span>
                  {specificsAudit.missing.length > 0 && (
                    <span className="text-amber-600">
                      (Missing {specificsAudit.missing.slice(0, 2).join(', ')})
                    </span>
                  )}
                </span>
              )}
              {tips.length > 0 && (
                <span className="text-amber-700 font-medium">
                  {tips.length} photo tip{tips.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Expand chevron */}
          <button
            type="button"
            className={`
              w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0
              ${
                isExpanded
                  ? 'bg-blue-100 text-blue-700 rotate-180'
                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
              }
            `}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="px-4 pb-4 pt-0 animate-fade-in" onClick={(e) => e.stopPropagation()}>
          <div className="border-t border-slate-200 pt-4 space-y-4">
            {/* Tips */}
            {tips.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="text-xs font-semibold text-amber-900 mb-1.5">
                  Photo recommendations:
                </p>
                <ul className="space-y-1">
                  {tips.map((tip, i) => (
                    <li key={i} className="text-xs text-amber-800 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-amber-500 rounded-full" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Photos strip */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                  Photos ({currentPhotos.length})
                </span>
                <span className="text-[11px] text-slate-500">
                  Photo #1 is your eBay cover image. Click &quot;Make Cover&quot; on any photo to set it as primary.
                </span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2">
                {currentPhotos.map((photo, pIdx) => (
                  <div
                    key={photo.id}
                    className={`relative aspect-square rounded-xl overflow-hidden bg-slate-100 border-2 transition-all group/thumb ${
                      pIdx === 0
                        ? 'border-blue-600 ring-2 ring-blue-100 shadow-sm'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <Image
                      src={photo.url}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="80px"
                    />
                    {pIdx === 0 ? (
                      <span className="absolute top-1 left-1 bg-slate-900/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">
                        ★ Cover
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSetCoverPhoto(photo.id);
                        }}
                        className="absolute bottom-1 inset-x-1 bg-white/95 hover:bg-white text-slate-800 text-[10px] font-bold py-1 rounded shadow-sm opacity-90 sm:opacity-0 sm:group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center gap-1 border border-slate-200"
                        title="Set as primary eBay search cover photo"
                      >
                        ★ Cover
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Market Comps Panel */}
            <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-900">
                    eBay Market Comps
                  </span>
                  {comps && comps.count > 0 ? (
                    <p className="text-xs text-slate-700 mt-0.5">
                      Based on <strong>{comps.count}</strong> recent eBay listings for{' '}
                      <span className="font-medium">&quot;{comps.query}&quot;</span>: Range{' '}
                      <strong>${comps.minPrice.toFixed(2)}</strong> to{' '}
                      <strong>${comps.maxPrice.toFixed(2)}</strong> · Median{' '}
                      <strong>${comps.medianPrice.toFixed(2)}</strong> · Recommended{' '}
                      <strong>${comps.recommendedPrice.toFixed(2)}</strong>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-600 mt-0.5">
                      Estimated range:{' '}
                      <strong>
                        ${(listing.suggestedPriceRange?.min ?? 15).toFixed(2)} to $
                        {(listing.suggestedPriceRange?.max ?? 35).toFixed(2)}
                      </strong>
                      . Click Refresh Comps to search eBay using the current title.
                    </p>
                  )}
                </div>

                {onRefreshComps && (
                  <button
                    type="button"
                    disabled={isRefreshingComps}
                    onClick={() => onRefreshComps(listing.id, listing.title)}
                    className="px-3 py-1.5 text-xs font-semibold text-blue-800 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 transition-colors disabled:opacity-50"
                  >
                    {isRefreshingComps ? 'Searching eBay...' : 'Refresh Comps'}
                  </button>
                )}
              </div>

              {comps && comps.sampleItems.length > 0 && (
                <div className="mt-2.5 pt-2.5 border-t border-blue-200/70 grid sm:grid-cols-2 gap-1.5">
                  {comps.sampleItems.slice(0, 4).map((item, idx) => (
                    <div
                      key={idx}
                      className="text-xs text-slate-700 flex items-center justify-between gap-2 bg-white/80 px-2.5 py-1 rounded border border-blue-100"
                    >
                      {item.itemWebUrl ? (
                        <a
                          href={item.itemWebUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate hover:text-blue-700 hover:underline"
                        >
                          {item.title}
                        </a>
                      ) : (
                        <span className="truncate">{item.title}</span>
                      )}
                      <span className="font-semibold text-slate-900 flex-shrink-0">
                        ${item.price.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Listing form */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-4 border border-slate-200">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                  Title <span className="text-slate-400 font-normal">({listing.title.length}/80)</span>
                </label>
                <input
                  type="text"
                  value={listing.title}
                  onChange={(e) =>
                    onListingChange?.({
                      ...listing,
                      title: e.target.value.slice(0, 80),
                      updatedAt: new Date(),
                    })
                  }
                  maxLength={80}
                  className="w-full px-3.5 py-2 text-sm text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 bg-white"
                />
              </div>

              {/* Category and Condition */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                    Category {listing.categoryId ? `(Leaf ID #${listing.categoryId})` : ''}
                  </label>
                  <input
                    type="text"
                    value={listing.category}
                    onChange={(e) =>
                      onListingChange?.({
                        ...listing,
                        category: e.target.value,
                        updatedAt: new Date(),
                      })
                    }
                    className="w-full px-3.5 py-2 text-sm text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                    Condition
                  </label>
                  <select
                    value={listing.condition}
                    onChange={(e) =>
                      onListingChange?.({
                        ...listing,
                        condition: e.target.value as Listing['condition'],
                        updatedAt: new Date(),
                      })
                    }
                    className="w-full px-3.5 py-2 text-sm text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 bg-white"
                  >
                    {CONDITIONS.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                  Description
                </label>
                <textarea
                  value={listing.description}
                  onChange={(e) =>
                    onListingChange?.({
                      ...listing,
                      description: e.target.value,
                      updatedAt: new Date(),
                    })
                  }
                  rows={3}
                  className="w-full px-3.5 py-2 text-sm text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 bg-white resize-y"
                />
              </div>

              {/* Item Specifics */}
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Item Specifics (eBay Required Aspects)
                  </label>
                  <span
                    className={`text-xs font-semibold ${
                      specificsAudit.isComplete ? 'text-emerald-700' : 'text-amber-800'
                    }`}
                  >
                    {specificsAudit.filledCount} of {specificsAudit.totalCount} core aspects filled
                  </span>
                </div>

                {specificsAudit.missing.length > 0 && (
                  <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex flex-wrap items-center gap-2">
                    <span className="text-xs text-amber-900 font-semibold">Recommended to add:</span>
                    {specificsAudit.missing.map((aspect) => (
                      <button
                        key={aspect}
                        type="button"
                        onClick={() => setNewSpecKey(aspect)}
                        className="px-2 py-0.5 text-xs font-medium rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 hover:border-amber-400 transition-all shadow-2xs"
                        title={`Click to fill in ${aspect}`}
                      >
                        + {aspect}
                      </button>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {Object.entries(listing.itemSpecifics).map(([key, value]) => (
                    <div key={key} className="relative">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-slate-500 capitalize">
                          {key}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleRemoveSpecific(key)}
                          className="text-[11px] text-slate-400 hover:text-red-600"
                          title="Remove specific"
                        >
                          Remove
                        </button>
                      </div>
                      <input
                        type="text"
                        value={value || ''}
                        onChange={(e) =>
                          onListingChange?.({
                            ...listing,
                            itemSpecifics: {
                              ...listing.itemSpecifics,
                              [key]: e.target.value,
                            },
                            updatedAt: new Date(),
                          })
                        }
                        className="w-full px-3 py-1.5 text-sm text-slate-900 border border-slate-300 rounded-lg focus:outline-none focus:border-blue-600 bg-white"
                      />
                    </div>
                  ))}
                </div>

                {/* Add custom item specific */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newSpecKey}
                    onChange={(e) => setNewSpecKey(e.target.value)}
                    placeholder="Aspect name (e.g. Inseam)"
                    className="px-3 py-1.5 text-xs text-slate-900 border border-slate-300 rounded-lg bg-white"
                  />
                  <input
                    type="text"
                    value={newSpecVal}
                    onChange={(e) => setNewSpecVal(e.target.value)}
                    placeholder="Value (e.g. 30 in)"
                    className="px-3 py-1.5 text-xs text-slate-900 border border-slate-300 rounded-lg bg-white"
                  />
                  <button
                    type="button"
                    onClick={handleAddSpecific}
                    className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100"
                  >
                    + Add Specific
                  </button>
                </div>
              </div>

              {/* Price, Shipping, Returns */}
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                    Price (USD)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
                      $
                    </span>
                    <input
                      type="number"
                      value={listing.price ?? ''}
                      onChange={(e) =>
                        onListingChange?.({
                          ...listing,
                          price: e.target.value ? parseFloat(e.target.value) : undefined,
                          updatedAt: new Date(),
                        })
                      }
                      placeholder="19.99"
                      min="0"
                      step="0.01"
                      className="w-full pl-7 pr-3.5 py-2 text-sm font-semibold text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 bg-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                    Shipping Policy
                  </label>
                  <select
                    value={listing.shippingPaidBy}
                    onChange={(e) =>
                      onListingChange?.({
                        ...listing,
                        shippingPaidBy: e.target.value as 'buyer' | 'seller',
                        updatedAt: new Date(),
                      })
                    }
                    className="w-full px-3.5 py-2 text-sm text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 bg-white"
                  >
                    <option value="buyer">Buyer pays shipping</option>
                    <option value="seller">Free shipping (Seller pays)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1.5">
                    Return Policy
                  </label>
                  <select
                    value={listing.acceptsReturns ? 'yes' : 'no'}
                    onChange={(e) =>
                      onListingChange?.({
                        ...listing,
                        acceptsReturns: e.target.value === 'yes',
                        updatedAt: new Date(),
                      })
                    }
                    className="w-full px-3.5 py-2 text-sm text-slate-900 border border-slate-300 rounded-xl focus:outline-none focus:border-blue-600 bg-white"
                  >
                    <option value="no">No returns</option>
                    <option value="yes">30-day returns accepted</option>
                  </select>
                </div>
              </div>

              {/* Submit individual listing button */}
              {onSubmitListing && (
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <div className="text-xs text-slate-500">
                    {listing.ebaySku && (
                      <span>
                        SKU: <code className="text-slate-700">{listing.ebaySku}</code>
                      </span>
                    )}
                    {listing.ebayOfferId && (
                      <span className="ml-3">
                        Offer ID: <code className="text-slate-700">{listing.ebayOfferId}</code>
                      </span>
                    )}
                  </div>

                  {listing.status === 'submitted' ? (
                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-800 rounded-xl text-sm font-semibold">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Saved on eBay
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSubmitListing(listing)}
                      disabled={submittingId === listing.id}
                      className={`
                        px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all
                        ${
                          submittingId === listing.id
                            ? 'bg-slate-400 cursor-not-allowed'
                            : 'bg-emerald-700 hover:bg-emerald-800 shadow-sm'
                        }
                      `}
                    >
                      {submittingId === listing.id ? (
                        <span className="flex items-center gap-2">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Uploading & Saving...
                        </span>
                      ) : (
                        'Save Draft to eBay'
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
