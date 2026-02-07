import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_AI_API_KEY;

if (!apiKey) {
  console.warn('GOOGLE_AI_API_KEY not set - Gemini features will not work');
}

export const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Get the vision model for image analysis
export function getVisionModel() {
  if (!genAI) {
    throw new Error('Gemini API key not configured');
  }
  return genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });
}

// Convert base64 string to Gemini format
export function base64ToGenerativePart(base64: string, mimeType: string = 'image/jpeg') {
  // Remove data URL prefix if present
  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');

  return {
    inlineData: {
      data: cleanBase64,
      mimeType,
    },
  };
}
