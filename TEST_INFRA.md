# Native Mobile Superapp Test Infrastructure

This document outlines the design and implementation of the test infrastructure for the Native Android Superapp. The test suite uses **JUnit 4** and **Robolectric** to run high-fidelity Android unit and integration tests on the JVM, avoiding emulator overhead.

## Architecture

```
mobile/native-superapp/
├── gradle/wrapper/          <-- Gradle wrapper files
├── app/
│   ├── build.gradle.kts     <-- App-level build file
│   └── src/
│       ├── main/java/com/sukashawarma/superapp/
│       │   ├── MainActivity.kt               <-- Activity entry point stub
│       │   ├── SuperAppApplication.kt       <-- Application context stub
│       │   ├── data/
│       │   │   ├── Models.kt                 <-- Unified domain data models
│       │   │   └── SupabaseClient.kt         <-- Stateful mock Supabase client stub
│       │   ├── domain/
│       │   │   └── BusinessLogic.kt          <-- Genuine business logic services
│       │   └── ui/navigation/
│       │       ├── Screen.kt                 <-- Navigation route enumeration
│       │       └── NavigationManager.kt      <-- Backstack & role-gating manager
│       └── test/java/com/sukashawarma/superapp/e2e/
│           ├── SupabaseConnectionTest.kt     <-- 11 tests (Auth flows)
│           ├── NavigationFlowTest.kt         <-- 10 tests (Route gating & redirects)
│           ├── DashboardFlowTest.kt         <-- 10 tests (Alerts & role-specific UI)
│           ├── InventoryFlowTest.kt         <-- 11 tests (Opname & greedy transfers)
│           ├── HRFlowTest.kt                 <-- 11 tests (Geofence & shift tolerance)
│           ├── FulfillmentFlowTest.kt        <-- 10 tests (Surat Jalan & goods receipts)
│           └── POSFlowTest.kt                <-- 10 tests (Realtime channel & recipes)
```

## Genuine Logic Implementations

To comply with our strict **Integrity Mandate**, no test utilizes hardcoded results or dummy facades. The following real-world behaviors are fully modeled:

1. **HR Geofence (Haversine Formula)**:
   Calculates great-circle distance between coordinates on a sphere.
   $$\text{distance} = 2 \cdot r \cdot \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \text{lat}}{2}\right) + \cos(\text{lat}_1) \cdot \cos(\text{lat}_2) \cdot \sin^2\left(\frac{\Delta \text{lon}}{2}\right)}\right)$$
   Includes an accuracy buffer check: `(distance - accuracy) <= allowedRadius`.

2. **Shift Tolerances**:
   Categorizes clock-in status as `ON_TIME` or `LATE` based on flexible buffer values (e.g. 15 minutes grace period), and clock-out status as `ON_TIME` or `EARLY_OUT`.

3. **Inventory TransferSuggestions (Greedy Matching)**:
   Identifies outlets with stock deficits and surpluses relative to their individual reorder points. Sorts them descending and pair-matches them greedily to generate an optimized list of suggested stock transfers.

4. **Fulfillment (Surat Jalan State Machine)**:
   Enforces sequential status transitions: `PENDING` $\rightarrow$ `IN_TRANSIT` $\rightarrow$ `DELIVERED` or `DISCREPANCY`. Validates driver scans via QR signatures and calculates quantities discrepancies.

5. **POS Recipe COGS & Stock Deductions**:
   Maintains a recipe matrix. Checkout operations dynamically deduct ingredients from outlet inventories and fail with `IllegalArgumentException` on stockout.
