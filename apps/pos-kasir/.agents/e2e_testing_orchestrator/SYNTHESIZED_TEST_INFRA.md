# E2E Test Infra: POS Attendance Integration

## Test Philosophy
- Opaque-box, requirement-driven. No dependency on implementation design.
- Methodology: Category-Partition + BVA + Pairwise + Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | Attendance Waiting Screen | ORIGINAL_REQUEST R1 | 5      | 5      | ✓      |
| 2 | Auto-Login & Transition | ORIGINAL_REQUEST R2 | 5      | 5      | ✓      |
| 3 | Cashier Dashboard Info | ORIGINAL_REQUEST R3 | 5      | 5      | ✓      |
| 4 | Mock Event Trigger | ORIGINAL_REQUEST R4 | 5      | 5      | ✓      |

## Test Architecture
- Test runner: Playwright (`npx playwright test`)
- Test case format: TypeScript Playwright tests (`.spec.ts`) inside `e2e/` directory.
- Environment: Local Next.js server (`npm run dev`) automatically spun up by Playwright `webServer`.

## Tier 1 - Feature Coverage (Happy Path)
**Feature 1: Waiting Screen**
1. `/attendance` renders with correct title.
2. Screen connects to Supabase Realtime channel successfully.
3. Screen displays a visual indicator that it is waiting.
4. Screen correctly handles disconnection/reconnection of Realtime.
5. Screen displays the specific branch it is assigned to.

**Feature 2: Auto-Login**
6. Valid mock event triggers auto-login function.
7. Auto-login function correctly sets session state.
8. Successful login redirects to `/kasir` immediately.
9. Redirect URL exactly matches the expected dashboard path.
10. Transition happens without manual user interaction.

**Feature 3: Dashboard Info**
11. Dashboard extracts cashier name from event payload.
12. Dashboard prominently displays cashier name.
13. Dashboard extracts branch name from event payload.
14. Dashboard prominently displays branch name.
15. Dashboard hides login state elements after successful login.

**Feature 4: Mock Script**
16. Mock script executes without syntax errors.
17. Mock script accepts required arguments.
18. Mock script correctly formats the JSON payload.
19. Mock script successfully POSTs payload to webhook endpoint.
20. Mock script logs success message upon successful POST.

## Tier 2 - Boundary/Corner Cases
**Feature 1: Waiting Screen**
21. Webhook receives event for a different branch.
22. Realtime channel timeout.
23. Waiting screen opened in multiple tabs.
24. Waiting screen rendered on mobile vs desktop.
25. Waiting screen when network is offline.

**Feature 2: Auto-Login**
26. Auto-login with invalid credentials.
27. Auto-login event received twice in rapid succession.
28. Auto-login event received when already logged in.
29. Auto-login payload missing required session fields.
30. Auto-login redirect when target page is restricted.

**Feature 3: Dashboard Info**
31. Cashier name is extremely long.
32. Cashier name contains special characters or emojis.
33. Branch name is missing or null.
34. Dashboard refreshed immediately after login.
35. User manually logs out immediately after auto-login.

**Feature 4: Mock Script**
36. Mock script called with missing arguments.
37. Mock script called with invalid email format.
38. Mock script targets an offline or non-existent endpoint.
39. Mock script payload exceeds maximum size.
40. Mock script called rapidly multiple times (load test).

## Tier 3 - Cross-Feature Combinations
41. (F1 & F2) Event received but login fails; wait screen recovers and shows error.
42. (F2 & F3) Login completes but payload data is malformed; dashboard handles missing names gracefully.
43. (F1 & F4) Mock script sends valid payload; wait screen correctly picks it up.
44. (F3 & F4) Mock script sends special characters; dashboard displays them correctly.

## Tier 4 - Real-World Application Scenarios
45. **Standard Cashier Shift Start:** Full happy path from waiting -> mock script -> login -> dashboard.
46. **Shift Transfer:** Cashier A logs out -> returns to waiting -> mock script for Cashier B -> dashboard updates to Cashier B.
47. **Network Interruption:** Wait screen open -> network drops -> reconnects -> mock script triggers -> successful login.
48. **Invalid Attempt Recovery:** Mock script sends bad data -> error displayed -> Mock script sends good data -> successful login.
49. **Multi-Branch Collision:** Two wait screens for different branches. Mock script targets Branch 1 -> Only Branch 1 logs in.

## Coverage Thresholds
- Tier 1: ≥20 tests (100% of defined)
- Tier 2: ≥20 tests (100% of defined)
- Tier 3: ≥4 pairwise combination tests
- Tier 4: ≥5 realistic application scenarios
