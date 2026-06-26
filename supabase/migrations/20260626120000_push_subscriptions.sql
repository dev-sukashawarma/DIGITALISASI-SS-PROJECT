CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES outlet_staff(id) ON DELETE CASCADE,
  app TEXT NOT NULL,  -- 'absensi', 'pos-kasir', 'portal', dll.
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- Ensure a user can only have one subscription per endpoint per app
  UNIQUE(user_id, app, endpoint)
);

-- RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow users to manage their own subscriptions
CREATE POLICY "Users can insert their own subscriptions"
ON push_subscriptions FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view their own subscriptions"
ON push_subscriptions FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own subscriptions"
ON push_subscriptions FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- Service role (used by Edge Function) has full access by default.
