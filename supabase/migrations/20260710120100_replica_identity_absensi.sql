-- Set REPLICA IDENTITY FULL for tables that need realtime updates with filters.
-- This ensures that UPDATE and DELETE events include all columns in the WAL,
-- so that Supabase Realtime can correctly match filters like `outlet_id=eq...`
-- even if that column was not the one being updated.

ALTER TABLE attendance REPLICA IDENTITY FULL;
ALTER TABLE outlet_attendance_config REPLICA IDENTITY FULL;
ALTER TABLE global_settings REPLICA IDENTITY FULL;
