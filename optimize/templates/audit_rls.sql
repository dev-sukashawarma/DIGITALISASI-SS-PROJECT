-- AUDIT: jalankan di SQL Editor (read-only). Setiap baris hasil = perlu ditinjau.

-- 1. Policy SELECT/ALL yang terbuka lebar (USING true)
SELECT c.relname AS tabel, p.polname, p.polcmd,
       array_to_string(p.polroles::regrole[]::text[], ',') AS roles
FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE p.polcmd IN ('r', '*') AND pg_get_expr(p.polqual, p.polrelid) = 'true'
ORDER BY 1;

-- 2. Tabel yang bisa dibaca anon (tanpa login)
SELECT table_name FROM information_schema.role_table_grants
WHERE grantee = 'anon' AND privilege_type = 'SELECT' AND table_schema = 'public'
ORDER BY 1;

-- 3. Tabel public tanpa RLS
SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity ORDER BY 1;

-- 4. Fungsi SECURITY DEFINER tanpa search_path terkunci
SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
  AND NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) cfg WHERE cfg LIKE 'search_path=%')
ORDER BY 1;

-- 5. Fungsi SECURITY DEFINER yang masih bisa dieksekusi anon
SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef AND has_function_privilege('anon', p.oid, 'EXECUTE')
ORDER BY 1;

-- 6. View tanpa security_invoker (membaca dengan hak pemilik, melewati RLS)
SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v'
  AND NOT COALESCE('security_invoker=true' = ANY (c.reloptions), false)
ORDER BY 1;

-- 7. Index kembar (kolom sama, beda nama) — biaya tulis sia-sia
SELECT indrelid::regclass AS tabel, array_agg(indexrelid::regclass) AS index_kembar
FROM pg_index GROUP BY indrelid, indkey::text HAVING count(*) > 1;

-- 8. FK tanpa index di sisi anak (embed & ON DELETE memindai seluruh tabel)
SELECT c.conrelid::regclass AS tabel, a.attname AS kolom
FROM pg_constraint c
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1
  AND NOT EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.conrelid AND i.indkey[0] = c.conkey[1])
ORDER BY 1;
