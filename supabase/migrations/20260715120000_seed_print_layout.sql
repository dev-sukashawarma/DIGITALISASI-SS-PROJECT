-- Seed default print layout config into existing global_settings (key/value JSONB).
-- Additive & idempotent: apps fall back to hardcoded defaults if this row is absent,
-- so this seed is a convenience for discoverability, not a hard requirement.
INSERT INTO global_settings (key, value)
VALUES (
  'print_layout',
  '{
    "struk_customer": {"paperWidth":58,"showLogo":true,"headerText":"","footerText":"Terima kasih & selamat menikmati!","fontScale":"normal","showCashier":true,"showCustomer":true,"showItemNotes":true},
    "struk_dapur": {"paperWidth":58,"showLogo":true,"headerText":"STRUK DAPUR","fontScale":"besar","showCustomer":true},
    "qr_surat_jalan": {"paperWidth":58,"showLogo":false,"title":"VERIFIKASI SJ","footerText":"Distribusi\nSuka Shawarma","qrSizeMm":45}
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
