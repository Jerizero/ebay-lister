import { NextResponse } from 'next/server';
import { generateAuthUrl } from '@/lib/ebay/oauth';

export async function GET() {
  try {
    // Check if eBay credentials are configured
    if (!process.env.EBAY_CLIENT_ID || !process.env.EBAY_CLIENT_SECRET) {
      return NextResponse.json(
        { error: 'eBay API credentials not configured' },
        { status: 500 }
      );
    }

    const authUrl = generateAuthUrl();

    // Redirect to eBay authorization page
    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('[api/ebay/auth] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to initiate OAuth' },
      { status: 500 }
    );
  }
}
