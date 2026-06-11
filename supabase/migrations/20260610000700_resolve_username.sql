CREATE OR REPLACE FUNCTION resolve_username(p_username TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
  v_count INT;
BEGIN
  -- Cek langsung jika email lengkap diberikan
  IF p_username LIKE '%@%' THEN
    RETURN p_username;
  END IF;

  -- Cari user yang emailnya cocok dengan username prefix (contoh: budi.jkt01@ss.com)
  -- Polanya: p_username || '.%@ss.com'
  SELECT count(*), max(email) INTO v_count, v_email
  FROM auth.users
  WHERE email LIKE p_username || '.%@ss.com' OR email = p_username || '@ss.com';
  
  IF v_count = 1 THEN
    RETURN v_email;
  ELSE
    RETURN NULL;
  END IF;
END;
$$;
