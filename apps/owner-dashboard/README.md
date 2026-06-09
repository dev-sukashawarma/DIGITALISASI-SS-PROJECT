# apps/owner-dashboard — M4: Owner Dashboard / BI

**Track:** Dev B · Spec: [`docs/PRD.md`](../../docs/PRD.md) §M4 · ADR-002/004

- Reporting hub Supabase (materialized views + pg_cron), near-real-time berlapis
- KPI: revenue per outlet (sales dari **shawarma-kiosk** POS/self-service + TiktokGo online, sinkron via Edge Function + pg_cron), top item, jam ramai, COGS & waste (ledger), status distribusi, ringkasan kehadiran
- Compliance (Checklist MySQL) → widget sekunder, fase lanjut (opsional)

Status: belum mulai (menunggu M2 + sumber sales).
