# Graph Report - .  (2026-07-15)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 2172 nodes · 4058 edges · 248 communities (150 shown, 98 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.76)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `efb71bd8`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- index.ts
- page.tsx
- useRole
- devDependencies
- usePurchaseOrder.ts
- compilerOptions
- devDependencies
- createServiceClient
- page.tsx
- route.ts
- types.ts
- page.tsx
- createClient
- ReportsView.tsx
- compilerOptions
- page.tsx
- page.tsx
- createClient
- useDialogStore
- PettyCashView.tsx
- inventory.ts
- AdminOverviewView.tsx
- MenuView.tsx
- page.tsx
- ResepEditor.tsx
- CashAdvanceTable.tsx
- actions.ts
- useStaff
- PeriodFilter.tsx
- staffFormValidation.test.ts
- ErrorBoundary
- dependencies
- BrandContext.tsx
- layout.tsx
- test-bonus-logic.js
- seed-guides.js
- test-query.js
- test-query-2.js
- route.ts
- run-bonus-calculation-migration.js
- run-bonus-migration.js
- verify-bonus-calculation.js
- check-kasir-outlets.js
- cleanup-old-guides.mjs
- fix-stuck-orders.js
- check-sync.js
- generate-live-guide.js
- migrate-walkin.js
- run-bonus-migration.js
- run-magic-link.js
- run-migration.js
- verify-bonus-migration.js
- fix_duplicates.js
- force_hours.js
- sync_outlets.js
- route.ts
- route.ts
- route.ts
- @supabase/supabase-js
- sw.ts
- check-25g.js
- check-duplicates.js
- check-orders.js
- check-stok-balance.js
- check-sync-internal.js
- check_tables2.js
- migrate.js
- migrate-promo.js
- check_constraint.js
- test_mitra.js
- test.js
- test_db.js
- test_db_outlet.js
- test_order.js
- route.ts
- route.ts
- page.tsx
- check-db.js
- check_mitra_deleted.ts
- check_outlets.ts
- check_promos.js
- check_schema.ts
- clean-menu.js
- fix_mitra.ts
- get_outlets.ts
- middleware.ts
- next.config.js
- run_rls_migration.ts
- scratch.ts
- test_promo3.js
- test-sync-status.js
- setup_all_mitra.ts
- setup_mitra.ts
- setup_owner.ts
- test_join.ts
- test-regex.mjs
- test-sync-active.js
- expose-kasir.js
- test-sync.js
- vercel.json
- KasirOrderClient.tsx
- createClient
- SetoranView.tsx
- ExpenseInputView.tsx
- rupiah
- usePettyCash.ts
- useMyOutlet
- KasirNav.tsx
- page.tsx
- createServiceClient
- admin-analytics.ts
- StaffView.tsx
- OutletsView.tsx
- compilerOptions
- dependencies
- types.ts
- createClient
- Category
- page.tsx
- page.tsx
- devDependencies
- pos-types.ts
- PeriodFilterValue
- Outlet
- KorlapLayout.tsx
- dependencies
- OwnerDashboardView.tsx
- CategoriesView.tsx
- KasirMenuClient.tsx
- gen-guide-assets.mjs
- generate-guide-assets.mjs
- layout.tsx
- PayrollView.tsx
- server.ts
- route.ts
- fix-menu-prices.js
- OutletForm.tsx
- kiosk-logout.ts
- import-suka-shawarma-menu.js
- seed-panduan-kasir.mjs
- setup-integration.js
- lower-menu-prices.js
- scripts
- route.ts
- generate-outlet-sql.js
- sync-outlets.js
- useOutlets
- ban-outlet.js
- check-users.js
- DailyTargetBoard.tsx
- page.tsx
- StaffTable.tsx
- package.json
- haptics.ts
- CategoryPieChart.tsx
- test_rpc.js
- fix_staff_form.js
- page.tsx
- middleware.ts
- test-db.js
- test-db.mjs
- test-upload.js
- middleware.ts
- date-fns
- next
- next.config.mjs
- next-env.d.ts
- nextjs-toploader
- papaparse
- react
- react-countup
- react-dom
- react-hook-form
- react-icons
- react-swipeable
- recharts
- sonner
- @suka/auth
- @suka/design-system
- @supabase/ssr
- @tanstack/react-query
- @tiptap/core
- @tiptap/extension-image
- @tiptap/pm
- @tiptap/react
- @tiptap/starter-kit
- use-debounce
- zod
- postcss.config.mjs
- vercel.json
- next.config.mjs
- next-env.d.ts
- react-dom
- @types/react
- @types/react-dom
- dexie
- dexie-react-hooks
- dotenv
- jszip
- localtunnel
- lucide-react
- pg
- qrcode.react
- react
- react-is
- recharts
- serwist
- @supabase/ssr
- @supabase/supabase-js
- @tanstack/react-query
- @yudiel/react-qr-scanner

