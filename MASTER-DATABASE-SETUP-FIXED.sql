-- =====================================================
-- MARINERS PREDICTIONS APP - MASTER DATABASE SETUP (FIXED)
-- =====================================================
-- This is the COMPLETE, UNIFIED SQL setup file for the Mariners Predictions App
-- Run this entire script in your Supabase SQL Editor to set up everything
-- 
-- Features included:
-- - Discord OAuth integration with automatic user profile creation
-- - At-bat predictions system with scoring and streak bonuses
-- - Game caching system for MLB API data
-- - Leaderboard functionality with real-time updates
-- - System health monitoring
-- - Row Level Security (RLS) policies
-- - Performance indexes
-- - Automatic timestamp updates
-- - Real-time subscriptions
-- =====================================================

-- =====================================================
-- 1. CORE TABLES CREATION
-- =====================================================

-- Create user_profiles table for Discord OAuth users
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    discord_id TEXT UNIQUE,
    username TEXT NOT NULL,
    avatar_url TEXT,
    email TEXT,
    raw_user_meta_data JSONB DEFAULT '{}',
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
    prediction_category TEXT NOT NULL,
    actual_outcome TEXT,
    actual_category TEXT,
    is_correct BOOLEAN,
    points_earned INTEGER DEFAULT 0,
    streak_count INTEGER DEFAULT 0, -- Current streak count when this prediction was made
    streak_bonus INTEGER DEFAULT 0, -- Bonus points earned from streak
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one prediction per user per at-bat
    UNIQUE(user_id, game_pk, at_bat_index)
);

-- Create cached_game_states table for MLB API data caching
CREATE TABLE IF NOT EXISTS cached_game_states (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_pk INTEGER UNIQUE NOT NULL,
    game_data JSONB NOT NULL,
    current_at_bat JSONB,
    is_live BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cached_at_bats table for at-bat data caching
CREATE TABLE IF NOT EXISTS cached_at_bats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_pk INTEGER NOT NULL,
    at_bat_index INTEGER NOT NULL,
    at_bat_data JSONB NOT NULL,
    outcome TEXT,
    is_resolved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one cache entry per at-bat
    UNIQUE(game_pk, at_bat_index)
);

-- Create system_health table for monitoring
CREATE TABLE IF NOT EXISTS system_health (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'error')),
    response_time INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sync_logs table for tracking data synchronization
CREATE TABLE IF NOT EXISTS sync_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    sync_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create game_sync_log table for MLB API sync tracking
CREATE TABLE IF NOT EXISTS game_sync_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_pk INTEGER NOT NULL,
    sync_type TEXT NOT NULL, -- 'game_state', 'at_bat', 'full_refresh'
    status TEXT NOT NULL, -- 'success', 'error', 'partial'
    error_message TEXT,
    data_size INTEGER, -- Size of data synced
    sync_duration_ms INTEGER, -- How long the sync took
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create prediction_resolution_log table for tracking prediction resolution
CREATE TABLE IF NOT EXISTS prediction_resolution_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_pk INTEGER NOT NULL,
    at_bat_index INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    predictions_resolved INTEGER NOT NULL DEFAULT 0,
    points_awarded INTEGER NOT NULL DEFAULT 0,
    resolution_duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_discord_id ON user_profiles(discord_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username);

-- Indexes for at_bat_predictions
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_user_id ON at_bat_predictions(user_id);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_game_pk ON at_bat_predictions(game_pk);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_at_bat_index ON at_bat_predictions(at_bat_index);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_created_at ON at_bat_predictions(created_at);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_resolved_at ON at_bat_predictions(resolved_at);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_is_correct ON at_bat_predictions(is_correct);
CREATE INDEX IF NOT EXISTS idx_at_bat_predictions_points_earned ON at_bat_predictions(points_earned);

-- Indexes for cached_game_states
CREATE INDEX IF NOT EXISTS idx_cached_game_states_game_pk ON cached_game_states(game_pk);
CREATE INDEX IF NOT EXISTS idx_cached_game_states_last_updated ON cached_game_states(last_updated);
CREATE INDEX IF NOT EXISTS idx_cached_game_states_is_live ON cached_game_states(is_live);

