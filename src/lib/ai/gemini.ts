import { GoogleGenerativeAI, GenerationConfig, Part, Schema } from '@google/generative-ai';
import { logEvent } from '@/lib/logger';

const apiKey = process.env.GOOGLE_AI_API_KEY;

if (!apiKey) {
  console.warn('GOOGLE_AI_API_KEY not set - Gemini features will not work');
}

export const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export const PRIMARY_GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.1-pro-preview';
export const FALLBACK_GEMINI_MODELS = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-2.5-flash'];

// Get the vision model for image analysis
export function getVisionModel(modelName: string = PRIMARY_GEMINI_MODEL, generationConfig?: GenerationConfig) {
  if (!genAI) {
    throw new Error('Gemini API key not configured');
  }
  return genAI.getGenerativeModel({
    model: modelName,
    ...(generationConfig ? { generationConfig } : {}),
  });
}

// Convert base64 string to Gemini format
export function base64ToGenerativePart(base64: string, mimeType: string = 'image/jpeg'): Part {
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');

  return {
    inlineData: {
      data: cleanBase64,
      mimeType,
    },
  };
}

// Safely parse JSON from model response text
export function parseModelJson<T>(text: string): T {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    // Strip markdown code fences if present
    const stripped = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '')
      .trim();
    try {
      return JSON.parse(stripped) as T;
    } catch {
      const jsonMatch = stripped.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid response from AI: no JSON object found');
      }
      return JSON.parse(jsonMatch[0]) as T;
    }
  }
}

/**
 * Generate structured JSON from multimodal parts using the configured primary Gemini model,
 * with automatic fallback if the key hits a model-tier quota or availability error.
 */
export async function generateStructuredVisionJson<T>(params: {
  scope: string;
  prompt: string;
  imageParts: Part[];
  responseSchema?: Schema;
}): Promise<{ data: T; modelUsed: string }> {
  if (!genAI) {
    throw new Error('Gemini API key not configured. Please add GOOGLE_AI_API_KEY to .env.local');
  }

  const candidateModels = [
    PRIMARY_GEMINI_MODEL,
    ...FALLBACK_GEMINI_MODELS.filter((m) => m !== PRIMARY_GEMINI_MODEL),
  ];

  let lastError: Error | null = null;

  for (const modelName of candidateModels) {
    const start = Date.now();
    try {
      logEvent('ACTION_START', params.scope, 'gemini.generateContent', {
        model: modelName,
        imageCount: params.imageParts.length,
      });

      const model = getVisionModel(modelName, {
        responseMimeType: 'application/json',
        ...(params.responseSchema ? { responseSchema: params.responseSchema } : {}),
      });

      const result = await model.generateContent([params.prompt, ...params.imageParts]);
      const response = await result.response;
      const text = response.text();
      const parsed = parseModelJson<T>(text);

      logEvent(
        'ACTION_FINISH',
        params.scope,
        'gemini.generateContent',
        { model: modelName, imageCount: params.imageParts.length },
        Date.now() - start
      );

      return { data: parsed, modelUsed: modelName };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastError = err instanceof Error ? err : new Error(msg);

      logEvent(
        'ERROR',
        params.scope,
        'gemini.generateContent',
        { model: modelName, error: msg },
        Date.now() - start
      );

      // Only fall back to next model if quota/rate-limit (429) or model not found (404)
      const isModelOrQuotaError =
        msg.includes('429') ||
        msg.includes('quota') ||
        msg.includes('404') ||
        msg.includes('not found') ||
        msg.includes('not supported');

      if (!isModelOrQuotaError) {
        throw lastError;
      }
    }
  }

  throw lastError || new Error('All Gemini models failed');
}
