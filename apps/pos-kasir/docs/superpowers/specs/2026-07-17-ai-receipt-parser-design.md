# AI Receipt Parser (Food Apps)

## Overview
A new experimental feature for the Kasir POS to automate reading food app orders (GoFood, GrabFood, ShopeeFood) from screenshots. This reduces manual data entry and accurately captures item quantities and subsidies/discounts.

## Architecture

1. **Feature Toggle (Global Setting)**
   - Stored in `global_settings` table.
   - Key: `enable_ai_receipt_parser` (boolean string).
   - Can be turned on/off by the admin.
   - When enabled, the "Scan Screenshot AI" button is visible in `app/kasir/order-manual/page.tsx`.

2. **Frontend Upload Flow**
   - The cashier clicks "Scan Screenshot AI" and selects an image file from the PC.
   - The file is converted to a base64 string or sent via FormData to a Next.js API route (`/api/parse-receipt`).
   - A loading state is shown during extraction.

3. **Backend Processing (OpenRouter API)**
   - The API uses an OpenRouter Vision model.
   - Recommended Model: `google/gemini-1.5-flash` (atau varian terbaru di Juli 2026) karena sangat murah, cepat, dan OCR-nya sangat akurat, atau `openai/gpt-4o-mini` / `anthropic/claude-3.5-sonnet` via OpenRouter.
   - The prompt will include the raw image and a list of the outlet's current active menus (names and IDs).
   - Expected Output: A structured JSON containing:
     - `items`: Array of objects (menuId, name from image, qty, matched boolean).
     - `subsidies`: Array of objects (name, amount as negative integer).

4. **Data Handling & Reconciliation**
   - **Matched Items**: Automatically added to the cashier's cart.
   - **Unmatched Items**: Added to the cart with a warning state (red border). The cashier must manually select the correct POS menu item to replace it.
   - **Subsidies**: Added as negative items in the cart (e.g., "Promo GrabFood" with unit price -15000, quantity 1). This ensures the `total_amount` is reduced appropriately and makes receipt auditing easy.

5. **Security**
   - The OpenRouter API key is stored securely in the server's `.env.local` (`OPENROUTER_API_KEY`).

## Edge Cases
- Image is blurry/unreadable: AI returns an error JSON, UI shows a toast notification asking to re-upload.
- Model hallucinates a menu item: Unmatched items must explicitly be resolved by the cashier.
- Zero subsidies: AI returns an empty `subsidies` array.
