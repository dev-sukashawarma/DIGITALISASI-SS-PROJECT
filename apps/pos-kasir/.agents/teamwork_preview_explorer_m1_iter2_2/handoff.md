# Handoff Report: Webhook & Mock Script Iteration 2 Strategy

## 1. Observation
- **Resource Leak**: In `app/api/attendance/webhook/route.ts` (lines 16-40), the Promise that handles `channel.subscribe` and `send` is awaited, but `supabase.removeChannel(channel)` is called afterwards without a `finally` block. If the Promise rejects (e.g., due to the 5s timeout or a channel error), the execution jumps to the catch block, skipping the channel removal and resulting in zombie connections.
- **Validation**: At line 9, `if (!email || !password || !branch_name || !cashier_name)` omits the `outlet_id` field from the missing fields check.
- **Client Instantiation Overhead**: `createServiceClient()` is called inside the `POST` handler, instantiating a new client and connection on every serverless execution.
- **Security Flaw**: The route broadcasts plaintext `email` and `password` payloads over the `attendance_events` Supabase channel.

## 2. Logic Chain
- **Fixing the Leak**: Wrapping the channel interaction within a `try...finally` block ensures that `await supabase.removeChannel(channel)` is executed regardless of success or failure, properly cleaning up resources.
- **Fixing Validation**: Adding `!outlet_id` to the required fields check is straightforward and aligns with the expected payload.
- **Fixing Client Overhead**: Because `createServiceClient()` in this specific webhook does not depend on request-specific headers/cookies (it uses an empty cookie mock), we can memoize the service client at the module scope. Thus, consecutive invocations within the same container can reuse the client instance.
- **Addressing the Security Flaw**: While `PROJECT.md` specified broadcasting the credentials to perform `signInWithPassword`, broadcasting plaintext credentials is fundamentally insecure on public channels.
  - *Mitigation strategy*: We should acknowledge the risk. To fix it robustly, we can transition from Realtime Broadcasts to Realtime Postgres Changes by inserting the login request into an RLS-protected database table (`attendance_login_requests`). The client listens only for its specific `outlet_id` row. Alternatively, if staying with Broadcasts, we can perform the Supabase authentication server-side in the webhook and broadcast an ephemeral short-lived access token, rather than the password.

## 3. Caveats
- Moving the Supabase client outside the handler assumes the serverless environment will properly reuse the instance across requests and that no user-specific cookies are required. In this service-role context, this assumption holds.
- If we switch from Broadcast to Postgres Changes or Server-Side Auth for the security fix, we will need to update both the webhook and the POS client's listener code. The implementer should coordinate this change.

## 4. Conclusion
The implementer should proceed to refactor `app/api/attendance/webhook/route.ts` to:
1. Cache the `createServiceClient()` instance outside the `POST` handler.
2. Include `!outlet_id` in the validation check.
3. Wrap the channel operations in a `try...finally` block and `await supabase.removeChannel(channel)` in the `finally` portion.
4. Implement the proposed security mitigation (e.g. encrypting the broadcast payload, or performing server-side auth to send a session token instead of passwords) and communicate this trade-off clearly.

## 5. Verification Method
- **Leak**: Review the `route.ts` code to ensure `removeChannel` is in a `finally` block. Run the webhook script, trigger a timeout (e.g., mock a failure), and verify via logs that the channel cleanup is executed.
- **Validation**: Send a request without `outlet_id` and ensure a 400 Bad Request is returned.
- **Performance**: Monitor execution time or log client initialization to confirm the client is reused across requests in a local dev server.
- **Security**: Inspect the broadcast payload (or Postgres insert) to ensure no plaintext passwords are sent.
