// AI Prompts for eBay Mass Lister

export const PHOTO_GROUPING_PROMPT = `You are analyzing product photos for eBay listings. Your task is to identify which photos show the SAME EXACT item and group them together.

I'm showing you multiple product photos. Some photos may show the same item from different angles, and some may show completely different items.

For each group of photos that show the SAME EXACT item:
1. Identify all photos that belong together (same product, different angles, tags, close-ups)
2. Assign a confidence score (0.0 to 1.0) for your grouping
3. Write a specific description of what the item appears to be (include brand, model/fit, color/wash, and item type so it can be used as a search query for eBay comps)

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
- Close-up photos of a size tag, brand patch, or care label taken right next to an item belong with that item

CRITICAL RULES FOR OTHER CLOTHING:
- Different SHADES of the same color = DIFFERENT items
- Different SIZES visible on tags = DIFFERENT items
- Different BRANDS = DIFFERENT items
- When in doubt about clothing, treat as SEPARATE items - it's better to have too many groups than to combine different items

CONTENT MODERATION:
- Flag any photos that appear to contain inappropriate content (nudity, adult content, weapons, illegal items)
- Mark flagged photos with "flagged": true in the response
- Do NOT group flagged photos with legitimate items

Return your response as valid JSON in this exact format:
{
  "groups": [
    {
      "photoIndices": [0, 3, 7],
      "confidence": 0.95,
      "description": "Levi's 501 Dark Wash Straight Leg Men's Jeans",
      "flagged": false
    },
    {
      "photoIndices": [1, 2],
      "confidence": 0.88,
      "description": "Levi's 501 Light Wash Straight Leg Men's Jeans",
      "flagged": false
    }
  ]
}

Important:
- Every photo index (0 to N-1) must appear in exactly ONE group
- Single-photo items should have their own group with confidence 1.0
- photoIndices are 0-based (first photo is 0)
- For clothing items, be VERY specific about brand, wash, color shade, and style in descriptions
- Return ONLY the JSON, no other text`;

export const LISTING_GENERATION_PROMPT = `You are an expert eBay power seller creating high-converting product listings. Analyze these product photos (and any provided eBay market comps) and generate a complete eBay listing.

Generate the following:

1. TITLE (max 80 characters)
   - Formula: [Brand] [Model/Line] [Gender/Department] [Item Type] [Size] [Color/Wash] [Key Material/Style]
   - Read size tags, brand labels, and style codes in the photos carefully
   - Capitalize key words, no promotional fluff ("L@@K", "WOW"), max 80 characters

2. DESCRIPTION
   - Clear, factual paragraph describing the item, its features, fit, fabric, and visible condition
   - Note any visible wear, flaws, or measurements shown in the photos
   - Do not use em dashes or marketing cliches

3. CATEGORY
   - Suggest the most specific eBay leaf category path
   - Format: "Clothing, Shoes & Accessories > Men > Men's Clothing > Jeans"

4. CONDITION
   - One of: NEW, LIKE_NEW, GOOD, ACCEPTABLE
   - NEW only if retail price tags or sealed packaging are visible

5. ITEM SPECIFICS
   - Extract all visible details required by eBay:
     - brand (e.g. "Levi's", "Nike", "Unbranded")
     - size (e.g. "32x30", "L", "10")
     - sizeType (e.g. "Regular", "Big & Tall", "Petite")
     - department (e.g. "Men", "Women", "Unisex Adults")
     - color (e.g. "Blue", "Black")
     - material (e.g. "100% Cotton", "Denim", "Leather")
     - style (e.g. "Straight", "Athletic Sneakers", "Crewneck")
     - model (if visible on tag/label)

6. SUGGESTED PRICE (REQUIRED)
   - Provide "min", "max", and "recommended" in USD (numbers, e.g. 24.99)
   - If real eBay market comps are provided in the prompt, anchor "min", "max", and "recommended" directly to those comps adjusted for the item's condition
   - If no market comps are provided, estimate a realistic secondary-market eBay resale price based on brand, model, and condition

Return your response as valid JSON:
{
  "title": "Levi's 501 Original Fit Men's Jeans 32x30 Dark Wash Blue 100% Cotton Straight",
  "description": "Pre-owned Levi's 501 button-fly straight leg jeans in a dark indigo wash. Tagged size W32 L30. 100% cotton denim with classic five-pocket styling. Clean condition with light natural fading and no holes or stains.",
  "category": "Clothing, Shoes & Accessories > Men > Men's Clothing > Jeans",
  "condition": "GOOD",
  "itemSpecifics": {
    "brand": "Levi's",
    "model": "501",
    "size": "32x30",
    "sizeType": "Regular",
    "department": "Men",
    "color": "Blue",
    "material": "100% Cotton",
    "style": "Straight"
  },
  "suggestedPrice": {
    "min": 22.00,
    "max": 38.00,
    "recommended": 29.95
  }
}

Return ONLY the JSON, no other text.`;
