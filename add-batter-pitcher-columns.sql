-- Add batter and pitcher columns to at_bat_predictions table
-- This will store the actual player data from the cached at-bat information

-- Add batter information columns
ALTER TABLE at_bat_predictions ADD COLUMN IF NOT EXISTS batter_id INTEGER;
ALTER TABLE at_bat_predictions ADD COLUMN IF NOT EXISTS batter_name TEXT;
ALTER TABLE at_bat_predictions ADD COLUMN IF NOT EXISTS batter_position TEXT;
ALTER TABLE at_bat_predictions ADD COLUMN IF NOT EXISTS batter_bat_side TEXT;

-- Add pitcher information columns  
ALTER TABLE at_bat_predictions ADD COLUMN IF NOT EXISTS pitcher_id INTEGER;
ALTER TABLE at_bat_predictions ADD COLUMN IF NOT EXISTS pitcher_name TEXT;
ALTER TABLE at_bat_predictions ADD COLUMN IF NOT EXISTS pitcher_hand TEXT;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_batter_id ON at_bat_predictions(batter_id);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_pitcher_id ON at_bat_predictions(pitcher_id);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_batter_name ON at_bat_predictions(batter_name);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_pitcher_name ON at_bat_predictions(pitcher_name);
