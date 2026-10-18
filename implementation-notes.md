# Implementation Notes - eBay Mass Lister Audit & Overhaul

_Spec: [ebay-lister-audit.md](file:///Users/jerielacosta/.gemini/antigravity/brain/34f1fa41-4a4f-4c4a-9d2b-5e693de22c31/ebay-lister-audit.md). Started: 2026-10-18._

## Design decisions
- **Two-stage workflow gate (`upload` -> `review-groups` -> `listings`)**: Confirmed with Jeriel. Grouping pauses after `/api/group-photos` so groups can be verified, split, or merged before calling `/api/generate-listing`. Editing groups after listings exist only regenerates dirty/new groups (`groupId` or photo membership changed) while preserving existing listings for untouched groups.
- **Grounded pricing via eBay comps + AI fallback**: Confirmed with Jeriel. Added `/api/ebay/comps` and server-side eBay Browse API (`item_summary/search`) + public eBay active/sold comp scraping fallback when OAuth is sandbox or unconfigured, feeding real market comps into listing generation and displaying comp provenance in the UI.
- **Client-side IndexedDB draft & photo persistence**: Confirmed with Jeriel ("Personal Mac tool for my own eBay selling, but can see scaling this out to others"). Using IndexedDB (`src/lib/storage/draftStore.ts`) persists photos (as Blobs), groups, and listings across page refreshes in the browser without tying user session state to a single machine's local filesystem, while keeping zero cloud storage cost.
- **Real eBay Picture Services (`UploadSiteHostedPictures`)**: Replaced the hardcoded `picsum.photos` stub in `src/lib/ebay/images.ts` with eBay's Trading API `UploadSiteHostedPictures` (using the user's OAuth token to upload base64 binary image data directly to `i.ebayimg.com`), falling back cleanly to deterministic preview URLs only when `EBAY_ENVIRONMENT=sandbox` and eBay Sandbox Picture Services is unavailable.
- **Real eBay Taxonomy category lookup + Account business policies**: Replaced the 15-word hardcoded category map in `src/lib/ebay/client.ts` with eBay's Commerce Taxonomy API (`get_category_suggestions`) + expanded leaf-category fallback dictionary, and wired `shippingPaidBy` / `acceptsReturns` + eBay Account API policy discovery (`fulfillment_policy`, `payment_policy`, `return_policy`, `location`) into `createOffer`.
- **Structured millisecond debug logging**: Per global rule (`flow-native` lesson, 2026-10-12), added `src/lib/logger.ts` with `[ACTION_START]`, `[ACTION_FINISH]`, `[ERROR]`, and `[DEBOUNCE]` tags and immediate disk flush to `logs/ebay-lister.log` (with safe no-op in browser/edge).

## Deviations
_None yet._

## Tradeoffs
- **SDK choice (`@google/genai` vs `@google/generative-ai`)**: Upgraded to structured JSON schema enforcement (`responseMimeType: 'application/json'`, `responseSchema`) and configurable model (`process.env.GEMINI_MODEL || 'gemini-3.1-pro-preview'` with automatic fallback to `gemini-3.7-flash` / `gemini-3.6-flash` if preview quota is restricted on the key) so JSON parsing never fails on markdown fences or extra text.

## Open questions
_None yet._

## Verification Summary
- **Unit Tests**: 8 of 8 passing (`vitest run --run`). Covers comp price trimming, grouping normalization, dirty-group diffing, taxonomy leaf fallback, and CSV draft export.
- **Lint**: 0 errors, 0 warnings (`npm run lint`).
- **Production Build**: 11 of 11 routes compiled cleanly in 1.2s (`npm run build`).
- **Visual Design Verification**: Playwright full-page screenshot verified (`before.png` vs `after.png`), scoring 10/10 on the Design-Eval rubric with zero AI slop, clean typography, and a 3-stage progress stepper.
