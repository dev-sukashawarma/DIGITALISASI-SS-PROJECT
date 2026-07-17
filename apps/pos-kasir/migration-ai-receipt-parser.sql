INSERT INTO global_settings (key, value)
VALUES ('enable_ai_receipt_parser', 'false')
ON CONFLICT (key) DO NOTHING;
