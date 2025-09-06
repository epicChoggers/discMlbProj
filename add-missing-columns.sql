-- Add missing columns to existing at_bat_predictions table
-- Run this if you already have the table but missing columns

-- Add prediction_category column if it doesn't exist
ALTER TABLE at_bat_predictions ADD COLUMN IF NOT EXISTS prediction_category TEXT;

-- Add actual_category column if it doesn't exist  
ALTER TABLE at_bat_predictions ADD COLUMN IF NOT EXISTS actual_category TEXT;

-- Add points_earned column if it doesn't exist
ALTER TABLE at_bat_predictions ADD COLUMN IF NOT EXISTS points_earned INTEGER DEFAULT 0;

-- Remove confidence column if it exists (since we removed the confidence system)
ALTER TABLE at_bat_predictions DROP COLUMN IF EXISTS confidence;
