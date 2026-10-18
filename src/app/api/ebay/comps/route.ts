import { NextRequest, NextResponse } from 'next/server';
import { lookupEbayComps } from '@/lib/ebay/comps';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q')?.trim() || '';
  if (!query || query.length < 3) {
    return NextResponse.json(
      { error: 'Query parameter "q" (at least 3 characters) is required' },
      { status: 400 }
    );
  }

  const comps = await lookupEbayComps(query);
  if (!comps) {
    return NextResponse.json(
      { comps: null, message: 'No matching eBay comps found for this query' },
      { status: 200 }
    );
  }

  return NextResponse.json({ comps });
}
