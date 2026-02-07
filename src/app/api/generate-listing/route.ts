import { NextRequest, NextResponse } from 'next/server';
import { getVisionModel, base64ToGenerativePart } from '@/lib/ai/gemini';
import { LISTING_GENERATION_PROMPT } from '@/lib/ai/prompts';

export const maxDuration = 60;

interface PhotoData {
  base64: string;
  mimeType: string;
}

interface ListingRequest {
  photos: PhotoData[];
  groupDescription?: string;
}

interface ListingResponse {
  title: string;
  description: string;
  category: string;
  condition: 'NEW' | 'LIKE_NEW' | 'GOOD' | 'ACCEPTABLE';
  itemSpecifics: {
    brand?: string;
    size?: string;
    color?: string;
    material?: string;
    model?: string;
    style?: string;
    [key: string]: string | undefined;
  };
  suggestedPrice?: {
    min: number;
    max: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: ListingRequest = await request.json();
    const { photos, groupDescription } = body;

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { error: 'No photos provided' },
        { status: 400 }
      );
    }

    // Validate each photo
    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      if (!photo.base64 || typeof photo.base64 !== 'string') {
        return NextResponse.json(
          { error: `Photo ${i + 1}: base64 data is required` },
          { status: 400 }
        );
      }
      // ~20MB base64 limit (base64 is ~1.33x raw, so ~15MB raw)
      if (photo.base64.length > 20_000_000) {
        return NextResponse.json(
          { error: `Photo ${i + 1}: exceeds 20MB size limit` },
          { status: 400 }
        );
      }
      const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
      if (!validMimeTypes.includes(photo.mimeType)) {
        return NextResponse.json(
          { error: `Photo ${i + 1}: unsupported format. Use JPEG, PNG, WebP, or HEIC` },
          { status: 400 }
        );
      }
    }

    console.log(`[generate-listing] Processing ${photos.length} photos...`);

    const model = getVisionModel();

    // Convert photos to Gemini format
    const imageParts = photos.map((photo) =>
      base64ToGenerativePart(photo.base64, photo.mimeType)
    );

    // Enhanced prompt with context
    const prompt = `${LISTING_GENERATION_PROMPT}

${groupDescription ? `Context: These photos appear to show: ${groupDescription}` : ''}

Analyze all ${photos.length} photo(s) carefully and generate a complete eBay listing.`;

    console.log('[generate-listing] Sending to Gemini...');

    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    console.log('[generate-listing] Received response from Gemini');

    // Parse the JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[generate-listing] No JSON found in response:', text);
      return NextResponse.json(
        { error: 'Invalid response from AI - no JSON found' },
        { status: 500 }
      );
    }

    const listingData: ListingResponse = JSON.parse(jsonMatch[0]);

    // Validate and normalize the response
    const normalizedResponse: ListingResponse = {
      title: (listingData.title || 'Untitled Item').slice(0, 80),
      description: listingData.description || 'No description available.',
      category: listingData.category || 'Other',
      condition: normalizeCondition(listingData.condition),
      itemSpecifics: listingData.itemSpecifics || {},
      suggestedPrice: listingData.suggestedPrice,
    };

    console.log('[generate-listing] Returning listing data');

    return NextResponse.json(normalizedResponse);
  } catch (error) {
    console.error('[generate-listing] Error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Gemini API key not configured' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate listing' },
      { status: 500 }
    );
  }
}

function normalizeCondition(condition: string): 'NEW' | 'LIKE_NEW' | 'GOOD' | 'ACCEPTABLE' {
  const normalized = (condition || '').toUpperCase().replace(/[\s_-]/g, '_');

  if (normalized.includes('NEW') && !normalized.includes('LIKE')) {
    return 'NEW';
  }
  if (normalized.includes('LIKE') || normalized.includes('EXCELLENT') || normalized.includes('MINT')) {
    return 'LIKE_NEW';
  }
  if (normalized.includes('GOOD') || normalized.includes('VERY')) {
    return 'GOOD';
  }
  return 'ACCEPTABLE';
}
