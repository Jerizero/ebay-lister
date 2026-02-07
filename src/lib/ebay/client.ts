import { getValidAccessToken } from './oauth';
import {
  EbayInventoryItem,
  EbayOffer,
  EbayOfferResponse,
  EBAY_API_BASE,
  EBAY_CONDITION_MAP,
  EBAY_MARKETPLACE_ID,
} from '@/types/ebay';
import { Listing } from '@/types';

// Get API base URL
function getApiBase(): string {
  const env = (process.env.EBAY_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';
  return EBAY_API_BASE[env];
}

// Generate SKU from listing ID
export function generateSku(listingId: string): string {
  return `EBLISTER-${listingId}-${Date.now()}`;
}

// Make authenticated API request
async function ebayFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const accessToken = await getValidAccessToken();
  const apiBase = getApiBase();

  const response = await fetch(`${apiBase}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Content-Language': 'en-US',
      ...options.headers,
    },
  });

  return response;
}

// Create or replace inventory item
export async function createInventoryItem(
  sku: string,
  listing: Listing,
  imageUrls: string[]
): Promise<void> {
  // Map condition to eBay condition ID
  const conditionId = EBAY_CONDITION_MAP[listing.condition] || '3000';

  // Build aspects from item specifics
  const aspects: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(listing.itemSpecifics)) {
    if (value) {
      aspects[key.charAt(0).toUpperCase() + key.slice(1)] = [value];
    }
  }

  const inventoryItem: EbayInventoryItem = {
    sku,
    locale: 'en_US',
    product: {
      title: listing.title,
      description: listing.description,
      imageUrls: imageUrls.length > 0 ? imageUrls : ['https://placeholder.com/no-image.jpg'],
      aspects: Object.keys(aspects).length > 0 ? aspects : undefined,
    },
    condition: conditionId,
    availability: {
      shipToLocationAvailability: {
        quantity: 1,
      },
    },
  };

  console.log(`[ebay/client] Creating inventory item: ${sku}`);

  const response = await ebayFetch(`/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    method: 'PUT',
    body: JSON.stringify(inventoryItem),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[ebay/client] Create inventory item failed:', errorText);
    throw new Error(`Failed to create inventory item: ${errorText}`);
  }

  console.log(`[ebay/client] Inventory item created: ${sku}`);
}

// Create offer (unpublished draft)
export async function createOffer(
  sku: string,
  listing: Listing,
  categoryId?: string
): Promise<string> {
  const offer: EbayOffer = {
    sku,
    marketplaceId: EBAY_MARKETPLACE_ID,
    format: 'FIXED_PRICE',
    availableQuantity: 1,
    categoryId: categoryId || '99', // Default to "Everything Else" if no category
    pricingSummary: {
      price: {
        value: (listing.price || 9.99).toFixed(2),
        currency: 'USD',
      },
    },
    listingDescription: listing.description,
  };

  console.log(`[ebay/client] Creating offer for SKU: ${sku}`);

  const response = await ebayFetch('/sell/inventory/v1/offer', {
    method: 'POST',
    body: JSON.stringify(offer),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[ebay/client] Create offer failed:', errorText);
    throw new Error(`Failed to create offer: ${errorText}`);
  }

  const result: EbayOfferResponse = await response.json();
  console.log(`[ebay/client] Offer created: ${result.offerId}`);

  return result.offerId;
}

// Publish offer (make listing live) - for future use
export async function publishOffer(offerId: string): Promise<string> {
  console.log(`[ebay/client] Publishing offer: ${offerId}`);

  const response = await ebayFetch(`/sell/inventory/v1/offer/${offerId}/publish`, {
    method: 'POST',
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[ebay/client] Publish offer failed:', errorText);
    throw new Error(`Failed to publish offer: ${errorText}`);
  }

  const result = await response.json();
  console.log(`[ebay/client] Offer published, listing ID: ${result.listingId}`);

  return result.listingId;
}

// Get offer by ID
export async function getOffer(offerId: string): Promise<EbayOfferResponse | null> {
  const response = await ebayFetch(`/sell/inventory/v1/offer/${offerId}`);

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    const errorText = await response.text();
    throw new Error(`Failed to get offer: ${errorText}`);
  }

  return response.json();
}

// Delete inventory item
export async function deleteInventoryItem(sku: string): Promise<void> {
  const response = await ebayFetch(`/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 404) {
    const errorText = await response.text();
    throw new Error(`Failed to delete inventory item: ${errorText}`);
  }
}

// Look up category ID from category name (simplified - uses search)
export async function findCategoryId(categoryName: string): Promise<string | undefined> {
  // For MVP, return common category IDs based on keywords
  const categoryMap: Record<string, string> = {
    clothing: '11450',
    shirt: '15687',
    pants: '11483',
    jeans: '11483',
    shoes: '93427',
    electronics: '293',
    phone: '9355',
    computer: '175673',
    home: '11700',
    toys: '220',
    books: '267',
    jewelry: '281',
    watch: '14324',
    bag: '169291',
    sports: '888',
  };

  const lowerName = categoryName.toLowerCase();
  for (const [keyword, id] of Object.entries(categoryMap)) {
    if (lowerName.includes(keyword)) {
      return id;
    }
  }

  return undefined;
}
