-- Enable real-time replication for leaderboard table
-- Run this in your Supabase SQL Editor

-- Add the leaderboard table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE leaderboard;

-- Verify the table is added to the publication
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'leaderboard';
