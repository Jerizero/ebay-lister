import { NextRequest, NextResponse } from 'next/server';
import { SchemaType, Schema } from '@google/generative-ai';
import { base64ToGenerativePart, generateStructuredVisionJson } from '@/lib/ai/gemini';
import { LISTING_GENERATION_PROMPT } from '@/lib/ai/prompts';
import { lookupEbayComps } from '@/lib/ebay/comps';
import { resolveLeafCategoryFallback } from '@/lib/ebay/client';
import { MarketComps } from '@/types/ebay';
import { logEvent } from '@/lib/logger';

export const maxDuration = 60;

interface PhotoData {
  base64: string;
  mimeType: string;
}

interface ListingRequest {
  photos: PhotoData[];
  groupDescription?: string;
}

export interface ListingResponse {
  title: string;
  description: string;
  category: string;
  categoryId: string;
  condition: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'ACCEPTABLE';
  itemSpecifics: {
    brand?: string;
    size?: string;
    sizeType?: string;
    department?: string;
    color?: string;
    material?: string;
    model?: string;
    style?: string;
    [key: string]: string | undefined;
  };
  suggestedPrice: {
    min: number;
    max: number;
    recommended: number;
  };
  comps?: MarketComps;
}

const LISTING_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    title: { type: SchemaType.STRING },
    description: { type: SchemaType.STRING },
    category: { type: SchemaType.STRING },
    condition: { type: SchemaType.STRING },
    itemSpecifics: {
      type: SchemaType.OBJECT,
      properties: {
        brand: { type: SchemaType.STRING, nullable: true },
        model: { type: SchemaType.STRING, nullable: true },
        size: { type: SchemaType.STRING, nullable: true },
        sizeType: { type: SchemaType.STRING, nullable: true },
        department: { type: SchemaType.STRING, nullable: true },
        color: { type: SchemaType.STRING, nullable: true },
        material: { type: SchemaType.STRING, nullable: true },
        style: { type: SchemaType.STRING, nullable: true },
      },
    },
    suggestedPrice: {
      type: SchemaType.OBJECT,
      properties: {
        min: { type: SchemaType.NUMBER },
        max: { type: SchemaType.NUMBER },
        recommended: { type: SchemaType.NUMBER },
      },
      required: ['min', 'max', 'recommended'],
    },
  },
  required: ['title', 'description', 'category', 'condition', 'itemSpecifics', 'suggestedPrice'],
};

