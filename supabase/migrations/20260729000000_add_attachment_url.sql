-- Tambahkan kolom attachment_url (opsional) di tabel leave_requests untuk menyimpan link foto surat sakit
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS attachment_url text;
