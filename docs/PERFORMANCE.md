# Performance — Baseline & Budget

> Living document for the performance program (spec: `docs/superpowers/specs/2026-06-23-performance-program-design.md`, plan: `docs/superpowers/plans/2026-06-23-performance-program.md`).

## How to read pg_stat_statements
- `total_exec_time` = where the DB spends real time (fix these first).
- `mean_exec_time` high + low `calls` = a slow one-off; high `calls` + modest mean = a hot path worth caching/indexing.
- Reset between experiments: `select pg_stat_statements_reset();`

Query to pull the top-20 (run in Supabase SQL editor after the extension is enabled):

```sql
select substring(query, 1, 120) as query, calls,
       round(mean_exec_time::numeric, 1) as mean_ms,
       round(total_exec_time::numeric, 1) as total_ms
from pg_stat_statements
order by total_exec_time desc
limit 20;
```

## Before (capture after enabling pg_stat_statements — Task 0.3)

### Top-20 queries (pg_stat_statements)
| query | calls | mean_ms | total_ms |
|---|---|---|---|
| _pending capture_ | | | |

### Per-app cold load TTFB
| app | TTFB (ms) |
|---|---|
| absensi | _pending_ |
| admin-dashboard | _pending_ |
| distribusi | _pending_ |
| owner-dashboard | _pending_ |
| portal | _pending_ |
| pos-kasir | _pending_ |
| stok | _pending_ |

## After (post-optimization — Task 3.2)
| metric | before | after |
|---|---|---|
| _fill from baseline_ | | |

## Perf Budget
- Dashboard TTFB target: < 800ms cold, < 200ms warm.
- No single screen issues > 4 sequential DB round-trips.

## Review Checklist (every PR touching data)
- [ ] No `select('*')` on hot paths — list explicit columns.
- [ ] No `await` inside a render/JS loop over rows — batch with `in(...)`/join.
- [ ] Every new filtered/ordered column has a supporting index.
- [ ] New cross-outlet reads go through a definer view/RPC, not raw ledger_stok.
- [ ] Identity in middleware uses local-JWT path (SUPABASE_JWT_SECRET set in prod).