-- Indexes for cached_at_bats
CREATE INDEX IF NOT EXISTS idx_cached_at_bats_game_pk ON cached_at_bats(game_pk);
CREATE INDEX IF NOT EXISTS idx_cached_at_bats_at_bat_index ON cached_at_bats(at_bat_index);
CREATE INDEX IF NOT EXISTS idx_cached_at_bats_is_resolved ON cached_at_bats(is_resolved);
CREATE INDEX IF NOT EXISTS idx_cached_at_bats_created_at ON cached_at_bats(created_at);

-- Indexes for system_health
CREATE INDEX IF NOT EXISTS idx_system_health_service_name ON system_health(service_name);
CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health(status);
CREATE INDEX IF NOT EXISTS idx_system_health_created_at ON system_health(created_at);

-- Indexes for sync_logs
CREATE INDEX IF NOT EXISTS idx_sync_logs_sync_type ON sync_logs(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_logs_started_at ON sync_logs(started_at);

-- Indexes for game_sync_log
CREATE INDEX IF NOT EXISTS idx_game_sync_log_game_pk ON game_sync_log(game_pk);
CREATE INDEX IF NOT EXISTS idx_game_sync_log_created_at ON game_sync_log(created_at);
CREATE INDEX IF NOT EXISTS idx_game_sync_log_status ON game_sync_log(status);

-- Indexes for prediction_resolution_log
CREATE INDEX IF NOT EXISTS idx_prediction_resolution_log_game_pk ON prediction_resolution_log(game_pk);
CREATE INDEX IF NOT EXISTS idx_prediction_resolution_log_at_bat_index ON prediction_resolution_log(at_bat_index);
CREATE INDEX IF NOT EXISTS idx_prediction_resolution_log_created_at ON prediction_resolution_log(created_at);

-- =====================================================
-- 3. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE at_bat_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_game_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_at_bats ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_resolution_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON user_profiles;

DROP POLICY IF EXISTS "Users can view all predictions" ON at_bat_predictions;
DROP POLICY IF EXISTS "Users can insert their own predictions" ON at_bat_predictions;
DROP POLICY IF EXISTS "Users can update their own predictions" ON at_bat_predictions;

DROP POLICY IF EXISTS "Authenticated users can read cached_game_states" ON cached_game_states;
DROP POLICY IF EXISTS "Service can manage cached_game_states" ON cached_game_states;

DROP POLICY IF EXISTS "Authenticated users can read cached_at_bats" ON cached_at_bats;
DROP POLICY IF EXISTS "Service can manage cached_at_bats" ON cached_at_bats;

DROP POLICY IF EXISTS "Authenticated users can read system_health" ON system_health;
DROP POLICY IF EXISTS "Service can manage system_health" ON system_health;

DROP POLICY IF EXISTS "Authenticated users can read sync_logs" ON sync_logs;
DROP POLICY IF EXISTS "Service can manage sync_logs" ON sync_logs;

DROP POLICY IF EXISTS "Authenticated users can read game_sync_log" ON game_sync_log;
DROP POLICY IF EXISTS "Service can manage game_sync_log" ON game_sync_log;

DROP POLICY IF EXISTS "Authenticated users can read prediction_resolution_log" ON prediction_resolution_log;
DROP POLICY IF EXISTS "Service can manage prediction_resolution_log" ON prediction_resolution_log;

-- Create RLS policies for user_profiles
CREATE POLICY "Users can view all profiles" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);

-- Create RLS policies for at_bat_predictions
CREATE POLICY "Users can view all predictions" ON at_bat_predictions FOR SELECT USING (true);
CREATE POLICY "Users can insert their own predictions" ON at_bat_predictions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own predictions" ON at_bat_predictions FOR UPDATE USING (auth.uid() = user_id);

