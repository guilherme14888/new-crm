-- Add type column to funnel_stages (active | won | lost)
ALTER TABLE funnel_stages
  ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'active'
  AFTER probability;
