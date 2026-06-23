-- Enable query statistics collection for performance baseline + slow-query discovery.
-- See docs/PERFORMANCE.md for how to read pg_stat_statements.
create extension if not exists pg_stat_statements;
