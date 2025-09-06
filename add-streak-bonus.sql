-- =====================================================
-- STREAK BONUS SYSTEM MIGRATION
-- =====================================================

-- Add streak tracking columns to existing at_bat_predictions table
ALTER TABLE at_bat_predictions ADD COLUMN IF NOT EXISTS streak_count INTEGER DEFAULT 0;
ALTER TABLE at_bat_predictions ADD COLUMN IF NOT EXISTS streak_bonus INTEGER DEFAULT 0;

-- Drop the existing view first
DROP VIEW IF EXISTS predictions_with_users;

-- Recreate the predictions_with_users view to include streak information
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
    u.raw_user_meta_data
FROM at_bat_predictions p
LEFT JOIN auth.users u ON p.user_id = u.id;

-- Grant access to the updated view
GRANT SELECT ON predictions_with_users TO authenticated;