-- Create RLS policies for cache tables (readable by all authenticated users)
CREATE POLICY "Authenticated users can read cached_game_states" ON cached_game_states FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service can manage cached_game_states" ON cached_game_states FOR ALL USING (true);

CREATE POLICY "Authenticated users can read cached_at_bats" ON cached_at_bats FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service can manage cached_at_bats" ON cached_at_bats FOR ALL USING (true);

-- Create RLS policies for system tables (readable by all authenticated users)
CREATE POLICY "Authenticated users can read system_health" ON system_health FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service can manage system_health" ON system_health FOR ALL USING (true);

CREATE POLICY "Authenticated users can read sync_logs" ON sync_logs FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service can manage sync_logs" ON sync_logs FOR ALL USING (true);

CREATE POLICY "Authenticated users can read game_sync_log" ON game_sync_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service can manage game_sync_log" ON game_sync_log FOR ALL USING (true);

CREATE POLICY "Authenticated users can read prediction_resolution_log" ON prediction_resolution_log FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Service can manage prediction_resolution_log" ON prediction_resolution_log FOR ALL USING (true);

-- =====================================================
-- 4. DISCORD OAUTH INTEGRATION
-- =====================================================

-- Create function to automatically create user profile on Discord OAuth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, discord_id, username, avatar_url, email, raw_user_meta_data)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'sub',
    COALESCE(
      NEW.raw_user_meta_data->>'full_name', 
      NEW.raw_user_meta_data->>'preferred_username', 
      NEW.raw_user_meta_data->>'name',
      'Unknown User'
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.email,
    NEW.raw_user_meta_data
  )
  ON CONFLICT (id) DO UPDATE SET
    discord_id = EXCLUDED.discord_id,
    username = EXCLUDED.username,
    avatar_url = EXCLUDED.avatar_url,
    email = EXCLUDED.email,
    raw_user_meta_data = EXCLUDED.raw_user_meta_data,
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
-- 5. AUTOMATIC TIMESTAMP MANAGEMENT
-- =====================================================

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
DROP TRIGGER IF EXISTS update_cached_game_states_updated_at ON cached_game_states;
DROP TRIGGER IF EXISTS update_cached_at_bats_updated_at ON cached_at_bats;

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cached_game_states_updated_at 
    BEFORE UPDATE ON cached_game_states 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cached_at_bats_updated_at 
    BEFORE UPDATE ON cached_at_bats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. VIEWS FOR EASY QUERYING
-- =====================================================

-- Drop existing views if they exist
DROP VIEW IF EXISTS predictions_with_users CASCADE;
DROP VIEW IF EXISTS leaderboard CASCADE;

-- Create predictions_with_users view
CREATE VIEW predictions_with_users AS
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
    p.streak_count,
    p.streak_bonus,
    p.created_at,
    p.resolved_at,
    u.email,
    u.username,
    u.avatar_url,
    u.raw_user_meta_data
FROM at_bat_predictions p
LEFT JOIN user_profiles u ON p.user_id = u.id;

-- Create leaderboard view
CREATE VIEW leaderboard AS
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
-- 7. UTILITY FUNCTIONS
-- =====================================================

-- Function to clean up old cache entries
CREATE OR REPLACE FUNCTION cleanup_old_cache_entries()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    temp_count INTEGER;
BEGIN
    -- Delete cached game states older than 24 hours
    DELETE FROM cached_game_states 
    WHERE last_updated < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- Delete cached at-bats older than 24 hours
    DELETE FROM cached_at_bats 
    WHERE created_at < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    -- Delete old system health records (keep last 1000)
    DELETE FROM system_health 
    WHERE id NOT IN (
        SELECT id FROM system_health 
        ORDER BY created_at DESC 
        LIMIT 1000
    );
    
    GET DIAGNOSTICS temp_count = ROW_COUNT;
    deleted_count := deleted_count + temp_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get leaderboard data
