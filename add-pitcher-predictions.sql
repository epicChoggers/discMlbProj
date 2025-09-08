-- Add Pitcher Predictions Table
-- This migration adds support for predicting Mariners pitcher performance

-- Create pitcher_predictions table
CREATE TABLE IF NOT EXISTS pitcher_predictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    game_pk INTEGER NOT NULL,
    pitcher_id INTEGER NOT NULL,
    pitcher_name TEXT NOT NULL,
    predicted_ip DECIMAL(4,1) NOT NULL, -- e.g., 7.1, 6.2 (max 9.2 innings)
    predicted_hits INTEGER NOT NULL CHECK (predicted_hits >= 0),
    predicted_earned_runs INTEGER NOT NULL CHECK (predicted_earned_runs >= 0),
    predicted_walks INTEGER NOT NULL CHECK (predicted_walks >= 0),
    predicted_strikeouts INTEGER NOT NULL CHECK (predicted_strikeouts >= 0),
    actual_ip DECIMAL(4,1),
    actual_hits INTEGER,
    actual_earned_runs INTEGER,
    actual_walks INTEGER,
    actual_strikeouts INTEGER,
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one prediction per user per pitcher per game
    UNIQUE(user_id, game_pk, pitcher_id)
);

-- Enable Row Level Security
ALTER TABLE pitcher_predictions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for pitcher_predictions
CREATE POLICY "Users can view all pitcher predictions" ON pitcher_predictions
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own pitcher predictions" ON pitcher_predictions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pitcher predictions" ON pitcher_predictions
    FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pitcher_predictions_user_id ON pitcher_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_pitcher_predictions_game_pk ON pitcher_predictions(game_pk);
CREATE INDEX IF NOT EXISTS idx_pitcher_predictions_pitcher_id ON pitcher_predictions(pitcher_id);
CREATE INDEX IF NOT EXISTS idx_pitcher_predictions_created_at ON pitcher_predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_pitcher_predictions_resolved_at ON pitcher_predictions(resolved_at);

-- Create a view for pitcher prediction leaderboard
CREATE OR REPLACE VIEW pitcher_prediction_leaderboard AS
SELECT 
    up.id as user_id,
    up.username,
    up.avatar_url,
    COUNT(pp.id) as total_predictions,
    COUNT(CASE WHEN pp.resolved_at IS NOT NULL THEN 1 END) as resolved_predictions,
    COALESCE(SUM(pp.points_earned), 0) as total_points,
    COALESCE(AVG(pp.points_earned), 0) as avg_points_per_prediction,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(pp.points_earned), 0) DESC, COUNT(pp.id) DESC) as rank
FROM user_profiles up
LEFT JOIN pitcher_predictions pp ON up.id = pp.user_id
GROUP BY up.id, up.username, up.avatar_url
ORDER BY total_points DESC, total_predictions DESC;

-- Grant permissions
GRANT ALL ON pitcher_predictions TO anon, authenticated;
GRANT ALL ON pitcher_prediction_leaderboard TO anon, authenticated;

-- Add comments for documentation
COMMENT ON TABLE pitcher_predictions IS 'Stores user predictions for Mariners pitcher performance in specific games';
COMMENT ON COLUMN pitcher_predictions.predicted_ip IS 'Predicted innings pitched (e.g., 7.1 = 7 innings and 1 out)';
COMMENT ON COLUMN pitcher_predictions.actual_ip IS 'Actual innings pitched (e.g., 7.1 = 7 innings and 1 out)';
COMMENT ON COLUMN pitcher_predictions.points_earned IS 'Points earned based on accuracy of prediction';
