-- Sync log table for monitoring
CREATE TABLE sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name TEXT NOT NULL,
  status TEXT CHECK (status IN ('success', 'failed')),
  error_message TEXT,
  last_run_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_log_function ON sync_log(function_name);
