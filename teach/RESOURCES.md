# Resources: Backend Infrastructure

## Primary Sources (Supabase)

- [Supabase Docs — Performance](https://supabase.com/docs/guides/database/query-optimization) — Panduan resmi optimasi query
- [Supabase Docs — Indexes](https://supabase.com/docs/guides/database/postgres/indexes) — Kapan dan cara membuat index
- [Supabase Docs — RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) — Cara kerja Row Level Security
- [Supabase Docs — Edge Functions](https://supabase.com/docs/guides/functions) — Deno-based serverless functions
- [Supabase Docs — Realtime](https://supabase.com/docs/guides/realtime) — WebSocket subscriptions
- [Supabase Dashboard — Query Performance](https://supabase.com/dashboard/project/_/database/query-performance) — ⭐ Paling berguna untuk maintenance harian

## PostgreSQL Fundamentals

- [PostgreSQL EXPLAIN](https://www.postgresql.org/docs/current/using-explain.html) — Cara membaca query plan
- [Use The Index, Luke](https://use-the-index-luke.com/) — ⭐ Tutorial index terbaik di internet (gratis, visual)
- [Postgres Guide — Indexes](https://postgresguide.com/performance/index/) — Praktis dan ringkas

## Edge Functions & Serverless

- [Deno Deploy Docs](https://docs.deno.com/deploy/manual/) — Runtime untuk Supabase Edge Functions
- [Supabase Edge Functions Examples](https://github.com/supabase/supabase/tree/master/examples/edge-functions)

## Monitoring & Observability

- [pg_stat_statements](https://www.postgresql.org/docs/current/pgstatstatements.html) — Extension yang sudah aktif di project ini (migration `20260623120000`)
- [Supabase Logs Explorer](https://supabase.com/dashboard/project/_/logs/explorer) — Melihat error dan query lambat
