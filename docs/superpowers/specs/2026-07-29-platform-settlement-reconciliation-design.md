# Design Doc: Platform Settlement Reconciliation & Discrepancy Tracking

## 1. Context & Goal
The system now imports settlement reports from food delivery platforms (ShopeeFood, GrabFood, GoFood, TikTok Go) into the `platform_settlements` table. We need to reconcile this settlement data with our internal POS (Pawoon) sales data to calculate accurate Net Profit in the P&L dashboard.

The user specified that the manual import process is intended only for July data migration. However, the system's logic for calculating deductions must be robust.

## 2. Source of Truth
- **Top-line Gross Revenue (Omzet Kotor):** POS (Pawoon) is the absolute source of truth.
- **Platform Fee (Komisi):** Settlement data is the source of truth.
- **Promo Merchant:** Settlement data is the source of truth.

## 3. Discrepancy Handling (Selisih Aplikasi)
Because POS Gross Revenue and Settlement Gross Revenue may not match (e.g., due to orders cancelled on the platform but not voided on the POS by the cashier), we will introduce a new deduction line item called **Selisih Pencatatan** (Discrepancy).

Formula:
`Selisih Pencatatan = POS Gross (for the specific platform) - Settlement Gross`

This ensures that the Net Profit accurately reflects the actual payout without inflating the numbers with "ghost" POS orders, while simultaneously tracking cashier negligence.

## 4. Net Profit Formula
`Net Profit = POS Gross - POS Discounts - Platform Fee (Settlement) - Promo Merchant (Settlement) - Selisih Pencatatan`

## 5. Implementation Approach
- **Data Fetching:** 
  - Update `useSalesDaily.ts` (Client) and `ownerDashboard.ts` (Server Action) to fetch data from `platform_settlements` for the given date range.
  - Map the settlement data using the composite key: `${outlet_id}|${sales_date}|${sales_source}`.
- **Data Merging:**
  - When merging POS daily totals with Settlement data, calculate `Selisih Pencatatan`.
  - Override the estimated `platform_fee` (currently 0) with the actual fee from `platform_settlements`.
- **UI Updates:**
  - Update the Profit / P&L components (like `ReportsView.tsx` and the Owner Profit Dashboard) to display the new deduction columns: `Selisih Pencatatan` and `Promo Merchant`.

## 6. Scope Boundaries
- This design only touches the P&L calculation and presentation layer for daily/aggregated sales.
- It does not modify individual `orders` records in the database, as settlement data is aggregated daily.
