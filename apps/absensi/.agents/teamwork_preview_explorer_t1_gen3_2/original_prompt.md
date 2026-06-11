Task: Milestone T1 - Test Infra Setup (Iteration 3)
You are an Explorer.
Working directory: c:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\apps\absensi\.agents\teamwork_preview_explorer_t1_gen3_2
Scope document: c:\Users\AK\Desktop\Project\DIGITALISASI-SS-PROJECT\apps\absensi\TEST_INFRA.md

Objective: Investigate how to fix the Playwright setup. The previous iteration failed a Forensic Audit due to an INTEGRITY VIOLATION.

The Forensic Auditor found that we created 4 facade files (`kiosk.spec.ts`, `realtime.spec.ts`, `spv.spec.ts`, `workload.spec.ts`) with identical dummy logic, and that `yarn test:e2e` fails because Kiosk tests failed when `/` didn't redirect to `/login`.
The Kiosk and SPV tests are meant for Milestones T2 and T3, not T1!

Your Task:
Propose a fix strategy to completely resolve the integrity violation:
1. Recommend DELETING the 4 fake spec files (`kiosk.spec.ts`, `realtime.spec.ts`, `spv.spec.ts`, `workload.spec.ts`). They should not exist yet.
2. Recommend creating a single `tests/e2e/setup.spec.ts` that contains a generic working Playwright test to prove the infra is set up. This test should just load `/` and verify it renders without crashing (e.g. `await page.goto('/')` and expecting some generic title or heading, but make sure it actually passes).
3. Do NOT implement. Output a handoff.md report with your recommended fix commands and the contents of `setup.spec.ts`.
Send the report back to me via send_message and exit.
