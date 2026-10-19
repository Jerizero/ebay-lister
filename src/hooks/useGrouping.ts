import { useState, useCallback, useRef } from 'react';
import { Photo, PhotoGroup, Listing } from '@/types';
import { fileToBase64, resizeImage, generateId, computePhotoSignature } from '@/lib/utils';

interface GroupingCallbacks {
  onProgressStart: (message: string, total: number) => void;
  onProgressUpdate: (current: number, subMessage?: string) => void;
  onProgressMessage: (message: string, subMessage?: string) => void;
  onProgressSetTotal: (total: number) => void;
  onProgressFinish: () => void;
}

/**
 * Determine which groups need listing generation (new groups or groups whose photos changed)
 * vs which groups already have a valid, up-to-date listing.
 */
export function partitionDirtyGroups(
  validGroups: PhotoGroup[],
  existingListings: Listing[]
): {
  keptListings: Listing[];
  dirtyGroups: PhotoGroup[];
} {
  const keptListings: Listing[] = [];
  const dirtyGroups: PhotoGroup[] = [];

  for (const group of validGroups) {
    const signature = computePhotoSignature(group.photos);
    const match = existingListings.find(
      (l) =>
        (l.groupId === group.id && l.photoSignature === signature) ||
        (l.photoSignature && l.photoSignature === signature)
    );

    if (match) {
      // Keep existing listing (preserving user edits) and sync groupId/photos reference
      keptListings.push({
        ...match,
        groupId: group.id,
        photos: group.photos,
        photoSignature: signature,
      });
    } else {
      dirtyGroups.push(group);
    }
  }

  return { keptListings, dirtyGroups };
}

