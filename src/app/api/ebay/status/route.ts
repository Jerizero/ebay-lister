import { NextResponse } from 'next/server';
import { getConnectionStatus } from '@/lib/ebay/oauth';

export async function GET() {
  try {
    const status = await getConnectionStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('[api/ebay/status] Error:', error);
    return NextResponse.json(
      { connected: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
