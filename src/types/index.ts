export * from './ebay';
import { MarketComps } from './ebay';

// Photo types
export interface Photo {
  id: string;
  file: File;
  url: string;
  thumbnailUrl?: string;
  groupId?: string;
}

// Photo grouping from AI
export interface PhotoGroup {
  id: string;
  photos: Photo[];
  confidence: number;
  aiDescription?: string;
  flagged?: boolean;
}

// Generated listing
export interface Listing {
  id: string;
  groupId: string;
  photos: Photo[];
  /** Signature of photo IDs used to generate this listing, used to detect dirty groups after editing */
  photoSignature?: string;

  // Generated content
  title: string;
  description: string;
  category: string;
  categoryId?: string;
  condition: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'ACCEPTABLE';

  // Item specifics
  itemSpecifics: {
    brand?: string;
    size?: string;
    color?: string;
    material?: string;
    model?: string;
    style?: string;
    department?: string;
    sizeType?: string;
    [key: string]: string | undefined;
  };

  // Pricing & Comps
  price?: number;
  suggestedPriceRange?: {
    min: number;
    max: number;
  };
  comps?: MarketComps;

  // Shipping & Returns
  shippingPaidBy: 'buyer' | 'seller';
  acceptsReturns: boolean;

  // Status
  status: 'draft' | 'ready' | 'submitted' | 'published';
  ebayListingId?: string;
  ebayOfferId?: string;
  ebaySku?: string;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}
