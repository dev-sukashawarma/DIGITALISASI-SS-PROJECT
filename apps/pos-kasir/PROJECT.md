# Project: POS Attendance Integration

## Architecture
- **Attendance Waiting Screen**: A new page `/attendance` (or `/login/attendance`) that actively listens for an attendance event via Supabase Realtime Broadcast.
- **Webhook API**: An API route `/api/attendance/webhook` that receives the event from the external system (or mock script) and relays it to the waiting screen via Supabase Realtime Broadcast.
- **Auto-Login**: The waiting screen receives the broadcast payload (e.g., email/password or session data), authenticates using `supabase.auth.signInWithPassword`, and redirects to `/kasir`.
- **Dashboard**: The `/kasir` dashboard displays the cashier name and branch.
- **Mock Script**: A Node.js script to simulate the external facial recognition system.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | Implementation Track | Implement API Webhook, Waiting Screen, Dashboard Updates, and Mock Script. | none | PLANNED |
| 2 | Final E2E Pass | Pass 100% of E2E tests + Adversarial Coverage Hardening | E2E Testing Track | PLANNED |

## Interface Contracts
### `mock-attendance.js` ↔ `/api/attendance/webhook`
- POST JSON: `{ "email": "...", "password": "...", "outlet_id": "...", "branch_name": "...", "cashier_name": "..." }`

### `/api/attendance/webhook` ↔ `/attendance` (Frontend)
- Supabase Realtime Broadcast channel: `attendance_events`
- Payload: `{ "email": "...", "password": "...", "branch_name": "...", "cashier_name": "..." }`

## Code Layout
- `app/api/attendance/webhook/route.ts`
- `app/attendance/page.tsx`
- `app/kasir/layout.tsx` (or `page.tsx`)
- `mock-attendance.js` (in root)
