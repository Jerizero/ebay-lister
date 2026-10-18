import { NextRequest, NextResponse } from 'next/server';
import { getConnectionStatus } from '@/lib/ebay/oauth';
import {
  createInventoryItem,
  createOffer,
  publishOffer,
  generateSku,
  findCategoryId,
} from '@/lib/ebay/client';
import { uploadImagesWithMeta } from '@/lib/ebay/images';
import { SubmitDraftsRequest, SubmitDraftsResponse } from '@/types/ebay';
import { Listing } from '@/types';
import { logEvent } from '@/lib/logger';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const start = Date.now();
  try {
    const status = await getConnectionStatus();
    if (!status.connected) {
      return NextResponse.json(
        { error: 'eBay not connected. Please connect your eBay account first.' },
        { status: 401 }
      );
    }

    const body: SubmitDraftsRequest = await request.json();
    const { listings, publish = false } = body;

    if (!listings || listings.length === 0) {
      return NextResponse.json({ error: 'No listings provided' }, { status: 400 });
    }

    for (const listing of listings) {
      if (!listing.title || listing.title.length === 0 || listing.title.length > 80) {
        return NextResponse.json(
          { error: 'Listing title must be 1-80 characters' },
          { status: 400 }
        );
      }
      if (!listing.description) {
        return NextResponse.json(
          { error: 'Listing description is required' },
          { status: 400 }
        );
      }
      if (!listing.photoBase64s || listing.photoBase64s.length === 0) {
        return NextResponse.json(
          { error: 'Each listing must have at least one photo' },
          { status: 400 }
        );
      }
    }

    logEvent('ACTION_START', 'api/ebay/submit-drafts', 'POST', {
      count: listings.length,
      publish,
    });

    const results: SubmitDraftsResponse['results'] = [];

    for (const listingData of listings) {
      const sku = generateSku(listingData.id);

      try {
        // Step 1: Upload images to eBay Picture Services (with sandbox fallback)
        const { urls: imageUrls, hostedVia } = await uploadImagesWithMeta(
          listingData.photoBase64s.map((base64) => ({ base64, mimeType: 'image/jpeg' }))
        );

        if (imageUrls.length === 0) {
          throw new Error('No images could be uploaded');
        }

        // Step 2: Resolve leaf category ID via Taxonomy API or deterministic leaf map
        const categoryId =
          listingData.categoryId ||
          (await findCategoryId(listingData.category, listingData.title));

        // Step 3: Build full Listing object preserving shippingPaidBy & acceptsReturns
        const listing: Listing = {
          id: listingData.id,
          groupId: listingData.id,
          photos: [],
          title: listingData.title,
          description: listingData.description,
          category: listingData.category,
          categoryId,
          condition: listingData.condition as Listing['condition'],
          itemSpecifics: listingData.itemSpecifics as Listing['itemSpecifics'],
          price: listingData.price,
          shippingPaidBy: listingData.shippingPaidBy || 'buyer',
          acceptsReturns: Boolean(listingData.acceptsReturns),
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await createInventoryItem(sku, listing, imageUrls);

        // Step 4: Create offer
        const offerId = await createOffer(sku, listing, categoryId);

        // Step 5: Optionally publish offer if requested and account policies are configured
        let ebayListingId: string | undefined;
        if (publish) {
          ebayListingId = await publishOffer(offerId);
        }

        results.push({
          listingId: listingData.id,
          sku,
          offerId,
          ebayListingId,
          categoryId,
          imageUrls,
          hostedVia,
        });

        await new Promise((resolve) => setTimeout(resolve, 350));
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        logEvent('ERROR', 'api/ebay/submit-drafts', 'item', {
          listingId: listingData.id,
          sku,
          error: errMsg,
        });
        results.push({
          listingId: listingData.id,
          sku,
          error: errMsg,
        });
      }
    }

    const successCount = results.filter((r) => !r.error).length;
    const failCount = results.filter((r) => r.error).length;

    logEvent(
      'ACTION_FINISH',
      'api/ebay/submit-drafts',
      'POST',
      { successCount, failCount },
      Date.now() - start
    );

    const response: SubmitDraftsResponse = {
      success: failCount === 0,
      results,
    };

    return NextResponse.json(response);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Failed to submit drafts';
    logEvent('ERROR', 'api/ebay/submit-drafts', 'POST', { error: errMsg }, Date.now() - start);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
