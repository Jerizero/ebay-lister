import { generateId } from '@/lib/utils';

// TODO: Swap placeholder provider with a real one for production
// Options: Cloudinary, AWS S3, or eBay's Media API
export interface ImageHostingProvider {
  upload(photos: { base64: string; mimeType?: string }[]): Promise<string[]>;
  delete(url: string): Promise<void>;
  checkStatus(): Promise<{ configured: boolean; provider: string }>;
}

// Placeholder image URL for sandbox testing
const PLACEHOLDER_IMAGE = 'https://i.ebayimg.com/images/g/placeholder.jpg';

// Convert base64 to data URL (for local preview only, won't work with eBay)
export function base64ToDataUrl(base64: string, mimeType: string = 'image/jpeg'): string {
  if (base64.startsWith('data:')) {
    return base64;
  }
  return `data:${mimeType};base64,${base64}`;
}

// Upload images - returns placeholder URLs for sandbox testing
// In production, implement actual upload to a hosting service
export async function uploadImages(
  photos: { base64: string; mimeType?: string }[]
): Promise<string[]> {
  console.log(`[ebay/images] Preparing ${photos.length} images...`);
  console.log('[ebay/images] NOTE: Using placeholder URLs for sandbox testing');
  console.log('[ebay/images] For production, configure a real image hosting service');

  // For sandbox testing, return placeholder URLs
  // eBay sandbox accepts any valid image URL
  const urls = photos.map(() => {
    // Generate unique placeholder URLs
    const id = generateId();
    // Use a real placeholder service that returns actual images
    return `https://picsum.photos/seed/${id}/800/800`;
  });

  return urls;
}

// Single image upload
export async function uploadImage(
  base64: string,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  const urls = await uploadImages([{ base64, mimeType }]);
  return urls[0] || PLACEHOLDER_IMAGE;
}

// Delete image - no-op for placeholder implementation
export async function deleteImage(url: string): Promise<void> {
  console.log('[ebay/images] Delete not implemented for placeholder images:', url);
}

// Check if image hosting is configured (matches ImageHostingProvider.checkStatus)
export async function checkImageHosting(): Promise<{
  configured: boolean;
  provider: string;
}> {
  // For now, always return placeholder mode
  return {
    configured: false,
    provider: 'placeholder (sandbox testing only)',
  };
}
