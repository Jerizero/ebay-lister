import { CompItem, MarketComps, EBAY_API_BASE } from '@/types/ebay';
import { getValidAccessToken } from './oauth';
import { logEvent } from '@/lib/logger';

/**
 * Compute outlier-trimmed min, max, median, and recommended price from a list of comp prices.
 * Trims bottom 10% and top 10% when 6+ comps exist so $0.99 auctions or overpriced outliers do not skew results.
 */
export function calculateCompStats(rawPrices: number[]): {
  minPrice: number;
  maxPrice: number;
  medianPrice: number;
  recommendedPrice: number;
} | null {
  const valid = rawPrices
    .filter((p) => Number.isFinite(p) && p > 1 && p < 10000)
    .sort((a, b) => a - b);

  if (valid.length === 0) {
    return null;
  }

  let trimmed = valid;
  if (valid.length >= 6) {
    const cut = Math.floor(valid.length * 0.15);
    trimmed = valid.slice(cut, valid.length - cut);
  }

  const minPrice = Number(trimmed[0].toFixed(2));
  const maxPrice = Number(trimmed[trimmed.length - 1].toFixed(2));

  const mid = Math.floor(trimmed.length / 2);
  const rawMedian =
    trimmed.length % 2 === 0
      ? (trimmed[mid - 1] + trimmed[mid]) / 2
      : trimmed[mid];

  const medianPrice = Number(rawMedian.toFixed(2));
  // Recommended price sits slightly below median (competitive sell-through price ending in .95 or .99)
  const competitive = Math.max(minPrice, rawMedian * 0.95);
  const recommendedPrice = Number((Math.floor(competitive) + 0.95).toFixed(2));

  return {
    minPrice,
    maxPrice,
    medianPrice,
    recommendedPrice,
  };
}

/**
 * Clean a group description or title into a tight eBay search query (max 8 keywords).
 */
export function buildCompQuery(description: string): string {
  const stopWords = new Set([
    'item',
    'photo',
    'photos',
    'group',
    'ungrouped',
    'new',
    'used',
    'pre-owned',
    'condition',
    'with',
    'and',
    'the',
    'for',
    'pair',
    'of',
  ]);

  return description
    .replace(/[^\w\s'.-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word.toLowerCase()))
    .slice(0, 8)
    .join(' ')
    .trim();
}

/**
 * Try official eBay Browse API (`GET /buy/browse/v1/item_summary/search`) when production token is available.
 */
async function fetchBrowseApiComps(query: string): Promise<CompItem[]> {
  const env = (process.env.EBAY_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';
  // Sandbox Browse API has no real secondary-market pricing data
  if (env !== 'production') {
    return [];
  }

  try {
    const token = await getValidAccessToken();
    const apiBase = EBAY_API_BASE.production;
    const params = new URLSearchParams({
      q: query,
      limit: '20',
      filter: 'buyingOptions:{FIXED_PRICE}',
    });

    const response = await fetch(
      `${apiBase}/buy/browse/v1/item_summary/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
        signal: AbortSignal.timeout(6000),
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const summaries = Array.isArray(data?.itemSummaries) ? data.itemSummaries : [];

    const items: CompItem[] = [];
    for (const s of summaries) {
      const priceVal = parseFloat(s?.price?.value);
      if (Number.isFinite(priceVal) && priceVal > 0) {
        items.push({
          title: String(s.title || ''),
          price: priceVal,
          currency: String(s?.price?.currency || 'USD'),
          condition: s?.condition ? String(s.condition) : undefined,
          itemWebUrl: s?.itemWebUrl ? String(s.itemWebUrl) : undefined,
          imageUrl: s?.image?.imageUrl ? String(s.image.imageUrl) : undefined,
        });
      }
    }
    return items;
  } catch {
    return [];
  }
}

/**
 * Parse public eBay search HTML for sold/active listing prices when running in sandbox or without Browse API scope.
 */
export function parsePublicEbaySearchHtml(html: string): CompItem[] {
  const items: CompItem[] = [];
  // Match s-item blocks or price spans from eBay search results
  const itemBlocks = html.split(/class=["'][^"']*s-item__wrapper/i).slice(1);

  for (const block of itemBlocks) {
    const titleMatch = block.match(/class=["'][^"']*s-item__title[^>]*>(?:<span[^>]*>)?([^<]+)/i);
    const priceMatch = block.match(/class=["'][^"']*s-item__price[^>]*>\s*(?:<span[^>]*>)?\$([0-9]+(?:\.[0-9]{2})?)/i);
    const urlMatch = block.match(/href=["'](https:\/\/www\.ebay\.com\/itm\/[^"'?]+)/i);

    const rawTitle = titleMatch?.[1]?.trim() || '';
    if (!rawTitle || rawTitle.toLowerCase().includes('shop on ebay')) {
      continue;
    }

    const price = priceMatch ? parseFloat(priceMatch[1]) : NaN;
    if (Number.isFinite(price) && price > 1) {
      items.push({
        title: rawTitle.replace(/&amp;/g, '&').replace(/&#039;/g, "'").replace(/&quot;/g, '"'),
        price,
        currency: 'USD',
        itemWebUrl: urlMatch?.[1],
      });
    }
    if (items.length >= 16) break;
  }

  return items;
}

async function fetchPublicSearchComps(query: string): Promise<CompItem[]> {
  try {
    const url = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(query)}&LH_Sold=1&LH_Complete=1&_ipg=60`;
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(5500),
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    return parsePublicEbaySearchHtml(html);
  } catch {
    return [];
  }
}

/**
 * Look up real eBay market comps for an item description or title.
 * Tries official eBay Browse API first, then public eBay sold search, and returns structured stats.
 */
export async function lookupEbayComps(rawQuery: string): Promise<MarketComps | null> {
  const query = buildCompQuery(rawQuery);
  if (!query || query.length < 3) {
    return null;
  }

  const start = Date.now();
  logEvent('ACTION_START', 'ebay/comps', 'lookupEbayComps', { query });

  try {
    // 1. Try eBay Browse API (production)
    let items = await fetchBrowseApiComps(query);
    let source: MarketComps['source'] = 'ebay_browse_api';

    // 2. Fallback to public eBay sold search
    if (items.length === 0) {
      items = await fetchPublicSearchComps(query);
      source = 'ebay_public_search';
    }

    const stats = calculateCompStats(items.map((i) => i.price));
    if (!stats) {
      logEvent(
        'ACTION_FINISH',
        'ebay/comps',
        'lookupEbayComps',
        { query, count: 0, status: 'no_comps_found' },
        Date.now() - start
      );
      return null;
    }

    const result: MarketComps = {
      query,
      source,
      count: items.length,
      minPrice: stats.minPrice,
      maxPrice: stats.maxPrice,
      medianPrice: stats.medianPrice,
      recommendedPrice: stats.recommendedPrice,
      sampleItems: items.slice(0, 5),
      fetchedAt: new Date().toISOString(),
    };

    logEvent(
      'ACTION_FINISH',
      'ebay/comps',
      'lookupEbayComps',
      {
        query,
        source,
        count: result.count,
        medianPrice: result.medianPrice,
        recommendedPrice: result.recommendedPrice,
      },
      Date.now() - start
    );

    return result;
  } catch (err) {
    logEvent(
      'ERROR',
      'ebay/comps',
      'lookupEbayComps',
      { query, error: err instanceof Error ? err.message : String(err) },
      Date.now() - start
    );
    return null;
  }
}
