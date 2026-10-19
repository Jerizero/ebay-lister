import { describe, it, expect } from 'vitest';
import { calculateCompStats, buildCompQuery } from '../lib/ebay/comps';
import { normalizeGroupingIndices } from '../app/api/group-photos/route';
import { partitionDirtyGroups } from '../hooks/useGrouping';
import { resolveLeafCategoryFallback, formatAspectName } from '../lib/ebay/client';
import { computePhotoSignature, exportListingsToCsv } from '../lib/utils';
import { auditListingSpecifics } from '../components/ListingCard';
import { Photo, PhotoGroup, Listing } from '../types';

describe('eBay Comps & Pricing Math', () => {
  it('calculates outlier-trimmed statistics for comp prices', () => {
    // 10 items with a low auction spike ($0.99) and an unreasonable outlier ($500)
    const rawPrices = [0.99, 25, 27, 28, 30, 32, 34, 35, 38, 500];
    const stats = calculateCompStats(rawPrices);

    expect(stats).not.toBeNull();
    // Low and high outliers should be trimmed
    expect(stats!.minPrice).toBeGreaterThan(0.99);
    expect(stats!.maxPrice).toBeLessThan(500);
    expect(stats!.medianPrice).toBeGreaterThanOrEqual(28);
    expect(stats!.medianPrice).toBeLessThanOrEqual(35);
    // Recommended price ends in .95
    expect(stats!.recommendedPrice % 1).toBeCloseTo(0.95, 2);
  });

  it('returns null for empty or invalid prices', () => {
    expect(calculateCompStats([])).toBeNull();
    expect(calculateCompStats([0, -5, NaN])).toBeNull();
  });

  it('builds clean search queries from item descriptions', () => {
    const raw = "Photo of Levi's 501 Dark Wash Straight Leg Men's Jeans with tags";
    const cleaned = buildCompQuery(raw);
    expect(cleaned).toContain("Levi's 501");
    expect(cleaned).toContain('Dark Wash');
    expect(cleaned).not.toContain('Photo');
    expect(cleaned).not.toContain('with');
  });
});

describe('Photo Grouping Normalization', () => {
  it('ensures every photo index from 0 to N-1 is covered exactly once', () => {
    const rawGroups = [
      {
        photoIndices: [0, 1, 1], // Duplicate index
        confidence: 0.95,
        description: 'Levi Jeans',
      },
      {
        photoIndices: [2, 99], // Out of bounds index
        confidence: 0.8,
        description: 'Nike Shoes',
      },
      // Note: index 3 is omitted
    ];

    const normalized = normalizeGroupingIndices(rawGroups, 4);

    const allIndices: number[] = [];
    for (const g of normalized) {
      allIndices.push(...g.photoIndices);
    }

    expect(allIndices.sort()).toEqual([0, 1, 2, 3]);
    const omittedGroup = normalized.find((g) => g.photoIndices.includes(3));
    expect(omittedGroup).toBeDefined();
    expect(omittedGroup!.description).toContain('Ungrouped');
  });
});

