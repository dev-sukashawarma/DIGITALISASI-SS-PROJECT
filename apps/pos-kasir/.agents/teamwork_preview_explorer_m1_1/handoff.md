# Handoff: Milestone 1 - Webhook & Mock Script

## 1. Observation
- `PROJECT.md` mandates an API route at `/api/attendance/webhook` to relay incoming POST data to Supabase Realtime Broadcast on the channel `attendance_events`.
- Required payload format: `{ "email", "password", "outlet_id", "branch_name", "cashier_name" }`.
- `mock-attendance.js` is required in the root directory to simulate the external facial recognition system sending the above payload.
- `lib/supabase/server.ts` exposes a `createServiceClient()` function that bypasses RLS using the service role key, which is appropriate for a server-side webhook context where no cookies/client session are available.
- `app/api/attendance/webhook/route.ts` and `mock-attendance.js` do not currently exist.

## 2. Logic Chain
- To broadcast events securely from a Next.js API route without user session cookies, we should use the service role client. `createServiceClient()` from `@/lib/supabase/server` perfectly fulfills this requirement.
- The webhook API should receive the request, parse the JSON body, validate the presence of the 5 required fields, and then send a broadcast payload via Supabase channel subscription.
- Supabase's `@supabase/supabase-js` requires establishing a channel connection (`.subscribe()`) before sending a broadcast. We need to wrap this in a Promise to wait for the `SUBSCRIBED` state before sending the payload and responding to the client, while including a timeout to prevent hanging requests.
- The mock script `mock-attendance.js` can utilize the native Node.js `fetch` API (available in Node.js 18+) to simulate the HTTP POST request to `http://localhost:3000/api/attendance/webhook`.

## 3. Caveats
- Supabase Websocket subscriptions inside serverless functions can sometimes be slow or timeout due to cold starts. An alternative HTTP broadcast via Supabase REST API exists but is less standardized in the `@supabase/supabase-js` documentation. The websocket approach is recommended but should include a strict timeout.
- The route is currently unauthenticated by default. If the webhook must be secure against unauthorized triggers, a shared secret or API key header should be added later, though it is not explicitly required in `PROJECT.md`.

## 4. Conclusion
We are ready to implement Milestone 1.

**Strategy:**
1. **Webhook (`app/api/attendance/webhook/route.ts`)**:
   - Parse POST JSON payload.
   - Validate fields: `email`, `password`, `outlet_id`, `branch_name`, `cashier_name`.
   - Instantiate supabase client via `createServiceClient()`.
   - Connect to `attendance_events` channel.
   - Broadcast event (e.g., `attendance_success`) with the payload.
   - Clean up channel and return success response.

2. **Mock Script (`mock-attendance.js`)**:
   - Create a simple script invoking `fetch('http://localhost:3000/api/attendance/webhook', { ... })` with the required mocked JSON body.

## 5. Verification Method
- **Run the mock script:** `node mock-attendance.js`
- **Expected Output:** The script should output a `200 OK` status and a success message from the webhook.
- **Further Validation (in M2):** The frontend at `/attendance` will be able to receive this broadcast event.
