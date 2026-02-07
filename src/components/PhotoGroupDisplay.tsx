'use client';

import { useState } from 'react';
import { PhotoGroup, Listing } from '@/types';
import Image from 'next/image';

interface PhotoGroupDisplayProps {
  groups: PhotoGroup[];
  listings: Listing[];
  onEditGroups?: () => void;
  onSaveDrafts?: () => void;
  onListingChange?: (listing: Listing) => void;
  onSubmitListing?: (listing: Listing) => void;
  submittingId?: string | null;
}

// Check if item is clothing
function isClothing(description: string): boolean {
  const clothingKeywords = ['jeans', 'pants', 'shorts', 'shirt', 'top', 'blouse', 'sweater',
    'jacket', 'coat', 'dress', 'skirt', 'hoodie', 'cardigan', 'polo', 'tee', 't-shirt',
    'crewneck', 'pullover', 'blazer', 'vest', 'tank'];
  return clothingKeywords.some(keyword => description.includes(keyword));
}

// Tips for improving listings
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

// Get common tips across groups
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
  return allTips.filter(tip => !commonTips.includes(tip)).slice(0, 2);
}

const CONDITIONS = [
  { value: 'NEW', label: 'New', color: 'bg-emerald-100 text-emerald-700' },
  { value: 'LIKE_NEW', label: 'Like New', color: 'bg-blue-100 text-blue-700' },
  { value: 'GOOD', label: 'Good', color: 'bg-amber-100 text-amber-700' },
  { value: 'ACCEPTABLE', label: 'Acceptable', color: 'bg-slate-100 text-slate-700' },
] as const;

