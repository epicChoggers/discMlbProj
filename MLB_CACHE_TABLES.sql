-- MLB Cache Tables for Server-Side Caching
-- This prevents direct calls to MLB Stats API from frontend

-- Table for caching individual game data
CREATE TABLE IF NOT EXISTS mlb_game_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_pk INTEGER NOT NULL,
  game_date DATE NOT NULL,
  data JSONB NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE(game_pk, game_date)
);

-- Table for caching schedule data
CREATE TABLE IF NOT EXISTS mlb_schedule_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id VARCHAR(10) NOT NULL,
  date DATE NOT NULL,
  data JSONB NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE(team_id, date)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_mlb_game_cache_game_pk_date ON mlb_game_cache(game_pk, game_date);
CREATE INDEX IF NOT EXISTS idx_mlb_game_cache_expires_at ON mlb_game_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_mlb_schedule_cache_team_date ON mlb_schedule_cache(team_id, date);
CREATE INDEX IF NOT EXISTS idx_mlb_schedule_cache_expires_at ON mlb_schedule_cache(expires_at);

-- Function to automatically clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_mlb_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM mlb_game_cache WHERE expires_at < NOW();
  DELETE FROM mlb_schedule_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to clean up expired cache (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-mlb-cache', '0 * * * *', 'SELECT cleanup_expired_mlb_cache();');
