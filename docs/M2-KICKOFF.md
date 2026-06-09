# M2 Stok — Kickoff Guide

> **For:** Dev B  
> **Status:** M0 Complete ✅ · Ready for M2 Sprint  
> **Date:** 2026-06-09  
> **Next Session:** M2 development

---

## What Just Happened (M0 ✅)

**Dev B completed M0 foundation in this session:**
- ✅ Monorepo setup (Yarn workspaces)
- ✅ Design System package (@suka/design-system with SUKA colors & components)
- ✅ Offline Queue package (@suka/offline-queue with React hook)
- ✅ Supabase schema (outlets, outlet_staff, RLS policies)
- ✅ 4 Next.js app shells booted (absensi, stok, distribusi, owner-dashboard)
- ✅ M0 dashboard pages with M0 checklist
- ✅ All pushed to GitHub

**Details:** See [`M0-COMPLETION.md`](M0-COMPLETION.md)

---

## Your M2 Scope (Dev B)

You own **M2 Stok (Stock Management)** = 3 modules:

| Module | Purpose | Users |
|--------|---------|-------|
| **Opname** | Daily/weekly physical stock count | Crew, SPV, Kepala Outlet |
| **Ledger** | Track stock movements (in/out/waste/adjustment) | Crew, SPV, Kepala Outlet |
| **Monitoring** | Real-time stock levels + alerts | SPV, Kepala Outlet |

**Domain model:** See [`M2-STOK-SPECIFICATION.md`](M2-STOK-SPECIFICATION.md) — tables, flows, RLS.

---

## How M2 Integrates

### Inputs (from M3, M4)
- **M3 Supply Chain** (Dev A) → creates ledger entries (tipe=terima_kiriman) when shipment received
- **M0 foundation** → outlet_staff identity, design-system, offline-queue for sync

### Outputs (to M3, M4)
- **M3** reads: ledger entries (what stok came in)
- **M4 Dashboard** reads: ledger entries (COGS cost), stok_balance (stock status)

**Key:** No M2→M3 dependency; M2 standalone until M3 integration point.

---

## Parallel Work: Dev A on M1

While you build M2 Stok, **Dev A is building M1 Absensi** (face recognition + clock-in/out).

**Coordination points:**
- Both use M0 foundation (design-system, offline-queue)
- Both add auth flows (Supabase Auth)
- Both add RLS to their tables
- Touchpoint: `outlet_staff` table (both read/write, needs joint review if schema changes)

**No M1↔M2 dependency.** Start M2 immediately in new session.

---

## Recommended M2 Workflow

### 1. Brainstorm (30 min)
- Review [`M2-STOK-SPECIFICATION.md`](M2-STOK-SPECIFICATION.md) (full spec already written)
- Ask: Any questions on domain model? Data flows? UI modules?
- Identify risks (e.g., offline sync complexity, performance for 1000+ ledger entries)

### 2. Create Implementation Plan (1–2 hours)
- Break M2 into phases: Schema → Pages → Logic → Integration → Testing
- Detailed tasks per phase (use superpowers:writing-plans skill)
- Estimate each task (small tasks = faster feedback)

### 3. Execute with Subagents (parallel, 2–3 weeks)
- Per-task implementation (use superpowers:subagent-driven-development)
- Two-stage review: spec compliance + code quality
- Commit each task
- Demo/test locally (Next.js dev server, Supabase shadow database if available)

### 4. Prepare for M3 Handoff
- Document ledger entry interface for M3 (shipment verification)
- Code review with Dev A before merge to main

---

## Repo & Setup

### Git
- **Repo:** https://github.com/dev-sukashawarma/DIGITALISASI-SS-PROJECT (monorepo)
- **Branch:** main (all work goes here; no feature branches for M2)
- **Current status:** M0 pushed, clean working tree

### Local Dev
```bash
# Already done from M0, but reminder:
yarn install          # All workspaces ready
cd apps/stok
yarn dev              # Runs on http://localhost:3001

# Supabase:
# .env.local has NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
# Migrations already deployed (outlets, outlet_staff)
```

