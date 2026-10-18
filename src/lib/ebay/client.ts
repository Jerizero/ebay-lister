import { getValidAccessToken } from './oauth';
import {
  EbayAccountPolicies,
  EbayInventoryItem,
  EbayOffer,
  EbayOfferResponse,
  EBAY_API_BASE,
  EBAY_CONDITION_MAP,
  EBAY_MARKETPLACE_ID,
} from '@/types/ebay';
import { Listing } from '@/types';
import { logEvent } from '@/lib/logger';

// Get API base URL
function getApiBase(): string {
  const env = (process.env.EBAY_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';
  return EBAY_API_BASE[env];
}

// Generate SKU from listing ID
export function generateSku(listingId: string): string {
  const cleanId = listingId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24);
  return `EBL-${cleanId}-${Date.now().toString(36).toUpperCase()}`;
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

/**
 * Convert camelCase or snake_case item specific keys to eBay Title Case aspect names
 * (e.g. "sizeType" -> "Size Type", "brand" -> "Brand")
 */
export function formatAspectName(key: string): string {
  const knownMappings: Record<string, string> = {
    brand: 'Brand',
    size: 'Size',
    sizetype: 'Size Type',
    size_type: 'Size Type',
    department: 'Department',
    color: 'Color',
    material: 'Material',
    style: 'Style',
    model: 'Model',
    type: 'Type',
    inseam: 'Inseam',
    rise: 'Rise',
    fit: 'Fit',
    fabricwash: 'Fabric Wash',
  };

  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (knownMappings[normalized]) {
    return knownMappings[normalized];
  }

  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Create or replace inventory item
export async function createInventoryItem(
  sku: string,
  listing: Listing,
  imageUrls: string[]
): Promise<void> {
  const conditionId = EBAY_CONDITION_MAP[listing.condition] || '3000';

  // Build aspects from item specifics with proper eBay aspect casing
  const aspects: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(listing.itemSpecifics)) {
    if (value && value.trim()) {
      aspects[formatAspectName(key)] = [value.trim()];
    }
  }

  // Ensure Department & Size Type defaults for clothing when missing
  if (
    listing.category.toLowerCase().includes('clothing') ||
    listing.category.toLowerCase().includes('jeans') ||
    listing.category.toLowerCase().includes('shirt')
  ) {
    if (!aspects['Department']) {
      const lowerTitle = listing.title.toLowerCase();
      aspects['Department'] = [
        lowerTitle.includes('women') || lowerTitle.includes("women's") ? 'Women' : 'Men',
      ];
    }
    if (!aspects['Size Type'] && aspects['Size']) {
      aspects['Size Type'] = ['Regular'];
    }
  }

  const inventoryItem: EbayInventoryItem = {
    sku,
    locale: 'en_US',
    product: {
      title: listing.title.slice(0, 80),
      description: listing.description,
      imageUrls: imageUrls.length > 0 ? imageUrls : ['https://i.ebayimg.com/images/g/placeholder.jpg'],
      aspects: Object.keys(aspects).length > 0 ? aspects : undefined,
    },
    condition: conditionId,
    availability: {
      shipToLocationAvailability: {
        quantity: 1,
      },
    },
  };

  logEvent('ACTION_START', 'ebay/client', 'createInventoryItem', { sku, conditionId });

  const response = await ebayFetch(`/sell/inventory/v1/inventory_item/${encodeURIComponent(sku)}`, {
    method: 'PUT',
    body: JSON.stringify(inventoryItem),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logEvent('ERROR', 'ebay/client', 'createInventoryItem', { sku, error: errorText });
    throw new Error(`Failed to create inventory item: ${errorText}`);
  }

  logEvent('ACTION_FINISH', 'ebay/client', 'createInventoryItem', { sku });
}

/**
 * Fetch seller's configured fulfillment, payment, and return policies + merchant location
 * so offers can include complete policy metadata and be published when desired.
 */
export async function fetchAccountPolicies(
  listing: Pick<Listing, 'shippingPaidBy' | 'acceptsReturns'>
): Promise<EbayAccountPolicies> {
  const policies: EbayAccountPolicies = {};

  try {
    const [fulfillmentRes, paymentRes, returnRes, locationRes] = await Promise.allSettled([
      ebayFetch(`/sell/account/v1/fulfillment_policy?marketplace_id=${EBAY_MARKETPLACE_ID}`),
      ebayFetch(`/sell/account/v1/payment_policy?marketplace_id=${EBAY_MARKETPLACE_ID}`),
      ebayFetch(`/sell/account/v1/return_policy?marketplace_id=${EBAY_MARKETPLACE_ID}`),
      ebayFetch('/sell/inventory/v1/location?limit=5'),
    ]);

    if (fulfillmentRes.status === 'fulfilled' && fulfillmentRes.value.ok) {
      const data = await fulfillmentRes.value.json();
      const list = Array.isArray(data?.fulfillmentPolicies) ? data.fulfillmentPolicies : [];
      if (list.length > 0) {
        // Match free shipping vs buyer-paid if multiple policies exist
        const match =
          list.find((p: { name?: string }) =>
            listing.shippingPaidBy === 'seller'
              ? p.name?.toLowerCase().includes('free')
              : !p.name?.toLowerCase().includes('free')
          ) || list[0];
        policies.fulfillmentPolicyId = match?.fulfillmentPolicyId;
      }
    }

    if (paymentRes.status === 'fulfilled' && paymentRes.value.ok) {
      const data = await paymentRes.value.json();
      const list = Array.isArray(data?.paymentPolicies) ? data.paymentPolicies : [];
      if (list.length > 0) {
        policies.paymentPolicyId = list[0]?.paymentPolicyId;
      }
    }

    if (returnRes.status === 'fulfilled' && returnRes.value.ok) {
      const data = await returnRes.value.json();
      const list = Array.isArray(data?.returnPolicies) ? data.returnPolicies : [];
      if (list.length > 0) {
        const match =
          list.find((p: { returnsAccepted?: boolean }) =>
            Boolean(p.returnsAccepted) === Boolean(listing.acceptsReturns)
          ) || list[0];
        policies.returnPolicyId = match?.returnPolicyId;
      }
    }

    if (locationRes.status === 'fulfilled' && locationRes.value.ok) {
      const data = await locationRes.value.json();
      const locations = Array.isArray(data?.locations) ? data.locations : [];
      if (locations.length > 0) {
        policies.merchantLocationKey = locations[0]?.merchantLocationKey;
      }
    }
  } catch {
    // Non-fatal: unpublished offers can still be created without policies in sandbox
  }

  return policies;
}

// Create offer (unpublished draft or ready to publish)
export async function createOffer(
  sku: string,
  listing: Listing,
  categoryId?: string
): Promise<string> {
  const policies = await fetchAccountPolicies(listing);
  const hasCompletePolicies = Boolean(
    policies.fulfillmentPolicyId && policies.paymentPolicyId && policies.returnPolicyId
  );

  const offer: EbayOffer = {
    sku,
    marketplaceId: EBAY_MARKETPLACE_ID,
    format: 'FIXED_PRICE',
    availableQuantity: 1,
    categoryId: categoryId || resolveLeafCategoryFallback(listing.category, listing.title),
    pricingSummary: {
      price: {
        value: (listing.price && listing.price > 0 ? listing.price : 19.99).toFixed(2),
        currency: 'USD',
      },
    },
    listingDescription: listing.description,
    ...(hasCompletePolicies
      ? {
          listingPolicies: {
            fulfillmentPolicyId: policies.fulfillmentPolicyId,
            paymentPolicyId: policies.paymentPolicyId,
            returnPolicyId: policies.returnPolicyId,
          },
        }
      : {}),
    ...(policies.merchantLocationKey ? { merchantLocationKey: policies.merchantLocationKey } : {}),
  };

  logEvent('ACTION_START', 'ebay/client', 'createOffer', {
    sku,
    categoryId: offer.categoryId,
    price: offer.pricingSummary.price.value,
    shippingPaidBy: listing.shippingPaidBy,
    acceptsReturns: listing.acceptsReturns,
    hasCompletePolicies,
  });

  const response = await ebayFetch('/sell/inventory/v1/offer', {
    method: 'POST',
    body: JSON.stringify(offer),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logEvent('ERROR', 'ebay/client', 'createOffer', { sku, error: errorText });
    throw new Error(`Failed to create offer: ${errorText}`);
  }

  const result: EbayOfferResponse = await response.json();
  logEvent('ACTION_FINISH', 'ebay/client', 'createOffer', {
    sku,
    offerId: result.offerId,
  });

  return result.offerId;
}

// Publish offer (make listing live)
export async function publishOffer(offerId: string): Promise<string> {
  logEvent('ACTION_START', 'ebay/client', 'publishOffer', { offerId });

  const response = await ebayFetch(`/sell/inventory/v1/offer/${offerId}/publish`, {
    method: 'POST',
  });

  if (!response.ok) {
    const errorText = await response.text();
    logEvent('ERROR', 'ebay/client', 'publishOffer', { offerId, error: errorText });
    throw new Error(`Failed to publish offer: ${errorText}`);
  }

  const result = await response.json();
  logEvent('ACTION_FINISH', 'ebay/client', 'publishOffer', {
    offerId,
    listingId: result.listingId,
  });

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

/**
 * Deterministic eBay US leaf category map.
 * Never returns top-level parent categories like 11450 ("Clothing, Shoes & Accessories") which eBay rejects.
 */
export function resolveLeafCategoryFallback(categoryName: string, title: string = ''): string {
  const combined = `${categoryName} ${title}`.toLowerCase();
  const isWomen = combined.includes('women') || combined.includes("women's") || combined.includes('ladies');

  if (combined.includes('jean') || combined.includes('denim pants')) {
    return isWomen ? '11554' : '11483';
  }
  if (combined.includes('dress') && isWomen) {
    return '63861';
  }
  if (combined.includes('skirt')) {
    return '63864';
  }
  if (combined.includes('hoodie') || combined.includes('sweatshirt')) {
    return isWomen ? '155226' : '155183';
  }
  if (combined.includes('sweater') || combined.includes('cardigan') || combined.includes('pullover')) {
    return isWomen ? '63866' : '11484';
  }
  if (combined.includes('jacket') || combined.includes('coat') || combined.includes('vest') || combined.includes('parka')) {
    return isWomen ? '63862' : '57988';
  }
  if (combined.includes('t-shirt') || combined.includes('tee')) {
    return isWomen ? '53159' : '15687';
  }
  if (combined.includes('shirt') || combined.includes('polo') || combined.includes('button') || combined.includes('top') || combined.includes('blouse')) {
    return isWomen ? '53159' : '57990';
  }
  if (combined.includes('short')) {
    return isWomen ? '11555' : '15689';
  }
  if (combined.includes('pant') || combined.includes('trouser') || combined.includes('chino') || combined.includes('jogger')) {
    return isWomen ? '63863' : '57989';
  }
  if (combined.includes('sneaker') || combined.includes('athletic shoe') || combined.includes('running shoe')) {
    return isWomen ? '95672' : '15709';
  }
  if (combined.includes('boot')) {
    return isWomen ? '53557' : '11498';
  }
  if (combined.includes('shoe') || combined.includes('loafer') || combined.includes('sandal')) {
    return isWomen ? '3034' : '24087';
  }
  if (combined.includes('bag') || combined.includes('purse') || combined.includes('tote') || combined.includes('backpack')) {
    return isWomen ? '169291' : '52357';
  }
  if (combined.includes('watch')) {
    return '31387';
  }
  if (combined.includes('phone') || combined.includes('iphone') || combined.includes('pixel')) {
    return '9355';
  }
  if (combined.includes('laptop') || combined.includes('macbook') || combined.includes('notebook')) {
    return '177';
  }
  if (combined.includes('book')) {
    return '261186';
  }

  // Safe leaf fallback for Men's Casual Shirts or Everything Else leaf
  if (combined.includes('clothing') || combined.includes('apparel')) {
    return isWomen ? '53159' : '57990';
  }

  return '88433'; // Leaf category: Everything Else > Other
}

/**
 * Look up exact eBay leaf category ID using eBay's Commerce Taxonomy API (`get_category_suggestions`),
 * falling back to `resolveLeafCategoryFallback` if Taxonomy API is unreachable or returns empty.
 */
export async function findCategoryId(categoryName: string, title: string = ''): Promise<string> {
  const query = (title || categoryName).slice(0, 70).trim();

  try {
    const response = await ebayFetch(
      `/commerce/taxonomy/v1/category_tree/0/get_category_suggestions?q=${encodeURIComponent(query)}`
    );

    if (response.ok) {
      const data = await response.json();
      const firstId = data?.categorySuggestions?.[0]?.category?.categoryId;
      if (firstId) {
        return String(firstId);
      }
    }
  } catch {
    // Fall back to deterministic leaf category resolver
  }

  return resolveLeafCategoryFallback(categoryName, title);
}
