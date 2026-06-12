# End-to-End Test Infrastructure Design

This document outlines the testing infrastructure and methodology for the POS-Kasir application, specifically focusing on the integration of the facial recognition attendance system and auto-login workflow.

## 4-Tier E2E Testing Methodology

The testing strategy is divided into four tiers to ensure comprehensive validation of the application.

### Tier 1: Feature Coverage
Focuses on the "happy paths" of the new attendance integration.
- **T1.1**: Application launches and successfully displays the "Waiting for Attendance" screen.
- **T1.2**: Mock event trigger with valid payload (cashier name and branch) is successfully received by the application.
- **T1.3**: Upon receiving the event, the application automatically logs in and transitions seamlessly to the main dashboard.
- **T1.4**: The dashboard accurately displays the cashier's username and the respective outlet/branch name provided in the payload.

### Tier 2: Boundary/Corner Cases
Focuses on edge cases, invalid data, and network resilience.
- **T2.1**: Mock event trigger sends an empty or malformed payload. The system should reject the event and remain on the waiting screen.
- **T2.2**: The event received corresponds to a different branch. The system should ignore it.
- **T2.3**: Network timeout or connection drop while polling/waiting. The system should attempt to reconnect or display a clear offline state.
- **T2.4**: Rapid succession of mock events. Only the first valid event should be processed.

### Tier 3: Cross-Feature Integration
Focuses on how the new auto-login interacts with existing functionality.
- **T3.1**: Session isolation: Ensure previous cashier state is fully cleared before the "Waiting for Attendance" screen renders.
- **T3.2**: Manual navigation: Navigating away from the dashboard after an auto-login should not trigger unexpected redirects or re-authentication loops.
- **T3.3**: Logout interaction: Testing the manual logout feature successfully returns the application to the "Waiting for Attendance" state.

### Tier 4: Real-World Application Scenarios
Focuses on complete end-to-end workflows representing daily store operations.
- **T4.1 - Daily Start Sequence**: POS terminal booted -> App enters "Waiting for Attendance" state -> Cashier arrives and checks in via separate system -> POS auto-logs in -> Cashier adds an item to the cart and starts processing orders.
- **T4.2 - Shift Change**: Cashier A manually logs out -> Application returns to "Waiting" state -> Cashier B checks in -> Application auto-logs in Cashier B -> Dashboard reflects Cashier B's data.

## Coverage Thresholds

To maintain high confidence in the POS system's reliability, the following coverage thresholds are established:

- **Statements**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%

These thresholds represent the combined code coverage required across both unit testing (Vitest) and E2E testing flows. Pre-commit and CI pipelines will enforce these metrics before merging any new feature code.
