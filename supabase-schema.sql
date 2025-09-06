-- Supabase Database Schema for Mariners Predictions App
-- Run these commands in your Supabase SQL Editor

-- Enable Row Level Security
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    discord_id TEXT UNIQUE,
    username TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create at_bat_predictions table
CREATE TABLE IF NOT EXISTS at_bat_predictions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    game_pk INTEGER NOT NULL,
    at_bat_index INTEGER NOT NULL,
    prediction TEXT NOT NULL,
    prediction_category TEXT,
    confidence INTEGER DEFAULT 5,
    actual_outcome TEXT,
    actual_category TEXT,
    is_correct BOOLEAN,
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one prediction per user per at-bat
    UNIQUE(user_id, game_pk, at_bat_index)
);

-- Create leaderboard view for easy querying
CREATE OR REPLACE VIEW leaderboard AS
SELECT 
    up.id as user_id,
    up.username,
    up.avatar_url,
    COUNT(abp.id) as total_predictions,
    COUNT(CASE WHEN abp.is_correct = true THEN 1 END) as correct_predictions,
    CASE 
        WHEN COUNT(abp.id) > 0 
        THEN ROUND((COUNT(CASE WHEN abp.is_correct = true THEN 1 END)::DECIMAL / COUNT(abp.id)) * 100, 1)
        ELSE 0 
    END as accuracy,
    COALESCE(SUM(abp.points_earned), 0) as total_points,
    COUNT(CASE WHEN abp.prediction = abp.actual_outcome THEN 1 END) as exact_predictions,
    COUNT(CASE WHEN abp.is_correct = true AND abp.prediction != abp.actual_outcome THEN 1 END) as category_predictions,
    ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(abp.points_earned), 0) DESC, accuracy DESC) as rank
FROM user_profiles up
LEFT JOIN at_bat_predictions abp ON up.id = abp.user_id
WHERE abp.resolved_at IS NOT NULL OR abp.resolved_at IS NULL
GROUP BY up.id, up.username, up.avatar_url
ORDER BY total_points DESC, accuracy DESC;

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE at_bat_predictions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_profiles
CREATE POLICY "Users can view all profiles" ON user_profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = id);

-- Create RLS policies for at_bat_predictions
CREATE POLICY "Users can view all predictions" ON at_bat_predictions
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own predictions" ON at_bat_predictions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own predictions" ON at_bat_predictions
    FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_user_id ON at_bat_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_game_pk ON at_bat_predictions(game_pk);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_at_bat_index ON at_bat_predictions(at_bat_index);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_created_at ON at_bat_predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_resolved_at ON at_bat_predictions(resolved_at);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing (optional)
-- You can remove this section if you don't want sample data

-- Sample user profile (replace with your actual user ID)
-- INSERT INTO user_profiles (id, discord_id, username, avatar_url) 
-- VALUES (
--     'your-user-id-here',
--     'discord-user-id',
--     'Test User',
--     'https://example.com/avatar.png'
-- ) ON CONFLICT (id) DO NOTHING;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
