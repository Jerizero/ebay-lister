import { useState, useCallback } from 'react';
import { Listing, SubmitDraftsResponse } from '@/types';
import { fileToBase64, resizeImage } from '@/lib/utils';

interface SubmissionCallbacks {
  onProgressStart: (message: string, total: number) => void;
  onProgressUpdate: (current: number, subMessage?: string) => void;
  onProgressFinish: () => void;
  onMarkSubmitted: (id: string) => void;
}

export function useEbaySubmission(callbacks: SubmissionCallbacks) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const prepareListingPhotos = async (photos: Listing['photos']): Promise<string[]> => {
    const photoBase64s: string[] = [];
    for (const photo of photos) {
      const resized = await resizeImage(photo.file, 1600);
      const base64 = await fileToBase64(resized);
      photoBase64s.push(base64);
    }
    return photoBase64s;
  };

  const submitAll = useCallback(async (listings: Listing[]): Promise<string | null> => {
    if (!isConnected) {
      throw new Error('Please connect your eBay account first.');
    }

    if (listings.length === 0) {
      throw new Error('No listings to submit.');
    }

    setIsSubmitting(true);
    setSubmitSuccess(null);
    callbacks.onProgressStart('Submitting to eBay', listings.length);

    try {
      const listingsWithPhotos = await Promise.all(
        listings.map(async (listing) => {
          const photoBase64s = await prepareListingPhotos(listing.photos);
          return {
            id: listing.id,
            title: listing.title,
            description: listing.description,
            category: listing.category,
            condition: listing.condition,
            price: listing.price,
            itemSpecifics: listing.itemSpecifics,
            photoBase64s,
          };
        })
      );

      callbacks.onProgressUpdate(0, 'Uploading to eBay...');

      const response = await fetch('/api/ebay/submit-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listings: listingsWithPhotos }),
      });

      const result: SubmitDraftsResponse = await response.json();

      if (!response.ok) {
        throw new Error((result as { error?: string }).error || 'Failed to submit drafts');
      }

      const successCount = result.results.filter(r => !r.error).length;
      const failCount = result.results.filter(r => r.error).length;

      let errorMsg: string | null = null;
      if (failCount > 0) {
        const errors = result.results
          .filter(r => r.error)
          .map(r => r.error)
          .join('; ');
        errorMsg = `${failCount} listing(s) failed: ${errors}`;
      }

      if (successCount > 0) {
        setSubmitSuccess(
          `${successCount} listing${successCount !== 1 ? 's' : ''} saved as drafts on eBay!`
        );
      }

      return errorMsg;
    } finally {
      setIsSubmitting(false);
      callbacks.onProgressFinish();
    }
  }, [isConnected, callbacks]);

  const submitSingle = useCallback(async (listing: Listing): Promise<string | null> => {
    if (!isConnected) {
      throw new Error('Please connect your eBay account first.');
    }

    setSubmittingId(listing.id);
    setSubmitSuccess(null);

    try {
      const photoBase64s = await prepareListingPhotos(listing.photos);

      const listingWithPhotos = {
        id: listing.id,
        title: listing.title,
        description: listing.description,
        category: listing.category,
        condition: listing.condition,
        price: listing.price,
        itemSpecifics: listing.itemSpecifics,
        photoBase64s,
      };

      const response = await fetch('/api/ebay/submit-drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listings: [listingWithPhotos] }),
      });

      const result: SubmitDraftsResponse = await response.json();

      if (!response.ok) {
        throw new Error((result as { error?: string }).error || 'Failed to submit draft');
      }

      const listingResult = result.results[0];
      if (listingResult?.error) {
        return `Failed: ${listingResult.error}`;
      }

      setSubmitSuccess(`"${listing.title.slice(0, 40)}..." saved as draft on eBay!`);
      callbacks.onMarkSubmitted(listing.id);
      return null;
    } finally {
      setSubmittingId(null);
    }
  }, [isConnected, callbacks]);

  return {
    isConnected,
    setIsConnected,
    isSubmitting,
    submittingId,
    submitSuccess,
    setSubmitSuccess,
    submitAll,
    submitSingle,
  };
}