function isSpecificDescription(desc?: string): boolean {
  if (!desc) return false;
  const lower = desc.toLowerCase();
  if (
    lower.includes('new group') ||
    lower.includes('ungrouped') ||
    lower.includes('split from') ||
    lower.length < 6
  ) {
    return false;
  }
  return true;
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  try {
    const body: ListingRequest = await request.json();
    const { photos, groupDescription } = body;

    if (!photos || photos.length === 0) {
      return NextResponse.json({ error: 'No photos provided' }, { status: 400 });
    }

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      if (!photo.base64 || typeof photo.base64 !== 'string') {
        return NextResponse.json(
          { error: `Photo ${i + 1}: base64 data is required` },
          { status: 400 }
        );
      }
      if (photo.base64.length > 20_000_000) {
        return NextResponse.json(
          { error: `Photo ${i + 1}: exceeds 20MB size limit` },
          { status: 400 }
        );
      }
      if (!validMimeTypes.includes(photo.mimeType)) {
        return NextResponse.json(
          { error: `Photo ${i + 1}: unsupported format. Use JPEG, PNG, WebP, or HEIC` },
          { status: 400 }
        );
      }
    }

    logEvent('ACTION_START', 'api/generate-listing', 'POST', {
      photoCount: photos.length,
      groupDescription,
    });

    // Step 1: If we already have a specific item description from grouping, fetch eBay market comps first
    let comps: MarketComps | null = null;
    if (isSpecificDescription(groupDescription)) {
      comps = await lookupEbayComps(groupDescription!);
    }

    const imageParts = photos.map((photo) =>
      base64ToGenerativePart(photo.base64, photo.mimeType)
    );

    const compsContext = comps
      ? `\nReal eBay Market Comps (${comps.count} recent listings for "${comps.query}"):\n` +
        `- Range: $${comps.minPrice.toFixed(2)} to $${comps.maxPrice.toFixed(2)}\n` +
        `- Median Sold/Active Price: $${comps.medianPrice.toFixed(2)}\n` +
        `- Competitive Benchmark: $${comps.recommendedPrice.toFixed(2)}\n` +
        `Ground your suggestedPrice directly in these comps, adjusting for the condition visible in the photos.`
      : '';

    const prompt = `${LISTING_GENERATION_PROMPT}

${groupDescription ? `Context: These photos appear to show: ${groupDescription}` : ''}${compsContext}

Analyze all ${photos.length} photo(s) carefully and generate a complete eBay listing.`;

    const { data: listingData, modelUsed } = await generateStructuredVisionJson<ListingResponse>({
      scope: 'api/generate-listing',
      prompt,
      imageParts,
      responseSchema: LISTING_RESPONSE_SCHEMA,
    });

    const cleanTitle = (listingData.title || 'Untitled Item').replace(/—|–/g, '-').slice(0, 80);
    const cleanDescription = (listingData.description || 'No description available.').replace(
      /—|–/g,
      '-'
    );
    const cleanCategory = listingData.category || 'Clothing, Shoes & Accessories > Men > Men\'s Clothing > Shirts';

    // Step 2: If comps were not fetched earlier (e.g. user-created group), look up comps from the generated title
    if (!comps && cleanTitle !== 'Untitled Item') {
      comps = await lookupEbayComps(cleanTitle);
    }

    // Reconcile suggestedPrice with real comps when available
    const aiMin = Number(listingData.suggestedPrice?.min) || 15;
    const aiMax = Number(listingData.suggestedPrice?.max) || Math.max(aiMin + 10, 30);
    const aiRec =
      Number(listingData.suggestedPrice?.recommended) ||
      Number(((aiMin + aiMax) / 2).toFixed(2));

    const finalSuggestedPrice = comps
      ? {
          min: comps.minPrice,
          max: comps.maxPrice,
          recommended: comps.recommendedPrice,
        }
      : {
          min: Number(aiMin.toFixed(2)),
          max: Number(aiMax.toFixed(2)),
          recommended: Number(aiRec.toFixed(2)),
        };

    const finalComps: MarketComps = comps || {
      query: cleanTitle,
      source: 'ai_estimate',
      count: 0,
      minPrice: finalSuggestedPrice.min,
      maxPrice: finalSuggestedPrice.max,
      medianPrice: finalSuggestedPrice.recommended,
      recommendedPrice: finalSuggestedPrice.recommended,
      sampleItems: [],
      fetchedAt: new Date().toISOString(),
    };

    const cleanedSpecifics: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(listingData.itemSpecifics || {})) {
      if (v && typeof v === 'string' && v.trim() !== '' && v.toLowerCase() !== 'null') {
        cleanedSpecifics[k] = v.trim();
      }
    }

    const categoryId = resolveLeafCategoryFallback(cleanCategory, cleanTitle);

    const normalizedResponse: ListingResponse = {
      title: cleanTitle,
      description: cleanDescription,
      category: cleanCategory,
      categoryId,
      condition: normalizeCondition(listingData.condition),
      itemSpecifics: cleanedSpecifics,
      suggestedPrice: finalSuggestedPrice,
      comps: finalComps,
    };

    logEvent(
      'ACTION_FINISH',
      'api/generate-listing',
      'POST',
      {
        title: normalizedResponse.title,
        categoryId,
        recommendedPrice: normalizedResponse.suggestedPrice.recommended,
        compsSource: finalComps.source,
        compsCount: finalComps.count,
        modelUsed,
      },
      Date.now() - start
    );

    return NextResponse.json(normalizedResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to generate listing';
    logEvent('ERROR', 'api/generate-listing', 'POST', { error: message }, Date.now() - start);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function normalizeCondition(
  condition: string
): 'NEW' | 'LIKE_NEW' | 'GOOD' | 'ACCEPTABLE' {
  const normalized = (condition || '').toUpperCase().replace(/[\s_-]/g, '_');

  if (normalized.includes('NEW') && !normalized.includes('LIKE')) {
    return 'NEW';
  }
  if (
    normalized.includes('LIKE') ||
    normalized.includes('EXCELLENT') ||
    normalized.includes('MINT')
  ) {
    return 'LIKE_NEW';
  }
  if (normalized.includes('GOOD') || normalized.includes('VERY')) {
    return 'GOOD';
  }
  return 'ACCEPTABLE';
}
