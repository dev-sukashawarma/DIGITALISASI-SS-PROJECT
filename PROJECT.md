# Project: Native Mobile Superapp

## Architecture
The application is a native Android mobile application built using Kotlin and Jetpack Compose. It connects to the existing Supabase backend for authentication and database operations.
The app is structured as a single-module Android project with a feature-by-package architecture, following Clean Architecture principles (Presentation, Domain, Data layers).

### Component Block Diagram
```
[ Jetpack Compose UI ] <--> [ ViewModels / UI State ]
                                  │
                                  ▼
                       [ Repositories / Domain ]
                                  │
                                  ▼
                   [ Supabase Client / Local Mock ]
```

### Code Layout
The code is located in `mobile/native-superapp`.
```
mobile/native-superapp/
├── gradle/
├── build.gradle.kts
├── settings.gradle.kts
├── gradlew
├── gradlew.bat
└── app/
    ├── build.gradle.kts
    └── src/
        ├── main/
        │   ├── AndroidManifest.xml
        │   └── java/com/sukashawarma/superapp/
        │       ├── MainActivity.kt
        │       ├── SuperAppApplication.kt
        │       ├── data/
        │       │   ├── SupabaseClient.kt
        │       │   ├── model/
        │       │   └── repository/
        │       └── ui/
        │           ├── navigation/
        │           │   ├── NavGraph.kt
        │           │   └── Screen.kt
        │           ├── theme/
        │           ├── dashboard/
        │           ├── inventory/
        │           ├── attendance/
        │           ├── fulfillment/
        │           └── pos/
        └── test/
            └── java/com/sukashawarma/superapp/
                └── e2e/
```

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | E2E Test Suite | Create comprehensive E2E test infra and test cases (Tiers 1-4) in JUnit/Robolectric | None | IN_PROGRESS |
| 2 | Project Scaffold | Initialize Android Kotlin project with Gradle wrapper, Compose, and core dependencies | M1 | DONE |
| 3 | Supabase Integration | Configure Supabase client, postgrest, and auth dependencies in build files | M2 | IN_PROGRESS |
| 4 | UI Shell & Nav | Implement Compose Navigation and main shell layout connecting all 5 modules | M3 | IN_PROGRESS |
| 5 | Superapp Modules | Implement the UI and logic for Dashboard, Inventory, HR, Order Fulfillment, and POS | M4 | PLANNED |
| 6 | E2E Verification & Audit | Pass all E2E test cases, execute Gradle debug build, and run Forensic Audit | M5 | PLANNED |

## Interface Contracts

### Supabase Client Provider (`data/SupabaseClient.kt`)
- `initialize(url: String, anonKey: String)`: Initializes the Supabase client with the required configuration.
- `client`: Property exposing the initialized `SupabaseClient` instance.

### Navigation Contract (`ui/navigation/Screen.kt`)
- Route definitions:
  - `Screen.Dashboard.route = "dashboard"`
  - `Screen.Inventory.route = "inventory"`
  - `Screen.Attendance.route = "attendance"`
  - `Screen.Fulfillment.route = "fulfillment"`
  - `Screen.POS.route = "pos"`
