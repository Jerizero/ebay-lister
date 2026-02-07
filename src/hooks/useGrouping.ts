import { useState, useCallback } from 'react';
import { Photo, PhotoGroup, Listing } from '@/types';
import { fileToBase64, resizeImage, generateId } from '@/lib/utils';

interface GroupingCallbacks {
  onProgressStart: (message: string, total: number) => void;
  onProgressUpdate: (current: number, subMessage?: string) => void;
  onProgressMessage: (message: string, subMessage?: string) => void;
  onProgressSetTotal: (total: number) => void;
  onProgressFinish: () => void;
}

export function useGrouping(callbacks: GroupingCallbacks) {
  const [groups, setGroups] = useState<PhotoGroup[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const generateListingWithRetry = async (
    group: PhotoGroup,
    groupPhotoData: { base64: string; mimeType: string }[],
    retries = 2
  ): Promise<Listing | null> => {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
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

          return {
            id: generateId(),
            groupId: group.id,
            photos: group.photos,
            title: listingData.title,
            description: listingData.description,
            category: listingData.category,
            condition: listingData.condition,
            itemSpecifics: listingData.itemSpecifics || {},
            price: listingData.suggestedPrice?.min,
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

  const startGrouping = useCallback(async (photos: Photo[]) => {
    if (photos.length === 0) return;

    setIsProcessing(true);
    callbacks.onProgressStart('Preparing photos', photos.length);
    callbacks.onProgressUpdate(0, 'Resizing images for AI analysis...');

    try {
      // Step 1: Resize and convert photos to base64
      const photoData: { base64: string; mimeType: string }[] = [];

      for (let i = 0; i < photos.length; i++) {
        callbacks.onProgressUpdate(i + 1, `Resizing photo ${i + 1} of ${photos.length}...`);

        const resized = await resizeImage(photos[i].file, 800);
        const base64 = await fileToBase64(resized);

        photoData.push({ base64, mimeType: 'image/jpeg' });
      }

      // Step 2: Send to AI for grouping
      callbacks.onProgressMessage('Grouping photos', 'AI is identifying individual items...');
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

      // Step 3: Convert API response to PhotoGroup format
      const photoGroups: PhotoGroup[] = result.groups.map((group: {
        photoIndices: number[];
        confidence: number;
        description: string;
        flagged?: boolean;
      }) => ({
        id: generateId(),
        photos: group.photoIndices.map((idx: number) => photos[idx]),
        confidence: group.confidence,
        aiDescription: group.description,
        flagged: group.flagged || false,
      }));

      setGroups(photoGroups);

      // Step 4: Generate listings for each group with retry logic
      const validGroups = photoGroups.filter(g => !g.flagged);
      const newListings: Listing[] = [];

      callbacks.onProgressMessage('Generating listings');
      callbacks.onProgressSetTotal(validGroups.length);

      for (let i = 0; i < validGroups.length; i++) {
        const group = validGroups[i];
        callbacks.onProgressUpdate(i + 1, `"${group.aiDescription?.slice(0, 40)}..."`);

        // Rate limiting: wait 3.5s between calls to stay under Gemini's 20/min free tier limit
        if (i > 0) {
          await new Promise(resolve => setTimeout(resolve, 3500));
        }

        const groupPhotoData = group.photos.map(photo => {
          const idx = photos.findIndex(p => p.id === photo.id);
          return photoData[idx];
        });

        const listing = await generateListingWithRetry(group, groupPhotoData);
        if (listing) {
          newListings.push(listing);
          setListings([...newListings]);
        }
      }

      setIsProcessing(false);
      callbacks.onProgressFinish();

      return photoGroups;
    } catch (err) {
      console.error('Grouping error:', err);
      throw err;
    } finally {
      setIsProcessing(false);
    }
  }, [callbacks]);

  const updateListing = useCallback((updatedListing: Listing) => {
    setListings(prev => prev.map(l =>
      l.id === updatedListing.id ? updatedListing : l
    ));
  }, []);

  const markSubmitted = useCallback((id: string) => {
    setListings(prev => prev.map(l =>
      l.id === id ? { ...l, status: 'submitted' as const } : l
    ));
  }, []);

  const resetGroups = useCallback(() => {
    setGroups([]);
    setListings([]);
  }, []);

  return {
    groups,
    setGroups,
    listings,
    isProcessing,
    startGrouping,
    updateListing,
    markSubmitted,
    resetGroups,
  };
}
