import { Listing } from '@/types';

/**
 * Convert a File or Blob to base64 string
 */
export function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Check if a File is a supported image (by MIME type or extension for macOS Finder HEIC files)
 */
export function isSupportedImageFile(file: { type?: string; name?: string }): boolean {
  if (file.type && file.type.startsWith('image/')) {
    return true;
  }
  const name = (file.name || '').toLowerCase();
  return /\.(jpe?g|png|webp|heic|heif)$/i.test(name);
}

/**
 * Resize an image to a maximum dimension while maintaining aspect ratio.
 * Always revokes the temporary object URL to prevent memory leaks.
 */
export async function resizeImage(
  file: File | Blob,
  maxDimension: number = 1024
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;

      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height / width) * maxDimension);
          width = maxDimension;
        } else {
          width = Math.round((width / height) * maxDimension);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        'image/jpeg',
        0.85
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // If browser cannot natively decode (e.g. raw HEIC in Chrome), fall back to original file blob
      resolve(file);
    };

    img.src = objectUrl;
  });
}

/**
 * Deterministic signature of a group's photo IDs to detect when a group was modified
 */
export function computePhotoSignature(photos: { id: string }[]): string {
  return photos
    .map((p) => p.id)
    .sort()
    .join('|');
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Export listings to eBay Seller Hub Drafts CSV format
 */
export function exportListingsToCsv(listings: Listing[]): string {
  const escapeCsv = (val: string | number | undefined) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const headers = [
    'Action(SiteID=US|Country=US|Currency=USD|Version=1193)',
    'CustomLabel',
    'Category',
    'Title',
    'ConditionID',
    'StartPrice',
    'Quantity',
    'Format',
    'Duration',
    'Description',
    'C:Brand',
    'C:Size',
    'C:Color',
    'C:Department',
    'C:Size Type',
    'C:Style',
    'C:Material',
  ];

  const conditionMap: Record<Listing['condition'], string> = {
    NEW: '1000',
    LIKE_NEW: '3000',
    GOOD: '3000',
    ACCEPTABLE: '3000',
  };

  const rows = listings.map((l) => [
    'Draft',
    `EBL-${l.id.slice(0, 12)}`,
    l.categoryId || '11483',
    l.title,
    conditionMap[l.condition] || '3000',
    (l.price ?? 19.99).toFixed(2),
    1,
    'FixedPrice',
    'GTC',
    l.description,
    l.itemSpecifics.brand || 'Unbranded',
    l.itemSpecifics.size || '',
    l.itemSpecifics.color || '',
    l.itemSpecifics.department || '',
    l.itemSpecifics.sizeType || 'Regular',
    l.itemSpecifics.style || '',
    l.itemSpecifics.material || '',
  ]);

  return [
    headers.join(','),
    ...rows.map((row) => row.map(escapeCsv).join(',')),
  ].join('\n');
}
