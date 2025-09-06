-- Enable real-time replication for at_bat_predictions table
-- Run this in your Supabase SQL Editor

-- Add the at_bat_predictions table to the supabase_realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE at_bat_predictions;

-- Verify the table is added to the publication
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
AND tablename = 'at_bat_predictions';