### New in M2
```bash
# You'll create:
# - supabase/migrations/20260609xxxxxx_create_stok_tables.sql
# - apps/stok/src/app/stok/opname/page.tsx
# - apps/stok/src/app/stok/ledger/page.tsx
# - apps/stok/src/app/stok/monitoring/page.tsx
# - apps/stok/src/types/stok.ts (domain types)
# - apps/stok/src/hooks/useOpname.ts (+ useLedger, useStokBalance)
# - supabase/functions/stok-balance-recompute/ (optional, M2+)
```

---

## Key Decisions Already Made (Don't Rethink)

| Decision | Why | Where |
|----------|-----|-------|
| **Next.js static export** | cPanel deployment, no SSR overhead | ADR-005 |
| **Supabase project separate** | isolate outlet suite from production | ADR-004 |
| **RLS for outlet isolation** | staff can only see their outlet's stok | M0 foundation |
| **offline-queue pattern** | opname form works offline, syncs on reconnect | M0 pkg |
| **Design tokens reuse** | SUKA colors, spacing, typography in design-system | M0 pkg |

**TL;DR:** Use what M0 gave you; don't redesign architecture. Focus on domain logic (stok model).

---

## Known Blockers / Notes

- ⚠️ **Real 19 outlets data:** Currently seed data. Real data syncs in M1 via Edge Function.
- ⚠️ **Face descriptor:** Not needed for M2 (face comes in M1). Just know `outlet_staff.face_descriptor` exists for M1.
- ⚠️ **BOM auto-deduction:** Out of scope M2 (manual opname only). Hook for future.
- ⚠️ **Liveness detection:** Out of scope M2 (M1 decision).

---

## Success Metrics for M2

When M2 is done:

- [ ] 3 Supabase tables created + deployed (bahan_baku, opname, ledger_stok, stok_balance)
- [ ] 3 Next.js pages ready (opname, ledger, monitoring) + responsive design
- [ ] Opname workflow: create draft → finalize → ledger entry auto-created
- [ ] Ledger view: all entries visible + manual entry form for SPV
- [ ] Monitoring dashboard: real-time stock color-coded by reorder_point
- [ ] RLS enforced: staff see only their outlet
- [ ] Offline support: opname form syncs on reconnect
- [ ] Tests: unit (logic) + E2E (workflow)
- [ ] Performance: opname list <1s, ledger list (30 days) <2s
- [ ] TypeScript strict mode + no console.errors
- [ ] All commits pushed to main branch
- [ ] [`M2-COMPLETION.md`](M2-COMPLETION.md) written

---

## Resources

| What | Where |
|------|-------|
| **Full spec** | [`M2-STOK-SPECIFICATION.md`](M2-STOK-SPECIFICATION.md) |
| **M0 summary** | [`M0-COMPLETION.md`](M0-COMPLETION.md) |
| **Architecture** | [`ARCHITECTURE.md`](ARCHITECTURE.md), [`FLOWS.md`](FLOWS.md) |
| **Decisions** | [`adr/`](adr/) (ADR-001..006) |
| **DB plan** | [`DB-MIGRATION-PLAN.md`](DB-MIGRATION-PLAN.md) |
| **Design tokens** | `packages/design-system/src/tokens.ts` (SUKA colors, spacing) |
| **Offline hook** | `packages/offline-queue/src/useOfflineQueue.ts` (copy pattern for opname sync) |

---

## Questions Before Kickoff?

If unsure about:
- **Domain model:** Read M2-STOK-SPECIFICATION.md fully
- **Architecture:** Check ARCHITECTURE.md + FLOWS.md diagrams
- **Tech stack:** All decided in M0; review PRD.md if questions
- **RLS/Auth:** M0 foundation has patterns; will be enhanced in M1
- **Offline pattern:** See @suka/offline-queue and how M1 will use it

**If blocked:** Check Git history (`git log --oneline`) to see what M0 built; ask in next session.

---

## Next Action

**In new M2 session:**

1. Review M2-STOK-SPECIFICATION.md (read whole thing)
2. Brainstorm domain model + risks (30 min)
3. Create M2 implementation plan (use superpowers:writing-plans)
4. Await your approval, then execute with subagents

---

**Status:** 🎯 Ready to start M2  
**Session:** Fresh (new session, M2 focus)  
**Built:** 2026-06-09  
**By:** Dev B (Claude Code)
