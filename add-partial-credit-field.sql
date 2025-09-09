-- Add is_partial_credit field to at_bat_predictions table
-- This field will distinguish between exact matches (is_correct=true) and category matches (is_partial_credit=true)

-- Add the new column
ALTER TABLE at_bat_predictions ADD COLUMN IF NOT EXISTS is_partial_credit BOOLEAN DEFAULT FALSE;

-- Create index for the new field
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_is_partial_credit ON at_bat_predictions(is_partial_credit);

-- Add comment for documentation
COMMENT ON COLUMN at_bat_predictions.is_partial_credit IS 'True when prediction got the category right but not the exact outcome';
