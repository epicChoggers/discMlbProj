-- API Overhaul Database Schema
-- This creates the new database tables for the game caching system

-- =====================================================
-- 1. CACHED GAME STATES TABLE
-- =====================================================

-- Table for storing cached game states
CREATE TABLE IF NOT EXISTS cached_game_states (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_pk INTEGER NOT NULL UNIQUE,
    game_data JSONB NOT NULL,
    current_at_bat JSONB,
    is_live BOOLEAN NOT NULL DEFAULT false,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 2. CACHED AT-BATS TABLE
-- =====================================================

-- Table for storing cached at-bat data
CREATE TABLE IF NOT EXISTS cached_at_bats (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    game_pk INTEGER NOT NULL,
    at_bat_index INTEGER NOT NULL,
    at_bat_data JSONB NOT NULL,
    outcome TEXT,
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one record per game/at-bat combination
    UNIQUE(game_pk, at_bat_index)
);

-- =====================================================
-- 3. GAME SYNC LOG TABLE
-- =====================================================

-- Table for tracking data synchronization with MLB API
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

-- =====================================================
-- 4. PREDICTION RESOLUTION LOG TABLE
-- =====================================================

-- Table for tracking prediction resolution events
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
-- 5. SYSTEM HEALTH TABLE
-- =====================================================

-- Table for tracking system health and performance
CREATE TABLE IF NOT EXISTS system_health (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_name TEXT NOT NULL,
    status TEXT NOT NULL, -- 'healthy', 'degraded', 'error'
    response_time_ms INTEGER,
    error_count INTEGER DEFAULT 0,
    last_success TIMESTAMP WITH TIME ZONE,
    last_error TIMESTAMP WITH TIME ZONE,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- 6. INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for cached_game_states
CREATE INDEX IF NOT EXISTS idx_cached_game_states_game_pk ON cached_game_states(game_pk);
CREATE INDEX IF NOT EXISTS idx_cached_game_states_last_updated ON cached_game_states(last_updated);
CREATE INDEX IF NOT EXISTS idx_cached_game_states_is_live ON cached_game_states(is_live);

-- Indexes for cached_at_bats
CREATE INDEX IF NOT EXISTS idx_cached_at_bats_game_pk ON cached_at_bats(game_pk);
CREATE INDEX IF NOT EXISTS idx_cached_at_bats_at_bat_index ON cached_at_bats(at_bat_index);
CREATE INDEX IF NOT EXISTS idx_cached_at_bats_is_resolved ON cached_at_bats(is_resolved);
CREATE INDEX IF NOT EXISTS idx_cached_at_bats_created_at ON cached_at_bats(created_at);

-- Indexes for game_sync_log
CREATE INDEX IF NOT EXISTS idx_game_sync_log_game_pk ON game_sync_log(game_pk);
CREATE INDEX IF NOT EXISTS idx_game_sync_log_created_at ON game_sync_log(created_at);
CREATE INDEX IF NOT EXISTS idx_game_sync_log_status ON game_sync_log(status);

-- Indexes for prediction_resolution_log
CREATE INDEX IF NOT EXISTS idx_prediction_resolution_log_game_pk ON prediction_resolution_log(game_pk);
CREATE INDEX IF NOT EXISTS idx_prediction_resolution_log_at_bat_index ON prediction_resolution_log(at_bat_index);
CREATE INDEX IF NOT EXISTS idx_prediction_resolution_log_created_at ON prediction_resolution_log(created_at);

-- Indexes for system_health
CREATE INDEX IF NOT EXISTS idx_system_health_service_name ON system_health(service_name);
CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health(status);
CREATE INDEX IF NOT EXISTS idx_system_health_created_at ON system_health(created_at);

-- =====================================================
-- 7. ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all new tables
ALTER TABLE cached_game_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_at_bats ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE prediction_resolution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for cached_game_states
CREATE POLICY "Anyone can view cached game states" ON cached_game_states
    FOR SELECT USING (true);

CREATE POLICY "Service can manage cached game states" ON cached_game_states
    FOR ALL USING (true);

-- Create RLS policies for cached_at_bats
CREATE POLICY "Anyone can view cached at bats" ON cached_at_bats
    FOR SELECT USING (true);

CREATE POLICY "Service can manage cached at bats" ON cached_at_bats
    FOR ALL USING (true);

-- Create RLS policies for game_sync_log
CREATE POLICY "Anyone can view game sync log" ON game_sync_log
    FOR SELECT USING (true);

CREATE POLICY "Service can manage game sync log" ON game_sync_log
    FOR ALL USING (true);

-- Create RLS policies for prediction_resolution_log
CREATE POLICY "Anyone can view prediction resolution log" ON prediction_resolution_log
    FOR SELECT USING (true);

CREATE POLICY "Service can manage prediction resolution log" ON prediction_resolution_log
    FOR ALL USING (true);

-- Create RLS policies for system_health
CREATE POLICY "Anyone can view system health" ON system_health
    FOR SELECT USING (true);

CREATE POLICY "Service can manage system health" ON system_health
    FOR ALL USING (true);

-- =====================================================
-- 8. FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers to automatically update updated_at
CREATE TRIGGER update_cached_game_states_updated_at 
    BEFORE UPDATE ON cached_game_states 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cached_at_bats_updated_at 
    BEFORE UPDATE ON cached_at_bats 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 9. CLEANUP FUNCTIONS
-- =====================================================

-- Function to clean up old cache entries
CREATE OR REPLACE FUNCTION cleanup_old_cache_entries()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete game states older than 1 hour
    DELETE FROM cached_game_states 
    WHERE last_updated < NOW() - INTERVAL '1 hour';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Delete at-bats older than 1 hour
    DELETE FROM cached_at_bats 
    WHERE created_at < NOW() - INTERVAL '1 hour';
    
    -- Delete sync logs older than 7 days
    DELETE FROM game_sync_log 
    WHERE created_at < NOW() - INTERVAL '7 days';
    
    -- Delete prediction resolution logs older than 30 days
    DELETE FROM prediction_resolution_log 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Delete old system health records (keep last 24 hours)
    DELETE FROM system_health 
    WHERE created_at < NOW() - INTERVAL '24 hours';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 10. GRANT PERMISSIONS
-- =====================================================

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_cache_entries() TO anon, authenticated;

-- =====================================================
-- 11. SAMPLE DATA (OPTIONAL)
-- =====================================================

-- Insert a sample system health record
INSERT INTO system_health (service_name, status, last_success, metadata) 
VALUES ('game_data_service', 'healthy', NOW(), '{"version": "1.0.0", "initialized": true}')
ON CONFLICT DO NOTHING;

-- =====================================================
-- 12. COMMENTS
-- =====================================================

COMMENT ON TABLE cached_game_states IS 'Stores cached game state data from MLB API';
COMMENT ON TABLE cached_at_bats IS 'Stores cached at-bat data for prediction resolution';
COMMENT ON TABLE game_sync_log IS 'Tracks data synchronization events with MLB API';
COMMENT ON TABLE prediction_resolution_log IS 'Tracks prediction resolution events';
COMMENT ON TABLE system_health IS 'Tracks system health and performance metrics';

COMMENT ON COLUMN cached_game_states.game_data IS 'Full game data from MLB API as JSONB';
COMMENT ON COLUMN cached_game_states.current_at_bat IS 'Current at-bat data as JSONB';
COMMENT ON COLUMN cached_at_bats.at_bat_data IS 'Full at-bat data from MLB API as JSONB';
COMMENT ON COLUMN game_sync_log.sync_type IS 'Type of sync: game_state, at_bat, full_refresh';
COMMENT ON COLUMN prediction_resolution_log.predictions_resolved IS 'Number of predictions resolved for this at-bat';
