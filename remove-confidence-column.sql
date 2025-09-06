-- Remove confidence column from at_bat_predictions table
-- Run this if you already have the table with confidence column

-- Drop the confidence column if it exists
ALTER TABLE at_bat_predictions DROP COLUMN IF EXISTS confidence;