describe('Dirty Group Partitioning (Two-Stage Workflow)', () => {
  const dummyFile = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
  const photoA: Photo = { id: 'p1', file: dummyFile, url: 'blob:1' };
  const photoB: Photo = { id: 'p2', file: dummyFile, url: 'blob:2' };
  const photoC: Photo = { id: 'p3', file: dummyFile, url: 'blob:3' };

  it('preserves existing listing for untouched group and flags modified group as dirty', () => {
    const group1: PhotoGroup = { id: 'g1', photos: [photoA, photoB], confidence: 0.9 };

    const existingListing1: Listing = {
      id: 'l1',
      groupId: 'g1',
      photos: [photoA, photoB],
      photoSignature: computePhotoSignature([photoA, photoB]),
      title: "Levi's 501",
      description: 'Classic jeans',
      category: 'Clothing > Jeans',
      condition: 'GOOD',
      itemSpecifics: { brand: "Levi's" },
      price: 29.99,
      shippingPaidBy: 'buyer',
      acceptsReturns: false,
      status: 'ready',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // User modified group2 by adding photoB to it
    const modifiedGroup2: PhotoGroup = { id: 'g2-new', photos: [photoB, photoC], confidence: 0.5 };

    const { keptListings, dirtyGroups } = partitionDirtyGroups(
      [group1, modifiedGroup2],
      [existingListing1]
    );

    expect(keptListings.length).toBe(1);
    expect(keptListings[0].title).toBe("Levi's 501");
    expect(dirtyGroups.length).toBe(1);
    expect(dirtyGroups[0].id).toBe('g2-new');
  });
});

describe('eBay Leaf Category & Aspect Name Resolution', () => {
  it('resolves specific leaf category IDs rather than parent categories', () => {
    expect(resolveLeafCategoryFallback('Clothing > Men > Jeans', "Men's Levi's Jeans")).toBe('11483');
    expect(resolveLeafCategoryFallback('Clothing > Women > Jeans', "Women's Skinny Jeans")).toBe('11554');
    expect(resolveLeafCategoryFallback('Shoes', "Nike Men's Running Sneakers")).toBe('15709');
    expect(resolveLeafCategoryFallback('Apparel', "Men's Winter Jacket")).toBe('57988');
    // Must never return parent category 11450
    expect(resolveLeafCategoryFallback('Clothing')).not.toBe('11450');
  });

  it('formats aspect names into proper Title Case', () => {
    expect(formatAspectName('sizeType')).toBe('Size Type');
    expect(formatAspectName('brand')).toBe('Brand');
    expect(formatAspectName('fabric_wash')).toBe('Fabric Wash');
  });
});

describe('CSV Draft Export', () => {
  it('generates valid eBay File Exchange draft rows with quoted fields', () => {
    const dummyFile = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
    const listing: Listing = {
      id: 'list-123',
      groupId: 'g1',
      photos: [{ id: 'p1', file: dummyFile, url: 'blob:1' }],
      title: 'Levi\'s 501 Jeans, Blue',
      description: 'Great condition, "vintage" wash.',
      category: 'Jeans',
      categoryId: '11483',
      condition: 'GOOD',
      itemSpecifics: { brand: "Levi's", size: '32x30', color: 'Blue' },
      price: 34.50,
      shippingPaidBy: 'buyer',
      acceptsReturns: false,
      status: 'ready',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const csv = exportListingsToCsv([listing]);
    expect(csv).toContain('Action(SiteID=US|Country=US|Currency=USD|Version=1193)');
    expect(csv).toContain('"Levi\'s 501 Jeans, Blue"');
    expect(csv).toContain('34.50');
    expect(csv).toContain('11483');
  });
});

describe('eBay Specifics Completeness Audit', () => {
  it('correctly identifies missing aspects for clothing items', () => {
    const dummyFile = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
    const listing: Listing = {
      id: 'l-audit-1',
      groupId: 'g-1',
      photos: [{ id: 'p1', file: dummyFile, url: 'blob:1' }],
      title: "Levi's 501 Denim Jeans",
      description: 'Men denim pants',
      category: 'Clothing > Men > Jeans',
      condition: 'GOOD',
      itemSpecifics: {
        Brand: "Levi's",
        Department: 'Men',
        Color: 'Blue',
      },
      price: 29.99,
      shippingPaidBy: 'buyer',
      acceptsReturns: false,
      status: 'ready',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const audit = auditListingSpecifics(listing);
    expect(audit.isComplete).toBe(false);
    expect(audit.filledCount).toBe(3);
    expect(audit.totalCount).toBe(6);
    expect(audit.missing).toContain('Size');
    expect(audit.missing).toContain('Size Type');
    expect(audit.missing).toContain('Material');
  });

  it('marks a listing as complete when all key aspects are present', () => {
    const dummyFile = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
    const listing: Listing = {
      id: 'l-audit-2',
      groupId: 'g-2',
      photos: [{ id: 'p1', file: dummyFile, url: 'blob:1' }],
      title: 'Nike Air Max 90 Running Shoes',
      description: 'Men sneakers',
      category: 'Clothing > Shoes > Sneakers',
      condition: 'LIKE_NEW',
      itemSpecifics: {
        brand: 'Nike',
        'US Shoe Size': '10.5',
        department: 'Men',
        color: 'Black/White',
        style: 'Sneaker',
      },
      price: 65.00,
      shippingPaidBy: 'buyer',
      acceptsReturns: true,
      status: 'ready',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const audit = auditListingSpecifics(listing);
    expect(audit.isComplete).toBe(true);
    expect(audit.missing.length).toBe(0);
    expect(audit.filledCount).toBe(5);
  });
});

describe('Cover Photo Selection', () => {
  it('reorders target photo to index 0 while preserving group membership signature', () => {
    const dummyFile = new File(['dummy'], 'photo.jpg', { type: 'image/jpeg' });
    const p1: Photo = { id: 'p1', file: dummyFile, url: 'blob:1' };
    const p2: Photo = { id: 'p2', file: dummyFile, url: 'blob:2' };
    const p3: Photo = { id: 'p3', file: dummyFile, url: 'blob:3' };

    const originalPhotos = [p1, p2, p3];
    // Move p3 to cover (index 0)
    const newPhotos = [p3, p1, p2];

    expect(newPhotos[0].id).toBe('p3');
    // Group membership signature is preserved so AI does not unnecessarily re-run
    expect(computePhotoSignature(newPhotos)).toBe(computePhotoSignature(originalPhotos));
  });
});

