import { NextRequest, NextResponse } from 'next/server';
import { getConnectionStatus } from '@/lib/ebay/oauth';
import { createInventoryItem, createOffer, generateSku, findCategoryId } from '@/lib/ebay/client';
import { uploadImages } from '@/lib/ebay/images';
import { SubmitDraftsRequest, SubmitDraftsResponse } from '@/types/ebay';
import { Listing } from '@/types';

export const maxDuration = 120; // Allow up to 2 minutes for bulk submission

export async function POST(request: NextRequest) {
  try {
    // Check if eBay is connected
    const status = await getConnectionStatus();
    if (!status.connected) {
      return NextResponse.json(
        { error: 'eBay not connected. Please connect your eBay account first.' },
        { status: 401 }
      );
    }

    const body: SubmitDraftsRequest = await request.json();
    const { listings } = body;

    if (!listings || listings.length === 0) {
      return NextResponse.json(
        { error: 'No listings provided' },
        { status: 400 }
      );
    }

    // Validate each listing
    for (const listing of listings) {
      if (!listing.title || listing.title.length === 0 || listing.title.length > 80) {
        return NextResponse.json(
          { error: `Listing title must be 1-80 characters` },
          { status: 400 }
        );
      }
      if (!listing.description) {
        return NextResponse.json(
          { error: `Listing description is required` },
          { status: 400 }
        );
      }
      if (!listing.photoBase64s || listing.photoBase64s.length === 0) {
        return NextResponse.json(
          { error: `Each listing must have at least one photo` },
          { status: 400 }
        );
      }
    }

    console.log(`[api/ebay/submit-drafts] Processing ${listings.length} listings...`);

    const results: SubmitDraftsResponse['results'] = [];

    for (const listingData of listings) {
      const sku = generateSku(listingData.id);

      try {
        // Step 1: Upload images (placeholder URLs for sandbox testing)
        console.log(`[api/ebay/submit-drafts] Uploading images for ${sku}...`);
        const imageUrls = await uploadImages(
          listingData.photoBase64s.map(base64 => ({ base64, mimeType: 'image/jpeg' }))
        );

        if (imageUrls.length === 0) {
          throw new Error('No images could be uploaded');
        }

        // Step 2: Create inventory item
        console.log(`[api/ebay/submit-drafts] Creating inventory item for ${sku}...`);

        // Convert to Listing type for the client
        const listing: Listing = {
          id: listingData.id,
          groupId: listingData.id,
          photos: [],
          title: listingData.title,
          description: listingData.description,
          category: listingData.category,
          condition: listingData.condition as Listing['condition'],
          itemSpecifics: listingData.itemSpecifics as Listing['itemSpecifics'],
          price: listingData.price,
          shippingPaidBy: 'buyer',
          acceptsReturns: false,
          status: 'draft',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await createInventoryItem(sku, listing, imageUrls);

        // Step 3: Create offer (unpublished)
        console.log(`[api/ebay/submit-drafts] Creating offer for ${sku}...`);
        const categoryId = await findCategoryId(listingData.category);
        const offerId = await createOffer(sku, listing, categoryId);

        results.push({
          listingId: listingData.id,
          sku,
          offerId,
        });

        console.log(`[api/ebay/submit-drafts] Successfully created draft for ${sku}`);

        // Rate limiting: wait between API calls to avoid eBay rate limits
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`[api/ebay/submit-drafts] Error processing ${sku}:`, error);
        results.push({
          listingId: listingData.id,
          sku,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => !r.error).length;
    const failCount = results.filter(r => r.error).length;

    console.log(
      `[api/ebay/submit-drafts] Completed: ${successCount} success, ${failCount} failed`
    );

    const response: SubmitDraftsResponse = {
      success: failCount === 0,
      results,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[api/ebay/submit-drafts] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to submit drafts' },
      { status: 500 }
    );
  }
}
