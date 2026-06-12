## 2026-06-11T14:23:29+07:00
Read the revised strategy in `c:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\apps\pos-kasir\.agents\teamwork_preview_explorer_m1_iter2_3\handoff.md`.
Modify `app/api/attendance/webhook/route.ts` to implement the fixes:
1. Wrap the channel subscribe/send operations in a `try...finally` block to ensure `supabase.removeChannel(channel)` is ALWAYS called, preventing resource leaks. If it returns a promise, await it.
2. Include `outlet_id` in the payload validation.
3. Use a lazily-initialized module-level variable for the Supabase service client (`createServiceClient()`) to reuse it across serverless executions.
4. Security: Add a prominent comment above the payload broadcast acknowledging that broadcasting plaintext passwords is a security risk and that Realtime RLS MUST be configured in production. Keep the payload identical to the `PROJECT.md` spec.
MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.
Write your completion report to `c:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\apps\pos-kasir\.agents\teamwork_preview_worker_m1_iter2_1\handoff.md` and send a message.
