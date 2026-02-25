
-- Create scoring_weights table for dynamic routing engine weights
CREATE TABLE public.scoring_weights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  value NUMERIC NOT NULL DEFAULT 0,
  min_value NUMERIC NOT NULL DEFAULT -100,
  max_value NUMERIC NOT NULL DEFAULT 100,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scoring_weights ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read weights
CREATE POLICY "Authenticated users can read scoring weights"
  ON public.scoring_weights FOR SELECT TO authenticated
  USING (true);

-- Allow all authenticated users to update weights (admin check can be added later)
CREATE POLICY "Authenticated users can update scoring weights"
  ON public.scoring_weights FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

-- Also allow anon read for the routing engine (no auth required to view)
CREATE POLICY "Anon can read scoring weights"
  ON public.scoring_weights FOR SELECT TO anon
  USING (true);

-- Seed default values matching current hardcoded weights
INSERT INTO public.scoring_weights (key, label, description, value, min_value, max_value, sort_order) VALUES
  ('speed_rank_multiplier', 'Speed Rank Multiplier', 'Points deducted per speed rank level (rank × this value subtracted from 40)', 10, 0, 40, 1),
  ('balance_sufficient_bonus', 'Balance Sufficient Bonus', 'Points added when provider has enough balance', 20, 0, 50, 2),
  ('balance_insufficient_penalty', 'Balance Insufficient Penalty', 'Points deducted when provider lacks balance (stored as positive, applied as negative)', 30, 0, 50, 3),
  ('flow_target_under_bonus', 'Flow Target Under Bonus', 'Points added when provider is under its flow target %', 15, 0, 50, 4),
  ('flow_target_over_penalty', 'Flow Target Over Penalty', 'Points deducted when provider exceeds 1.5× its target % (stored as positive, applied as negative)', 10, 0, 50, 5),
  ('pobo_penalty', 'POBO Penalty', 'Points deducted for POBO (Payment on Behalf Of) rails (stored as positive, applied as negative)', 25, 0, 50, 6),
  ('manual_penalty', 'Manual Processing Penalty', 'Points deducted for providers requiring manual processing (stored as positive, applied as negative)', 20, 0, 50, 7);
