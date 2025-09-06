-- Quick Supabase Setup - Run this in your Supabase SQL Editor
-- This creates the essential tables needed for the app to work
-- Handles existing policies gracefully

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
    actual_outcome TEXT,
    actual_category TEXT,
    is_correct BOOLEAN,
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one prediction per user per at-bat
    UNIQUE(user_id, game_pk, at_bat_index)
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE at_bat_predictions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist, then recreate them
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

DROP POLICY IF EXISTS "Users can view all predictions" ON at_bat_predictions;
DROP POLICY IF EXISTS "Users can insert their own predictions" ON at_bat_predictions;
DROP POLICY IF EXISTS "Users can update their own predictions" ON at_bat_predictions;

-- Create RLS policies
CREATE POLICY "Users can view all profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can view all predictions" ON at_bat_predictions FOR SELECT USING (true);
CREATE POLICY "Users can insert their own predictions" ON at_bat_predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own predictions" ON at_bat_predictions FOR UPDATE USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