## God Nodes (most connected - your core abstractions)
1. `createClient()` - 72 edges
2. `createClient()` - 64 edges
3. `createServiceClient()` - 51 edges
4. `rupiah()` - 50 edges
5. `createClient()` - 41 edges
6. `formatRupiah()` - 39 edges
7. `createClient()` - 31 edges
8. `useMyOutlet()` - 30 edges
9. `MenuItem` - 25 edges
10. `useRole()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `KasirOrderClient()` --indirect_call--> `order()`  [INFERRED]
  app/kasir/KasirOrderClient.tsx → tests/admin-analytics.test.ts
- `KasirMenuServerPage()` --calls--> `createClient()`  [EXTRACTED]
  app/kasir/menu/page.tsx → lib/supabase/server.ts
- `Line` --references--> `MenuItem`  [EXTRACTED]
  app/kasir/order-manual/page.tsx → types/index.ts
- `KasirSettingsPage()` --calls--> `useMyOutlet()`  [EXTRACTED]
  app/kasir/settings/page.tsx → lib/useMyOutlet.ts
- `QRLoginContent()` --indirect_call--> `text()`  [INFERRED]
  app/kiosk/qr-login/page.tsx → scripts/generate-guide-assets.mjs

## Import Cycles
- None detected.

## Communities (248 total, 98 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.13
Nodes (28): CheckoutPage(), PAYMENT_OPTIONS, PaymentOption, ProductDetailClient(), QRISPaymentContent(), RecommendationsClient(), AttractScreen(), AttractScreenProps (+20 more)

### Community 1 - "page.tsx"
Cohesion: 0.06
Nodes (43): upsertExpensesAction(), colorOf(), ExpenseDistributionChart, ExpensesPage(), firstOfMonth(), labelOf(), lastOfMonth(), ProfitCashFlowChart (+35 more)

### Community 2 - "useRole"
Cohesion: 0.07
Nodes (38): ClientRedirect(), ROLE_HOME, cleanName(), EXPIRY_PRESETS, Kind, KINDS, OverviewRow, QUOTES (+30 more)

### Community 3 - "devDependencies"
Cohesion: 0.05
Nodes (43): esbuild, eslint, eslint-config-next, devDependencies, esbuild, eslint, eslint-config-next, @playwright/test (+35 more)

### Community 4 - "usePurchaseOrder.ts"
Cohesion: 0.05
Nodes (55): BahanBakuPage(), NEXT_STATUS, NEXT_STATUS_LABEL, PODetailView(), PriceDiffItem, PriceSyncModal(), STATUS_COLOR, STATUS_LABEL (+47 more)

### Community 5 - "compilerOptions"
Cohesion: 0.07
Nodes (29): ./*, dom, dom.iterable, esnext, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+21 more)

### Community 6 - "devDependencies"
Cohesion: 0.05
Nodes (37): jsdom, description, devDependencies, jsdom, postcss, tailwindcss, @testing-library/jest-dom, @testing-library/react (+29 more)

### Community 7 - "createServiceClient"
Cohesion: 0.12
Nodes (24): ADR-0008, GET(), POST(), DELETE(), PUT(), verifyAdmin(), POST(), savePromosAction() (+16 more)

### Community 8 - "page.tsx"
Cohesion: 0.12
Nodes (17): AttendancePage(), DEFAULT_FILTER, AttendanceForm(), EVENING_ROLES, getShiftForRole(), Props, STATUS_OPTIONS, AttendanceTable() (+9 more)

### Community 9 - "route.ts"
Cohesion: 0.24
Nodes (12): POST(), POST(), WalkInItem, WalkInPayload, BasePromo, calculateGlobalDiscount(), calculateItemPrice(), FOOD_APP_CHANNELS (+4 more)

### Community 10 - "types.ts"
Cohesion: 0.15
Nodes (19): APP_ORDER, INFRA_ORDER, SystemHealthPage(), AppHealthCard(), formatLastActivity(), STATUS_LABELS, STATUS_STYLES, formatTime() (+11 more)

### Community 11 - "page.tsx"
Cohesion: 0.14
Nodes (19): WastePage(), WasteTrendChart, BudgetLossRow, useBudgetLoss(), useWasteBreakdown(), aggregateByBahan(), aggregateByBahanAndReason(), aggregateByDate() (+11 more)

### Community 12 - "createClient"
Cohesion: 0.13
Nodes (13): POST(), GET(), POST(), POST(), POST(), getPortionData(), InfoPorsiPage(), metadata (+5 more)

### Community 13 - "ReportsView.tsx"
Cohesion: 0.15
Nodes (13): CategoryPieChart, DateRangeType, OrderRow, RANGE_LABELS, ReportsView(), ReportsViewProps, ShiftRow, BranchFilter() (+5 more)

### Community 14 - "compilerOptions"
Cohesion: 0.08
Nodes (22): next-env.d.ts, .next/types/**/*.ts, node_modules, ./src/*, @testing-library/jest-dom, **/*.ts, ../../tsconfig.json, **/*.tsx (+14 more)

### Community 15 - "page.tsx"
Cohesion: 0.17
Nodes (15): MONTHS, PayrollPage(), MONTHS, PayrollSlipForm(), PayrollSlipFormProps, PayrollTableProps, statusConfig, useCashAdvanceMutations() (+7 more)

### Community 16 - "page.tsx"
Cohesion: 0.15
Nodes (15): LeavePage(), leaveTypeLabel, Tab, tabs, LeaveRejectDialog(), formatDate(), LeaveRequestTable(), leaveTypeLabel (+7 more)

### Community 17 - "createClient"
Cohesion: 0.14
Nodes (10): HRDashboard(), PushCenterPage(), SubscriptionStats, ShrinkageView(), VoidsView(), useAttendance(), HrActivity, useHrActivity() (+2 more)

### Community 18 - "useDialogStore"
Cohesion: 0.13
Nodes (14): Guide, GuidesView(), GuidesViewProps, deleteOutlet(), upsertOutlet(), OutletsView(), OutletsViewProps, UserProfile (+6 more)

### Community 19 - "PettyCashView.tsx"
Cohesion: 0.16
Nodes (9): MenuView(), CustomTooltip(), reviewPettyCash(), formatDateTime(), PettyCashView(), PettyCashViewProps, TopupRequest, formatRupiah() (+1 more)

### Community 20 - "inventory.ts"
Cohesion: 0.17
Nodes (10): createRequestAction(), dispatchRequestAction(), getSupabase(), dispatchRequest(), InternalRequest, InternalRequestItem, InventoryBatch, InventoryConversion (+2 more)

### Community 21 - "AdminOverviewView.tsx"
Cohesion: 0.19
Nodes (15): AdminOverviewView(), OverviewAreaChart, AdminOverviewPage(), OrderSourceBadge(), AdminAnalytics, CHART_RANGES, ChartRange, computeAnalytics() (+7 more)

### Community 22 - "MenuView.tsx"
Cohesion: 0.23
Nodes (11): deleteAllMenuItems(), deleteMenuItem(), getSupabase(), saveMenuItem(), toggleMenuAvailability(), MenuSearch(), deleteStorageImage(), EMPTY (+3 more)

### Community 23 - "page.tsx"
Cohesion: 0.21
Nodes (11): cleanOutletName(), CrewBonusPage(), formatRupiah(), MONTH_OPTIONS, YEAR_OPTIONS, Select(), SelectOption, SelectProps (+3 more)

### Community 24 - "ResepEditor.tsx"
Cohesion: 0.26
Nodes (7): ResepEditor(), computeResepHpp(), HppBahan, HppItemInput, HppLine, HppResult, bahan

### Community 25 - "CashAdvanceTable.tsx"
Cohesion: 0.24
Nodes (8): CashAdvanceTable(), CashAdvanceTableProps, ExpandableRow(), statusConfig, CashAdvanceRow, CashAdvance, CashAdvancePayment, CashAdvanceStatus

### Community 26 - "actions.ts"
Cohesion: 0.33
Nodes (7): createPanduan(), deletePanduan(), savePanduan(), PanduanEditorPage(), CATEGORY_NAMES, Guide, SystemCategoryPage()

### Community 27 - "useStaff"
Cohesion: 0.36
Nodes (6): CashAdvanceForm(), CashAdvanceFormProps, calcDays(), LeaveFormValues, LeaveRequestForm(), useStaff()

### Community 28 - "PeriodFilter.tsx"
Cohesion: 0.17
Nodes (16): getOwnerDashboardData(), OwnerDashboardPage(), cleanOutletName(), OutletCombobox(), PeriodFilter(), SOURCE_LABELS, SourceCombobox(), SOURCES (+8 more)

### Community 29 - "staffFormValidation.test.ts"
Cohesion: 0.36
Nodes (7): StaffStepId, StaffStepValues, STEPS_BASIC, STEPS_PRIVILEGED, valid, validateStaffStep(), validateStaffThrough()

### Community 30 - "ErrorBoundary"
Cohesion: 0.25
Nodes (3): ErrorBoundary, Props, State

### Community 31 - "dependencies"
Cohesion: 0.29
Nodes (7): @hookform/resolvers, lucide-react, dependencies, @hookform/resolvers, lucide-react, @tailwindcss/typography, @tailwindcss/typography

### Community 32 - "BrandContext.tsx"
Cohesion: 0.38
Nodes (4): AdminSettingsPage(), BrandContext, BrandContextType, useBrand()

### Community 33 - "layout.tsx"
Cohesion: 0.18
Nodes (9): BriefingBanner(), Kind, Message, MSG_STYLE, Progress, rupiahCompact(), OfflineWarmup(), WARM_ROUTES (+1 more)

### Community 34 - "test-bonus-logic.js"
Cohesion: 0.33
Nodes (6): assert, { createClient }, path, run(), supabase, validateOutputRows()

### Community 35 - "seed-guides.js"
Cohesion: 0.29
Nodes (5): { createClient }, env, envContent, fs, supabase

### Community 36 - "test-query.js"
Cohesion: 0.29
Nodes (5): { createClient }, env, envContent, fs, supabase

### Community 37 - "test-query-2.js"
Cohesion: 0.29
Nodes (5): { createClient }, env, envContent, fs, supabase

### Community 38 - "route.ts"
Cohesion: 0.73
Nodes (4): POST(), calculateReleaseTime(), calculateTotalPrepTime(), parsePickupTime()

### Community 39 - "run-bonus-calculation-migration.js"
Cohesion: 0.33
Nodes (4): { createClient }, fs, path, supabase

### Community 40 - "run-bonus-migration.js"
Cohesion: 0.33
Nodes (4): { createClient }, fs, path, supabase

### Community 41 - "verify-bonus-calculation.js"
Cohesion: 0.40
Nodes (5): { createClient }, path, run(), supabase, validateOutputRows()

### Community 42 - "check-kasir-outlets.js"
Cohesion: 0.33
Nodes (4): { createClient }, dotenv, path, supabase

### Community 43 - "cleanup-old-guides.mjs"
Cohesion: 0.33
Nodes (4): __dirname, env, OLD_CATEGORIES, supabase

### Community 44 - "fix-stuck-orders.js"
Cohesion: 0.33
Nodes (4): { createClient }, dotenv, path, supabase

### Community 45 - "check-sync.js"
Cohesion: 0.40
Nodes (3): { createClient }, posKasirDb, ssOrderDb

### Community 46 - "generate-live-guide.js"
Cohesion: 0.40
Nodes (3): { chromium }, fs, path

### Community 47 - "migrate-walkin.js"
Cohesion: 0.40
Nodes (3): { createClient }, fs, supabase

### Community 48 - "run-bonus-migration.js"
Cohesion: 0.40
Nodes (3): { createClient }, fs, supabase

### Community 49 - "run-magic-link.js"
Cohesion: 0.40
Nodes (3): { createClient }, fs, supabase

### Community 50 - "run-migration.js"
Cohesion: 0.40
Nodes (3): { createClient }, fs, supabase

### Community 51 - "verify-bonus-migration.js"
Cohesion: 0.40
Nodes (3): { createClient }, path, supabase

### Community 52 - "fix_duplicates.js"
Cohesion: 0.40
Nodes (3): { createClient }, orderDb, posDb

### Community 53 - "force_hours.js"
Cohesion: 0.40
Nodes (3): { createClient }, orderDb, posDb

### Community 54 - "sync_outlets.js"
Cohesion: 0.40
Nodes (3): { createClient }, orderDb, posDb

### Community 55 - "route.ts"
Cohesion: 0.83
Nodes (3): generateHtmlMsg(), GET(), POST()

### Community 56 - "route.ts"
Cohesion: 0.67
Nodes (3): IncomingOrderPayload, POST(), timingSafeEqual()

### Community 57 - "route.ts"
Cohesion: 0.83
Nodes (3): generateHtmlMsg(), GET(), POST()

### Community 59 - "sw.ts"
Cohesion: 0.50
Nodes (3): customCache, serwist, WorkerGlobalScope

### Community 121 - "KasirOrderClient.tsx"
Cohesion: 0.08
Nodes (41): fetchHistoriOrders(), STATUS_CONF, STATUS_NEXT, STATUS_NEXT_LABEL, fetchTodayOrders(), KasirOrderClient(), renderOrderNotes(), timeAgo() (+33 more)

### Community 122 - "createClient"
Cohesion: 0.10
Nodes (22): QRLoginContent(), inter, metadata, viewport, AudioUnlockMount(), BlockedOverlay(), BlockType, ChecklistProgress (+14 more)

### Community 123 - "SetoranView.tsx"
Cohesion: 0.18
Nodes (19): DashboardPage(), PAY_META, SupplierView(), TransaksiView(), TransferView(), SectionCard(), StatCard(), STATUS_META (+11 more)

### Community 124 - "ExpenseInputView.tsx"
Cohesion: 0.12
Nodes (26): upsertExpensesAction(), ExpenseInputView(), firstOfMonth(), lastOfMonth(), ExpenseInputPage(), firstOfMonth(), lastOfMonth(), TargetCombobox() (+18 more)

### Community 125 - "rupiah"
Cohesion: 0.14
Nodes (21): CategorySlice, ExpenseDistributionChart(), ExpenseTrendChart(), KpiCards(), OutletLeaderboard(), ProfitCashFlowChart(), RevenueTrendChart(), BRAND_COLORS (+13 more)

### Community 126 - "usePettyCash.ts"
Cohesion: 0.15
Nodes (18): PettyCashList(), formatCurrency(), LeaderDashboardPage(), PettyCashList(), FinanceApprovalModal(), FinanceApprovalModalProps, FinancePettyCashList(), ApprovalModal() (+10 more)

### Community 127 - "useMyOutlet"
Cohesion: 0.11
Nodes (20): BonusTab(), AdminOrdersPage(), CashOrder, CATEGORY_LABEL, Expense, formatTime(), LedgerItem, PettyCashTopup (+12 more)

### Community 128 - "KasirNav.tsx"
Cohesion: 0.11
Nodes (19): KasirSettingsPage(), Guide, PanduanPage(), BrandContext, BrandContextType, BrandProvider(), useBrand(), KasirNav() (+11 more)

### Community 129 - "page.tsx"
Cohesion: 0.13
Nodes (20): ManualItem, ManualPayload, POST(), VALID_CHANNELS, CartPanel(), Line, Mode, OrderManualPage() (+12 more)

### Community 130 - "createServiceClient"
Cohesion: 0.14
Nodes (15): DELETE(), GET(), POST(), PUT(), GET(), GET(), POST(), POST() (+7 more)

### Community 131 - "admin-analytics.ts"
Cohesion: 0.12
Nodes (18): BranchFilterProps, OrderSourceBadge(), AdminAnalytics, CHART_RANGES, ChartRange, computeAnalytics(), DateRange, OrderRow (+10 more)

### Community 132 - "StaffView.tsx"
Cohesion: 0.16
Nodes (13): EMPTY_FILTER, StaffPage(), BulkImportStaff(), ParsedRow, ROLES, StaffFilters(), useStaffMutations(), adminApi (+5 more)

### Community 133 - "OutletsView.tsx"
Cohesion: 0.15
Nodes (12): EMPTY_FILTER, OutletsPage(), toFormValues(), DeleteOutletDialog(), OutletFilters(), OutletTable(), friendly(), useOutletMutations() (+4 more)

### Community 134 - "compilerOptions"
Cohesion: 0.09
Nodes (20): next-env.d.ts, .next/types/**/*.ts, node_modules, ./src/*, @testing-library/jest-dom, **/*.ts, ../../tsconfig.json, **/*.tsx (+12 more)

### Community 135 - "dependencies"
Cohesion: 0.11
Nodes (19): lucide-react, next, dependencies, lucide-react, next, react, sonner, @suka/auth (+11 more)

### Community 136 - "types.ts"
Cohesion: 0.19
Nodes (12): LokasiView(), useCashMutations(), countPendingApproval(), NetCashSummary, summarizeBalances(), CashDirection, CashKind, CashScope (+4 more)

### Community 137 - "createClient"
Cohesion: 0.18
Nodes (11): SetoranView(), GlobalRealtimeProvider(), OutletOption, useCashDeposit(), useOutlets(), useExpectedCash(), PayablePo, PoPaymentStatus (+3 more)

### Community 138 - "Category"
Cohesion: 0.16
Nodes (12): MenuQueryData, KasirMenuServerPage(), KioskInitialData, KioskMenuClient(), KioskHomePage(), Props, ImportedItem, ProductResult (+4 more)

### Community 139 - "page.tsx"
Cohesion: 0.18
Nodes (13): DateRange, fetchReportOrders(), fetchReportShifts(), OrderRow, RANGE_LABELS, ReportsPage(), ShiftRow, OrderSuccessContent() (+5 more)

### Community 140 - "page.tsx"
Cohesion: 0.19
Nodes (12): run(), supabase, formatRupiah(), TargetHarianPage(), PayrollTable(), DashboardState, useDashboardStore, HistoricalTargetRow (+4 more)

### Community 141 - "devDependencies"
Cohesion: 0.13
Nodes (17): jsdom, devDependencies, jsdom, postcss, tailwindcss, @testing-library/dom, @testing-library/jest-dom, @testing-library/react (+9 more)

### Community 142 - "pos-types.ts"
Cohesion: 0.13
Nodes (11): UserProfile, CartItem, CheckoutPayload, Order, OrderItem, OrderSource, OrderStatus, OrderWithItems (+3 more)

### Community 143 - "PeriodFilterValue"
Cohesion: 0.28
Nodes (10): OwnerDashboardViewProps, KpiCardsProps, SalesHourlyRow, useSalesHourly(), SalesHourlyRawRow, useSalesHourlyRaw(), useSalesSummary(), PeriodFilterValue (+2 more)

### Community 144 - "Outlet"
Cohesion: 0.21
Nodes (10): BulkImportStaffProps, OutletMultiSelect(), ResetPasswordDialog(), FormData, getStaffFormSchema(), ROLES, StaffForm(), stepFields (+2 more)

### Community 145 - "KorlapLayout.tsx"
Cohesion: 0.19
Nodes (8): KorlapLayout(), NAV_GROUPS, LeaderLayout(), NAV_GROUPS, NavGroup, NavItem, RoleLayout(), RoleLayoutProps

### Community 146 - "dependencies"
Cohesion: 0.13
Nodes (15): canvas-confetti, next, dependencies, canvas-confetti, next, react-dom, @serwist/next, @suka/auth (+7 more)

### Community 147 - "OwnerDashboardView.tsx"
Cohesion: 0.25
Nodes (6): AggregatedMenuSales, getAggregatedMenuSales(), RevenueTrendChart, BottomMenus(), TopMenus(), useMenuSales()

### Community 148 - "CategoriesView.tsx"
Cohesion: 0.18
Nodes (10): CategoriesView(), CategoriesViewProps, EMPTY, FormState, ImportedItem, ProductResult, Step, ZipUploadModal() (+2 more)

### Community 149 - "KasirMenuClient.tsx"
Cohesion: 0.24
Nodes (9): fetchMenuData(), KasirMenuClient(), Toast, Line, Payment, QUICK_CASH, WalkInCartPanel(), NetworkIndicator() (+1 more)

### Community 150 - "gen-guide-assets.mjs"
Cohesion: 0.27
Nodes (11): bigOrderCard(), C, __dirname, esc(), files, frame(), NAV, orderCol() (+3 more)

### Community 151 - "generate-guide-assets.mjs"
Cohesion: 0.24
Nodes (11): addGuide(), badge(), __dirname, esc(), frame(), guides, NAV_ITEMS, numberDot() (+3 more)

### Community 152 - "layout.tsx"
Cohesion: 0.21
Nodes (8): metadata, viewport, Providers(), ALL_LINKS, CashLayout(), NAV_GROUPS, NavGroup, NavItem

### Community 153 - "PayrollView.tsx"
Cohesion: 0.29
Nodes (7): MONTHS, PAY_META, PayrollView(), PayrollPaymentStatus, PayrollSlip, usePayrollDisburse(), usePayrollSlips()

### Community 154 - "server.ts"
Cohesion: 0.27
Nodes (4): POST(), POST(), timingSafeEqual(), ADR-0008

### Community 155 - "route.ts"
Cohesion: 0.35
Nodes (10): ALLOWED_TYPES, analyzeImageWithGemini(), capitalizeWords(), delay(), GeminiAnalysis, getMimeType(), matchPriceFromList(), normalizeName() (+2 more)

### Community 156 - "fix-menu-prices.js"
Cohesion: 0.20
Nodes (9): CATEGORIES, { createClient }, deleteStorageImage(), env, FIXES, fs, main(), path (+1 more)

### Community 157 - "OutletForm.tsx"
Cohesion: 0.31
Nodes (5): EMPTY, OutletForm(), LatLng, parseLatLng(), slugify()

### Community 158 - "kiosk-logout.ts"
Cohesion: 0.29
Nodes (7): POST(), KioskAccount, LogoutRequest, RequesterProfile, resolveLogoutTargets(), ResolveResult, kiosks

### Community 159 - "import-suka-shawarma-menu.js"
Cohesion: 0.20
Nodes (7): CATEGORIES, { createClient }, env, fs, ITEMS, path, sb

### Community 160 - "seed-panduan-kasir.mjs"
Cohesion: 0.20
Nodes (6): CATEGORIES, __dirname, env, guides, raw, supabase

### Community 161 - "setup-integration.js"
Cohesion: 0.20
Nodes (7): crypto, envPath, fs, kasirToOrderSecret, orderToKasirSecret, path, ssOrderConfigPath

### Community 162 - "lower-menu-prices.js"
Cohesion: 0.25
Nodes (7): { createClient }, env, fs, main(), path, rp(), sb

### Community 163 - "scripts"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, start, test, test:watch, type-check

### Community 164 - "route.ts"
Cohesion: 0.43
Nodes (4): GET(), OrderItemIds, RankInput, rankRecommendations()

### Community 165 - "generate-outlet-sql.js"
Cohesion: 0.29
Nodes (7): { createClient }, dotenv, generateSQL(), kasirSupabase, normalizeName(), orderSupabase, path

### Community 166 - "sync-outlets.js"
Cohesion: 0.29
Nodes (7): dotenv, { createClient }, syncOutlets(), kasirSupabase, normalizeName(), orderSupabase, path

### Community 167 - "useOutlets"
Cohesion: 0.43
Nodes (5): AttendanceFilters(), Props, STATUSES, useOutlets(), AttendanceFilterValues

### Community 168 - "ban-outlet.js"
Cohesion: 0.29
Nodes (5): { createClient }, env, envContent, fs, supabase

### Community 169 - "check-users.js"
Cohesion: 0.29
Nodes (5): { createClient }, env, envContent, fs, supabase

### Community 170 - "DailyTargetBoard.tsx"
Cohesion: 0.53
Nodes (4): cleanName(), DailyTargetBoard(), TargetProgressRow, useTargetProgress()

### Community 171 - "page.tsx"
Cohesion: 0.50
Nodes (4): BulananRow, LaporanPembelianPage(), supabase, useLaporanBulanan()

### Community 172 - "StaffTable.tsx"
Cohesion: 0.60
Nodes (3): StaffTable(), statusBadge(), StatusToggle()

### Community 173 - "package.json"
Cohesion: 0.40
Nodes (4): description, name, type, version

### Community 174 - "haptics.ts"
Cohesion: 0.70
Nodes (4): playSyntheticBeep(), triggerErrorFeedback(), triggerSuccessFeedback(), triggerWarningFeedback()

## Knowledge Gaps
- **659 isolated node(s):** `supabase`, `supabase`, `IncomingOrderPayload`, `ManualItem`, `ManualPayload` (+654 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **98 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `createClient()` connect `createClient` to `page.tsx`, `useRole`, `usePurchaseOrder.ts`, `OutletsView.tsx`, `page.tsx`, `types.ts`, `page.tsx`, `ReportsView.tsx`, `page.tsx`, `page.tsx`, `PeriodFilterValue`, `useDialogStore`, `PettyCashView.tsx`, `CategoriesView.tsx`, `AdminOverviewView.tsx`, `MenuView.tsx`, `ResepEditor.tsx`, `CashAdvanceTable.tsx`, `useStaff`, `useOutlets`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `rupiah()` connect `rupiah` to `page.tsx`, `useRole`, `usePurchaseOrder.ts`, `page.tsx`, `page.tsx`, `page.tsx`, `page.tsx`, `OwnerDashboardView.tsx`, `CashAdvanceTable.tsx`, `useStaff`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `createClient()` connect `createClient` to `KasirNav.tsx`, `page.tsx`, `index.ts`, `layout.tsx`, `Category`, `page.tsx`, `KasirMenuClient.tsx`, `KasirOrderClient.tsx`, `useMyOutlet`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **What connects `supabase`, `supabase`, `IncomingOrderPayload` to the rest of the system?**
  _659 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.13067552602436322 - nodes in this community are weakly interconnected._
- **Should `page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.0629800307219662 - nodes in this community are weakly interconnected._
- **Should `useRole` be split into smaller, more focused modules?**
  _Cohesion score 0.0655367231638418 - nodes in this community are weakly interconnected._