export function useGrouping(callbacks: GroupingCallbacks) {
  const [groups, setGroups] = useState<PhotoGroup[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [refreshingCompId, setRefreshingCompId] = useState<string | null>(null);

  // Cache resized base64 by photo.id so we never resize the same photo twice in a session
  const resizedCacheRef = useRef<Map<string, { base64: string; mimeType: string }>>(new Map());

  const ensurePhotoResized = async (
    photo: Photo
  ): Promise<{ base64: string; mimeType: string }> => {
    const cached = resizedCacheRef.current.get(photo.id);
    if (cached) return cached;

    const resized = await resizeImage(photo.file, 960);
    const base64 = await fileToBase64(resized);
    const entry = { base64, mimeType: 'image/jpeg' };
    resizedCacheRef.current.set(photo.id, entry);
    return entry;
  };

  const generateListingWithRetry = async (
    group: PhotoGroup,
    groupPhotoData: { base64: string; mimeType: string }[],
    retries = 2
  ): Promise<Listing | null> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1200 * attempt));
        }

        const listingResponse = await fetch('/api/generate-listing', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photos: groupPhotoData,
            groupDescription: group.aiDescription,
          }),
        });

        if (listingResponse.ok) {
          const listingData = await listingResponse.json();
          const recommendedPrice =
            listingData.suggestedPrice?.recommended ??
            listingData.suggestedPrice?.min ??
            19.99;

          return {
            id: generateId(),
            groupId: group.id,
            photos: group.photos,
            photoSignature: computePhotoSignature(group.photos),
            title: listingData.title,
            description: listingData.description,
            category: listingData.category,
            categoryId: listingData.categoryId,
            condition: listingData.condition,
            itemSpecifics: listingData.itemSpecifics || {},
            price: recommendedPrice,
            suggestedPriceRange: listingData.suggestedPrice
              ? {
                  min: listingData.suggestedPrice.min,
                  max: listingData.suggestedPrice.max,
                }
              : undefined,
            comps: listingData.comps,
            shippingPaidBy: 'buyer',
            acceptsReturns: false,
            status: 'draft',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
        }
      } catch (err) {
        console.error(`Attempt ${attempt + 1} failed for group:`, err);
      }
    }
    return null;
  };

  /**
   * Stage 1: Group photos with AI vision and pause so the user can review/edit groups
   * before spending API calls on full listing generation.
   */
  const startGrouping = useCallback(
    async (photos: Photo[]) => {
      if (photos.length === 0) return [];

      setIsProcessing(true);
      callbacks.onProgressStart('Preparing photos', photos.length);
      callbacks.onProgressUpdate(0, 'Resizing images for AI grouping...');

      try {
        const photoData: { base64: string; mimeType: string }[] = [];

        for (let i = 0; i < photos.length; i++) {
          callbacks.onProgressUpdate(
            i + 1,
            `Preparing photo ${i + 1} of ${photos.length}...`
          );
          const entry = await ensurePhotoResized(photos[i]);
          photoData.push(entry);
        }

        callbacks.onProgressMessage(
          'Grouping photos with AI',
          'Identifying individual items across angles and tags...'
        );
        callbacks.onProgressSetTotal(1);

        const response = await fetch('/api/group-photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photos: photoData }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to group photos');
        }

        const result = await response.json();

        const photoGroups: PhotoGroup[] = result.groups.map(
          (group: {
            photoIndices: number[];
            confidence: number;
            description: string;
            flagged?: boolean;
          }) => ({
            id: generateId(),
            photos: group.photoIndices
              .map((idx: number) => photos[idx])
              .filter(Boolean),
            confidence: group.confidence,
            aiDescription: group.description,
            flagged: group.flagged || false,
          })
        );

        setGroups(photoGroups);
        setListings([]);
        callbacks.onProgressFinish();
        return photoGroups;
      } finally {
        setIsProcessing(false);
      }
    },
    [callbacks]
  );

  /**
   * Stage 2: Generate listings (and real eBay comps) ONLY for groups that are new or modified.
   * Preserves existing listings for untouched groups.
   */
  const generateListingsForGroups = useCallback(
    async (targetGroups?: PhotoGroup[]) => {
      const activeGroups = targetGroups ?? groups;
      const validGroups = activeGroups.filter((g) => !g.flagged && g.photos.length > 0);

      const { keptListings, dirtyGroups } = partitionDirtyGroups(validGroups, listings);

      // Update immediately with kept listings
      setListings(keptListings);

      if (dirtyGroups.length === 0) {
        return keptListings;
      }

      setIsProcessing(true);
      callbacks.onProgressStart(
        'Generating listings & eBay comps',
        dirtyGroups.length
      );

      try {
        const workingListings = [...keptListings];
        let completedCount = 0;

        // Bounded concurrency (2 parallel workers) for fast generation without rate-limit spikes
        const CONCURRENCY = 2;
        const queue = [...dirtyGroups];

        const runWorker = async () => {
          while (queue.length > 0) {
            const group = queue.shift();
            if (!group) break;

            callbacks.onProgressUpdate(
              completedCount,
              `Pricing & drafting "${(group.aiDescription || 'Item').slice(0, 42)}..."`
            );

            const groupPhotoData = await Promise.all(
              group.photos.map((p) => ensurePhotoResized(p))
            );

            const generated = await generateListingWithRetry(group, groupPhotoData);
            completedCount += 1;

            if (generated) {
              workingListings.push(generated);
              // Order listings to match validGroups order
              const ordered = validGroups
                .map((vg) => workingListings.find((l) => l.groupId === vg.id))
                .filter((l): l is Listing => Boolean(l));
              setListings(ordered);
            }

            callbacks.onProgressUpdate(
              completedCount,
              `Completed ${completedCount} of ${dirtyGroups.length}`
            );
          }
        };

        await Promise.all(
          Array.from({ length: Math.min(CONCURRENCY, dirtyGroups.length) }, () =>
            runWorker()
          )
        );

        callbacks.onProgressFinish();
        return workingListings;
      } finally {
        setIsProcessing(false);
      }
    },
    [groups, listings, callbacks]
  );

  const refreshListingComps = useCallback(async (listingId: string, query: string) => {
    setRefreshingCompId(listingId);
    try {
      const res = await fetch(`/api/ebay/comps?q=${encodeURIComponent(query)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data?.comps) {
        setListings((prev) =>
          prev.map((l) =>
            l.id === listingId
              ? {
                  ...l,
                  comps: data.comps,
                  price: data.comps.recommendedPrice,
                  suggestedPriceRange: {
                    min: data.comps.minPrice,
                    max: data.comps.maxPrice,
                  },
                  updatedAt: new Date(),
                }
              : l
          )
        );
      }
    } finally {
      setRefreshingCompId(null);
    }
  }, []);

  const updateListing = useCallback((updatedListing: Listing) => {
    setListings((prev) =>
      prev.map((l) => (l.id === updatedListing.id ? updatedListing : l))
    );
  }, []);

  const batchUpdateListings = useCallback(
    (updater: (prev: Listing[]) => Listing[]) => {
      setListings((prev) => updater(prev));
    },
    []
  );

  const markSubmitted = useCallback(
    (id: string, offerId?: string, sku?: string) => {
      setListings((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
                ...l,
                status: 'submitted' as const,
                ebayOfferId: offerId || l.ebayOfferId,
                ebaySku: sku || l.ebaySku,
                updatedAt: new Date(),
              }
            : l
        )
      );
    },
    []
  );

  const restoreGroupingState = useCallback(
    (restoredGroups: PhotoGroup[], restoredListings: Listing[]) => {
      setGroups(restoredGroups);
      setListings(restoredListings);
    },
    []
  );

  const resetGroups = useCallback(() => {
    setGroups([]);
    setListings([]);
    resizedCacheRef.current.clear();
  }, []);

  return {
    groups,
    setGroups,
    listings,
    isProcessing,
    refreshingCompId,
    startGrouping,
    generateListingsForGroups,
    refreshListingComps,
    updateListing,
    batchUpdateListings,
    markSubmitted,
    restoreGroupingState,
    resetGroups,
  };
}
