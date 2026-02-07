import { NextRequest, NextResponse } from 'next/server';
import { getVisionModel, base64ToGenerativePart } from '@/lib/ai/gemini';
import { PHOTO_GROUPING_PROMPT } from '@/lib/ai/prompts';

export const maxDuration = 60; // Allow up to 60 seconds for AI processing

interface PhotoData {
  base64: string;
  mimeType: string;
}

interface GroupingRequest {
  photos: PhotoData[];
}

interface PhotoGroup {
  photoIndices: number[];
  confidence: number;
  description: string;
  flagged?: boolean;
}

interface GroupingResponse {
  groups: PhotoGroup[];
}

export async function POST(request: NextRequest) {
  try {
    const body: GroupingRequest = await request.json();
    const { photos } = body;

    if (!photos || photos.length === 0) {
      return NextResponse.json(
        { error: 'No photos provided' },
        { status: 400 }
      );
    }

    if (photos.length > 200) {
      return NextResponse.json(
        { error: 'Maximum 200 photos allowed per batch' },
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

    console.log(`[group-photos] Processing ${photos.length} photos...`);

    // Get the vision model
    const model = getVisionModel();

    // Convert photos to Gemini format
    const imageParts = photos.map((photo, index) => {
      console.log(`[group-photos] Preparing photo ${index + 1}/${photos.length}`);
      return base64ToGenerativePart(photo.base64, photo.mimeType);
    });

    // Create the prompt with photo count
    const prompt = `${PHOTO_GROUPING_PROMPT}\n\nYou are analyzing ${photos.length} photos (indexed 0 to ${photos.length - 1}).`;

    console.log('[group-photos] Sending to Gemini...');

    // Send to Gemini
    const result = await model.generateContent([prompt, ...imageParts]);
    const response = await result.response;
    const text = response.text();

    console.log('[group-photos] Received response from Gemini');

    // Parse the JSON response
    // Extract JSON from the response (in case there's extra text)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[group-photos] No JSON found in response:', text);
      return NextResponse.json(
        { error: 'Invalid response from AI - no JSON found' },
        { status: 500 }
      );
    }

    const groupingResult: GroupingResponse = JSON.parse(jsonMatch[0]);

    // Validate that all photo indices are covered
    const allIndices = new Set<number>();
    for (const group of groupingResult.groups) {
      for (const index of group.photoIndices) {
        if (allIndices.has(index)) {
          console.warn(`[group-photos] Duplicate index ${index} found`);
        }
        allIndices.add(index);
      }
    }

    // Check for missing indices
    for (let i = 0; i < photos.length; i++) {
      if (!allIndices.has(i)) {
        console.warn(`[group-photos] Missing index ${i}, adding as single-photo group`);
        groupingResult.groups.push({
          photoIndices: [i],
          confidence: 0.5,
          description: 'Ungrouped item',
        });
      }
    }

    console.log(`[group-photos] Returning ${groupingResult.groups.length} groups`);

    return NextResponse.json(groupingResult);
  } catch (error) {
    console.error('[group-photos] Error:', error);

    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'Gemini API key not configured. Please add GOOGLE_AI_API_KEY to .env.local' },
          { status: 500 }
        );
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to process photos' },
      { status: 500 }
    );
  }
}