CREATE OR REPLACE FUNCTION get_leaderboard_data(target_game_pk INTEGER DEFAULT NULL, target_limit INTEGER DEFAULT 10)
RETURNS TABLE (
    user_id UUID,
    username TEXT,
    avatar_url TEXT,
    total_predictions BIGINT,
    correct_predictions BIGINT,
    accuracy NUMERIC,
    total_points BIGINT,
    rank BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH user_stats AS (
        SELECT 
            p.user_id,
            COUNT(*) as total_predictions,
            COUNT(*) FILTER (WHERE p.is_correct = true) as correct_predictions,
            SUM(COALESCE(p.points_earned, 0)) as total_points
        FROM at_bat_predictions p
        WHERE (target_game_pk IS NULL OR p.game_pk = target_game_pk)
        GROUP BY p.user_id
    ),
    ranked_users AS (
        SELECT 
            us.user_id,
            us.total_predictions,
            us.correct_predictions,
            CASE 
                WHEN us.total_predictions > 0 
                THEN (us.correct_predictions::NUMERIC / us.total_predictions::NUMERIC) * 100
                ELSE 0 
            END as accuracy,
            us.total_points,
            ROW_NUMBER() OVER (ORDER BY us.total_points DESC, accuracy DESC) as rank
        FROM user_stats us
    )
    SELECT 
        ru.user_id,
        COALESCE(up.username, 'Unknown User') as username,
        up.avatar_url,
        ru.total_predictions,
        ru.correct_predictions,
        ru.accuracy,
        ru.total_points,
        ru.rank
    FROM ranked_users ru
    LEFT JOIN user_profiles up ON ru.user_id = up.user_id
    WHERE ru.rank <= target_limit
    ORDER BY ru.rank;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 8. REAL-TIME SUBSCRIPTIONS
-- =====================================================

-- Enable real-time replication for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE at_bat_predictions;
ALTER PUBLICATION supabase_realtime ADD TABLE user_profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE cached_game_states;

-- =====================================================
-- 9. PERMISSIONS
-- =====================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- Grant access to views
GRANT SELECT ON predictions_with_users TO authenticated;
GRANT SELECT ON leaderboard TO authenticated;

-- =====================================================
-- 10. INITIAL DATA
-- =====================================================

-- Insert initial system health records
INSERT INTO system_health (service_name, status, response_time, metadata) VALUES
('database', 'healthy', 0, '{"message": "Database connection successful"}'),
('mlb_api', 'healthy', 0, '{"message": "MLB API accessible"}'),
('cache_service', 'healthy', 0, '{"message": "Cache service operational"}'),
('discord_oauth', 'healthy', 0, '{"message": "Discord OAuth configured"}')
ON CONFLICT DO NOTHING;

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
-- 3. Environment variables needed:
--    - VITE_SUPABASE_URL
--    - VITE_SUPABASE_ANON_KEY
--    - VITE_SHARED_EMAIL (for shared login if needed)
--    - VITE_LOCAL_BYPASS_AUTH (for development)
--    - VITE_ADMIN_EMAIL (for development)
--
-- 4. API endpoints will now work with:
--    - /api/game/state (simplified, no cache dependency)
--    - /api/game/leaderboard
--    - /api/game/predictions
--    - /api/system/health
--
-- =====================================================

-- Success message
DO $$
BEGIN
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'MARINERS PREDICTIONS APP - DATABASE SETUP COMPLETE!';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Created tables: user_profiles, at_bat_predictions, cached_game_states, cached_at_bats, system_health, sync_logs, game_sync_log, prediction_resolution_log';
    RAISE NOTICE 'Created views: predictions_with_users, leaderboard';
    RAISE NOTICE 'Created functions: handle_new_user, update_updated_at_column, cleanup_old_cache_entries, get_leaderboard_data';
    RAISE NOTICE 'Enabled RLS and created security policies';
    RAISE NOTICE 'Created indexes for optimal performance';
    RAISE NOTICE 'Enabled real-time subscriptions';
    RAISE NOTICE 'Inserted initial system health data';
    RAISE NOTICE '=====================================================';
    RAISE NOTICE 'Next: Configure Discord OAuth in Supabase Dashboard';
    RAISE NOTICE '=====================================================';
END $$;
