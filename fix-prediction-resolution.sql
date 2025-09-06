-- Fix prediction resolution by updating RLS policies
-- This allows updates to predictions when they are being resolved

-- Drop the existing restrictive update policy
DROP POLICY IF EXISTS "Users can update their own predictions" ON at_bat_predictions;

-- Create a new policy that allows updates for authenticated users
-- This will allow the resolution system to update any prediction
CREATE POLICY "Allow authenticated users to update predictions" ON at_bat_predictions
    FOR UPDATE USING (auth.uid() IS NOT NULL);