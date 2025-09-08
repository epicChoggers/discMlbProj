-- Complete Database Setup for MLB Prediction Project
-- This file resets and sets up the entire database schema

-- Drop existing tables if they exist (in correct order due to foreign keys)
DROP TABLE IF EXISTS at_bat_predictions CASCADE;
DROP TABLE IF EXISTS cached_game_states CASCADE;
DROP TABLE IF EXISTS cached_at_bats CASCADE;
DROP TABLE IF EXISTS system_health CASCADE;
DROP TABLE IF EXISTS sync_logs CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS predictions_with_users CASCADE;

-- Create user_profiles table
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    avatar_url TEXT,
    raw_user_meta_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create at_bat_predictions table
CREATE TABLE at_bat_predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    game_pk INTEGER NOT NULL,
    at_bat_index INTEGER NOT NULL,
    prediction TEXT NOT NULL,
    prediction_category TEXT NOT NULL,
    actual_outcome TEXT,
    actual_category TEXT,
    is_correct BOOLEAN,
    points_earned INTEGER DEFAULT 0,
    streak_count INTEGER DEFAULT 0,
    streak_bonus INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Ensure one prediction per user per at-bat
    UNIQUE(user_id, game_pk, at_bat_index)
);

-- Create cached_game_states table
CREATE TABLE cached_game_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    game_pk INTEGER UNIQUE NOT NULL,
    game_data JSONB NOT NULL,
    current_at_bat JSONB,
    is_live BOOLEAN DEFAULT FALSE,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cached_at_bats table
CREATE TABLE cached_at_bats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- Create system_health table
CREATE TABLE system_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'error')),
    response_time INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create sync_logs table
CREATE TABLE sync_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_type TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'error', 'partial')),
    records_processed INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Create predictions_with_users view (for easier querying)
CREATE VIEW predictions_with_users AS
SELECT 
    p.*,
    u.email,
    u.username,
    u.avatar_url,
    u.raw_user_meta_data
FROM at_bat_predictions p
LEFT JOIN user_profiles u ON p.user_id = u.user_id;

-- Create indexes for better performance
CREATE INDEX idx_at_bat_predictions_user_id ON at_bat_predictions(user_id);
CREATE INDEX idx_at_bat_predictions_game_pk ON at_bat_predictions(game_pk);
CREATE INDEX idx_at_bat_predictions_created_at ON at_bat_predictions(created_at);
CREATE INDEX idx_at_bat_predictions_resolved_at ON at_bat_predictions(resolved_at);

CREATE INDEX idx_cached_game_states_game_pk ON cached_game_states(game_pk);
CREATE INDEX idx_cached_game_states_last_updated ON cached_game_states(last_updated);
CREATE INDEX idx_cached_game_states_is_live ON cached_game_states(is_live);

CREATE INDEX idx_cached_at_bats_game_pk ON cached_at_bats(game_pk);
CREATE INDEX idx_cached_at_bats_at_bat_index ON cached_at_bats(at_bat_index);
CREATE INDEX idx_cached_at_bats_is_resolved ON cached_at_bats(is_resolved);

CREATE INDEX idx_system_health_service_name ON system_health(service_name);
CREATE INDEX idx_system_health_created_at ON system_health(created_at);

CREATE INDEX idx_sync_logs_sync_type ON sync_logs(sync_type);
CREATE INDEX idx_sync_logs_started_at ON sync_logs(started_at);

-- Enable Row Level Security (RLS)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE at_bat_predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_game_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_at_bats ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own profiles
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can only see their own predictions
CREATE POLICY "Users can view own predictions" ON at_bat_predictions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own predictions" ON at_bat_predictions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own predictions" ON at_bat_predictions
    FOR UPDATE USING (auth.uid() = user_id);

-- Cache tables are readable by all authenticated users
CREATE POLICY "Authenticated users can read cached_game_states" ON cached_game_states
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read cached_at_bats" ON cached_at_bats
    FOR SELECT USING (auth.role() = 'authenticated');

-- System tables are readable by all authenticated users
CREATE POLICY "Authenticated users can read system_health" ON system_health
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read sync_logs" ON sync_logs
    FOR SELECT USING (auth.role() = 'authenticated');

-- Create functions for automatic timestamp updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_user_profiles_updated_at 
    BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cached_game_states_updated_at 
    BEFORE UPDATE ON cached_game_states 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cached_at_bats_updated_at 
    BEFORE UPDATE ON cached_at_bats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some initial system health records
INSERT INTO system_health (service_name, status, response_time, metadata) VALUES
('database', 'healthy', 0, '{"message": "Database connection successful"}'),
('mlb_api', 'healthy', 0, '{"message": "MLB API accessible"}'),
('cache_service', 'healthy', 0, '{"message": "Cache service operational"}');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Create a function to clean up old cache entries
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

-- Create a function to get leaderboard data
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

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database setup completed successfully!';
    RAISE NOTICE 'Created tables: user_profiles, at_bat_predictions, cached_game_states, cached_at_bats, system_health, sync_logs';
    RAISE NOTICE 'Created view: predictions_with_users';
    RAISE NOTICE 'Created functions: update_updated_at_column, cleanup_old_cache_entries, get_leaderboard_data';
    RAISE NOTICE 'Enabled RLS and created security policies';
    RAISE NOTICE 'Created indexes for optimal performance';
END $$;
