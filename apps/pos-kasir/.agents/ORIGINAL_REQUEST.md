# Original User Request

## Initial Request — 2026-06-11T07:03:08Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Craft prompt → get user approval → delegate to teamwork_preview

Prepare the POS system for future integration with a facial recognition attendance system. The POS must automatically log in and open the dashboard when a successful attendance check-in occurs on a separate device.

Working directory: c:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\apps\pos-kasir
Integrity mode: development

## Requirements

### R1. Attendance Waiting Screen
Create a "Waiting for Attendance" page/screen in the POS web application. This screen should actively listen (e.g., via WebSocket or polling) for a remote check-in success event targeted at its specific branch.

### R2. Auto-Login and Dashboard Transition
Upon receiving the check-in success event, the POS system must automatically authenticate the user and seamlessly transition to the main cashier dashboard.

### R3. Display Cashier Information
The dashboard must prominently display the username/label of the cashier who just checked in, along with the corresponding outlet/branch name based on the event payload.

### R4. Mock Event Trigger
Because the actual attendance system is being developed separately, create a simple simulation script (e.g., a Node.js script or curl command guide) to manually trigger the "attendance success" event and test the POS integration.

## Acceptance Criteria

### Auto-Login Verification
- [ ] Launching the POS application initially displays the "Waiting for Attendance" state.
- [ ] Executing the mock event trigger with a mock payload (user and branch data) causes the POS screen to automatically transition to the dashboard without manual interaction on the POS device.
- [ ] The resulting dashboard accurately reflects the cashier's name and branch as provided by the mock payload.
- [ ] The integration mechanism (e.g., API endpoint or WebSocket listener) is clearly documented so the other developer can easily call it when the real attendance system is ready.

## Follow-up — 2026-06-26T02:32:38Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Execute project via teamwork_preview

[Membangun sinkronisasi status pesanan dua arah antara Sistem Order (PROD_REPO_ANALYSIS) dan POS Kasir (pos-kasir). Jika Admin di Sistem Order mengubah status menjadi selesai/batal, POS Kasir otomatis ikut berubah, dan sebaliknya.]

Working directory: C:\Users\Digital Marketing\OneDrive\Desktop\project\PROD_REPO_ANALYSIS dan c:\Users\Digital Marketing\OneDrive\Desktop\project\DIGITALISASI-SS-PROJECT\apps\pos-kasir
Integrity mode: development

## Requirements

### R1. Edge Function di Sistem Order
Buat Edge Function baru (contoh: `sync-status-to-pos`) di dalam `PROD_REPO_ANALYSIS`. Fungsi ini bertugas mengirimkan status terbaru dari sebuah pesanan ke *endpoint* POS Kasir saat ada *database webhook trigger* (misal status berubah menjadi `completed` or `cancelled`).

### R2. Endpoint API di POS Kasir
Buat sebuah API route baru di POS Kasir (contoh: `/api/orders/update-status`) yang menerima *payload* dari Edge Function Sistem Order. API ini harus memverifikasi *secret key* (`x-internal-token`) dan memperbarui kolom `status` di tabel `orders` milik POS Kasir berdasarkan pencarian `external_order_id`.

## Acceptance Criteria

### Verifikasi Fungsionalitas
- [ ] Tersedia *script* migrasi atau panduan lengkap untuk memasang Database Webhook Trigger di Sistem Order.
- [ ] Tersedia *source code* lengkap untuk Edge Function `sync-status-to-pos`.
- [ ] Tersedia *source code* lengkap untuk API route `/api/orders/update-status` di POS Kasir.
- [ ] API penerima di POS Kasir memvalidasi *secret token* untuk mencegah akses publik yang tidak sah.
- [ ] Perubahan status di *database* POS Kasir dipastikan berjalan (teruji via *mock script* atau agen penilai).

## Follow-up — 2026-07-14T05:00:42Z

Implement a Crew Bonus feature in the POS system where crew members equally share a daily bonus if their outlet meets its daily sales target, with monthly automated calculation and reporting.

Working directory: c:\Users\Digital Marketing\OneDrive\Desktop\project\DIGITALISASI-SS-PROJECT\apps\pos-kasir
Integrity mode: development

## Requirements

### R1. Database & Target Settings
Update the existing `daily_sales_targets` table (via Supabase migration) to include a `bonus_amount` column (Decimal/Numeric, default 0). Update any relevant RPCs (e.g., `set_daily_target`) to accept and store this new field.

### R2. Bonus Calculation Logic
Create a Supabase RPC named `calculate_monthly_crew_bonus(p_month INT, p_year INT, p_outlet_id UUID)`. The logic must:
- Filter `orders` with status `completed` for the given month.
- Group sales per day and compare against the day's `target_amount` from `daily_sales_targets`.
- If a day's sales >= target, accumulate that day's `bonus_amount`.
- Get the count of staff with the `crew` role at that outlet.
- Divide the total accumulated bonus equally among the crew (pembagian rata).
- Return a summary: Crew Name, Role, Outlet, Days Target Reached, Total Bonus Received.

### R3. Admin Configuration UI
Modify the existing Outlet/Target Settings page in the frontend to include an input for "Nominal Bonus Harian (Rp)". Ensure this is only accessible/editable by `admin` or `owner` roles.

### R4. Monthly Report UI
Create a new report page (e.g., `/dashboard/reports/crew-bonus`) with filters for Month, Year, and Outlet. Display a table showing the data returned by the `calculate_monthly_crew_bonus` RPC. Admin/Owner can see all outlets, while crew only see their own.

## Acceptance Criteria

### Functionality & Verification
- [ ] Migration script successfully adds the `bonus_amount` column without breaking existing data.
- [ ] A test script (e.g., `scratch/test-bonus-logic.js`) demonstrates that the RPC correctly groups sales by day, checks targets, and divides the bonus equally among crew members.
- [ ] The Frontend Target Setting UI successfully saves the `bonus_amount` to the database.
- [ ] The Frontend Report UI successfully fetches and displays the correct bonus calculation based on mock/test orders.
- [ ] RLS policies prevent unauthorized modification of the bonus amount.
