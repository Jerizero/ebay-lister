import { promises as fs } from 'fs';
import path from 'path';
import { EbayTokens, EbayTokenRecord, EBAY_AUTH_BASE, EBAY_API_BASE } from '@/types/ebay';

const USER_ID = 'default_user';
const TOKENS_FILE = path.join(process.cwd(), '.ebay-tokens.json');

// Environment config
function getConfig() {
  const env = (process.env.EBAY_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';
  return {
    clientId: process.env.EBAY_CLIENT_ID!,
    clientSecret: process.env.EBAY_CLIENT_SECRET!,
    redirectUri: process.env.EBAY_REDIRECT_URI!,
    environment: env,
    authBase: EBAY_AUTH_BASE[env],
    apiBase: EBAY_API_BASE[env],
  };
}

// Generate the eBay OAuth authorization URL
export function generateAuthUrl(): string {
  const config = getConfig();
  const scopes = [
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.account',
  ];

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
  });

  return `${config.authBase}/oauth2/authorize?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string): Promise<EbayTokens> {
  const config = getConfig();

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  const response = await fetch(`${config.apiBase}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: config.redirectUri,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[ebay/oauth] Token exchange failed:', error);
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  const tokens: EbayTokens = await response.json();
  return tokens;
}

// Refresh access token using refresh token
export async function refreshAccessToken(refreshToken: string): Promise<EbayTokens> {
  const config = getConfig();

  const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');

  const scopes = [
    'https://api.ebay.com/oauth/api_scope/sell.inventory',
    'https://api.ebay.com/oauth/api_scope/sell.account',
  ];

  const response = await fetch(`${config.apiBase}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      scope: scopes.join(' '),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[ebay/oauth] Token refresh failed:', error);
    throw new Error(`Failed to refresh token: ${error}`);
  }

  const tokens: EbayTokens = await response.json();
  return tokens;
}

// Save tokens to local file
export async function saveTokens(tokens: EbayTokens): Promise<void> {
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const tokenRecord: EbayTokenRecord = {
    id: 'local',
    user_id: USER_ID,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };

  await fs.writeFile(TOKENS_FILE, JSON.stringify(tokenRecord, null, 2));
  console.log('[ebay/oauth] Tokens saved to', TOKENS_FILE);
}

// Get stored tokens from local file
export async function getStoredTokens(): Promise<EbayTokenRecord | null> {
  try {
    const data = await fs.readFile(TOKENS_FILE, 'utf-8');
    return JSON.parse(data) as EbayTokenRecord;
  } catch (err) {
    // File doesn't exist or invalid - not connected yet
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    console.error('[ebay/oauth] Failed to read tokens:', err);
    return null;
  }
}

// Check if tokens are expired (with 5 min buffer)
export function isTokenExpired(expiresAt: string): boolean {
  const expiry = new Date(expiresAt).getTime();
  const now = Date.now();
  const bufferMs = 5 * 60 * 1000; // 5 minutes
  return now >= expiry - bufferMs;
}

// Get a valid access token, refreshing if needed
export async function getValidAccessToken(): Promise<string> {
  const stored = await getStoredTokens();

  if (!stored) {
    throw new Error('eBay not connected. Please connect your eBay account first.');
  }

  // If token is still valid, return it
  if (!isTokenExpired(stored.expires_at)) {
    return stored.access_token;
  }

  // Token expired, refresh it
  console.log('[ebay/oauth] Access token expired, refreshing...');
  const newTokens = await refreshAccessToken(stored.refresh_token);

  // Save the new tokens
  await saveTokens({
    ...newTokens,
    refresh_token: newTokens.refresh_token || stored.refresh_token,
  });

  return newTokens.access_token;
}

// Check connection status
export async function getConnectionStatus(): Promise<{
  connected: boolean;
  expiresAt?: string;
}> {
  try {
    const stored = await getStoredTokens();

    if (!stored) {
      return { connected: false };
    }

    // Check if we can get a valid token (will refresh if needed)
    await getValidAccessToken();

    return {
      connected: true,
      expiresAt: stored.expires_at,
    };
  } catch {
    return { connected: false };
  }
}
