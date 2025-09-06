-- =====================================================
-- MARINERS PREDICTIONS APP - MASTER DATABASE SETUP
-- =====================================================
-- This is the complete, unified SQL setup file for the Mariners Predictions App
-- Run this entire script in your Supabase SQL Editor to set up everything
-- 
-- Features included:
-- - Discord OAuth integration with automatic user profile creation
-- - At-bat predictions system with scoring
-- - Leaderboard functionality
-- - Row Level Security (RLS) policies
-- - Performance indexes
-- - Automatic timestamp updates
-- =====================================================

-- =====================================================
-- 1. DATABASE CONFIGURATION
-- =====================================================

-- Set JWT secret (optional - Supabase handles this automatically)
-- ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- =====================================================
-- 2. TABLE CREATION
-- =====================================================

-- Create user_profiles table for Discord OAuth users
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    discord_id TEXT UNIQUE,
    username TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create at_bat_predictions table for storing user predictions
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

-- =====================================================
-- 3. COLUMN MANAGEMENT (for existing installations)
-- =====================================================

-- Add missing columns to existing at_bat_predictions table if they don't exist
ALTER TABLE at_bat_predictions ADD COLUMN IF NOT EXISTS prediction_category TEXT;
ALTER TABLE at_bat_predictions ADD COLUMN IF NOT EXISTS actual_category TEXT;
ALTER TABLE at_bat_predictions ADD COLUMN IF NOT EXISTS points_earned INTEGER DEFAULT 0;

-- Remove confidence column if it exists (legacy from old system)
ALTER TABLE at_bat_predictions DROP COLUMN IF EXISTS confidence;

-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE at_bat_predictions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for clean reinstallation)
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

DROP POLICY IF EXISTS "Users can view all predictions" ON at_bat_predictions;
DROP POLICY IF EXISTS "Users can insert their own predictions" ON at_bat_predictions;
DROP POLICY IF EXISTS "Users can update their own predictions" ON at_bat_predictions;

-- Create RLS policies for user_profiles
CREATE POLICY "Users can view all profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- Create RLS policies for at_bat_predictions
CREATE POLICY "Users can view all predictions" ON at_bat_predictions FOR SELECT USING (true);
CREATE POLICY "Users can insert their own predictions" ON at_bat_predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own predictions" ON at_bat_predictions FOR UPDATE USING (auth.uid() = user_id);

-- =====================================================
-- 5. DISCORD OAUTH INTEGRATION
-- =====================================================

-- Create function to automatically create user profile on Discord OAuth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, discord_id, username, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'sub',
    COALESCE(
      NEW.raw_user_meta_data->>'full_name', 
      NEW.raw_user_meta_data->>'preferred_username', 
      NEW.raw_user_meta_data->>'name',
      'Unknown User'
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    discord_id = EXCLUDED.discord_id,
    username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url,
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;

-- Create trigger to create profile on user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Create trigger to update profile on user update
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- =====================================================
-- 6. PERFORMANCE OPTIMIZATION
-- =====================================================

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_user_id ON at_bat_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_game_pk ON at_bat_predictions(game_pk);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_at_bat_index ON at_bat_predictions(at_bat_index);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_created_at ON at_bat_predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_resolved_at ON at_bat_predictions(resolved_at);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_is_correct ON at_bat_predictions(is_correct);

-- =====================================================
-- 7. AUTOMATIC TIMESTAMP MANAGEMENT
-- =====================================================

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

-- =====================================================
-- 8. LEADERBOARD VIEW (OPTIONAL)
-- =====================================================

-- Create leaderboard view for easy querying (optional - app uses service layer)
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
    ROW_NUMBER() OVER (
        ORDER BY 
            COALESCE(SUM(abp.points_earned), 0) DESC, 
            CASE 
                WHEN COUNT(abp.id) > 0 
                THEN ROUND((COUNT(CASE WHEN abp.is_correct = true THEN 1 END)::DECIMAL / COUNT(abp.id)) * 100, 1)
                ELSE 0 
            END DESC
    ) as rank
FROM user_profiles up
LEFT JOIN at_bat_predictions abp ON up.id = abp.user_id
WHERE abp.resolved_at IS NOT NULL OR abp.resolved_at IS NULL
GROUP BY up.id, up.username, up.avatar_url
ORDER BY total_points DESC, accuracy DESC;

-- =====================================================
-- 9. PERMISSIONS
-- =====================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- =====================================================
-- 10. VERIFICATION QUERIES (OPTIONAL)
-- =====================================================

-- Uncomment these to verify the setup worked correctly:

-- Check if tables exist
-- SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check if triggers exist
-- SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = 'public';

-- Check if policies exist
-- SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- =====================================================
-- SETUP COMPLETE!
-- =====================================================
-- 
-- Next steps:
-- 1. Configure Discord OAuth in Supabase Dashboard:
--    - Go to Authentication > Providers
--    - Enable Discord provider
--    - Add your Discord app credentials
--    - Set redirect URL to: https://your-project.supabase.co/auth/v1/callback
--
-- 2. Test the setup:
--    - Try signing in with Discord
--    - Check if user profile is created in user_profiles table
--    - Verify leaderboard shows Discord username and avatar
--
-- 3. If you have existing users without profiles, you can manually create them:
--    INSERT INTO user_profiles (id, discord_id, username, avatar_url)
--    VALUES ('user-id', 'discord-id', 'username', 'avatar-url');

-- =====================================================
-- PREDICTIONS WITH USER INFORMATION VIEW
-- =====================================================

-- Create a view for predictions with user information
CREATE OR REPLACE VIEW predictions_with_users AS
SELECT 
    p.id,
    p.user_id,
    p.game_pk,
    p.at_bat_index,
    p.prediction,
    p.prediction_category,
    p.actual_outcome,
    p.actual_category,
    p.is_correct,
    p.points_earned,
    p.created_at,
    p.resolved_at,
    u.email,
    u.raw_user_meta_data
FROM at_bat_predictions p
LEFT JOIN auth.users u ON p.user_id = u.id;

-- Grant access to the view
GRANT SELECT ON predictions_with_users TO authenticated;

-- =====================================================
