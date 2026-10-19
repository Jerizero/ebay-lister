// eBay OAuth Types
export interface EbayTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface EbayTokenRecord {
  id: string;
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  updated_at: string;
  environment?: 'sandbox' | 'production';
}

// Market Comps Types
export interface CompItem {
  title: string;
  price: number;
  currency: string;
  condition?: string;
  itemWebUrl?: string;
  imageUrl?: string;
}

export interface MarketComps {
  query: string;
  source: 'ebay_browse_api' | 'ebay_public_search' | 'ai_estimate';
  count: number;
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
  recommendedPrice: number;
  sampleItems: CompItem[];
  fetchedAt: string;
}

// eBay Inventory API Types
export interface EbayInventoryItem {
  sku: string;
  locale?: string;
  product: {
    title: string;
    description: string;
    imageUrls: string[];
    aspects?: Record<string, string[]>;
  };
  condition: string;
  conditionDescription?: string;
  availability: {
    shipToLocationAvailability: {
      quantity: number;
    };
  };
}

export interface EbayAccountPolicies {
  fulfillmentPolicyId?: string;
  paymentPolicyId?: string;
  returnPolicyId?: string;
  merchantLocationKey?: string;
}

export interface EbayOffer {
  sku: string;
  marketplaceId: string;
  format: 'FIXED_PRICE' | 'AUCTION';
  availableQuantity?: number;
  categoryId: string;
  listingPolicies?: {
    fulfillmentPolicyId?: string;
    paymentPolicyId?: string;
    returnPolicyId?: string;
  };
  pricingSummary: {
    price: {
      value: string;
      currency: string;
    };
  };
  listingDescription?: string;
  merchantLocationKey?: string;
}

export interface EbayOfferResponse {
  offerId: string;
  sku: string;
  marketplaceId: string;
  format: string;
  listingId?: string;
}

// Condition mapping from app to eBay
export const EBAY_CONDITION_MAP: Record<string, string> = {
  NEW: '1000',
  LIKE_NEW: '3000',
  GOOD: '3000', // Note: many eBay clothing categories map pre-owned good/like-new to 3000 (Pre-owned) unless graded
  ACCEPTABLE: '3000',
};

// Detailed condition IDs for categories supporting granular used states
export const EBAY_GRANULAR_CONDITION_MAP: Record<string, string> = {
  NEW: '1000',
  LIKE_NEW: '2750',
  GOOD: '4000',
  ACCEPTABLE: '5000',
};

// eBay API environments
export const EBAY_API_BASE = {
  sandbox: 'https://api.sandbox.ebay.com',
  production: 'https://api.ebay.com',
};

export const EBAY_AUTH_BASE = {
  sandbox: 'https://auth.sandbox.ebay.com',
  production: 'https://auth.ebay.com',
};

// Default marketplace
export const EBAY_MARKETPLACE_ID = 'EBAY_US';

// Submit drafts request/response
export interface SubmitDraftsRequest {
  publish?: boolean;
  listings: {
    id: string;
    title: string;
    description: string;
    category: string;
    categoryId?: string;
    condition: string;
    price?: number;
    shippingPaidBy?: 'buyer' | 'seller';
    acceptsReturns?: boolean;
    itemSpecifics: Record<string, string | undefined>;
    photoBase64s: string[];
  }[];
}

export interface SubmitDraftsResponse {
  success: boolean;
  results: {
    listingId: string;
    sku: string;
    offerId?: string;
    ebayListingId?: string;
    categoryId?: string;
    imageUrls?: string[];
     hostedVia?: 'ebay_eps' | 'sandbox_fallback';
    error?: string;
  }[];
}
