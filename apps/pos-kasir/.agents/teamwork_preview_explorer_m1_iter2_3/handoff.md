# Handoff Report: Webhook Strategy Revision

## 1. Observation
1. In `app/api/attendance/webhook/route.ts` (lines 16-40), a Promise wraps the channel subscription and message sending. If the promise rejects (e.g., due to timeout or channel error), the code at line 42 (`supabase.removeChannel(channel)`) is bypassed because the catch block at line 44 intercepts it, causing zombie Supabase channel connections.
2. In `app/api/attendance/webhook/route.ts` (line 9), the validation check `if (!email || !password || !branch_name || !cashier_name)` omits `outlet_id`.
3. In `app/api/attendance/webhook/route.ts` (line 13), `createServiceClient()` is called directly inside the `POST` handler, creating a new client and connection on every single serverless execution.
4. In `app/api/attendance/webhook/route.ts` (line 29), the broadcast payload sends plaintext `email` and `password` over the public `attendance_events` channel.

## 2. Logic Chain
1. **Resource Leak Fix**: To ensure `removeChannel` is always called regardless of success or failure, the Promise and its await must be wrapped in a `try...finally` block where the `finally` block handles the cleanup (`supabaseAdmin.removeChannel(channel)`).
2. **Validation Fix**: Add `!outlet_id` to the existing conditional to fulfill the validation requirement and reject malformed requests early.
3. **Client Instantiation Overhead Fix**: The `createServiceClient()` call should be moved to a module-level variable (e.g., `let supabaseAdmin: ...`) initialized lazily inside the handler. This allows warm serverless executions to reuse the existing instance and connection.
4. **Security Risk Fix**: 
   - **Tradeoff**: While `PROJECT.md` specifies sending email/password over broadcast for `signInWithPassword`, broadcasting plaintext credentials over an open realtime channel is a critical security vulnerability. 
   - **Safer Approach**: If possible, the webhook should generate a one-time token (OTP) using the Supabase Auth admin API and broadcast that instead. The receiver would then consume the OTP.
   - **Alternative (RLS)**: If transmitting the email and password is a hard requirement, the realtime channel *must* be secured using Supabase Realtime Row Level Security (RLS) to ensure only authenticated, authorized endpoints can listen to `attendance_events`.

## 3. Caveats
- Moving to a one-time token approach requires coordinating changes in whatever client consumes the broadcast, as it currently expects `email` and `password`.
- If Realtime RLS is chosen as the mitigation, it requires proper Supabase database migrations/policies to be implemented, which is outside the scope of this single file.
- Module-level singleton reuse only applies to warm lambdas. Cold starts will still incur instantiation overhead.

## 4. Conclusion
The implementation of `app/api/attendance/webhook/route.ts` should be revised to:
1. Wrap the channel operations in a `try...finally` block for robust cleanup.
2. Include `outlet_id` in the request payload validation.
3. Use a lazily-initialized module-level singleton for the Supabase service client.
4. Address the security flaw by either securing the realtime channel with RLS or refactoring the flow to broadcast a one-time token instead of plaintext credentials.

## 5. Verification Method
- **Leak**: Review `route.ts` to confirm `removeChannel` is strictly within a `finally` block.
- **Validation**: Attempt to trigger the webhook via `POST` missing `outlet_id` and confirm it returns a 400 error.
- **Overhead**: Verify `createServiceClient` is assigned to a variable outside the exported handler scope or cached correctly.
- **Security**: Verify that either the payload no longer contains plaintext credentials, or documentation/policies exist proving the channel is protected via Realtime RLS.
