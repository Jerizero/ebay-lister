import { useState, useCallback } from 'react';
import { Listing, SubmitDraftsResponse } from '@/types';
import { fileToBase64, resizeImage } from '@/lib/utils';

interface SubmissionCallbacks {
  onProgressStart: (message: string, total: number) => void;
  onProgressUpdate: (current: number, subMessage?: string) => void;
  onProgressFinish: () => void;
  onMarkSubmitted: (id: string, offerId?: string, sku?: string) => void;
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

  const submitAll = useCallback(
    async (listings: Listing[]): Promise<string | null> => {
      if (!isConnected) {
        throw new Error('Please connect your eBay account first.');
      }

      const unsubmitted = listings.filter((l) => l.status !== 'submitted');
      if (unsubmitted.length === 0) {
        throw new Error('All listings have already been submitted to eBay.');
      }

      setIsSubmitting(true);
      setSubmitSuccess(null);
      callbacks.onProgressStart('Submitting to eBay', unsubmitted.length);

      try {
        const listingsWithPhotos = await Promise.all(
          unsubmitted.map(async (listing, idx) => {
            callbacks.onProgressUpdate(
              idx + 1,
              `Preparing high-res photos for "${listing.title.slice(0, 35)}..."`
            );
            const photoBase64s = await prepareListingPhotos(listing.photos);
            return {
              id: listing.id,
              title: listing.title,
              description: listing.description,
              category: listing.category,
              categoryId: listing.categoryId,
              condition: listing.condition,
              price: listing.price,
              shippingPaidBy: listing.shippingPaidBy,
              acceptsReturns: listing.acceptsReturns,
              itemSpecifics: listing.itemSpecifics,
              photoBase64s,
            };
          })
        );

        callbacks.onProgressUpdate(unsubmitted.length, 'Uploading photos and creating eBay offers...');

        const response = await fetch('/api/ebay/submit-drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ listings: listingsWithPhotos }),
        });

        const result: SubmitDraftsResponse = await response.json();

        if (!response.ok) {
          throw new Error((result as { error?: string }).error || 'Failed to submit drafts');
        }

        const succeeded = result.results.filter((r) => !r.error);
        const failed = result.results.filter((r) => r.error);

        // Mark every succeeded item as submitted (fixes bug where bulk submit left items unsubmitted)
        for (const item of succeeded) {
          callbacks.onMarkSubmitted(item.listingId, item.offerId, item.sku);
        }

        let errorMsg: string | null = null;
        if (failed.length > 0) {
          const errors = failed.map((r) => r.error).join('; ');
          errorMsg = `${failed.length} listing(s) failed: ${errors}`;
        }

        if (succeeded.length > 0) {
          setSubmitSuccess(
            `${succeeded.length} listing${succeeded.length !== 1 ? 's' : ''} saved to eBay Inventory (Offer IDs recorded).`
          );
        }

        return errorMsg;
      } finally {
        setIsSubmitting(false);
        callbacks.onProgressFinish();
      }
    },
    [isConnected, callbacks]
  );

  const submitSingle = useCallback(
    async (listing: Listing): Promise<string | null> => {
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
          categoryId: listing.categoryId,
          condition: listing.condition,
          price: listing.price,
          shippingPaidBy: listing.shippingPaidBy,
          acceptsReturns: listing.acceptsReturns,
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

        setSubmitSuccess(
          `"${listing.title.slice(0, 40)}..." saved to eBay (SKU: ${listingResult.sku}, Offer: ${listingResult.offerId})`
        );
        callbacks.onMarkSubmitted(listing.id, listingResult.offerId, listingResult.sku);
        return null;
      } finally {
        setSubmittingId(null);
      }
    },
    [isConnected, callbacks]
  );

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
