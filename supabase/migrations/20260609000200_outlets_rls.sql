-- outlets RLS: authenticated users can read all outlets (master ref data)
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;

CREATE POLICY outlets_read_authenticated
  ON outlets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY outlets_insert_denied
  ON outlets FOR INSERT
  TO authenticated
  WITH CHECK (false);

CREATE POLICY outlets_update_denied
  ON outlets FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY outlets_delete_denied
  ON outlets FOR DELETE
  TO authenticated
  USING (false);
