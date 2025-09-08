-- Add Pitcher Prediction Resolution Logging
-- This migration adds logging support for pitcher prediction resolution

-- Create pitcher_prediction_resolution_logs table
CREATE TABLE IF NOT EXISTS pitcher_prediction_resolution_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_pk INTEGER NOT NULL,
    pitcher_id INTEGER NOT NULL,
    pitcher_name TEXT,
    resolution_type TEXT NOT NULL DEFAULT 'pitcher_predictions',
    predictions_resolved INTEGER DEFAULT 0,
    points_awarded INTEGER DEFAULT 0,
    resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pitcher_resolution_logs_game_pk ON pitcher_prediction_resolution_logs(game_pk);
CREATE INDEX IF NOT EXISTS idx_pitcher_resolution_logs_pitcher_id ON pitcher_prediction_resolution_logs(pitcher_id);
CREATE INDEX IF NOT EXISTS idx_pitcher_resolution_logs_resolved_at ON pitcher_prediction_resolution_logs(resolved_at);

-- Enable Row Level Security
ALTER TABLE pitcher_prediction_resolution_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for pitcher_prediction_resolution_logs
CREATE POLICY "Users can view pitcher resolution logs" ON pitcher_prediction_resolution_logs
    FOR SELECT USING (true);

-- Add pitcher resolution statistics to existing prediction_resolution_logs table if it exists
-- This is a fallback in case the main logging table doesn't exist
DO $$
BEGIN
    -- Check if prediction_resolution_logs table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'prediction_resolution_logs') THEN
        -- Add pitcher_id column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'prediction_resolution_logs' AND column_name = 'pitcher_id') THEN
            ALTER TABLE prediction_resolution_logs ADD COLUMN pitcher_id INTEGER;
        END IF;
        
        -- Add pitcher_name column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'prediction_resolution_logs' AND column_name = 'pitcher_name') THEN
            ALTER TABLE prediction_resolution_logs ADD COLUMN pitcher_name TEXT;
        END IF;
        
        -- Add resolution_type column if it doesn't exist
        IF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'prediction_resolution_logs' AND column_name = 'resolution_type') THEN
            ALTER TABLE prediction_resolution_logs ADD COLUMN resolution_type TEXT DEFAULT 'at_bat_predictions';
        END IF;
    END IF;
END $$;
