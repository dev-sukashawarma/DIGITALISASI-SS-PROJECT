# Handoff Report: Iteration 2 - Webhook & Mock Script

## 1. Observation
- In `app/api/attendance/webhook/route.ts:42-45`, `supabase.removeChannel(channel)` is positioned after the `try` block for the broadcast `Promise`. If the promise rejects (e.g., due to timeout or error), the function jumps to `catch (error: any)` and `removeChannel` is never executed, leaking the connection.
- In `route.ts:9`, validation logic is `if (!email || !password || !branch_name || !cashier_name)`, completely omitting `outlet_id`.
- `const supabase = createServiceClient()` is invoked inside `export async function POST(req: Request)` (line 13), creating a new Supabase client instance on every request.
- The webhook broadcasts plaintext credentials (`email`, `password`) over the `attendance_events` channel (lines 28-29), which can be intercepted by any subscriber.

## 2. Logic Chain
- **Resource Leak Fix**: Moving the `supabase.removeChannel(channel)` into a `finally` block attached to the try-catch block containing the `new Promise` ensures cleanup happens reliably, even if the subscription times out.
- **Validation Fix**: Adding `!outlet_id` to the condition guarantees all required fields are validated before processing.
- **Overhead Fix**: Moving the Supabase client instantiation outside the `POST` function (to module scope) allows the serverless execution environment to cache the client between invocations, significantly reducing instantiation overhead. We can initialize a static `@supabase/supabase-js` client with the service role key.
- **Security Fix**: Broadcasting plaintext passwords globally is a critical security vulnerability. While `PROJECT.md` permits this for simplicity, a safer approach to address the reviewer's concern is to broadcast to a specific, unpredictable channel (e.g., `attendance_events_${outlet_id}`) or to broadcast a short-lived token instead of the password. At the very least, acknowledging the tradeoff via a unique channel per session and an explicit comment is required.

## 3. Caveats
- If the implementer decides to use a one-time token instead of sending the `password`, the client-side code (the POS kiosk listener) will also need to be updated to authenticate via the token instead of using `signInWithPassword`.
- Using module-scope client initialization means the client instance is shared. This is perfectly safe for a service-role client, but care must be taken not to mix user sessions (which doesn't apply here, as it uses the service key).

## 4. Conclusion
The implementation requires the following specific changes in `app/api/attendance/webhook/route.ts`:
1. Move the Supabase client creation outside of `export async function POST`. Use `@supabase/supabase-js` directly to create a module-scoped service-role client.
2. Add `!outlet_id` to the validation check at the top of the `POST` method.
3. Wrap the channel subscription/broadcast `await new Promise(...)` in a `try...finally` block, placing `await supabase.removeChannel(channel)` in the `finally` clause.
4. Mitigate the plaintext credential broadcast. To balance security with `PROJECT.md`'s design, modify the channel name to be specific (e.g., `attendance_events_${outlet_id}`) and acknowledge the security tradeoff in comments, or implement a safer token-based broadcast if time permits.

## 5. Verification Method
- **Static Analysis**: Verify `app/api/attendance/webhook/route.ts` has the client initialized at the top level, `outlet_id` in the validation, and a `finally` block containing `removeChannel`.
- **Runtime Testing**: 
  - Send a POST request to `/api/attendance/webhook` with a missing `outlet_id` and ensure a `400 Bad Request` is returned.
  - Send a valid POST request and observe the logs to ensure the connection is closed.
  - Review the channel name or payload to confirm security mitigations are applied.
