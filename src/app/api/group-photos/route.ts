import { NextRequest, NextResponse } from 'next/server';
import { SchemaType, Schema } from '@google/generative-ai';
import { base64ToGenerativePart, generateStructuredVisionJson } from '@/lib/ai/gemini';
import { PHOTO_GROUPING_PROMPT } from '@/lib/ai/prompts';
import { logEvent } from '@/lib/logger';

export const maxDuration = 60;

interface PhotoData {
  base64: string;
  mimeType: string;
}

interface GroupingRequest {
  photos: PhotoData[];
}

export interface RawPhotoGroup {
  photoIndices: number[];
  confidence: number;
  description: string;
  flagged?: boolean;
}

interface GroupingResponse {
  groups: RawPhotoGroup[];
}

const GROUPING_RESPONSE_SCHEMA: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    groups: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          photoIndices: {
            type: SchemaType.ARRAY,
            items: { type: SchemaType.INTEGER },
          },
          confidence: { type: SchemaType.NUMBER },
          description: { type: SchemaType.STRING },
          flagged: { type: SchemaType.BOOLEAN },
        },
        required: ['photoIndices', 'confidence', 'description'],
      },
    },
  },
  required: ['groups'],
};

/**
 * Reconcile AI photo groups so every index in [0, totalPhotos - 1] appears in exactly one group.
 * Removes out-of-bounds or duplicate indices and creates single-photo groups for any omitted indices.
 */
export function normalizeGroupingIndices(
  groups: RawPhotoGroup[],
  totalPhotos: number
): RawPhotoGroup[] {
  const seen = new Set<number>();
  const cleanedGroups: RawPhotoGroup[] = [];

  for (const group of groups || []) {
    const uniqueValidIndices: number[] = [];
    for (const idx of group.photoIndices || []) {
      if (Number.isInteger(idx) && idx >= 0 && idx < totalPhotos && !seen.has(idx)) {
        seen.add(idx);
        uniqueValidIndices.push(idx);
      }
    }

    if (uniqueValidIndices.length > 0) {
      cleanedGroups.push({
        photoIndices: uniqueValidIndices,
        confidence:
          typeof group.confidence === 'number'
            ? Math.max(0, Math.min(1, group.confidence))
            : 0.8,
        description: group.description?.trim() || 'Grouped item',
        flagged: Boolean(group.flagged),
      });
    }
  }

  for (let i = 0; i < totalPhotos; i++) {
    if (!seen.has(i)) {
      cleanedGroups.push({
        photoIndices: [i],
        confidence: 0.5,
        description: `Ungrouped item #${i + 1}`,
        flagged: false,
      });
    }
  }

  return cleanedGroups;
}

export async function POST(request: NextRequest) {
  const start = Date.now();
  try {
    const body: GroupingRequest = await request.json();
    const { photos } = body;

    if (!photos || photos.length === 0) {
      return NextResponse.json({ error: 'No photos provided' }, { status: 400 });
    }

    if (photos.length > 200) {
      return NextResponse.json(
        { error: 'Maximum 200 photos allowed per batch' },
        { status: 400 }
      );
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

    logEvent('ACTION_START', 'api/group-photos', 'POST', { photoCount: photos.length });

    const imageParts = photos.map((photo) =>
      base64ToGenerativePart(photo.base64, photo.mimeType)
    );

    const prompt = `${PHOTO_GROUPING_PROMPT}\n\nYou are analyzing ${photos.length} photos (indexed 0 to ${photos.length - 1}).`;

    const { data: rawResult, modelUsed } = await generateStructuredVisionJson<GroupingResponse>({
      scope: 'api/group-photos',
      prompt,
      imageParts,
      responseSchema: GROUPING_RESPONSE_SCHEMA,
    });

    const normalizedGroups = normalizeGroupingIndices(rawResult.groups || [], photos.length);

    logEvent(
      'ACTION_FINISH',
      'api/group-photos',
      'POST',
      {
        photoCount: photos.length,
        groupCount: normalizedGroups.length,
        modelUsed,
      },
      Date.now() - start
    );

    return NextResponse.json({ groups: normalizedGroups, modelUsed });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process photos';
    logEvent('ERROR', 'api/group-photos', 'POST', { error: message }, Date.now() - start);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
