import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, saveTokens } from '@/lib/ebay/oauth';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Handle eBay error response
    if (error) {
      console.error('[api/ebay/callback] OAuth error:', error, errorDescription);
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('ebay_error', errorDescription || error);
      return NextResponse.redirect(redirectUrl);
    }

    // Validate code
    if (!code) {
      console.error('[api/ebay/callback] No authorization code received');
      const redirectUrl = new URL('/', request.url);
      redirectUrl.searchParams.set('ebay_error', 'No authorization code received');
      return NextResponse.redirect(redirectUrl);
    }

    // Exchange code for tokens
    console.log('[api/ebay/callback] Exchanging code for tokens...');
    const tokens = await exchangeCodeForTokens(code);

    // Save tokens to local file storage
    console.log('[api/ebay/callback] Saving tokens...');
    await saveTokens(tokens);

    console.log('[api/ebay/callback] eBay connected successfully');

    // Redirect back to app with success
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set('ebay_connected', 'true');
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('[api/ebay/callback] Error:', error);
    const redirectUrl = new URL('/', request.url);
    redirectUrl.searchParams.set(
      'ebay_error',
      error instanceof Error ? error.message : 'Failed to connect eBay'
    );
    return NextResponse.redirect(redirectUrl);
  }
}