export function PhotoGroupDisplay({
  groups,
  listings,
  onEditGroups,
  onSaveDrafts,
  onListingChange,
  onSubmitListing,
  submittingId,
}: PhotoGroupDisplayProps) {
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);

  const getListing = (groupId: string) => listings.find(l => l.groupId === groupId);

  if (groups.length === 0) {
    return null;
  }

  const flaggedGroups = groups.filter(g => g.flagged);
  const validGroups = groups.filter(g => !g.flagged);

  // Only show groups that have listing data ready
  const readyGroups = validGroups.filter(g => getListing(g.id));
  const pendingGroups = validGroups.filter(g => !getListing(g.id));

  const commonTips = getCommonTips(readyGroups);

  return (
    <div className="space-y-6">
      {/* Flagged content warning */}
      {flaggedGroups.length > 0 && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-red-800">Content Flagged</h3>
              <p className="text-sm text-red-600 mt-1">
                {flaggedGroups.length} item{flaggedGroups.length !== 1 ? 's were' : ' was'} flagged as potentially inappropriate. These have been excluded.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Common tips banner */}
      {commonTips.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h3 className="font-semibold text-amber-800">Pro Tips for All Listings</h3>
              <ul className="mt-2 space-y-1">
                {commonTips.map((tip, i) => (
                  <li key={i} className="text-sm text-amber-700 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-amber-400 rounded-full" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Pending listings indicator */}
      {pendingGroups.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-indigo-400 border-t-indigo-600 rounded-full animate-spin" />
              </div>
              <div>
                <p className="font-medium text-indigo-900">
                  Generating {pendingGroups.length} more listing{pendingGroups.length !== 1 ? 's' : ''}...
                </p>
                <p className="text-sm text-indigo-600">They will appear below when ready</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Ready to Review
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            {readyGroups.length} listing{readyGroups.length !== 1 ? 's' : ''} ready
            {pendingGroups.length > 0 && ` | ${pendingGroups.length} generating`}
          </p>
        </div>
        <div className="flex gap-3">
          {onEditGroups && (
            <button
              onClick={onEditGroups}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
            >
              Edit Groups
            </button>
          )}
          {onSaveDrafts && readyGroups.length > 0 && (
            <button
              onClick={onSaveDrafts}
              className="px-5 py-2.5 text-sm font-semibold text-white rounded-xl btn-primary"
            >
              Save All Drafts
            </button>
          )}
        </div>
      </div>

      {/* Ready listings grid */}
      <div className="grid gap-4">
        {readyGroups.map((group, index) => {
          const listing = getListing(group.id)!;
          const isExpanded = expandedGroupId === group.id;
          const tips = getUniqueTips(group, commonTips);
          const conditionStyle = CONDITIONS.find(c => c.value === listing.condition)?.color || 'bg-slate-100 text-slate-700';

          return (
            <div
              key={group.id}
              className={`
                bg-white rounded-2xl border transition-all duration-300 animate-fade-in-up
                ${isExpanded
                  ? 'border-indigo-300 shadow-xl shadow-indigo-500/10'
                  : 'border-slate-200 shadow-sm hover:shadow-md hover:border-slate-300'
                }
              `}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Card header - always visible */}
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedGroupId(isExpanded ? null : group.id)}
              >
                <div className="flex items-start gap-4">
                  {/* Photo stack preview */}
                  <div className="relative flex-shrink-0">
                    <div className="relative w-24 h-24">
                      {group.photos.slice(0, 3).map((photo, i) => (
                        <div
                          key={photo.id}
                          className="absolute rounded-xl overflow-hidden bg-slate-100 shadow-lg border-2 border-white"
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
                    {group.photos.length > 3 && (
                      <span className="absolute -bottom-1 -right-1 bg-slate-800 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                        +{group.photos.length - 3}
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
                        <p className="text-sm text-slate-500 mt-1 line-clamp-2">
                          {listing.description}
                        </p>
                      </div>

                      {/* Status indicator */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-lg ${conditionStyle}`}>
                          {CONDITIONS.find(c => c.value === listing.condition)?.label}
                        </span>
                        {listing.status === 'submitted' ? (
                          <div className="px-2.5 py-1 text-xs font-medium rounded-lg bg-emerald-100 text-emerald-700 flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                            Submitted
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                            <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick stats */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {group.photos.length} photos
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {listing.category.split(' > ').pop()}
                      </span>
                      {listing.price && (
                        <span className="font-medium text-slate-700">
                          ${listing.price.toFixed(2)}
                        </span>
                      )}
                      {tips.length > 0 && (
                        <span className="flex items-center gap-1 text-amber-500">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          {tips.length} tips
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Expand indicator */}
                  <button className={`
                    w-8 h-8 rounded-full flex items-center justify-center transition-all flex-shrink-0
                    ${isExpanded
                      ? 'bg-indigo-100 text-indigo-600 rotate-180'
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                    }
                  `}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-0 animate-fade-in">
                  <div className="border-t border-slate-100 pt-4">
                    {/* Tips */}
                    {tips.length > 0 && (
                      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <p className="text-xs font-semibold text-amber-800 mb-2">Suggested improvements:</p>
                        <ul className="space-y-1">
                          {tips.map((tip, i) => (
                            <li key={i} className="text-sm text-amber-700 flex items-center gap-2">
                              <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Photos grid */}
                    <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-2 mb-4">
                      {group.photos.map((photo) => (
                        <div
                          key={photo.id}
                          className="relative aspect-square rounded-lg overflow-hidden bg-slate-100"
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

                    {/* Listing form */}
                    <div className="bg-slate-50 rounded-xl p-4 space-y-4">
                      {/* Title */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Title <span className="text-slate-400 font-normal">({listing.title.length}/80)</span>
                        </label>
                        <input
                          type="text"
                          value={listing.title}
                          onChange={(e) => onListingChange?.({
                            ...listing,
                            title: e.target.value.slice(0, 80),
                            updatedAt: new Date()
                          })}
                          maxLength={80}
                          className="w-full px-4 py-2.5 text-sm text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-indigo-400 transition-colors bg-white"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      {/* Category and Condition */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                            Category
                          </label>
                          <input
                            type="text"
                            value={listing.category}
                            onChange={(e) => onListingChange?.({
                              ...listing,
                              category: e.target.value,
                              updatedAt: new Date()
                            })}
                            className="w-full px-4 py-2.5 text-sm text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-indigo-400 transition-colors bg-white"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                            Condition
                          </label>
                          <select
                            value={listing.condition}
                            onChange={(e) => onListingChange?.({
                              ...listing,
                              condition: e.target.value as Listing['condition'],
                              updatedAt: new Date()
                            })}
                            className="w-full px-4 py-2.5 text-sm text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-indigo-400 transition-colors bg-white"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {CONDITIONS.map((c) => (
                              <option key={c.value} value={c.value}>{c.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                          Description
                        </label>
                        <textarea
                          value={listing.description}
                          onChange={(e) => onListingChange?.({
                            ...listing,
                            description: e.target.value,
                            updatedAt: new Date()
                          })}
                          rows={3}
                          className="w-full px-4 py-2.5 text-sm text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-indigo-400 transition-colors bg-white resize-none"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>

                      {/* Item Specifics */}
                      {Object.keys(listing.itemSpecifics).length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                            Item Specifics
                          </label>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {Object.entries(listing.itemSpecifics).map(([key, value]) => (
                              <div key={key}>
                                <span className="text-xs text-slate-400 capitalize block mb-1">{key}</span>
                                <input
                                  type="text"
                                  value={value || ''}
                                  onChange={(e) => onListingChange?.({
                                    ...listing,
                                    itemSpecifics: { ...listing.itemSpecifics, [key]: e.target.value },
                                    updatedAt: new Date()
                                  })}
                                  className="w-full px-3 py-2 text-sm text-slate-900 border-2 border-slate-200 rounded-lg focus:ring-0 focus:border-indigo-400 transition-colors bg-white"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Price, Shipping, Returns */}
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                            Price
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                            <input
                              type="number"
                              value={listing.price || ''}
                              onChange={(e) => onListingChange?.({
                                ...listing,
                                price: e.target.value ? parseFloat(e.target.value) : undefined,
                                updatedAt: new Date()
                              })}
                              placeholder="0.00"
                              min="0"
                              step="0.01"
                              className="w-full pl-8 pr-4 py-2.5 text-sm text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-indigo-400 transition-colors bg-white"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                            Shipping
                          </label>
                          <select
                            value={listing.shippingPaidBy}
                            onChange={(e) => onListingChange?.({
                              ...listing,
                              shippingPaidBy: e.target.value as 'buyer' | 'seller',
                              updatedAt: new Date()
                            })}
                            className="w-full px-4 py-2.5 text-sm text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-indigo-400 transition-colors bg-white"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="buyer">Buyer pays</option>
                            <option value="seller">Free shipping</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                            Returns
                          </label>
                          <select
                            value={listing.acceptsReturns ? 'yes' : 'no'}
                            onChange={(e) => onListingChange?.({
                              ...listing,
                              acceptsReturns: e.target.value === 'yes',
                              updatedAt: new Date()
                            })}
                            className="w-full px-4 py-2.5 text-sm text-slate-900 border-2 border-slate-200 rounded-xl focus:ring-0 focus:border-indigo-400 transition-colors bg-white"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <option value="no">No returns</option>
                            <option value="yes">Accepts returns</option>
                          </select>
                        </div>
                      </div>

                      {/* Submit individual listing button */}
                      {onSubmitListing && (
                        <div className="mt-4 pt-4 border-t border-slate-200 flex justify-end">
                          {listing.status === 'submitted' ? (
                            <div className="flex items-center gap-2 px-5 py-2.5 bg-emerald-50 text-emerald-700 rounded-xl font-semibold">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Submitted to eBay
                            </div>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSubmitListing(listing);
                              }}
                              disabled={submittingId === listing.id}
                              className={`
                                px-5 py-2.5 rounded-xl font-semibold text-white transition-all
                                ${submittingId === listing.id
                                  ? 'bg-slate-300 cursor-not-allowed'
                                  : 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-lg shadow-emerald-500/30'
                                }
                              `}
                            >
                              {submittingId === listing.id ? (
                                <span className="flex items-center gap-2">
                                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  Submitting...
                                </span>
                              ) : (
                                <span className="flex items-center gap-2">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                  Submit to eBay
                                </span>
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
        })}
      </div>

      {/* Empty state */}
      {readyGroups.length === 0 && pendingGroups.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-900">No listings yet</h3>
          <p className="text-slate-500 mt-1">Upload photos and let AI group them into listings</p>
        </div>
      )}
    </div>
  );
}
