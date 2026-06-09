-- outlets RLS: authenticated users can read all outlets (master ref data)
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;

CREATE POLICY outlets_read_authenticated
  ON outlets FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY outlets_write_denied
  ON outlets FOR INSERT, UPDATE, DELETE
  TO authenticated
  USING (false);
