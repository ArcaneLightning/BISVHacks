-- ============================================
-- Dispatcher Access Control
-- Run in Supabase SQL Editor
-- ============================================
-- Only users whose email is in this table can access /dispatcher.
-- Add dispatchers: INSERT INTO dispatcher_access (email) VALUES ('admin@example.com');

DROP TABLE IF EXISTS dispatcher_access CASCADE;

CREATE TABLE dispatcher_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE dispatcher_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read dispatcher_access"
  ON dispatcher_access FOR SELECT
  TO authenticated
  USING (true);

-- Add your first dispatcher (replace with your email):
INSERT INTO dispatcher_access (email) VALUES ('your-email@example.com') ON CONFLICT (email) DO NOTHING;
