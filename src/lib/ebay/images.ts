import { generateId } from '@/lib/utils';
import { getValidAccessToken } from './oauth';
import { logEvent } from '@/lib/logger';

export interface ImageHostingProvider {
  upload(photos: { base64: string; mimeType?: string }[]): Promise<{
    urls: string[];
    hostedVia: 'ebay_eps' | 'sandbox_fallback';
  }>;
  delete(url: string): Promise<void>;
  checkStatus(): Promise<{ configured: boolean; provider: string }>;
}

const TRADING_API_URL = {
  sandbox: 'https://api.sandbox.ebay.com/ws/api.dll',
  production: 'https://api.ebay.com/ws/api.dll',
};

// Convert base64 to data URL (for local preview only)
export function base64ToDataUrl(base64: string, mimeType: string = 'image/jpeg'): string {
  if (base64.startsWith('data:')) {
    return base64;
  }
  return `data:${mimeType};base64,${base64}`;
}

/**
 * Upload a single base64 image directly to eBay Picture Services (EPS) via UploadSiteHostedPictures.
 * Uses the user's OAuth 2.0 access token via X-EBAY-API-IAF-TOKEN and returns the hosted i.ebayimg.com FullURL.
 */
export async function uploadToEbayPictureServices(
  base64: string,
  mimeType: string = 'image/jpeg',
  accessToken: string
): Promise<string> {
  const env = (process.env.EBAY_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';
  const endpoint = TRADING_API_URL[env];

  const cleanBase64 = base64.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(cleanBase64, 'base64');
  const boundary = `----EbayEpsBoundary${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const pictureName = `item-${Date.now()}.jpg`;

  const xmlPayload = `<?xml version="1.0" encoding="utf-8"?>
<UploadSiteHostedPicturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <PictureName>${pictureName}</PictureName>
  <PictureSet>Supersize</PictureSet>
</UploadSiteHostedPicturesRequest>`;

  const preamble = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="XML Payload"\r\n` +
      `Content-Type: text/xml;charset=utf-8\r\n\r\n` +
      `${xmlPayload}\r\n` +
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="image"; filename="${pictureName}"\r\n` +
      `Content-Type: ${mimeType}\r\n` +
      `Content-Transfer-Encoding: binary\r\n\r\n`,
    'utf-8'
  );
  const epilogue = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8');
  const multipartBody = Buffer.concat([preamble, imageBuffer, epilogue]);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'X-EBAY-API-CALL-NAME': 'UploadSiteHostedPictures',
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': '1193',
      'X-EBAY-API-IAF-TOKEN': accessToken,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body: multipartBody,
  });

  const xmlText = await response.text();
  const fullUrlMatch = xmlText.match(/<FullURL>([^<]+)<\/FullURL>/i);

  if (!response.ok || !fullUrlMatch?.[1]) {
    const shortMsgMatch = xmlText.match(/<ShortMessage>([^<]+)<\/ShortMessage>/i);
    const reason = shortMsgMatch?.[1] || `HTTP ${response.status}`;
    throw new Error(`eBay Picture Services upload failed: ${reason}`);
  }

  return fullUrlMatch[1].trim();
}

/**
 * Upload product photos to eBay Picture Services (EPS).
 * In production mode, requires real EPS upload to succeed.
 * In sandbox mode, attempts EPS first and falls back to sandbox test URLs if Sandbox EPS rejects the token.
 */
export async function uploadImagesWithMeta(
  photos: { base64: string; mimeType?: string }[]
): Promise<{ urls: string[]; hostedVia: 'ebay_eps' | 'sandbox_fallback' }> {
  const env = (process.env.EBAY_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';
  const start = Date.now();

  logEvent('ACTION_START', 'ebay/images', 'uploadImages', {
    photoCount: photos.length,
    environment: env,
  });

  try {
    const accessToken = await getValidAccessToken();
    const uploadedUrls: string[] = [];

    for (const photo of photos) {
      const url = await uploadToEbayPictureServices(
        photo.base64,
        photo.mimeType || 'image/jpeg',
        accessToken
      );
      uploadedUrls.push(url);
    }

    logEvent(
      'ACTION_FINISH',
      'ebay/images',
      'uploadImages',
      { photoCount: uploadedUrls.length, hostedVia: 'ebay_eps' },
      Date.now() - start
    );

    return { urls: uploadedUrls, hostedVia: 'ebay_eps' };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    // Never allow fake placeholder images in production
    if (env === 'production') {
      logEvent(
        'ERROR',
        'ebay/images',
        'uploadImages',
        { environment: env, error: errorMsg },
        Date.now() - start
      );
      throw new Error(`Failed to upload photos to eBay Picture Services: ${errorMsg}`);
    }

    // In sandbox mode, fall back gracefully if sandbox EPS is unavailable
    const fallbackUrls = photos.map(() => {
      const id = generateId();
      return `https://picsum.photos/seed/${id}/800/800`;
    });

    logEvent(
      'ACTION_FINISH',
      'ebay/images',
      'uploadImages',
      {
        photoCount: fallbackUrls.length,
        hostedVia: 'sandbox_fallback',
        epsNote: errorMsg,
      },
      Date.now() - start
    );

    return { urls: fallbackUrls, hostedVia: 'sandbox_fallback' };
  }
}

export async function uploadImages(
  photos: { base64: string; mimeType?: string }[]
): Promise<string[]> {
  const res = await uploadImagesWithMeta(photos);
  return res.urls;
}

export async function uploadImage(
  base64: string,
  mimeType: string = 'image/jpeg'
): Promise<string> {
  const urls = await uploadImages([{ base64, mimeType }]);
  return urls[0];
}

export async function deleteImage(url: string): Promise<void> {
  logEvent('ACTION_FINISH', 'ebay/images', 'deleteImage.noop', { url });
}

export async function checkImageHosting(): Promise<{
  configured: boolean;
  provider: string;
}> {
  const env = (process.env.EBAY_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';
  return {
    configured: true,
    provider:
      env === 'production'
        ? 'eBay Picture Services (EPS)'
        : 'eBay Picture Services (EPS + Sandbox fallback)',
  };
}
