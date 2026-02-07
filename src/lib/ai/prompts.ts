// AI Prompts for eBay Mass Lister

export const PHOTO_GROUPING_PROMPT = `You are analyzing product photos for eBay listings. Your task is to identify which photos show the SAME EXACT item and group them together.

I'm showing you multiple product photos. Some photos may show the same item from different angles, and some may show completely different items.

For each group of photos that show the SAME EXACT item:
1. Identify all photos that belong together (same product, different angles)
2. Assign a confidence score (0.0 to 1.0) for your grouping
3. Write a brief description of what the item appears to be

CRITICAL RULES FOR JEANS AND DENIM:
- EACH PAIR OF JEANS IS A SEPARATE LISTING - never group multiple pairs together
- Different WASH = DIFFERENT item (light blue, medium blue, dark blue, black, gray, white are ALL different)
- Different SHADE of blue = DIFFERENT item (even subtle shade differences mean separate items)
- Different DISTRESSING/FADING patterns = DIFFERENT item
- Different BRANDS = DIFFERENT item
- Different SIZES = DIFFERENT item
- Different STYLES (skinny, straight, bootcut, relaxed, slim) = DIFFERENT item
- If you see 10 photos of jeans, you likely have 5-10 DIFFERENT pairs, not 1-2 pairs with many angles
- Look carefully at the EXACT shade of denim - light wash and medium wash are DIFFERENT items

CRITICAL RULES FOR OTHER CLOTHING:
- Different SHADES of the same color = DIFFERENT items
- Different SIZES visible on tags = DIFFERENT items
- Different BRANDS = DIFFERENT items
- When in doubt about clothing, treat as SEPARATE items - it's better to have too many groups than to combine different items

CONTENT MODERATION:
- Flag any photos that appear to contain inappropriate content (nudity, adult content, weapons, illegal items)
- Mark flagged photos with "flagged": true in the response
- Do NOT group flagged photos with legitimate items

Consider these factors when grouping:
- EXACT same item features (shape, color, brand markings, patterns, wash, shade)
- Similar background/setting (but different angle)
- Size and proportions match EXACTLY
- Any visible text/labels match EXACTLY
- For clothing: same wash, same distressing, same brand, same size

Return your response as valid JSON in this exact format:
{
  "groups": [
    {
      "photoIndices": [0, 3, 7],
      "confidence": 0.95,
      "description": "Levi's 501 Dark Wash Straight Leg Jeans",
      "flagged": false
    },
    {
      "photoIndices": [1, 2],
      "confidence": 0.88,
      "description": "Levi's 501 Light Wash Straight Leg Jeans",
      "flagged": false
    },
    {
      "photoIndices": [4],
      "confidence": 1.0,
      "description": "INAPPROPRIATE CONTENT - Adult material",
      "flagged": true
    }
  ]
}

Important:
- Every photo index (0 to N-1) must appear in exactly ONE group
- Single-photo items should have their own group with confidence 1.0
- photoIndices are 0-based (first photo is 0)
- For clothing items, be VERY specific about wash, color shade, and style in descriptions
- Return ONLY the JSON, no other text`;

export const LISTING_GENERATION_PROMPT = `You are an expert eBay seller creating optimized product listings. Analyze these product photos and generate a complete eBay listing.

Generate the following:

1. TITLE (max 80 characters)
   - Include brand name if visible
   - Include key features (size, color, material)
   - Use eBay SEO best practices
   - Capitalize important words

2. DESCRIPTION
   - Detailed paragraph describing the item
   - Mention condition, features, and any flaws visible
   - Include measurements if visible
   - Be honest and accurate

3. CATEGORY
   - Suggest the most specific eBay category path
   - Format: "Category > Subcategory > Sub-subcategory"

4. CONDITION
   - One of: NEW, LIKE_NEW, GOOD, ACCEPTABLE
   - Based on visible wear, tags, packaging

5. ITEM SPECIFICS
   - Brand (if visible)
   - Size (if applicable)
   - Color
   - Material (if identifiable)
   - Model (if visible)
   - Any other relevant specifics

Return your response as valid JSON:
{
  "title": "Nike Air Max 90 Men's Running Shoes Size 10 White/Black Athletic Sneakers",
  "description": "Authentic Nike Air Max 90 running shoes in excellent condition...",
  "category": "Clothing, Shoes & Accessories > Men > Men's Shoes > Athletic Shoes",
  "condition": "LIKE_NEW",
  "itemSpecifics": {
    "brand": "Nike",
    "size": "10",
    "color": "White/Black",
    "material": "Synthetic/Mesh",
    "style": "Running Shoes"
  }
}

Return ONLY the JSON, no other text.`;
